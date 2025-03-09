// src/services/socketService.js - Enhanced with reconnection logic
import { io } from 'socket.io-client';

const SOCKET_URL = '/';
let socket;
let subscribedSymbols = new Map(); // Keep track of subscriptions
let activeBots = new Map(); // Keep track of active bots

export const connectSocket = () => {
  if (!socket) {
    console.log('Creating new Socket.io connection...');
    
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 10000,
      withCredentials: false
    });
    
    // Connection events
    socket.on('connect', () => {
      console.log('Socket connected successfully! ID:', socket.id);
      
      // Resubscribe to previous channels after reconnection
      subscribedSymbols.forEach((interval, symbol) => {
        console.log(`Resubscribing to ${symbol} (${interval})`);
        socket.emit('subscribe_market', { symbol, interval });
      });
      
      // Restart active bots after reconnection
      activeBots.forEach((data, key) => {
        console.log(`Restarting bot for ${data.symbol} (${data.interval})`);
        socket.emit('start_bot', data);
      });
      
      // Always subscribe to BTC for reference
      subscribeToMarketData('BTCUSDT', '1m');
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
    
    socket.on('reconnect', (attempt) => {
      console.log(`Socket reconnected after ${attempt} attempts`);
    });
    
    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }
  
  return socket;
};

export const subscribeToMarketData = (symbol, interval = '5m') => {
  if (!socket) {
    connectSocket();
  }
  
  console.log(`Subscribing to market data: ${symbol} (${interval})`);
  socket.emit('subscribe_market', { symbol, interval });
  
  // Track subscription
  subscribedSymbols.set(symbol, interval);
};

export const unsubscribeFromMarketData = (symbol, interval = '5m') => {
  if (socket) {
    console.log(`Unsubscribing from market data: ${symbol} (${interval})`);
    socket.emit('unsubscribe_market', { symbol, interval });
    
    // Remove from tracking
    subscribedSymbols.delete(symbol);
  }
};

export const startBot = (symbol, interval = '5m', userId = 'default') => {
  if (!socket) {
    connectSocket();
  }
  
  console.log(`Starting bot for ${symbol} (${interval})`);
  const botData = { symbol, interval, userId };
  socket.emit('start_bot', botData);
  
  // Track active bot
  const botKey = `${symbol}-${interval}-${userId}`;
  activeBots.set(botKey, botData);
  
  // Always make sure we're also watching BTCUSDT for reference
  subscribeToMarketData('BTCUSDT', '1m');
};

export const stopBot = (symbol, interval = '5m', userId = 'default') => {
  if (socket) {
    console.log(`Stopping bot for ${symbol} (${interval})`);
    socket.emit('stop_bot', { symbol, interval, userId });
    
    // Remove from tracking
    const botKey = `${symbol}-${interval}-${userId}`;
    activeBots.delete(botKey);
  }
};

export const disconnectSocket = () => {
  if (socket) {
    console.log('Manually disconnecting socket');
    socket.disconnect();
    socket = null;
    
    // Clear tracking
    subscribedSymbols.clear();
    activeBots.clear();
  }
};

// Check connection status
export const isConnected = () => {
  return socket && socket.connected;
};

// Get current socket ID
export const getSocketId = () => {
  return socket ? socket.id : null;
};

const socketService = {
  connectSocket,
  subscribeToMarketData,
  unsubscribeFromMarketData,
  startBot,
  stopBot,
  disconnectSocket,
  isConnected,
  getSocketId
};

export default socketService;