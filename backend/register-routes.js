// register-routes.js
// Τοποθετήστε αυτό το αρχείο στον φάκελο backend/

// Εισάγουμε τις απαραίτητες διαδρομές
let virtualTradeRoutes = null;
let botApiRoutes = null;

try {
  virtualTradeRoutes = require('./routes/virtualTradeRoutes');
  console.log('✅ Φορτώθηκαν επιτυχώς οι διαδρομές virtual-trade');
} catch (err) {
  console.error('❌ Σφάλμα φόρτωσης virtualTradeRoutes:', err.message);
}

try {
  botApiRoutes = require('./routes/botApiRoutes');
  console.log('✅ Φορτώθηκαν επιτυχώς οι διαδρομές bot-api');
} catch (err) {
  console.error('❌ Σφάλμα φόρτωσης botApiRoutes:', err.message);
}

/**
 * Καταχωρεί επιπλέον διαδρομές στην εφαρμογή Express
 * @param {Object} app - Το αντικείμενο της εφαρμογής Express
 * @returns {Object} Η ίδια εφαρμογή με τις νέες διαδρομές
 */
function registerAdditionalRoutes(app) {
  console.log('\n=== Καταχώρηση Επιπλέον Διαδρομών ===');
  
  if (virtualTradeRoutes) {
    app.use('/api/virtual-trade', virtualTradeRoutes);
    console.log('✅ Καταχωρήθηκαν οι διαδρομές virtual-trade στο /api/virtual-trade');
  } else {
    console.warn('⚠️ Δεν καταχωρήθηκαν οι διαδρομές virtual-trade (δεν φορτώθηκαν)');
  }
  
  if (botApiRoutes) {
    app.use('/api/bot', botApiRoutes);
    console.log('✅ Καταχωρήθηκαν οι διαδρομές bot-api στο /api/bot');
  } else {
    console.warn('⚠️ Δεν καταχωρήθηκαν οι διαδρομές bot-api (δεν φορτώθηκαν)');
  }
  
  console.log('=== Ολοκλήρωση Καταχώρησης Διαδρομών ===\n');
  
  return app;
}

module.exports = registerAdditionalRoutes;
