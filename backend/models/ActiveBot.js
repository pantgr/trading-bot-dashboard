// models/ActiveBot.js - Model for storing active trading bots
const path = require('path');
const Datastore = require('nedb');
const { promisify } = require('util');
const dbConfig = require('../config/nedb');

// Create the database with safer configuration
const dbPath = path.join(dbConfig.dataDir, 'active_bots.db');
const db = new Datastore({ 
  filename: dbPath, 
  ...dbConfig.options
});

// Create indices for faster querying
db.ensureIndex({ fieldName: 'symbol' });
db.ensureIndex({ fieldName: 'userId' });

// Ensure the file is created and accessible
try {
  if (!require('fs').existsSync(dbPath)) {
    require('fs').writeFileSync(dbPath, '', { flag: 'wx' });
    console.log(`Created new active_bots database file at ${dbPath}`);
  }
} catch (error) {
  console.warn(`Warning creating active_bots.db: ${error.message}`);
}

// Promisify the database methods
db.findOneAsync = promisify(db.findOne.bind(db));
db.findAsync = promisify(db.find.bind(db));
db.insertAsync = promisify(db.insert.bind(db));
db.updateAsync = promisify(db.update.bind(db));
db.removeAsync = promisify(db.remove.bind(db));
db.countAsync = promisify(db.count.bind(db));

class ActiveBot {
  constructor(data) {
    Object.assign(this, data);
    
    // Ensure required fields
    if (!this.symbol) throw new Error('Symbol is required');
    if (!this.interval) throw new Error('Interval is required');
    if (!this.userId) this.userId = 'default';
    
    // If no startTime is provided, use current time
    if (!this.startTime) {
      this.startTime = Date.now();
    }
  }
  
  // Generate a unique key for this bot
  getKey() {
    return `${this.symbol}-${this.interval}-${this.userId}`;
  }
  
  async save() {
    try {
      // Check for existing bot with same key
      const existingBot = await ActiveBot.findOne({
        symbol: this.symbol,
        interval: this.interval,
        userId: this.userId
      });
      
      if (existingBot) {
        // Update existing bot
        this._id = existingBot._id;
        this.updatedAt = Date.now();
        const result = await db.updateAsync({ _id: this._id }, this, {});
        return result;
      } else {
        // Insert new bot
        if (!this.createdAt) {
          this.createdAt = Date.now();
        }
        this.updatedAt = Date.now();
        
        const result = await db.insertAsync(this);
        this._id = result._id;
        return result;
      }
    } catch (error) {
      console.error('Error saving active bot:', error);
      throw error;
    }
  }
  
  async remove() {
    try {
      if (!this._id) {
        // Try to find by key properties
        const bot = await ActiveBot.findOne({
          symbol: this.symbol,
          interval: this.interval,
          userId: this.userId
        });
        
        if (!bot) {
          console.log('Bot not found for removal');
          return 0;
        }
        
        this._id = bot._id;
      }
      
      return await db.removeAsync({ _id: this._id });
    } catch (error) {
      console.error('Error removing active bot:', error);
      throw error;
    }
  }
  
  static async findOne(query) {
    try {
      const result = await db.findOneAsync(query);
      return result ? new ActiveBot(result) : null;
    } catch (error) {
      console.error('Error finding active bot:', error);
      throw error;
    }
  }
  
  static async find(query = {}) {
    try {
      const results = await db.findAsync(query);
      return results.map(result => new ActiveBot(result));
    } catch (error) {
      console.error('Error finding active bots:', error);
      throw error;
    }
  }
  
  static async findByKey(symbol, interval, userId = 'default') {
    return this.findOne({
      symbol,
      interval,
      userId
    });
  }
  
  static async findByUser(userId = 'default') {
    return this.find({ userId });
  }
  
  static async findActive() {
    return this.find({ active: true });
  }
  
  static async findActiveBySymbol(symbol) {
    return this.find({ symbol, active: true });
  }
  
  static async removeByKey(symbol, interval, userId = 'default') {
    try {
      return await db.removeAsync({
        symbol,
        interval,
        userId
      });
    } catch (error) {
      console.error('Error removing active bot by key:', error);
      throw error;
    }
  }
  
  static async cleanup(olderThan = 24 * 60 * 60 * 1000) { // Default 24 hours
    try {
      const cutoffTime = Date.now() - olderThan;
      // Remove bots that haven't been updated in the specified time
      const result = await db.removeAsync({ 
        updatedAt: { $lt: cutoffTime },
        active: false
      }, { multi: true });
      
      console.log(`Cleaned up ${result} inactive bots`);
      return result;
    } catch (error) {
      console.error('Error cleaning up inactive bots:', error);
      throw error;
    }
  }
}

module.exports = ActiveBot;