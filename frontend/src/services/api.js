// src/services/api.js - Enhanced with better error handling
import axios from 'axios';

// Create axios instance with improved configuration
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 5000 // 5 second timeout - FIXED: Removed the 'a' prefix
});

// Response interceptor for debugging and global error handling
api.interceptors.response.use(
  (response) => {
    // Log successful responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Response [${response.config.method}] ${response.config.url}:`, 
        response.status, response.data ? '✓' : '⚠️');
    }
    return response;
  },
  (error) => {
    // Enhanced error logging
    if (error.response) {
      // Server responded with non-2xx status
      console.error(`API Error [${error.config.method}] ${error.config.url}:`, 
        error.response.status, error.response.data);
    } else if (error.request) {
      // Request made but no response received
      console.error(`API No Response [${error.config.method}] ${error.config.url}:`, 
        'No response received');
    } else {
      // Error in setting up the request
      console.error(`API Request Error [${error.config?.method}] ${error.config?.url}:`, 
        error.message);
    }
    
    return Promise.reject(error);
  }
);

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request [${config.method}] ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('API Request Error:', error.message);
    return Promise.reject(error);
  }
);

// API for the portfolio with retry logic
export const fetchPortfolio = async (userId = 'default', retryCount = 2) => {
  try {
    const response = await api.get('/virtual-trade/portfolio', {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    
    // Implement retry logic
    if (retryCount > 0 && (!error.response || error.response.status >= 500)) {
      console.log(`Retrying fetchPortfolio... (${retryCount} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
      return fetchPortfolio(userId, retryCount - 1);
    }
    
    throw error;
  }
};

// API for transaction history with retry
export const fetchTransactionHistory = async (userId = 'default', retryCount = 2) => {
  try {
    const response = await api.get('/virtual-trade/history', {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    
    if (retryCount > 0 && (!error.response || error.response.status >= 500)) {
      console.log(`Retrying fetchTransactionHistory... (${retryCount} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchTransactionHistory(userId, retryCount - 1);
    }
    
    throw error;
  }
};

// Health check API
export const checkServerStatus = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Error checking server status:', error);
    throw error;
  }
};

// Fetch BTC price with retry
export const fetchBTCPrice = async (retryCount = 2) => {
  try {
    const response = await api.get('/market-data/price/BTCUSDT');
    return response.data.price;
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    
    if (retryCount > 0 && (!error.response || error.response.status >= 500)) {
      console.log(`Retrying fetchBTCPrice... (${retryCount} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchBTCPrice(retryCount - 1);
    }
    
    // Return a fallback value on error
    return null;
  }
};

// Check available trading pairs
export const fetchTradingPairs = async (retryCount = 2) => {
  try {
    const response = await api.get('/market-data/pairs');
    return response.data;
  } catch (error) {
    console.error('Error fetching trading pairs:', error);
    
    if (retryCount > 0 && (!error.response || error.response.status >= 500)) {
      console.log(`Retrying fetchTradingPairs... (${retryCount} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchTradingPairs(retryCount - 1);
    }
    
    return [];
  }
};

// Fetch recent signals
export const fetchSignals = async (symbol, interval = '5m', limit = 100, retryCount = 2) => {
  try {
    const response = await api.get('/signals/recent', {
      params: { symbol, interval, limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching signals:', error);
    
    if (retryCount > 0 && (!error.response || error.response.status >= 500)) {
      console.log(`Retrying fetchSignals... (${retryCount} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchSignals(symbol, interval, limit, retryCount - 1);
    }
    
    return [];
  }
};

const apiService = {
  fetchPortfolio,
  fetchTransactionHistory,
  checkServerStatus,
  fetchBTCPrice,
  fetchTradingPairs,
  fetchSignals,
  api // Export the instance for direct use
};

export default apiService;