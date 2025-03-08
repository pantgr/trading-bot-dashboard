// initializeDB.js - Initialize fresh database files
const fs = require('fs');
const path = require('path');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');

async function initializeDatabase() {
  console.log('Initializing empty database...');
  
  // Create a default portfolio
  const defaultPortfolio = new Portfolio({
    userId: 'default',
    balance: 10000,  // Initial capital
    assets: [],
    equity: 10000,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  
  try {
    await defaultPortfolio.save();
    console.log('Default portfolio created successfully');
  } catch (error) {
    console.error('Error creating default portfolio:', error);
  }
  
  console.log('Database initialization complete');
}

// Run the initialization
initializeDatabase()
  .then(() => {
    console.log('All done!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Initialization failed:', err);
    process.exit(1);
  });
