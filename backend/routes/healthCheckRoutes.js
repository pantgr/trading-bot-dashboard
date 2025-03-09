// routes/healthCheckRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * @route GET /api/health
 * @description Get server health status
 */
router.get('/', async (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    message: 'Server is running'
  };

  // Check MongoDB connection more thoroughly
  if (mongoose.connection.readyState === 1) {
    try {
      // Try a simple find operation
      await mongoose.connection.db.admin().ping();
      status.mongodb = 'connected';
    } catch (err) {
      status.mongodb = 'error';
      status.mongodb_error = err.message;
      status.status = 'error';
    }
  } else {
    status.status = 'error';
    status.mongodb_states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    status.current_state = mongoose.connection.readyState;
  }

  // Check Socket.io status
  if (global.io) {
    status.socket = {
      status: 'ok',
      connected_clients: Object.keys(global.io.sockets.sockets || {}).length || 0
    };
  } else {
    status.socket = 'not_initialized';
  }

  // Return appropriate status code
  if (status.status === 'ok') {
    res.json(status);
  } else {
    res.status(500).json(status);
  }
});

module.exports = router;