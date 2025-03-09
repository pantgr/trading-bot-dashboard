 import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import ErrorMessage from '../components/ErrorMessage';

const Settings = ({ onBack }) => {
  const { isConnected } = useSocket();
  
  // Signal weights settings
  const [signalScores, setSignalScores] = useState({
    RSI_BUY: 2,
    BOLLINGER_BUY: 1,
    EMA_CROSSOVER_BUY: 2,
    FIBONACCI_BUY: 1,
    RSI_SELL: -2,
    BOLLINGER_SELL: -1,
    EMA_CROSSOVER_SELL: -2,
    FIBONACCI_SELL: -1
  });

  // Threshold settings
  const [thresholds, setThresholds] = useState({
    BUY_THRESHOLD: 3,
    SELL_THRESHOLD: -3,
    TIME_WINDOW_MINUTES: 5
  });

  // Indicator settings
  const [indicators, setIndicators] = useState({
    RSI_PERIOD: 14,
    EMA_SHORT_PERIOD: 9,
    EMA_LONG_PERIOD: 21,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD_DEV: 2
  });

  // Money management settings
  const [moneyManagement, setMoneyManagement] = useState({
    BUY_AMOUNT_PERCENTAGE: 10,
    SELL_AMOUNT_PERCENTAGE: 25
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      if (!isConnected) {
        setError('Not connected to server. Settings cannot be loaded.');
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch('/api/bot/settings');
        if (!response.ok) {
          throw new Error(`Failed to load settings (${response.status})`);
        }
        
        const data = await response.json();
        
        // Update state with data from API
        if (data.signalScores) setSignalScores(data.signalScores);
        if (data.thresholds) {
          // Convert time window from ms to minutes for display
          const thresholdsForDisplay = {...data.thresholds};
          if (thresholdsForDisplay.TIME_WINDOW_MS) {
            thresholdsForDisplay.TIME_WINDOW_MINUTES = thresholdsForDisplay.TIME_WINDOW_MS / (60 * 1000);
            delete thresholdsForDisplay.TIME_WINDOW_MS;
          }
          setThresholds(thresholdsForDisplay);
        }
        if (data.indicators) setIndicators(data.indicators);
        if (data.moneyManagement) setMoneyManagement(data.moneyManagement);
        
      } catch (err) {
        console.error('Error loading settings:', err);
        setError(err.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [isConnected]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      setError('Not connected to server. Settings cannot be saved.');
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Convert minutes back to ms for API
      const thresholdsForApi = {...thresholds};
      if (thresholdsForApi.TIME_WINDOW_MINUTES) {
        thresholdsForApi.TIME_WINDOW_MS = thresholdsForApi.TIME_WINDOW_MINUTES * 60 * 1000;
        delete thresholdsForApi.TIME_WINDOW_MINUTES;
      }
      
      const response = await fetch('/api/bot/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signalScores,
          thresholds: thresholdsForApi,
          indicators,
          moneyManagement
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save settings (${response.status})`);
      }
      
      setSuccess('Settings saved successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setSignalScores({
      RSI_BUY: 2,
      BOLLINGER_BUY: 1,
      EMA_CROSSOVER_BUY: 2,
      FIBONACCI_BUY: 1,
      RSI_SELL: -2,
      BOLLINGER_SELL: -1,
      EMA_CROSSOVER_SELL: -2,
      FIBONACCI_SELL: -1
    });
    
    setThresholds({
      BUY_THRESHOLD: 3,
      SELL_THRESHOLD: -3,
      TIME_WINDOW_MINUTES: 5
    });
    
    setIndicators({
      RSI_PERIOD: 14,
      EMA_SHORT_PERIOD: 9,
      EMA_LONG_PERIOD: 21,
      BOLLINGER_PERIOD: 20,
      BOLLINGER_STD_DEV: 2
    });
    
    setMoneyManagement({
      BUY_AMOUNT_PERCENTAGE: 10,
      SELL_AMOUNT_PERCENTAGE: 25
    });
    
    setSuccess('Settings reset to defaults');
  };

  // Handle number input changes for all setting types
  const handleNumberChange = (section, key, value) => {
    const numValue = parseFloat(value);
    
    switch(section) {
      case 'signalScores':
        setSignalScores(prev => ({ ...prev, [key]: numValue }));
        break;
      case 'thresholds':
        setThresholds(prev => ({ ...prev, [key]: numValue }));
        break;
      case 'indicators':
        setIndicators(prev => ({ ...prev, [key]: numValue }));
        break;
      case 'moneyManagement':
        setMoneyManagement(prev => ({ ...prev, [key]: numValue }));
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <h2>Bot Settings</h2>
          <button className="back-button" onClick={onBack}>Back to Dashboard</button>
        </div>
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h2>Bot Settings</h2>
        <button className="back-button" onClick={onBack}>Back to Dashboard</button>
      </div>
      
      {error && <ErrorMessage message={error} />}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="settings-section">
          <h3>Signal Weights</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label>RSI Buy:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.RSI_BUY} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'RSI_BUY', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>Bollinger Buy:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.BOLLINGER_BUY} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'BOLLINGER_BUY', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>EMA Crossover Buy:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.EMA_CROSSOVER_BUY} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'EMA_CROSSOVER_BUY', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>Fibonacci Buy:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.FIBONACCI_BUY} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'FIBONACCI_BUY', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>RSI Sell:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.RSI_SELL} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'RSI_SELL', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>Bollinger Sell:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.BOLLINGER_SELL} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'BOLLINGER_SELL', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>EMA Crossover Sell:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.EMA_CROSSOVER_SELL} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'EMA_CROSSOVER_SELL', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>Fibonacci Sell:</label>
              <input 
                type="number" 
                step="0.1"
                value={signalScores.FIBONACCI_SELL} 
                onChange={(e) => handleNumberChange(
                  'signalScores', 
                  'FIBONACCI_SELL', 
                  e.target.value
                )}
              />
            </div>
          </div>
        </div>
        
        <div className="settings-section">
          <h3>Trade Thresholds</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label>Buy Threshold:</label>
              <input 
                type="number" 
                step="0.1"
                value={thresholds.BUY_THRESHOLD} 
                onChange={(e) => handleNumberChange(
                  'thresholds', 
                  'BUY_THRESHOLD', 
                  e.target.value
                )}
              />
              <div className="input-help">Score required to execute a buy</div>
            </div>
            
            <div className="form-group">
              <label>Sell Threshold:</label>
              <input 
                type="number" 
                step="0.1"
                value={thresholds.SELL_THRESHOLD} 
                onChange={(e) => handleNumberChange(
                  'thresholds', 
                  'SELL_THRESHOLD', 
                  e.target.value
                )}
              />
              <div className="input-help">Score required to execute a sell (negative value)</div>
            </div>
            
            <div className="form-group">
              <label>Time Window (minutes):</label>
              <input 
                type="number" 
                min="1"
                step="1"
                value={thresholds.TIME_WINDOW_MINUTES} 
                onChange={(e) => handleNumberChange(
                  'thresholds', 
                  'TIME_WINDOW_MINUTES', 
                  e.target.value
                )}
              />
              <div className="input-help">How long signals remain valid for consensus</div>
            </div>
          </div>
        </div>
        
        <div className="settings-section">
          <h3>Technical Indicators</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label>RSI Period:</label>
              <input 
                type="number" 
                min="2"
                step="1"
                value={indicators.RSI_PERIOD} 
                onChange={(e) => handleNumberChange(
                  'indicators', 
                  'RSI_PERIOD', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>EMA Short Period:</label>
              <input 
                type="number" 
                min="2"
                step="1"
                value={indicators.EMA_SHORT_PERIOD} 
                onChange={(e) => handleNumberChange(
                  'indicators', 
                  'EMA_SHORT_PERIOD', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>EMA Long Period:</label>
              <input 
                type="number" 
                min="2"
                step="1"
                value={indicators.EMA_LONG_PERIOD} 
                onChange={(e) => handleNumberChange(
                  'indicators', 
                  'EMA_LONG_PERIOD', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>Bollinger Period:</label>
              <input 
                type="number" 
                min="2"
                step="1"
                value={indicators.BOLLINGER_PERIOD} 
                onChange={(e) => handleNumberChange(
                  'indicators', 
                  'BOLLINGER_PERIOD', 
                  e.target.value
                )}
              />
            </div>
            
            <div className="form-group">
              <label>Bollinger Std Dev:</label>
              <input 
                type="number" 
                min="0.1"
                step="0.1"
                value={indicators.BOLLINGER_STD_DEV} 
                onChange={(e) => handleNumberChange(
                  'indicators', 
                  'BOLLINGER_STD_DEV', 
                  e.target.value
                )}
              />
            </div>
          </div>
        </div>
        
        <div className="settings-section">
          <h3>Money Management</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label>Buy Amount (% of balance):</label>
              <input 
                type="number" 
                min="1"
                max="100"
                step="1"
                value={moneyManagement.BUY_AMOUNT_PERCENTAGE} 
                onChange={(e) => handleNumberChange(
                  'moneyManagement', 
                  'BUY_AMOUNT_PERCENTAGE', 
                  e.target.value
                )}
              />
              <div className="input-help">Percentage of available balance to use per trade</div>
            </div>
            
            <div className="form-group">
              <label>Sell Amount (% of position):</label>
              <input 
                type="number" 
                min="1"
                max="100"
                step="1"
                value={moneyManagement.SELL_AMOUNT_PERCENTAGE} 
                onChange={(e) => handleNumberChange(
                  'moneyManagement', 
                  'SELL_AMOUNT_PERCENTAGE', 
                  e.target.value
                )}
              />
              <div className="input-help">Percentage of position to sell per trade</div>
            </div>
          </div>
        </div>
        
        <div className="settings-actions">
          <button 
            type="button" 
            className="reset-button" 
            onClick={handleReset}
          >
            Reset Defaults
          </button>
          <button 
            type="submit" 
            className="save-button" 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;