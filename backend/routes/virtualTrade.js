const express = require('express');
const router = express.Router();
const virtualTradingService = require('../services/virtualTrading');

// GET /api/virtual-trade/portfolio
router.get('/portfolio', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const portfolio = await virtualTradingService.getPortfolio(userId);
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error in /portfolio endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// GET /api/virtual-trade/history
router.get('/history', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const history = await virtualTradingService.getTransactionHistory(userId);
    
    res.json(history);
  } catch (error) {
    console.error('Error in /history endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch transaction history' });
  }
});

// POST /api/virtual-trade/execute
router.post('/execute', async (req, res) => {
  try {
    const { userId = 'default', symbol, action, quantity, price } = req.body;
    
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
    console.error('Error in /execute endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to execute trade' });
  }
});

module.exports = router;
