// backend/config/nedb.js
const Datastore = require('nedb');
const path = require('path');
const fs = require('fs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create database instances
const db = {
  portfolios: new Datastore({ 
    filename: path.join(dataDir, 'portfolios.db'), 
    autoload: true 
  }),
  transactions: new Datastore({ 
    filename: path.join(dataDir, 'transactions.db'), 
    autoload: true 
  }),
  settings: new Datastore({ 
    filename: path.join(dataDir, 'settings.db'), 
    autoload: true 
  }),
  signals: new Datastore({ 
    filename: path.join(dataDir, 'signals.db'), 
    autoload: true 
  })
};

// Create indexes
db.portfolios.ensureIndex({ fieldName: 'userId', unique: true });
db.transactions.ensureIndex({ fieldName: 'timestamp' });
db.signals.ensureIndex({ fieldName: 'time' });

console.log('NeDB databases initialized in:', dataDir);

module.exports = db;