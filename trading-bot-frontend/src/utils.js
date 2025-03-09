/**
 * Utility functions for the trading bot dashboard
 */

// Format currency value
export const formatCurrency = (value, currency = 'USD', decimals = 2) => {
  if (value === null || value === undefined) return 'N/A';
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 'N/A';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  
  return formatter.format(numValue);
};

// Format BTC value
export const formatBtcValue = (btcValue, includeBtcSymbol = true) => {
  if (btcValue === null || btcValue === undefined) return includeBtcSymbol ? '₿0.00000000' : '0.00000000';
  
  const value = parseFloat(btcValue);
  if (isNaN(value)) return includeBtcSymbol ? '₿0.00000000' : '0.00000000';
  
  const formatted = value.toFixed(8);
  return includeBtcSymbol ? `₿${formatted}` : formatted;
};

// Format date/time
export const formatDateTime = (timestamp, includeSeconds = false) => {
  if (!timestamp) return 'N/A';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error';
  }
};

// Determine price precision based on magnitude
export const getPricePrecision = (price) => {
  if (price === null || price === undefined) return 2;
  
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return 2;
  
  if (numPrice < 0.000001) return 10;
  if (numPrice < 0.00001) return 9;
  if (numPrice < 0.0001) return 8;
  if (numPrice < 0.001) return 7;
  if (numPrice < 0.01) return 6;
  if (numPrice < 0.1) return 5;
  if (numPrice < 1) return 4;
  if (numPrice < 10) return 3;
  if (numPrice < 1000) return 2;
  return 1;
};

// Format price with appropriate precision
export const formatPrice = (price, symbol) => {
  if (price === null || price === undefined) return 'N/A';
  
  const numPrice = parseFloat(price);
  if (isNaN(numPrice)) return 'N/A';
  
  const precision = getPricePrecision(numPrice);
  
  // Add symbols based on quote asset
  let prefix = '';
  if (symbol) {
    if (symbol.endsWith('USDT') || symbol.endsWith('USD')) {
      prefix = '$';
    } else if (symbol.endsWith('EUR')) {
      prefix = '€';
    } else if (symbol.endsWith('BTC')) {
      prefix = '₿';
    }
  }
  
  return `${prefix}${numPrice.toFixed(precision)}`;
};

// Format percentage values
export const formatPercentage = (value, decimals = 2) => {
  if (value === null || value === undefined) return 'N/A';
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 'N/A';
  
  return `${numValue.toFixed(decimals)}%`;
};

// Convert USD to BTC
export const usdToBtc = (usdAmount, btcPrice) => {
  if (!usdAmount || !btcPrice) return 0;
  
  const amount = parseFloat(usdAmount);
  const price = parseFloat(btcPrice);
  
  if (isNaN(amount) || isNaN(price) || price === 0) return 0;
  
  return amount / price;
};

// Convert BTC to USD
export const btcToUsd = (btcAmount, btcPrice) => {
  if (!btcAmount || !btcPrice) return 0;
  
  const amount = parseFloat(btcAmount);
  const price = parseFloat(btcPrice);
  
  if (isNaN(amount) || isNaN(price)) return 0;
  
  return amount * price;
};

// Debounce function for input handlers
export const debounce = (func, wait = 300) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for preventing excessive API calls
export const throttle = (func, limit = 300) => {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

// Generate a unique ID
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// Extract base and quote assets from symbol
export const parseSymbol = (symbol) => {
  if (!symbol) return { baseAsset: '', quoteAsset: '' };
  
  // Common quote assets to check for
  const quoteAssets = ['USDT', 'BTC', 'ETH', 'BNB', 'BUSD', 'USD', 'EUR'];
  
  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      return {
        baseAsset: symbol.slice(0, symbol.length - quote.length),
        quoteAsset: quote
      };
    }
  }
  
  // Default fallback if no pattern is matched
  return {
    baseAsset: symbol,
    quoteAsset: ''
  };
};