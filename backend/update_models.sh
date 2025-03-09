#!/bin/bash

# Αποθήκευση του τρέχοντος directory
CURRENT_DIR=$(pwd)
BACKUP_DIR="$CURRENT_DIR/backup_$(date +%Y%m%d_%H%M%S)"

# Δημιουργία backup directory
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Backup των αρχικών αρχείων
[ -f models/MarketData.js ] && cp models/MarketData.js "$BACKUP_DIR/MarketData.js.bak"
[ -f services/binanceService.js ] && cp services/binanceService.js "$BACKUP_DIR/binanceService.js.bak"
[ -f routes/marketDataRoutes.js ] && cp routes/marketDataRoutes.js "$BACKUP_DIR/marketDataRoutes.js.bak"

echo "Creating/Updating files..."

# Δημιουργία των απαραίτητων directories
mkdir -p models services routes

# Ενημέρωση του MarketData.js
cat > models/MarketData.js << 'EOL'
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

const MarketData = mongoose.model('MarketData', MarketDataSchema);
module.exports = MarketData;
EOL

# Ενημέρωση του getAllTradingPairs στο binanceService.js
cat > services/binanceService.js << 'EOL'
const WebSocket = require('ws');
const axios = require('axios');
const MarketData = require('../models/MarketData');

const getAllTradingPairs = async () => {
  try {
    console.log('Fetching trading pairs...');
    
    // Πρώτα έλεγξε για cached δεδομένα
    const cachedPairs = await MarketData.getTradingPairs();
    if (cachedPairs && (Date.now() - new Date(cachedPairs.updatedAt).getTime() < 60 * 60 * 1000)) {
      console.log('Using cached trading pairs');
      return cachedPairs;
    }

    // Αν δεν υπάρχουν cached δεδομένα ή είναι παλιά, πάρε νέα από το Binance
    console.log('Fetching fresh trading pairs from Binance');
    const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    
    // Μορφοποίηση των δεδομένων
    const pairs = response.data.symbols.map(symbol => ({
      symbol: symbol.symbol,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      status: symbol.status
    }));

    // Αποθήκευση στη βάση
    await MarketData.saveTradingPairs(pairs);
    console.log(`Saved ${pairs.length} trading pairs to database`);

    return pairs;
  } catch (error) {
    console.error('Error in getAllTradingPairs:', error);
    throw error;
  }
};

module.exports = {
  getAllTradingPairs
};
EOL

# Ενημέρωση του marketDataRoutes.js
cat > routes/marketDataRoutes.js << 'EOL'
const express = require('express');
const router = express.Router();
const binanceService = require('../services/binanceService');

router.get('/pairs', async (req, res) => {
  try {
    const pairs = await binanceService.getAllTradingPairs();
    // Φιλτράρουμε μόνο τα ενεργά trading pairs
    const activePairs = pairs.filter(pair => pair.status === 'TRADING');
    res.json(activePairs);
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch trading pairs',
      message: error.message 
    });
  }
});

module.exports = router;
EOL

echo "Files have been updated successfully!"
echo ""
echo "Please restart your server to apply changes:"
echo "1. Stop the current server (Ctrl+C)"
echo "2. Start the server again: node server.js"