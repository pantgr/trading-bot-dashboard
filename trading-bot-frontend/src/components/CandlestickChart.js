import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useData } from '../contexts/DataContext';

const CandlestickChart = ({ symbol, interval, onPriceUpdate }) => {
  const { socket, isConnected } = useSocket();
  const { tradingPairs } = useData();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [candles, setCandles] = useState([]);
  const [signals, setSignals] = useState([]);
  const [chartInfo, setChartInfo] = useState({
    baseAsset: '',
    quoteAsset: '',
    pairInfo: symbol
  });
  
  // Refs to track event listeners
  const priceCallbackRef = useRef(null);
  const signalCallbackRef = useRef(null);
  
  // Fetch initial candle data using the Fetch API instead of axios
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!symbol || !interval) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch historical candles
        const response = await fetch(`/api/market-data/history/${symbol}?interval=${interval}&limit=100`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data && Array.isArray(data)) {
          setCandles(data);
          
          // If we have data, update the current price
          if (data.length > 0) {
            const lastCandle = data[data.length - 1];
            if (lastCandle.close && onPriceUpdate) {
              onPriceUpdate(lastCandle.close);
            }
          }
        }
        
        // Fetch signals
        const signalsResponse = await fetch(`/api/signals/recent?symbol=${symbol}&interval=${interval}&limit=100`);
        if (!signalsResponse.ok) {
          throw new Error(`HTTP error! status: ${signalsResponse.status}`);
        }
        const signalsData = await signalsResponse.json();
        
        if (signalsData && Array.isArray(signalsData)) {
          setSignals(signalsData);
        }
        
        // Update pair information from the trading pairs context
        updatePairInfo(symbol);
        
      } catch (err) {
        console.error('Error fetching chart data:', err);
        setError('Failed to load chart data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
  }, [symbol, interval, onPriceUpdate]);
  
  // Update trading pair information from the context
  const updatePairInfo = (symbolToFind) => {
    if (tradingPairs && tradingPairs.length > 0) {
      const pairInfo = tradingPairs.find(pair => pair.symbol === symbolToFind);
      
      if (pairInfo) {
        setChartInfo({
          baseAsset: pairInfo.baseAsset,
          quoteAsset: pairInfo.quoteAsset,
          pairInfo: `${pairInfo.baseAsset}/${pairInfo.quoteAsset}`
        });
      } else {
        // If pair not found, just use the symbol
        setChartInfo({
          baseAsset: '',
          quoteAsset: '',
          pairInfo: symbolToFind
        });
      }
    }
  };
  
  // Update pair info when trading pairs are loaded
  useEffect(() => {
    if (tradingPairs && tradingPairs.length > 0) {
      updatePairInfo(symbol);
    }
  }, [tradingPairs, symbol]);
  
  // Set up socket event listeners for price updates and signals
  useEffect(() => {
    if (!socket || !isConnected || !symbol || !interval) return;
    
    // Handle price updates
    const handlePriceUpdate = (data) => {
      if (data.symbol === symbol) {
        // Update the current price
        if (data.price && onPriceUpdate) {
          onPriceUpdate(data.price);
        }
        
        // If candle data is available, update candles
        if (data.candle) {
          setCandles(prev => {
            const newCandles = [...prev];
            const candleIndex = newCandles.findIndex(c => c.time === data.candle.time);
            
            if (candleIndex >= 0) {
              // Update existing candle
              newCandles[candleIndex] = data.candle;
            } else {
              // Add new candle (and remove old ones to limit the array size)
              newCandles.push(data.candle);
              if (newCandles.length > 100) {
                newCandles.shift();
              }
            }
            
            return newCandles;
          });
        }
      }
    };
    
    // Handle trade signals
    const handleTradeSignal = (signal) => {
      if (signal.symbol === symbol) {
        setSignals(prev => {
          // Add new signal to the beginning and limit array size
          const newSignals = [signal, ...prev];
          if (newSignals.length > 100) {
            return newSignals.slice(0, 100);
          }
          return newSignals;
        });
      }
    };
    
    // Save the callbacks to refs so we can remove them properly
    priceCallbackRef.current = handlePriceUpdate;
    signalCallbackRef.current = handleTradeSignal;
    
    // Register event listeners
    socket.on('price_update', handlePriceUpdate);
    socket.on('trade_signal', handleTradeSignal);
    
    // Cleanup on unmount or when symbol/interval changes
    return () => {
      if (socket) {
        socket.off('price_update', priceCallbackRef.current);
        socket.off('trade_signal', signalCallbackRef.current);
      }
    };
  }, [socket, isConnected, symbol, interval, onPriceUpdate]);
  
  if (error) {
    return (
      <div className="chart-error">
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
  
  // Calculate buy and sell signals for display
  const buySignals = signals.filter(s => s.action === 'BUY').length;
  const sellSignals = signals.filter(s => s.action === 'SELL').length;
  
  return (
    <div className="candlestick-chart-container">
      {isLoading && (
        <div className="chart-loading">
          <div className="loading-spinner"></div>
          <p>Loading chart data...</p>
        </div>
      )}
      
      <div className="chart-header">
        <h3>{chartInfo.pairInfo} - {interval}</h3>
      </div>
      
      <div className="chart-wrapper">
        {/* In a real implementation, you would render an actual chart here
            using a library like ApexCharts, TradingView, or Lightweight Charts */}
        <div className="chart-placeholder">
          {candles.length > 0 ? (
            <div className="chart-summary">
              <p>Loaded {candles.length} candles for {chartInfo.pairInfo}</p>
              <p>Latest close: {candles[candles.length - 1].close}</p>
              <p>Open: {candles[candles.length - 1].open}</p>
              <p>High: {candles[candles.length - 1].high}</p>
              <p>Low: {candles[candles.length - 1].low}</p>
            </div>
          ) : (
            <p>No candle data available</p>
          )}
        </div>
      </div>
      
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-marker buy-marker">●</span>
          <span>Buy Signal ({buySignals})</span>
        </div>
        <div className="legend-item">
          <span className="legend-marker sell-marker">●</span>
          <span>Sell Signal ({sellSignals})</span>
        </div>
      </div>
      
      <div className="signals-list">
        <h4>Recent Signals</h4>
        {signals.length > 0 ? (
          <ul>
            {signals.slice(0, 5).map((signal, index) => (
              <li key={index} className={signal.action.toLowerCase()}>
                {signal.action} signal from {signal.indicator} at {new Date(signal.time).toLocaleTimeString()}
                {signal.reason && <span className="reason"> - {signal.reason}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p>No recent signals</p>
        )}
      </div>
    </div>
  );
};

export default CandlestickChart;