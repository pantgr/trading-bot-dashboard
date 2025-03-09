// routes/marketDataRoutes.js - API endpoints for market data
const express = require('express');
const router = express.Router();
const MarketData = require('../models/MarketData');
const binanceService = require('../services/binanceService');

/**
 * @route GET /api/market-data/history/:symbol
 * @description Get historical candlestick data for a symbol
 */
router.get('/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 100 } = req.query;
    
    // First try to get candles from database
    const cachedCandles = await MarketData.getCandles(symbol, interval, parseInt(limit));
    
    // If we have enough candles in the database, use them
    if (cachedCandles.length >= parseInt(limit)) {
      return res.json(cachedCandles);
    }
    
    // Otherwise, fetch from Binance API
    const candles = await binanceService.getHistoricalCandles(
      symbol,
      interval,
      parseInt(limit)
    );
    
    res.json(candles);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

/**
 * @route GET /api/market-data/price/:symbol
 * @description Get current price for a symbol
 */
router.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // First try to get price from database
    const cachedPrice = await MarketData.getLatestPrice(symbol);
    
    // If price exists and is recent (less than 5 minutes old), use it
    if (cachedPrice && (Date.now() - cachedPrice.time < 5 * 60 * 1000)) {
      return res.json({ symbol, price: cachedPrice.price });
    }
    
    // Otherwise, fetch from Binance API
    const price = await binanceService.getCurrentPrice(symbol);
    
    // Save to database for future use
    await MarketData.savePrice(symbol, price);
    
    res.json({ symbol, price });
  } catch (error) {
    console.error('Error fetching current price:', error);
    res.status(500).json({ error: 'Failed to fetch current price' });
  }
});

/**
 * @route GET /api/market-data/pairs
 * @description Get all trading pairs from Binance
 */
router.get('/pairs', async (req, res) => {
  try {
    const pairs = await binanceService.getAllTradingPairs();
    // Filter for active trading pairs only
    const activePairs = pairs.filter(pair => pair.status === 'TRADING');
    res.json(activePairs);
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    res.status(500).json({ error: 'Failed to fetch trading pairs' });
  }
});

/**
 * @route DELETE /api/market-data/cleanup
 * @description Clean up old market data
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const result = await MarketData.cleanup({
      priceDataAge: req.query.priceAge ? parseInt(req.query.priceAge) * 24 * 60 * 60 * 1000 : undefined,
      candleDataAge: req.query.candleAge ? parseInt(req.query.candleAge) * 24 * 60 * 60 * 1000 : undefined
    });
    
    res.json({
      success: true,
      message: 'Market data cleaned up successfully',
      result
    });
  } catch (error) {
    console.error('Error cleaning up market data:', error);
    res.status(500).json({ error: 'Failed to clean up market data' });
  }
});

module.exports = router;