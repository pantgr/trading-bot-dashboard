// models/MarketData.js
const mongoose = require('mongoose');

const MarketDataSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['price', 'candle', 'trading_pairs']
  },
  interval: {
    type: String
  },
  time: {
    type: Number,
    default: () => Date.now()
  },
  price: {
    type: Number
  },
  // Candle data
  open: {
    type: Number
  },
  high: {
    type: Number
  },
  low: {
    type: Number
  },
  close: {
    type: Number
  },
  volume: {
    type: Number
  },
  isClosed: {
    type: Boolean
  },
  // Trading pairs data
  pairs: {
    type: Array
  },
  // Common fields
  key: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for faster querying
MarketDataSchema.index({ symbol: 1 });
MarketDataSchema.index({ type: 1 });
MarketDataSchema.index({ time: -1 });
MarketDataSchema.index({ key: 1 }, { unique: true, sparse: true });

// Generate a unique key for this market data
MarketDataSchema.methods.generateKey = function() {
  const parts = [this.symbol, this.type];
  
  if (this.interval) {
    parts.push(this.interval);
  }
  
  if (this.time) {
    // Round time to the nearest minute for candles
    if (this.type === 'candle' && this.interval) {
      let roundingFactor = 60000; // 1 minute in ms
      
      switch (this.interval) {
        case '1m': roundingFactor = 60000; break;
        case '5m': roundingFactor = 300000; break;
        case '15m': roundingFactor = 900000; break;
        case '30m': roundingFactor = 1800000; break;
        case '1h': roundingFactor = 3600000; break;
        case '4h': roundingFactor = 14400000; break;
        case '1d': roundingFactor = 86400000; break;
      }
      
      const roundedTime = Math.floor(this.time / roundingFactor) * roundingFactor;
      parts.push(roundedTime.toString());
    } else {
      parts.push(this.time.toString());
    }
  }
  
  return parts.join('-');
};

// Update key and timestamps before saving
MarketDataSchema.pre('save', function(next) {
  this.key = this.generateKey();
  this.updatedAt = Date.now();
  next();
});

// Static methods
MarketDataSchema.statics.savePrice = async function(symbol, price) {
  try {
    const key = `${symbol}-price-${Date.now()}`;
    
    // Use findOneAndUpdate with upsert to avoid duplicates
    const data = await this.findOneAndUpdate(
      { symbol, type: 'price', key },
      {
        symbol,
        type: 'price',
        price,
        time: Date.now(),
        key,
        updatedAt: Date.now()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    return data;
  } catch (error) {
    console.error('Error saving price data:', error);
    throw error;
  }
};

MarketDataSchema.statics.getLatestPrice = async function(symbol) {
  try {
    return await this.findOne({ 
      symbol, 
      type: 'price' 
    }).sort({ time: -1 });
  } catch (error) {
    console.error('Error getting latest price:', error);
    return null;
  }
};

MarketDataSchema.statics.saveCandle = async function(symbol, interval, candle) {
  try {
    const time = candle.time;
    const roundingFactor = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '30m': 1800000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000
    }[interval] || 60000;
    
    const roundedTime = Math.floor(time / roundingFactor) * roundingFactor;
    const key = `${symbol}-candle-${interval}-${roundedTime}`;
    
    // Use findOneAndUpdate with upsert
    const data = await this.findOneAndUpdate(
      { key },
      {
        symbol,
        type: 'candle',
        interval,
        time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        isClosed: candle.isClosed,
        key,
        updatedAt: Date.now()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    return data;
  } catch (error) {
    console.error('Error saving candle data:', error);
    throw error;
  }
};

MarketDataSchema.statics.getCandles = async function(symbol, interval, limit = 100) {
  try {
    return await this.find({ 
      symbol, 
      type: 'candle',
      interval
    }).sort({ time: 1 }).limit(limit);
  } catch (error) {
    console.error('Error getting candles:', error);
    return [];
  }
};

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
      updatedAt: { $lt: now - priceDataAge }
    });
    
    // Remove old candle data
    const candleResult = await this.deleteMany({
      type: 'candle',
      updatedAt: { $lt: now - candleDataAge }
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