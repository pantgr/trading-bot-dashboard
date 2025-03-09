// models/Portfolio.js
const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  averagePrice: {
    type: Number,
    required: true,
    default: 0
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  btcPrice: {
    type: Number,
    default: 0
  }
});

const PortfolioSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  balance: {
    type: Number,
    required: true,
    default: 10000
  },
  assets: {
    type: [AssetSchema],
    default: []
  },
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

// Update timestamps on save
PortfolioSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Portfolio = mongoose.model('Portfolio', PortfolioSchema);
module.exports = Portfolio;