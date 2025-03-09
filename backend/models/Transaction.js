// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'default'
  },
  symbol: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: ['BUY', 'SELL']
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
    type: Number,
    required: true,
    default: () => Date.now()
  },
  signal: {
    type: String,
    default: 'MANUAL'
  },
  valueUSD: {
    type: Number
  },
  valueBTC: {
    type: Number
  },
  btcPrice: {
    type: Number
  },
  uniqueId: {
    type: String
  }
});

// Index for quicker lookups
TransactionSchema.index({ userId: 1, timestamp: -1 });
TransactionSchema.index({ userId: 1, symbol: 1, action: 1 });
TransactionSchema.index({ uniqueId: 1 }, { unique: true, sparse: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);
module.exports = Transaction;
