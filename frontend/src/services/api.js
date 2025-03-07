// src/services/api.js - Προσθήκη λειτουργιών για BTC
import axios from 'axios';

// Χρησιμοποιούμε σχετικό URL που θα περάσει μέσω του proxy
const API_URL = '/api';

// Δημιουργία του axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// API για το χαρτοφυλάκιο
export const fetchPortfolio = async (userId = 'default') => {
  try {
    const response = await api.get('/virtual-trade/portfolio', {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    throw error;
  }
};

// API για το ιστορικό συναλλαγών
export const fetchTransactionHistory = async (userId = 'default') => {
  try {
    const response = await api.get('/virtual-trade/history', {
      params: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
};

// API για έλεγχο κατάστασης του server
export const checkServerStatus = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Error checking server status:', error);
    throw error;
  }
};

// Νέο API για λήψη της τρέχουσας τιμής του BTC
export const fetchBTCPrice = async () => {
  try {
    const response = await api.get('/market-data/price/BTCUSDT');
    return response.data.price;
  } catch (error) {
    console.error('Error fetching BTC price:', error);
    throw error;
  }
};

// Νέο API για μετατροπή USD σε BTC
export const convertUSDtoBTC = async (usdAmount) => {
  try {
    const btcPrice = await fetchBTCPrice();
    return usdAmount / btcPrice;
  } catch (error) {
    console.error('Error converting USD to BTC:', error);
    throw error;
  }
};

// Νέο API για μετατροπή BTC σε USD
export const convertBTCtoUSD = async (btcAmount) => {
  try {
    const btcPrice = await fetchBTCPrice();
    return btcAmount * btcPrice;
  } catch (error) {
    console.error('Error converting BTC to USD:', error);
    throw error;
  }
};

// Αντικείμενο με όλες τις λειτουργίες API
const apiService = {
  fetchPortfolio,
  fetchTransactionHistory,
  checkServerStatus,
  fetchBTCPrice,
  convertUSDtoBTC,
  convertBTCtoUSD
};

export default apiService;