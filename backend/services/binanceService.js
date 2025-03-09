// services/binanceService.js - Complete implementation with all required methods
const WebSocket = require('ws');
const axios = require('axios');
const MarketData = require('../models/MarketData');

// Map for managing WebSocket connections
const wsConnections = new Map();

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
    connection.callbacks.push(callback);
    console.log(`Added new callback for ${wsKey}, total callbacks: ${connection.callbacks.length}`);
    return connection;
  }
  
  // Connect to Binance WebSocket
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
    
    // Reconnect after 5 seconds
    setTimeout(() => {
      if (wsConnections.has(wsKey) && !wsConnections.get(wsKey).isActive) {
        console.log(`Attempting to reconnect WebSocket for ${wsKey}`);
        wsConnections.delete(wsKey);
        if (connection.callbacks.length > 0) {
          subscribeToCandleUpdates(symbol, interval, connection.callbacks[0]);
          
          // Add the remaining callbacks
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

// Unsubscribe a specific callback
const unsubscribeFromCandleUpdates = (symbol, interval, callback) => {
  const formattedSymbol = symbol.toLowerCase();
  const wsKey = `${formattedSymbol}-${interval}`;
  
  if (wsConnections.has(wsKey)) {
    const connection = wsConnections.get(wsKey);
    const callbackIndex = connection.callbacks.indexOf(callback);
    
    if (callbackIndex !== -1) {
      connection.callbacks.splice(callbackIndex, 1);
      console.log(`Removed callback for ${wsKey}, remaining callbacks: ${connection.callbacks.length}`);
      
      // If there are no more callbacks, close the connection
      if (connection.callbacks.length === 0) {
        connection.ws.close();
        wsConnections.delete(wsKey);
        console.log(`Closed WebSocket connection for ${wsKey} (no active callbacks)`);
      }
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

// Export methods
module.exports = {
  getHistoricalCandles,
  subscribeToCandleUpdates,
  unsubscribeFromCandleUpdates,
  getCurrentPrice,
  getAllTradingPairs,
  testConnection
};