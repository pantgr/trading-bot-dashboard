#!/bin/bash
# setup-config-system.sh - Complete setup for the configuration system

echo "===== Setting Up Configuration System ====="

# Create all necessary directories
mkdir -p models services routes debug

# Step 1: Create the Config model
echo "Creating Config model..."
cat > models/Config.js << 'CONFIG_MODEL'
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
CONFIG_MODEL
echo "✅ Config model created"

# Step 2: Create the Config service
echo "Creating config service..."
cat > services/configService.js << 'CONFIG_SERVICE'
// services/configService.js
const Config = require('../models/Config');

/**
 * Configuration service for managing trading bot settings
 */
class ConfigService {
  /**
   * Get all config settings for a user
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Configuration settings
   */
  async getSettings(userId = 'default') {
    try {
      return await Config.getSettings(userId);
    } catch (error) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }
  
  /**
   * Get a specific config setting
   * @param {string} key - Setting key
   * @param {string} userId - User identifier
   * @returns {Promise<any>} - Setting value
   */
  async getSetting(key, userId = 'default') {
    try {
      return await Config.getSettings(userId, key);
    } catch (error) {
      console.error(`Error getting setting "${key}":`, error);
      throw error;
    }
  }
  
  /**
   * Save all config settings
   * @param {object} settings - Settings object
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Updated settings
   */
  async saveSettings(settings, userId = 'default') {
    try {
      return await Config.saveSettings(userId, settings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }
  
  /**
   * Save a specific config setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Updated settings
   */
  async saveSetting(key, value, userId = 'default') {
    try {
      return await Config.saveSettings(userId, value, key);
    } catch (error) {
      console.error(`Error saving setting "${key}":`, error);
      throw error;
    }
  }
}

module.exports = new ConfigService();
CONFIG_SERVICE
echo "✅ Config service created"

# Step 3: Create the config routes
echo "Creating config routes..."
cat > routes/configRoutes.js << 'CONFIG_ROUTES'
// routes/configRoutes.js
const express = require('express');
const router = express.Router();
const configService = require('../services/configService');

/**
 * @route GET /api/config/settings
 * @description Get all configuration settings
 */
router.get('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const settings = await configService.getSettings(userId);
    
    res.json(settings);
  } catch (error) {
    console.error('Error in /settings endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * @route GET /api/config/settings/:key
 * @description Get a specific configuration setting
 */
router.get('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const userId = req.query.userId || 'default';
    const value = await configService.getSetting(key, userId);
    
    if (value === null) {
      return res.status(404).json({ error: `Setting "${key}" not found` });
    }
    
    res.json({ key, value });
  } catch (error) {
    console.error(`Error getting setting "${req.params.key}":`, error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

/**
 * @route POST /api/config/settings
 * @description Save all configuration settings
 */
router.post('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.body.userId || 'default';
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }
    
    const updatedSettings = await configService.saveSettings(settings, userId);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * @route POST /api/config/settings/:key
 * @description Save a specific configuration setting
 */
router.post('/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.body.userId || 'default';
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    const updatedSettings = await configService.saveSetting(key, value, userId);
    res.json({ key, value: updatedSettings[key] });
  } catch (error) {
    console.error(`Error saving setting "${req.params.key}":`, error);
    res.status(500).json({ error: 'Failed to save setting' });
  }
});

module.exports = router;
CONFIG_ROUTES
echo "✅ Config routes created"

# Step 4: Create the initialization script
echo "Creating initialization script..."
cat > debug/initializeConfig.js << 'INIT_CONFIG'
// initializeConfig.js - Initialize default configuration
const Config = require('../models/Config');

async function initializeConfig() {
  console.log('Initializing default configuration...');
  
  try {
    // Check if default config exists
    const existingConfig = await Config.findOne({ userId: 'default' });
    
    if (existingConfig) {
      console.log('Default config already exists:', existingConfig);
      return existingConfig;
    }
    
    // Create default config with common settings
    const defaultConfig = new Config({
      userId: 'default',
      settings: {
        // Trading parameters
        tradingParams: {
          investmentAmount: 0.1,    // 10% of balance per trade
          stopLoss: 0.05,           // 5% stop loss
          takeProfit: 0.15,         // 15% take profit
          maxActiveTrades: 5,       // Max 5 active trades
          indicators: ['RSI', 'MACD', 'MA'],  // Default indicators
          tradingPairs: ['BTCUSDT', 'ETHUSDT', 'PROSUSDT', 'ADAUSDT', 'DOGEUSDT']  // Default pairs
        },
        
        // UI preferences
        uiPreferences: {
          theme: 'dark',            // Default theme
          chartInterval: '1h',      // Default chart interval
          defaultPair: 'BTCUSDT',   // Default trading pair
          notifications: true       // Enable notifications
        },
        
        // Bot settings
        botSettings: {
          autoTrading: false,       // Auto-trading disabled by default
          riskLevel: 'medium',      // Default risk level
          tradingHours: {
            enabled: false,
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
          }
        },
        
        // API keys (placeholders - to be filled by user)
        apiKeys: {
          binance: {
            apiKey: '',
            secretKey: ''
          }
        }
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    await defaultConfig.save();
    console.log('Default configuration created successfully:', defaultConfig.settings);
    return defaultConfig;
  } catch (error) {
    console.error('Error initializing configuration:', error);
    throw error;
  }
}

// Run the initialization
initializeConfig()
  .then(() => {
    console.log('Config initialization complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Config initialization failed:', err);
    process.exit(1);
  });
INIT_CONFIG
echo "✅ Initialization script created"

# Step 5: Create the server update script
echo "Creating server update script..."
cat > update_server.js << 'UPDATE_SERVER'
const fs = require('fs');
const path = require('path');

const serverFilePath = path.join(__dirname, 'server.js');

// Read the contents of server.js
fs.readFile(serverFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading server.js:', err);
    return;
  }

  // Add the import for config routes if it doesn't exist
  if (!data.includes('const configRoutes = require(')) {
    const importLine = 'const configRoutes = require(\'./routes/configRoutes\');\n';
    
    // Find a good place to add the import, after other route imports
    let newData = data;
    
    // Look for other route imports
    const routeImportPattern = /const \w+Routes = require\('\.\/routes\/\w+'\);/g;
    const matches = data.match(routeImportPattern);
    
    if (matches && matches.length > 0) {
      // Add after the last route import
      const lastMatch = matches[matches.length - 1];
      newData = data.replace(lastMatch, `${lastMatch}\n${importLine}`);
    } else {
      // Add near the top of the file
      newData = data.replace(/const express = require\('express'\);/, 
        `const express = require('express');\n${importLine}`);
    }
    
    data = newData;
  }
  
  // Add the route middleware if it doesn't exist
  if (!data.includes('app.use(\'/api/config\'')) {
    const routeLine = 'app.use(\'/api/config\', configRoutes);\n';
    
    // Find a good place to add the route, after other routes
    let newData = data;
    
    // Look for other app.use routes
    const routePattern = /app\.use\('\/api\/[\w-]+',\s*\w+Routes\);/g;
    const matches = data.match(routePattern);
    
    if (matches && matches.length > 0) {
      // Add after the last route
      const lastMatch = matches[matches.length - 1];
      newData = data.replace(lastMatch, `${lastMatch}\n${routeLine}`);
    } else {
      // Add before the server.listen
      newData = data.replace(/const PORT = .*/, 
        `${routeLine}\nconst PORT = `);
    }
    
    data = newData;
  }
  
  // Write the updated content back to server.js
  fs.writeFile(serverFilePath, data, 'utf8', (err) => {
    if (err) {
      console.error('Error writing to server.js:', err);
      return;
    }
    console.log('Successfully updated server.js');
  });
});
UPDATE_SERVER
echo "✅ Server update script created"

# Step 7: Run the update script to add routes to server.js
echo "Updating server.js to include config routes..."
node update_server.js

# Step 8: Initialize the default configuration
echo "Initializing default configuration..."
node debug/initializeConfig.js

echo "===== Configuration System Setup Complete ====="
echo ""
echo "To test the configuration API, follow these steps:"
echo "1. Start your server: npm start"
echo "2. In a separate terminal window, run: node debug/testConfigApi.js"
echo ""
echo "You can now access configuration settings in your application at:"
echo "- GET /api/config/settings (get all settings)"
echo "- GET /api/config/settings/:key (get specific setting)"
echo "- POST /api/config/settings (save all settings)"
echo "- POST /api/config/settings/:key (save specific setting)"
