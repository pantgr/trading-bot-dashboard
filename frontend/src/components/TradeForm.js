// src/components/TradeForm.js - Αλλαγές
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TradeForm = ({ onTrade, balance }) => {
  const [symbol, setSymbol] = useState('ETH');
  const [action, setAction] = useState('BUY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('0.05');  // Αλλαγμένη προεπιλεγμένη τιμή για BTC
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [btcBalance, setBtcBalance] = useState(0);
  
  // Εκτίμηση του BTC υπολοίπου με βάση το USD υπόλοιπο
  useEffect(() => {
    const fetchBtcPrice = async () => {
      try {
        const response = await axios.get('/api/market-data/price/BTCUSDT');
        if (response.data && response.data.price) {
          // Μετατροπή του USD υπολοίπου σε BTC
          const btcValue = balance / response.data.price;
          setBtcBalance(btcValue);
        }
      } catch (error) {
        console.error('Error fetching BTC price:', error);
      }
    };
    
    fetchBtcPrice();
  }, [balance]);

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

    // Έλεγχος για αγορά με βάση το διαθέσιμο υπόλοιπο (τώρα σε BTC)
    if (action === 'BUY' && tradeValue > btcBalance) {
      setError(`Insufficient BTC balance. Available: ₿${btcBalance.toFixed(8)}`);
      return;
    }

    // Προσομοίωση της συναλλαγής
    const tradeData = {
      symbol: `${symbol}BTC`, // Προσθήκη του BTC ως βασικό ζεύγος
      action,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
      timestamp: Date.now()
    };

    // Κλήση του callback
    onTrade(tradeData);
    
    // Επιτυχής συναλλαγή
    setSuccess(`${action} ${quantity} ${symbol} @ ₿${price} executed successfully!`);
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
            <option value="ETH">Ethereum (ETH)</option>
            <option value="BNB">Binance Coin (BNB)</option>
            <option value="ADA">Cardano (ADA)</option>
            <option value="SOL">Solana (SOL)</option>
            <option value="XRP">Ripple (XRP)</option>
            <option value="DOT">Polkadot (DOT)</option>
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
          <label>Price (BTC):</label>
          <input 
            type="number" 
            value={price} 
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Enter price in BTC"
            step="0.00000001"
            min="0"
          />
        </div>
        
        <div className="form-group">
          <label>Total Value:</label>
          <div className="total-value">
            ₿{((parseFloat(quantity) || 0) * (parseFloat(price) || 0)).toFixed(8)}
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