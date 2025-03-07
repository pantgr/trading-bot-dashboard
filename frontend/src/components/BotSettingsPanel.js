// src/components/BotSettingsPanel.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BotSettingsPanel = ({ isOpen, onClose }) => {
  // Αρχικές καταστάσεις για όλες τις ρυθμίσεις
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

  const [thresholds, setThresholds] = useState({
    BUY_THRESHOLD: 3,
    SELL_THRESHOLD: -3,
    TIME_WINDOW_MS: 5 * 60 * 1000 // 5 λεπτά σε ms
  });

  const [indicators, setIndicators] = useState({
    RSI_PERIOD: 14,
    EMA_SHORT_PERIOD: 9,
    EMA_LONG_PERIOD: 21,
    BOLLINGER_PERIOD: 20,
    BOLLINGER_STD_DEV: 2
  });

  const [moneyManagement, setMoneyManagement] = useState({
    BUY_AMOUNT_PERCENTAGE: 10, // 10% του διαθέσιμου υπολοίπου
    SELL_AMOUNT_PERCENTAGE: 25  // 25% της θέσης
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Φόρτωση ρυθμίσεων κατά την εκκίνηση
  useEffect(() => {
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  // Φόρτωση ρυθμίσεων από το API
  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    
    try {
      // TODO: Αντικαταστήστε με το πραγματικό API endpoint
      const response = await axios.get('/api/bot/settings');
      
      // Ενημέρωση των states με τα δεδομένα από το API
      if (response.data.signalScores) {
        setSignalScores(response.data.signalScores);
      }
      
      if (response.data.thresholds) {
        setThresholds(response.data.thresholds);
      }
      
      if (response.data.indicators) {
        setIndicators(response.data.indicators);
      }
      
      if (response.data.moneyManagement) {
        setMoneyManagement(response.data.moneyManagement);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching bot settings:', err);
      setError('Αποτυχία φόρτωσης ρυθμίσεων. Χρησιμοποιούνται οι προεπιλεγμένες τιμές.');
      setLoading(false);
    }
  };

  // Αποθήκευση ρυθμίσεων στο API
  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      // TODO: Αντικαταστήστε με το πραγματικό API endpoint
      await axios.post('/api/bot/settings', {
        signalScores,
        thresholds,
        indicators,
        moneyManagement
      });
      
      setSuccess('Οι ρυθμίσεις αποθηκεύτηκαν επιτυχώς!');
      setSaving(false);
    } catch (err) {
      console.error('Error saving bot settings:', err);
      setError('Αποτυχία αποθήκευσης ρυθμίσεων.');
      setSaving(false);
    }
  };

  // Επαναφορά προεπιλεγμένων ρυθμίσεων
  const resetToDefaults = () => {
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
      TIME_WINDOW_MS: 5 * 60 * 1000
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
    
    setSuccess('Επαναφορά προεπιλεγμένων ρυθμίσεων.');
  };

  // Χειρισμός αλλαγών σε πεδία τύπου αριθμού
  const handleNumberChange = (category, field, value) => {
    const numValue = parseFloat(value);
    
    switch (category) {
      case 'signalScores':
        setSignalScores(prev => ({ ...prev, [field]: numValue }));
        break;
      case 'thresholds':
        setThresholds(prev => ({ ...prev, [field]: numValue }));
        break;
      case 'indicators':
        setIndicators(prev => ({ ...prev, [field]: numValue }));
        break;
      case 'moneyManagement':
        setMoneyManagement(prev => ({ ...prev, [field]: numValue }));
        break;
      default:
        break;
    }
  };

  // Υποβολή φόρμας
  const handleSubmit = (e) => {
    e.preventDefault();
    saveSettings();
  };

  if (!isOpen) return null;

  return (
    <div className="bot-settings-modal">
      <div className="bot-settings-panel">
        <div className="settings-header">
          <h2>Ρυθμίσεις Trading Bot</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        {loading ? (
          <div className="loading">Φόρτωση ρυθμίσεων...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
            
            <div className="settings-section">
              <h3>Βάρη Σημάτων</h3>
              <div className="settings-grid">
                <div className="form-group">
                  <label>RSI Αγορά:</label>
                  <input 
                    type="number" 
                    value={signalScores.RSI_BUY} 
                    onChange={(e) => handleNumberChange('signalScores', 'RSI_BUY', e.target.value)}
                    step="0.1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Bollinger Αγορά:</label>
                  <input 
                    type="number" 
                    value={signalScores.BOLLINGER_BUY} 
                    onChange={(e) => handleNumberChange('signalScores', 'BOLLINGER_BUY', e.target.value)}
                    step="0.1"
                  />
                </div>
                
                <div className="form-group">
                  <label>EMA Crossover Αγορά:</label>
                  <input 
                    type="number" 
                    value={signalScores.EMA_CROSSOVER_BUY} 
                    onChange={(e) => handleNumberChange('signalScores', 'EMA_CROSSOVER_BUY', e.target.value)}
                    step="0.1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Fibonacci Αγορά:</label>
                  <input 
                    type="number" 
                    value={signalScores.FIBONACCI_BUY} 
                    onChange={(e) => handleNumberChange('signalScores', 'FIBONACCI_BUY', e.target.value)}
                    step="0.1"
                  />
                </div>
                
                <div className="form-group">
                  <label>RSI Πώληση:</label>
                  <input 
                    type="number" 
                    value={signalScores.RSI_SELL} 
                    onChange={(e) => handleNumberChange('signalScores', 'RSI_SELL', e.target.value)}
                    step="0.1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Bollinger Πώληση:</label>
                  <input 
                    type="number" 
                    value={signalScores.BOLLINGER_SELL} 
                    onChange={(e) => handleNumberChange('signalScores', 'BOLLINGER_SELL', e.target.value)}
                    step="0.1"
                  />
                </div>
                
                <div className="form-group">
                  <label>EMA Crossover Πώληση:</label>
                  <input 
                    type="number" 
                    value={signalScores.EMA_CROSSOVER_SELL} 
                    onChange={(e) => handleNumberChange('signalScores', 'EMA_CROSSOVER_SELL', e.target.value)}
                    step="0.1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Fibonacci Πώληση:</label>
                  <input 
                    type="number" 
                    value={signalScores.FIBONACCI_SELL} 
                    onChange={(e) => handleNumberChange('signalScores', 'FIBONACCI_SELL', e.target.value)}
                    step="0.1"
                  />
                </div>
              </div>
            </div>
            
            <div className="settings-section">
              <h3>Όρια Συναλλαγών</h3>
              <div className="settings-grid">
                <div className="form-group">
                  <label>Όριο Αγοράς:</label>
                  <input 
                    type="number" 
                    value={thresholds.BUY_THRESHOLD} 
                    onChange={(e) => handleNumberChange('thresholds', 'BUY_THRESHOLD', e.target.value)}
                    step="0.1"
                  />
                  <div className="input-help">Το όριο βαθμολογίας πάνω από το οποίο εκτελείται αγορά</div>
                </div>
                
                <div className="form-group">
                  <label>Όριο Πώλησης:</label>
                  <input 
                    type="number" 
                    value={thresholds.SELL_THRESHOLD} 
                    onChange={(e) => handleNumberChange('thresholds', 'SELL_THRESHOLD', e.target.value)}
                    step="0.1"
                  />
                  <div className="input-help">Το όριο βαθμολογίας κάτω από το οποίο εκτελείται πώληση</div>
                </div>
                
                <div className="form-group">
                  <label>Χρονικό Παράθυρο (λεπτά):</label>
                  <input 
                    type="number" 
                    value={thresholds.TIME_WINDOW_MS / (60 * 1000)} 
                    onChange={(e) => handleNumberChange('thresholds', 'TIME_WINDOW_MS', e.target.value * 60 * 1000)}
                    step="1"
                    min="1"
                  />
                  <div className="input-help">Διάρκεια σε λεπτά που λαμβάνονται υπόψη τα σήματα</div>
                </div>
              </div>
            </div>
            
            <div className="settings-section">
              <h3>Παράμετροι Τεχνικών Δεικτών</h3>
              <div className="settings-grid">
                <div className="form-group">
                  <label>Περίοδος RSI:</label>
                  <input 
                    type="number" 
                    value={indicators.RSI_PERIOD} 
                    onChange={(e) => handleNumberChange('indicators', 'RSI_PERIOD', e.target.value)}
                    min="2"
                    step="1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Σύντομη Περίοδος EMA:</label>
                  <input 
                    type="number" 
                    value={indicators.EMA_SHORT_PERIOD} 
                    onChange={(e) => handleNumberChange('indicators', 'EMA_SHORT_PERIOD', e.target.value)}
                    min="2"
                    step="1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Μακρά Περίοδος EMA:</label>
                  <input 
                    type="number" 
                    value={indicators.EMA_LONG_PERIOD} 
                    onChange={(e) => handleNumberChange('indicators', 'EMA_LONG_PERIOD', e.target.value)}
                    min="2"
                    step="1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Περίοδος Bollinger:</label>
                  <input 
                    type="number" 
                    value={indicators.BOLLINGER_PERIOD} 
                    onChange={(e) => handleNumberChange('indicators', 'BOLLINGER_PERIOD', e.target.value)}
                    min="2"
                    step="1"
                  />
                </div>
                
                <div className="form-group">
                  <label>Τυπική Απόκλιση Bollinger:</label>
                  <input 
                    type="number" 
                    value={indicators.BOLLINGER_STD_DEV} 
                    onChange={(e) => handleNumberChange('indicators', 'BOLLINGER_STD_DEV', e.target.value)}
                    min="0.1"
                    step="0.1"
                  />
                </div>
              </div>
            </div>
            
            <div className="settings-section">
              <h3>Διαχείριση Κεφαλαίου</h3>
              <div className="settings-grid">
                <div className="form-group">
                  <label>Ποσοστό Αγοράς (%):</label>
                  <input 
                    type="number" 
                    value={moneyManagement.BUY_AMOUNT_PERCENTAGE} 
                    onChange={(e) => handleNumberChange('moneyManagement', 'BUY_AMOUNT_PERCENTAGE', e.target.value)}
                    min="1"
                    max="100"
                    step="1"
                  />
                  <div className="input-help">Ποσοστό του διαθέσιμου υπολοίπου που χρησιμοποιείται σε κάθε αγορά</div>
                </div>
                
                <div className="form-group">
                  <label>Ποσοστό Πώλησης (%):</label>
                  <input 
                    type="number" 
                    value={moneyManagement.SELL_AMOUNT_PERCENTAGE} 
                    onChange={(e) => handleNumberChange('moneyManagement', 'SELL_AMOUNT_PERCENTAGE', e.target.value)}
                    min="1"
                    max="100"
                    step="1"
                  />
                  <div className="input-help">Ποσοστό της θέσης που πωλείται σε κάθε σήμα πώλησης</div>
                </div>
              </div>
            </div>
            
            <div className="settings-actions">
              <button 
                type="button" 
                className="reset-button" 
                onClick={resetToDefaults}
              >
                Επαναφορά Προεπιλογών
              </button>
              
              <button 
                type="submit" 
                className="save-button" 
                disabled={saving}
              >
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση Ρυθμίσεων'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BotSettingsPanel;