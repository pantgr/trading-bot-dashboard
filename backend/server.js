// backend/server.js - Comprehensive update with improved error handling and diagnostics
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// MongoDB connection
const connectDB = require('./config/mongodb');

// Create Express application
const app = express();

// Create a logger to track errors
const logger = {
  info: (message) => {
    console.log(`[INFO] ${new Date().toISOString()}: ${message}`);
  },
  error: (message, error) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error);
    
    // Optionally log to file for production
    if (process.env.NODE_ENV === 'production') {
      try {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, 'error.log');
        fs.appendFileSync(
          logFile, 
          `${new Date().toISOString()} - ${message} - ${error?.stack || error}\n`
        );
      } catch (logError) {
        console.error('Failed to write to log file:', logError);
      }
    }
  },
  warn: (message) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`);
  }
};

// Track connection state
const connectionState = {
  mongodb: 'disconnected',
  serverStarted: false,
  activeSockets: 0,
  lastError: null
};

// Connect to MongoDB before importing models and services
logger.info('Connecting to MongoDB...');

// MongoDB connection promise with retry logic
const connectWithRetry = async (retries = 5, delay = 5000) => {
  let currentAttempt = 0;
  
  while (currentAttempt < retries) {
    try {
      currentAttempt++;
      logger.info(`MongoDB connection attempt ${currentAttempt}/${retries}`);
      const connection = await connectDB();
      connectionState.mongodb = 'connected';
      return connection;
    } catch (err) {
      connectionState.mongodb = 'error';
      connectionState.lastError = err.message;
      
      if (currentAttempt === retries) {
        logger.error('MongoDB connection failed after all retries', err);
        throw err;
      }
      
      logger.warn(`MongoDB connection attempt failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Start connection process with retry logic
connectWithRetry()
  .then(() => {
    logger.info('MongoDB connected successfully');
    startServer();  // Start server only after MongoDB is connected
  })
  .catch(err => {
    logger.error('Failed to connect to MongoDB after retries', err);
    
    // In development, we'll still start the server for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Starting server anyway for development purposes');
      startServer();
    } else {
      process.exit(1);
    }
  });

