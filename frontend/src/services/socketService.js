// src/services/socketService.js
import { io } from 'socket.io-client';

const SOCKET_URL = '/';

let socket;

export const connectSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      withCredentials: false
    });
    
    socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket');
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  return socket;
};

export const subscribeToMarketData = (symbol, interval = '5m') => {
  if (!socket) {
    connectSocket();
  }
  
  socket.emit('subscribe_market', { symbol, interval });
};

export const unsubscribeFromMarketData = (symbol, interval = '5m') => {
  if (socket) {
    socket.emit('unsubscribe_market', { symbol, interval });
  }
};

export const startBot = (symbol, interval = '5m', userId = 'default') => {
  if (!socket) {
    connectSocket();
  }
  
  socket.emit('start_bot', { symbol, interval, userId });
};

export const stopBot = (symbol, interval = '5m', userId = 'default') => {
  if (socket) {
    socket.emit('stop_bot', { symbol, interval, userId });
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

const socketService = {
  connectSocket,
  subscribeToMarketData,
  unsubscribeFromMarketData,
  startBot,
  stopBot,
  disconnectSocket
};

export default socketService;