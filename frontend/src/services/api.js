// src/services/api.js
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

// Αντικείμενο με όλες τις λειτουργίες API
const apiService = {
  fetchPortfolio,
  fetchTransactionHistory,
  checkServerStatus
};

export default apiService;