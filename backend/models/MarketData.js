// models/MarketData.js - Model for storing market data cache
const path = require('path');
const Datastore = require('nedb');
const { promisify } = require('util');
const dbConfig = require('../config/nedb');

// Create the database with safer configuration
const dbPath = path.join(dbConfig.dataDir, 'market_data.db');
const db = new Datastore({ 
  filename: dbPath, 
  ...dbConfig.options
});

// Create indices for faster querying
db.ensureIndex({ fieldName: 'symbol' });
db.ensureIndex({ fieldName: 'type' });
db.ensureIndex({ fieldName: 'time' });
db.ensureIndex({ fieldName: 'key' }); // Composite key for lookups

// Ensure the file is created and accessible
try {
  if (!require('fs').existsSync(dbPath)) {
    require('fs').writeFileSync(dbPath, '', { flag: 'wx' });
    console.log(`Created new market_data database file at ${dbPath}`);
  }
} catch (error) {
  console.warn(`Warning creating market_data.db: ${error.message}`);
}

// Promisify the database methods
db.findOneAsync = promisify(db.findOne.bind(db));
db.findAsync = promisify(db.find.bind(db));
db.insertAsync = promisify(db.insert.bind(db));
db.updateAsync = promisify(db.update.bind(db));
db.removeAsync = promisify(db.remove.bind(db));
db.countAsync = promisify(db.count.bind(db));

class MarketData {
  constructor(data) {
    Object.assign(this, data);
    
    // Ensure required fields
    if (!this.symbol) throw new Error('Symbol is required');
    if (!this.type) throw new Error('Type is required');
    
    // If no time is provided, use current time
    if (!this.time) {
      this.time = Date.now();
    }
    
    // Set updatedAt
    this.updatedAt = Date.now();
    
    // Generate a key for this market data entry
    this.key = this.generateKey();
  }
  
  // Generate a unique key for this market data
  generateKey() {
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
  }
  
  async save() {
    try {
      // Check for existing data with same key
      const existing = await MarketData.findOne({ key: this.key });
      
      if (existing) {
        // Update existing data
        this._id = existing._id;
        this.updatedAt = Date.now();
        const result = await db.updateAsync({ _id: this._id }, this, {});
        return result;
      } else {
        // Insert new data
        if (!this.createdAt) {
          this.createdAt = Date.now();
        }
        
        const result = await db.insertAsync(this);
        this._id = result._id;
        return result;
      }
    } catch (error) {
      console.error('Error saving market data:', error);
      throw error;
    }
  }
  
  static async findOne(query) {
    try {
      const result = await db.findOneAsync(query);
      return result ? new MarketData(result) : null;
    } catch (error) {
      console.error('Error finding market data:', error);
      throw error;
    }
  }
  
  static async find(query = {}, sort = { time: -1 }, limit = 100) {
    try {
      const results = await db.findAsync(query)
        .sort(sort)
        .limit(limit);
      
      return results.map(result => new MarketData(result));
    } catch (error) {
      console.error('Error finding market data:', error);
      throw error;
    }
  }
  
  static async savePrice(symbol, price) {
    try {
      const data = new MarketData({
        symbol,
        type: 'price',
        price,
        time: Date.now()
      });
      
      return await data.save();
    } catch (error) {
      console.error('Error saving price data:', error);
      throw error;
    }
  }
  
  static async getLatestPrice(symbol) {
    try {
      return await this.findOne({ 
        symbol, 
        type: 'price' 
      });
    } catch (error) {
      console.error('Error getting latest price:', error);
      return null;
    }
  }
  
  static async saveCandle(symbol, interval, candle) {
    try {
      const data = new MarketData({
        symbol,
        type: 'candle',
        interval,
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        isClosed: candle.isClosed
      });
      
      return await data.save();
    } catch (error) {
      console.error('Error saving candle data:', error);
      throw error;
    }
  }
  
  static async getCandles(symbol, interval, limit = 100) {
    try {
      return await this.find({ 
        symbol, 
        type: 'candle',
        interval
      }, { time: 1 }, limit); // Sort ascending by time
    } catch (error) {
      console.error('Error getting candles:', error);
      return [];
    }
  }
  
  static async cleanup(options = {}) {
    try {
      const { 
        priceDataAge = 1 * 24 * 60 * 60 * 1000,  // 1 day for price data
        candleDataAge = 7 * 24 * 60 * 60 * 1000  // 7 days for candle data
      } = options;
      
      const now = Date.now();
      
      // Remove old price data
      const priceResult = await db.removeAsync({ 
        type: 'price',
        updatedAt: { $lt: now - priceDataAge }
      }, { multi: true });
      
      // Remove old candle data
      const candleResult = await db.removeAsync({
        type: 'candle',
        updatedAt: { $lt: now - candleDataAge }
      }, { multi: true });
      
      console.log(`Cleaned up ${priceResult} price entries and ${candleResult} candle entries`);
      return { priceResult, candleResult };
    } catch (error) {
      console.error('Error cleaning up market data:', error);
      throw error;
    }
  }
}

module.exports = MarketData;