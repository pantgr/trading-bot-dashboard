const { RSI, EMA, SMA } = require('technicalindicators');

// Υπολογισμός επιπέδων Fibonacci
function calculateFibonacciLevels(high, low) {
  const diff = high - low;
  return {
    level0: high,
    level23_6: high - 0.236 * diff,
    level38_2: high - 0.382 * diff,
    level50_0: high - 0.5 * diff,
    level61_8: high - 0.618 * diff,
    level100: low
  };
}

// Υπολογισμός τεχνικών δεικτών
exports.calculate = (data) => {
  if (!data || data.length < 30) {
    console.error('Not enough data for indicators calculation');
    return null;
  }

  // Εξαγωγή τιμών κλεισίματος
  const prices = data.map(candle => candle.close);
  
  // Υπολογισμός RSI (14 περίοδοι)
  const rsiValues = RSI.calculate({
    values: prices,
    period: 14
  });
  
  // Υπολογισμός EMAs
  const ema9Values = EMA.calculate({
    values: prices,
    period: 9
  });
  
  const ema21Values = EMA.calculate({
    values: prices,
    period: 21
  });
  
  // Εύρεση υψηλού και χαμηλού για τα επίπεδα Fibonacci
  const high = Math.max(...prices.slice(-100));
  const low = Math.min(...prices.slice(-100));
  const fibLevels = calculateFibonacciLevels(high, low);
  
  return {
    rsi: rsiValues[rsiValues.length - 1],
    ema9: ema9Values[ema9Values.length - 1],
    ema21: ema21Values[ema21Values.length - 1],
    fibonacci: fibLevels,
    lastPrice: prices[prices.length - 1]
  };
};

// Έλεγχος για trading signals
exports.checkSignals = (symbol, data, indicators) => {
  if (!indicators) return [];

  const signals = [];
  const currentPrice = data[data.length - 1].close;
  const time = data[data.length - 1].time;
  
  // RSI strategy
  if (indicators.rsi < 30) {
    signals.push({
      time,
      symbol,
      indicator: 'RSI',
      value: indicators.rsi,
      price: currentPrice,
      action: 'BUY',
      reason: 'RSI oversold (< 30)'
    });
  } else if (indicators.rsi > 70) {
    signals.push({
      time,
      symbol,
      indicator: 'RSI',
      value: indicators.rsi,
      price: currentPrice,
      action: 'SELL',
      reason: 'RSI overbought (> 70)'
    });
  }
  
  // EMA crossover strategy
  if (data.length > 1) {
    const previousData = data[data.length - 2];
    const previousPrices = data.slice(0, -1).map(candle => candle.close);
    
    const previousEma9Values = EMA.calculate({
      values: previousPrices,
      period: 9
    });
    
    const previousEma21Values = EMA.calculate({
      values: previousPrices,
      period: 21
    });
    
    const previousEma9 = previousEma9Values[previousEma9Values.length - 1];
    const previousEma21 = previousEma21Values[previousEma21Values.length - 1];
    
    // Έλεγχος για EMA crossover
    if (previousEma9 <= previousEma21 && indicators.ema9 > indicators.ema21) {
      signals.push({
        time,
        symbol,
        indicator: 'EMA_CROSSOVER',
        value: `${indicators.ema9.toFixed(2)}/${indicators.ema21.toFixed(2)}`,
        price: currentPrice,
        action: 'BUY',
        reason: 'EMA 9 crossed above EMA 21'
      });
    } else if (previousEma9 >= previousEma21 && indicators.ema9 < indicators.ema21) {
      signals.push({
        time,
        symbol,
        indicator: 'EMA_CROSSOVER',
        value: `${indicators.ema9.toFixed(2)}/${indicators.ema21.toFixed(2)}`,
        price: currentPrice,
        action: 'SELL',
        reason: 'EMA 9 crossed below EMA 21'
      });
    }
  }
  
  // Fibonacci retracement strategy
  const fibLevels = indicators.fibonacci;
  
  if (data.length > 1) {
    const previousClose = data[data.length - 2].close;
    
    // Buy signal όταν η τιμή πλησιάζει το 61.8% retracement level από κάτω
    if (previousClose < fibLevels.level61_8 && currentPrice >= fibLevels.level61_8) {
      signals.push({
        time,
        symbol,
        indicator: 'FIBONACCI',
        value: fibLevels.level61_8.toFixed(2),
        price: currentPrice,
        action: 'BUY',
        reason: 'Price reached 61.8% Fibonacci retracement level'
      });
    }
    
    // Sell signal όταν η τιμή πέφτει κάτω από το 38.2% retracement level
    if (previousClose > fibLevels.level38_2 && currentPrice <= fibLevels.level38_2) {
      signals.push({
        time,
        symbol,
        indicator: 'FIBONACCI',
        value: fibLevels.level38_2.toFixed(2),
        price: currentPrice,
        action: 'SELL',
        reason: 'Price broke below 38.2% Fibonacci retracement level'
      });
    }
  }
  
  return signals;
};
