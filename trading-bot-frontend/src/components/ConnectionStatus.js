 import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';

const ConnectionStatus = () => {
  const { isConnected, connectionError, socket, reconnect } = useSocket();
  const [expanded, setExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState(new Date());
  
  // Update last checked time every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastChecked(new Date());
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Get status indicator color
  const getStatusColor = (status) => {
    switch (status) {
      case true: return '#48bb78'; // Green for connected
      case false: return '#f56565'; // Red for disconnected
      default: return '#a0aec0'; // Gray for unknown
    }
  };
  
  // Handle manual refresh
  const handleRefresh = (e) => {
    e.stopPropagation();
    setLastChecked(new Date());
    reconnect();
  };
  
  return (
    <div className="connection-status-widget">
      <div 
        className="status-summary" 
        onClick={() => setExpanded(!expanded)}
      >
        <div className="status-indicator">
          <div 
            className="status-dot"
            style={{ backgroundColor: getStatusColor(isConnected) }} 
          />
          <span className="status-label">
            {isConnected ? 'Connected' : 'Connection Issue'}
          </span>
        </div>
        <button 
          className="refresh-button"
          onClick={handleRefresh}
        >
          ↻
        </button>
      </div>
      
      {expanded && (
        <div className="status-details">
          <div className="status-item">
            <span className="item-label">WebSocket:</span>
            <div 
              className="item-dot"
              style={{ backgroundColor: getStatusColor(isConnected) }} 
            />
            <span className="item-status">{isConnected ? 'connected' : 'disconnected'}</span>
          </div>
          
          {connectionError && (
            <div className="status-error">
              {connectionError}
            </div>
          )}
          
          {socket && (
            <div className="socket-id">
              Socket ID: {socket.id || 'unknown'}
            </div>
          )}
          
          <div className="last-checked">
            Last checked: {lastChecked.toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;