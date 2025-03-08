// models/Signal.js - Model for storing trading signals
const path = require('path');
const Datastore = require('nedb');
const { promisify } = require('util');
const dbConfig = require('../config/nedb');

// Create the database with safer configuration
const dbPath = path.join(dbConfig.dataDir, 'signals.db');
const db = new Datastore({ 
  filename: dbPath, 
  ...dbConfig.options
});

// Create index on time and symbol for faster querying
db.ensureIndex({ fieldName: 'time' });
db.ensureIndex({ fieldName: 'symbol' });
db.ensureIndex({ fieldName: 'userId' });

// Ensure the file is created and accessible
try {
  if (!require('fs').existsSync(dbPath)) {
    require('fs').writeFileSync(dbPath, '', { flag: 'wx' });
    console.log(`Created new signals database file at ${dbPath}`);
  }
} catch (error) {
  console.warn(`Warning creating signals.db: ${error.message}`);
}

// Promisify the database methods
db.findOneAsync = promisify(db.findOne.bind(db));
db.findAsync = promisify(db.find.bind(db));
db.insertAsync = promisify(db.insert.bind(db));
db.updateAsync = promisify(db.update.bind(db));
db.removeAsync = promisify(db.remove.bind(db));
db.countAsync = promisify(db.count.bind(db));

class Signal {
  constructor(data) {
    Object.assign(this, data);
    
    // Ensure the timestamp is stored as a number
    if (this.time && typeof this.time === 'string') {
      this.time = parseInt(this.time);
    }
    
    // If no time is provided, use current time
    if (!this.time) {
      this.time = Date.now();
    }
  }
  
  async save() {
    try {
      // Check for duplicates before saving
      const existingSignal = await Signal.findDuplicate(this);
      if (existingSignal) {
        console.log(`Skipping duplicate signal: ${this.indicator} ${this.action} for ${this.symbol}`);
        return existingSignal;
      }
      
      if (this._id) {
        // Update existing signal
        const result = await db.updateAsync({ _id: this._id }, this, {});
        return result;
      } else {
        // Add creation timestamp
        if (!this.createdAt) {
          this.createdAt = Date.now();
        }
        
        // Insert new signal
        const result = await db.insertAsync(this);
        this._id = result._id;
        return result;
      }
    } catch (error) {
      console.error('Error saving signal:', error);
      throw error;
    }
  }
  
  static async findOne(query) {
    try {
      const result = await db.findOneAsync(query);
      return result ? new Signal(result) : null;
    } catch (error) {
      console.error('Error finding signal:', error);
      throw error;
    }
  }
  
  static async find(query = {}, sort = { time: -1 }, limit = 100, skip = 0) {
    try {
      // Convert query parameters to NeDB query
      const dbQuery = {};
      
      if (query.symbol) dbQuery.symbol = query.symbol;
      if (query.indicator) dbQuery.indicator = query.indicator;
      if (query.action) dbQuery.action = query.action;
      if (query.userId) dbQuery.userId = query.userId;
      
      // Time range query
      if (query.startTime || query.endTime) {
        dbQuery.time = {};
        if (query.startTime) dbQuery.time.$gte = parseInt(query.startTime);
        if (query.endTime) dbQuery.time.$lte = parseInt(query.endTime);
      }
      
      // Execute query with sort, limit and skip
      const results = await db.findAsync(dbQuery)
        .sort(sort)
        .limit(limit)
        .skip(skip);
      
      return results.map(result => new Signal(result));
    } catch (error) {
      console.error('Error finding signals:', error);
      throw error;
    }
  }
  
  static async findDuplicate(signal) {
    try {
      // Define the window for potential duplicates (5 seconds)
      const timeWindow = 5000;
      const startTime = signal.time - timeWindow;
      const endTime = signal.time + timeWindow;
      
      // Check for signals with same key properties in the time window
      const duplicateQuery = {
        symbol: signal.symbol,
        indicator: signal.indicator,
        action: signal.action,
        time: {
          $gte: startTime,
          $lte: endTime
        }
      };
      
      // Add userId check if specified
      if (signal.userId) {
        duplicateQuery.userId = signal.userId;
      }
      
      // Find potential duplicates
      const result = await db.findOneAsync(duplicateQuery);
      return result ? new Signal(result) : null;
    } catch (error) {
      console.error('Error checking for duplicate signal:', error);
      return null; // Assume no duplicate in case of error
    }
  }
  
  static async getRecentSignals(symbol, interval, userId = 'default', limit = 100) {
    try {
      // Get recent signals for the specified symbol and user
      const query = {
        symbol,
        userId
      };
      
      // Find signals within the window of the specified interval
      // For example, if interval is 1h, look at signals in the past hour
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
      
      return await this.find(query, { time: -1 }, limit);
    } catch (error) {
      console.error('Error getting recent signals:', error);
      return [];
    }
  }
  
  static async cleanup(olderThan = 30 * 24 * 60 * 60 * 1000) { // Default 30 days
    try {
      const cutoffTime = Date.now() - olderThan;
      const result = await db.removeAsync({ time: { $lt: cutoffTime } }, { multi: true });
      console.log(`Cleaned up ${result} old signals`);
      return result;
    } catch (error) {
      console.error('Error cleaning up old signals:', error);
      throw error;
    }
  }
}

module.exports = Signal;