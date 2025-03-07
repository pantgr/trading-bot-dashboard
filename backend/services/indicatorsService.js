// services/indicatorsService.js
const { RSI, EMA, SMA, BollingerBands } = require('technicalindicators');
const binanceService = require('./binanceService');

// Υπολογισμός επιπέδων Fibonacci
const calculateFibonacciLevels = (high, low) => {
  const diff = high - low;
  return {
    level0: high,
    level23_6: high - 0.236 * diff,
    level38_2: high - 0.382 * diff,
    level50_0: high - 0.5 * diff,
    level61_8: high - 0.618 * diff,
    level78_6: high - 0.786 * diff,
    level100: low
  };
};

// Υπολογισμός τεχνικών δεικτών για ένα σύμβολο
const calculateIndicators = (candles) => {
  if (!candles || candles.length < 30) {
    console.warn('Not enough candles to calculate indicators');
    return null;
  }

  // Εξαγωγή τιμών κλεισίματος από τα κεριά
  const closes = candles.map(candle => candle.close);
  
  // Υπολογισμός RSI (14 περίοδοι)
  const rsiValues = RSI.calculate({
    values: closes,
    period: 14
  });
  
  // Υπολογισμός EMA (9 και 21 περίοδοι)
  const ema9Values = EMA.calculate({
    values: closes,
    period: 9
  });
  
  const ema21Values = EMA.calculate({
    values: closes,
    period: 21
  });
  
  // Υπολογισμός SMA (50 και 200 περίοδοι)
  const sma50Values = SMA.calculate({
    values: closes,
    period: 50
  });
  
  const sma200Values = SMA.calculate({
    values: closes,
    period: 200
  });
  
  // Υπολογισμός Bollinger Bands (20 περίοδοι, 2 τυπικές αποκλίσεις)
  const bollingerBands = BollingerBands.calculate({
    values: closes,
    period: 20,
    stdDev: 2
  });
  
  // Εύρεση υψηλού και χαμηλού για τα επίπεδα Fibonacci
  const recentCandles = candles.slice(-100); // Χρήση των τελευταίων 100 κεριών
  const highs = recentCandles.map(candle => candle.high);
  const lows = recentCandles.map(candle => candle.low);
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  
  // Υπολογισμός των επιπέδων Fibonacci
  const fibonacciLevels = calculateFibonacciLevels(high, low);
  
  // Λήψη των πιο πρόσφατων τιμών
  const currentValues = {
    rsi: rsiValues[rsiValues.length - 1],
    ema9: ema9Values[ema9Values.length - 1],
    ema21: ema21Values[ema21Values.length - 1],
    sma50: sma50Values[sma50Values.length - 1],
    sma200: sma200Values[sma200Values.length - 1],
    bollinger: bollingerBands[bollingerBands.length - 1],
    fibonacci: fibonacciLevels,
    lastPrice: closes[closes.length - 1],
    lastCandle: candles[candles.length - 1]
  };
  
  // Επιστροφή τρεχουσών τιμών και ιστορικών δεικτών για γραφήματα
  return {
    current: currentValues,
    historical: {
      rsi: rsiValues,
      ema9: ema9Values,
      ema21: ema21Values,
      sma50: sma50Values,
      sma200: sma200Values,
      bollinger: bollingerBands
    }
  };
};

