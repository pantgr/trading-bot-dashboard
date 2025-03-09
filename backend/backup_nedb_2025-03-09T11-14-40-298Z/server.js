// server.js - Updated to use MongoDB instead of NeDB
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const configRoutes = require('./routes/configRoutes');
const signalRoutes = require('./routes/signalRoutes');
const marketDataRoutes = require('./routes/marketDataRoutes');
const adminRoutes = require('./routes/adminRoutes');

// MongoDB connection
const connectDB = require('./config/mongodb');

// Initialize MongoDB connection before setting up routes
console.log('Connecting to MongoDB...');
connectDB()
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });

// Import services
const binanceService = require('./services/binanceService');
const indicatorsService = require('./services/indicatorsService');
const tradingBot = require('./services/tradingBotService');
const virtualTradingService = require('./services/virtualTrading');

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
    message: 'Server is running with MongoDB database',
    tradingBot: status,
    mongodb: 'connected'
  });
});

// API for the trading bot
app.post('/api/bot/start', async (req, res) => {
  // ... existing code
});

// ... rest of your server.js code ...

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

// ... rest of your server.js code ...

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with MongoDB storage`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`Trading bot status: ${tradingBot.isRunning ? 'RUNNING' : 'STOPPED'}`);
});

// Handle process errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});