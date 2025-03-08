// src/components/TradingBotPanel.js - Updated with ApexCharts and price loading fix
import React, { useState, useEffect } from 'react';
import { connectSocket, startBot, stopBot } from '../services/socketService';
import CandlestickChartApex from './CandlestickChartApex';
import axios from 'axios';

const TradingBotPanel = () => {
  const [symbol, setSymbol] = useState('ETHBTC');
  const [interval, setInterval] = useState('5m');
  const [isRunning, setIsRunning] = useState(false);
  const [signals, setSignals] = useState([]);
  const [lastPrice, setLastPrice] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current price when symbol changes
  useEffect(() => {
    setIsLoading(true);
    
    const fetchInitialPrice = async () => {
      try {
        // Get current price directly from API when component mounts or symbol changes
        const response = await axios.get(`/api/market-data/price/${symbol}`);
        if (response.data && response.data.price) {
          setLastPrice(response.data.price);
          console.log(`Initial price fetched for ${symbol}: ${response.data.price}`);
        }
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching initial price:', error);
        setIsLoading(false);
      }
    };

    fetchInitialPrice();
    
    const socket = connectSocket();
    
    // Listen for price updates with improved logging
    socket.on('price_update', (data) => {
      if (data.symbol === symbol) {
        console.log(`Received price update for ${symbol}: ${data.price}`);
        setLastPrice(data.price);
        setIsLoading(false);
      }
    });
    
    // Ακρόαση για ενημερώσεις δεικτών
    socket.on('indicators_update', (data) => {
      if (data.symbol === symbol) {
        setIndicators(data.indicators.current);
      }
    });
    
    // Ακρόαση για σήματα συναλλαγών
    socket.on('trade_signal', (signal) => {
      if (signal.symbol === symbol) {
        setSignals(prev => [signal, ...prev].slice(0, 20)); // Κρατάμε τα 20 πιο πρόσφατα
      }
    });
    
    // Ακρόαση για κατάσταση bot
    socket.on('bot_started', (data) => {
      if (data.symbol === symbol) {
        setIsRunning(true);
      }
    });
    
    socket.on('bot_stopped', (data) => {
      if (data.symbol === symbol) {
        setIsRunning(false);
      }
    });
    
    // Reset signals when symbol changes
    setSignals([]);
    
    return () => {
      socket.off('price_update');
      socket.off('indicators_update');
      socket.off('trade_signal');
      socket.off('bot_started');
      socket.off('bot_stopped');
    };
  }, [symbol]);

  const handleStartBot = () => {
    startBot(symbol, interval);
  };

  const handleStopBot = () => {
    stopBot(symbol, interval);
  };

  // Μορφοποίηση τιμής με BTC
  const formatBTCPrice = (price) => {
    return price ? `₿${parseFloat(price).toFixed(8)}` : 'Loading...';
  };

  const handleSymbolChange = (e) => {
    // Stop bot if running
    if (isRunning) {
      stopBot(symbol, interval);
    }
    setSymbol(e.target.value);
  };

  const handleIntervalChange = (e) => {
    // Stop bot if running
    if (isRunning) {
      stopBot(symbol, interval);
    }
    setInterval(e.target.value);
  };

  return (
    <div className="trading-bot-panel">
      <div className="bot-controls">
        <h2>Trading Bot Controls</h2>
        <div className="control-row">
          <div className="form-group">
            <label>Symbol:</label>
            <select 
              value={symbol} 
              onChange={handleSymbolChange}
              disabled={isRunning}
            >
              <option value="ETHBTC">Ethereum (ETH/BTC)</option>
              <option value="BNBBTC">Binance Coin (BNB/BTC)</option>
              <option value="ADABTC">Cardano (ADA/BTC)</option>
              <option value="DOGEBTC">Dogecoin (DOGE/BTC)</option>
              <option value="SOLBTC">Solana (SOL/BTC)</option>
              <option value="XRPBTC">Ripple (XRP/BTC)</option>
              <option value="DOTBTC">Polkadot (DOT/BTC)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Interval:</label>
            <select 
              value={interval} 
              onChange={handleIntervalChange}
              disabled={isRunning}
            >
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
              <option value="15m">15 minutes</option>
              <option value="1h">1 hour</option>
              <option value="4h">4 hours</option>
              <option value="1d">1 day</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Bot Status:</label>
            <div className={`status-indicator ${isRunning ? 'running' : 'stopped'}`}>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </div>
          </div>
          
          <div className="form-group">
            <label>Current Price:</label>
            <div className="price-display">
              {isLoading ? 'Loading...' : formatBTCPrice(lastPrice)}
            </div>
          </div>
        </div>
        
        <div className="button-row">
          {!isRunning ? (
            <button 
              className="start-button" 
              onClick={handleStartBot}
            >
              Start Bot
            </button>
          ) : (
            <button 
              className="stop-button" 
              onClick={handleStopBot}
            >
              Stop Bot
            </button>
          )}
        </div>
      </div>
      
      {/* Candlestick Chart */}
      <div className="chart-section">
        <CandlestickChartApex symbol={symbol} interval={interval} />
      </div>
      
      {indicators && (
        <div className="indicators-panel">
          <h3>Technical Indicators</h3>
          <div className="indicators-grid">
            <div className="indicator">
              <div className="indicator-label">RSI (14)</div>
              <div className={`indicator-value ${
                indicators.rsi < 30 ? 'oversold' : 
                indicators.rsi > 70 ? 'overbought' : ''
              }`}>
                {indicators.rsi.toFixed(2)}
              </div>
            </div>
            
            <div className="indicator">
              <div className="indicator-label">EMA 9</div>
              <div className="indicator-value">{indicators.ema9.toFixed(8)}</div>
            </div>
            
            <div className="indicator">
              <div className="indicator-label">EMA 21</div>
              <div className="indicator-value">{indicators.ema21.toFixed(8)}</div>
            </div>
            
            <div className="indicator">
              <div className="indicator-label">Fibonacci 61.8%</div>
              <div className="indicator-value">{indicators.fibonacci.level61_8.toFixed(8)}</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="signals-panel">
        <h3>Trading Signals</h3>
        {signals.length > 0 ? (
          <div className="signals-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Signal</th>
                  <th>Action</th>
                  <th>Price (BTC)</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, index) => (
                  <tr key={index} className={signal.action.toLowerCase()}>
                    <td>{new Date(signal.time).toLocaleTimeString()}</td>
                    <td>{signal.indicator}</td>
                    <td>{signal.action}</td>
                    <td>₿{parseFloat(signal.price).toFixed(8)}</td>
                    <td>{signal.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-signals">No signals detected yet</p>
        )}
      </div>
    </div>
  );
};

export default TradingBotPanel;