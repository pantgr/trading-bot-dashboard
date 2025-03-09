// models/Signal.js
const mongoose = require('mongoose');

const SignalSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: 'default'
  },
  symbol: {
    type: String,
    required: true
  },
  time: {
    type: Number,
    required: true,
    default: () => Date.now()
  },
  indicator: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
  },
  price: {
    type: Number,
    required: true
  },
  value: {
    type: String
  },
  reason: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster querying
SignalSchema.index({ time: -1 });
SignalSchema.index({ symbol: 1 });
SignalSchema.index({ userId: 1 });
SignalSchema.index({ symbol: 1, time: -1 });

// Static methods
SignalSchema.statics.getRecentSignals = async function(symbol, interval, userId = 'default', limit = 100) {
  try {
    // Get recent signals for the specified symbol and user
    const query = {
      symbol,
      userId
    };
    
    // Find signals within the window of the specified interval
    let timeWindow = 3600000; // Default 1 hour
    
    switch (interval) {
      case '1m':
        timeWindow = 60000; // 1 minute
        break;
      case '5m':
        timeWindow = 300000; // 5 minutes
        break;
      case '15m':
        timeWindow = 900000; // 15 minutes
        break;
      case '30m':
        timeWindow = 1800000; // 30 minutes
        break;
      case '1h':
        timeWindow = 3600000; // 1 hour
        break;
      case '4h':
        timeWindow = 14400000; // 4 hours
        break;
      case '1d':
        timeWindow = 86400000; // 1 day
        break;
    }
    
    const startTime = Date.now() - timeWindow;
    query.time = { $gte: startTime };
    
    return await this.find(query).sort({ time: -1 }).limit(limit);
  } catch (error) {
    console.error('Error getting recent signals:', error);
    return [];
  }
};

SignalSchema.statics.cleanup = async function(olderThan = 30 * 24 * 60 * 60 * 1000) {
  try {
    const cutoffTime = Date.now() - olderThan;
    const result = await this.deleteMany({ time: { $lt: cutoffTime } });
    console.log(`Cleaned up ${result.deletedCount} old signals`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up old signals:', error);
    throw error;
  }
};

const Signal = mongoose.model('Signal', SignalSchema);
module.exports = Signal;