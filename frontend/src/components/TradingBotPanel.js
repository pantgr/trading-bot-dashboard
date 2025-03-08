// src/components/TradingBotPanel.js
import React, { useState, useEffect } from 'react';
import { connectSocket, startBot, stopBot } from '../services/socketService';
import CandlestickChartApex from './CandlestickChartApex';
import axios from 'axios';
import './TradingBotPanel.module.css';

const TradingBotPanel = () => {
  // Get saved state from localStorage or use defaults
  const getSavedState = () => {
    try {
      const savedState = localStorage.getItem('tradingBotState');
      return savedState ? JSON.parse(savedState) : null;
    } catch (e) {
      console.error("Error loading saved state:", e);
      return null;
    }
  };

  const savedState = getSavedState();
  
  // Initialize state with saved values or defaults
  const [symbol, setSymbol] = useState(savedState?.symbol || 'ETHBTC');
  const [interval, setInterval] = useState(savedState?.interval || '1m');
  const [isRunning, setIsRunning] = useState(false); // Always initialize as false and check with server
  const [signals, setSignals] = useState([]);
  const [lastPrice, setLastPrice] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuoteAsset, setSelectedQuoteAsset] = useState(savedState?.quoteAsset || 'BTC');
  
  // Trading pairs state
  const [availableSymbols, setAvailableSymbols] = useState([]);
  const [groupedSymbols, setGroupedSymbols] = useState({});
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(true);
  const [quoteAssets, setQuoteAssets] = useState([]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const stateToSave = {
      symbol,
      interval,
      quoteAsset: selectedQuoteAsset
    };
    
    localStorage.setItem('tradingBotState', JSON.stringify(stateToSave));
  }, [symbol, interval, selectedQuoteAsset]);

  // Connect to socket once when component mounts
  useEffect(() => {
    const socket = connectSocket();
    
    // Check if the bot is already running for this symbol/interval when component mounts
    const checkBotStatus = async () => {
      try {
        const response = await axios.get('/api/bot/active-symbols');
        if (response.data && Array.isArray(response.data)) {
          // Check if our symbol/interval combination is already being monitored
          const isActive = response.data.some(item => 
            item.symbol === symbol && item.interval === interval
          );
          setIsRunning(isActive);
        }
      } catch (error) {
        console.error('Error checking bot status:', error);
      }
    };
    
    checkBotStatus();
    
    return () => {
      // No need to disconnect socket here as it's shared across the app
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
    setIsLoading(true);
    
    const socket = connectSocket();
    
    // Fetch initial price
    const fetchInitialPrice = async () => {
      try {
        const response = await axios.get(`/api/market-data/price/${symbol}`);
        if (response.data && response.data.price) {
          setLastPrice(response.data.price);
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
        setIndicators(data.indicators?.current || null);
      }
    };
    
    const handleBotStarted = (data) => {
      if (data.symbol === symbol && data.interval === interval) {
        setIsRunning(true);
      }
    };
    
    const handleBotStopped = (data) => {
      if (data.symbol === symbol && data.interval === interval) {
        setIsRunning(false);
      }
    };
    
    const handleTradeSignal = (signal) => {
      if (signal.symbol === symbol) {
        setSignals(prev => {
          // Check if we already have this signal
          const isDuplicate = prev.some(
            s => s.time === signal.time && 
                 s.indicator === signal.indicator && 
                 s.action === signal.action
          );
          
          if (!isDuplicate) {
            const newSignals = [signal, ...prev].slice(0, 20);
            return newSignals;
          }
          
          return prev;
        });
      }
    };
    
    // Register all event listeners
    socket.on('price_update', handlePriceUpdate);
    socket.on('indicators_update', handleIndicatorsUpdate);
    socket.on('bot_started', handleBotStarted);
    socket.on('bot_stopped', handleBotStopped);
    socket.on('trade_signal', handleTradeSignal);
    
    // Reset signals when changing symbols but preserve other state
    setSignals([]);
    
    return () => {
      socket.off('price_update', handlePriceUpdate);
      socket.off('indicators_update', handleIndicatorsUpdate);
      socket.off('bot_started', handleBotStarted);
      socket.off('bot_stopped', handleBotStopped);
      socket.off('trade_signal', handleTradeSignal);
    };
  }, [symbol, interval]);

  const handleStartBot = async () => {
    startBot(symbol, interval);
    // We don't set isRunning here - we wait for the 'bot_started' event
  };

  const handleStopBot = async () => {
    stopBot(symbol, interval);
    // We don't set isRunning here - we wait for the 'bot_stopped' event
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

  // Style for all controls - making them exactly the same height
  const controlHeight = "42px";

  return (
    <div className="trading-bot-panel">
      <div className="bot-controls">
        <h2>Trading Bot Controls</h2>
        
        {/* TABLE LAYOUT FOR CONTROLS */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '15px 0', marginBottom: '15px' }}>
          <tbody>
            <tr>
              <td style={{ width: '20%', verticalAlign: 'bottom', padding: '0' }}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Quote Asset:</div>
                  {isLoadingSymbols ? (
                    <div style={{ 
                      height: controlHeight, 
                      lineHeight: controlHeight, 
                      backgroundColor: '#f7fafc', 
                      padding: '0 10px', 
                      borderRadius: '4px' 
                    }}>Loading...</div>
                  ) : (
                    <select 
                      value={selectedQuoteAsset} 
                      onChange={handleQuoteAssetChange}
                      disabled={isRunning}
                      style={{ 
                        height: controlHeight, 
                        width: '100%', 
                        padding: '0 10px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        boxSizing: 'border-box'
                      }}
                    >
                      {quoteAssets.map(quote => (
                        <option key={quote} value={quote}>
                          {quote === 'ALL' ? 'All Assets' : quote}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </td>
              
              <td style={{ width: '20%', verticalAlign: 'bottom', padding: '0' }}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Symbol:</div>
                  {isLoadingSymbols ? (
                    <div style={{ 
                      height: controlHeight, 
                      lineHeight: controlHeight, 
                      backgroundColor: '#f7fafc', 
                      padding: '0 10px', 
                      borderRadius: '4px' 
                    }}>Loading pairs...</div>
                  ) : (
                    <select 
                      value={symbol} 
                      onChange={handleSymbolChange}
                      disabled={isRunning}
                      style={{ 
                        height: controlHeight, 
                        width: '100%', 
                        padding: '0 10px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        boxSizing: 'border-box'
                      }}
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
              </td>
              
              <td style={{ width: '20%', verticalAlign: 'bottom', padding: '0' }}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Interval:</div>
                  <select 
                    value={interval} 
                    onChange={handleIntervalChange}
                    disabled={isRunning}
                    style={{ 
                      height: controlHeight, 
                      width: '100%', 
                      padding: '0 10px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      boxSizing: 'border-box'
                    }}
                  >
                    <option value="1m">1 minute</option>
                    <option value="5m">5 minutes</option>
                    <option value="15m">15 minutes</option>
                    <option value="1h">1 hour</option>
                    <option value="4h">4 hours</option>
                    <option value="1d">1 day</option>
                  </select>
                </div>
              </td>
              
              <td style={{ width: '20%', verticalAlign: 'bottom', padding: '0' }}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Bot Status:</div>
                  <div style={{ 
                    height: controlHeight, 
                    lineHeight: controlHeight, 
                    textAlign: 'center',
                    backgroundColor: isRunning ? '#48bb78' : '#f56565',
                    color: 'white',
                    fontWeight: 'bold',
                    borderRadius: '4px',
                    boxSizing: 'border-box'
                  }}>
                    {isRunning ? 'RUNNING' : 'STOPPED'}
                  </div>
                </div>
              </td>
              
              <td style={{ width: '20%', verticalAlign: 'bottom', padding: '0' }}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: '500', fontSize: '14px' }}>Current Price:</div>
                  <div style={{ 
                    height: controlHeight, 
                    lineHeight: controlHeight, 
                    backgroundColor: '#f7fafc', 
                    padding: '0 10px', 
                    borderRadius: '4px',
                    borderLeft: '4px solid #4299e1',
                    fontFamily: 'monospace',
                    fontWeight: 'bold',
                    boxSizing: 'border-box'
                  }}>
                    {isLoading ? 'Loading...' : formatPrice(lastPrice)}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        
        {/* Selected Pair Info */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '6px',
          padding: '12px 15px',
          marginBottom: '15px',
          borderLeft: '4px solid #3182ce'
        }}>
          <p style={{
            margin: 0,
            color: '#2d3748',
            fontSize: '15px'
          }}>Selected pair: <strong>{getSymbolDisplayName(symbol)}</strong></p>
        </div>
        
        {/* Button Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '20px'
        }}>
          {!isRunning ? (
            <button 
              onClick={handleStartBot}
              disabled={isLoadingSymbols}
              style={{
                height: '44px',
                padding: '0 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                minWidth: '180px',
                backgroundColor: '#48bb78',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              Start Bot
            </button>
          ) : (
            <button 
              onClick={handleStopBot}
              style={{
                height: '44px',
                padding: '0 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                minWidth: '180px',
                backgroundColor: '#f56565',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              Stop Bot
            </button>
          )}
        </div>
      </div>
      
      {/* Chart */}
      <div className="chart-section">
        <CandlestickChartApex symbol={symbol} interval={interval} />
      </div>
      
      {/* Indicators panel */}
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
        </div>
      ) : (
        <div className="indicators-panel">
          <h3>Technical Indicators</h3>
          <p>Waiting for indicator data...</p>
        </div>
      )}
      
      {/* Signals panel */}
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
    </div>
  );
};

export default TradingBotPanel;