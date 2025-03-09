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
