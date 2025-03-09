 import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from './SocketContext';

// Create API client with better error handling
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Create context
const DataContext = createContext(null);

// Custom hook to use the data context
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const { socket, isConnected } = useSocket();
  
  // Global state
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [tradingPairs, setTradingPairs] = useState([]);
  const [btcPrice, setBtcPrice] = useState(null);
  const [loading, setLoading] = useState({
    portfolio: true,
    transactions: true,
    tradingPairs: true,
    btcPrice: true
  });
  const [errors, setErrors] = useState({});
  const [botStatus, setBotStatus] = useState({
    isRunning: false,
    activeSymbols: []
  });

  // Fetch portfolio data
  const fetchPortfolio = useCallback(async (userId = 'default') => {
    try {
      setLoading(prev => ({ ...prev, portfolio: true }));
      const response = await api.get('/virtual-trade/portfolio', {
        params: { userId }
      });
      
      if (response.data) {
        setPortfolio(response.data);
        setErrors(prev => ({ ...prev, portfolio: null }));
      }
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      setErrors(prev => ({ 
        ...prev, 
        portfolio: error.response?.data?.error || error.message || 'Failed to fetch portfolio' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, portfolio: false }));
    }
  }, []);

  // Fetch transaction history
  const fetchTransactions = useCallback(async (userId = 'default') => {
    try {
      setLoading(prev => ({ ...prev, transactions: true }));
      const response = await api.get('/virtual-trade/history', {
        params: { userId }
      });
      
      if (response.data && Array.isArray(response.data)) {
        setTransactions(response.data);
        setErrors(prev => ({ ...prev, transactions: null }));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setErrors(prev => ({ 
        ...prev, 
        transactions: error.response?.data?.error || error.message || 'Failed to fetch transactions' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, transactions: false }));
    }
  }, []);

  // Fetch BTC price
  const fetchBtcPrice = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, btcPrice: true }));
      const response = await api.get('/market-data/price/BTCUSDT');
      
      if (response.data && response.data.price) {
        setBtcPrice(response.data.price);
        setErrors(prev => ({ ...prev, btcPrice: null }));
      }
    } catch (error) {
      console.error('Error fetching BTC price:', error);
      setErrors(prev => ({ 
        ...prev, 
        btcPrice: error.response?.data?.error || error.message || 'Failed to fetch BTC price' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, btcPrice: false }));
    }
  }, []);

  // Fetch trading pairs
  const fetchTradingPairs = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, tradingPairs: true }));
      const response = await api.get('/market-data/pairs');
      
      if (response.data && Array.isArray(response.data)) {
        // Filter for active pairs only
        const activePairs = response.data.filter(pair => pair.status === 'TRADING');
        setTradingPairs(activePairs);
        setErrors(prev => ({ ...prev, tradingPairs: null }));
      }
    } catch (error) {
      console.error('Error fetching trading pairs:', error);
      setErrors(prev => ({ 
        ...prev, 
        tradingPairs: error.response?.data?.error || error.message || 'Failed to fetch trading pairs' 
      }));
    } finally {
      setLoading(prev => ({ ...prev, tradingPairs: false }));
    }
  }, []);

  // Fetch bot status
  const fetchBotStatus = useCallback(async () => {
    try {
      const response = await api.get('/api/bot/status');
      if (response.data) {
        setBotStatus(response.data);
      }
    } catch (error) {
      console.error('Error fetching bot status:', error);
      // Don't set an error state as this is a non-critical operation
    }
  }, []);

  // Execute trade
  const executeTrade = async (tradeData) => {
    try {
      const response = await api.post('/virtual-trade/execute', tradeData);
      
      // Refresh portfolio after trading
      fetchPortfolio(tradeData.userId || 'default');
      fetchTransactions(tradeData.userId || 'default');
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error executing trade:', error);
      return { 
        success: false, 
        error: error.response?.data?.error || error.message || 'Failed to execute trade'
      };
    }
  };

  // Convert USD to BTC
  const usdToBtc = (usdAmount) => {
    if (!btcPrice || !usdAmount) return 0;
    const amt = parseFloat(usdAmount);
    const price = parseFloat(btcPrice);
    if (isNaN(amt) || isNaN(price) || price === 0) return 0;
    return amt / price;
  };

  // Format BTC value
  const formatBtcValue = (btcValue) => {
    if (!btcValue) return '₿0.00000000';
    const value = parseFloat(btcValue);
    if (isNaN(value)) return '₿0.00000000';
    return `₿${value.toFixed(8)}`;
  };

  // Load initial data
  useEffect(() => {
    fetchPortfolio();
    fetchTransactions();
    fetchBtcPrice();
    fetchTradingPairs();
    fetchBotStatus();
    
    // Set up periodic refresh for critical data
    const priceInterval = setInterval(fetchBtcPrice, 60000); // Every minute
    const portfolioInterval = setInterval(fetchPortfolio, 300000); // Every 5 minutes
    const statusInterval = setInterval(fetchBotStatus, 300000); // Every 5 minutes
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(portfolioInterval);
      clearInterval(statusInterval);
    };
  }, [fetchPortfolio, fetchTransactions, fetchBtcPrice, fetchTradingPairs, fetchBotStatus]);

  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Portfolio updates
    const handlePortfolioUpdate = (data) => {
      if (data) {
        setPortfolio(data);
      }
    };

    // Transaction updates
    const handleTransactionCreated = (data) => {
      if (data) {
        setTransactions(prev => [data, ...prev]);
      }
    };

    // Price updates
    const handlePriceUpdate = (data) => {
      if (data && data.symbol === 'BTCUSDT' && data.price) {
        setBtcPrice(data.price);
      }
    };

    // Bot status updates
    const handleBotStarted = (data) => {
      if (data) {
        setBotStatus(prev => ({
          ...prev,
          isRunning: true,
          activeSymbols: [...prev.activeSymbols, `${data.symbol}-${data.interval}-${data.userId}`]
        }));
      }
    };

    const handleBotStopped = (data) => {
      if (data) {
        setBotStatus(prev => ({
          ...prev,
          activeSymbols: prev.activeSymbols.filter(
            s => s !== `${data.symbol}-${data.interval}-${data.userId}`
          ),
          isRunning: prev.activeSymbols.length > 1
        }));
      }
    };

    // Register listeners
    socket.on('portfolio_update', handlePortfolioUpdate);
    socket.on('transaction_created', handleTransactionCreated);
    socket.on('price_update', handlePriceUpdate);
    socket.on('bot_started', handleBotStarted);
    socket.on('bot_stopped', handleBotStopped);

    // Cleanup listeners on unmount
    return () => {
      socket.off('portfolio_update', handlePortfolioUpdate);
      socket.off('transaction_created', handleTransactionCreated);
      socket.off('price_update', handlePriceUpdate);
      socket.off('bot_started', handleBotStarted);
      socket.off('bot_stopped', handleBotStopped);
    };
  }, [socket, isConnected]);

  // Refresh all data when reconnecting
  useEffect(() => {
    if (isConnected) {
      fetchPortfolio();
      fetchTransactions();
      fetchBtcPrice();
      fetchBotStatus();
    }
  }, [isConnected, fetchPortfolio, fetchTransactions, fetchBtcPrice, fetchBotStatus]);

  const value = {
    // Data
    portfolio,
    transactions,
    tradingPairs,
    btcPrice,
    botStatus,
    loading,
    errors,
    
    // Methods
    fetchPortfolio,
    fetchTransactions,
    fetchBtcPrice,
    fetchTradingPairs,
    fetchBotStatus,
    executeTrade,
    usdToBtc,
    formatBtcValue,
    
    // Combined refresh
    refreshAllData: () => {
      fetchPortfolio();
      fetchTransactions();
      fetchBtcPrice();
      fetchTradingPairs();
      fetchBotStatus();
    }
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};