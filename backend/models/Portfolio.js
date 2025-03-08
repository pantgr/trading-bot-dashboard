// models/Portfolio.js - With improved database configuration
const path = require('path');
const Datastore = require('nedb');
const { promisify } = require('util');
const dbConfig = require('../config/nedb');

// Create the database with safer configuration
const dbPath = path.join(dbConfig.dataDir, 'portfolios.db');
const db = new Datastore({ 
  filename: dbPath, 
  ...dbConfig.options
});

// Ensure the file is created and accessible
try {
  if (!require('fs').existsSync(dbPath)) {
    require('fs').writeFileSync(dbPath, '', { flag: 'wx' });
    console.log(`Created new portfolios database file at ${dbPath}`);
  }
} catch (error) {
  console.warn(`Warning creating portfolios.db: ${error.message}`);
}

// Promisify the database methods
db.findOneAsync = promisify(db.findOne.bind(db));
db.findAsync = promisify(db.find.bind(db));
db.insertAsync = promisify(db.insert.bind(db));
db.updateAsync = promisify(db.update.bind(db));
db.removeAsync = promisify(db.remove.bind(db));

class Portfolio {
  constructor(data) {
    Object.assign(this, data);
  }
  
  async save() {
    try {
      if (this._id) {
        // Update existing record
        const result = await db.updateAsync({ _id: this._id }, this, {});
        return result;
      } else {
        // Insert new record
        const result = await db.insertAsync(this);
        this._id = result._id;
        return result;
      }
    } catch (error) {
      console.error('Error saving portfolio:', error);
      throw error;
    }
  }
  
  static async findOne(query) {
    try {
      const result = await db.findOneAsync(query);
      return result ? new Portfolio(result) : null;
    } catch (error) {
      console.error('Error finding portfolio:', error);
      throw error;
    }
  }
  
  static async find(query = {}) {
    try {
      const results = await db.findAsync(query);
      return results.map(result => new Portfolio(result));
    } catch (error) {
      console.error('Error finding portfolios:', error);
      throw error;
    }
  }
}

module.exports = Portfolio;
