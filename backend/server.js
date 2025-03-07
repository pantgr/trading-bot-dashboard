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
  btcBalance: 0, // Προσθήκη πεδίου για BTC balance
  assets: [],
  equity: 10000,
  btcEquity: 0, // Προσθήκη πεδίου για BTC equity
  createdAt: Date.now(),
  updatedAt: Date.now()
});

console.log('Using in-memory storage instead of MongoDB');
console.log('Default portfolio initialized:', global.db.portfolios.get('default'));

// Βοηθητική συνάρτηση για μετατροπή USD σε BTC
async function convertUSDtoBTC(usdAmount) {
  try {
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    return usdAmount / btcPrice;
  } catch (error) {
    console.error('Error converting USD to BTC:', error);
    return 0;
  }
}

// Βοηθητική συνάρτηση για μετατροπή BTC σε USD
async function convertBTCtoUSD(btcAmount) {
  try {
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    return btcAmount * btcPrice;
  } catch (error) {
    console.error('Error converting BTC to USD:', error);
    return 0;
  }
}

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
app.get('/api/virtual-trade/portfolio', async (req, res) => {
  const userId = req.query.userId || 'default';
  console.log(`Fetching portfolio for user: ${userId}`);
  
  let portfolio = global.db.portfolios.get(userId) || {
    userId,
    balance: 10000,
    btcBalance: 0, // Προσθήκη BTC balance
    assets: [],
    equity: 10000,
    btcEquity: 0, // Προσθήκη BTC equity
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  // Αποθήκευση του portfolio αν δεν υπάρχει
  if (!global.db.portfolios.has(userId)) {
    global.db.portfolios.set(userId, portfolio);
    console.log(`Created new portfolio for user: ${userId}`);
  }
  
  // Ενημέρωση των τιμών BTC σε πραγματικό χρόνο
  try {
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    portfolio.btcBalance = portfolio.balance / btcPrice;
    
    // Ενημέρωση των τιμών των assets
    for (const asset of portfolio.assets) {
      if (asset.symbol.endsWith('USDT')) {
        // Υπολογισμός της ισοδύναμης τιμής σε BTC
        asset.btcPrice = asset.currentPrice / btcPrice;
      } else if (asset.symbol.endsWith('BTC')) {
        // Ήδη σε BTC, δεν χρειάζεται μετατροπή
        asset.btcPrice = asset.currentPrice;
      }
    }
    
    // Υπολογισμός του συνολικού equity σε BTC
    const assetsValueBTC = portfolio.assets.reduce((sum, asset) => {
      const priceBTC = asset.btcPrice || (asset.currentPrice / btcPrice);
      return sum + (asset.quantity * priceBTC);
    }, 0);
    
    portfolio.btcEquity = portfolio.btcBalance + assetsValueBTC;
    portfolio.updatedAt = Date.now();
    
    // Αποθήκευση των αλλαγών
    global.db.portfolios.set(userId, portfolio);
  } catch (error) {
    console.error('Error updating BTC values:', error);
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
    
    // Λήψη χαρτοφυλακίου
    let portfolio = global.db.portfolios.get(userId);
    if (!portfolio) {
      portfolio = {
        userId,
        balance: 10000,
        btcBalance: 0,
        assets: [],
        equity: 10000,
        btcEquity: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      global.db.portfolios.set(userId, portfolio);
      console.log(`Created new portfolio for user: ${userId}`);
    }
    
    const parsedQuantity = parseFloat(quantity);
    const parsedPrice = parseFloat(price);
    
    // Έλεγχος αν είναι ζεύγος με BTC
    const isBtcPair = symbol.endsWith('BTC');
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    
    // Αν δεν έχει υπολογιστεί το btcBalance, το υπολογίζουμε τώρα
    if (portfolio.btcBalance === undefined || portfolio.btcBalance === 0) {
      portfolio.btcBalance = portfolio.balance / btcPrice;
    }
    
    // Εκτέλεση συναλλαγής
    if (action === 'BUY') {
      // Ανάλογα με το ζεύγος, υπολογίζουμε το κόστος
      let cost;
      if (isBtcPair) {
        // Άμεσο κόστος σε BTC
        cost = parsedQuantity * parsedPrice;
        
        // Έλεγχος επαρκούς υπολοίπου σε BTC
        if (portfolio.btcBalance < cost) {
          console.log(`Insufficient BTC balance: ${portfolio.btcBalance} < ${cost}`);
          return res.status(400).json({ error: 'Insufficient BTC balance' });
        }
        
        // Ενημέρωση υπολοίπου σε BTC και USD
        portfolio.btcBalance -= cost;
        portfolio.balance = portfolio.btcBalance * btcPrice;
      } else {
        // Κόστος σε USD
        cost = parsedQuantity * parsedPrice;
        
        // Έλεγχος επαρκούς υπολοίπου σε USD
        if (portfolio.balance < cost) {
          console.log(`Insufficient balance: ${portfolio.balance} < ${cost}`);
          return res.status(400).json({ error: 'Insufficient balance' });
        }
        
        // Ενημέρωση υπολοίπου σε USD και BTC
        portfolio.balance -= cost;
        portfolio.btcBalance = portfolio.balance / btcPrice;
      }
      
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
        
        // Αν είναι ζεύγος με BTC, αποθηκεύουμε και την BTC τιμή
        if (isBtcPair) {
          portfolio.assets[assetIndex].btcPrice = parsedPrice;
        } else {
          portfolio.assets[assetIndex].btcPrice = parsedPrice / btcPrice;
        }
        
        console.log(`Updated asset: ${symbol}, new quantity: ${newQuantity}`);
      } else {
        // Προσθήκη νέου asset
        const newAsset = {
          symbol,
          quantity: parsedQuantity,
          averagePrice: parsedPrice,
          currentPrice: parsedPrice
        };
        
        // Αν είναι ζεύγος με BTC, αποθηκεύουμε και την BTC τιμή
        if (isBtcPair) {
          newAsset.btcPrice = parsedPrice;
        } else {
          newAsset.btcPrice = parsedPrice / btcPrice;
        }
        
        portfolio.assets.push(newAsset);
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
      
      // Υπολογισμός του εσόδου
      let revenue;
      if (isBtcPair) {
        // Άμεσο έσοδο σε BTC
        revenue = parsedQuantity * parsedPrice;
        
        // Ενημέρωση υπολοίπου σε BTC και USD
        portfolio.btcBalance += revenue;
        portfolio.balance = portfolio.btcBalance * btcPrice;
      } else {
        // Έσοδο σε USD
        revenue = parsedQuantity * parsedPrice;
        
        // Ενημέρωση υπολοίπου σε USD και BTC
        portfolio.balance += revenue;
        portfolio.btcBalance = portfolio.balance / btcPrice;
      }
      
      // Ενημέρωση ποσότητας asset
      asset.quantity -= parsedQuantity;
      asset.currentPrice = parsedPrice;
      
      // Αν είναι ζεύγος με BTC, αποθηκεύουμε και την BTC τιμή
      if (isBtcPair) {
        asset.btcPrice = parsedPrice;
      } else {
        asset.btcPrice = parsedPrice / btcPrice;
      }
      
      console.log(`Sold ${parsedQuantity} of ${symbol} for ${isBtcPair ? '₿' : '$'}${revenue}`);
      
      // Αφαίρεση asset αν η ποσότητα είναι 0
      if (asset.quantity <= 0) {
        portfolio.assets.splice(assetIndex, 1);
        console.log(`Removed asset ${symbol} from portfolio`);
      }
    }
    
    // Υπολογισμός νέου portfolio equity σε USD
    const assetsValueUSD = portfolio.assets.reduce(
      (sum, asset) => {
        const priceUSD = asset.symbol.endsWith('BTC') 
          ? asset.currentPrice * btcPrice 
          : asset.currentPrice;
        return sum + (asset.quantity * priceUSD);
      }, 
      0
    );
    
    portfolio.equity = portfolio.balance + assetsValueUSD;
    
    // Υπολογισμός νέου portfolio equity σε BTC
    const assetsValueBTC = portfolio.assets.reduce(
      (sum, asset) => {
        const priceBTC = asset.symbol.endsWith('BTC') 
          ? asset.currentPrice 
          : asset.btcPrice || (asset.currentPrice / btcPrice);
        return sum + (asset.quantity * priceBTC);
      }, 
      0
    );
    
    portfolio.btcEquity = portfolio.btcBalance + assetsValueBTC;
    portfolio.updatedAt = Date.now();
    
    // Καταγραφή συναλλαγής
    const transaction = {
      id: Date.now().toString(),
      userId,
      symbol,
      action,
      quantity: parsedQuantity,
      price: parsedPrice,
      // Αποθήκευση και των δύο τιμών για μελλοντική αναφορά
      valueUSD: isBtcPair 
        ? (action === 'BUY' ? -(parsedQuantity * parsedPrice * btcPrice) : (parsedQuantity * parsedPrice * btcPrice))
        : (action === 'BUY' ? -(parsedQuantity * parsedPrice) : (parsedQuantity * parsedPrice)),
      valueBTC: isBtcPair
        ? (action === 'BUY' ? -(parsedQuantity * parsedPrice) : (parsedQuantity * parsedPrice))
        : (action === 'BUY' ? -(parsedQuantity * parsedPrice / btcPrice) : (parsedQuantity * parsedPrice / btcPrice)),
      btcPrice: btcPrice, // Αποθήκευση της τιμής BTC κατά τη στιγμή της συναλλαγής
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
      
      // Αν ο χρήστης έχει εγγραφεί στο BTCUSDT, στέλνουμε ενημερώσεις τιμής και σε όλους
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
    
    // Αν ο χρήστης είχε εγγραφεί στο BTCUSDT, ακυρώνουμε το callback
    if (symbol === 'BTCUSDT' && socket.btcPriceCallback) {
      binanceService.unsubscribeFromCandleUpdates('BTCUSDT', '1m', socket.btcPriceCallback);
      delete socket.btcPriceCallback;
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
    
    // Ακύρωση της συνδρομής BTC αν υπάρχει
    if (socket.btcPriceCallback) {
      binanceService.unsubscribeFromCandleUpdates('BTCUSDT', '1m', socket.btcPriceCallback);
    }
  });
});

// Event listeners για το trading bot
tradingBot.on('trade_signal', async (signal) => {
  console.log(`New trade signal: ${signal.action} ${signal.symbol} (${signal.indicator})`);
  
  // Ελέγχουμε αν το σύμβολο είναι σε ζεύγος με BTC
  const isBtcPair = signal.symbol.endsWith('BTC');
  
  // Αν είναι USD ζεύγος, μετατρέπουμε την τιμή και σε BTC για αναφορά
  if (!isBtcPair && signal.price) {
    try {
      const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
      signal.btcPrice = signal.price / btcPrice;
      signal.btcValue = signal.value / btcPrice;
    } catch (error) {
      console.error('Error converting signal price to BTC:', error);
    }
  }
  
  // Αποστολή του σήματος στους συνδεδεμένους clients
  io.emit('trade_signal', signal);
  
  // Εκτέλεση αυτόματης συναλλαγής μόνο για σήματα CONSENSUS
  if (signal.indicator === 'CONSENSUS') {
    console.log(`Processing consensus-based trade: ${signal.action} for ${signal.symbol}`);
    
    // Προαιρετικά: Αυτόματη εκτέλεση συναλλαγής
    if (global.db.portfolios.has(signal.userId)) {
      const portfolio = global.db.portfolios.get(signal.userId);
      
      // Λήψη της τιμής BTC αν χρειάζεται για μετατροπές
      let btcPrice = 0;
      if (!isBtcPair) {
        try {
          btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
        } catch (error) {
          console.error('Error fetching BTC price for consensus trade:', error);
          return; // Αποτυχία λήψης τιμής BTC, ακύρωση συναλλαγής
        }
      }
      
      // Έλεγχος αν υπάρχει διαθέσιμο υπόλοιπο για αγορά ή asset για πώληση
      if (signal.action === 'BUY') {
        // Υπολογισμός ποσού επένδυσης (π.χ. 10% του διαθέσιμου υπολοίπου)
        let investmentAmount, quantity;
        
        if (isBtcPair) {
          // Επένδυση 10% του BTC υπολοίπου
          const btcBalance = portfolio.btcBalance || (portfolio.balance / btcPrice);
          investmentAmount = btcBalance * 0.1;
          quantity = investmentAmount / signal.price;
          
          if (btcBalance >= investmentAmount && quantity > 0) {
            // Ενημέρωση υπολοίπου σε BTC
            portfolio.btcBalance = (portfolio.btcBalance || 0) - investmentAmount;
            portfolio.balance = portfolio.btcBalance * btcPrice;
            
            // Προσθήκη ή ενημέρωση του asset
            const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
            
            if (assetIndex >= 0) {
              const asset = portfolio.assets[assetIndex];
              const totalQuantity = asset.quantity + quantity;
              const totalValue = (asset.quantity * asset.averagePrice) + (quantity * signal.price);
              
              asset.quantity = totalQuantity;
              asset.averagePrice = totalValue / totalQuantity;
              asset.currentPrice = signal.price;
              asset.btcPrice = signal.price; // Είναι ήδη σε BTC
            } else {
              portfolio.assets.push({
                symbol: signal.symbol,
                quantity,
                averagePrice: signal.price,
                currentPrice: signal.price,
                btcPrice: signal.price // Είναι ήδη σε BTC
              });
            }
            
            // Ενημέρωση του equity
            const assetsValueBTC = portfolio.assets.reduce(
              (sum, asset) => {
                const priceBTC = asset.symbol.endsWith('BTC') 
                  ? asset.currentPrice 
                  : (asset.btcPrice || asset.currentPrice / btcPrice);
                return sum + (asset.quantity * priceBTC);
              }, 
              0
            );
            
            portfolio.btcEquity = portfolio.btcBalance + assetsValueBTC;
            portfolio.equity = portfolio.btcEquity * btcPrice;
            portfolio.updatedAt = Date.now();
            
            // Καταγραφή της συναλλαγής
            const transaction = {
              id: Date.now().toString(),
              userId: signal.userId,
              symbol: signal.symbol,
              action: 'BUY',
              quantity,
              price: signal.price,
              valueUSD: -(quantity * signal.price * btcPrice),
              valueBTC: -(quantity * signal.price),
              btcPrice,
              timestamp: Date.now(),
              signal: signal.indicator
            };
            
            global.db.transactions.push(transaction);
            
            // Αποστολή της ενημέρωσης στους συνδεδεμένους clients
            io.emit('portfolio_update', portfolio);
            io.emit('transaction_created', transaction);
            
            console.log(`Auto-executed BUY for ${signal.userId}: ${quantity} ${signal.symbol} @ ₿${signal.price}`);
          }
        } else {
          // Επένδυση 10% του USD υπολοίπου
          investmentAmount = portfolio.balance * 0.1;
          quantity = investmentAmount / signal.price;
          
          if (portfolio.balance >= investmentAmount && quantity > 0) {
            // Ενημέρωση υπολοίπου σε USD
            portfolio.balance -= investmentAmount;
            portfolio.btcBalance = portfolio.balance / btcPrice;
            
            // Προσθήκη ή ενημέρωση του asset
            const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
            
            if (assetIndex >= 0) {
              const asset = portfolio.assets[assetIndex];
              const totalQuantity = asset.quantity + quantity;
              const totalValue = (asset.quantity * asset.averagePrice) + (quantity * signal.price);
              
              asset.quantity = totalQuantity;
              asset.averagePrice = totalValue / totalQuantity;
              asset.currentPrice = signal.price;
              asset.btcPrice = signal.price / btcPrice;
            } else {
              portfolio.assets.push({
                symbol: signal.symbol,
                quantity,
                averagePrice: signal.price,
                currentPrice: signal.price,
                btcPrice: signal.price / btcPrice
              });
            }
            
            // Ενημέρωση του equity
            const assetsValueUSD = portfolio.assets.reduce(
              (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
              0
            );
            
            portfolio.equity = portfolio.balance + assetsValueUSD;
            portfolio.btcEquity = portfolio.equity / btcPrice;
            portfolio.updatedAt = Date.now();
            
            // Καταγραφή της συναλλαγής
            const transaction = {
              id: Date.now().toString(),
              userId: signal.userId,
              symbol: signal.symbol,
              action: 'BUY',
              quantity,
              price: signal.price,
              valueUSD: -(quantity * signal.price),
              valueBTC: -(quantity * signal.price / btcPrice),
              btcPrice,
              timestamp: Date.now(),
              signal: signal.indicator
            };
            
            global.db.transactions.push(transaction);
            
            // Αποστολή της ενημέρωσης στους συνδεδεμένους clients
            io.to(`bot:${signal.userId}`).emit('portfolio_update', portfolio);
            io.to(`bot:${signal.userId}`).emit('transaction_created', transaction);
            
            console.log(`Auto-executed BUY for ${signal.userId}: ${quantity} ${signal.symbol} @ $${signal.price}`);
          }
        }
      } else if (signal.action === 'SELL') {
        // Έλεγχος αν υπάρχει το asset στο χαρτοφυλάκιο
        const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
        
        if (assetIndex >= 0) {
          const asset = portfolio.assets[assetIndex];
          
          // Πώληση μέρους της θέσης (π.χ. 25%)
          const sellQuantity = asset.quantity * 0.25;
          
          if (isBtcPair) {
            const revenueBTC = sellQuantity * signal.price;
            
            // Ενημέρωση του υπολοίπου και του asset
            portfolio.btcBalance = (portfolio.btcBalance || 0) + revenueBTC;
            portfolio.balance = portfolio.btcBalance * btcPrice;
            asset.quantity -= sellQuantity;
            asset.currentPrice = signal.price;
            
            // Αφαίρεση του asset αν η ποσότητα είναι 0
            if (asset.quantity <= 0) {
              portfolio.assets.splice(assetIndex, 1);
            }
            
            // Ενημέρωση του equity
            const assetsValueBTC = portfolio.assets.reduce(
              (sum, asset) => {
                const priceBTC = asset.symbol.endsWith('BTC') 
                  ? asset.currentPrice 
                  : (asset.btcPrice || asset.currentPrice / btcPrice);
                return sum + (asset.quantity * priceBTC);
              }, 
              0
            );
            
            portfolio.btcEquity = portfolio.btcBalance + assetsValueBTC;
            portfolio.equity = portfolio.btcEquity * btcPrice;
            portfolio.updatedAt = Date.now();
            
            // Καταγραφή της συναλλαγής
            const transaction = {
              id: Date.now().toString(),
              userId: signal.userId,
              symbol: signal.symbol,
              action: 'SELL',
              quantity: sellQuantity,
              price: signal.price,
              valueUSD: sellQuantity * signal.price * btcPrice,
              valueBTC: sellQuantity * signal.price,
              btcPrice,
              timestamp: Date.now(),
              signal: signal.indicator
            };
            
            global.db.transactions.push(transaction);
            
            // Αποστολή της ενημέρωσης στους συνδεδεμένους clients
            io.to(`bot:${signal.userId}`).emit('portfolio_update', portfolio);
            io.to(`bot:${signal.userId}`).emit('transaction_created', transaction);
            
            console.log(`Auto-executed SELL for ${signal.userId}: ${sellQuantity} ${signal.symbol} @ ₿${signal.price}`);
          } else {
            const revenueUSD = sellQuantity * signal.price;
            
            // Ενημέρωση του υπολοίπου και του asset
            portfolio.balance += revenueUSD;
            portfolio.btcBalance = portfolio.balance / btcPrice;
            asset.quantity -= sellQuantity;
            asset.currentPrice = signal.price;
            
            // Αφαίρεση του asset αν η ποσότητα είναι 0
            if (asset.quantity <= 0) {
              portfolio.assets.splice(assetIndex, 1);
            }
            
            // Ενημέρωση του equity
            const assetsValueUSD = portfolio.assets.reduce(
              (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
              0
            );
            
            portfolio.equity = portfolio.balance + assetsValueUSD;
            portfolio.btcEquity = portfolio.equity / btcPrice;
            portfolio.updatedAt = Date.now();
            
            // Καταγραφή της συναλλαγής
            const transaction = {
              id: Date.now().toString(),
              userId: signal.userId,
              symbol: signal.symbol,
              action: 'SELL',
              quantity: sellQuantity,
              price: signal.price,
              valueUSD: sellQuantity * signal.price,
              valueBTC: sellQuantity * signal.price / btcPrice,
              btcPrice,
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
      }
    }
  }
});

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