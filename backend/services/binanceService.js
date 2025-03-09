// Improved backend/services/binanceService.js with better WebSocket handling
const WebSocket = require('ws');
const axios = require('axios');
const MarketData = require('../models/MarketData');

// Map for managing WebSocket connections
const wsConnections = new Map();
const pendingConnections = new Map();
const CONNECTION_TIMEOUT = 10000; // 10 seconds to establish connection

// Get historical candlestick data from Binance API or database
const getHistoricalCandles = async (symbol, interval = '1h', limit = 100) => {
  try {
    const formattedSymbol = symbol.toUpperCase();
    console.log(`Fetching historical candles for ${formattedSymbol}, interval: ${interval}, limit: ${limit}`);
    
    // Try to get data from database first if MarketData has getCandles
    let cachedCandles = [];
    if (typeof MarketData.getCandles === 'function') {
      try {
        cachedCandles = await MarketData.getCandles(formattedSymbol, interval, limit);
        console.log(`Found ${cachedCandles.length} cached candles in database`);
      } catch (dbError) {
        console.error(`Error fetching cached candles: ${dbError.message}`);
        cachedCandles = [];
      }
    }
    
    // If we have enough candles in the database, use them
    if (cachedCandles.length >= limit) {
      console.log(`Using ${cachedCandles.length} cached candles from database for ${formattedSymbol}`);
      return cachedCandles;
    }
    
    // Otherwise, fetch from Binance API
    console.log(`Fetching candles from Binance API for ${formattedSymbol}`);
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: {
        symbol: formattedSymbol,
        interval,
        limit
      }
    });

    // Convert to format suitable for technical analysis
    const candles = response.data.map(candle => ({
      time: candle[0], // Opening timestamp
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));

    // Save each candle to database if MarketData has saveCandle
    if (typeof MarketData.saveCandle === 'function') {
      try {
        for (const candle of candles) {
          await MarketData.saveCandle(formattedSymbol, interval, {
            ...candle,
            isClosed: true
          });
        }
      } catch (saveError) {
        console.error(`Error saving candles to database: ${saveError.message}`);
      }
    }
    
    // Update latest price if MarketData has savePrice
    if (candles.length > 0 && typeof MarketData.savePrice === 'function') {
      try {
        await MarketData.savePrice(formattedSymbol, candles[candles.length - 1].close);
      } catch (priceError) {
        console.error(`Error saving price to database: ${priceError.message}`);
      }
    }
    
    console.log(`Received ${candles.length} historical candles for ${formattedSymbol}`);
    return candles;
  } catch (error) {
    console.error(`Error fetching historical candles for ${symbol}:`, error.message);
    throw error;
  }
};

// Connect to Binance WebSocket for real-time candles
const subscribeToCandleUpdates = (symbol, interval, callback) => {
  const formattedSymbol = symbol.toLowerCase();
  const wsKey = `${formattedSymbol}-${interval}`;
  
  // If there's already an active connection, add the callback
  if (wsConnections.has(wsKey)) {
    const connection = wsConnections.get(wsKey);
    
    // If WebSocket is not OPEN, check if it's connecting or needs reconnection
    if (connection.ws.readyState !== WebSocket.OPEN) {
      if (connection.ws.readyState === WebSocket.CONNECTING) {
        // WebSocket is still connecting, just add to pending callbacks
        console.log(`WebSocket for ${wsKey} is still connecting, adding callback`);
        connection.callbacks.push(callback);
        return connection;
      } else {
        // WebSocket is closing or closed, reconnect
        console.log(`WebSocket for ${wsKey} is closed or closing, reconnecting`);
        
        // Keep the callback list and create a new WebSocket
        const callbackList = connection.callbacks;
        callbackList.push(callback);
        
        // Remove the old connection
        wsConnections.delete(wsKey);
        
        // Create a new connection with all callbacks
        return createNewWebSocketConnection(formattedSymbol, interval, callbackList);
      }
    }
    
    // WebSocket is open, add the callback
    connection.callbacks.push(callback);
    console.log(`Added new callback for ${wsKey}, total callbacks: ${connection.callbacks.length}`);
    return connection;
  }
  
  // Create a new WebSocket connection
  return createNewWebSocketConnection(formattedSymbol, interval, [callback]);
};

