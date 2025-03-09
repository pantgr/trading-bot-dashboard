// models/MarketData.js - Διορθωμένο με τη μέθοδο cleanup
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

// Static method για trading pairs
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

// Static method για να πάρουμε τα trading pairs
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

// Προσθήκη της μεθόδου cleanup που λείπει
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