// reconcilePortfolio.js - Update portfolio based on existing transactions
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const binanceService = require('../services/binanceService');

async function reconcilePortfolio() {
  console.log('Starting portfolio reconciliation...');
  
  try {
    // Get the default portfolio
    let portfolio = await Portfolio.findOne({ userId: 'default' });
    if (!portfolio) {
      console.log('No portfolio found, creating a new one');
      portfolio = new Portfolio({
        userId: 'default',
        balance: 10000,  // Initial capital
        assets: [],
        equity: 10000,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      await portfolio.save();
    }
    
    console.log('Found portfolio:', portfolio);
    
    // Get all transactions
    const transactions = await Transaction.find({ userId: 'default' });
    console.log(`Found ${transactions.length} transactions`);
    
    // Sort transactions by timestamp
    transactions.sort((a, b) => a.timestamp - b.timestamp);
    
    // Reset portfolio balance to initial value
    portfolio.balance = 10000;
    portfolio.assets = [];
    
    // Process each transaction to update portfolio
    for (const tx of transactions) {
      console.log(`Processing ${tx.action} transaction for ${tx.symbol}: ${tx.quantity} @ ${tx.price}`);
      
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
          const newAsset = {
            symbol: tx.symbol,
            quantity: tx.quantity,
            averagePrice: tx.price,
            currentPrice: tx.price
          };
          
          portfolio.assets.push(newAsset);
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
    
    // Try to update current prices for assets
    try {
      console.log('Updating current prices for assets...');
      for (const asset of portfolio.assets) {
        try {
          const currentPrice = await binanceService.getCurrentPrice(asset.symbol);
          asset.currentPrice = currentPrice;
          console.log(`Updated ${asset.symbol} price to ${currentPrice}`);
        } catch (priceErr) {
          console.warn(`Could not update price for ${asset.symbol}: ${priceErr.message}`);
        }
      }
    } catch (error) {
      console.warn('Error updating asset prices:', error.message);
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
    console.log('Updated portfolio:', portfolio);
    
  } catch (error) {
    console.error('Error reconciling portfolio:', error);
  }
}

// Run the reconciliation
reconcilePortfolio()
  .then(() => {
    console.log('Reconciliation complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Reconciliation failed:', err);
    process.exit(1);
  });
