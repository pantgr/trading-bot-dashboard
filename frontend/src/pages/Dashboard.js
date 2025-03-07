// src/pages/Dashboard.js - Προσθήκη κουμπιού ρυθμίσεων
import React, { useState, useEffect } from 'react';
import TradingBotPanel from '../components/TradingBotPanel';
import BotSettingsPanel from '../components/BotSettingsPanel';
import { connectSocket } from '../services/socketService';
import axios from 'axios';
import '../components/BotSettingsPanel.css';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [btcPrice, setBtcPrice] = useState(null);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);

  useEffect(() => {
    // Φόρτωση αρχικών δεδομένων
    const fetchData = async () => {
      try {
        // Λήψη της τιμής του BTC σε USD για μετατροπές
        const btcPriceRes = await axios.get('/api/market-data/price/BTCUSDT');
        if (btcPriceRes.data && btcPriceRes.data.price) {
          setBtcPrice(btcPriceRes.data.price);
        }
        
        // Λήψη χαρτοφυλακίου από το API
        const portfolioRes = await axios.get('/api/virtual-trade/portfolio');
        setPortfolio(portfolioRes.data);
        
        // Λήψη ιστορικού συναλλαγών από το API
        const txRes = await axios.get('/api/virtual-trade/history');
        setTransactions(txRes.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Σύνδεση με WebSocket
    const socket = connectSocket();
    
    // Ακρόαση για ενημερώσεις χαρτοφυλακίου
    socket.on('portfolio_update', (updatedPortfolio) => {
      console.log('Received portfolio update:', updatedPortfolio);
      setPortfolio(updatedPortfolio);
    });
    
    // Ακρόαση για νέες συναλλαγές
    socket.on('transaction_created', (newTx) => {
      console.log('Received new transaction:', newTx);
      setTransactions(prev => [newTx, ...prev]);
    });
    
    // Ακρόαση για ενημερώσεις τιμής BTC
    socket.on('price_update', (data) => {
      if (data.symbol === 'BTCUSDT') {
        setBtcPrice(data.price);
      }
    });
    
    // Καθαρισμός κατά την αποσύνδεση
    return () => {
      socket.off('portfolio_update');
      socket.off('transaction_created');
      socket.off('price_update');
    };
  }, []);

  // Μετατροπή USD σε BTC
  const usdToBtc = (usdAmount) => {
    if (!btcPrice || !usdAmount) return 0;
    return usdAmount / btcPrice;
  };

  // Μορφοποίηση των τιμών BTC
  const formatBtcValue = (btcValue) => {
    return btcValue ? `₿${btcValue.toFixed(8)}` : '₿0.00000000';
  };

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Trading Bot Dashboard</h1>
        <button 
          className="settings-button"
          onClick={() => setIsSettingsPanelOpen(true)}
        >
          <i className="fas fa-cog"></i> Ρυθμίσεις Bot
        </button>
      </div>
      
      {/* Panel ρυθμίσεων Bot */}
      <BotSettingsPanel 
        isOpen={isSettingsPanelOpen} 
        onClose={() => setIsSettingsPanelOpen(false)} 
      />
      
      <div className="portfolio-summary">
        <div className="summary-card">
          <div className="label">Total Equity</div>
          <div className="value">
            {formatBtcValue(usdToBtc(portfolio?.equity || 0))}
            <div className="sub-value">${portfolio?.equity?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="label">Available Balance</div>
          <div className="value">
            {formatBtcValue(usdToBtc(portfolio?.balance || 0))}
            <div className="sub-value">${portfolio?.balance?.toFixed(2) || '0.00'}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="label">Assets Value</div>
          <div className="value">
            {formatBtcValue(usdToBtc((portfolio?.equity || 0) - (portfolio?.balance || 0)))}
            <div className="sub-value">
              ${((portfolio?.equity || 0) - (portfolio?.balance || 0)).toFixed(2)}
            </div>
          </div>
        </div>
        <div className="summary-card">
          <div className="label">BTC Price</div>
          <div className="value">
            ${btcPrice ? btcPrice.toFixed(2) : 'Loading...'}
          </div>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="bot-section">
          <TradingBotPanel />
        </div>
        
        <div className="portfolio-section">
          <h2>Portfolio</h2>
          <div className="portfolio-data">
            <div className="assets-table">
              <h3>Assets</h3>
              {portfolio?.assets?.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Quantity</th>
                      <th>Avg. Price (BTC)</th>
                      <th>Current Price (BTC)</th>
                      <th>Value (BTC)</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.assets.map((asset, index) => {
                      // Υπολογισμός τιμών σε BTC αν πρόκειται για ζεύγος με USDT
                      const priceBTC = asset.symbol.endsWith('USDT') 
                        ? asset.currentPrice / btcPrice 
                        : asset.currentPrice;
                      const avgPriceBTC = asset.symbol.endsWith('USDT') 
                        ? asset.averagePrice / btcPrice 
                        : asset.averagePrice;
                      
                      const value = asset.quantity * priceBTC;
                      const cost = asset.quantity * avgPriceBTC;
                      const pnl = value - cost;
                      const pnlPercentage = (pnl / cost) * 100;
                      
                      // Αλλάζουμε την εμφάνιση του συμβόλου αν είναι σε BTC
                      const displaySymbol = asset.symbol.replace('USDT', '');
                      
                      return (
                        <tr key={index}>
                          <td>{displaySymbol}</td>
                          <td>{asset.quantity.toFixed(6)}</td>
                          <td>{formatBtcValue(avgPriceBTC)}</td>
                          <td>{formatBtcValue(priceBTC)}</td>
                          <td>{formatBtcValue(value)}</td>
                          <td className={pnl >= 0 ? 'profit' : 'loss'}>
                            {formatBtcValue(pnl)} ({pnlPercentage.toFixed(2)}%)
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p>No assets in portfolio</p>
              )}
            </div>
          </div>
        </div>
        
        <div className="transaction-section">
          <h2>Transaction History</h2>
          {transactions?.length > 0 ? (
            <div className="transactions-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Action</th>
                    <th>Symbol</th>
                    <th>Quantity</th>
                    <th>Price (BTC)</th>
                    <th>Value (BTC)</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, index) => {
                    // Μετατροπή τιμών σε BTC αν χρειάζεται
                    const priceBTC = tx.symbol.endsWith('USDT') 
                      ? tx.price / (btcPrice || 1) 
                      : tx.price;
                    const valueBTC = tx.symbol.endsWith('USDT')
                      ? Math.abs(tx.value) / (btcPrice || 1)
                      : Math.abs(tx.value);
                    
                    // Αλλαγή εμφάνισης συμβόλου
                    const displaySymbol = tx.symbol.replace('USDT', '');
                    
                    return (
                      <tr key={index} className={tx.action === 'BUY' ? 'buy' : 'sell'}>
                        <td>{new Date(tx.timestamp).toLocaleString()}</td>
                        <td>{tx.action}</td>
                        <td>{displaySymbol}</td>
                        <td>{tx.quantity.toFixed(6)}</td>
                        <td>{formatBtcValue(priceBTC)}</td>
                        <td>{formatBtcValue(valueBTC)}</td>
                        <td>{tx.signal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No transaction history available</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;