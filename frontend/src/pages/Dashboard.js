// Modified src/pages/Dashboard.js with Error Boundaries
import React, { useState, useEffect, useCallback } from 'react';
import ErrorBoundary from '../components/ErrorBoundary';
import ConnectionStatus from '../components/ConnectionStatus';
import apiService from '../services/api';
import { connectSocket } from '../services/socketService';
import '../components/BotSettingsPanel.css';

// Use a safer TradingBotPanel component to prevent errors from crashing the app
const SafeTradingBotPanel = React.lazy(() => import('../components/TradingBotPanel'));
const SafeBotSettingsPanel = React.lazy(() => import('../components/BotSettingsPanel'));

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [btcPrice, setBtcPrice] = useState(null);
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Function to fetch dashboard data with error handling
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get BTC price in USD for conversions
      const btcPrice = await apiService.fetchBTCPrice();
      if (btcPrice) {
        setBtcPrice(btcPrice);
      }
      
      // Get portfolio from API
      const portfolioData = await apiService.fetchPortfolio();
      if (portfolioData) {
        setPortfolio(portfolioData);
      }
      
      // Get transaction history from API
      const txData = await apiService.fetchTransactionHistory();
      if (Array.isArray(txData)) {
        setTransactions(txData);
      }
      
      // Reset connection status if previously disconnected
      setIsConnected(true);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Connect to WebSocket
  useEffect(() => {
    try {
      // Connect to WebSocket
      const socket = connectSocket();
      
      // Listen for portfolio updates
      socket.on('portfolio_update', (updatedPortfolio) => {
        if (updatedPortfolio) {
          setPortfolio(updatedPortfolio);
        }
      });
      
      // Listen for new transactions
      socket.on('transaction_created', (newTx) => {
        if (newTx) {
          setTransactions(prev => [newTx, ...prev]);
        }
      });
      
      // Listen for BTC price updates
      socket.on('price_update', (data) => {
        if (data && data.symbol === 'BTCUSDT' && data.price) {
          setBtcPrice(data.price);
        }
      });
      
      // Listen for reconnection events
      socket.on('reconnect', () => {
        console.log('Socket reconnected, refreshing data...');
        fetchDashboardData();
      });
      
      // Cleanup on unmount
      return () => {
        socket.off('portfolio_update');
        socket.off('transaction_created');
        socket.off('price_update');
        socket.off('reconnect');
      };
    } catch (error) {
      console.error('Error setting up socket connection:', error);
    }
  }, [fetchDashboardData]);

  // Convert USD to BTC - safely
  const usdToBtc = (usdAmount) => {
    if (!btcPrice || !usdAmount) return 0;
    const amt = parseFloat(usdAmount);
    const price = parseFloat(btcPrice);
    if (isNaN(amt) || isNaN(price) || price === 0) return 0;
    return amt / price;
  };

  // Format BTC values - safely
  const formatBtcValue = (btcValue) => {
    if (!btcValue) return '₿0.00000000';
    const value = parseFloat(btcValue);
    if (isNaN(value)) return '₿0.00000000';
    return `₿${value.toFixed(8)}`;
  };

  // Calculate total assets value in BTC - safely
  const calculateAssetsValueBTC = () => {
    if (!portfolio || !portfolio.assets || !Array.isArray(portfolio.assets) || portfolio.assets.length === 0) {
      return 0;
    }

    let totalValue = 0;
    
    for (const asset of portfolio.assets) {
      if (!asset) continue;
      
      try {
        let assetValueBTC = 0;
        const quantity = parseFloat(asset.quantity) || 0;
        const currentPrice = parseFloat(asset.currentPrice) || 0;
        const btcPriceVal = parseFloat(btcPrice) || 1;
        
        if (asset.symbol && asset.symbol.endsWith('BTC')) {
          // BTC pairs already have price in BTC
          assetValueBTC = quantity * currentPrice;
        } else if (asset.symbol && asset.symbol.endsWith('USDT') && btcPriceVal > 0) {
          // USDT pairs need conversion to BTC
          assetValueBTC = quantity * currentPrice / btcPriceVal;
        }
        
        totalValue += assetValueBTC;
      } catch (e) {
        console.error('Error calculating asset value:', e);
      }
    }
    
    return totalValue;
  };

  // Calculate total assets value in USD - safely
  const calculateAssetsValueUSD = () => {
    if (!portfolio || !portfolio.assets || !Array.isArray(portfolio.assets) || portfolio.assets.length === 0) {
      return 0;
    }

    let totalValue = 0;
    
    for (const asset of portfolio.assets) {
      if (!asset) continue;
      
      try {
        let assetValueUSD = 0;
        const quantity = parseFloat(asset.quantity) || 0;
        const currentPrice = parseFloat(asset.currentPrice) || 0;
        const btcPriceVal = parseFloat(btcPrice) || 1;
        
        if (asset.symbol && asset.symbol.endsWith('BTC') && btcPriceVal > 0) {
          // Convert BTC pairs to USD
          assetValueUSD = quantity * currentPrice * btcPriceVal;
        } else if (asset.symbol && asset.symbol.endsWith('USDT')) {
          // USDT pairs already have price in USD
          assetValueUSD = quantity * currentPrice;
        }
        
        totalValue += assetValueUSD;
      } catch (e) {
        console.error('Error calculating asset value in USD:', e);
      }
    }
    
    return totalValue;
  };

  // Add retry button for reconnection
  const handleRetry = () => {
    fetchDashboardData();
  };

  // Show loading state
  if (loading && !portfolio) {
    return (
      <div className="dashboard">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
        <ConnectionStatus />
      </div>
    );
  }

  // Show error state with retry button
  if (error && !portfolio) {
    return (
      <div className="dashboard">
        <div className="error-container">
          <h2>Connection Error</h2>
          <p>{error}</p>
          <button className="retry-button" onClick={handleRetry}>
            Retry Connection
          </button>
        </div>
        <ConnectionStatus />
      </div>
    );
  }

  // Calculate values
  const portfolioBalance = portfolio?.balance ? parseFloat(portfolio.balance) : 0;
  const assetsBTC = calculateAssetsValueBTC();
  const assetsUSD = calculateAssetsValueUSD();
  const btcPriceDisplay = btcPrice ? parseFloat(btcPrice).toFixed(2) : 'Loading...';

  // Main dashboard
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Trading Bot Dashboard</h1>
        <div className="header-actions">
          {!isConnected && (
            <button 
              className="retry-button"
              onClick={handleRetry}
            >
              Reconnect
            </button>
          )}
          <button 
            className="settings-button"
            onClick={() => setIsSettingsPanelOpen(true)}
          >
            <i className="fas fa-cog"></i> Bot Settings
          </button>
        </div>
      </div>
      
      <React.Suspense fallback={<div className="loading">Loading settings panel...</div>}>
        {isSettingsPanelOpen && (
          <ErrorBoundary>
            <SafeBotSettingsPanel 
              isOpen={isSettingsPanelOpen} 
              onClose={() => setIsSettingsPanelOpen(false)} 
            />
          </ErrorBoundary>
        )}
      </React.Suspense>
      
      <div className="portfolio-summary">
        <div className="summary-card">
          <div className="label">Total Equity</div>
          <div className="value">
            {formatBtcValue(usdToBtc(portfolioBalance) + assetsBTC)}
            <div className="sub-value">${((portfolioBalance) + assetsUSD).toFixed(2)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="label">Available Balance</div>
          <div className="value">
            {formatBtcValue(usdToBtc(portfolioBalance))}
            <div className="sub-value">${portfolioBalance.toFixed(2)}</div>
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
            ${btcPriceDisplay}
          </div>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <div className="bot-section">
          <React.Suspense fallback={<div className="loading">Loading trading bot panel...</div>}>
            <ErrorBoundary>
              <SafeTradingBotPanel />
            </ErrorBoundary>
          </React.Suspense>
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
                      if (!asset) return null;
                      
                      try {
                        // Safely extract values to avoid rendering promises
                        const symbol = typeof asset.symbol === 'string' ? asset.symbol : 'Unknown';
                        const quantity = parseFloat(asset.quantity) || 0;
                        const isBtcPair = symbol.endsWith('BTC');
                        const btcPriceVal = parseFloat(btcPrice) || 1;
                        
                        // Calculate BTC price correctly for different asset types
                        const priceBTC = isBtcPair 
                          ? (parseFloat(asset.currentPrice) || 0)  // Already in BTC
                          : ((parseFloat(asset.currentPrice) || 0) / btcPriceVal); // Convert from USDT
                        
                        const avgPriceBTC = isBtcPair 
                          ? (parseFloat(asset.averagePrice) || 0)  // Already in BTC
                          : ((parseFloat(asset.averagePrice) || 0) / btcPriceVal); // Convert from USDT
                        
                        // Calculate value and cost in BTC
                        const value = quantity * priceBTC;
                        const cost = quantity * avgPriceBTC;
                        const pnl = value - cost;
                        const pnlPercentage = cost > 0 ? (pnl / cost) * 100 : 0;
                        
                        // Display symbol without the quote asset for readability
                        const displaySymbol = isBtcPair 
                          ? symbol.replace('BTC', '') 
                          : symbol.replace('USDT', '');
                        
                        return (
                          <tr key={index}>
                            <td>{displaySymbol}</td>
                            <td>{quantity.toFixed(6)}</td>
                            <td>{formatBtcValue(avgPriceBTC)}</td>
                            <td>{formatBtcValue(priceBTC)}</td>
                            <td>{formatBtcValue(value)}</td>
                            <td className={pnl >= 0 ? 'profit' : 'loss'}>
                              {formatBtcValue(pnl)} ({pnlPercentage.toFixed(2)}%)
                            </td>
                          </tr>
                        );
                      } catch (e) {
                        console.error('Error rendering asset:', e);
                        return null;
                      }
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
                    if (!tx) return null;
                    
                    try {
                      // Extract values safely
                      const txSymbol = typeof tx.symbol === 'string' ? tx.symbol : 'Unknown';
                      const txAction = typeof tx.action === 'string' ? tx.action : 'Unknown';
                      const txQuantity = parseFloat(tx.quantity) || 0;
                      const txPrice = parseFloat(tx.price) || 0;
                      const txValue = parseFloat(tx.value) || 0;
                      const txSignal = typeof tx.signal === 'string' ? tx.signal : 'Unknown';
                      const txTimestamp = tx.timestamp ? new Date(tx.timestamp).toLocaleString() : 'Unknown';
                      
                      // Calculation for transaction values in BTC
                      const isBtcPair = txSymbol.endsWith('BTC');
                      const btcPriceVal = parseFloat(btcPrice) || 1;
                      
                      const priceBTC = isBtcPair
                        ? txPrice
                        : (txPrice / btcPriceVal);
                        
                      const valueBTC = isBtcPair
                        ? Math.abs(txValue)
                        : Math.abs(txValue) / btcPriceVal;
                      
                      // Display symbol without the quote asset for readability
                      const displaySymbol = isBtcPair
                        ? txSymbol.replace('BTC', '')
                        : txSymbol.replace('USDT', '');
                      
                      return (
                        <tr key={index} className={txAction === 'BUY' ? 'buy' : 'sell'}>
                          <td>{txTimestamp}</td>
                          <td>{txAction}</td>
                          <td>{displaySymbol}</td>
                          <td>{txQuantity.toFixed(6)}</td>
                          <td>{formatBtcValue(priceBTC)}</td>
                          <td>{formatBtcValue(valueBTC)}</td>
                          <td>{txSignal}</td>
                        </tr>
                      );
                    } catch (e) {
                      console.error('Error rendering transaction:', e);
                      return null;
                    }
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No transaction history available</p>
          )}
        </div>
      </div>
      
      <ConnectionStatus />
    </div>
  );
};

export default Dashboard;