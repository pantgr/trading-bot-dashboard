// Απλουστευμένη έκδοση του virtualTrading.js
const mongoose = require('mongoose');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');

// Απλή λειτουργία για να ελέγξει αν τα μοντέλα λειτουργούν
exports.checkModels = async () => {
  return {
    portfolio: !!Portfolio,
    transaction: !!Transaction
  };
};

// Απλή έκδοση για λήψη χαρτοφυλακίου
exports.getPortfolio = async (userId = 'default') => {
  try {
    console.log(`Getting portfolio for user ${userId}`);
    let portfolio = await Portfolio.findOne({ userId });
    
    if (!portfolio) {
      console.log('No portfolio found, creating a new one');
      portfolio = new Portfolio({
        userId,
        balance: 10000,
        assets: [],
        equity: 10000
      });
      await portfolio.save();
    }
    
    return portfolio;
  } catch (error) {
    console.error(`Error fetching portfolio:`, error);
    throw error;
  }
};

// Απλή έκδοση για λήψη ιστορικού συναλλαγών
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
