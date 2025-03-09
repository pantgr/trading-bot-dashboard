#!/bin/bash
# Τοποθετήστε αυτό το αρχείο στον φάκελο backend/

echo "=== Script Εφαρμογής Διαδρομών ==="
echo "Αυτό το script θα ενημερώσει το server.js για να καταχωρηθούν οι νέες διαδρομές."

# Έλεγχος για το αν υπάρχουν τα απαραίτητα αρχεία
if [ ! -f "routes/virtualTradeRoutes.js" ]; then
  echo "❌ Σφάλμα: Δεν βρέθηκε το αρχείο routes/virtualTradeRoutes.js"
  exit 1
fi

if [ ! -f "routes/botApiRoutes.js" ]; then
  echo "❌ Σφάλμα: Δεν βρέθηκε το αρχείο routes/botApiRoutes.js"
  exit 1
fi

# Δημιουργία του register-routes.js αν δεν υπάρχει
cat > register-routes.js << 'EOL'
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
EOL

echo "✅ Δημιουργήθηκε το αρχείο register-routes.js"

# Δημιουργία αντιγράφου ασφαλείας του server.js
cp server.js server.js.backup
echo "✅ Δημιουργήθηκε αντίγραφο ασφαλείας του server.js στο server.js.backup"

# Δημιουργία του νέου main-server.js που θα χρησιμοποιήσουμε
cat > main-server.js << 'EOL'
// main-server.js - Νέο αρχείο εκκίνησης που χρησιμοποιεί το υπάρχον server.js
// Φορτώνουμε το κανονικό server.js μέσω require
const serverModule = require('./server');

// Έλεγχος αν έχει ήδη ξεκινήσει ο server
// Αν όχι, θα ξεκινήσει από μόνος του
EOL

echo "✅ Δημιουργήθηκε το αρχείο main-server.js"

# Δημιουργία του bind-routes.js που θα συνδέσει τις διαδρομές
cat > bind-routes.js << 'EOL'
// bind-routes.js - Βοηθητικό script που συνδέει τις διαδρομές με το Express
// Εισαγωγή του Express
const express = require('express');
const app = express();

// Εισαγωγή του registerAdditionalRoutes
const registerAdditionalRoutes = require('./register-routes');

// Καταχώρηση των επιπλέον διαδρομών
module.exports = function(existingApp) {
  // Αν δοθεί υπάρχουσα εφαρμογή Express, χρησιμοποιούμε αυτή
  const appToUse = existingApp || app;
  
  // Καταχώρηση των διαδρομών
  registerAdditionalRoutes(appToUse);
  
  // Δοκιμαστική διαδρομή για επαλήθευση
  appToUse.get('/api/test-routes', (req, res) => {
    res.json({
      status: 'ok',
      message: 'Routes successfully bound'
    });
  });
  
  return appToUse;
};
EOL

echo "✅ Δημιουργήθηκε το αρχείο bind-routes.js"

# Τώρα, προσθέτουμε την πρόσθετη γραμμή στο server.js
# Αναζητούμε τις διαδρομές και προσθέτουμε τις νέες μετά από αυτές
if grep -q "app.use('/api/admin', adminRoutes)" server.js; then
  # Βρέθηκε η γραμμή, προσθέτουμε το νέο κώδικα μετά από αυτήν
  sed -i '/app.use('"'"'\/api\/admin'"'"', adminRoutes);/a \
  \n  // Εφαρμογή επιπλέον διαδρομών\n  try {\n    const registerAdditionalRoutes = require('"'"'./register-routes'"'"');\n    registerAdditionalRoutes(app);\n    console.log('"'"'Successfully registered additional routes'"'"');\n  } catch (error) {\n    console.error('"'"'Failed to register additional routes:'"'"', error);\n  }' server.js
  
  echo "✅ Προστέθηκε ο κώδικας καταχώρησης επιπλέον διαδρομών στο server.js"
else
  echo "⚠️ Δεν βρέθηκε η γραμμή με το adminRoutes για αυτόματη προσθήκη."
  echo "Θα χρειαστεί να προσθέσετε χειροκίνητα τον κώδικα στο server.js."
  
  # Δημιουργία ξεχωριστού αρχείου με τις οδηγίες
  cat > add-routes-manually.txt << 'EOL'
Για να προσθέσετε τις διαδρομές χειροκίνητα, ανοίξτε το αρχείο server.js και προσθέστε τον παρακάτω κώδικα
μετά από το σημείο όπου καταχωρούνται οι υπόλοιπες διαδρομές (π.χ. μετά από το app.use('/api/admin', adminRoutes);):

// Εφαρμογή επιπλέον διαδρομών
try {
  const registerAdditionalRoutes = require('./register-routes');
  registerAdditionalRoutes(app);
  console.log('Successfully registered additional routes');
} catch (error) {
  console.error('Failed to register additional routes:', error);
}
EOL
  
  echo "✅ Δημιουργήθηκε το αρχείο add-routes-manually.txt με οδηγίες για χειροκίνητη προσθήκη."
fi

echo "=== Ολοκλήρωση εφαρμογής διαδρομών ==="
echo "Μπορείτε τώρα να επανεκκινήσετε τον server με την εντολή:"
echo "node server.js"
echo "Ή να χρησιμοποιήσετε το εναλλακτικό αρχείο (αν χρειαστεί):"
echo "node main-server.js"
echo ""
echo "Αν αντιμετωπίσετε προβλήματα, μπορείτε να επαναφέρετε το server.js από το αντίγραφο ασφαλείας:"
echo "cp server.js.backup server.js"
