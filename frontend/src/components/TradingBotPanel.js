// src/components/TradingBotPanel.js
import React, { useState, useEffect } from 'react';
import { connectSocket, startBot, stopBot } from '../services/socketService';

const TradingBotPanel = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState('5m');
  const [isRunning, setIsRunning] = useState(false);
  const [signals, setSignals] = useState([]);
  const [lastPrice, setLastPrice] = useState(null);
  const [indicators, setIndicators] = useState(null);

  useEffect(() => {
    const socket = connectSocket();
    
    // Ακρόαση για ενημερώσεις τιμών
    socket.on('price_update', (data) => {
      if (data.symbol === symbol) {
        setLastPrice(data.price);
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

  return (
    <div className="trading-bot-panel">
      <div className="bot-controls">
        <h2>Trading Bot Controls</h2>
        <div className="control-row">
          <div className="form-group">
            <label>Symbol:</label>
            <select 
              value={symbol} 
              onChange={(e) => setSymbol(e.target.value)}
              disabled={isRunning}
            >
              <option value="BTCUSDT">Bitcoin (BTC/USDT)</option>
              <option value="ETHUSDT">Ethereum (ETH/USDT)</option>
              <option value="BNBUSDT">Binance Coin (BNB/USDT)</option>
              <option value="ADAUSDT">Cardano (ADA/USDT)</option>
              <option value="DOGEUSDT">Dogecoin (DOGE/USDT)</option>
              <option value="SOLUSDT">Solana (SOL/USDT)</option>
            </select>
          </div>
          
          <div className="form-group">
            <label>Interval:</label>
            <select 
              value={interval} 
              onChange={(e) => setInterval(e.target.value)}
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
              {lastPrice ? `$${parseFloat(lastPrice).toFixed(2)}` : 'Loading...'}
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
              <div className="indicator-value">{indicators.ema9.toFixed(2)}</div>
            </div>
            
            <div className="indicator">
              <div className="indicator-label">EMA 21</div>
              <div className="indicator-value">{indicators.ema21.toFixed(2)}</div>
            </div>
            
            <div className="indicator">
              <div className="indicator-label">Fibonacci 61.8%</div>
              <div className="indicator-value">{indicators.fibonacci.level61_8.toFixed(2)}</div>
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
                  <th>Price</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((signal, index) => (
                  <tr key={index} className={signal.action.toLowerCase()}>
                    <td>{new Date(signal.time).toLocaleTimeString()}</td>
                    <td>{signal.indicator}</td>
                    <td>{signal.action}</td>
                    <td>${parseFloat(signal.price).toFixed(2)}</td>
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