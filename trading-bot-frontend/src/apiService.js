/**
 * API Service - Centralized API handling
 * This service handles all API calls to the backend
 */

// Helper function to handle fetch errors
const handleFetchErrors = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: `HTTP error ${response.status}`
    }));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }
  return response.json();
};

// Fetch with timeout and retry functionality
const fetchWithRetry = async (url, options = {}, retries = 3, timeout = 10000) => {
  // Add timeout to fetch
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  options.signal = controller.signal;
  
  try {
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    return await handleFetchErrors(response);
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    if (retries <= 1) throw error;
    
    // Wait before retrying (exponential backoff)
    const delay = 1000 * Math.pow(2, 4 - retries);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    console.log(`Retrying request to ${url} (${retries - 1} retries left)`);
    return fetchWithRetry(url, options, retries - 1, timeout);
  }
};

// API Methods
const apiService = {
  // Portfolio & Transactions
  getPortfolio: async (userId = 'default') => {
    return fetchWithRetry(`/api/virtual-trade/portfolio?userId=${userId}`);
  },
  
  getTransactionHistory: async (userId = 'default') => {
    return fetchWithRetry(`/api/virtual-trade/history?userId=${userId}`);
  },
  
  executeTrade: async (tradeData) => {
    return fetchWithRetry('/api/virtual-trade/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tradeData)
    });
  },
  
  // Market Data
  getTradingPairs: async () => {
    return fetchWithRetry('/api/market-data/pairs');
  },
  
  getHistoricalData: async (symbol, interval = '1h', limit = 100) => {
    return fetchWithRetry(`/api/market-data/history/${symbol}?interval=${interval}&limit=${limit}`);
  },
  
  getCurrentPrice: async (symbol) => {
    return fetchWithRetry(`/api/market-data/price/${symbol}`);
  },
  
  // Signals
  getRecentSignals: async (symbol, interval = '5m', limit = 100) => {
    return fetchWithRetry(`/api/signals/recent?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  },
  
  // Bot Management
  getBotStatus: async () => {
    return fetchWithRetry('/api/bot/status');
  },
  
  startBot: async (symbol, interval = '5m', userId = 'default') => {
    return fetchWithRetry('/api/bot/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, interval, userId })
    });
  },
  
  stopBot: async (symbol, interval = '5m', userId = 'default') => {
    return fetchWithRetry('/api/bot/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, interval, userId })
    });
  },
  
  // Settings
  getBotSettings: async () => {
    return fetchWithRetry('/api/bot/settings');
  },
  
  saveBotSettings: async (settings) => {
    return fetchWithRetry('/api/bot/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  },
  
  // Server Health
  checkServerHealth: async () => {
    return fetchWithRetry('/api/health');
  }
};

export default apiService;