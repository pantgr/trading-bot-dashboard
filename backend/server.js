// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Εισαγωγή των services
const binanceService = require('./services/binanceService');
const indicatorsService = require('./services/indicatorsService');
const tradingBot = require('./services/tradingBotService');

// Αρχικοποίηση Express
const app = express();

// Ρύθμιση CORS για να επιτρέπει αιτήματα από το frontend
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

// Ρύθμιση για να επεξεργάζεται το JSON στα αιτήματα
app.use(express.json());

// In-memory storage αντί για MongoDB
global.db = {
  portfolios: new Map(),
  transactions: []
};

// Δημιουργία βασικού χαρτοφυλακίου για testing
global.db.portfolios.set('default', {
  userId: 'default',
  balance: 10000,
  assets: [],
  equity: 10000,
  createdAt: Date.now(),
  updatedAt: Date.now()
});

console.log('Using in-memory storage instead of MongoDB');
console.log('Default portfolio initialized:', global.db.portfolios.get('default'));

// Αρχικά routes
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is running with in-memory storage',
    tradingBot: tradingBot.getStatus()
  });
});

// API για price data
app.get('/api/market-data/historical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = '100' } = req.query;
    
    const data = await binanceService.getHistoricalCandles(
      symbol,
      interval,
      parseInt(limit)
    );
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

app.get('/api/market-data/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const price = await binanceService.getCurrentPrice(symbol);
    
    res.json({ symbol, price });
  } catch (error) {
    console.error('Error fetching current price:', error);
    res.status(500).json({ error: 'Failed to fetch current price' });
  }
});

// API για τεχνικούς δείκτες
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

// API για το trading bot
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

app.post('/api/bot/stop', (req, res) => {
  try {
    const { symbol, interval = '5m', userId = 'default' } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const result = tradingBot.stopMonitoring(symbol, interval, userId);
    
    res.json({ success: result });
  } catch (error) {
    console.error('Error stopping trading bot:', error);
    res.status(500).json({ error: 'Failed to stop trading bot' });
  }
});

app.get('/api/bot/status', (req, res) => {
  try {
    const status = tradingBot.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: 'Failed to get bot status' });
  }
});

app.get('/api/bot/active-symbols', (req, res) => {
  try {
    const { userId } = req.query;
    const activeSymbols = tradingBot.getActiveSymbols(userId);
    res.json(activeSymbols);
  } catch (error) {
    console.error('Error getting active symbols:', error);
    res.status(500).json({ error: 'Failed to get active symbols' });
  }
});

