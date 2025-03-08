// botConfigService.js - Service for managing bot configuration settings
const configService = require('./configService');
const binanceService = require('./binanceService');

/**
 * Service for managing bot configuration
 */
class BotConfigService {
  /**
   * Get bot trading parameters
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Trading parameters
   */
  async getTradingParams(userId = 'default') {
    try {
      const tradingParams = await configService.getSetting('tradingParams', userId);
      
      // Return default parameters if none are found
      if (!tradingParams) {
        return {
          investmentAmount: 0.1, // Default 10% of balance
          stopLoss: 0.05,        // Default 5% stop loss
          takeProfit: 0.15,      // Default 15% take profit
          maxActiveTrades: 5,    // Default max 5 active trades
          indicators: ['RSI', 'MACD', 'MA']  // Default indicators
        };
      }
      
      return tradingParams;
    } catch (error) {
      console.error('Error getting trading parameters:', error);
      throw error;
    }
  }
  
  /**
   * Save bot trading parameters
   * @param {object} params - Trading parameters
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Updated trading parameters
   */
  async saveTradingParams(params, userId = 'default') {
    try {
      const currentParams = await this.getTradingParams(userId);
      const updatedParams = { ...currentParams, ...params };
      
      return await configService.saveSetting('tradingParams', updatedParams, userId);
    } catch (error) {
      console.error('Error saving trading parameters:', error);
      throw error;
    }
  }
  
  /**
   * Get API keys
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - API keys
   */
  async getApiKeys(userId = 'default') {
    try {
      const apiKeys = await configService.getSetting('apiKeys', userId);
      
      // Return empty keys if none are found
      if (!apiKeys) {
        return {
          binance: {
            apiKey: '',
            secretKey: ''
          }
        };
      }
      
      return apiKeys;
    } catch (error) {
      console.error('Error getting API keys:', error);
      throw error;
    }
  }
  
  /**
   * Save API keys
   * @param {object} keys - API keys
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Updated API keys
   */
  async saveApiKeys(keys, userId = 'default') {
    try {
      const currentKeys = await this.getApiKeys(userId);
      const updatedKeys = { ...currentKeys, ...keys };
      
      // Validate Binance API keys if provided
      if (keys.binance && keys.binance.apiKey && keys.binance.secretKey) {
        try {
          // Test API connection
          await binanceService.testConnection(keys.binance.apiKey, keys.binance.secretKey);
          console.log('Binance API keys validated successfully');
        } catch (validationError) {
          console.error('Invalid Binance API keys:', validationError.message);
          throw new Error('Invalid Binance API keys: ' + validationError.message);
        }
      }
      
      return await configService.saveSetting('apiKeys', updatedKeys, userId);
    } catch (error) {
      console.error('Error saving API keys:', error);
      throw error;
    }
  }
  
  /**
   * Get bot settings
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Bot settings
   */
  async getBotSettings(userId = 'default') {
    try {
      const botSettings = await configService.getSetting('botSettings', userId);
      
      // Return default settings if none are found
      if (!botSettings) {
        return {
          autoTrading: false,
          riskLevel: 'medium',
          tradingHours: {
            enabled: false,
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
          }
        };
      }
      
      return botSettings;
    } catch (error) {
      console.error('Error getting bot settings:', error);
      throw error;
    }
  }
  
  /**
   * Save bot settings
   * @param {object} settings - Bot settings
   * @param {string} userId - User identifier
   * @returns {Promise<object>} - Updated bot settings
   */
  async saveBotSettings(settings, userId = 'default') {
    try {
      const currentSettings = await this.getBotSettings(userId);
      const updatedSettings = { ...currentSettings, ...settings };
      
      return await configService.saveSetting('botSettings', updatedSettings, userId);
    } catch (error) {
      console.error('Error saving bot settings:', error);
      throw error;
    }
  }
}

module.exports = new BotConfigService();
