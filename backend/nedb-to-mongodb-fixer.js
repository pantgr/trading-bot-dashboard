// nedb-to-mongodb-fixer.js
// Αυτόματο script για την αντικατάσταση όλων των αναφορών NeDB με MongoDB
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Ορισμός βασικού φακέλου του project
const backendDir = path.resolve(__dirname);

// Αρχεία που πρέπει να ελεγχθούν και να τροποποιηθούν
const filesToCheck = [
  'services/virtualTrading.js',
  'services/tradingBotService.js',
  'models/Portfolio.js',
  'models/Transaction.js',
  'models/Signal.js',
  'models/ActiveBot.js',
  'models/MarketData.js',
  'models/Config.js',
  'server.js',
  'cleanup-duplicates.js',
  'debug/dbCheck.js',
  'routes/adminRoutes.js'
];

// Κάνε backup του φακέλου πριν τις αλλαγές
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backendDir, `backup_nedb_${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  filesToCheck.forEach(file => {
    const srcFile = path.join(backendDir, file);
    if (fs.existsSync(srcFile)) {
      const destDir = path.join(backupDir, path.dirname(file));
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      const destFile = path.join(backupDir, file);
      fs.copyFileSync(srcFile, destFile);
    }
  });
  
  console.log(`Δημιουργήθηκε backup στο: ${backupDir}`);
  return backupDir;
}

// Αντικατάσταση NeDB με MongoDB στο virtualTrading.js
async function fixVirtualTradingFile() {
  const filePath = path.join(backendDir, 'services/virtualTrading.js');
  
  try {
    let content = await readFile(filePath, 'utf8');
    
    // Αφαίρεση όλων των αναφορών στο NeDB
    content = content.replace(/const\s+Datastore\s*=\s*require\s*\(\s*['"]nedb['"]\s*\)\s*;/g, 
      '// MongoDB models\nconst Transaction = require(\'../models/Transaction\');\nconst Portfolio = require(\'../models/Portfolio\');');
    
    // Αφαίρεση δημιουργίας rawDB
    content = content.replace(/const\s+DB_PATH\s*=\s*path\.join\([^)]+\);\s*\n\s*const\s+rawDB\s*=\s*new\s+Datastore[^;]+;/g, 
      '// Using MongoDB models instead of NeDB');
    
    // Αντικατάσταση της promisify για NeDB
    content = content.replace(/rawDB\.findAsync\s*=\s*promisify\([^)]+\);[\s\S]*?rawDB\.removeAsync\s*=\s*promisify\([^)]+\);/g, 
      '// Using MongoDB/Mongoose models with native promises');
    
    // Αντικατάσταση NeDB queries με Mongoose
    content = content.replace(/await\s+rawDB\.findAsync\(\s*([^)]+)\)/g, 
      'await Transaction.find($1)');
    
    content = content.replace(/await\s+rawDB\.removeAsync\(\s*\{\s*_id\s*:\s*([^}]+)\}\s*\)/g, 
      'await Transaction.findByIdAndDelete($1)');
    
    // Αντικατάσταση isDatabaseDuplicate μεθόδου
    const isDatabaseDuplicateReplacement = `
