// src/components/TradingBotPanel.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CandlestickChartApex from './CandlestickChartApex';
import { startBot, stopBot, connectSocket } from '../services/socketService';
import styles from './TradingBotPanel.module.css';

const TradingBotPanel = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('5m');
  const [availablePairs, setAvailablePairs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [botStatus, setBotStatus] = useState({
    isRunning: false,
    activeSymbols: []
  });
  const [startingBot, setStartingBot] = useState(false);
  const [stoppingBot, setStoppingBot] = useState(false);
  const [signals, setSignals] = useState([]);
  const [baseAsset, setBaseAsset] = useState('');
  const [quoteAsset, setQuoteAsset] = useState('');

  // Fetch available trading pairs
  useEffect(() => {
    const fetchTradingPairs = async () => {
      try {
        const response = await axios.get('/api/market-data/pairs');
        // Filter for active trading pairs only
        const activePairs = response.data.filter(pair => pair.status === 'TRADING');
        // Sort by volume or another relevant factor if available
        // For now, just alphabetically
        activePairs.sort((a, b) => a.symbol.localeCompare(b.symbol));
        setAvailablePairs(activePairs);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching trading pairs:', error);
        setIsLoading(false);
      }
    };

    fetchTradingPairs();
  }, []);

  // Fetch initial bot status
  useEffect(() => {
    const fetchBotStatus = async () => {
      try {
        const response = await axios.get('/api/bot/status');
        setBotStatus(response.data);
      } catch (error) {
        console.error('Error fetching bot status:', error);
      }
    };

    fetchBotStatus();

    // Set up interval to periodically check bot status
    const statusInterval = setInterval(fetchBotStatus, 30000); // Check every 30 seconds

    return () => clearInterval(statusInterval);
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const socket = connectSocket();
    
    // Listen for price updates
    socket.on('price_update', (data) => {
      if (data.symbol === symbol) {
        setCurrentPrice(data.price);
      }
    });
    
    // Listen for bot status changes
    socket.on('bot_started', (data) => {
      if (data.symbol === symbol) {
        setStartingBot(false);
        setBotStatus(prev => ({
          ...prev,
          isRunning: true,
          activeSymbols: [...prev.activeSymbols, `${data.symbol}-${data.interval}-${data.userId}`]
        }));
      }
    });
    
    socket.on('bot_stopped', (data) => {
      if (data.symbol === symbol) {
        setStoppingBot(false);
        
        // Remove this symbol from active symbols
        setBotStatus(prev => ({
          ...prev,
          activeSymbols: prev.activeSymbols.filter(
            s => s !== `${data.symbol}-${data.interval}-${data.userId}`
          ),
          isRunning: prev.activeSymbols.length > 1 // Will still be running if there are other symbols
        }));
      }
    });
    
    // Listen for trade signals
    socket.on('trade_signal', (signal) => {
      if (signal.symbol === symbol) {
        setSignals(prev => [...prev, signal]);
      }
    });
    
    // Cleanup on unmount
    return () => {
      socket.off('price_update');
      socket.off('bot_started');
      socket.off('bot_stopped');
      socket.off('trade_signal');
    };
  }, [symbol]);

  // Update base/quote assets when symbol changes
  useEffect(() => {
    if (symbol && availablePairs.length > 0) {
      const pair = availablePairs.find(p => p.symbol === symbol);
      if (pair) {
        setBaseAsset(pair.baseAsset);
        setQuoteAsset(pair.quoteAsset);
      }
    }
  }, [symbol, availablePairs]);

  // When symbol changes, fetch recent signals
  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await axios.get('/api/signals/recent', {
          params: {
            symbol,
            interval,
            limit: 100
          }
        });
        setSignals(response.data || []);
      } catch (error) {
        console.error('Error fetching signals:', error);
      }
    };

    if (symbol) {
      fetchSignals();
    }
  }, [symbol, interval]);

  // Check if the bot is currently running for the selected symbol/interval
  const isBotRunning = () => {
    return botStatus.activeSymbols.includes(`${symbol}-${interval}-default`);
  };

  // Format price for display
  const formatPrice = (price) => {
    if (!price) return 'Loading...';
    
    // Determine decimal places based on price magnitude
    let decimals = 2;
    if (price < 1) decimals = 8;
    else if (price < 10) decimals = 6;
    else if (price < 1000) decimals = 4;
    
    return price.toFixed(decimals);
  };

  // Handle starting the trading bot
  const handleStartBot = async () => {
    if (startingBot || !symbol) return;
    
    setStartingBot(true);
    try {
      await axios.post('/api/bot/start', {
        symbol,
        interval,
        userId: 'default'
      });
      
      // Bot status will be updated via socket events
      startBot(symbol, interval, 'default');
    } catch (error) {
      console.error('Error starting trading bot:', error);
      setStartingBot(false);
    }
  };

  // Handle stopping the trading bot
  const handleStopBot = async () => {
    if (stoppingBot || !symbol) return;
    
    setStoppingBot(true);
    try {
      await axios.post('/api/bot/stop', {
        symbol,
        interval,
        userId: 'default'
      });
      
      // Bot status will be updated via socket events
      stopBot(symbol, interval, 'default');
    } catch (error) {
      console.error('Error stopping trading bot:', error);
      setStoppingBot(false);
    }
  };

  return (
    <div>
      <h2>Trading Bot Control Panel</h2>
      
      <div className={styles.controlRow}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Trading Pair</label>
          <select 
            className={styles.formSelect}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            disabled={isBotRunning() || isLoading}
          >
            {isLoading ? (
              <option>Loading pairs...</option>
            ) : (
              availablePairs.map(pair => (
                <option key={pair.symbol} value={pair.symbol}>
                  {pair.baseAsset}/{pair.quoteAsset}
                </option>
              ))
            )}
          </select>
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Interval</label>
          <select 
            className={styles.formSelect}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            disabled={isBotRunning()}
          >
            <option value="1m">1 minute</option>
            <option value="5m">5 minutes</option>
            <option value="15m">15 minutes</option>
            <option value="30m">30 minutes</option>
            <option value="1h">1 hour</option>
            <option value="4h">4 hours</option>
            <option value="1d">1 day</option>
          </select>
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Status</label>
          {isLoading ? (
            <div className={styles.loadingIndicator}>Loading...</div>
          ) : (
            <div className={`${styles.statusIndicator} ${isBotRunning() ? styles.running : styles.stopped}`}>
              {isBotRunning() ? 'Running' : 'Stopped'}
            </div>
          )}
        </div>
        
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Current Price</label>
          <div className={styles.priceDisplay}>
            {currentPrice ? formatPrice(currentPrice) : 'Loading...'}
          </div>
        </div>
      </div>
      
      {baseAsset && quoteAsset && (
        <div className={styles.selectedPairInfo}>
          <p>Currently monitoring: <strong>{baseAsset}/{quoteAsset}</strong> with {interval} intervals</p>
        </div>
      )}
      
      <div className={styles.buttonRow}>
        {isBotRunning() ? (
          <button 
            className={styles.stopButton} 
            onClick={handleStopBot} 
            disabled={stoppingBot}
          >
            {stoppingBot ? 'Stopping...' : 'Stop Bot'}
          </button>
        ) : (
          <button 
            className={styles.startButton} 
            onClick={handleStartBot} 
            disabled={startingBot || isLoading}
          >
            {startingBot ? 'Starting...' : 'Start Bot'}
          </button>
        )}
      </div>
      
      {/* Render the candlestick chart with the current symbol and interval */}
      <CandlestickChartApex 
        symbol={symbol} 
        interval={interval} 
        initialSignals={signals}
      />
    </div>
  );
};

export default TradingBotPanel;