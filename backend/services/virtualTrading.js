const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');

// Αρχικοποίηση portfolio για έναν χρήστη
exports.initializePortfolio = async (userId = 'default') => {
  try {
    const existingPortfolio = await Portfolio.findOne({ userId });
    
    if (!existingPortfolio) {
      console.log(`Creating new portfolio for user ${userId}`);
      const portfolio = new Portfolio({
        userId,
        balance: 10000, // Αρχικό κεφάλαιο $10,000
        assets: [],
        equity: 10000
      });
      
      await portfolio.save();
      return portfolio;
    }
    
    return existingPortfolio;
  } catch (error) {
    console.error('Error initializing portfolio:', error);
    throw error;
  }
};

// Επεξεργασία σήματος συναλλαγής
exports.processSignal = async (signal, userId = 'default') => {
  try {
    const portfolio = await this.initializePortfolio(userId);
    
    // Λογική αυτόματων συναλλαγών βάσει των σημάτων
    if (signal.action === 'BUY') {
      const investmentAmount = portfolio.balance * 0.1; // Επένδυση 10% του υπολοίπου
      const price = parseFloat(signal.price || 0);
      
      if (price > 0 && investmentAmount > 0) {
        const quantity = investmentAmount / price;
        
        return this.executeTrade({
          userId,
          symbol: signal.symbol,
          action: 'BUY',
          quantity,
          price,
          signal: signal.indicator
        });
      }
    } 
    else if (signal.action === 'SELL') {
      // Έλεγχος αν έχουμε το asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
      
      if (assetIndex >= 0 && portfolio.assets[assetIndex].quantity > 0) {
        const price = parseFloat(signal.price || 0);
        const quantity = portfolio.assets[assetIndex].quantity;
        
        return this.executeTrade({
          userId,
          symbol: signal.symbol,
          action: 'SELL',
          quantity,
          price,
          signal: signal.indicator
        });
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error processing signal:', error);
    throw error;
  }
};

// Εκτέλεση συναλλαγής (αγορά ή πώληση)
exports.executeTrade = async (tradeParams) => {
  const { userId, symbol, action, quantity, price, signal } = tradeParams;
  
  try {
    // Λήψη portfolio
    const portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }
    
    // Εκτέλεση συναλλαγής
    if (action === 'BUY') {
      const cost = quantity * price;
      
      // Έλεγχος αν υπάρχει αρκετό υπόλοιπο
      if (portfolio.balance < cost) {
        throw new Error('Insufficient balance');
      }
      
      // Ενημέρωση υπολοίπου
      portfolio.balance -= cost;
      
      // Προσθήκη ή ενημέρωση asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === symbol);
      
      if (assetIndex >= 0) {
        // Ενημέρωση υπάρχοντος asset
        const existingQuantity = portfolio.assets[assetIndex].quantity;
        const existingValue = portfolio.assets[assetIndex].averagePrice * existingQuantity;
        const newValue = existingValue + (quantity * price);
        const newQuantity = existingQuantity + quantity;
        
        portfolio.assets[assetIndex].quantity = newQuantity;
        portfolio.assets[assetIndex].averagePrice = newValue / newQuantity;
        portfolio.assets[assetIndex].currentPrice = price;
      } else {
        // Προσθήκη νέου asset
        portfolio.assets.push({
          symbol,
          quantity,
          averagePrice: price,
          currentPrice: price
        });
      }
    } 
    else if (action === 'SELL') {
      // Εύρεση asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === symbol);
      
      if (assetIndex < 0) {
        throw new Error('Asset not found in portfolio');
      }
      
      const asset = portfolio.assets[assetIndex];
      const sellQuantity = Math.min(quantity, asset.quantity);
      const revenue = sellQuantity * price;
      
      // Ενημέρωση υπολοίπου
      portfolio.balance += revenue;
      
      // Ενημέρωση ποσότητας asset
      asset.quantity -= sellQuantity;
      asset.currentPrice = price;
      
      // Αφαίρεση asset αν η ποσότητα είναι 0
      if (asset.quantity <= 0) {
        portfolio.assets.splice(assetIndex, 1);
      }
    }
    
    // Υπολογισμός νέου portfolio equity
    const assetsValue = portfolio.assets.reduce(
      (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
      0
    );
    
    portfolio.equity = portfolio.balance + assetsValue;
    portfolio.updatedAt = Date.now();
    
    // Αποθήκευση αλλαγών στο portfolio
    await portfolio.save();
    
    // Καταγραφή συναλλαγής
    const transaction = new Transaction({
      userId,
      symbol,
      action,
      quantity,
      price,
      value: action === 'BUY' ? -(quantity * price) : (quantity * price),
      signal
    });
    
    await transaction.save();
    
    return portfolio;
  } catch (error) {
    console.error('Virtual trading error:', error);
    throw error;
  }
};

// Εκτέλεση χειροκίνητης συναλλαγής (από το UI)
exports.manualTrade = async (tradeParams) => {
  const { userId, symbol, action, quantity, price } = tradeParams;
  
  return this.executeTrade({
    userId,
    symbol,
    action,
    quantity: parseFloat(quantity),
    price: parseFloat(price),
    signal: 'MANUAL'
  });
};

// Λήψη χαρτοφυλακίου
exports.getPortfolio = async (userId = 'default') => {
  try {
    let portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      portfolio = await this.initializePortfolio(userId);
    }
    
    return portfolio;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    throw error;
  }
};

// Λήψη ιστορικού συναλλαγών
exports.getTransactionHistory = async (userId = 'default') => {
  try {
    const transactions = await Transaction.find({ userId })
      .sort({ timestamp: -1 })
      .limit(100);
    
    return transactions;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
};
