const express = require('express');
const router = express.Router();
const marketDataService = require('../services/marketData');

// GET /api/market-data/historical/:symbol
router.get('/historical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval, limit } = req.query;
    
    const data = await marketDataService.getHistoricalData(
      symbol, 
      interval || '1h', 
      parseInt(limit) || 100
    );
    
    res.json(data);
  } catch (error) {
    console.error('Error in /historical endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

// GET /api/market-data/price/:symbol
router.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const price = await marketDataService.getCurrentPrice(symbol);
    
    res.json({ symbol, price });
  } catch (error) {
    console.error('Error in /price endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch current price' });
  }
});

module.exports = router;
