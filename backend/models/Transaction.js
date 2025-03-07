const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  symbol: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  signal: {
    type: String,
    default: 'MANUAL'
  }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
