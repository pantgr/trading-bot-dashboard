// models/ActiveBot.js
const mongoose = require('mongoose');

const ActiveBotSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  interval: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    default: 'default'
  },
  active: {
    type: Boolean,
    default: true
  },
  startTime: {
    type: Number,
    default: () => Date.now()
  },
  stopTime: {
    type: Number
  },
  callbackId: {
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

// Compound index for looking up bots by their unique key
ActiveBotSchema.index({ symbol: 1, interval: 1, userId: 1 }, { unique: true });

// Update timestamps on save
ActiveBotSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static methods
ActiveBotSchema.statics.findByKey = async function(symbol, interval, userId = 'default') {
  return this.findOne({
    symbol,
    interval,
    userId
  });
};

ActiveBotSchema.statics.findByUser = async function(userId = 'default') {
  return this.find({ userId });
};

ActiveBotSchema.statics.findActive = async function() {
  return this.find({ active: true });
};

ActiveBotSchema.statics.findActiveBySymbol = async function(symbol) {
  return this.find({ symbol, active: true });
};

ActiveBotSchema.statics.removeByKey = async function(symbol, interval, userId = 'default') {
  try {
    const result = await this.deleteOne({
      symbol,
      interval,
      userId
    });
    return result.deletedCount;
  } catch (error) {
    console.error('Error removing active bot by key:', error);
    throw error;
  }
};

ActiveBotSchema.statics.cleanup = async function(olderThan = 24 * 60 * 60 * 1000) {
  try {
    const cutoffTime = Date.now() - olderThan;
    // Remove bots that haven't been updated in the specified time
    const result = await this.deleteMany({ 
      updatedAt: { $lt: cutoffTime },
      active: false
    });
    
    console.log(`Cleaned up ${result.deletedCount} inactive bots`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up inactive bots:', error);
    throw error;
  }
};

const ActiveBot = mongoose.model('ActiveBot', ActiveBotSchema);
module.exports = ActiveBot;