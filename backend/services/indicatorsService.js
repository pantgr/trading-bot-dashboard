// services/indicatorsService.js - Complete implementation with all required methods
const { RSI, EMA, SMA, BollingerBands } = require('technicalindicators');
const binanceService = require('./binanceService');

// Calculate Fibonacci levels
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

// Calculate technical indicators for a symbol
const calculateIndicators = (candles) => {
  if (!candles || candles.length < 30) {
    console.warn('Not enough candles to calculate indicators');
    return null;
  }

  // Extract closing prices from candles
  const closes = candles.map(candle => candle.close);
  
  // Calculate RSI (14 periods)
  const rsiValues = RSI.calculate({
    values: closes,
    period: 14
  });
  
  // Calculate EMA (9 and 21 periods)
  const ema9Values = EMA.calculate({
    values: closes,
    period: 9
  });
  
  const ema21Values = EMA.calculate({
    values: closes,
    period: 21
  });
  
  // Calculate SMA (50 and 200 periods)
  const sma50Values = SMA.calculate({
    values: closes,
    period: 50
  });
  
  const sma200Values = SMA.calculate({
    values: closes,
    period: 200
  });
  
  // Calculate Bollinger Bands (20 periods, 2 standard deviations)
  const bollingerBands = BollingerBands.calculate({
    values: closes,
    period: 20,
    stdDev: 2
  });
  
  // Find high and low for Fibonacci levels
  const recentCandles = candles.slice(-100); // Use last 100 candles
  const highs = recentCandles.map(candle => candle.high);
  const lows = recentCandles.map(candle => candle.low);
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  
  // Calculate Fibonacci levels
  const fibonacciLevels = calculateFibonacciLevels(high, low);
  
  // Get the most recent values
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
  
  // Return current values and historical indicators for charts
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

// Check for trading signals based on indicators
const checkTradingSignals = (symbol, candles, indicators) => {
  if (!indicators || !indicators.current) {
    console.log(`No indicators available for ${symbol}`);
    return [];
  }

  const signals = [];
  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle.close;
  
  // 1. RSI Strategy
  if (indicators.current.rsi !== undefined) {
    // Buy signal: RSI < 30 (oversold)
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
      console.log(`RSI BUY signal for ${symbol}: ${indicators.current.rsi.toFixed(2)}`);
    } 
    // Sell signal: RSI > 70 (overbought)
    else if (indicators.current.rsi > 70) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'RSI',
        action: 'SELL',
        price: currentPrice,
        value: indicators.current.rsi.toFixed(2),
        reason: `RSI is overbought (${indicators.current.rsi.toFixed(2)} > 70)`
      });
      console.log(`RSI SELL signal for ${symbol}: ${indicators.current.rsi.toFixed(2)}`);
    }
  }
  
  // 2. EMA Crossover Strategy
  if (candles.length >= 2 && indicators.historical) {
    // Use historical values for EMA crossover check
    const ema9History = indicators.historical.ema9;
    const ema21History = indicators.historical.ema21;
    
    if (ema9History && ema21History && ema9History.length > 1 && ema21History.length > 1) {
      const previousEma9 = ema9History[ema9History.length - 2];
      const previousEma21 = ema21History[ema21History.length - 2];
      const currentEma9 = indicators.current.ema9;
      const currentEma21 = indicators.current.ema21;
      
      // Golden cross: EMA9 crosses above EMA21
      if (previousEma9 <= previousEma21 && currentEma9 > currentEma21) {
        signals.push({
          symbol,
          time: currentCandle.time,
          indicator: 'EMA_CROSSOVER',
          action: 'BUY',
          price: currentPrice,
          value: `${currentEma9.toFixed(8)}/${currentEma21.toFixed(8)}`,
          reason: `EMA9 crossed above EMA21 (${currentEma9.toFixed(8)} > ${currentEma21.toFixed(8)})`
        });
        console.log(`EMA CROSSOVER BUY signal for ${symbol}`);
      }
      // Death cross: EMA9 crosses below EMA21
      else if (previousEma9 >= previousEma21 && currentEma9 < currentEma21) {
        signals.push({
          symbol,
          time: currentCandle.time,
          indicator: 'EMA_CROSSOVER',
          action: 'SELL',
          price: currentPrice,
          value: `${currentEma9.toFixed(8)}/${currentEma21.toFixed(8)}`,
          reason: `EMA9 crossed below EMA21 (${currentEma9.toFixed(8)} < ${currentEma21.toFixed(8)})`
        });
        console.log(`EMA CROSSOVER SELL signal for ${symbol}`);
      }
    }
  }
  
  // 3. Bollinger Bands Strategy
  if (indicators.current.bollinger) {
    const { upper, lower } = indicators.current.bollinger;
    
    // Buy: Price reaches the lower band
    if (currentPrice <= lower) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'BOLLINGER',
        action: 'BUY',
        price: currentPrice,
        value: `${lower.toFixed(8)}/${upper.toFixed(8)}`,
        reason: `Price reached lower Bollinger Band (${lower.toFixed(8)})`
      });
      console.log(`BOLLINGER BUY signal for ${symbol}`);
    } 
    // Sell: Price reaches the upper band
    else if (currentPrice >= upper) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'BOLLINGER',
        action: 'SELL',
        price: currentPrice,
        value: `${lower.toFixed(8)}/${upper.toFixed(8)}`,
        reason: `Price reached upper Bollinger Band (${upper.toFixed(8)})`
      });
      console.log(`BOLLINGER SELL signal for ${symbol}`);
    }
  }
  
  // 4. Fibonacci Retracement Strategy
  if (candles.length >= 2 && indicators.current.fibonacci) {
    const previousClose = candles[candles.length - 2].close;
    const fib = indicators.current.fibonacci;
    
    // Buy when price bounces from 61.8% level
    if (previousClose < fib.level61_8 && currentPrice >= fib.level61_8) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'FIBONACCI',
        action: 'BUY',
        price: currentPrice,
        value: fib.level61_8.toFixed(8),
        reason: `Price bounced up from 61.8% Fibonacci level (${fib.level61_8.toFixed(8)})`
      });
      console.log(`FIBONACCI BUY signal for ${symbol}`);
    }
    
    // Sell when price breaks below 38.2% level
    if (previousClose > fib.level38_2 && currentPrice <= fib.level38_2) {
      signals.push({
        symbol,
        time: currentCandle.time,
        indicator: 'FIBONACCI',
        action: 'SELL',
        price: currentPrice,
        value: fib.level38_2.toFixed(8),
        reason: `Price broke below 38.2% Fibonacci level (${fib.level38_2.toFixed(8)})`
      });
      console.log(`FIBONACCI SELL signal for ${symbol}`);
    }
  }
  
  // Log signal count
  if (signals.length > 0) {
    console.log(`Generated ${signals.length} signals for ${symbol}`);
  }
  
  return signals;
};

// Initialize indicators for a symbol
const initializeIndicators = async (symbol, interval = '1h') => {
  try {
    // Get historical data
    const candles = await binanceService.getHistoricalCandles(symbol, interval, 200);
    
    // Calculate indicators
    const indicators = calculateIndicators(candles);
    
    // Check for trading signals
    const signals = checkTradingSignals(symbol, candles, indicators);
    
    console.log(`Initialized indicators for ${symbol} (${interval}), found ${signals.length} signals`);
    
    // If there are signals, log them
    if (signals.length > 0) {
      console.log('Initial signals:', 
        signals.map(s => `${s.indicator} ${s.action} at ${new Date(s.time).toISOString()}`).join(', ')
      );
    }
    
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