// Helper function to create a new WebSocket connection
const createNewWebSocketConnection = (symbol, interval, callbackList) => {
  const wsKey = `${symbol}-${interval}`;
  console.log(`Creating new WebSocket connection for ${wsKey}`);
  
  // Create the WebSocket
  const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`);
  
  // Create the connection object
  const connection = {
    ws,
    callbacks: callbackList || [],
    isActive: true,
    connectedAt: null,
    reconnectCount: 0,
    maxReconnects: 5
  };
  
  // Add to connections map
  wsConnections.set(wsKey, connection);
  
  // Create a timeout to detect connection issues
  const connectionTimeoutId = setTimeout(() => {
    if (connection.connectedAt === null) {
      console.warn(`WebSocket connection timeout for ${wsKey}`);
      
      // Close the socket if it's still connecting
      if (ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.terminate();
        } catch (err) {
          console.error(`Error terminating WebSocket for ${wsKey}:`, err);
        }
      }
      
      // Try to reconnect if needed
      if (connection.reconnectCount < connection.maxReconnects) {
        connection.reconnectCount++;
        console.log(`Attempting reconnect ${connection.reconnectCount}/${connection.maxReconnects} for ${wsKey}`);
        
        // Keep callbacks and create a new connection
        createNewWebSocketConnection(symbol, interval, connection.callbacks);
      } else {
        console.error(`Maximum reconnect attempts reached for ${wsKey}`);
        wsConnections.delete(wsKey);
      }
    }
  }, CONNECTION_TIMEOUT);
  
  // Store the timeout ID to clear it later
  pendingConnections.set(wsKey, connectionTimeoutId);
  
  // WebSocket event handlers
  ws.on('open', () => {
    console.log(`WebSocket connection opened for ${wsKey}`);
    connection.connectedAt = Date.now();
    
    // Clear the connection timeout
    if (pendingConnections.has(wsKey)) {
      clearTimeout(pendingConnections.get(wsKey));
      pendingConnections.delete(wsKey);
    }
  });
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      const kline = message.k;
      
      // Candle data
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
      
      // Save the latest price to database if MarketData has savePrice
      if (typeof MarketData.savePrice === 'function') {
        try {
          await MarketData.savePrice(message.s, candle.close);
        } catch (priceError) {
          console.error(`Error saving price update: ${priceError.message}`);
        }
      }
      
      // Save completed candle to database if MarketData has saveCandle
      if (candle.isClosed && typeof MarketData.saveCandle === 'function') {
        try {
          await MarketData.saveCandle(message.s, interval, candle);
        } catch (candleError) {
          console.error(`Error saving candle update: ${candleError.message}`);
        }
      }
      
      // Call all callbacks with the new data
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
    
    // Clear any connection timeout
    if (pendingConnections.has(wsKey)) {
      clearTimeout(pendingConnections.get(wsKey));
      pendingConnections.delete(wsKey);
    }
    
    // Reconnect after 5 seconds if there are callbacks and we haven't exceeded max reconnects
    if (connection.callbacks.length > 0 && connection.reconnectCount < connection.maxReconnects) {
      setTimeout(() => {
        if (wsConnections.has(wsKey) && !wsConnections.get(wsKey).isActive) {
          connection.reconnectCount++;
          console.log(`Attempting reconnect ${connection.reconnectCount}/${connection.maxReconnects} for ${wsKey}`);
          
          wsConnections.delete(wsKey);
          createNewWebSocketConnection(symbol, interval, connection.callbacks);
        }
      }, 5000);
    } else if (connection.callbacks.length === 0) {
      // Remove connection from map if no callbacks
      wsConnections.delete(wsKey);
    }
  });
  
  return connection;
};

// Unsubscribe a specific callback
const unsubscribeFromCandleUpdates = (symbol, interval, callback) => {
  const formattedSymbol = symbol.toLowerCase();
  const wsKey = `${formattedSymbol}-${interval}`;
  
  if (wsConnections.has(wsKey)) {
    const connection = wsConnections.get(wsKey);
    
    // Αν παρέχεται συγκεκριμένο callback, αφαίρεσέ το μόνο
    if (callback) {
      const callbackIndex = connection.callbacks.indexOf(callback);
      
      if (callbackIndex !== -1) {
        connection.callbacks.splice(callbackIndex, 1);
        console.log(`Removed callback for ${wsKey}, remaining callbacks: ${connection.callbacks.length}`);
      }
    } else {
      // Αν δεν έχει καθοριστεί callback, αφαίρεσε όλα τα callbacks
      console.log(`Removed all callbacks for ${wsKey}, had ${connection.callbacks.length}`);
      connection.callbacks = [];
    }
    
    // Αν δεν έχουν μείνει callbacks, κλείσε το WebSocket με ασφάλεια
    if (connection.callbacks.length === 0) {
      const ws = connection.ws;
      
      // Χειρισμός με βάση την κατάσταση του WebSocket
      if (ws.readyState === WebSocket.OPEN) {
        // Το socket είναι ανοιχτό, μπορούμε να το κλείσουμε με ασφάλεια
        try {
          ws.close();
          console.log(`Closed WebSocket connection for ${wsKey}`);
        } catch (closeError) {
          console.error(`Error closing WebSocket for ${wsKey}:`, closeError);
          try {
            ws.terminate();
          } catch (terminateError) {
            console.error(`Error terminating WebSocket for ${wsKey}:`, terminateError);
          }
        }
      } else if (ws.readyState === WebSocket.CONNECTING) {
        // Το socket είναι ακόμα στη φάση σύνδεσης
        // Προσθήκη event listener για να το κλείσει αφού συνδεθεί
        console.log(`WebSocket for ${wsKey} is still connecting, scheduling close after connection`);
        
        ws.addEventListener('open', function closeAfterOpen() {
          // Αφαίρεση του event listener για αποφυγή memory leaks
          ws.removeEventListener('open', closeAfterOpen);
          // Κλείσιμο του socket αφού συνδεθεί
          ws.close();
          console.log(`WebSocket for ${wsKey} connected and then immediately closed`);
        });
      }
      
      // Αφαίρεση από το map ανεξάρτητα από την κατάσταση
      wsConnections.delete(wsKey);
    }
  }
};

// Get current price from database or Binance API
const getCurrentPrice = async (symbol) => {
  const formattedSymbol = symbol.toUpperCase();
  
  try {
    // First check the database if MarketData has getLatestPrice
    let latestPrice = null;
    if (typeof MarketData.getLatestPrice === 'function') {
      try {
        latestPrice = await MarketData.getLatestPrice(formattedSymbol);
      } catch (dbError) {
        console.error(`Error fetching price from database: ${dbError.message}`);
      }
    }
    
    // If price exists in database and is recent (within the last 5 minutes), use it
    if (latestPrice && latestPrice.price && (Date.now() - latestPrice.time < 5 * 60 * 1000)) {
      console.log(`Using cached price for ${formattedSymbol}: ${latestPrice.price}`);
      return latestPrice.price;
    }
    
    // Otherwise, fetch from Binance API
    console.log(`Fetching current price for ${formattedSymbol} from Binance API`);
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbol: formattedSymbol }
    });
    
    const price = parseFloat(response.data.price);
    
    // Save to database if MarketData has savePrice
    if (typeof MarketData.savePrice === 'function') {
      try {
        await MarketData.savePrice(formattedSymbol, price);
      } catch (saveError) {
        console.error(`Error saving price to database: ${saveError.message}`);
      }
    }
    
    return price;
  } catch (error) {
    console.error(`Error fetching current price for ${symbol}:`, error.message);
    throw error;
  }
};

// Get all available trading pairs from Binance
const getAllTradingPairs = async () => {
  try {
    console.log('Fetching all trading pairs from Binance');
    
    // Check if we have recent data in the database
    let cachedPairs = null;
    if (typeof MarketData.getTradingPairs === 'function') {
      try {
        cachedPairs = await MarketData.getTradingPairs();
        if (cachedPairs && cachedPairs.length > 0) {
          console.log(`Using ${cachedPairs.length} cached trading pairs from database`);
          return cachedPairs;
        }
      } catch (dbError) {
        console.error(`Error fetching cached trading pairs: ${dbError.message}`);
      }
    }
    
    // If not found in cache, fetch from Binance
    console.log('Fetching fresh trading pairs from Binance API');
    const response = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    
    // Extract and format the symbols data
    const symbols = response.data.symbols.map(symbol => ({
      symbol: symbol.symbol,
      baseAsset: symbol.baseAsset,
      quoteAsset: symbol.quoteAsset,
      status: symbol.status
    }));
    
    // Save to database if MarketData has saveTradingPairs
    if (typeof MarketData.saveTradingPairs === 'function') {
      try {
        await MarketData.saveTradingPairs(symbols);
        console.log(`Saved ${symbols.length} trading pairs to database`);
      } catch (saveError) {
        console.error(`Error saving trading pairs to database: ${saveError.message}`);
      }
    }
    
    return symbols;
  } catch (error) {
    console.error('Error fetching trading pairs:', error.message);
    throw error;
  }
};

// Test connection to Binance API with provided API keys
const testConnection = async (apiKey, secretKey) => {
  try {
    // Use the Binance API endpoint to test the connection
    const response = await axios.get('https://api.binance.com/api/v3/account', {
      headers: {
        'X-MBX-APIKEY': apiKey
      },
      params: {
        timestamp: Date.now(),
        signature: 'test' // This will fail the signature check but verify the API key
      }
    });
    
    return true;
  } catch (error) {
    // If error is related to invalid signature but API key is valid
    if (error.response && 
        error.response.data && 
        error.response.data.code && 
        error.response.data.code === -1022) {
      // API key is valid but signature failed (expected)
      return true;
    }
    
    console.error('Error testing Binance API connection:', error.message);
    throw new Error('Invalid API key or connection problem');
  }
};

// Clean up all WebSocket connections
const cleanupConnections = () => {
  console.log('Cleaning up all WebSocket connections');
  
  // Clear all pending connection timeouts
  pendingConnections.forEach((timeoutId, key) => {
    clearTimeout(timeoutId);
    console.log(`Cleared pending connection timeout for ${key}`);
  });
  pendingConnections.clear();
  
  // Close all WebSocket connections
  wsConnections.forEach((connection, key) => {
    if (connection.ws.readyState === WebSocket.OPEN || connection.ws.readyState === WebSocket.CONNECTING) {
      try {
        connection.ws.close();
        console.log(`Closed WebSocket connection for ${key}`);
      } catch (error) {
        console.error(`Error closing WebSocket for ${key}:`, error);
        try {
          connection.ws.terminate();
        } catch (err) {
          console.error(`Error terminating WebSocket for ${key}:`, err);
        }
      }
    }
  });
  
  wsConnections.clear();
};

// Export methods
module.exports = {
  getHistoricalCandles,
  subscribeToCandleUpdates,
  unsubscribeFromCandleUpdates,
  getCurrentPrice,
  getAllTradingPairs,
  testConnection,
  cleanupConnections
};