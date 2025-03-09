// models/Config.js
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
module.exports = Config;