// cleanup-duplicates.js - Script to remove duplicate transactions from the database
const path = require('path');
const Transaction = require('./models/Transaction');
const { promisify } = require('util');

// Initialize the database connection
require('./config/nedb');

// Make sure Transaction has removeAsync method
if (!Transaction.removeAsync && Transaction.remove) {
  Transaction.removeAsync = promisify(Transaction.remove.bind(Transaction));
}

async function cleanupDuplicateTransactions() {
  try {
    console.log('Starting duplicate transaction cleanup');
    
    // Get all transactions
    const allTransactions = await Transaction.find({});
    console.log(`Found ${allTransactions.length} total transactions`);
    
    // Group transactions by key properties
    const grouped = {};
    
    allTransactions.forEach(tx => {
      // Create a key based on essential properties
      // Round timestamp to nearest 3 seconds to catch near-simultaneous transactions
      const timeWindow = Math.floor(tx.timestamp / 3000);
      const key = `${tx.userId}_${tx.symbol}_${tx.action}_${Math.round(tx.quantity)}_${timeWindow}`;
      
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
        // Keep the first transaction, mark others as duplicates
        for (let i = 1; i < group.length; i++) {
          duplicateIds.push(group[i]._id);
          duplicateCount++;
        }
      }
    });
    
    console.log(`Found ${duplicateCount} duplicate transactions`);
    
    if (duplicateCount > 0) {
      // Remove duplicates
      for (const id of duplicateIds) {
        await Transaction.removeAsync({ _id: id });
      }
      
      console.log(`Removed ${duplicateCount} duplicate transactions`);
    }
    
    return duplicateCount;
  } catch (error) {
    console.error('Error cleaning up duplicate transactions:', error);
    throw error;
  }
}

// Run the cleanup
cleanupDuplicateTransactions()
  .then(count => {
    console.log(`Cleanup complete. Removed ${count} duplicates.`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
