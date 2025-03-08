// src/services/socketService.js - Updated to better support BTC/USDT
import { io } from 'socket.io-client';

const SOCKET_URL = '/';

// Δημιουργία ενός singleton για το socket
let socket;

export const connectSocket = () => {
  if (!socket) {
    console.log('Creating new socket connection');
    socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: false
    });
    
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      
      // Automatically subscribe to BTCUSDT for global price tracking
      socket.emit('subscribe_market', { symbol: 'BTCUSDT', interval: '1m' });
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
    
    // Προσθήκη ενός global handler για debug
    socket.onAny((event, ...args) => {
      console.log(`[DEBUG] Received event: ${event}`, args);
    });
    
    // Παρακολούθηση όλων των trade signals για εύκολο debugging
    socket.on('trade_signal', (signal) => {
      console.log(`[socketService] Received trade signal: ${signal.action} ${signal.symbol} (${signal.indicator})`);
    });
    
    // Listen for BTC price updates globally
    socket.on('btc_price_update', (data) => {
      console.log(`[socketService] BTC price update: $${data.price}`);
    });
  } else {
    console.log('Using existing socket connection');
  }
  
  return socket;
};

export const subscribeToMarketData = (symbol, interval = '5m') => {
  if (!socket) {
    connectSocket();
  }
  
  console.log(`Subscribing to market data: ${symbol} (${interval})`);
  socket.emit('subscribe_market', { symbol, interval });
};

export const unsubscribeFromMarketData = (symbol, interval = '5m') => {
  if (socket) {
    console.log(`Unsubscribing from market data: ${symbol} (${interval})`);
    socket.emit('unsubscribe_market', { symbol, interval });
  }
};

export const startBot = (symbol, interval = '5m', userId = 'default') => {
  if (!socket) {
    connectSocket();
  }
  
  console.log(`Starting bot: ${symbol} (${interval}) for user ${userId}`);
  socket.emit('start_bot', { symbol, interval, userId });
  
  // Always make sure we're also watching BTCUSDT for reference
  socket.emit('subscribe_market', { symbol: 'BTCUSDT', interval: '1m' });
};

export const stopBot = (symbol, interval = '5m', userId = 'default') => {
  if (socket) {
    console.log(`Stopping bot: ${symbol} (${interval}) for user ${userId}`);
    socket.emit('stop_bot', { symbol, interval, userId });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('Disconnecting socket');
    socket.disconnect();
    socket = null;
  }
};

// Test signals function removed

const socketService = {
  connectSocket,
  subscribeToMarketData,
  unsubscribeFromMarketData,
  startBot,
  stopBot,
  disconnectSocket
};

export default socketService;