// Function to start server after MongoDB is connected
function startServer() {
  try {
    // Import routes - do this after MongoDB connection to avoid model errors
    const configRoutes = require('./routes/configRoutes');
    const signalRoutes = require('./routes/signalRoutes');
    const marketDataRoutes = require('./routes/marketDataRoutes');
    const adminRoutes = require('./routes/adminRoutes');
    const botSettingsRouter = require('./routes/botSettings');
    
    // Try to import the health check routes
    let healthCheckRoutes;
    try {
      healthCheckRoutes = require('./routes/healthCheckRoutes');
    } catch (error) {
      logger.warn(`Could not import healthCheckRoutes: ${error.message}`);
    }
    
    // If healthCheckRoutes doesn't exist, we'll provide a basic implementation
    const fallbackHealthCheck = express.Router();
    fallbackHealthCheck.get('/', async (req, res) => {
      res.status(200).json({ 
        status: 'ok', 
        message: 'Server is running with MongoDB storage',
        mongodb: connectionState.mongodb,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Import services - do this after MongoDB connection
    const binanceService = require('./services/binanceService');
    const indicatorsService = require('./services/indicatorsService');
    const tradingBot = require('./services/tradingBotService');
    const virtualTradingService = require('./services/virtualTrading');

    // Setup CORS to allow requests from the frontend
    app.use(cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: false
    }));

    // Setup to process JSON in requests
    app.use(express.json());
    
    // Add request logging middleware
    app.use((req, res, next) => {
      const start = Date.now();
      
      // Log when request completes
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
      });
      
      next();
    });
    
    // Add error handling middleware
    app.use((err, req, res, next) => {
      logger.error(`Request error: ${req.method} ${req.originalUrl}`, err);
      
      res.status(500).json({ 
        error: 'Internal Server Error', 
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
      });
    });

    // Helper function to convert USD to BTC
    async function convertUSDtoBTC(usdAmount) {
      try {
        const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
        return usdAmount / btcPrice;
      } catch (error) {
        logger.error('Error converting USD to BTC:', error);
        return 0;
      }
    }

    // Helper function to convert BTC to USD
    async function convertBTCtoUSD(btcAmount) {
      try {
        const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
        return btcAmount * btcPrice;
      } catch (error) {
        logger.error('Error converting BTC to USD:', error);
        return 0;
      }
    }

    // Health check route
    app.use('/api/health', healthCheckRoutes || fallbackHealthCheck);

    // Add all router modules
    app.use('/api/bot', botSettingsRouter);
    app.use('/api/config', configRoutes);
    app.use('/api/signals', signalRoutes);
    app.use('/api/market-data', marketDataRoutes);
    app.use('/api/admin', adminRoutes);
  
  // Εφαρμογή επιπλέον διαδρομών
  try {
    const registerAdditionalRoutes = require('./register-routes');
    registerAdditionalRoutes(app);
    console.log('Successfully registered additional routes');
  } catch (error) {
    console.error('Failed to register additional routes:', error);
  }

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io with better error handling
    const io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: false
      },
      pingTimeout: 60000, // Increase ping timeout for better stability
      pingInterval: 25000, // Adjust ping interval
      connectTimeout: 30000, // Connection timeout
      transports: ['websocket', 'polling'] // Prioritize websocket but fall back to polling
    });

    // Store reference to io for health checks
    global.io = io;

    // WebSocket connections
    io.on('connection', (socket) => {
      connectionState.activeSockets++;
      logger.info(`New client connected. Total active: ${connectionState.activeSockets}`);
      
      // Add connection diagnostic data to the socket
      socket.connectionData = {
        connectedAt: new Date(),
        clientIp: socket.handshake.headers['x-forwarded-for'] || socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        subscriptions: new Set(),
        activeBots: new Set()
      };
      
      // Event handler for subscribing to market data
      socket.on('subscribe_market', async (data) => {
        const { symbol, interval = '1h' } = data;
        logger.info(`Client ${socket.id} subscribing to market data for ${symbol} (${interval})`);
        
        // Track this subscription
        socket.connectionData.subscriptions.add(`${symbol}-${interval}`);
        
        try {
          // Get historical data
          const historicalData = await binanceService.getHistoricalCandles(symbol, interval);
          socket.emit('historical_data', { symbol, interval, data: historicalData });
          
          // Get indicators
          const indicatorsData = await indicatorsService.initializeIndicators(symbol, interval);
          socket.emit('indicators_data', { 
            symbol, 
            interval, 
            indicators: indicatorsData.indicators,
            signals: indicatorsData.signals
          });
          
          // Callback for price updates
          const priceCallback = (candle) => {
            socket.emit('price_update', { 
              symbol: candle.symbol, 
              time: candle.time, 
              price: candle.close,
              candle
            });
          };
          
          // Store the callback for later cleanup
          socket.priceCallbacks = socket.priceCallbacks || {};
          socket.priceCallbacks[`${symbol}-${interval}`] = priceCallback;
          
          // Subscribe to price updates
          binanceService.subscribeToCandleUpdates(symbol, interval, priceCallback);
          
          // If user has subscribed to BTCUSDT, send price updates to all
          if (symbol === 'BTCUSDT') {
            const btcPriceCallback = (candle) => {
              io.emit('btc_price_update', {
                price: candle.close,
                time: candle.time
              });
            };
            socket.btcPriceCallback = btcPriceCallback;
            binanceService.subscribeToCandleUpdates('BTCUSDT', '1m', btcPriceCallback);
          }
          
          // Send current portfolio to the client on subscription
          try {
            const portfolio = await virtualTradingService.getPortfolio('default');
            if (portfolio) {
              socket.emit('portfolio_update', portfolio);
            }
          } catch (err) {
            logger.error('Error sending portfolio on subscription:', err);
          }
        } catch (error) {
          logger.error(`Error subscribing to market data for ${symbol}:`, error);
          socket.emit('error', { 
            message: `Failed to subscribe to market data for ${symbol}`, 
            error: error.message
          });
        }
      });
      
      // Event handler for unsubscribing from market data
      socket.on('unsubscribe_market', (data) => {
        const { symbol, interval = '1h' } = data;
        logger.info(`Client ${socket.id} unsubscribing from market data for ${symbol} (${interval})`);
        
        // Remove from tracking
        socket.connectionData.subscriptions.delete(`${symbol}-${interval}`);
        
        // Unsubscribe from Binance
        if (socket.priceCallbacks && socket.priceCallbacks[`${symbol}-${interval}`]) {
          binanceService.unsubscribeFromCandleUpdates(
            symbol, 
            interval, 
            socket.priceCallbacks[`${symbol}-${interval}`]
          );
          
          delete socket.priceCallbacks[`${symbol}-${interval}`];
        }
        
        // If user had subscribed to BTCUSDT, cancel the callback
        if (symbol === 'BTCUSDT' && socket.btcPriceCallback) {
          binanceService.unsubscribeFromCandleUpdates('BTCUSDT', '1m', socket.btcPriceCallback);
          delete socket.btcPriceCallback;
        }
      });
      
      // Event handler for starting the bot
      socket.on('start_bot', async (data) => {
        const { symbol, interval = '5m', userId = 'default' } = data;
        logger.info(`Client ${socket.id} starting bot for ${symbol} (${interval}) for user ${userId}`);
        
        // Track this bot
        socket.connectionData.activeBots.add(`${symbol}-${interval}-${userId}`);
        
        try {
          // Start the bot
          await tradingBot.startMonitoring(symbol, interval, userId);
          
          // Set up the socket to receive updates from the bot
          socket.join(`bot:${userId}`);
          
          // Update the client
          socket.emit('bot_started', { 
            symbol, 
            interval, 
            userId, 
            time: Date.now() 
          });
        } catch (error) {
          logger.error(`Error starting bot for ${symbol}:`, error);
          socket.emit('error', { 
            message: `Failed to start bot for ${symbol}`, 
            error: error.message
          });
        }
      });
      
      // Event handler for stopping the bot
      socket.on('stop_bot', async (data) => {
        const { symbol, interval = '5m', userId = 'default' } = data;
        logger.info(`Client ${socket.id} stopping bot for ${symbol} (${interval}) for user ${userId}`);
        
        // Remove from tracking
        socket.connectionData.activeBots.delete(`${symbol}-${interval}-${userId}`);
        
        try {
          // Stop the bot
          const result = await tradingBot.stopMonitoring(symbol, interval, userId);
          
          // Update the client
          socket.emit('bot_stopped', { 
            symbol, 
            interval, 
            userId, 
            success: result, 
            time: Date.now() 
          });
        } catch (error) {
          logger.error(`Error stopping bot for ${symbol}:`, error);
          socket.emit('error', { 
            message: `Failed to stop bot for ${symbol}`, 
            error: error.message
          });
        }
      });
      
      // Handle disconnection with better cleanup
      socket.on('disconnect', (reason) => {
        connectionState.activeSockets--;
        logger.info(`Client ${socket.id} disconnected: ${reason}. Total active: ${connectionState.activeSockets}`);
        
        // Clean up all price subscriptions
        if (socket.priceCallbacks) {
          for (const [key, callback] of Object.entries(socket.priceCallbacks)) {
            const [symbol, interval] = key.split('-');
            binanceService.unsubscribeFromCandleUpdates(symbol, interval, callback);
          }
        }
        
        // Cancel the BTC subscription if it exists
        if (socket.btcPriceCallback) {
          binanceService.unsubscribeFromCandleUpdates('BTCUSDT', '1m', socket.btcPriceCallback);
        }
        
        // Log connection diagnostic information
        if (socket.connectionData) {
          logger.info(`Client ${socket.id} connection stats:`, {
            duration: (new Date() - socket.connectionData.connectedAt) / 1000,
            subscriptions: Array.from(socket.connectionData.subscriptions),
            activeBots: Array.from(socket.connectionData.activeBots)
          });
        }
      });
      
      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket ${socket.id} error:`, error);
      });
    });

    // Monitor Socket.io connection state
    io.engine.on('connection_error', (err) => {
      logger.error('Socket.io connection error:', err);
    });

    // Event listeners for the trading bot
    tradingBot.on('trade_signal', async (signal) => {
      logger.info(`New trade signal: ${signal.action} ${signal.symbol} (${signal.indicator})`);
      
      // Check if symbol is in a BTC pair
      const isBtcPair = signal.symbol.endsWith('BTC');
      
      // If it's a USD pair, convert the price to BTC for reference
      if (!isBtcPair && signal.price) {
        try {
          const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
          signal.btcPrice = signal.price / btcPrice;
          signal.btcValue = signal.value / btcPrice;
        } catch (error) {
          logger.error('Error converting signal price to BTC:', error);
        }
      }
      
      // Send the signal to connected clients
      io.emit('trade_signal', signal);
      
      // Execute automatic trade only for CONSENSUS signals
      if (signal.indicator === 'CONSENSUS') {
        logger.info(`Processing consensus-based trade: ${signal.action} for ${signal.symbol}`);
        
        try {
          // Process the signal using virtualTradingService
          const updatedPortfolio = await virtualTradingService.processSignal(signal);
          
          // Broadcast the updated portfolio
          if (updatedPortfolio) {
            setTimeout(async () => {
              // Get the latest portfolio to ensure all data is up to date
              const latestPortfolio = await virtualTradingService.getPortfolio(signal.userId || 'default');
              io.emit('portfolio_update', latestPortfolio);
            }, 1000);
          }
        } catch (error) {
          logger.error('Error processing consensus signal:', error);
        }
      }
    });

    tradingBot.on('price_update', (data) => {
      // Send the price update to connected clients
      io.to(`bot:${data.userId}`).emit('price_update', data);
    });

    tradingBot.on('indicators_update', (data) => {
      // Send the indicators update to connected clients
      io.to(`bot:${data.userId}`).emit('indicators_update', data);
    });

    // Connect bot settings events
    tradingBot.on('settings_updated', (settings) => {
      logger.info('Broadcasting bot settings update to all clients');
      io.emit('bot_settings_updated', settings);
    });

    // Start server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} with MongoDB storage`);
      logger.info(`API endpoints available at http://localhost:${PORT}/api`);
      logger.info(`Trading bot status: ${tradingBot.isRunning ? 'RUNNING' : 'STOPPED'}`);
      connectionState.serverStarted = true;
    });
    
    // Set up error handlers for the server
    server.on('error', (error) => {
      connectionState.serverStarted = false;
      logger.error('HTTP Server error:', error);
      
      // Handle specific errors
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please use a different port.`);
      }
    });

    // Set up periodic database maintenance
    const setupDatabaseMaintenance = () => {
      // Cleanup old data once a day
      const cleanup = async () => {
        try {
          logger.info('Starting daily database maintenance...');
          
          // Import models with error handling
          let Signal, MarketData, ActiveBot;
          
          try { Signal = require('./models/Signal'); }
          catch (err) { logger.warn('Could not import Signal model:', err.message); }
          
          try { MarketData = require('./models/MarketData'); }
          catch (err) { logger.warn('Could not import MarketData model:', err.message); }
          
          try { ActiveBot = require('./models/ActiveBot'); }
          catch (err) { logger.warn('Could not import ActiveBot model:', err.message); }
          
          // Check for cleanup methods before calling
          if (Signal && typeof Signal.cleanup === 'function') {
            await Signal.cleanup(30 * 24 * 60 * 60 * 1000); // 30 days for signals
          } else {
            logger.warn('Signal model or cleanup method not available');
          }
          
          if (MarketData && typeof MarketData.cleanup === 'function') {
            await MarketData.cleanup({
              priceDataAge: 1 * 24 * 60 * 60 * 1000,  // 1 day for price data
              candleDataAge: 7 * 24 * 60 * 60 * 1000  // 7 days for candle data
            });
          } else {
            logger.warn('MarketData model or cleanup method not available');
          }
          
          if (ActiveBot && typeof ActiveBot.cleanup === 'function') {
            await ActiveBot.cleanup(7 * 24 * 60 * 60 * 1000); // 7 days for inactive bots
          } else {
            logger.warn('ActiveBot model or cleanup method not available');
          }
          
          logger.info('Daily database maintenance completed');
        } catch (error) {
          logger.error('Error during database maintenance:', error);
        }
      };
      
      // Run cleanup after server starts
      setTimeout(cleanup, 60000); // 1 minute after start
      
      // Then schedule daily
      setInterval(cleanup, 24 * 60 * 60 * 1000); // Run once every 24 hours
    };

    setupDatabaseMaintenance();
  } catch (startupError) {
    logger.error('Critical error during server startup:', startupError);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown() {
  logger.info('Received shutdown signal, closing connections...');
  
  // Close Socket.io connections if possible
  if (global.io) {
    global.io.close(() => {
      logger.info('Socket.io connections closed');
    });
  }
  
  // Close MongoDB connection if possible
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  } else {
    logger.info('No MongoDB connection to close');
    process.exit(0);
  }
  
  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
}

// Handle uncaught exceptions and unhandled rejections with better logging
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  
  // In production, exit the process after logging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  
  // In production, exit the process after logging
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});