// Έλεγχος για σήματα συναλλαγών βάσει των δεικτών
const checkTradingSignals = (symbol, candles, indicators) => {
  if (!indicators || !indicators.current) {
    return [];
  }

  const signals = [];
  const currentPrice = indicators.current.lastPrice;
  const currentCandle = indicators.current.lastCandle;
  
  // 1. Στρατηγική RSI
  // Αγορά: RSI < 30 (υπερπωλημένο)
  // Πώληση: RSI > 70 (υπεραγορασμένο)
  if (indicators.current.rsi < 30) {
    signals.push({
      symbol,
      time: currentCandle.time,
      indicator: 'RSI',
      action: 'BUY',
      price: currentPrice,
      value: indicators.current.rsi.toFixed(2),
      reason: `RSI is oversold (${indicators.current.rsi.toFixed(2)} < 30)`
    });
  } else if (indicators.current.rsi > 70) {
    signals.push({
      symbol,
      time: currentCandle.time,
      indicator: 'RSI',
      action: 'SELL',
      price: currentPrice,
      value: indicators.current.rsi.toFixed(2),
      reason: `RSI is overbought (${indicators.current.rsi.toFixed(2)} > 70)`
    });
  }
  
  // 2. Στρατηγική EMA Crossover
  // Εάν έχουμε τουλάχιστον 2 κεριά
  if (candles.length >= 2) {
    // Χρήση των ιστορικών τιμών για τον έλεγχο crossover
    const previousEma9 = indicators.historical.ema9[indicators.historical.ema9.length - 2];
    const previousEma21 = indicators.historical.ema21[indicators.historical.ema21.length - 2];
    const currentEma9 = indicators.current.ema9;
    const currentEma21 = indicators.current.ema21;
    
    // Διασταύρωση προς τα πάνω (golden cross): EMA9 πάει πάνω από EMA21
    if (previousEma9 <= previousEma21 && currentEma9 > currentEma21) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'EMA_CROSSOVER',
        action: 'BUY',
        price: currentPrice,
        value: `${currentEma9.toFixed(2)}/${currentEma21.toFixed(2)}`,
        reason: `EMA9 crossed above EMA21 (${currentEma9.toFixed(2)} > ${currentEma21.toFixed(2)})`
      });
    }
    // Διασταύρωση προς τα κάτω (death cross): EMA9 πάει κάτω από EMA21
    else if (previousEma9 >= previousEma21 && currentEma9 < currentEma21) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'EMA_CROSSOVER',
        action: 'SELL',
        price: currentPrice,
        value: `${currentEma9.toFixed(2)}/${currentEma21.toFixed(2)}`,
        reason: `EMA9 crossed below EMA21 (${currentEma9.toFixed(2)} < ${currentEma21.toFixed(2)})`
      });
    }
  }
  
  // 3. Στρατηγική Fibonacci Retracement
  // Εάν έχουμε τουλάχιστον 2 κεριά
  if (candles.length >= 2) {
    const previousClose = candles[candles.length - 2].close;
    const fib = indicators.current.fibonacci;
    
    // Αγορά όταν η τιμή ξεπερνάει προς τα πάνω το επίπεδο 61.8%
    if (previousClose < fib.level61_8 && currentPrice >= fib.level61_8) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'FIBONACCI',
        action: 'BUY',
        price: currentPrice,
        value: fib.level61_8.toFixed(2),
        reason: `Price bounced up from 61.8% Fibonacci level (${fib.level61_8.toFixed(2)})`
      });
    }
    
    // Πώληση όταν η τιμή πέφτει κάτω από το επίπεδο 38.2%
    if (previousClose > fib.level38_2 && currentPrice <= fib.level38_2) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'FIBONACCI',
        action: 'SELL',
        price: currentPrice,
        value: fib.level38_2.toFixed(2),
        reason: `Price broke below 38.2% Fibonacci level (${fib.level38_2.toFixed(2)})`
      });
    }
  }
  
  // 4. Στρατηγική Bollinger Bands
  // Αγορά: Τιμή φτάνει στο κάτω όριο
  // Πώληση: Τιμή φτάνει στο πάνω όριο
  if (indicators.current.bollinger) {
    const { upper, lower } = indicators.current.bollinger;
    
    if (currentPrice <= lower) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'BOLLINGER',
        action: 'BUY',
        price: currentPrice,
        value: `${lower.toFixed(2)}/${upper.toFixed(2)}`,
        reason: `Price reached lower Bollinger Band (${lower.toFixed(2)})`
      });
    } else if (currentPrice >= upper) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'BOLLINGER',
        action: 'SELL',
        price: currentPrice,
        value: `${lower.toFixed(2)}/${upper.toFixed(2)}`,
        reason: `Price reached upper Bollinger Band (${upper.toFixed(2)})`
      });
    }
  }
  
  return signals;
};

// Αρχικοποίηση των δεικτών για ένα σύμβολο
const initializeIndicators = async (symbol, interval = '1h') => {
  try {
    // Λήψη ιστορικών δεδομένων
    const candles = await binanceService.getHistoricalCandles(symbol, interval, 200);
    
    // Υπολογισμός δεικτών
    const indicators = calculateIndicators(candles);
    
    // Έλεγχος για σήματα συναλλαγών
    const signals = checkTradingSignals(symbol, candles, indicators);
    
    return {
      symbol,
      interval,
      indicators,
      signals
    };
  } catch (error) {
    console.error(`Error initializing indicators for ${symbol}:`, error.message);
    throw error;
  }
};

module.exports = {
  calculateIndicators,
  checkTradingSignals,
  initializeIndicators
};
