// routes/adminRoutes.js - Administrative API endpoints
const express = require('express');
const router = express.Router();
const Signal = require('../models/Signal');
const ActiveBot = require('../models/ActiveBot');
const MarketData = require('../models/MarketData');
const Config = require('../models/Config');
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const fs = require('fs');
const path = require('path');

/**
 * @route GET /api/admin/status
 * @description Get system status information
 */
router.get('/status', async (req, res) => {
  try {
    // Counts from each database
    const signalCount = await countDocuments(Signal);
    const activeBotCount = await countDocuments(ActiveBot);
    const configCount = await countDocuments(Config);
    const portfolioCount = await countDocuments(Portfolio);
    const transactionCount = await countDocuments(Transaction);
    
    // Count market data separately
    const marketDataCount = await countDocuments(MarketData);
    
    // Get DB file sizes
    const dbSizes = await getDatabaseSizes();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      counts: {
        signals: signalCount,
        activeBots: activeBotCount,
        configs: configCount,
        portfolios: portfolioCount,
        transactions: transactionCount,
        marketData: marketDataCount
      },
      dbSizes,
      memoryUsage: {
        rss: formatBytes(memoryUsage.rss),
        heapTotal: formatBytes(memoryUsage.heapTotal),
        heapUsed: formatBytes(memoryUsage.heapUsed),
        external: formatBytes(memoryUsage.external)
      }
    });
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

/**
 * @route POST /api/admin/cleanup
 * @description Clean up old data from all databases
 */
router.post('/cleanup', async (req, res) => {
  try {
    const {
      signalDays = 30,     // Default 30 days for signals
      marketPriceDays = 1, // Default 1 day for market prices
      marketCandleDays = 7, // Default 7 days for candles
      inactiveBotDays = 7  // Default 7 days for inactive bots
    } = req.body;
    
    // Convert days to milliseconds
    const signalAge = signalDays * 24 * 60 * 60 * 1000;
    const marketPriceAge = marketPriceDays * 24 * 60 * 60 * 1000;
    const marketCandleAge = marketCandleDays * 24 * 60 * 60 * 1000;
    const inactiveBotAge = inactiveBotDays * 24 * 60 * 60 * 1000;
    
    // Clean up each database
    const signalResult = await Signal.cleanup(signalAge);
    
    const marketResult = await MarketData.cleanup({
      priceDataAge: marketPriceAge,
      candleDataAge: marketCandleAge
    });
    
    const botResult = await ActiveBot.cleanup(inactiveBotAge);
    
    res.json({
      success: true,
      message: 'Database cleanup completed',
      results: {
        signals: signalResult,
        marketData: marketResult,
        activeBots: botResult
      }
    });
  } catch (error) {
    console.error('Error cleaning up databases:', error);
    res.status(500).json({ error: 'Failed to clean up databases' });
  }
});

/**
 * @route GET /api/admin/db-stats
 * @description Get database statistics
 */
router.get('/db-stats', async (req, res) => {
  try {
    const dbSizes = await getDatabaseSizes();
    
    res.json({
      success: true,
      dbSizes
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

/**
 * @route POST /api/admin/compact-db
 * @description Compact all databases to reclaim space
 */
router.post('/compact-db', async (req, res) => {
  try {
    // Get the data directory path
    const dataDir = path.join(__dirname, '..', 'data');
    
    // List of database files
    const dbFiles = [
      'signals.db',
      'active_bots.db',
      'market_data.db',
      'configs.db',
      'portfolios.db',
      'transactions.db'
    ];
    
    const results = {};
    
    // Compact each database file
    for (const dbFile of dbFiles) {
      const dbPath = path.join(dataDir, dbFile);
      
      // Check if file exists
      if (!fs.existsSync(dbPath)) {
        results[dbFile] = { status: 'skipped', reason: 'file not found' };
        continue;
      }
      
      // Get file size before compaction
      const statsBefore = fs.statSync(dbPath);
      const sizeBefore = statsBefore.size;
      
      try {
        // We need to use the Datastore API to compact the database
        const Datastore = require('nedb');
        const db = new Datastore({ filename: dbPath });
        
        // Load the database
        await new Promise((resolve, reject) => {
          db.loadDatabase(err => {
            if (err) reject(err);
            else resolve();
          });
        });
        
        // Compact the database
        await new Promise((resolve, reject) => {
          db.persistence.compactDatafile();
          
          // Wait for compaction to complete
          const checkCompaction = () => {
            if (db.persistence.inMemoryOnly || db.persistence.compactDatafileScheduled) {
              setTimeout(checkCompaction, 100);
            } else {
              resolve();
            }
          };
          
          checkCompaction();
        });
        
        // Get file size after compaction
        const statsAfter = fs.statSync(dbPath);
        const sizeAfter = statsAfter.size;
        
        results[dbFile] = {
          status: 'success',
          sizeBefore: formatBytes(sizeBefore),
          sizeAfter: formatBytes(sizeAfter),
          reduction: formatBytes(sizeBefore - sizeAfter),
          reductionPercent: ((sizeBefore - sizeAfter) / sizeBefore * 100).toFixed(2) + '%'
        };
      } catch (err) {
        results[dbFile] = { status: 'error', message: err.message };
      }
    }
    
    res.json({
      success: true,
      message: 'Database compaction completed',
      results
    });
  } catch (error) {
    console.error('Error compacting databases:', error);
    res.status(500).json({ error: 'Failed to compact databases' });
  }
});

// Helper function to count documents in a collection
async function countDocuments(model) {
  try {
    // Call the count method if it exists
    if (typeof model.count === 'function') {
      return await model.count({});
    }
    
    // Otherwise, get all documents and count them
    const docs = await model.find({});
    return docs.length;
  } catch (error) {
    console.error('Error counting documents:', error);
    return 0;
  }
}

// Helper function to get database file sizes
async function getDatabaseSizes() {
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    
    // Get all files in the data directory
    const files = fs.readdirSync(dataDir);
    
    // Filter for database files
    const dbFiles = files.filter(file => file.endsWith('.db'));
    
    const sizes = {};
    
    // Get size of each database file
    for (const file of dbFiles) {
      const stats = fs.statSync(path.join(dataDir, file));
      sizes[file] = formatBytes(stats.size);
    }
    
    return sizes;
  } catch (error) {
    console.error('Error getting database sizes:', error);
    return {};
  }
}

// Helper function to format byte sizes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;