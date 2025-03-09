const path = require('path');
const Transaction = require('./models/Transaction');
const fs = require('fs');
const Datastore = require('nedb');

// Initialize the database connection
require('./config/nedb');

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
      // Create a direct connection to the NeDB database
      const dbPath = path.join(__dirname, 'data', 'transactions.db');
      const db = new Datastore({ filename: dbPath, autoload: true });
      
      // Delete each duplicate transaction
      for (const id of duplicateIds) {
        await new Promise((resolve, reject) => {
          db.remove({ _id: id }, {}, (err, numRemoved) => {
            if (err) reject(err);
            else resolve(numRemoved);
          });
        });
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