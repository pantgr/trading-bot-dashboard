// server.js - Final updated version with all new routes
require('dotenv').config();
const express = require('express');
const configRoutes = require('./routes/configRoutes');
const signalRoutes = require('./routes/signalRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const adminRoutes = require('./routes/adminRoutes');

const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Fix for util._extend deprecation warning
if (require('util')._extend) {
  const originalExtend = require('util')._extend;
  require('util')._extend = function(target, source) {
    return Object.assign(target, source);
  };
}

// Initialize NeDB (automatically done when importing the config)
require('./config/nedb');

// Import services
const binanceService = require('./services/binanceService');
const indicatorsService = require('./services/indicatorsService');
const tradingBot = require('./services/tradingBotService');
const virtualTradingService = require('./services/virtualTrading');

// Import route handlers
const botSettingsRouter = require('./routes/botSettings');

// Initialize Express
const app = express();

// Setup CORS to allow requests from the frontend
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

// Setup to process JSON in requests
app.use(express.json());

// Helper function to convert USD to BTC
async function convertUSDtoBTC(usdAmount) {
  try {
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    return usdAmount / btcPrice;
  } catch (error) {
    console.error('Error converting USD to BTC:', error);
    return 0;
  }
}

// Helper function to convert BTC to USD
async function convertBTCtoUSD(btcAmount) {
  try {
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    return btcAmount * btcPrice;
  } catch (error) {
    console.error('Error converting BTC to USD:', error);
    return 0;
  }
}

// Health check route
app.get('/api/health', async (req, res) => {
  console.log('Health check requested');
  const status = await tradingBot.getStatus();
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running with NeDB file-based storage',
    tradingBot: status
  });
});

// API for the trading bot
app.post('/api/bot/start', async (req, res) => {
  try {
    const { symbol, interval = '5m', userId = 'default' } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const result = await tradingBot.startMonitoring(symbol, interval, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error starting trading bot:', error);
    res.status(500).json({ error: 'Failed to start trading bot' });
  }
});

app.post('/api/bot/stop', async (req, res) => {
  try {
    const { symbol, interval = '5m', userId = 'default' } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const result = await tradingBot.stopMonitoring(symbol, interval, userId);
    
    res.json({ success: result });
  } catch (error) {
    console.error('Error stopping trading bot:', error);
    res.status(500).json({ error: 'Failed to stop trading bot' });
  }
});

app.get('/api/bot/status', async (req, res) => {
  try {
    const status = await tradingBot.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
});

app.get('/api/bot/active-symbols', async (req, res) => {
  try {
    const { userId } = req.query;
    const activeSymbols = await tradingBot.getActiveSymbols(userId);
    res.json(activeSymbols);
  } catch (error) {
    console.error('Error getting active symbols:', error);
    res.status(500).json({ error: 'Failed to get active symbols' });
  }
});

// API for technical indicators
app.get('/api/indicators/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h' } = req.query;
    
    const data = await indicatorsService.initializeIndicators(symbol, interval);
    
    res.json(data);
  } catch (error) {
    console.error('Error calculating indicators:', error);
    res.status(500).json({ error: 'Failed to calculate indicators' });
  }
});

