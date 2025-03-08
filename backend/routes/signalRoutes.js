// routes/signalRoutes.js - API endpoints for trading signals
const express = require('express');
const router = express.Router();
const Signal = require('../models/Signal');

/**
 * @route GET /api/signals
 * @description Get trading signals with filtering options
 */
router.get('/', async (req, res) => {
  try {
    const {
      symbol,
      indicator,
      action,
      userId = 'default',
      startTime,
      endTime,
      limit = 100,
      skip = 0
    } = req.query;
    
    // Build query
    const query = {};
    if (symbol) query.symbol = symbol;
    if (indicator) query.indicator = indicator;
    if (action) query.action = action;
    if (userId) query.userId = userId;
    
    // Time range
    if (startTime || endTime) {
      query.time = {};
      if (startTime) query.time.$gte = parseInt(startTime);
      if (endTime) query.time.$lte = parseInt(endTime);
    }
    
    // Sort, newest first
    const sort = { time: -1 };
    
    const signals = await Signal.find(
      query,
      sort,
      parseInt(limit),
      parseInt(skip)
    );
    
    res.json(signals);
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

/**
 * @route GET /api/signals/recent
 * @description Get recent signals for a symbol and interval
 */
router.get('/recent', async (req, res) => {
  try {
    const {
      symbol,
      interval = '5m',
      userId = 'default',
      limit = 100
    } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    const signals = await Signal.getRecentSignals(
      symbol,
      interval,
      userId,
      parseInt(limit)
    );
    
    res.json(signals);
  } catch (error) {
    console.error('Error fetching recent signals:', error);
    res.status(500).json({ error: 'Failed to fetch recent signals' });
  }
});

/**
 * @route GET /api/signals/:id
 * @description Get a specific signal by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const signal = await Signal.findOne({ _id: id });
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    res.json(signal);
  } catch (error) {
    console.error('Error fetching signal:', error);
    res.status(500).json({ error: 'Failed to fetch signal' });
  }
});

/**
 * @route POST /api/signals
 * @description Create a new signal
 */
router.post('/', async (req, res) => {
  try {
    const { symbol, indicator, action, price, time, userId = 'default', reason, value } = req.body;
    
    if (!symbol || !indicator || !action || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const signal = new Signal({
      symbol,
      indicator,
      action,
      price,
      time: time || Date.now(),
      userId,
      reason,
      value
    });
    
    const savedSignal = await signal.save();
    res.status(201).json(savedSignal);
  } catch (error) {
    console.error('Error creating signal:', error);
    res.status(500).json({ error: 'Failed to create signal' });
  }
});

/**
 * @route DELETE /api/signals/:id
 * @description Delete a specific signal
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const signal = await Signal.findOne({ _id: id });
    
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }
    
    await Signal.remove({ _id: id });
    
    res.json({ success: true, message: 'Signal deleted' });
  } catch (error) {
    console.error('Error deleting signal:', error);
    res.status(500).json({ error: 'Failed to delete signal' });
  }
});

/**
 * @route DELETE /api/signals/cleanup/:days
 * @description Clean up old signals
 */
router.delete('/cleanup/:days', async (req, res) => {
  try {
    const days = parseInt(req.params.days) || 30;
    
    // Convert days to milliseconds
    const olderThan = days * 24 * 60 * 60 * 1000;
    
    const result = await Signal.cleanup(olderThan);
    
    res.json({ 
      success: true, 
      message: `Cleaned up signals older than ${days} days`,
      count: result
    });
  } catch (error) {
    console.error('Error cleaning up signals:', error);
    res.status(500).json({ error: 'Failed to clean up signals' });
  }
});

module.exports = router;