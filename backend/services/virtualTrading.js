// services/virtualTrading.js - Updated to use NeDB
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const binanceService = require('./binanceService');
const db = require('../config/nedb');
const { promisify } = require('util');

// Initialize portfolio for a user
exports.initializePortfolio = async (userId = 'default') => {
  try {
    // Check if portfolio exists
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
      
      await portfolio.save();
    }
    
    return portfolio;
  } catch (error) {
    console.error('Error initializing portfolio:', error);
    throw error;
  }
};

// Process trading signal
exports.processSignal = async (signal, userId = 'default') => {
  try {
    // Get user's portfolio
    const portfolio = await this.initializePortfolio(userId);
    
    // Trading logic based on signals
    if (signal.action === 'BUY') {
      // Investment amount (10% of available balance)
      const investmentAmount = portfolio.balance * 0.1;
      const price = parseFloat(signal.price || 0);
      
      if (price > 0 && investmentAmount > 0) {
        const quantity = investmentAmount / price;
        
        // Execute the trade
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
      // Check if we have the asset
      const assetIndex = portfolio.assets.findIndex(a => a.symbol === signal.symbol);
      
      if (assetIndex >= 0 && portfolio.assets[assetIndex].quantity > 0) {
        const price = parseFloat(signal.price || 0);
        const quantity = portfolio.assets[assetIndex].quantity;
        
        // Execute the trade
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

// Execute trade (buy or sell)
exports.executeTrade = async (tradeParams) => {
  const { userId, symbol, action, quantity, price, signal } = tradeParams;
  
  try {
    // Get portfolio
    let portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      // Create portfolio if it doesn't exist
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
    
    // Save changes to portfolio
    await portfolio.save();
    
    // Record transaction
    const transaction = new Transaction({
      userId,
      symbol,
      action,
      quantity,
      price,
      value: action === 'BUY' ? -(quantity * price) : (quantity * price),
      valueUSD: symbol.endsWith('USDT') 
        ? (action === 'BUY' ? -(quantity * price) : quantity * price)
        : (btcPrice > 0 ? (action === 'BUY' ? -(quantity * price * btcPrice) : quantity * price * btcPrice) : undefined),
      valueBTC: symbol.endsWith('BTC')
        ? (action === 'BUY' ? -(quantity * price) : quantity * price)
        : (btcPrice > 0 ? (action === 'BUY' ? -(quantity * price / btcPrice) : quantity * price / btcPrice) : undefined),
      btcPrice: btcPrice > 0 ? btcPrice : undefined,
      timestamp: Date.now(),
      signal
    });
    
    await transaction.save();
    
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
    // Get portfolio or create if it doesn't exist
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

// Get transaction history
exports.getTransactionHistory = async (userId = 'default') => {
  try {
    // Find transactions and sort by timestamp (most recent first)
    const transactions = await Transaction.find({ userId });
    return transactions.sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
};