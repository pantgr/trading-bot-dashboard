// botConfigRoutes.js - Routes for bot configuration
const express = require('express');
const router = express.Router();
const botConfigService = require('../services/botConfigService');

/**
 * @route GET /api/bot/trading-params
 * @description Get trading parameters
 */
router.get('/trading-params', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const params = await botConfigService.getTradingParams(userId);
    
    res.json(params);
  } catch (error) {
    console.error('Error getting trading parameters:', error);
    res.status(500).json({ error: 'Failed to fetch trading parameters' });
  }
});

/**
 * @route POST /api/bot/trading-params
 * @description Save trading parameters
 */
router.post('/trading-params', async (req, res) => {
  try {
    const { params } = req.body;
    const userId = req.body.userId || 'default';
    
    if (!params || typeof params !== 'object') {
      return res.status(400).json({ error: 'Invalid parameters format' });
    }
    
    const updatedParams = await botConfigService.saveTradingParams(params, userId);
    res.json(updatedParams);
  } catch (error) {
    console.error('Error saving trading parameters:', error);
    res.status(500).json({ error: 'Failed to save trading parameters' });
  }
});

/**
 * @route GET /api/bot/settings
 * @description Get bot settings
 */
router.get('/settings', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const settings = await botConfigService.getBotSettings(userId);
    
    res.json(settings);
  } catch (error) {
    console.error('Error getting bot settings:', error);
    res.status(500).json({ error: 'Failed to fetch bot settings' });
  }
});

/**
 * @route POST /api/bot/settings
 * @description Save bot settings
 */
router.post('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    const userId = req.body.userId || 'default';
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings format' });
    }
    
    const updatedSettings = await botConfigService.saveBotSettings(settings, userId);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error saving bot settings:', error);
    res.status(500).json({ error: 'Failed to save bot settings' });
  }
});

/**
 * @route GET /api/bot/api-keys
 * @description Get API keys
 */
router.get('/api-keys', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const keys = await botConfigService.getApiKeys(userId);
    
    // For security, don't return the actual secret key
    const sanitizedKeys = {
      binance: {
        apiKey: keys.binance?.apiKey || '',
        hasSecret: Boolean(keys.binance?.secretKey)
      }
    };
    
    res.json(sanitizedKeys);
  } catch (error) {
    console.error('Error getting API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

/**
 * @route POST /api/bot/api-keys
 * @description Save API keys
 */
router.post('/api-keys', async (req, res) => {
  try {
    const { keys } = req.body;
    const userId = req.body.userId || 'default';
    
    if (!keys || typeof keys !== 'object') {
      return res.status(400).json({ error: 'Invalid keys format' });
    }
    
    const updatedKeys = await botConfigService.saveApiKeys(keys, userId);
    
    // For security, don't return the actual secret key
    const sanitizedKeys = {
      binance: {
        apiKey: updatedKeys.binance?.apiKey || '',
        hasSecret: Boolean(updatedKeys.binance?.secretKey)
      }
    };
    
    res.json(sanitizedKeys);
  } catch (error) {
    console.error('Error saving API keys:', error);
    res.status(500).json({ error: error.message || 'Failed to save API keys' });
  }
});

module.exports = router;
