const mongoose = require('mongoose');

const PortfolioSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  balance: {
    type: Number,
    required: true,
    default: 10000
  },
  assets: [{
    symbol: String,
    quantity: Number,
    averagePrice: Number,
    currentPrice: Number
  }],
  equity: {
    type: Number,
    required: true,
    default: 10000
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

module.exports = mongoose.model('Portfolio', PortfolioSchema);
