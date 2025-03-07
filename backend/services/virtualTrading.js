// services/virtualTrading.js - Enhanced version with multiple safeguards against duplicates
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const binanceService = require('./binanceService');
const path = require('path');
const fs = require('fs');
const Datastore = require('nedb');
const { promisify } = require('util');

// Create direct access to the transactions database for raw operations
const DB_PATH = path.join(__dirname, '..', 'data', 'transactions.db');
const rawDB = new Datastore({ filename: DB_PATH, autoload: true });
rawDB.findAsync = promisify(rawDB.find.bind(rawDB));
rawDB.removeAsync = promisify(rawDB.remove.bind(rawDB));

// Global transactions cache to prevent duplicates within the same session
const transactionCache = new Set();

// Cleanup the cache periodically (every hour)
setInterval(() => {
  console.log(`Clearing transaction cache. Had ${transactionCache.size} entries.`);
  transactionCache.clear();
}, 60 * 60 * 1000);

// Initialize portfolio for a user
exports.initializePortfolio = async (userId = 'default') => {
  try {
    // Check if portfolio exists
    console.log(`Looking for portfolio for user ${userId}`);
    let portfolio = await Portfolio.findOne({ userId });
    
    // If no portfolio exists, create a new one
    if (!portfolio) {
      console.log(`Creating new portfolio for user ${userId}`);
      portfolio = new Portfolio({
        userId,
        balance: 10000, // Initial capital $10,000
        assets: [],
        equity: 10000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      try {
        await portfolio.save();
        console.log(`Successfully created new portfolio for ${userId}`);
      } catch (saveErr) {
        console.error(`Failed to save new portfolio: ${saveErr.message}`);
        throw saveErr;
      }
    } else {
      console.log(`Found existing portfolio for ${userId}`);
    }
    
    return portfolio;
  } catch (error) {
    console.error('Error initializing portfolio:', error);
    throw error;
  }
};

// Generate a unique key for a transaction
const generateTransactionKey = (tx) => {
  // Round timestamp to nearest 5 seconds to account for timing differences
  const timeWindow = Math.floor(tx.timestamp / 5000);
  // Round quantity to 6 decimal places to handle floating point issues
  const roundedQuantity = Math.round(tx.quantity * 1000000) / 1000000;
  return `${tx.userId}_${tx.symbol}_${tx.action}_${roundedQuantity}_${timeWindow}`;
};

// SAFEGUARD 1: Check memory cache for recent identical transactions
const isInMemoryDuplicate = (tx) => {
  const key = generateTransactionKey(tx);
  if (transactionCache.has(key)) {
    console.log(`MEMORY CACHE: Duplicate transaction detected: ${key}`);
    return true;
  }
  return false;
};

// SAFEGUARD 2: Check database for duplicate transactions
const isDatabaseDuplicate = async (tx) => {
  try {
    // Create a time window around the transaction timestamp
    const startTime = tx.timestamp - 10000; // 10 seconds before
    const endTime = tx.timestamp + 10000;   // 10 seconds after
    
    // Find transactions with the same basic properties
    const existingTransactions = await Transaction.find({
      userId: tx.userId,
      symbol: tx.symbol,
      action: tx.action
    });
    
    console.log(`DB CHECK: Found ${existingTransactions.length} similar transactions for ${tx.symbol}`);
    
    // Check if any existing transaction matches closely enough to be a duplicate
    for (const existingTx of existingTransactions) {
      // Time within window
      const timeMatch = existingTx.timestamp >= startTime && existingTx.timestamp <= endTime;
      
      // Quantity approximately the same (allow 0.1% difference)
      const quantityDiff = Math.abs(existingTx.quantity - tx.quantity) / tx.quantity;
      const quantityMatch = quantityDiff < 0.001;
      
      // Price approximately the same (allow 0.1% difference)
      const priceDiff = Math.abs(existingTx.price - tx.price) / tx.price;
      const priceMatch = priceDiff < 0.001;
      
      if (timeMatch && quantityMatch && priceMatch) {
        console.log('DATABASE: Duplicate transaction found:', {
          existing: {
            id: existingTx._id,
            timestamp: existingTx.timestamp,
            timeDiff: Math.abs(tx.timestamp - existingTx.timestamp) / 1000 + ' seconds',
            quantity: existingTx.quantity,
            price: existingTx.price
          },
          new: {
            timestamp: tx.timestamp,
            quantity: tx.quantity,
            price: tx.price
          }
        });
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking for database duplicates:', error);
    // If there's an error, assume it could be a duplicate to be safe
    return true;
  }
};

// SAFEGUARD 3: Direct database search with raw query
const isRawDatabaseDuplicate = async (tx) => {
  try {
    // Generate more flexible query to catch edge cases
    const query = {
      userId: tx.userId,
      symbol: tx.symbol,
      action: tx.action,
      $where: function() {
        const timeDiff = Math.abs(this.timestamp - tx.timestamp);
        const quantityRatio = Math.abs(this.quantity / tx.quantity - 1);
        const priceRatio = Math.abs(this.price / tx.price - 1);
        
        return timeDiff < 10000 && quantityRatio < 0.01 && priceRatio < 0.01;
      }
    };
    
    // Use raw DB access for more direct querying
    const results = await rawDB.findAsync(query);
    
    if (results && results.length > 0) {
      console.log(`RAW DB: Found ${results.length} potential duplicates with direct query`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in raw database duplicate check:', error);
    return true; // Safety first
  }
};

// Combine all duplicate checks
const isDuplicateTransaction = async (tx) => {
  // First check the memory cache (fastest)
  if (isInMemoryDuplicate(tx)) {
    return true;
  }
  
  // Then check the database
  const dbDuplicate = await isDatabaseDuplicate(tx);
  if (dbDuplicate) {
    return true;
  }
  
  // Finally, try raw database access as a last resort
  const rawDbDuplicate = await isRawDatabaseDuplicate(tx);
  if (rawDbDuplicate) {
    return true;
  }
  
  // If we reach here, it's not a duplicate, so add to cache for future checks
  const key = generateTransactionKey(tx);
  transactionCache.add(key);
  
  return false;
};

// Process trading signal
exports.processSignal = async (signal, userId = 'default') => {
  try {
    console.log(`Processing signal for ${userId}: ${JSON.stringify(signal)}`);
    // Get user's portfolio
    const portfolio = await this.initializePortfolio(userId);
    
    // Get BTC price in USD for conversions if needed
    let btcPrice = 1;
    try {
      btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    } catch (err) {
      console.warn('Could not fetch BTC price, using estimate:', err.message);
    }
    
    // Trading logic based on signals
    if (signal.action === 'BUY') {
      // Determine the quote asset from the symbol
      const quoteAsset = signal.symbol.endsWith('USDT') ? 'USDT' : signal.symbol.slice(-3);
      const price = parseFloat(signal.price || 0);
      
      if (price > 0) {
        let investmentAmount = portfolio.balance * 0.1; // 10% of USD balance
        let quantity;
        
        // Convert investment amount to the appropriate currency
        if (quoteAsset === 'BTC') {
          // Convert USD to BTC for BTC pairs
          const btcInvestmentAmount = investmentAmount / btcPrice;
          quantity = btcInvestmentAmount / price;
          console.log(`Converting USD ${investmentAmount} to BTC ${btcInvestmentAmount} for ${signal.symbol}`);
        } else {
          // For other pairs, use standard calculation
          quantity = investmentAmount / price;
        }
        
        console.log(`Calculated quantity for ${signal.symbol}: ${quantity} at price ${price}`);
        
        // Execute the trade with the correct quantity
        return this.executeTrade({
          userId,
          symbol: signal.symbol,
          action: 'BUY',
          quantity,
          price,
          signal: signal.indicator
        });
      }
    } else if (signal.action === 'SELL') {
      // Check if we have this asset in portfolio
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
      if (assetIndex >= 0) {
        const asset = portfolio.assets[assetIndex];
        const price = parseFloat(signal.price || 0);
        
        if (price > 0 && asset.quantity > 0) {
          console.log(`Executing SELL for ${signal.symbol}: ${asset.quantity} at price ${price}`);
          
          return this.executeTrade({
            userId,
            symbol: signal.symbol,
            action: 'SELL',
            quantity: asset.quantity,
            price,
            signal: signal.indicator
          });
        }
      } else {
        console.log(`Cannot sell ${signal.symbol} - not in portfolio`);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error processing signal:', error);
    throw error;
  }
};

// Execute trade (buy or sell) with multiple duplicate safeguards
exports.executeTrade = async (tradeParams) => {
  const { userId, symbol, action, quantity, price, signal } = tradeParams;
  
  try {
    console.log(`Executing ${action} trade for ${userId}: ${quantity} ${symbol} @ ${price}`);
    
    // ADDED SAFEGUARD: Generate a unique ID for this transaction
    const uniqueId = `${userId}_${symbol}_${action}_${quantity}_${price}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`Transaction unique ID: ${uniqueId}`);
    
    // Create transaction object for deduplication check
    const transactionData = {
      userId,
      symbol,
      action,
      quantity,
      price,
      value: action === 'BUY' ? -(quantity * price) : (quantity * price),
      timestamp: Date.now(),
      signal,
      uniqueId // Add unique ID to transaction
    };

    // Check if this transaction is a duplicate with all safeguards
    const isDuplicate = await isDuplicateTransaction(transactionData);
    if (isDuplicate) {
      console.log(`⛔ DUPLICATE DETECTED! Skipping transaction: ${action} ${quantity} ${symbol} @ ${price}`);
      
      // Get the portfolio to return (without executing the trade)
      return await Portfolio.findOne({ userId });
    }
    
    // Get portfolio
    let portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      // Create portfolio if it doesn't exist
      console.log(`No portfolio found for ${userId}, creating new one`);
      portfolio = await this.initializePortfolio(userId);
    }
    
    // Get BTC price for USD conversion if needed
    let btcPrice = 0;
    try {
      btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    } catch (err) {
      console.warn('Could not fetch BTC price, using estimate:', err.message);
    }
    
    // Execute trade
    if (action === 'BUY') {
      const cost = quantity * price;
      
      // Check if enough balance
      if (portfolio.balance < cost) {
        throw new Error('Insufficient balance');
      }
      
      // Update balance
      portfolio.balance -= cost;
      
      // Add or update asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === symbol);
      
      if (assetIndex >= 0) {
        // Update existing asset
        const existingQuantity = portfolio.assets[assetIndex].quantity;
        const existingValue = portfolio.assets[assetIndex].averagePrice * existingQuantity;
        const newValue = existingValue + (quantity * price);
        const newQuantity = existingQuantity + quantity;
        
        portfolio.assets[assetIndex].quantity = newQuantity;
        portfolio.assets[assetIndex].averagePrice = newValue / newQuantity;
        portfolio.assets[assetIndex].currentPrice = price;
        
        // Store BTC price for reference
        if (symbol.endsWith('USDT') && btcPrice > 0) {
          portfolio.assets[assetIndex].btcPrice = price / btcPrice;
        } else {
          portfolio.assets[assetIndex].btcPrice = price;
        }
      } else {
        // Add new asset
        const newAsset = {
          symbol,
          quantity,
          averagePrice: price,
          currentPrice: price
        };
        
        // Store BTC price for reference
        if (symbol.endsWith('USDT') && btcPrice > 0) {
          newAsset.btcPrice = price / btcPrice;
        } else {
          newAsset.btcPrice = price;
        }
        
        portfolio.assets.push(newAsset);
      }
    } 
    else if (action === 'SELL') {
      // Find asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === symbol);
      
      if (assetIndex < 0) {
        throw new Error('Asset not found in portfolio');
      }
      
      const asset = portfolio.assets[assetIndex];
      const sellQuantity = Math.min(quantity, asset.quantity);
      const revenue = sellQuantity * price;
      
      // Update balance
      portfolio.balance += revenue;
      
      // Update asset quantity
      asset.quantity -= sellQuantity;
      asset.currentPrice = price;
      
      // Remove asset if quantity is 0
      if (asset.quantity <= 0) {
        portfolio.assets.splice(assetIndex, 1);
      }
    }
    
    // Calculate new portfolio equity
    const assetsValue = portfolio.assets.reduce(
      (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
      0
    );
    
    portfolio.equity = portfolio.balance + assetsValue;
    portfolio.updatedAt = Date.now();
    
    // CRITICAL: Save portfolio BEFORE creating the transaction
    // This ensures portfolio is updated even if transaction creation fails
    console.log(`Saving updated portfolio for ${userId}`);
    try {
      await portfolio.save();
      console.log(`Portfolio successfully updated for ${userId}`);
    } catch (saveErr) {
      console.error(`Failed to save portfolio: ${saveErr.message}`);
      throw saveErr;
    }
    
    // Complete the transaction with BTC price information
    if (btcPrice > 0) {
      transactionData.valueUSD = symbol.endsWith('USDT') 
        ? transactionData.value
        : transactionData.value * btcPrice;
      
      transactionData.valueBTC = symbol.endsWith('BTC')
        ? transactionData.value
        : transactionData.value / btcPrice;
      
      transactionData.btcPrice = btcPrice;
    }
    
    // Record transaction in a try/catch to prevent duplicate transactions
    console.log(`Recording transaction for ${action} ${quantity} ${symbol} (Unique ID: ${uniqueId})`);
    try {
      // Double-check one last time for duplicates before saving
      const finalDuplicateCheck = await isDuplicateTransaction(transactionData);
      if (finalDuplicateCheck) {
        console.log(`⚠️ Caught duplicate transaction at final check! Not saving transaction.`);
      } else {
        const transaction = new Transaction(transactionData);
        await transaction.save();
        console.log(`Transaction successfully recorded for ${action} ${quantity} ${symbol}`);
      }
    } catch (saveErr) {
      console.error(`Failed to save transaction (but portfolio was updated): ${saveErr.message}`);
      // We continue execution because the portfolio has already been updated
    }
    
    return portfolio;
  } catch (error) {
    console.error('Virtual trading error:', error);
    throw error;
  }
};

// Execute manual trade (from UI)
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

// Get portfolio
exports.getPortfolio = async (userId = 'default') => {
  try {
    console.log(`Getting portfolio for user ${userId}`);
    // Get portfolio or create if it doesn't exist
    let portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      console.log(`No portfolio found for ${userId}, initializing`);
      portfolio = await this.initializePortfolio(userId);
    } else {
      console.log(`Found portfolio for ${userId} with ${portfolio.assets?.length || 0} assets`);
    }
    
    return portfolio;
  } catch (error) {
    console.error(`Error fetching portfolio for ${userId}:`, error);
    throw error;
  }
};

// Get transaction history
exports.getTransactionHistory = async (userId = 'default') => {
  try {
    console.log(`Getting transaction history for user ${userId}`);
    // Find transactions and sort by timestamp (most recent first)
    const transactions = await Transaction.find({ userId });
    console.log(`Found ${transactions.length} transactions for ${userId}`);
    return transactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  } catch (error) {
    console.error(`Error fetching transaction history for ${userId}:`, error);
    throw error;
  }
};

// NEW: Function to remove specific duplicates (can be called from API)
exports.removeDuplicateTransactions = async (userId = 'default') => {
  try {
    console.log(`Manually cleaning up duplicates for user ${userId}`);
    
    // Get all transactions for this user
    const allTransactions = await Transaction.find({ userId });
    console.log(`Found ${allTransactions.length} total transactions for ${userId}`);
    
    // Group transactions by key properties
    const grouped = {};
    
    allTransactions.forEach(tx => {
      // Create a key based on essential properties
      // Round timestamp to nearest 5 seconds
      const timeWindow = Math.floor(tx.timestamp / 5000);
      const key = `${tx.userId}_${tx.symbol}_${tx.action}_${Math.round(tx.quantity * 1000000) / 1000000}_${timeWindow}`;
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      grouped[key].push(tx);
    });
    
    // Find groups with duplicates
    let duplicateCount = 0;
    const duplicateIds = [];
    
    Object.keys(grouped).forEach(key => {
      const group = grouped[key];
      
      if (group.length > 1) {
        console.log(`Found duplicate group for key ${key} with ${group.length} transactions`);
        
        // Keep the first transaction, mark others as duplicates
        for (let i = 1; i < group.length; i++) {
          duplicateIds.push(group[i]._id);
          duplicateCount++;
        }
      }
    });
    
    console.log(`Found ${duplicateCount} duplicate transactions`);
    
    if (duplicateCount > 0) {
      // Delete each duplicate transaction
      for (const id of duplicateIds) {
        await rawDB.removeAsync({ _id: id });
      }
      
      console.log(`Removed ${duplicateCount} duplicate transactions`);
      
      // Force portfolio reconciliation
      await this.reconcilePortfolio(userId);
    }
    
    return { 
      success: true, 
      message: `Removed ${duplicateCount} duplicate transactions` 
    };
  } catch (error) {
    console.error('Error removing duplicate transactions:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};

// NEW: Reconcile portfolio based on transaction history
exports.reconcilePortfolio = async (userId = 'default') => {
  try {
    console.log(`Reconciling portfolio for user ${userId}`);
    
    // Get the portfolio
    let portfolio = await Portfolio.findOne({ userId });
    if (!portfolio) {
      console.log('No portfolio found, creating a new one');
      portfolio = new Portfolio({
        userId,
        balance: 10000,  // Initial capital
        assets: [],
        equity: 10000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    
    // Get all transactions
    const transactions = await Transaction.find({ userId });
    console.log(`Found ${transactions.length} transactions for reconciliation`);
    
    // Sort transactions by timestamp
    transactions.sort((a, b) => a.timestamp - b.timestamp);
    
    // Reset portfolio to initial values
    portfolio.balance = 10000;
    portfolio.assets = [];
    
    // Process each transaction to rebuild portfolio
    for (const tx of transactions) {
      console.log(`Reconciling ${tx.action} transaction for ${tx.symbol}: ${tx.quantity} @ ${tx.price}`);
      
      if (tx.action === 'BUY') {
        // Deduct from balance
        const cost = tx.quantity * tx.price;
        portfolio.balance -= cost;
        
        // Add or update asset
        const assetIndex = portfolio.assets.findIndex(a => a.symbol === tx.symbol);
        
        if (assetIndex >= 0) {
          // Update existing asset
          const existingQuantity = portfolio.assets[assetIndex].quantity;
          const existingValue = portfolio.assets[assetIndex].averagePrice * existingQuantity;
          const newValue = existingValue + (tx.quantity * tx.price);
          const newQuantity = existingQuantity + tx.quantity;
          
          portfolio.assets[assetIndex].quantity = newQuantity;
          portfolio.assets[assetIndex].averagePrice = newValue / newQuantity;
          portfolio.assets[assetIndex].currentPrice = tx.price;
        } else {
          // Add new asset
          portfolio.assets.push({
            symbol: tx.symbol,
            quantity: tx.quantity,
            averagePrice: tx.price,
            currentPrice: tx.price
          });
        }
      } else if (tx.action === 'SELL') {
        // Add to balance
        const revenue = tx.quantity * tx.price;
        portfolio.balance += revenue;
        
        // Find and update asset
        const assetIndex = portfolio.assets.findIndex(a => a.symbol === tx.symbol);
        if (assetIndex >= 0) {
          // Update asset quantity
          portfolio.assets[assetIndex].quantity -= tx.quantity;
          portfolio.assets[assetIndex].currentPrice = tx.price;
          
          // Remove asset if quantity is 0 or less
          if (portfolio.assets[assetIndex].quantity <= 0) {
            portfolio.assets.splice(assetIndex, 1);
          }
        } else {
          console.warn(`Warning: Tried to sell ${tx.symbol} but it's not in portfolio`);
        }
      }
    }
    
    // Calculate equity
    const assetsValue = portfolio.assets.reduce(
      (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
      0
    );
    
    portfolio.equity = portfolio.balance + assetsValue;
    portfolio.updatedAt = Date.now();
    
    // Save updated portfolio
    await portfolio.save();
    console.log('Portfolio successfully reconciled and saved');
    
    return portfolio;
  } catch (error) {
    console.error('Error reconciling portfolio:', error);
    throw error;
  }
};