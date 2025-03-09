// services/virtualTrading.js - Fixed version to handle duplicate key errors
const mongoose = require('mongoose');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const binanceService = require('./binanceService');
const Signal = require('../models/Signal');

// Check if models are working correctly
exports.checkModels = async () => {
  return {
    portfolio: !!Portfolio,
    transaction: !!Transaction
  };
};

// Get portfolio with safe upsert
exports.getPortfolio = async (userId = 'default') => {
  try {
    console.log(`Getting portfolio for user ${userId}`);
    
    // Use findOneAndUpdate with upsert instead of find + create
    // This avoids race conditions that could lead to duplicate key errors
    const portfolio = await Portfolio.findOneAndUpdate(
      { userId }, // query
      { 
        $setOnInsert: { 
          userId,
          balance: 10000,
          assets: [],
          equity: 10000,
          createdAt: Date.now()
        }
      },
      { 
        new: true, // return the updated document
        upsert: true, // create if it doesn't exist
        setDefaultsOnInsert: true // use schema defaults
      }
    );
    
    return portfolio;
  } catch (error) {
    console.error(`Error fetching portfolio:`, error);
    throw error;
  }
};

// Get transaction history
exports.getTransactionHistory = async (userId = 'default') => {
  try {
    console.log(`Getting transaction history for user ${userId}`);
    const transactions = await Transaction.find({ userId }).sort({ timestamp: -1 }).limit(100);
    return transactions;
  } catch (error) {
    console.error(`Error fetching transactions:`, error);
    return [];
  }
};

