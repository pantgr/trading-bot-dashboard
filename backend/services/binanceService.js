// services/binanceService.js
const WebSocket = require('ws');
const axios = require('axios');

// Map για διαχείριση των συνδέσεων WebSocket
const wsConnections = new Map();
// Cache για τις τελευταίες τιμές
const priceCache = new Map();
// Cache για ιστορικά δεδομένα κεριών
const candleCache = new Map();

// Λήψη ιστορικών δεδομένων τιμών από το Binance API
const getHistoricalCandles = async (symbol, interval = '1h', limit = 100) => {
  try {
    const formattedSymbol = symbol.toUpperCase();
    console.log(`Fetching historical candles for ${formattedSymbol}, interval: ${interval}, limit: ${limit}`);
    
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: formattedSymbol,
        interval,
        limit
      }
    });

    // Μετατροπή σε format κατάλληλο για τεχνική ανάλυση
    const candles = response.data.map(candle => ({
      time: candle[0], // Timestamp ανοίγματος
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));

    // Αποθήκευση στο cache
    candleCache.set(`${formattedSymbol}-${interval}`, candles);
    
    // Ενημέρωση της τελευταίας τιμής
    if (candles.length > 0) {
      priceCache.set(formattedSymbol, candles[candles.length - 1].close);
    }
    
    console.log(`Received ${candles.length} historical candles for ${formattedSymbol}`);
    return candles;
  } catch (error) {
    console.error(`Error fetching historical candles for ${symbol}:`, error.message);
    throw error;
  }
};

// Σύνδεση με Binance WebSocket για κεριά σε πραγματικό χρόνο
const subscribeToCandleUpdates = (symbol, interval, callback) => {
  const formattedSymbol = symbol.toLowerCase();
  const wsKey = `${formattedSymbol}-${interval}`;
  
  // Αν υπάρχει ήδη ενεργή σύνδεση, προσθέτουμε τον callback
  if (wsConnections.has(wsKey)) {
    const connection = wsConnections.get(wsKey);
    connection.callbacks.push(callback);
    console.log(`Added new callback for ${wsKey}, total callbacks: ${connection.callbacks.length}`);
    return;
  }
  
  // Σύνδεση με το Binance WebSocket
  console.log(`Creating new WebSocket connection for ${wsKey}`);
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${formattedSymbol}@kline_${interval}`);
  
  const connection = {
    ws,
    callbacks: [callback],
    isActive: true
  };
  
  wsConnections.set(wsKey, connection);
  
  ws.on('open', () => {
    console.log(`WebSocket connection opened for ${wsKey}`);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      const kline = message.k;
      
      // Κεριά που είναι κλειστά (ολοκληρωμένα)
      const candle = {
        symbol: message.s,
        time: kline.t,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
        isClosed: kline.x
      };
      
      // Ενημέρωση της τελευταίας τιμής στο cache
      priceCache.set(message.s, candle.close);
      
      // Ενημέρωση του candleCache με το νέο κερί αν έχει κλείσει
      if (candle.isClosed) {
        const cacheKey = `${message.s}-${interval}`;
        if (candleCache.has(cacheKey)) {
          const candles = candleCache.get(cacheKey);
          candles.push(candle);
          // Διατήρηση των τελευταίων 500 κεριών
          if (candles.length > 500) {
            candles.shift();
          }
        }
      }
      
      // Κλήση όλων των callbacks με τα νέα δεδομένα
      connection.callbacks.forEach(cb => cb(candle));
    } catch (error) {
      console.error(`Error processing WebSocket message for ${wsKey}:`, error);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${wsKey}:`, error);
  });
  
  ws.on('close', () => {
    console.log(`WebSocket connection closed for ${wsKey}`);
    connection.isActive = false;
    
    // Επανασύνδεση μετά από 5 δευτερόλεπτα
    setTimeout(() => {
      if (wsConnections.has(wsKey) && !wsConnections.get(wsKey).isActive) {
        console.log(`Attempting to reconnect WebSocket for ${wsKey}`);
        wsConnections.delete(wsKey);
        if (connection.callbacks.length > 0) {
          subscribeToCandleUpdates(symbol, interval, connection.callbacks[0]);
          
          // Προσθήκη των υπολοίπων callbacks
          for (let i = 1; i < connection.callbacks.length; i++) {
            const existingConnection = wsConnections.get(wsKey);
            existingConnection.callbacks.push(connection.callbacks[i]);
          }
        }
      }
    }, 5000);
  });
  
  return connection;
};

// Ακύρωση συνδρομής για έναν συγκεκριμένο callback
const unsubscribeFromCandleUpdates = (symbol, interval, callback) => {
  const formattedSymbol = symbol.toLowerCase();
  const wsKey = `${formattedSymbol}-${interval}`;
  
  if (wsConnections.has(wsKey)) {
    const connection = wsConnections.get(wsKey);
    const callbackIndex = connection.callbacks.indexOf(callback);
    
    if (callbackIndex !== -1) {
      connection.callbacks.splice(callbackIndex, 1);
      console.log(`Removed callback for ${wsKey}, remaining callbacks: ${connection.callbacks.length}`);
      
      // Αν δεν υπάρχουν άλλοι callbacks, κλείνουμε τη σύνδεση
      if (connection.callbacks.length === 0) {
        connection.ws.close();
        wsConnections.delete(wsKey);
        console.log(`Closed WebSocket connection for ${wsKey} (no active callbacks)`);
      }
    }
  }
};

// Λήψη της τρέχουσας τιμής από το cache ή από το API
const getCurrentPrice = async (symbol) => {
  const formattedSymbol = symbol.toUpperCase();
  
  // Έλεγχος αν υπάρχει στο cache
  if (priceCache.has(formattedSymbol)) {
    return priceCache.get(formattedSymbol);
  }
  
  // Αν δεν υπάρχει στο cache, ζητάμε από το API
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbol: formattedSymbol }
    });
    
    const price = parseFloat(response.data.price);
    priceCache.set(formattedSymbol, price);
    return price;
  } catch (error) {
    console.error(`Error fetching current price for ${symbol}:`, error.message);
    throw error;
  }
};

// Εξαγωγή των μεθόδων
module.exports = {
  getHistoricalCandles,
  subscribeToCandleUpdates,
  unsubscribeFromCandleUpdates,
  getCurrentPrice,
  priceCache,
  candleCache
};
