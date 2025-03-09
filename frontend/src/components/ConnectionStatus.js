// src/components/ConnectionStatus.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { isConnected, getSocketId } from '../services/socketService';

const ConnectionStatus = () => {
  const [apiStatus, setApiStatus] = useState('checking');
  const [socketStatus, setSocketStatus] = useState('checking');
  const [dbStatus, setDbStatus] = useState('checking');
  const [expanded, setExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [socketId, setSocketId] = useState(null);

  // Check statuses on mount and periodically
  useEffect(() => {
    checkStatuses();
    
    // Set up interval to check status every 30 seconds
    const interval = setInterval(checkStatuses, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Function to check all connection statuses
  const checkStatuses = async () => {
    checkApiStatus();
    checkSocketStatus();
    checkDbStatus();
    setLastChecked(new Date());
  };

  // Check API status
  const checkApiStatus = async () => {
    try {
      setApiStatus('checking');
      await axios.get('/api/health', { timeout: 3000 });
      setApiStatus('connected');
    } catch (error) {
      console.error('API connection check failed:', error);
      setApiStatus('disconnected');
    }
  };

  // Check Socket.io status
  const checkSocketStatus = () => {
    setSocketStatus('checking');
    const connected = isConnected();
    setSocketStatus(connected ? 'connected' : 'disconnected');
    setSocketId(getSocketId());
  };

  // Check database status through API
  const checkDbStatus = async () => {
    try {
      setDbStatus('checking');
      const response = await axios.get('/api/health', { timeout: 3000 });
      
      // Check if response indicates MongoDB is connected
      if (response.data && response.data.mongodb === 'connected') {
        setDbStatus('connected');
      } else {
        setDbStatus('unknown');
      }
    } catch (error) {
      console.error('Database status check failed:', error);
      setDbStatus('disconnected');
    }
  };

  // Get status indicator color
  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#48bb78'; // Green
      case 'disconnected': return '#f56565'; // Red
      case 'checking': return '#ecc94b'; // Yellow
      default: return '#a0aec0'; // Gray
    }
  };

  // Handle manual refresh
  const handleRefresh = () => {
    checkStatuses();
  };

  return (
    <div className="connection-status-widget" style={styles.container}>
      <div 
        className="status-summary" 
        style={styles.summary}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={styles.indicator}>
          <div 
            style={{
              ...styles.dot,
              backgroundColor: getStatusColor(
                apiStatus === 'connected' && 
                socketStatus === 'connected' && 
                dbStatus === 'connected' ? 'connected' : 'disconnected'
              )
            }} 
          />
          <span style={styles.label}>
            {apiStatus === 'connected' && 
             socketStatus === 'connected' && 
             dbStatus === 'connected' ? 'Connected' : 'Connection Issues'}
          </span>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleRefresh();
          }}
          style={styles.refreshButton}
        >
          ↻
        </button>
      </div>
      
      {expanded && (
        <div className="status-details" style={styles.details}>
          <div className="status-item" style={styles.item}>
            <span style={styles.itemLabel}>API:</span>
            <div style={{...styles.itemDot, backgroundColor: getStatusColor(apiStatus)}} />
            <span style={styles.itemStatus}>{apiStatus}</span>
          </div>
          
          <div className="status-item" style={styles.item}>
            <span style={styles.itemLabel}>WebSocket:</span>
            <div style={{...styles.itemDot, backgroundColor: getStatusColor(socketStatus)}} />
            <span style={styles.itemStatus}>{socketStatus}</span>
          </div>
          
          <div className="status-item" style={styles.item}>
            <span style={styles.itemLabel}>Database:</span>
            <div style={{...styles.itemDot, backgroundColor: getStatusColor(dbStatus)}} />
            <span style={styles.itemStatus}>{dbStatus}</span>
          </div>
          
          {socketId && (
            <div className="socket-id" style={styles.socketId}>
              Socket ID: {socketId}
            </div>
          )}
          
          <div className="last-checked" style={styles.lastChecked}>
            Last checked: {lastChecked.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

// Component styles
const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#1a202c',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
    color: 'white',
    width: '250px',
    overflow: 'hidden'
  },
  summary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px',
    cursor: 'pointer',
    borderBottom: expanded => expanded ? '1px solid #2d3748' : 'none'
  },
  indicator: {
    display: 'flex',
    alignItems: 'center'
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginRight: '8px'
  },
  label: {
    fontSize: '14px',
    fontWeight: '500'
  },
  refreshButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 5px'
  },
  details: {
    padding: '15px'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px'
  },
  itemLabel: {
    width: '80px',
    fontSize: '13px'
  },
  itemDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginRight: '8px'
  },
  itemStatus: {
    fontSize: '13px'
  },
  socketId: {
    fontSize: '12px',
    marginTop: '10px',
    color: '#a0aec0',
    wordBreak: 'break-all'
  },
  lastChecked: {
    fontSize: '12px',
    marginTop: '10px',
    color: '#a0aec0'
  }
};

export default ConnectionStatus;