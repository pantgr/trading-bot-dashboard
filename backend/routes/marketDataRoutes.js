// routes/marketDataRoutes.js - Unified API endpoints for market data
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
    console.log(`GET /price/${symbol} - Fetching current price`);
    
    // First try to get price from database
    let price = null;
    try {
      const cachedPrice = await MarketData.getLatestPrice(symbol);
      
      // If price exists and is recent (less than 5 minutes old), use it
      if (cachedPrice && cachedPrice.price && (Date.now() - cachedPrice.time < 5 * 60 * 1000)) {
        price = cachedPrice.price;
        console.log(`Using cached price for ${symbol}: ${price}`);
      }
    } catch (dbError) {
      console.error(`Error getting price from database: ${dbError.message}`);
    }
    
    // If we couldn't get the price from the database, fetch from Binance API
    if (!price) {
      console.log(`Fetching fresh price for ${symbol} from Binance API`);
      price = await binanceService.getCurrentPrice(symbol);
      
      // Save to database for future use
      try {
        await MarketData.savePrice(symbol, price);
      } catch (saveError) {
        console.error(`Error saving price to database: ${saveError.message}`);
      }
    }
    
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
    console.log('GET /pairs - Fetching trading pairs');
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
 * @route GET /api/market-data/historical/:symbol
 * @description Alias for /history/:symbol for backward compatibility
 */
router.get('/historical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 100 } = req.query;
    
    console.log(`GET /historical/${symbol} - Fetching historical data`);
    
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
 * @route DELETE /api/market-data/cleanup
 * @description Clean up old market data
 */
router.delete('/cleanup', async (req, res) => {
  try {
    console.log('DELETE /cleanup - Cleaning up old market data');
    
    if (typeof MarketData.cleanup !== 'function') {
      return res.status(501).json({ 
        error: 'Cleanup method not implemented',
        message: 'The MarketData model does not have a cleanup method'
      });
    }
    
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