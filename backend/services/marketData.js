const axios = require('axios');
const WebSocket = require('ws');

// Map για τη διαχείριση των WebSocket subscriptions
const subscriptions = new Map();

// Λήψη ιστορικών δεδομένων από το Binance API
exports.getHistoricalData = async (symbol, interval = '1h', limit = 100) => {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: symbol.toUpperCase(),
        interval,
        limit
      }
    });

    // Μετατροπή των δεδομένων σε format κατάλληλο για το TradingView
    return response.data.map(candle => ({
      time: candle[0], // Open time
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};

// Σύνδεση με το Binance WebSocket για real-time δεδομένα
exports.subscribe = (symbol, callback) => {
  const formattedSymbol = symbol.toLowerCase();
  const url = `wss://stream.binance.com:9443/ws/${formattedSymbol}@kline_1m`;

  // Αν υπάρχει ήδη ενεργή σύνδεση για αυτό το symbol, προσθέτουμε το callback
  if (subscriptions.has(formattedSymbol)) {
    const subscribers = subscriptions.get(formattedSymbol).subscribers;
    subscribers.push(callback);
    return;
  }

  // Δημιουργία νέου WebSocket
  const ws = new WebSocket(url);
  
  ws.on('open', () => {
    console.log(`WebSocket connection opened for ${symbol}`);
  });
  
  ws.on('message', (data) => {
    try {
      const parsedData = JSON.parse(data);
      const kline = parsedData.k;
      
      // Μετατροπή δεδομένων σε κατάλληλο format
      const candleData = {
        symbol: parsedData.s,
        time: kline.t,
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        volume: parseFloat(kline.v),
        isClosed: kline.x
      };
      
      // Κλήση των callbacks
      const subscribers = subscriptions.get(formattedSymbol).subscribers;
      subscribers.forEach(cb => cb(candleData));
    } catch (error) {
      console.error('Error parsing WebSocket data:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${symbol}:`, error);
  });
  
  ws.on('close', () => {
    console.log(`WebSocket connection closed for ${symbol}`);
    // Αφαίρεση της συνδρομής
    subscriptions.delete(formattedSymbol);
  });
  
  // Αποθήκευση της συνδρομής
  subscriptions.set(formattedSymbol, {
    ws,
    subscribers: [callback]
  });
};

// Διαγραφή συνδρομής
exports.unsubscribe = (symbol, callback) => {
  const formattedSymbol = symbol.toLowerCase();
  
  if (!subscriptions.has(formattedSymbol)) {
    return;
  }
  
  const subscription = subscriptions.get(formattedSymbol);
  const index = subscription.subscribers.indexOf(callback);
  
  if (index !== -1) {
    subscription.subscribers.splice(index, 1);
  }
  
  // Αν δεν υπάρχουν άλλοι subscribers, κλείνουμε το WebSocket
  if (subscription.subscribers.length === 0) {
    subscription.ws.close();
    subscriptions.delete(formattedSymbol);
  }
};

// Διαγραφή όλων των συνδρομών για έναν συγκεκριμένο client
exports.unsubscribeAll = (clientId) => {
  // Εδώ θα χρειαζόταν ένας μηχανισμός για να αντιστοιχίσετε το clientId με τα callbacks
  // Για απλότητα, δεν τον υλοποιούμε εδώ
};

// Λήψη τρέχουσας τιμής για ένα symbol
exports.getCurrentPrice = async (symbol) => {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbol: symbol.toUpperCase() }
    });
    
    return parseFloat(response.data.price);
  } catch (error) {
    console.error('Error fetching current price:', error);
    throw error;
  }
};
