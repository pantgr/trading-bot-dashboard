// routes/botApiRoutes.js
const express = require('express');
const router = express.Router();
const tradingBot = require('../services/tradingBotService');

/**
 * @route GET /api/bot/status
 * @description Get the current status of the trading bot
 */
router.get('/status', async (req, res) => {
  try {
    console.log('GET /status - Fetching bot status');
    
    const status = await tradingBot.getStatus();
    
    res.json(status);
  } catch (error) {
    console.error('Error fetching bot status:', error);
    res.status(500).json({ error: 'Failed to fetch bot status' });
  }
});

/**
 * @route GET /api/bot/active-symbols
 * @description Get list of active symbols being monitored
 */
router.get('/active-symbols', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    console.log(`GET /active-symbols - Fetching active symbols for user ${userId}`);
    
    const activeSymbols = await tradingBot.getActiveSymbols(userId);
    
    res.json(activeSymbols);
  } catch (error) {
    console.error('Error fetching active symbols:', error);
    res.status(500).json({ error: 'Failed to fetch active symbols' });
  }
});

/**
 * @route POST /api/bot/start
 * @description Start monitoring a trading pair
 */
router.post('/start', async (req, res) => {
  try {
    const { symbol, interval = '5m', userId = 'default' } = req.body;
    console.log(`POST /start - Starting bot for ${symbol} (${interval})`);
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const result = await tradingBot.startMonitoring(symbol, interval, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error starting trading bot:', error);
    res.status(500).json({ error: 'Failed to start trading bot' });
  }
});

/**
 * @route POST /api/bot/stop
 * @description Stop monitoring a trading pair
 */
router.post('/stop', async (req, res) => {
  try {
    const { symbol, interval = '5m', userId = 'default' } = req.body;
    console.log(`POST /stop - Stopping bot for ${symbol} (${interval})`);
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const result = await tradingBot.stopMonitoring(symbol, interval, userId);
    
    res.json({ success: result });
  } catch (error) {
    console.error('Error stopping trading bot:', error);
    res.status(500).json({ error: 'Failed to stop trading bot' });
  }
});

module.exports = router;