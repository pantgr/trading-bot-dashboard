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
    // Load initial data
    const fetchData = async () => {
      try {
        // Get BTC price in USD for conversions
        const btcPriceRes = await axios.get('/api/market-data/price/BTCUSDT');
        if (btcPriceRes.data && btcPriceRes.data.price) {
          setBtcPrice(btcPriceRes.data.price);
        }
        
        // Get portfolio from API
        const portfolioRes = await axios.get('/api/virtual-trade/portfolio');
        setPortfolio(portfolioRes.data);
        
        // Get transaction history from API
        const txRes = await axios.get('/api/virtual-trade/history');
        setTransactions(txRes.data);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Connect to WebSocket
    const socket = connectSocket();
    
    // Listen for portfolio updates
    socket.on('portfolio_update', (updatedPortfolio) => {
      setPortfolio(updatedPortfolio);
    });
    
    // Listen for new transactions
    socket.on('transaction_created', (newTx) => {
      setTransactions(prev => [newTx, ...prev]);
    });
    
    // Listen for BTC price updates
    socket.on('price_update', (data) => {
      if (data.symbol === 'BTCUSDT') {
        setBtcPrice(data.price);
      }
    });
    
    // Cleanup on unmount
    return () => {
      socket.off('portfolio_update');
      socket.off('transaction_created');
      socket.off('price_update');
    };
  }, []);

  // Convert USD to BTC - fixed calculation
  const usdToBtc = (usdAmount) => {
    if (!btcPrice || !usdAmount) return 0;
    return usdAmount / btcPrice;
  };

  // Format BTC values
  const formatBtcValue = (btcValue) => {
    return btcValue ? `₿${btcValue.toFixed(8)}` : '₿0.00000000';
  };

  // FIXED: Calculate total assets value correctly in BTC
  const calculateAssetsValueBTC = () => {
    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
      return 0;
    }

    return portfolio.assets.reduce((total, asset) => {
      let assetValueBTC = 0;
      
      if (asset.symbol.endsWith('BTC')) {
        // BTC pairs already have price in BTC
        assetValueBTC = asset.quantity * asset.currentPrice;
      } else if (asset.symbol.endsWith('USDT') && btcPrice) {
        // USDT pairs need conversion to BTC
        assetValueBTC = asset.quantity * asset.currentPrice / btcPrice;
      }
      
      console.log(`Asset ${asset.symbol}: quantity=${asset.quantity}, price=${asset.currentPrice}, valueBTC=${assetValueBTC}`);
      
      return total + assetValueBTC;
    }, 0);
  };

  // FIXED: Calculate total assets value in USD
  const calculateAssetsValueUSD = () => {
    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
      return 0;
    }

    return portfolio.assets.reduce((total, asset) => {
      let assetValueUSD = 0;
      
      if (asset.symbol.endsWith('BTC') && btcPrice) {
        // Convert BTC pairs to USD
        assetValueUSD = asset.quantity * asset.currentPrice * btcPrice;
      } else if (asset.symbol.endsWith('USDT')) {
        // USDT pairs already have price in USD
        assetValueUSD = asset.quantity * asset.currentPrice;
      }
      
      return total + assetValueUSD;
    }, 0);
  };

  // Use the correct values for display
  const assetsBTC = calculateAssetsValueBTC();
  const assetsUSD = calculateAssetsValueUSD();

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
          <i className="fas fa-cog"></i> Bot Settings
        </button>
      </div>
      
      <BotSettingsPanel 
        isOpen={isSettingsPanelOpen} 
        onClose={() => setIsSettingsPanelOpen(false)} 
      />
      
      <div className="portfolio-summary">
        <div className="summary-card">
          <div className="label">Total Equity</div>
          <div className="value">
            {formatBtcValue(usdToBtc(portfolio?.balance || 0) + assetsBTC)}
            <div className="sub-value">${((portfolio?.balance || 0) + assetsUSD).toFixed(2)}</div>
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
            {formatBtcValue(assetsBTC)}
            <div className="sub-value">
              ${assetsUSD.toFixed(2)}
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
                      // FIXED: Correct calculation of asset values in BTC
                      const isBtcPair = asset.symbol.endsWith('BTC');
                      
                      // Calculate BTC price correctly for different asset types
                      const priceBTC = isBtcPair 
                        ? asset.currentPrice  // Already in BTC
                        : (asset.currentPrice / btcPrice); // Convert from USDT
                      
                      const avgPriceBTC = isBtcPair 
                        ? asset.averagePrice  // Already in BTC
                        : (asset.averagePrice / btcPrice); // Convert from USDT
                      
                      // Calculate value and cost in BTC
                      const value = asset.quantity * priceBTC;
                      const cost = asset.quantity * avgPriceBTC;
                      const pnl = value - cost;
                      const pnlPercentage = cost > 0 ? (pnl / cost) * 100 : 0;
                      
                      // Display symbol without the quote asset for readability
                      const displaySymbol = isBtcPair 
                        ? asset.symbol.replace('BTC', '') 
                        : asset.symbol.replace('USDT', '');
                      
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
                    // FIXED: Correct calculation of transaction values in BTC
                    const isBtcPair = tx.symbol.endsWith('BTC');
                    
                    const priceBTC = isBtcPair
                      ? tx.price
                      : (tx.price / (btcPrice || 1));
                      
                    const valueBTC = isBtcPair
                      ? Math.abs(tx.value)
                      : Math.abs(tx.value) / (btcPrice || 1);
                    
                    // Display symbol without the quote asset for readability
                    const displaySymbol = isBtcPair
                      ? tx.symbol.replace('BTC', '')
                      : tx.symbol.replace('USDT', '');
                    
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