// API for virtual trading - Portfolio
app.get('/api/virtual-trade/portfolio', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    console.log(`Fetching portfolio for user: ${userId}`);
    
    // Use the virtualTradingService to get the portfolio
    let portfolio = await virtualTradingService.getPortfolio(userId);
    
    // Ensure portfolio.assets is an array
    if (!portfolio) {
      portfolio = { userId, balance: 10000, assets: [], equity: 10000 };
    }
    
    if (!Array.isArray(portfolio.assets)) {
      portfolio.assets = [];
    }
    
    // Get BTC price for calculations
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    
    // Update BTC values
    if (portfolio) {
      portfolio.btcBalance = portfolio.balance / btcPrice;
      
      // Update asset prices in BTC
      for (const asset of portfolio.assets) {
        try {
          const currentPrice = await binanceService.getCurrentPrice(asset.symbol);
          asset.currentPrice = currentPrice;
          
          if (asset.symbol.endsWith('USDT')) {
            asset.btcPrice = asset.currentPrice / btcPrice;
          } else if (asset.symbol.endsWith('BTC')) {
            asset.btcPrice = asset.currentPrice;
          }
        } catch (priceErr) {
          console.warn(`Could not update price for ${asset.symbol}: ${priceErr.message}`);
        }
      }
      
      // Calculate total equity in BTC
      const assetsValueBTC = portfolio.assets.reduce(
        (sum, asset) => {
          const quantity = parseFloat(asset.quantity) || 0;
          const priceBTC = asset.btcPrice || (asset.currentPrice / btcPrice);
          return sum + (quantity * priceBTC);
        }, 
        0
      );
      
      portfolio.btcEquity = portfolio.btcBalance + assetsValueBTC;
    }
    
    console.log('Returning portfolio:', portfolio);
    res.json(portfolio);
  } catch (error) {
    console.error('Error in /portfolio endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// API for virtual trading - Transaction history
app.get('/api/virtual-trade/history', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    console.log(`Fetching transaction history for user: ${userId}`);
    
    // Use the virtualTradingService to get transaction history
    const transactions = await virtualTradingService.getTransactionHistory(userId);
    
    console.log(`Found ${transactions.length} transactions for user: ${userId}`);
    res.json(transactions);
  } catch (error) {
    console.error('Error in /history endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// API for virtual trading - Execute trade
app.post('/api/virtual-trade/execute', async (req, res) => {
  try {
    const { userId = 'default', symbol, action, quantity, price } = req.body;
    console.log(`Executing trade: ${action} ${quantity} ${symbol} @ price ${price} for user ${userId}`);
    
    if (!symbol || !action || !quantity || !price) {
      console.log('Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    if (action !== 'BUY' && action !== 'SELL') {
      console.log('Invalid action:', action);
      return res.status(400).json({ error: 'Invalid action. Must be BUY or SELL' });
    }
    
    // Execute the trade using the virtualTradingService
    const result = await virtualTradingService.manualTrade({
      userId,
      symbol,
      action,
      quantity: parseFloat(quantity),
      price: parseFloat(price)
    });
    
    // Broadcast the updated portfolio to all clients
    io.emit('portfolio_update', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error executing trade:', error);
    res.status(500).json({ error: error.message || 'Failed to execute trade' });
  }
});

// Add all router modules
app.use('/api/bot', botSettingsRouter);
app.use('/api/config', configRoutes);
app.use('/api/signals', signalRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/admin', adminRoutes);

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Event handler for subscribing to market data
  socket.on('subscribe_market', async (data) => {
    const { symbol, interval = '1h' } = data;
    console.log(`Client subscribing to market data for ${symbol} (${interval})`);
    
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
      
      // Store the callback for later
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
        console.error('Error sending portfolio on subscription:', err);
      }
    } catch (error) {
      console.error(`Error subscribing to market data for ${symbol}:`, error);
      socket.emit('error', { 
        message: `Failed to subscribe to market data for ${symbol}`, 
        error: error.message
      });
    }
  });
  
  // Event handler for unsubscribing from market data
  socket.on('unsubscribe_market', (data) => {
    const { symbol, interval = '1h' } = data;
    console.log(`Client unsubscribing from market data for ${symbol} (${interval})`);
    
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
    console.log(`Client starting bot for ${symbol} (${interval}) for user ${userId}`);
    
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
      console.error(`Error starting bot for ${symbol}:`, error);
      socket.emit('error', { 
        message: `Failed to start bot for ${symbol}`, 
        error: error.message
      });
    }
  });
  
  // Event handler for stopping the bot
  socket.on('stop_bot', async (data) => {
    const { symbol, interval = '5m', userId = 'default' } = data;
    console.log(`Client stopping bot for ${symbol} (${interval}) for user ${userId}`);
    
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
      console.error(`Error stopping bot for ${symbol}:`, error);
      socket.emit('error', { 
        message: `Failed to stop bot for ${symbol}`, 
        error: error.message
      });
    }
  });
  
  // Add handlers for disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    
    // Cancel all price subscriptions
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
  });
});

// Event listeners for the trading bot
tradingBot.on('trade_signal', async (signal) => {
  console.log(`New trade signal: ${signal.action} ${signal.symbol} (${signal.indicator})`);
  
  // Check if symbol is in a BTC pair
  const isBtcPair = signal.symbol.endsWith('BTC');
  
  // If it's a USD pair, convert the price to BTC for reference
  if (!isBtcPair && signal.price) {
    try {
      const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
      signal.btcPrice = signal.price / btcPrice;
      signal.btcValue = signal.value / btcPrice;
    } catch (error) {
      console.error('Error converting signal price to BTC:', error);
    }
  }
  
  // Send the signal to connected clients
  io.emit('trade_signal', signal);
  
  // Execute automatic trade only for CONSENSUS signals
  if (signal.indicator === 'CONSENSUS') {
    console.log(`Processing consensus-based trade: ${signal.action} for ${signal.symbol}`);
    
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
      console.error('Error processing consensus signal:', error);
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
  console.log('Broadcasting bot settings update to all clients');
  io.emit('bot_settings_updated', settings);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with NeDB storage`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`Trading bot status: ${tradingBot.isRunning ? 'RUNNING' : 'STOPPED'}`);
});

// Set up periodic database cleanup
const setupDatabaseMaintenance = () => {
  // Cleanup old data once a day
  setInterval(async () => {
    try {
      console.log('Starting daily database maintenance...');
      
      await Signal.cleanup(30 * 24 * 60 * 60 * 1000); // 30 days for signals
      
      await MarketData.cleanup({
        priceDataAge: 1 * 24 * 60 * 60 * 1000,  // 1 day for price data
        candleDataAge: 7 * 24 * 60 * 60 * 1000  // 7 days for candle data
      });
      
      await ActiveBot.cleanup(7 * 24 * 60 * 60 * 1000); // 7 days for inactive bots
      
      console.log('Daily database maintenance completed');
    } catch (error) {
      console.error('Error during database maintenance:', error);
    }
  }, 24 * 60 * 60 * 1000); // Run once every 24 hours
};

setupDatabaseMaintenance();

// Handle process errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});