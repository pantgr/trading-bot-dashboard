const express = require('express');
const router = express.Router();
const binanceService = require('../services/binanceService');

router.get('/pairs', async (req, res) => {
  try {
    const pairs = await binanceService.getAllTradingPairs();
    // Φιλτράρουμε μόνο τα ενεργά trading pairs
    const activePairs = pairs.filter(pair => pair.status === 'TRADING');
    res.json(activePairs);
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trading pairs',
      message: error.message 
    });
  }
});

module.exports = router;
