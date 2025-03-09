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
