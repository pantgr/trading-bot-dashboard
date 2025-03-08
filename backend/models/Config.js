// models/Config.js
const path = require('path');
const Datastore = require('nedb');
const { promisify } = require('util');
const dbConfig = require('../config/nedb');

// Create the database with safer configuration
const dbPath = path.join(dbConfig.dataDir, 'configs.db');
const db = new Datastore({ 
  filename: dbPath, 
  ...dbConfig.options
});

// Ensure the file is created and accessible
try {
  if (!require('fs').existsSync(dbPath)) {
    require('fs').writeFileSync(dbPath, '', { flag: 'wx' });
    console.log(`Created new configs database file at ${dbPath}`);
  }
} catch (error) {
  console.warn(`Warning creating configs.db: ${error.message}`);
}

// Promisify the database methods
db.findOneAsync = promisify(db.findOne.bind(db));
db.findAsync = promisify(db.find.bind(db));
db.insertAsync = promisify(db.insert.bind(db));
db.updateAsync = promisify(db.update.bind(db));
db.removeAsync = promisify(db.remove.bind(db));

class Config {
  constructor(data) {
    Object.assign(this, data);
  }
  
  async save() {
    try {
      if (this._id) {
        // Update existing config
        const result = await db.updateAsync({ _id: this._id }, this, {});
        return result;
      } else {
        // Insert new config
        const result = await db.insertAsync(this);
        this._id = result._id;
        return result;
      }
    } catch (error) {
      console.error('Error saving config:', error);
      throw error;
    }
  }
  
  static async findOne(query) {
    try {
      const result = await db.findOneAsync(query);
      return result ? new Config(result) : null;
    } catch (error) {
      console.error('Error finding config:', error);
      throw error;
    }
  }
  
  static async find(query = {}) {
    try {
      const results = await db.findAsync(query);
      return results.map(result => new Config(result));
    } catch (error) {
      console.error('Error finding configs:', error);
      throw error;
    }
  }
  
  static async getSettings(userId = 'default', key = null) {
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
  }
  
  static async saveSettings(userId = 'default', settings, key = null) {
    try {
      let config = await this.findOne({ userId });
      
      if (!config) {
        config = new Config({
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
  }
}

module.exports = Config;
