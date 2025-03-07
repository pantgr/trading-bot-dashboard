// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import TradingBotPanel from '../components/TradingBotPanel';
import { connectSocket } from '../services/socketService';
import axios from 'axios';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    // Φόρτωση αρχικών δεδομένων
    const fetchData = async () => {
      try {
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
    
    // Καθαρισμός κατά την αποσύνδεση
    return () => {
      socket.off('portfolio_update');
      socket.off('transaction_created');
    };
  }, []);

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Trading Bot Dashboard</h1>
      
      <div className="portfolio-summary">
        <div className="summary-card">
          <div className="label">Total Equity</div>
          <div className="value">${portfolio?.equity?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="summary-card">
          <div className="label">Available Balance</div>
          <div className="value">${portfolio?.balance?.toFixed(2) || '0.00'}</div>
        </div>
        <div className="summary-card">
          <div className="label">Assets Value</div>
          <div className="value">
            ${((portfolio?.equity || 0) - (portfolio?.balance || 0)).toFixed(2)}
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
                      <th>Avg. Price</th>
                      <th>Current Price</th>
                      <th>Value</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.assets.map((asset, index) => {
                      const value = asset.quantity * asset.currentPrice;
                      const cost = asset.quantity * asset.averagePrice;
                      const pnl = value - cost;
                      const pnlPercentage = (pnl / cost) * 100;
                      
                      return (
                        <tr key={index}>
                          <td>{asset.symbol}</td>
                          <td>{asset.quantity.toFixed(6)}</td>
                          <td>${asset.averagePrice.toFixed(2)}</td>
                          <td>${asset.currentPrice.toFixed(2)}</td>
                          <td>${value.toFixed(2)}</td>
                          <td className={pnl >= 0 ? 'profit' : 'loss'}>
                            ${pnl.toFixed(2)} ({pnlPercentage.toFixed(2)}%)
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
                    <th>Price</th>
                    <th>Value</th>
                    <th>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, index) => (
                    <tr key={index} className={tx.action === 'BUY' ? 'buy' : 'sell'}>
                      <td>{new Date(tx.timestamp).toLocaleString()}</td>
                      <td>{tx.action}</td>
                      <td>{tx.symbol}</td>
                      <td>{tx.quantity.toFixed(6)}</td>
                      <td>${tx.price.toFixed(2)}</td>
                      <td>${Math.abs(tx.value).toFixed(2)}</td>
                      <td>{tx.signal}</td>
                    </tr>
                  ))}
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