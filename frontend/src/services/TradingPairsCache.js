// src/services/TradingPairsCache.js
import axios from 'axios';

// Singleton για caching των trading pairs σε επίπεδο εφαρμογής
class TradingPairsCache {
  constructor() {
    this.pairs = null;
    this.isFetching = false;
    this.lastFetchTime = null;
    this.fetchPromise = null;
    this.CACHE_EXPIRY = 1000 * 60 * 60; // 1 ώρα σε milliseconds
  }

  // Λήψη των trading pairs με υποστήριξη caching
  async getPairs() {
    // Αν υπάρχει ήδη μια κλήση σε εξέλιξη, επέστρεψε την υπόσχεση της
    if (this.isFetching && this.fetchPromise) {
      console.log('Trading pairs fetch already in progress, returning existing promise');
      return this.fetchPromise;
    }

    // Αν έχουμε ήδη τα δεδομένα και δεν έχει λήξει το cache
    const cacheValid = this.pairs && 
                      this.lastFetchTime && 
                      (Date.now() - this.lastFetchTime < this.CACHE_EXPIRY);
    
    if (cacheValid) {
      console.log('Using cached trading pairs');
      return this.pairs;
    }

    // Διαφορετικά, κάνε νέα κλήση
    console.log('Fetching all trading pairs from Binance');
    this.isFetching = true;
    
    this.fetchPromise = axios.get('/api/market-data/pairs')
      .then(response => {
        this.pairs = response.data;
        this.lastFetchTime = Date.now();
        console.log(`Fetched ${this.pairs.length} trading pairs from Binance`);
        return this.pairs;
      })
      .catch(error => {
        console.error('Error fetching trading pairs:', error);
        throw error;
      })
      .finally(() => {
        this.isFetching = false;
      });
    
    return this.fetchPromise;
  }

  // Εύρεση συγκεκριμένου trading pair
  async findPair(symbol) {
    const pairs = await this.getPairs();
    return pairs.find(pair => pair.symbol === symbol);
  }

  // Reset του cache (αν χρειαστεί)
  clearCache() {
    this.pairs = null;
    this.lastFetchTime = null;
    console.log('Trading pairs cache cleared');
  }
}

// Εξαγωγή ενός singleton instance
const tradingPairsCache = new TradingPairsCache();
export default tradingPairsCache;