// Execute a manual trade
exports.manualTrade = async ({ userId = 'default', symbol, action, quantity, price }) => {
  try {
    console.log(`Executing ${action} trade for ${symbol}: ${quantity} @ ${price}`);
    
    // Validate inputs
    if (!symbol || !action || !quantity || !price) {
      throw new Error('Missing required parameters');
    }
    
    if (action !== 'BUY' && action !== 'SELL') {
      throw new Error('Invalid action. Must be BUY or SELL');
    }
    
    // Get portfolio
    const portfolio = await this.getPortfolio(userId);
    
    // Calculate value
    const value = quantity * price;
    
    // Validate trade
    if (action === 'BUY') {
      // Check if enough balance
      if (portfolio.balance < value) {
        throw new Error(`Insufficient balance. Required: ${value}, Available: ${portfolio.balance}`);
      }
      
      // Deduct from balance
      portfolio.balance -= value;
      
      // Add to assets
      const existingAssetIndex = portfolio.assets.findIndex(asset => asset.symbol === symbol);
      
      if (existingAssetIndex !== -1) {
        // Update existing asset
        const existingAsset = portfolio.assets[existingAssetIndex];
        const totalQuantity = existingAsset.quantity + quantity;
        const totalValue = (existingAsset.quantity * existingAsset.averagePrice) + value;
        
        existingAsset.quantity = totalQuantity;
        existingAsset.averagePrice = totalValue / totalQuantity;
        existingAsset.currentPrice = price;
      } else {
        // Add new asset
        portfolio.assets.push({
          symbol,
          quantity,
          averagePrice: price,
          currentPrice: price
        });
      }
    } else { // SELL action
      // Find asset
      const existingAssetIndex = portfolio.assets.findIndex(asset => asset.symbol === symbol);
      
      if (existingAssetIndex === -1) {
        throw new Error(`Asset ${symbol} not found in portfolio`);
      }
      
      const existingAsset = portfolio.assets[existingAssetIndex];
      
      // Check if enough quantity
      if (existingAsset.quantity < quantity) {
        throw new Error(`Insufficient quantity. Required: ${quantity}, Available: ${existingAsset.quantity}`);
      }
      
      // Add to balance
      portfolio.balance += value;
      
      // Reduce asset quantity or remove if selling all
      existingAsset.quantity -= quantity;
      existingAsset.currentPrice = price;
      
      if (existingAsset.quantity <= 0) {
        // Remove asset if none left
        portfolio.assets.splice(existingAssetIndex, 1);
      }
    }
    
    // Calculate equity
    const assetsValue = portfolio.assets.reduce(
      (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
      0
    );
    
    portfolio.equity = portfolio.balance + assetsValue;
    
    // Save portfolio
    await portfolio.save();
    
    // Create transaction record
    const transaction = new Transaction({
      userId,
      symbol,
      action,
      quantity,
      price,
      value: action === 'BUY' ? -value : value,
      timestamp: Date.now(),
      signal: 'MANUAL',
      uniqueId: `${userId}-${symbol}-${action}-${Date.now()}`
    });
    
    await transaction.save();
    
    return {
      success: true,
      message: `${action} ${quantity} ${symbol} @ ${price} executed successfully`,
      portfolio
    };
  } catch (error) {
    console.error('Error executing trade:', error);
    throw error;
  }
};

// Process a trading signal
exports.processSignal = async (signal, userId = 'default') => {
  try {
    if (!signal || !signal.symbol || !signal.action || !signal.price) {
      throw new Error('Invalid signal format');
    }
    
    // Get portfolio
    const portfolio = await this.getPortfolio(userId);
    
    // Get trading parameters
    let investPercentage = 0.1; // Default: 10% of available balance for BUY
    let sellPercentage = 0.25;  // Default: 25% of position for SELL
    
    // TODO: Get these from user settings
    
    // Execute signal based on action
    if (signal.action === 'BUY') {
      // Calculate quantity to buy based on percentage of available balance
      const availableBalance = portfolio.balance;
      const investAmount = availableBalance * investPercentage;
      const quantity = investAmount / signal.price;
      
      if (quantity <= 0) {
        throw new Error('Calculated quantity is too small to execute');
      }
      
      // Execute the trade
      return await this.manualTrade({
        userId,
        symbol: signal.symbol,
        action: 'BUY',
        quantity,
        price: signal.price
      });
    } else if (signal.action === 'SELL') {
      // Find the asset
      const existingAsset = portfolio.assets.find(asset => asset.symbol === signal.symbol);
      
      if (!existingAsset) {
        throw new Error(`No ${signal.symbol} found in portfolio to sell`);
      }
      
      // Calculate quantity to sell based on percentage of position
      const quantity = existingAsset.quantity * sellPercentage;
      
      if (quantity <= 0) {
        throw new Error('Calculated quantity is too small to execute');
      }
      
      // Execute the trade
      const result = await this.manualTrade({
        userId,
        symbol: signal.symbol,
        action: 'SELL',
        quantity,
        price: signal.price
      });
      
      // Update transaction with signal reference
      const transaction = await Transaction.findOneAndUpdate(
        { uniqueId: `${userId}-${signal.symbol}-SELL-${result.timestamp}` },
        { signal: signal.indicator || 'AUTOMATIC' },
        { new: true }
      );
      
      return result;
    }
    
    return { success: false, message: 'Unsupported signal action' };
  } catch (error) {
    console.error('Error processing signal:', error);
    throw error;
  }
};

// Update all current prices in the portfolio
exports.updatePortfolioPrices = async (userId = 'default') => {
  try {
    const portfolio = await this.getPortfolio(userId);
    
    // Get BTC price in USD for reference
    const btcPrice = await binanceService.getCurrentPrice('BTCUSDT');
    
    // Update each asset
    for (const asset of portfolio.assets) {
      try {
        // Get current price
        const currentPrice = await binanceService.getCurrentPrice(asset.symbol);
        asset.currentPrice = currentPrice;
        
        // Calculate BTC price if needed
        if (asset.symbol.endsWith('BTC')) {
          asset.btcPrice = asset.currentPrice;
        } else if (asset.symbol.endsWith('USDT')) {
          asset.btcPrice = asset.currentPrice / btcPrice;
        }
      } catch (err) {
        console.error(`Error updating price for ${asset.symbol}:`, err);
      }
    }
    
    // Calculate equity
    const assetsValue = portfolio.assets.reduce(
      (sum, asset) => sum + (asset.quantity * asset.currentPrice), 
      0
    );
    
    portfolio.equity = portfolio.balance + assetsValue;
    
    // Save updated portfolio
    await portfolio.save();
    
    return portfolio;
  } catch (error) {
    console.error('Error updating portfolio prices:', error);
    throw error;
  }
};