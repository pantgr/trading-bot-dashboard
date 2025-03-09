 import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useData } from '../contexts/DataContext';
import CandlestickChart from './CandlestickChart';
import ErrorMessage from './ErrorMessage';

const TradingBotPanel = () => {
  const { isConnected, connectionError, startBot, stopBot, subscribeToMarket } = useSocket();
  const { tradingPairs, botStatus, loading } = useData();
  
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('5m');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [error, setError] = useState(null);
  const [displayInfo, setDisplayInfo] = useState('Bitcoin');
  
  // Subscribe to price updates when symbol changes
  useEffect(() => {
    if (isConnected && symbol) {
      setError(null);
      subscribeToMarket(symbol, interval);
    }
  }, [isConnected, symbol, interval, subscribeToMarket]);
  
  // Update display info for the current symbol
  useEffect(() => {
    if (tradingPairs && tradingPairs.length > 0) {
      const pair = tradingPairs.find(p => p.symbol === symbol);
      if (pair) {
        setDisplayInfo(`${pair.baseAsset}/${pair.quoteAsset}`);
      } else {
        setDisplayInfo(symbol);
      }
    }
  }, [symbol, tradingPairs]);
  
  // Check if the bot is currently running for the selected symbol/interval
  const isBotRunning = () => {
    return botStatus && botStatus.activeSymbols && 
           botStatus.activeSymbols.includes(`${symbol}-${interval}-default`);
  };
  
  // Format price for display
  const formatPrice = (price) => {
    if (price === null || price === undefined) return 'Loading...';
    
    // Determine decimal places based on price magnitude
    let decimals = 2;
    if (price < 1) decimals = 8;
    else if (price < 10) decimals = 6;
    else if (price < 1000) decimals = 4;
    
    return price.toFixed(decimals);
  };
  
  // Handle starting the trading bot
  const handleStartBot = async () => {
    if (isStarting || !symbol) return;
    
    setIsStarting(true);
    setError(null);
    
    try {
      const started = startBot(symbol, interval, 'default');
      if (!started) {
        setError('Failed to start bot - connection issue');
      }
    } catch (err) {
      console.error('Error starting bot:', err);
      setError(`Failed to start bot: ${err.message}`);
    } finally {
      // Add a short delay to avoid UI flickering
      setTimeout(() => setIsStarting(false), 500);
    }
  };
  
  // Handle stopping the trading bot
  const handleStopBot = async () => {
    if (isStopping || !symbol) return;
    
    setIsStopping(true);
    setError(null);
    
    try {
      const stopped = stopBot(symbol, interval, 'default');
      if (!stopped) {
        setError('Failed to stop bot - connection issue');
      }
    } catch (err) {
      console.error('Error stopping bot:', err);
      setError(`Failed to stop bot: ${err.message}`);
    } finally {
      // Add a short delay to avoid UI flickering
      setTimeout(() => setIsStopping(false), 500);
    }
  };
  
  // Handle symbol change
  const handleSymbolChange = (e) => {
    const newSymbol = e.target.value;
    setSymbol(newSymbol);
  };
  
  // Handle interval change
  const handleIntervalChange = (e) => {
    const newInterval = e.target.value;
    setInterval(newInterval);
  };
  
  // Price update handler for the chart component
  const handlePriceUpdate = (price) => {
    setCurrentPrice(price);
  };
  
  if (connectionError) {
    return <ErrorMessage message={connectionError} />;
  }
  
  return (
    <div className="trading-bot-panel">
      <h2>Trading Bot Control Panel</h2>
      
      {error && (
        <div className="error-message">
          {error}
          <button 
            className="retry-button"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="control-row">
        <div className="form-group">
          <label className="form-label">Trading Pair</label>
          <select 
            className="form-select"
            value={symbol}
            onChange={handleSymbolChange}
            disabled={isBotRunning() || loading.tradingPairs}
          >
            {loading.tradingPairs ? (
              <option>Loading pairs...</option>
            ) : (
              tradingPairs.map(pair => (
                <option key={pair.symbol} value={pair.symbol}>
                  {pair.baseAsset}/{pair.quoteAsset}
                </option>
              ))
            )}
          </select>
        </div>
        
        <div className="form-group">
          <label className="form-label">Interval</label>
          <select 
            className="form-select"
            value={interval}
            onChange={handleIntervalChange}
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
        
        <div className="form-group">
          <label className="form-label">Status</label>
          <div className={`status-indicator ${isBotRunning() ? 'running' : 'stopped'}`}>
            {isBotRunning() ? 'Running' : 'Stopped'}
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Current Price</label>
          <div className="price-display">
            {currentPrice !== null ? formatPrice(currentPrice) : 'Loading...'}
          </div>
        </div>
      </div>
      
      <div className="selected-pair-info">
        <p>Currently monitoring: <strong>{displayInfo}</strong> with {interval} intervals</p>
      </div>
      
      <div className="button-row">
        {isBotRunning() ? (
          <button 
            className="stop-button" 
            onClick={handleStopBot} 
            disabled={isStopping}
          >
            {isStopping ? 'Stopping...' : 'Stop Bot'}
          </button>
        ) : (
          <button 
            className="start-button" 
            onClick={handleStartBot} 
            disabled={isStarting || loading.tradingPairs}
          >
            {isStarting ? 'Starting...' : 'Start Bot'}
          </button>
        )}
      </div>
      
      <CandlestickChart 
        symbol={symbol}
        interval={interval}
        onPriceUpdate={handlePriceUpdate}
      />
    </div>
  );
};

export default TradingBotPanel;