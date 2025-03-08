// src/components/TradingBotPanel.js - Updated with all trading pairs
import React, { useState, useEffect } from 'react';
import { connectSocket, startBot, stopBot } from '../services/socketService';
import CandlestickChartApex from './CandlestickChartApex';
import axios from 'axios';

const TradingBotPanel = () => {
  const [symbol, setSymbol] = useState('ETHBTC'); // Default symbol
  const [interval, setInterval] = useState('1m');
  const [isRunning, setIsRunning] = useState(false);
  const [signals, setSignals] = useState([]);
  const [lastPrice, setLastPrice] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState({ socketEvents: [] });
  
  // State for available symbols
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [groupedSymbols, setGroupedSymbols] = useState({});
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  
  // State for quote asset filter
  const [selectedQuoteAsset, setSelectedQuoteAsset] = useState('ALL');
  const [quoteAssets, setQuoteAssets] = useState([]);

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

  // Fetch available trading pairs from Binance
  useEffect(() => {
    const fetchTradingPairs = async () => {
      try {
        setIsLoadingSymbols(true);
        const response = await axios.get('/api/market-data/pairs');
        
        // Filter for active trading pairs only
        const activePairs = response.data.filter(pair => pair.status === 'TRADING');
        
        console.log(`Found ${activePairs.length} active trading pairs`);
        setAvailableSymbols(activePairs);
        
        // Extract unique quote assets
        const quotesSet = new Set(activePairs.map(pair => pair.quoteAsset));
        const quotes = ['ALL', ...Array.from(quotesSet).sort()];
        setQuoteAssets(quotes);
        
        // Group symbols by quote asset
        const grouped = activePairs.reduce((acc, pair) => {
          if (!acc[pair.quoteAsset]) {
            acc[pair.quoteAsset] = [];
          }
          acc[pair.quoteAsset].push(pair);
          return acc;
        }, {});
        
        // Sort pairs within each group alphabetically by base asset
        Object.keys(grouped).forEach(quote => {
          grouped[quote].sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));
        });
        
        setGroupedSymbols(grouped);
      } catch (error) {
        console.error('Error fetching trading pairs:', error);
      } finally {
        setIsLoadingSymbols(false);
      }
    };
    
    fetchTradingPairs();
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
      
      if (signal.symbol === symbol) {
        console.log(`Signal matches current symbol ${symbol} - adding to display`);
        
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
  };

  const handleStopBot = () => {
    stopBot(symbol, interval);
  };

  // Format price based on quote asset
  const formatPrice = (price) => {
    if (!price) return 'Loading...';
    
    const symbolInfo = getSymbolInfo(symbol);
    const quoteAsset = symbolInfo?.quoteAsset || '';
    
    switch (quoteAsset) {
      case 'BTC':
        return `₿${parseFloat(price).toFixed(8)}`;
      case 'ETH':
        return `Ξ${parseFloat(price).toFixed(8)}`;
      case 'USDT':
      case 'BUSD':
      case 'USDC':
      case 'USD':
      case 'DAI':
        return `$${parseFloat(price).toFixed(quoteAsset === 'USDT' && parseFloat(price) < 0.01 ? 6 : 2)}`;
      case 'EUR':
        return `€${parseFloat(price).toFixed(2)}`;
      case 'GBP':
        return `£${parseFloat(price).toFixed(2)}`;
      default:
        return `${parseFloat(price).toFixed(8)} ${quoteAsset}`;
    }
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
  
  const handleQuoteAssetChange = (e) => {
    setSelectedQuoteAsset(e.target.value);
  };

  // Helper function to get symbol info
  const getSymbolInfo = (symbolString) => {
    return availableSymbols.find(pair => pair.symbol === symbolString);
  };

  // Helper function to get display name for a symbol
  const getSymbolDisplayName = (symbolString) => {
    const symbolInfo = getSymbolInfo(symbolString);
    if (symbolInfo) {
      return `${symbolInfo.baseAsset} (${symbolInfo.baseAsset}/${symbolInfo.quoteAsset})`;
    }
    return symbolString;
  };
  
  // Get filtered symbols based on selected quote asset
  const getFilteredSymbols = () => {
    if (selectedQuoteAsset === 'ALL') {
      // Return all symbols, but organized by quote asset
      return Object.entries(groupedSymbols);
    } else {
      // Return only symbols with the selected quote asset
      return groupedSymbols[selectedQuoteAsset] ? 
        [[selectedQuoteAsset, groupedSymbols[selectedQuoteAsset]]] : [];
    }
  };

  return (
    <div className="trading-bot-panel">
      <div className="bot-controls">
        <h2>Trading Bot Controls</h2>
        <div className="control-row">
          {/* Quote Asset Filter */}
          <div className="form-group">
            <label>Quote Asset:</label>
            {isLoadingSymbols ? (
              <div className="loading-indicator">Loading...</div>
            ) : (
              <select 
                value={selectedQuoteAsset} 
                onChange={handleQuoteAssetChange}
                disabled={isRunning}
                className="quote-asset-select"
              >
                {quoteAssets.map(quote => (
                  <option key={quote} value={quote}>
                    {quote === 'ALL' ? 'All Assets' : quote}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {/* Symbol Selection */}
          <div className="form-group">
            <label>Symbol:</label>
            {isLoadingSymbols ? (
              <div className="loading-indicator">Loading available pairs...</div>
            ) : (
              <select 
                value={symbol} 
                onChange={handleSymbolChange}
                disabled={isRunning}
                className="symbol-select"
              >
                {getFilteredSymbols().map(([quoteAsset, symbols]) => (
                  <optgroup key={quoteAsset} label={`${quoteAsset} Pairs`}>
                    {symbols.map(pair => (
                      <option key={pair.symbol} value={pair.symbol}>
                        {pair.baseAsset}/{pair.quoteAsset}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
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
              {isLoading ? 'Loading...' : formatPrice(lastPrice)}
            </div>
          </div>
        </div>
        
        <div className="selected-pair-info">
          <p>Selected pair: <strong>{getSymbolDisplayName(symbol)}</strong></p>
        </div>
        
        <div className="button-row">
          {!isRunning ? (
            <button 
              className="start-button" 
              onClick={handleStartBot}
              disabled={isLoadingSymbols}
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
                {signals.map((signal, index) => {
                  // Get the quote asset for this signal
                  const signalSymbolInfo = availableSymbols.find(pair => pair.symbol === signal.symbol);
                  const quoteAsset = signalSymbolInfo?.quoteAsset || '';
                  
                  // Format price based on quote asset
                  let formattedPrice;
                  switch (quoteAsset) {
                    case 'BTC':
                      formattedPrice = `₿${parseFloat(signal.price).toFixed(8)}`;
                      break;
                    case 'ETH':
                      formattedPrice = `Ξ${parseFloat(signal.price).toFixed(8)}`;
                      break;
                    case 'USDT':
                    case 'BUSD':
                    case 'USDC':
                    case 'USD':
                    case 'DAI':
                      formattedPrice = `$${parseFloat(signal.price).toFixed(2)}`;
                      break;
                    case 'EUR':
                      formattedPrice = `€${parseFloat(signal.price).toFixed(2)}`;
                      break;
                    case 'GBP':
                      formattedPrice = `£${parseFloat(signal.price).toFixed(2)}`;
                      break;
                    default:
                      formattedPrice = `${parseFloat(signal.price).toFixed(8)} ${quoteAsset}`;
                  }
                  
                  return (
                    <tr key={index} className={signal.action.toLowerCase()}>
                      <td>{new Date(signal.time).toLocaleTimeString()}</td>
                      <td>{signal.symbol}</td>
                      <td>{signal.indicator}</td>
                      <td>{signal.action}</td>
                      <td>{formattedPrice}</td>
                      <td>{signal.reason}</td>
                    </tr>
                  );
                })}
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
            <p>Current Symbol: {isLoadingSymbols ? 'Loading...' : getSymbolDisplayName(symbol)}</p>
            <p>Interval: {interval}</p>
            <p>Bot Running: {isRunning ? 'Yes' : 'No'}</p>
            <p>Signals Count: {signals.length}</p>
            <p>Available Trading Pairs: {availableSymbols.length}</p>
            <p>Available Quote Assets: {quoteAssets.length > 0 ? quoteAssets.join(', ') : 'Loading...'}</p>
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