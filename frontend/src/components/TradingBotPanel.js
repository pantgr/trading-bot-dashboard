// src/components/TradingBotPanel.js - Πλήρης διόρθωση
import React, { useState, useEffect } from 'react';
import { connectSocket, startBot, stopBot } from '../services/socketService';
import CandlestickChartApex from './CandlestickChartApex';
import axios from 'axios';

const TradingBotPanel = () => {
  const [symbol, setSymbol] = useState('ETHBTC'); // Changed from SOLBTC to ETHBTC as default
  const [interval, setInterval] = useState('1m');  // Change to 1m to match logs
  const [isRunning, setIsRunning] = useState(false);
  const [signals, setSignals] = useState([]);
  const [lastPrice, setLastPrice] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ socketEvents: [] });

  // Connect to socket once when component mounts
  useEffect(() => {
    console.log('TradingBotPanel: Initializing socket connection');
    const socket = connectSocket();
    
    // Listen for general events for debugging
    const handleAnyEvent = (event, ...args) => {
      console.log(`[Component received] ${event}:`, args);
      setDebugInfo(prev => ({
        ...prev,
        socketEvents: [{ time: new Date().toLocaleTimeString(), event, args }, ...prev.socketEvents].slice(0, 20)
      }));
    };
    
    socket.onAny(handleAnyEvent);
    
    // Send a ping to check connection
    socket.emit('ping', { time: Date.now() });
    
    return () => {
      socket.offAny(handleAnyEvent);
    };
  }, []);

  // Setup data and event listeners when symbol changes
  useEffect(() => {
    console.log(`TradingBotPanel: Setting up for symbol ${symbol}`);
    setIsLoading(true);
    
    const socket = connectSocket();
    
    // Fetch initial price
    const fetchInitialPrice = async () => {
      try {
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
    
    // Handlers for various events
    const handlePriceUpdate = (data) => {
      if (data.symbol === symbol) {
        setLastPrice(data.price);
      }
    };
    
    const handleIndicatorsUpdate = (data) => {
      if (data.symbol === symbol) {
        console.log('Received indicators update:', data.indicators);
        setIndicators(data.indicators?.current || null);
      }
    };
    
    const handleBotStarted = (data) => {
      if (data.symbol === symbol) {
        setIsRunning(true);
      }
    };
    
    const handleBotStopped = (data) => {
      if (data.symbol === symbol) {
        setIsRunning(false);
      }
    };
    
    const handleTradeSignal = (signal) => {
      console.log(`[Component] Trade signal received: ${signal.action} ${signal.symbol} (${signal.indicator})`);
      
      // Fix: Also handle BTCUSDT signals
      if (signal.symbol === symbol || signal.symbol === 'BTCUSDT') {
        console.log(`Signal matches current symbol ${symbol} or BTCUSDT - adding to display`);
        
        setSignals(prev => {
          // Check if we already have this signal
          const isDuplicate = prev.some(
            s => s.time === signal.time && 
                 s.indicator === signal.indicator && 
                 s.action === signal.action
          );
          
          if (!isDuplicate) {
            const newSignals = [signal, ...prev].slice(0, 20);
            console.log(`Updated signals (${newSignals.length}):`, newSignals);
            return newSignals;
          }
          
          console.log('Duplicate signal - ignoring');
          return prev;
        });
      } else {
        console.log(`Signal for ${signal.symbol} doesn't match ${symbol} - ignoring`);
      }
    };
    
    // Register all event listeners
    socket.on('price_update', handlePriceUpdate);
    socket.on('indicators_update', handleIndicatorsUpdate);
    socket.on('bot_started', handleBotStarted);
    socket.on('bot_stopped', handleBotStopped);
    socket.on('trade_signal', handleTradeSignal);
    
    // No test signals - removed
    
    // Reset signals when changing symbols
    setSignals([]);
    
    return () => {
      console.log(`Cleaning up listeners for ${symbol}`);
      socket.off('price_update', handlePriceUpdate);
      socket.off('indicators_update', handleIndicatorsUpdate);
      socket.off('bot_started', handleBotStarted);
      socket.off('bot_stopped', handleBotStopped);
      socket.off('trade_signal', handleTradeSignal);
    };
  }, [symbol]);

  const handleStartBot = () => {
    startBot(symbol, interval);
    
    // Also explicitly subscribe to BTCUSDT signals if needed
    const socket = connectSocket();
    socket.emit('subscribe_market', { symbol: 'BTCUSDT', interval: '1m' });
  };

  const handleStopBot = () => {
    stopBot(symbol, interval);
  };
  
  // Test signal function removed

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
              <option value="BTCUSDT">Bitcoin (BTC/USDT)</option>
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
          
          {/* Test signal button removed */}
        </div>
      </div>
      
      {/* Candlestick Chart */}
      <div className="chart-section">
        <CandlestickChartApex symbol={symbol} interval={interval} />
      </div>
      
      {/* Indicators with improved error handling and debugging */}
      {indicators ? (
        <div className="indicators-panel">
          <h3>Technical Indicators</h3>
          <div className="indicators-grid">
            {indicators.rsi !== undefined && (
              <div className="indicator">
                <div className="indicator-label">RSI (14)</div>
                <div className={`indicator-value ${
                  indicators.rsi < 30 ? 'oversold' : 
                  indicators.rsi > 70 ? 'overbought' : ''
                }`}>
                  {typeof indicators.rsi === 'number' ? indicators.rsi.toFixed(2) : 'N/A'}
                </div>
              </div>
            )}
            
            {indicators.ema9 !== undefined && (
              <div className="indicator">
                <div className="indicator-label">EMA 9</div>
                <div className="indicator-value">
                  {typeof indicators.ema9 === 'number' ? indicators.ema9.toFixed(8) : 'N/A'}
                </div>
              </div>
            )}
            
            {indicators.ema21 !== undefined && (
              <div className="indicator">
                <div className="indicator-label">EMA 21</div>
                <div className="indicator-value">
                  {typeof indicators.ema21 === 'number' ? indicators.ema21.toFixed(8) : 'N/A'}
                </div>
              </div>
            )}
            
            {indicators.fibonacci && indicators.fibonacci.level61_8 !== undefined && (
              <div className="indicator">
                <div className="indicator-label">Fibonacci 61.8%</div>
                <div className="indicator-value">
                  {typeof indicators.fibonacci.level61_8 === 'number' 
                    ? indicators.fibonacci.level61_8.toFixed(8) 
                    : 'N/A'}
                </div>
              </div>
            )}
          </div>

          {/* Debug info */}
          <details style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            <summary>Debug Indicators</summary>
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(indicators, null, 2)}
            </pre>
          </details>
        </div>
      ) : (
        <div className="indicators-panel">
          <h3>Technical Indicators</h3>
          <p>Waiting for indicator data...</p>
        </div>
      )}
      
      {/* Trading Signals Panel with Debug Info */}
      <div className="signals-panel">
        <h3>Trading Signals {signals.length > 0 ? `(${signals.length})` : ''}</h3>
        {signals.length > 0 ? (
          <div className="signals-table">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Signal</th>
                  <th>Action</th>
                  <th>Price</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, index) => (
                  <tr key={index} className={signal.action.toLowerCase()}>
                    <td>{new Date(signal.time).toLocaleTimeString()}</td>
                    <td>{signal.symbol}</td>
                    <td>{signal.indicator}</td>
                    <td>{signal.action}</td>
                    <td>
                      {signal.symbol === 'BTCUSDT' 
                        ? `$${parseFloat(signal.price).toFixed(2)}` 
                        : `₿${parseFloat(signal.price).toFixed(8)}`}
                    </td>
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
      
      {/* Debug Panel */}
      <div style={{marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px'}}>
        <details>
          <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>Debug Information</summary>
          <div>
            <p>Current Symbol: {symbol}</p>
            <p>Interval: {interval}</p>
            <p>Bot Running: {isRunning ? 'Yes' : 'No'}</p>
            <p>Signals Count: {signals.length}</p>
            <p>Socket Events Received:</p>
            <ul style={{maxHeight: '200px', overflow: 'auto', fontSize: '12px'}}>
              {debugInfo.socketEvents.map((event, i) => (
                <li key={i}>
                  {event.time}: {event.event}
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
};

export default TradingBotPanel;