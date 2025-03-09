// src/services/socketService.js - Enhanced with better error handling
import { io } from 'socket.io-client';

const SOCKET_URL = '/';
let socket;
let subscribedSymbols = new Map(); // Keep track of subscriptions
let activeBots = new Map(); // Keep track of active bots
let connectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;

export const connectSocket = () => {
  if (!socket) {
    console.log('Creating new Socket.io connection...');
    
    try {
      socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
        reconnectionDelay: 2000,
        timeout: 10000,
        withCredentials: false
      });
      
      // Connection events
      socket.on('connect', () => {
        console.log('Socket connected successfully! ID:', socket.id);
        connectionAttempts = 0;
        
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
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });
      
      socket.on('connect_error', (error) => {
        connectionAttempts++;
        console.error(`Socket connection error (${connectionAttempts}/${MAX_RECONNECTION_ATTEMPTS}):`, error.message);
        
        // If we've exceeded reconnection attempts, we should alert the user
        if (connectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
          console.error('Maximum reconnection attempts reached. Please check your server connection.');
        }
      });
      
      socket.on('reconnect', (attempt) => {
        console.log(`Socket reconnected after ${attempt} attempts`);
        connectionAttempts = 0;
      });
      
      socket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
      });
      
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    } catch (error) {
      console.error('Error initializing socket connection:', error);
      // We'll return a dummy socket with methods that do nothing to avoid app crashes
      return createDummySocket();
    }
  }
  
  return socket;
};

// Create a dummy socket that won't crash the app if real socket fails
const createDummySocket = () => {
  console.warn('Using dummy socket due to connection failure');
  
  const dummySocket = {
    id: 'dummy-socket',
    connected: false,
    on: (event, callback) => console.log(`Dummy socket: Would register for ${event}`),
    off: (event, callback) => console.log(`Dummy socket: Would unregister from ${event}`),
    emit: (event, data) => console.log(`Dummy socket: Would emit ${event}`, data),
    disconnect: () => console.log('Dummy socket: Would disconnect')
  };
  
  return dummySocket;
};

export const subscribeToMarketData = (symbol, interval = '5m') => {
  if (!socket) {
    connectSocket();
  }
  
  if (!socket.connected) {
    console.warn(`Cannot subscribe to ${symbol} - socket not connected`);
    return;
  }
  
  console.log(`Subscribing to market data: ${symbol} (${interval})`);
  socket.emit('subscribe_market', { symbol, interval });
  
  // Track subscription
  subscribedSymbols.set(symbol, interval);
};

export const unsubscribeFromMarketData = (symbol, interval = '5m') => {
  if (socket && socket.connected) {
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
  
  if (!socket.connected) {
    console.warn(`Cannot start bot for ${symbol} - socket not connected`);
    return;
  }
  
  console.log(`Starting bot for ${symbol} (${interval})`);
  const botData = { symbol, interval, userId };
  socket.emit('start_bot', botData);
  
  // Track active bot
  const botKey = `${symbol}-${interval}-${userId}`;
  activeBots.set(botKey, botData);
};

export const stopBot = (symbol, interval = '5m', userId = 'default') => {
  if (socket && socket.connected) {
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

// Reset connection counter
export const resetConnectionAttempts = () => {
  connectionAttempts = 0;
};

// Force a reconnection
export const forceReconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectionAttempts = 0;
  return connectSocket();
};

const socketService = {
  connectSocket,
  subscribeToMarketData,
  unsubscribeFromMarketData,
  startBot,
  stopBot,
  disconnectSocket,
  isConnected,
  getSocketId,
  resetConnectionAttempts,
  forceReconnect
};

export default socketService;