// MongoDB check for duplicate transactions
const isDatabaseDuplicate = async (tx) => {
  try {
    // Create a time window around the transaction timestamp
    const startTime = tx.timestamp - 10000; // 10 seconds before
    const endTime = tx.timestamp + 10000;   // 10 seconds after
    
    // Find transactions with the same basic properties
    const existingTransactions = await Transaction.find({
      userId: tx.userId,
      symbol: tx.symbol,
      action: tx.action,
      timestamp: { $gte: startTime, $lte: endTime }
    });
    
    console.log(\`DB CHECK: Found \${existingTransactions.length} similar transactions for \${tx.symbol}\`);
    
    // Check if any existing transaction matches closely enough to be a duplicate
    for (const existingTx of existingTransactions) {
      // Quantity approximately the same (allow 0.1% difference)
      const quantityDiff = Math.abs(existingTx.quantity - tx.quantity) / tx.quantity;
      const quantityMatch = quantityDiff < 0.001;
      
      // Price approximately the same (allow 0.1% difference)
      const priceDiff = Math.abs(existingTx.price - tx.price) / tx.price;
      const priceMatch = priceDiff < 0.001;
      
      if (quantityMatch && priceMatch) {
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
};`;
    
    content = content.replace(/const\s+isDatabaseDuplicate\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}\s*;/g, 
      isDatabaseDuplicateReplacement);
    
    // Αντικατάσταση isRawDatabaseDuplicate με τη νέα MongoDB έκδοση
    content = content.replace(/const\s+isRawDatabaseDuplicate\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}\s*;/g, 
      `// MongoDB direct check (replaces raw NeDB check)
const isRawDatabaseDuplicate = async (tx) => {
  try {
    // Use MongoDB aggregation for more complex query
    const results = await Transaction.find({
      userId: tx.userId,
      symbol: tx.symbol,
      action: tx.action,
      timestamp: { $gte: tx.timestamp - 10000, $lte: tx.timestamp + 10000 }
    });
    
    if (results && results.length > 0) {
      // Filter the results based on quantity and price similarity
      const duplicates = results.filter(doc => {
        const timeDiff = Math.abs(doc.timestamp - tx.timestamp);
        const quantityRatio = Math.abs(doc.quantity / tx.quantity - 1);
        const priceRatio = Math.abs(doc.price / tx.price - 1);
        
        return timeDiff < 10000 && quantityRatio < 0.01 && priceRatio < 0.01;
      });
      
      if (duplicates.length > 0) {
        console.log(\`MongoDB: Found \${duplicates.length} potential duplicates with direct query\`);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error in MongoDB duplicate check:', error);
    return true; // Safety first
  }
};`);
    
    // Αντικατάσταση removeDuplicateTransactions μεθόδου
    content = content.replace(/exports\.removeDuplicateTransactions\s*=\s*async\s*\(userId\s*=\s*'default'\)\s*=>\s*\{[\s\S]*?\}\s*;/g, 
      `exports.removeDuplicateTransactions = async (userId = 'default') => {
  try {
    console.log(\`Manually cleaning up duplicates for user \${userId}\`);
    
    // Get all transactions for this user
    const allTransactions = await Transaction.find({ userId });
    console.log(\`Found \${allTransactions.length} total transactions for \${userId}\`);
    
    // Group transactions by key properties
    const grouped = {};
    
    allTransactions.forEach(tx => {
      // Create a key based on essential properties
      // Round timestamp to nearest 5 seconds
      const timeWindow = Math.floor(tx.timestamp / 5000);
      const key = \`\${tx.userId}_\${tx.symbol}_\${tx.action}_\${Math.round(tx.quantity * 1000000) / 1000000}_\${timeWindow}\`;
      
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
        console.log(\`Found duplicate group for key \${key} with \${group.length} transactions\`);
        
        // Keep the first transaction, mark others as duplicates
        for (let i = 1; i < group.length; i++) {
          duplicateIds.push(group[i]._id);
          duplicateCount++;
        }
      }
    });
    
    console.log(\`Found \${duplicateCount} duplicate transactions\`);
    
    if (duplicateCount > 0) {
      // Delete each duplicate transaction
      for (const id of duplicateIds) {
        await Transaction.findByIdAndDelete(id);
      }
      
      console.log(\`Removed \${duplicateCount} duplicate transactions\`);
      
      // Force portfolio reconciliation
      await this.reconcilePortfolio(userId);
    }
    
    return { 
      success: true, 
      message: \`Removed \${duplicateCount} duplicate transactions\` 
    };
  } catch (error) {
    console.error('Error removing duplicate transactions:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
};`);
    
    // Αντικατάσταση reconcilePortfolio μεθόδου
    content = content.replace(/exports\.reconcilePortfolio\s*=\s*async\s*\(userId\s*=\s*'default'\)\s*=>\s*\{[\s\S]*?\}\s*;/g, 
      `exports.reconcilePortfolio = async (userId = 'default') => {
  try {
    console.log(\`Reconciling portfolio for user \${userId}\`);
    
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
    const transactions = await Transaction.find({ userId }).sort({ timestamp: 1 });
    console.log(\`Found \${transactions.length} transactions for reconciliation\`);
    
    // Reset portfolio to initial values
    portfolio.balance = 10000;
    portfolio.assets = [];
    
    // Process each transaction to rebuild portfolio
    for (const tx of transactions) {
      console.log(\`Reconciling \${tx.action} transaction for \${tx.symbol}: \${tx.quantity} @ \${tx.price}\`);
      
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
          console.warn(\`Warning: Tried to sell \${tx.symbol} but it's not in portfolio\`);
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
};`);
    
    
    // Γράψε το ενημερωμένο περιεχόμενο πίσω στο αρχείο
    await writeFile(filePath, content, 'utf8');
    console.log('✅ Διορθώθηκε το αρχείο virtualTrading.js');
    return true;
  } catch (error) {
    console.error(`❌ Σφάλμα κατά την ενημέρωση του virtualTrading.js:`, error);
    return false;
  }
}

