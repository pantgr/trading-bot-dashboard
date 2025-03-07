// src/components/TradeForm.js
import React, { useState } from 'react';

const TradeForm = ({ onTrade, balance }) => {
  const [symbol, setSymbol] = useState('BTC');
  const [action, setAction] = useState('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('35000');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Βασικές επικυρώσεις
    if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    if (!price || isNaN(price) || parseFloat(price) <= 0) {
      setError('Please enter a valid price');
      return;
    }

    const tradeValue = parseFloat(quantity) * parseFloat(price);

    // Έλεγχος για αγορά με βάση το διαθέσιμο υπόλοιπο
    if (action === 'BUY' && tradeValue > balance) {
      setError(`Insufficient balance. Available: $${balance.toFixed(2)}`);
      return;
    }

    // Προσομοίωση της συναλλαγής
    const tradeData = {
      symbol,
      action,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      timestamp: Date.now()
    };

    // Κλήση του callback
    onTrade(tradeData);
    
    // Επιτυχής συναλλαγή
    setSuccess(`${action} ${quantity} ${symbol} @ $${price} executed successfully!`);
    setQuantity(''); // Καθαρισμός πεδίου ποσότητας μετά την επιτυχή συναλλαγή
  };

  return (
    <div className="trade-form">
      <h2>Execute Trade</h2>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Symbol:</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="ETH">Ethereum (ETH)</option>
            <option value="ADA">Cardano (ADA)</option>
            <option value="SOL">Solana (SOL)</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Action:</label>
          <div className="action-buttons">
            <button 
              type="button" 
              className={`action-btn ${action === 'BUY' ? 'active buy' : ''}`}
              onClick={() => setAction('BUY')}
            >
              BUY
            </button>
            <button 
              type="button" 
              className={`action-btn ${action === 'SELL' ? 'active sell' : ''}`}
              onClick={() => setAction('SELL')}
            >
              SELL
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label>Quantity:</label>
          <input 
            type="number" 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            step="0.0001"
            min="0"
          />
        </div>
        
        <div className="form-group">
          <label>Price (USD):</label>
          <input 
            type="number" 
            value={price} 
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Enter price"
            step="0.01"
            min="0"
          />
        </div>
        
        <div className="form-group">
          <label>Total Value:</label>
          <div className="total-value">
            ${((parseFloat(quantity) || 0) * (parseFloat(price) || 0)).toFixed(2)}
          </div>
        </div>
        
        <button type="submit" className={`submit-btn ${action.toLowerCase()}`}>
          Execute {action}
        </button>
      </form>
    </div>
  );
};

export default TradeForm;