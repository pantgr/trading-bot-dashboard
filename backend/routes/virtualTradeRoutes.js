// routes/virtualTradeRoutes.js
const express = require('express');
const router = express.Router();
const virtualTradingService = require('../services/virtualTrading');

/**
 * @route GET /api/virtual-trade/portfolio
 * @description Get user portfolio
 */
router.get('/portfolio', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    console.log(`GET /portfolio - Fetching portfolio for user ${userId}`);
    
    const portfolio = await virtualTradingService.getPortfolio(userId);
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

/**
 * @route GET /api/virtual-trade/history
 * @description Get transaction history
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    console.log(`GET /history - Fetching transaction history for user ${userId}`);
    
    const history = await virtualTradingService.getTransactionHistory(userId);
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

/**
 * @route POST /api/virtual-trade/execute
 * @description Execute a trade
 */
router.post('/execute', async (req, res) => {
  try {
    const { symbol, action, quantity, price, userId = 'default' } = req.body;
    console.log(`POST /execute - Executing ${action} trade for ${symbol}`);
    
    if (!symbol || !action || !quantity || !price) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    if (action !== 'BUY' && action !== 'SELL') {
      return res.status(400).json({ error: 'Invalid action. Must be BUY or SELL' });
    }
    
    const result = await virtualTradingService.manualTrade({
      userId,
      symbol,
      action,
      quantity: parseFloat(quantity),
      price: parseFloat(price)
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error executing trade:', error);
    res.status(500).json({ error: error.message || 'Failed to execute trade' });
  }
});

/**
 * @route POST /api/virtual-trade/update-prices
 * @description Update all current prices in portfolio
 */
router.post('/update-prices', async (req, res) => {
  try {
    const userId = req.body.userId || 'default';
    console.log(`POST /update-prices - Updating portfolio prices for user ${userId}`);
    
    const portfolio = await virtualTradingService.updatePortfolioPrices(userId);
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error updating portfolio prices:', error);
    res.status(500).json({ error: 'Failed to update portfolio prices' });
  }
});

module.exports = router;