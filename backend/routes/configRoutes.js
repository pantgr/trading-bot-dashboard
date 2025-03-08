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
