 import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useData } from '../contexts/DataContext';
import TradingBotPanel from '../components/TradingBotPanel';
import ErrorMessage from '../components/ErrorMessage';
import ConnectionStatus from '../components/ConnectionStatus';

const Dashboard = ({ onOpenSettings }) => {
  const { isConnected, connectionError, reconnect } = useSocket();
  const { 
    portfolio, 
    transactions, 
    btcPrice, 
    loading, 
    errors, 
    refreshAllData,
    usdToBtc,
    formatBtcValue
  } = useData();

  // Handle retry for connection issues
  const handleRetry = () => {
    reconnect();
    refreshAllData();
  };

  // Show loading state for initial load
  if (loading.portfolio && !portfolio) {
    return (
      <div className="dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
        <ConnectionStatus />
      </div>
    );
  }

  // Show error state with retry button
  if ((errors.portfolio || connectionError) && !portfolio) {
    return (
      <div className="dashboard">
        <ErrorMessage 
          message={errors.portfolio || connectionError || 'Connection error'} 
          onRetry={handleRetry}
        />
        <ConnectionStatus />
      </div>
    );
  }

  // Calculate portfolio values
  const portfolioBalance = portfolio?.balance ? parseFloat(portfolio.balance) : 0;
  const assetsValue = calculateAssetsValue(portfolio?.assets || [], btcPrice);

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
            onClick={onOpenSettings}
          >
            <i className="fas fa-cog"></i> Bot Settings
          </button>
        </div>
      </div>
      
      <div className="portfolio-summary">
        <div className="summary-card">
          <div className="label">Total Equity</div>
          <div className="value">
            {formatBtcValue(usdToBtc(portfolioBalance) + assetsValue.btc)}
            <div className="sub-value">${(portfolioBalance + assetsValue.usd).toFixed(2)}</div>
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
            {formatBtcValue(assetsValue.btc)}
            <div className="sub-value">
              ${assetsValue.usd.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="summary-card">
          <div className="label">BTC Price</div>
          <div className="value">
            ${btcPrice ? parseFloat(btcPrice).toFixed(2) : 'Loading...'}
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
                      if (!asset || !asset.symbol) return null;
                      
                      // Extract values safely
                      const symbol = asset.symbol;
                      const quantity = parseFloat(asset.quantity) || 0;
                      const isBtcPair = symbol.endsWith('BTC');
                      const btcPriceVal = parseFloat(btcPrice) || 1;
                      
                      // Calculate BTC prices
                      const currentPrice = parseFloat(asset.currentPrice) || 0;
                      const avgPrice = parseFloat(asset.averagePrice) || 0;
                      
                      const priceBTC = isBtcPair 
                        ? currentPrice  // Already in BTC
                        : (currentPrice / btcPriceVal); // Convert from USDT
                      
                      const avgPriceBTC = isBtcPair 
                        ? avgPrice  // Already in BTC
                        : (avgPrice / btcPriceVal); // Convert from USDT
                      
                      // Calculate value and PnL
                      const value = quantity * priceBTC;
                      const cost = quantity * avgPriceBTC;
                      const pnl = value - cost;
                      const pnlPercentage = cost > 0 ? (pnl / cost) * 100 : 0;
                      
                      // Display symbol without quote asset for readability
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
                    if (!tx || !tx.symbol) return null;
                    
                    // Extract values safely
                    const txSymbol = tx.symbol;
                    const txAction = tx.action;
                    const txQuantity = parseFloat(tx.quantity) || 0;
                    const txPrice = parseFloat(tx.price) || 0;
                    const txValue = parseFloat(tx.value) || 0;
                    const txSignal = tx.signal || 'Unknown';
                    
                    // Format timestamp
                    const txTimestamp = tx.timestamp 
                      ? new Date(tx.timestamp).toLocaleString() 
                      : 'Unknown';
                    
                    // Calculate BTC values
                    const isBtcPair = txSymbol.endsWith('BTC');
                    const btcPriceVal = parseFloat(btcPrice) || 1;
                    
                    const priceBTC = isBtcPair
                      ? txPrice
                      : (txPrice / btcPriceVal);
                      
                    const valueBTC = isBtcPair
                      ? Math.abs(txValue)
                      : Math.abs(txValue) / btcPriceVal;
                    
                    // Display symbol without quote asset for readability
                    const displaySymbol = isBtcPair
                      ? txSymbol.replace('BTC', '')
                      : txSymbol.replace('USDT', '');
                    
                    return (
                      <tr key={index} className={txAction.toLowerCase()}>
                        <td>{txTimestamp}</td>
                        <td>{txAction}</td>
                        <td>{displaySymbol}</td>
                        <td>{txQuantity.toFixed(6)}</td>
                        <td>{formatBtcValue(priceBTC)}</td>
                        <td>{formatBtcValue(valueBTC)}</td>
                        <td>{txSignal}</td>
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
      
      <ConnectionStatus />
    </div>
  );
};

// Helper function to calculate portfolio assets value
const calculateAssetsValue = (assets, btcPrice) => {
  if (!assets || !Array.isArray(assets) || assets.length === 0) {
    return { btc: 0, usd: 0 };
  }

  let totalBtcValue = 0;
  let totalUsdValue = 0;
  const btcPriceVal = parseFloat(btcPrice) || 1;
  
  for (const asset of assets) {
    if (!asset || !asset.symbol) continue;
    
    try {
      const quantity = parseFloat(asset.quantity) || 0;
      const currentPrice = parseFloat(asset.currentPrice) || 0;
      const isBtcPair = asset.symbol.endsWith('BTC');
      
      if (isBtcPair) {
        // BTC pairs: price is already in BTC
        const assetBtcValue = quantity * currentPrice;
        totalBtcValue += assetBtcValue;
        totalUsdValue += assetBtcValue * btcPriceVal;
      } else {
        // Assume USDT pairs
        const assetUsdValue = quantity * currentPrice;
        totalUsdValue += assetUsdValue;
        totalBtcValue += assetUsdValue / btcPriceVal;
      }
    } catch (e) {
      console.error('Error calculating asset value:', e);
    }
  }
  
  return { btc: totalBtcValue, usd: totalUsdValue };
};

export default Dashboard;