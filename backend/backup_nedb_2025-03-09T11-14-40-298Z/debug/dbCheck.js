// dbCheck.js - Debug utility for database connection
const db = require('../config/nedb');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');

async function checkDatabase() {
  console.log('==== DATABASE CHECK ====');
  
  // Check if Portfolio collection is available
  try {
    const portfolios = await Portfolio.find({});
    console.log(`Found ${portfolios.length} portfolios in database`);
    
    if (portfolios.length > 0) {
      console.log('Sample portfolio:', JSON.stringify(portfolios[0], null, 2));
    }
  } catch (err) {
    console.error('Error accessing portfolios:', err);
  }
  
  // Check if Transaction collection is available
  try {
    const transactions = await Transaction.find({});
    console.log(`Found ${transactions.length} transactions in database`);
    
    if (transactions.length > 0) {
      console.log('Last 3 transactions:', JSON.stringify(transactions.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error('Error accessing transactions:', err);
  }
  
  console.log('==== END DATABASE CHECK ====');
}

// If this file is run directly
checkDatabase()
  .then(() => console.log('Database check complete'))
  .catch(err => console.error('Database check error:', err))
  .finally(() => process.exit());
