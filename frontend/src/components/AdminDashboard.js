// src/components/AdminDashboard.js - Admin dashboard for system monitoring
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cleanupStatus, setCleanupStatus] = useState(null);
  const [compactStatus, setCompactStatus] = useState(null);
  const [cleanupOptions, setCleanupOptions] = useState({
    signalDays: 30,
    marketPriceDays: 1,
    marketCandleDays: 7,
    inactiveBotDays: 7
  });
  
  // Fetch system status on mount and every 30 seconds
  useEffect(() => {
    fetchSystemStatus();
    
    // Set up interval for periodic updates
    const intervalId = setInterval(fetchSystemStatus, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);
  
  // Fetch system status from API
  const fetchSystemStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/admin/status');
      setSystemStatus(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching system status:', err);
      setError('Failed to fetch system status');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle cleanup database action
  const handleCleanup = async () => {
    try {
      setCleanupStatus({ loading: true, message: 'Cleaning up databases...' });
      
      const response = await axios.post('/api/admin/cleanup', cleanupOptions);
      
      setCleanupStatus({
        loading: false,
        success: true,
        message: 'Database cleanup completed successfully!',
        results: response.data.results
      });
      
      // Refresh system status after cleanup
      fetchSystemStatus();
    } catch (err) {
      console.error('Error cleaning up databases:', err);
      setCleanupStatus({
        loading: false,
        success: false,
        message: `Error cleaning up databases: ${err.response?.data?.error || err.message}`
      });
    }
  };
  
  // Handle compact database action
  const handleCompact = async () => {
    try {
      setCompactStatus({ loading: true, message: 'Compacting databases...' });
      
      const response = await axios.post('/api/admin/compact-db');
      
      setCompactStatus({
        loading: false,
        success: true,
        message: 'Database compaction completed successfully!',
        results: response.data.results
      });
      
      // Refresh system status after compaction
      fetchSystemStatus();
    } catch (err) {
      console.error('Error compacting databases:', err);
      setCompactStatus({
        loading: false,
        success: false,
        message: `Error compacting databases: ${err.response?.data?.error || err.message}`
      });
    }
  };
  
  // Handle change in cleanup options
  const handleCleanupOptionChange = (e) => {
    const { name, value } = e.target;
    setCleanupOptions(prev => ({
      ...prev,
      [name]: parseInt(value) || 0
    }));
  };
  
  if (loading && !systemStatus) {
    return (
      <div className="admin-dashboard">
        <h2>Admin Dashboard</h2>
        <div className="loading">Loading system status...</div>
      </div>
    );
  }
  
  if (error && !systemStatus) {
    return (
      <div className="admin-dashboard">
        <h2>Admin Dashboard</h2>
        <div className="error-message">{error}</div>
        <button className="refresh-button" onClick={fetchSystemStatus}>Retry</button>
      </div>
    );
  }
  
  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      
      <div className="dashboard-header">
        <h3>System Status</h3>
        <div className="refresh-wrapper">
          <button className="refresh-button" onClick={fetchSystemStatus}>
            Refresh Status
          </button>
          {loading && <span className="loading-indicator">Loading...</span>}
        </div>
      </div>
      
      {systemStatus && (
        <div className="status-container">
          <div className="status-panel">
            <h4>Database Counts</h4>
            <div className="status-grid">
              <div className="status-item">
                <div className="status-label">Signals</div>
                <div className="status-value">{systemStatus.counts.signals}</div>
              </div>
              <div className="status-item">
                <div className="status-label">Active Bots</div>
                <div className="status-value">{systemStatus.counts.activeBots}</div>
              </div>
              <div className="status-item">
                <div className="status-label">Configurations</div>
                <div className="status-value">{systemStatus.counts.configs}</div>
              </div>
              <div className="status-item">
                <div className="status-label">Portfolios</div>
                <div className="status-value">{systemStatus.counts.portfolios}</div>
              </div>
              <div className="status-item">
                <div className="status-label">Transactions</div>
                <div className="status-value">{systemStatus.counts.transactions}</div>
              </div>
              <div className="status-item">
                <div className="status-label">Market Data</div>
                <div className="status-value">{systemStatus.counts.marketData}</div>
              </div>
            </div>
          </div>
          
          <div className="status-panel">
            <h4>Database Sizes</h4>
            <table className="db-sizes-table">
              <thead>
                <tr>
                  <th>Database File</th>
                  <th>Size</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(systemStatus.dbSizes).map(([file, size]) => (
                  <tr key={file}>
                    <td>{file}</td>
                    <td>{size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="status-panel">
            <h4>Memory Usage</h4>
            <div className="status-grid">
              <div className="status-item">
                <div className="status-label">RSS</div>
                <div className="status-value">{systemStatus.memoryUsage.rss}</div>
              </div>
              <div className="status-item">
                <div className="status-label">Heap Total</div>
                <div className="status-value">{systemStatus.memoryUsage.heapTotal}</div>
              </div>
              <div className="status-item">
                <div className="status-label">Heap Used</div>
                <div className="status-value">{systemStatus.memoryUsage.heapUsed}</div>
              </div>
              <div className="status-item">
                <div className="status-label">External</div>
                <div className="status-value">{systemStatus.memoryUsage.external}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="admin-actions">
        <h3>Database Maintenance</h3>
        
        <div className="action-panels">
          <div className="action-panel">
            <h4>Cleanup Old Data</h4>
            <div className="action-form">
              <div className="form-row">
                <label>
                  Signals (days):
                  <input
                    type="number"
                    name="signalDays"
                    value={cleanupOptions.signalDays}
                    onChange={handleCleanupOptionChange}
                    min="1"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Market Prices (days):
                  <input
                    type="number"
                    name="marketPriceDays"
                    value={cleanupOptions.marketPriceDays}
                    onChange={handleCleanupOptionChange}
                    min="1"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Market Candles (days):
                  <input
                    type="number"
                    name="marketCandleDays"
                    value={cleanupOptions.marketCandleDays}
                    onChange={handleCleanupOptionChange}
                    min="1"
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  Inactive Bots (days):
                  <input
                    type="number"
                    name="inactiveBotDays"
                    value={cleanupOptions.inactiveBotDays}
                    onChange={handleCleanupOptionChange}
                    min="1"
                  />
                </label>
              </div>
              <button
                className="action-button"
                onClick={handleCleanup}
                disabled={cleanupStatus?.loading}
              >
                {cleanupStatus?.loading ? 'Running...' : 'Run Cleanup'}
              </button>
            </div>
            
            {cleanupStatus && !cleanupStatus.loading && (
              <div className={`action-result ${cleanupStatus.success ? 'success' : 'error'}`}>
                <p>{cleanupStatus.message}</p>
                {cleanupStatus.results && (
                  <div className="result-details">
                    <p>Signals removed: {cleanupStatus.results.signals}</p>
                    <p>Market data removed:
                      {cleanupStatus.results.marketData.priceResult + 
                       cleanupStatus.results.marketData.candleResult}
                    </p>
                    <p>Inactive bots removed: {cleanupStatus.results.activeBots}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="action-panel">
            <h4>Compact Databases</h4>
            <p>Compacting reclaims space from deleted records and improves database performance.</p>
            <button
              className="action-button"
              onClick={handleCompact}
              disabled={compactStatus?.loading}
            >
              {compactStatus?.loading ? 'Compacting...' : 'Compact Databases'}
            </button>
            
            {compactStatus && !compactStatus.loading && (
              <div className={`action-result ${compactStatus.success ? 'success' : 'error'}`}>
                <p>{compactStatus.message}</p>
                {compactStatus.results && (
                  <div className="result-details">
                    <h5>Compaction Results:</h5>
                    <table className="compact-results-table">
                      <thead>
                        <tr>
                          <th>Database</th>
                          <th>Status</th>
                          <th>Size Before</th>
                          <th>Size After</th>
                          <th>Reduction</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(compactStatus.results).map(([dbFile, result]) => (
                          <tr key={dbFile}>
                            <td>{dbFile}</td>
                            <td>{result.status}</td>
                            <td>{result.sizeBefore || 'N/A'}</td>
                            <td>{result.sizeAfter || 'N/A'}</td>
                            <td>
                              {result.reduction ? 
                                `${result.reduction} (${result.reductionPercent})` : 
                                'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;