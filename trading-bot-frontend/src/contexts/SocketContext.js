 import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

// Create context
const SocketContext = createContext(null);

// Custom hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectAttempts = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  // Socket subscriptions tracking
  const subscriptions = useRef(new Map());
  const activeBots = useRef(new Map());

  useEffect(() => {
    // Initialize socket connection
    const initializeSocket = () => {
      try {
        const socketInstance = io('/', {
          transports: ['websocket', 'polling'],
          reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
          reconnectionDelay: 2000,
          timeout: 10000
        });

        socketInstance.on('connect', () => {
          console.log('Socket connected successfully!', socketInstance.id);
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;

          // Resubscribe to previous channels after reconnection
          subscriptions.current.forEach((interval, symbol) => {
            console.log(`Resubscribing to ${symbol} (${interval})`);
            socketInstance.emit('subscribe_market', { symbol, interval });
          });

          // Restart active bots after reconnection
          activeBots.current.forEach((data, key) => {
            console.log(`Restarting bot for ${data.symbol} (${data.interval})`);
            socketInstance.emit('start_bot', data);
          });
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
          reconnectAttempts.current++;
          console.error(`Socket connection error (${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}):`, error.message);
          
          setConnectionError(error.message);
          
          if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
            setConnectionError('Maximum reconnection attempts reached. Please reload the page.');
          }
        });

        socketInstance.on('reconnect', (attemptNumber) => {
          console.log(`Socket reconnected after ${attemptNumber} attempts`);
          setIsConnected(true);
          setConnectionError(null);
          reconnectAttempts.current = 0;
        });

        setSocket(socketInstance);

        return socketInstance;
      } catch (error) {
        console.error('Error initializing socket:', error);
        setConnectionError('Failed to initialize socket connection');
        return null;
      }
    };

    const socketInstance = initializeSocket();

    // Cleanup on unmount
    return () => {
      if (socketInstance) {
        console.log('Cleaning up socket connection');
        socketInstance.disconnect();
      }
    };
  }, []);

  // Subscribe to market data
  const subscribeToMarket = (symbol, interval = '5m') => {
    if (!socket || !isConnected) {
      console.warn('Cannot subscribe - socket not connected');
      return false;
    }

    console.log(`Subscribing to ${symbol} (${interval})`);
    socket.emit('subscribe_market', { symbol, interval });
    
    // Track subscription
    subscriptions.current.set(symbol, interval);
    return true;
  };

  // Unsubscribe from market data
  const unsubscribeFromMarket = (symbol, interval = '5m') => {
    if (!socket || !isConnected) return false;

    console.log(`Unsubscribing from ${symbol} (${interval})`);
    socket.emit('unsubscribe_market', { symbol, interval });
    
    // Remove from tracking
    subscriptions.current.delete(symbol);
    return true;
  };

  // Start bot monitoring
  const startBot = (symbol, interval = '5m', userId = 'default') => {
    if (!socket || !isConnected) {
      console.warn('Cannot start bot - socket not connected');
      return false;
    }

    const botData = { symbol, interval, userId };
    console.log('Starting bot:', botData);
    socket.emit('start_bot', botData);
    
    // Track active bot
    const botKey = `${symbol}-${interval}-${userId}`;
    activeBots.current.set(botKey, botData);
    return true;
  };

  // Stop bot monitoring
  const stopBot = (symbol, interval = '5m', userId = 'default') => {
    if (!socket || !isConnected) return false;

    console.log(`Stopping bot for ${symbol} (${interval})`);
    socket.emit('stop_bot', { symbol, interval, userId });
    
    // Remove from tracking
    const botKey = `${symbol}-${interval}-${userId}`;
    activeBots.current.delete(botKey);
    return true;
  };

  // Force reconnect
  const reconnect = () => {
    if (socket) {
      socket.disconnect();
      socket.connect();
      return true;
    }
    return false;
  };

  const value = {
    socket,
    isConnected,
    connectionError,
    subscribeToMarket,
    unsubscribeFromMarket,
    startBot,
    stopBot,
    reconnect
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};