// API για virtual trading - Χαρτοφυλάκιο
app.get('/api/virtual-trade/portfolio', (req, res) => {
  const userId = req.query.userId || 'default';
  console.log(`Fetching portfolio for user: ${userId}`);
  
  const portfolio = global.db.portfolios.get(userId) || {
    userId,
    balance: 10000,
    assets: [],
    equity: 10000,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // Αποθήκευση του portfolio αν δεν υπάρχει
  if (!global.db.portfolios.has(userId)) {
    global.db.portfolios.set(userId, portfolio);
    console.log(`Created new portfolio for user: ${userId}`);
  }
  
  console.log('Returning portfolio:', portfolio);
  res.json(portfolio);
});

// API για virtual trading - Ιστορικό συναλλαγών
app.get('/api/virtual-trade/history', (req, res) => {
  const userId = req.query.userId || 'default';
  console.log(`Fetching transaction history for user: ${userId}`);
  
  const userTransactions = global.db.transactions.filter(tx => tx.userId === userId);
  console.log(`Found ${userTransactions.length} transactions for user: ${userId}`);
  
  res.json(userTransactions);
});

// API για virtual trading - Εκτέλεση συναλλαγής
app.post('/api/virtual-trade/execute', (req, res) => {
  try {
    const { userId = 'default', symbol, action, quantity, price } = req.body;
    console.log(`Executing trade: ${action} ${quantity} ${symbol} @ $${price} for user ${userId}`);
    
    if (!symbol || !action || !quantity || !price) {
      console.log('Missing required parameters');
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    if (action !== 'BUY' && action !== 'SELL') {
      console.log('Invalid action:', action);
      return res.status(400).json({ error: 'Invalid action. Must be BUY or SELL' });
    }
    
    // Λήψη χαρτοφυλακίου
    let portfolio = global.db.portfolios.get(userId);
    if (!portfolio) {
      portfolio = {
        userId,
        balance: 10000,
        assets: [],
        equity: 10000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      global.db.portfolios.set(userId, portfolio);
      console.log(`Created new portfolio for user: ${userId}`);
    }
    
    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(price);
    
    // Εκτέλεση συναλλαγής
    if (action === 'BUY') {
      const cost = parsedQuantity * parsedPrice;
      
      // Έλεγχος επαρκούς υπολοίπου
      if (portfolio.balance < cost) {
        console.log(`Insufficient balance: ${portfolio.balance} < ${cost}`);
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      
      // Ενημέρωση υπολοίπου
      portfolio.balance -= cost;
      
      // Προσθήκη ή ενημέρωση asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === symbol);
      
      if (assetIndex >= 0) {
        // Ενημέρωση υπάρχοντος asset
        const existingQuantity = portfolio.assets[assetIndex].quantity;
        const existingValue = portfolio.assets[assetIndex].averagePrice * existingQuantity;
        const newValue = existingValue + (parsedQuantity * parsedPrice);
        const newQuantity = existingQuantity + parsedQuantity;
        
        portfolio.assets[assetIndex].quantity = newQuantity;
        portfolio.assets[assetIndex].averagePrice = newValue / newQuantity;
        portfolio.assets[assetIndex].currentPrice = parsedPrice;
        
        console.log(`Updated asset: ${symbol}, new quantity: ${newQuantity}`);
      } else {
        // Προσθήκη νέου asset
        portfolio.assets.push({
          symbol,
          quantity: parsedQuantity,
          averagePrice: parsedPrice,
          currentPrice: parsedPrice
        });
        
        console.log(`Added new asset: ${symbol}, quantity: ${parsedQuantity}`);
      }
    } 
    else if (action === 'SELL') {
      // Εύρεση asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === symbol);
      
      if (assetIndex < 0) {
        console.log(`Asset not found: ${symbol}`);
        return res.status(400).json({ error: `Asset ${symbol} not found in portfolio` });
      }
      
      const asset = portfolio.assets[assetIndex];
      
      // Έλεγχος επαρκούς ποσότητας
      if (asset.quantity < parsedQuantity) {
        console.log(`Insufficient quantity: ${asset.quantity} < ${parsedQuantity}`);
        return res.status(400).json({ error: `Insufficient ${symbol} quantity` });
      }
      
      const revenue = parsedQuantity * parsedPrice;
      
      // Ενημέρωση υπολοίπου
      portfolio.balance += revenue;
      
      // Ενημέρωση ποσότητας asset
      asset.quantity -= parsedQuantity;
      asset.currentPrice = parsedPrice;
      
      console.log(`Sold ${parsedQuantity} of ${symbol} for $${revenue}`);
      
      // Αφαίρεση asset αν η ποσότητα είναι 0
      if (asset.quantity <= 0) {
        portfolio.assets.splice(assetIndex, 1);
        console.log(`Removed asset ${symbol} from portfolio`);
      }
    }
    
    // Υπολογισμός νέου portfolio equity
    const assetsValue = portfolio.assets.reduce(
      (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
      0
    );
    
    portfolio.equity = portfolio.balance + assetsValue;
    portfolio.updatedAt = Date.now();
    
    // Καταγραφή συναλλαγής
    const transaction = {
      id: Date.now().toString(),
      userId,
      symbol,
      action,
      quantity: parsedQuantity,
      price: parsedPrice,
      value: action === 'BUY' ? -(parsedQuantity * parsedPrice) : (parsedQuantity * parsedPrice),
      timestamp: Date.now(),
      signal: 'MANUAL'
    };
    
    global.db.transactions.push(transaction);
    
    console.log('Transaction completed:', transaction);
    console.log('Updated portfolio:', portfolio);
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error executing trade:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Δημιουργία HTTP server
const server = http.createServer(app);

// Αρχικοποίηση Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// WebSocket συνδέσεις
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Event handler για εγγραφή σε δεδομένα αγοράς
  socket.on('subscribe_market', async (data) => {
    const { symbol, interval = '1h' } = data;
    console.log(`Client subscribing to market data for ${symbol} (${interval})`);
    
    try {
      // Λήψη ιστορικών δεδομένων
      const historicalData = await binanceService.getHistoricalCandles(symbol, interval);
      socket.emit('historical_data', { symbol, interval, data: historicalData });
      
      // Λήψη δεικτών
      const indicatorsData = await indicatorsService.initializeIndicators(symbol, interval);
      socket.emit('indicators_data', { 
        symbol, 
        interval, 
        indicators: indicatorsData.indicators,
        signals: indicatorsData.signals
      });
      
      // Callback για ενημερώσεις τιμών
      const priceCallback = (candle) => {
        socket.emit('price_update', { 
          symbol: candle.symbol, 
          time: candle.time, 
          price: candle.close,
          candle
        });
      };
      
      // Αποθήκευση του callback για αργότερα
      socket.priceCallbacks = socket.priceCallbacks || {};
      socket.priceCallbacks[`${symbol}-${interval}`] = priceCallback;
      
      // Εγγραφή στις ενημερώσεις τιμών
      binanceService.subscribeToCandleUpdates(symbol, interval, priceCallback);
    } catch (error) {
      console.error(`Error subscribing to market data for ${symbol}:`, error);
      socket.emit('error', { 
        message: `Failed to subscribe to market data for ${symbol}`, 
        error: error.message
      });
    }
  });
  
  // Event handler για ακύρωση εγγραφής από δεδομένα αγοράς
  socket.on('unsubscribe_market', (data) => {
    const { symbol, interval = '1h' } = data;
    console.log(`Client unsubscribing from market data for ${symbol} (${interval})`);
    
    // Ακύρωση εγγραφής από το Binance
    if (socket.priceCallbacks && socket.priceCallbacks[`${symbol}-${interval}`]) {
      binanceService.unsubscribeFromCandleUpdates(
        symbol, 
        interval, 
        socket.priceCallbacks[`${symbol}-${interval}`]
      );
      
      delete socket.priceCallbacks[`${symbol}-${interval}`];
    }
  });
  
  // Event handler για εκκίνηση του bot
  socket.on('start_bot', async (data) => {
    const { symbol, interval = '5m', userId = 'default' } = data;
    console.log(`Client starting bot for ${symbol} (${interval}) for user ${userId}`);
    
    try {
      // Εκκίνηση του bot
      await tradingBot.startMonitoring(symbol, interval, userId);
      
      // Ρύθμιση του socket για να λαμβάνει ενημερώσεις από το bot
      socket.join(`bot:${userId}`);
      
      // Ενημέρωση του client
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
  
  // Event handler για διακοπή του bot
  socket.on('stop_bot', (data) => {
    const { symbol, interval = '5m', userId = 'default' } = data;
    console.log(`Client stopping bot for ${symbol} (${interval}) for user ${userId}`);
    
    try {
      // Διακοπή του bot
      const result = tradingBot.stopMonitoring(symbol, interval, userId);
      
      // Ενημέρωση του client
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
  
  // Προσθήκη handlers για disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    
    // Ακύρωση όλων των εγγραφών τιμών
    if (socket.priceCallbacks) {
      for (const [key, callback] of Object.entries(socket.priceCallbacks)) {
        const [symbol, interval] = key.split('-');
        binanceService.unsubscribeFromCandleUpdates(symbol, interval, callback);
      }
    }
  });
});

// Event listeners για το trading bot
tradingBot.on('trade_signal', (signal) => {
  console.log(`New trade signal: ${signal.action} ${signal.symbol} (${signal.indicator})`);
  
  // Αποστολή του σήματος στους συνδεδεμένους clients
  io.emit('trade_signal', signal);
  
  // Εκτέλεση αυτόματης συναλλαγής μόνο για σήματα CONSENSUS
  if (signal.indicator === 'CONSENSUS') {
    console.log(`Processing consensus-based trade: ${signal.action} for ${signal.symbol}`);
	
	// Προαιρετικά: Αυτόματη εκτέλεση συναλλαγής
	if (global.db.portfolios.has(signal.userId)) {
		const portfolio = global.db.portfolios.get(signal.userId);
		
    // Έλεγχος αν υπάρχει διαθέσιμο υπόλοιπο για αγορά ή asset για πώληση
    if (signal.action === 'BUY') {
      // Υπολογισμός ποσού επένδυσης (π.χ. 10% του διαθέσιμου υπολοίπου)
      const investmentAmount = portfolio.balance * 0.1;
      const quantity = investmentAmount / signal.price;
      
      if (portfolio.balance >= investmentAmount && quantity > 0) {
        // Εκτέλεση αγοράς
        portfolio.balance -= investmentAmount;
        
        // Προσθήκη ή ενημέρωση του asset
        const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
        
        if (assetIndex >= 0) {
          const asset = portfolio.assets[assetIndex];
          const totalQuantity = asset.quantity + quantity;
          const totalValue = (asset.quantity * asset.averagePrice) + (quantity * signal.price);
          
          asset.quantity = totalQuantity;
          asset.averagePrice = totalValue / totalQuantity;
          asset.currentPrice = signal.price;
        } else {
          portfolio.assets.push({
            symbol: signal.symbol,
            quantity,
            averagePrice: signal.price,
            currentPrice: signal.price
          });
        }
        
        // Ενημέρωση του equity
        const assetsValue = portfolio.assets.reduce(
          (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
          0
        );
        
        portfolio.equity = portfolio.balance + assetsValue;
        portfolio.updatedAt = Date.now();
        
        // Καταγραφή της συναλλαγής
        const transaction = {
          id: Date.now().toString(),
          userId: signal.userId,
          symbol: signal.symbol,
          action: 'BUY',
          quantity,
          price: signal.price,
          value: -(quantity * signal.price),
          timestamp: Date.now(),
          signal: signal.indicator
        };
        
        global.db.transactions.push(transaction);
        
        // Αποστολή της ενημέρωσης στους συνδεδεμένους clients
        io.emit('portfolio_update', portfolio);
        io.emit('transaction_created', transaction);
        
        console.log(`Auto-executed BUY for ${signal.userId}: ${quantity} ${signal.symbol} @ $${signal.price}`);
      }
    } else if (signal.action === 'SELL') {
      // Έλεγχος αν υπάρχει το asset στο χαρτοφυλάκιο
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
      
      if (assetIndex >= 0) {
        const asset = portfolio.assets[assetIndex];
        
        // Πώληση μέρους της θέσης (π.χ. 25%)
        const sellQuantity = asset.quantity * 0.25;
        const revenue = sellQuantity * signal.price;
        
        // Ενημέρωση του υπολοίπου και του asset
        portfolio.balance += revenue;
        asset.quantity -= sellQuantity;
        asset.currentPrice = signal.price;
        
        // Αφαίρεση του asset αν η ποσότητα είναι 0
        if (asset.quantity <= 0) {
          portfolio.assets.splice(assetIndex, 1);
        }
        
        // Ενημέρωση του equity
        const assetsValue = portfolio.assets.reduce(
          (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
          0
        );
        
        portfolio.equity = portfolio.balance + assetsValue;
        portfolio.updatedAt = Date.now();
        
        // Καταγραφή της συναλλαγής
        const transaction = {
          id: Date.now().toString(),
          userId: signal.userId,
          symbol: signal.symbol,
          action: 'SELL',
          quantity: sellQuantity,
          price: signal.price,
          value: sellQuantity * signal.price,
          timestamp: Date.now(),
          signal: signal.indicator
        };
        
        global.db.transactions.push(transaction);
        
        // Αποστολή της ενημέρωσης στους συνδεδεμένους clients
        io.to(`bot:${signal.userId}`).emit('portfolio_update', portfolio);
        io.to(`bot:${signal.userId}`).emit('transaction_created', transaction);
        
		console.log(`Auto-executed SELL for ${signal.userId}: ${sellQuantity} ${signal.symbol} @ $${signal.price}`);
      }
    }
  } // Κλείσιμο του if (global.db.portfolios.has(signal.userId))
  } // Κλείσιμο του if (signal.indicator === 'CONSENSUS')
}); // Κλείσιμο του tradingBot.on

tradingBot.on('price_update', (data) => {
  // Αποστολή της ενημέρωσης τιμής στους συνδεδεμένους clients
  io.to(`bot:${data.userId}`).emit('price_update', data);
});

tradingBot.on('indicators_update', (data) => {
  // Αποστολή της ενημέρωσης δεικτών στους συνδεδεμένους clients
  io.to(`bot:${data.userId}`).emit('indicators_update', data);
});

// Εκκίνηση server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} with in-memory storage`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`Trading bot status: ${tradingBot.isRunning ? 'RUNNING' : 'STOPPED'}`);
});

// Χειρισμός σφαλμάτων process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});