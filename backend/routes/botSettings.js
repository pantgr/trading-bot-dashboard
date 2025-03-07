// backend/routes/botSettings.js
const express = require('express');
const router = express.Router();
const consensusService = require('../services/consensusService');
const tradingBot = require('../services/tradingBotService');

// Αποθήκευση των ρυθμίσεων στη μνήμη (θα μπορούσε να αποθηκευτεί στη βάση δεδομένων)
let botSettings = {
  signalScores: { ...consensusService.SIGNAL_SCORES },
  thresholds: {
    BUY_THRESHOLD: consensusService.BUY_THRESHOLD,
    SELL_THRESHOLD: consensusService.SELL_THRESHOLD,
    TIME_WINDOW_MS: consensusService.TIME_WINDOW_MS
  },
  indicators: {
    RSI_PERIOD: 14,
    EMA_SHORT_PERIOD: 9,
    EMA_LONG_PERIOD: 21,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD_DEV: 2
  },
  moneyManagement: {
    BUY_AMOUNT_PERCENTAGE: 10,
    SELL_AMOUNT_PERCENTAGE: 25
  }
};

// GET /api/bot/settings
router.get('/settings', (req, res) => {
  try {
    console.log('Returning bot settings:', botSettings);
    res.json(botSettings);
  } catch (error) {
    console.error('Error fetching bot settings:', error);
    res.status(500).json({ error: 'Failed to fetch bot settings' });
  }
});

// POST /api/bot/settings
router.post('/settings', (req, res) => {
  try {
    const { signalScores, thresholds, indicators, moneyManagement } = req.body;

    // Έλεγχος και ενημέρωση των ρυθμίσεων
    if (signalScores) {
      botSettings.signalScores = { ...botSettings.signalScores, ...signalScores };
      
      // Ενημέρωση των τιμών στο consensus service
      Object.keys(signalScores).forEach(key => {
        consensusService.SIGNAL_SCORES[key] = signalScores[key];
      });
    }

    if (thresholds) {
      botSettings.thresholds = { ...botSettings.thresholds, ...thresholds };
      
      // Ενημέρωση των ορίων στο consensus service
      if (thresholds.BUY_THRESHOLD !== undefined) {
        consensusService.BUY_THRESHOLD = thresholds.BUY_THRESHOLD;
      }
      
      if (thresholds.SELL_THRESHOLD !== undefined) {
        consensusService.SELL_THRESHOLD = thresholds.SELL_THRESHOLD;
      }
      
      if (thresholds.TIME_WINDOW_MS !== undefined) {
        consensusService.TIME_WINDOW_MS = thresholds.TIME_WINDOW_MS;
      }
    }

    if (indicators) {
      botSettings.indicators = { ...botSettings.indicators, ...indicators };
      
      // Εδώ θα μπορούσαμε να ενημερώσουμε τις παραμέτρους των δεικτών
      // Αυτό θα απαιτούσε τροποποιήσεις στα αντίστοιχα services
    }

    if (moneyManagement) {
      botSettings.moneyManagement = { ...botSettings.moneyManagement, ...moneyManagement };
      
      // Ενημέρωση των παραμέτρων διαχείρισης κεφαλαίου
      // Αυτό θα απαιτούσε πρόσβαση στην υπηρεσία virtualTrading
    }

    console.log('Bot settings updated:', botSettings);
    
    // Ενημέρωση των ενεργών bot για τις αλλαγές ρυθμίσεων
    tradingBot.emit('settings_updated', botSettings);
    
    res.json({ success: true, settings: botSettings });
  } catch (error) {
    console.error('Error updating bot settings:', error);
    res.status(500).json({ error: 'Failed to update bot settings' });
  }
});

module.exports = router;