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
