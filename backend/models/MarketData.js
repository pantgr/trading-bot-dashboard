// models/MarketData.js - Fixed version with all required methods
const mongoose = require('mongoose');

const MarketDataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: function() {
      return this.type !== 'trading_pairs';
    }
  },
  type: {
    type: String,
    required: true,
    enum: ['price', 'candle', 'trading_pairs']
  },
  pairs: [{
    symbol: String,
    baseAsset: String,
    quoteAsset: String,
    status: String
  }],
  interval: String,
  time: {
    type: Number,
    default: () => Date.now()
  },
  price: Number,
  open: Number,
  high: Number,
  low: Number,
  close: Number,
  volume: Number,
  isClosed: Boolean,
  key: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes για καλύτερη απόδοση
MarketDataSchema.index({ type: 1 });
MarketDataSchema.index({ symbol: 1, type: 1 });
MarketDataSchema.index({ updatedAt: -1 });

// Pre-save middleware
MarketDataSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method for saving trading pairs
MarketDataSchema.statics.saveTradingPairs = async function(pairs) {
  try {
    return await this.findOneAndUpdate(
      { type: 'trading_pairs' },
      {
        type: 'trading_pairs',
        pairs: pairs,
        time: Date.now(),
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true 
      }
    );
  } catch (error) {
    console.error('Error saving trading pairs:', error);
    throw error;
  }
};

// Static method for getting trading pairs
MarketDataSchema.statics.getTradingPairs = async function() {
  try {
    const data = await this.findOne({ type: 'trading_pairs' })
      .sort({ updatedAt: -1 })
      .select('pairs updatedAt');
    return data ? data.pairs : null;
  } catch (error) {
    console.error('Error getting trading pairs:', error);
    throw error;
  }
};

// Static method for saving price - ADDED
MarketDataSchema.statics.savePrice = async function(symbol, price) {
  try {
    return await this.findOneAndUpdate(
      { 
        symbol, 
        type: 'price'
      },
      {
        symbol,
        type: 'price',
        price,
        time: Date.now(),
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true 
      }
    );
  } catch (error) {
    console.error('Error saving price:', error);
    throw error;
  }
};

// Static method for getting latest price - ADDED
MarketDataSchema.statics.getLatestPrice = async function(symbol) {
  try {
    return await this.findOne({ 
      symbol, 
      type: 'price' 
    })
    .sort({ time: -1 })
    .limit(1);
  } catch (error) {
    console.error('Error getting latest price:', error);
    throw error;
  }
};

// Static method for saving candle - ADDED
MarketDataSchema.statics.saveCandle = async function(symbol, interval, candle) {
  try {
    // Create a unique key for this candle
    const key = `${symbol}-${interval}-${candle.time}`;
    
    return await this.findOneAndUpdate(
      { 
        key,
        type: 'candle'
      },
      {
        symbol,
        type: 'candle',
        interval,
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        isClosed: candle.isClosed,
        key,
        updatedAt: new Date()
      },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true 
      }
    );
  } catch (error) {
    console.error('Error saving candle:', error);
    throw error;
  }
};

// Static method for getting candles - ADDED
MarketDataSchema.statics.getCandles = async function(symbol, interval, limit = 100) {
  try {
    return await this.find({ 
      symbol, 
      type: 'candle',
      interval
    })
    .sort({ time: 1 })
    .limit(limit);
  } catch (error) {
    console.error('Error getting candles:', error);
    return [];
  }
};

// Static method for cleanup - FIXED
MarketDataSchema.statics.cleanup = async function(options = {}) {
  try {
    const { 
      priceDataAge = 1 * 24 * 60 * 60 * 1000,  // 1 day for price data
      candleDataAge = 7 * 24 * 60 * 60 * 1000  // 7 days for candle data
    } = options;
    
    const now = Date.now();
    
    // Remove old price data
    const priceResult = await this.deleteMany({ 
      type: 'price',
      updatedAt: { $lt: new Date(now - priceDataAge) }
    });
    
    // Remove old candle data
    const candleResult = await this.deleteMany({
      type: 'candle',
      updatedAt: { $lt: new Date(now - candleDataAge) }
    });
    
    console.log(`Cleaned up ${priceResult.deletedCount} price entries and ${candleResult.deletedCount} candle entries`);
    return { 
      priceResult: priceResult.deletedCount, 
      candleResult: candleResult.deletedCount 
    };
  } catch (error) {
    console.error('Error cleaning up market data:', error);
    throw error;
  }
};

const MarketData = mongoose.model('MarketData', MarketDataSchema);
module.exports = MarketData;