// Αντικατάσταση NeDB με MongoDB στο tradingBotService.js
async function fixTradingBotFile() {
  const filePath = path.join(backendDir, 'services/tradingBotService.js');
  
  try {
    let content = await readFile(filePath, 'utf8');
    
    // Αφαίρεση αναφορών NeDB
    content = content.replace(/const\s+Datastore\s*=\s*require\s*\(\s*['"]nedb['"]\s*\)\s*;/g, '');
    
    // Αντικατάσταση NeDB database initialization
    content = content.replace(/const\s+db\s*=\s*new\s+Datastore[^;]+;[\s\S]*?db\.loadDatabase\(\)/g, 
      '// Using MongoDB models instead of NeDB');
    
    // Ενημέρωση promisify αναφορών
    content = content.replace(/db\.[a-zA-Z]+Async\s*=\s*promisify\([^)]+\);/g, '');
    
    // Γράψε το ενημερωμένο περιεχόμενο πίσω στο αρχείο
    await writeFile(filePath, content, 'utf8');
    console.log('✅ Διορθώθηκε το αρχείο tradingBotService.js');
    return true;
  } catch (error) {
    console.error(`❌ Σφάλμα κατά την ενημέρωση του tradingBotService.js:`, error);
    return false;
  }
}

// Ενημέρωση του server.js
async function fixServerFile() {
  const filePath = path.join(backendDir, 'server.js');
  
  try {
    let content = await readFile(filePath, 'utf8');
    
    // Αντικατάσταση NeDB με MongoDB
    content = content.replace(/require\(['"]\.\/config\/nedb['"]\);/g, 
      'const connectDB = require(\'./config/mongodb\');\n\n// Initialize MongoDB connection\nconnectDB().then(() => {\n  console.log(\'MongoDB connected successfully\');\n}).catch(err => {\n  console.error(\'MongoDB connection failed:\', err);\n  process.exit(1);\n});');
    
    // Αλλαγή μηνυμάτων για MongoDB
    content = content.replace(/with NeDB (file-based )?storage/g, 'with MongoDB storage');
    
    // Γράψε το ενημερωμένο περιεχόμενο πίσω στο αρχείο
    await writeFile(filePath, content, 'utf8');
    console.log('✅ Διορθώθηκε το αρχείο server.js');
    return true;
  } catch (error) {
    console.error(`❌ Σφάλμα κατά την ενημέρωση του server.js:`, error);
    return false;
  }
}

// Έλεγχος αν τα αρχεία Mongoose υπάρχουν, αν όχι δημιούργησέ τα
async function ensureMongooseModelsExist() {
  // MongoDB connection file
  const connectionFile = path.join(backendDir, 'config/mongodb.js');
  if (!fs.existsSync(connectionFile)) {
    // Create directory if it doesn't exist
    const dir = path.dirname(connectionFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create MongoDB connection file
    const connectionContent = `// config/mongodb.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Create data directory for backup files if migration needed
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// MongoDB connection function
const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variables with fallback
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradingbot';
    
    // Set up connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    
    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);
    
    console.log(\`MongoDB Connected: \${conn.connection.host}\`);
    return conn;
  } catch (error) {
    console.error(\`Error connecting to MongoDB: \${error.message}\`);
    process.exit(1);
  }
};

module.exports = connectDB;`;
    
    await writeFile(connectionFile, connectionContent, 'utf8');
    console.log('✅ Δημιουργήθηκε το αρχείο MongoDB connection');
  }
  
  // Check and create Portfolio model if needed
  const portfolioModelFile = path.join(backendDir, 'models/Portfolio.js');
  if (!fs.existsSync(portfolioModelFile) || (await readFile(portfolioModelFile, 'utf8')).includes('Datastore')) {
    const portfolioContent = `// models/Portfolio.js
const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  averagePrice: {
    type: Number,
    required: true,
    default: 0
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  btcPrice: {
    type: Number,
    default: 0
  }
});

const PortfolioSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  balance: {
    type: Number,
    required: true,
    default: 10000
  },
  assets: {
    type: [AssetSchema],
    default: []
  },
  equity: {
    type: Number,
    required: true,
    default: 10000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps on save
PortfolioSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Portfolio = mongoose.model('Portfolio', PortfolioSchema);
module.exports = Portfolio;`;
    
    await writeFile(portfolioModelFile, portfolioContent, 'utf8');
    console.log('✅ Δημιουργήθηκε/Ενημερώθηκε το μοντέλο Portfolio για MongoDB');
  }
  
  // Check and create Transaction model if needed
  const transactionModelFile = path.join(backendDir, 'models/Transaction.js');
  if (!fs.existsSync(transactionModelFile) || (await readFile(transactionModelFile, 'utf8')).includes('Datastore')) {
    const transactionContent = `// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'default'
  },
  symbol: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Number,
    required: true,
    default: () => Date.now()
  },
  signal: {
    type: String,
    default: 'MANUAL'
  },
  valueUSD: {
    type: Number
  },
  valueBTC: {
    type: Number
  },
  btcPrice: {
    type: Number
  },
  uniqueId: {
    type: String
  }
});

// Index for quicker lookups
TransactionSchema.index({ userId: 1, timestamp: -1 });
TransactionSchema.index({ userId: 1, symbol: 1, action: 1 });
TransactionSchema.index({ uniqueId: 1 }, { unique: true, sparse: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);
module.exports = Transaction;`;
    
    await writeFile(transactionModelFile, transactionContent, 'utf8');
    console.log('✅ Δημιουργήθηκε/Ενημερώθηκε το μοντέλο Transaction για MongoDB');
  }
  
  // Check and create Signal model if needed
  const signalModelFile = path.join(backendDir, 'models/Signal.js');
  if (!fs.existsSync(signalModelFile) || (await readFile(signalModelFile, 'utf8')).includes('Datastore')) {
    const signalContent = `// models/Signal.js
const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: 'default'
  },
  symbol: {
    type: String,
    required: true
  },
  time: {
    type: Number,
    required: true,
    default: () => Date.now()
  },
  indicator: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
  },
  price: {
    type: Number,
    required: true
  },
  value: {
    type: String
  },
  reason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster querying
SignalSchema.index({ time: -1 });
SignalSchema.index({ symbol: 1 });
SignalSchema.index({ userId: 1 });
SignalSchema.index({ symbol: 1, time: -1 });

// Static methods
SignalSchema.statics.getRecentSignals = async function(symbol, interval, userId = 'default', limit = 100) {
  try {
    // Get recent signals for the specified symbol and user
    const query = {
      symbol,
      userId
    };
    
    // Find signals within the window of the specified interval
    let timeWindow = 3600000; // Default 1 hour
    
    switch (interval) {
      case '1m':
        timeWindow = 60000; // 1 minute
        break;
      case '5m':
        timeWindow = 300000; // 5 minutes
        break;
      case '15m':
        timeWindow = 900000; // 15 minutes
        break;
      case '30m':
        timeWindow = 1800000; // 30 minutes
        break;
      case '1h':
        timeWindow = 3600000; // 1 hour
        break;
      case '4h':
        timeWindow = 14400000; // 4 hours
        break;
      case '1d':
        timeWindow = 86400000; // 1 day
        break;
    }
    
    const startTime = Date.now() - timeWindow;
    query.time = { $gte: startTime };
    
    return await this.find(query).sort({ time: -1 }).limit(limit);
  } catch (error) {
    console.error('Error getting recent signals:', error);
    return [];
  }
};

SignalSchema.statics.cleanup = async function(olderThan = 30 * 24 * 60 * 60 * 1000) {
  try {
    const cutoffTime = Date.now() - olderThan;
    const result = await this.deleteMany({ time: { $lt: cutoffTime } });
    console.log(\`Cleaned up \${result.deletedCount} old signals\`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up old signals:', error);
    throw error;
  }
};

const Signal = mongoose.model('Signal', SignalSchema);
module.exports = Signal;`;
    
    await writeFile(signalModelFile, signalContent, 'utf8');
    console.log('✅ Δημιουργήθηκε/Ενημερώθηκε το μοντέλο Signal για MongoDB');
  }
  
  // Create ActiveBot model if needed
  const activeBotModelFile = path.join(backendDir, 'models/ActiveBot.js');
  if (!fs.existsSync(activeBotModelFile) || (await readFile(activeBotModelFile, 'utf8')).includes('Datastore')) {
    const activeBotContent = `// models/ActiveBot.js
const mongoose = require('mongoose');

const ActiveBotSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  interval: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    default: 'default'
  },
  active: {
    type: Boolean,
    default: true
  },
  startTime: {
    type: Number,
    default: () => Date.now()
  },
  stopTime: {
    type: Number
  },
  callbackId: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for looking up bots by their unique key
ActiveBotSchema.index({ symbol: 1, interval: 1, userId: 1 }, { unique: true });

// Update timestamps on save
ActiveBotSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static methods
ActiveBotSchema.statics.findByKey = async function(symbol, interval, userId = 'default') {
  return this.findOne({
    symbol,
    interval,
    userId
  });
};

ActiveBotSchema.statics.findByUser = async function(userId = 'default') {
  return this.find({ userId });
};

ActiveBotSchema.statics.findActive = async function() {
  return this.find({ active: true });
};

ActiveBotSchema.statics.findActiveBySymbol = async function(symbol) {
  return this.find({ symbol, active: true });
};

ActiveBotSchema.statics.removeByKey = async function(symbol, interval, userId = 'default') {
  try {
    const result = await this.deleteOne({
      symbol,
      interval,
      userId
    });
    return result.deletedCount;
  } catch (error) {
    console.error('Error removing active bot by key:', error);
    throw error;
  }
};

ActiveBotSchema.statics.cleanup = async function(olderThan = 24 * 60 * 60 * 1000) {
  try {
    const cutoffTime = Date.now() - olderThan;
    // Remove bots that haven't been updated in the specified time
    const result = await this.deleteMany({ 
      updatedAt: { $lt: cutoffTime },
      active: false
    });
    
    console.log(\`Cleaned up \${result.deletedCount} inactive bots\`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up inactive bots:', error);
    throw error;
  }
};

const ActiveBot = mongoose.model('ActiveBot', ActiveBotSchema);
module.exports = ActiveBot;`;
    
    await writeFile(activeBotModelFile, activeBotContent, 'utf8');
    console.log('✅ Δημιουργήθηκε/Ενημερώθηκε το μοντέλο ActiveBot για MongoDB');
  }
  
  // Create MarketData model if needed
  const marketDataModelFile = path.join(backendDir, 'models/MarketData.js');
  if (!fs.existsSync(marketDataModelFile) || (await readFile(marketDataModelFile, 'utf8')).includes('Datastore')) {
    const marketDataContent = `// models/MarketData.js
const mongoose = require('mongoose');

const MarketDataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['price', 'candle', 'trading_pairs']
  },
  interval: {
    type: String
  },
  time: {
    type: Number,
    default: () => Date.now()
  },
  price: {
    type: Number
  },
  // Candle data
  open: {
    type: Number
  },
  high: {
    type: Number
  },
  low: {
    type: Number
  },
  close: {
    type: Number
  },
  volume: {
    type: Number
  },
  isClosed: {
    type: Boolean
  },
  // Trading pairs data
  pairs: {
    type: Array
  },
  // Common fields
  key: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster querying
MarketDataSchema.index({ symbol: 1 });
MarketDataSchema.index({ type: 1 });
MarketDataSchema.index({ time: -1 });
MarketDataSchema.index({ key: 1 }, { unique: true, sparse: true });

// Generate a unique key for this market data
MarketDataSchema.methods.generateKey = function() {
  const parts = [this.symbol, this.type];
  
  if (this.interval) {
    parts.push(this.interval);
  }
  
  if (this.time) {
    // Round time to the nearest minute for candles
    if (this.type === 'candle' && this.interval) {
      let roundingFactor = 60000; // 1 minute in ms
      
      switch (this.interval) {
        case '1m': roundingFactor = 60000; break;
        case '5m': roundingFactor = 300000; break;
        case '15m': roundingFactor = 900000; break;
        case '30m': roundingFactor = 1800000; break;
        case '1h': roundingFactor = 3600000; break;
        case '4h': roundingFactor = 14400000; break;
        case '1d': roundingFactor = 86400000; break;
      }
      
      const roundedTime = Math.floor(this.time / roundingFactor) * roundingFactor;
      parts.push(roundedTime.toString());
    } else {
      parts.push(this.time.toString());
    }
  }
  
  return parts.join('-');
};

// Update key and timestamps before saving
MarketDataSchema.pre('save', function(next) {
  this.key = this.generateKey();
  this.updatedAt = Date.now();
  next();
});

// Static methods
MarketDataSchema.statics.savePrice = async function(symbol, price) {
  try {
    const key = \`\${symbol}-price-\${Date.now()}\`;
    
    // Use findOneAndUpdate with upsert to avoid duplicates
    const data = await this.findOneAndUpdate(
      { symbol, type: 'price', key },
      {
        symbol,
        type: 'price',
        price,
        time: Date.now(),
        key,
        updatedAt: Date.now()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    return data;
  } catch (error) {
    console.error('Error saving price data:', error);
    throw error;
  }
};

MarketDataSchema.statics.getLatestPrice = async function(symbol) {
  try {
    return await this.findOne({ 
      symbol, 
      type: 'price' 
    }).sort({ time: -1 });
  } catch (error) {
    console.error('Error getting latest price:', error);
    return null;
  }
};

MarketDataSchema.statics.saveCandle = async function(symbol, interval, candle) {
  try {
    const time = candle.time;
    const roundingFactor = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000
    }[interval] || 60000;
    
    const roundedTime = Math.floor(time / roundingFactor) * roundingFactor;
    const key = \`\${symbol}-candle-\${interval}-\${roundedTime}\`;
    
    // Use findOneAndUpdate with upsert
    const data = await this.findOneAndUpdate(
      { key },
      {
        symbol,
        type: 'candle',
        interval,
        time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        isClosed: candle.isClosed,
        key,
        updatedAt: Date.now()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    return data;
  } catch (error) {
    console.error('Error saving candle data:', error);
    throw error;
  }
};

MarketDataSchema.statics.getCandles = async function(symbol, interval, limit = 100) {
  try {
    return await this.find({ 
      symbol, 
      type: 'candle',
      interval
    }).sort({ time: 1 }).limit(limit);
  } catch (error) {
    console.error('Error getting candles:', error);
    return [];
  }
};

MarketDataSchema.statics.cleanup = async function(options = {}) {
  try {
    const { 
      priceDataAge = 1 * 24 * 60 * 60 * 1000,  // 1 day for price data
      candleDataAge = 7 * 24 * 60 * 60 * 1000  // 7 days for candle data
    } = options;
    
    const now = Date.now();
    
    // Remove old price data
    const priceResult = await this.deleteMany({ 
      type: 'price',
      updatedAt: { $lt: now - priceDataAge }
    });
    
    // Remove old candle data
    const candleResult = await this.deleteMany({
      type: 'candle',
      updatedAt: { $lt: now - candleDataAge }
    });
    
    console.log(\`Cleaned up \${priceResult.deletedCount} price entries and \${candleResult.deletedCount} candle entries\`);
    return { 
      priceResult: priceResult.deletedCount, 
      candleResult: candleResult.deletedCount 
    };
  } catch (error) {
    console.error('Error cleaning up market data:', error);
    throw error;
  }
};

const MarketData = mongoose.model('MarketData', MarketDataSchema);
module.exports = MarketData;`;
    
    await writeFile(marketDataModelFile, marketDataContent, 'utf8');
    console.log('✅ Δημιουργήθηκε/Ενημερώθηκε το μοντέλο MarketData για MongoDB');
  }
  
  // Create Config model if needed
  const configModelFile = path.join(backendDir, 'models/Config.js');
  if (!fs.existsSync(configModelFile) || (await readFile(configModelFile, 'utf8')).includes('Datastore')) {
    const configContent = `// models/Config.js
const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'default'
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamps on save
ConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static methods
ConfigSchema.statics.getSettings = async function(userId = 'default', key = null) {
  try {
    const config = await this.findOne({ userId });
    
    if (!config) {
      return key ? null : {};
    }
    
    if (key) {
      return config.settings?.[key] || null;
    }
    
    return config.settings || {};
  } catch (error) {
    console.error('Error getting settings:', error);
    throw error;
  }
};

ConfigSchema.statics.saveSettings = async function(userId = 'default', settings, key = null) {
  try {
    let config = await this.findOne({ userId });
    
    if (!config) {
      config = new this({
        userId,
        settings: {},
        createdAt: Date.now()
      });
    }
    
    if (key) {
      // Save a specific setting
      config.settings = config.settings || {};
      config.settings[key] = settings;
    } else {
      // Save all settings
      config.settings = settings;
    }
    
    config.updatedAt = Date.now();
    await config.save();
    return config.settings;
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
};

const Config = mongoose.model('Config', ConfigSchema);
module.exports = Config;`;
    
    await writeFile(configModelFile, configContent, 'utf8');
    console.log('✅ Δημιουργήθηκε/Ενημερώθηκε το μοντέλο Config για MongoDB');
  }
  
  return true;
}

// Κύρια λειτουργία του script
async function main() {
  console.log('🔧 Ξεκινάει η μετάβαση από το NeDB στο MongoDB...');
  
  // Έλεγχος για εγκατάσταση mongoose
  try {
    require('mongoose');
  } catch (error) {
    console.error('❌ Λείπει το mongoose! Παρακαλώ εγκαταστήστε το με την εντολή:');
    console.error('npm install mongoose --save');
    return;
  }
  
  // Δημιουργία backup
  const backupDir = createBackup();
  
  // Έλεγχος και δημιουργία των Mongoose μοντέλων αν δεν υπάρχουν
  await ensureMongooseModelsExist();
  
  // Τροποποίηση του αρχείου virtualTrading.js
  await fixVirtualTradingFile();
  
  // Τροποποίηση του αρχείου tradingBotService.js
  await fixTradingBotFile();
  
  // Τροποποίηση του αρχείου server.js
  await fixServerFile();
  
  // Πρόσθετες ενέργειες: Ενημέρωση του package.json
  try {
    const packageFile = path.join(backendDir, 'package.json');
    if (fs.existsSync(packageFile)) {
      let packageJson = JSON.parse(await readFile(packageFile, 'utf8'));
      
      // Αφαίρεση του NeDB
      if (packageJson.dependencies && packageJson.dependencies.nedb) {
        delete packageJson.dependencies.nedb;
      }
      
      // Προσθήκη του Mongoose αν δεν υπάρχει
      if (!packageJson.dependencies) {
        packageJson.dependencies = {};
      }
      
      if (!packageJson.dependencies.mongoose) {
        packageJson.dependencies.mongoose = "^6.9.0";
      }
      
      await writeFile(packageFile, JSON.stringify(packageJson, null, 2), 'utf8');
      console.log('✅ Ενημερώθηκε το package.json');
    }
  } catch (error) {
    console.error('❌ Σφάλμα ενημέρωσης του package.json:', error);
  }
  
  // Δημιουργία κατάλληλου .env αρχείου
  const envFile = path.join(backendDir, '.env');
  try {
    let envContent = '';
    if (fs.existsSync(envFile)) {
      envContent = await readFile(envFile, 'utf8');
    }
    
    // Προσθήκη MONGODB_URI αν δεν υπάρχει
    if (!envContent.includes('MONGODB_URI=')) {
      envContent += '\nMONGODB_URI=mongodb://localhost:27017/tradingbot\n';
      await writeFile(envFile, envContent, 'utf8');
      console.log('✅ Ενημερώθηκε το αρχείο .env με τις συνδέσεις MongoDB');
    }
  } catch (error) {
    console.error('❌ Σφάλμα ενημέρωσης του .env αρχείου:', error);
  }
  
  console.log('\n🎉 Η μετάβαση ολοκληρώθηκε!');
  console.log(`📂 Δημιουργήθηκε backup στο: ${backupDir}`);
  console.log('\n📋 Επόμενα βήματα:');
  console.log('1. Εγκατάσταση του mongoose (αν δεν το έχετε κάνει ήδη):');
  console.log('   npm install mongoose --save');
  console.log('2. Βεβαιωθείτε ότι έχετε εγκαταστήσει και εκκινήσει το MongoDB:');
  console.log('   https://www.mongodb.com/try/download/community');
  console.log('3. Επανεκκινήστε την εφαρμογή:');
  console.log('   npm start');
}

// Εκτέλεση του script
main().catch(error => {
  console.error('❌ Σφάλμα κατά την εκτέλεση του script:', error);
});