// services/tradingBotService.js - Complete fixed version
const binanceService = require('./binanceService');
const indicatorsService = require('./indicatorsService');
const { EventEmitter } = require('events');
const consensusService = require('./consensusService');
const configService = require('./configService');
const virtualTradingService = require('./virtualTrading');

// Trading Bot with event emitter to send updates
class TradingBot extends EventEmitter {
  constructor() {
    super();
    this.activeSymbols = new Map(); // Symbols being monitored
    this.lastSignals = new Map(); // Last signals per symbol
    this.signalWindow = {}; // Window of signals for each symbol
    this.isRunning = false;
    
    // Load settings from config service at startup
    this.loadSettingsFromConfig()
      .then(loaded => {
        if (loaded) {
          console.log("Bot initialized with settings from database");
        } else {
          console.log("Bot initialized with default settings");
        }
      })
      .catch(err => {
        console.error("Failed to initialize settings:", err);
      });
  }
  
  // Start bot for a specific symbol
  async startMonitoring(symbol, interval = '5m', userId = 'default') {
    const formattedSymbol = symbol.toUpperCase();
    const botKey = `${formattedSymbol}-${interval}-${userId}`;
    
    // Check if already monitoring
    if (this.activeSymbols.has(botKey)) {
      console.log(`Bot already monitoring ${botKey}`);
      return;
    }
    
    console.log(`Starting trading bot for ${botKey}`);
    
    try {
      // Initialize indicators and get historical data
      const initialData = await indicatorsService.initializeIndicators(formattedSymbol, interval);
      
      // Process initial signals
      if (initialData.signals && initialData.signals.length > 0) {
        console.log(`Processing ${initialData.signals.length} initial signals for ${formattedSymbol}`);
        this.processSignals(formattedSymbol, initialData.signals, userId);
      }
      
      // Create a bound callback for this specific symbol/interval
      const boundCallback = async (candle) => {
        await this.updateCallback(candle, formattedSymbol, interval, userId);
      };
      
      // Subscribe to candle updates from Binance
      const connection = binanceService.subscribeToCandleUpdates(
        formattedSymbol, 
        interval, 
        boundCallback
      );
      
      // Store monitoring data
      this.activeSymbols.set(botKey, {
        symbol: formattedSymbol,
        interval,
        userId,
        connection,
        updateCallback: boundCallback,
        startTime: Date.now()
      });
      
      this.isRunning = true;
      
      // Emit bot started event
      this.emit('bot_started', {
        symbol: formattedSymbol,
        userId,
        interval,
        time: Date.now()
      });
      
      console.log(`Bot started for ${formattedSymbol} (${interval})`);
      
      return {
        symbol: formattedSymbol,
        interval,
        indicators: initialData.indicators,
        signals: initialData.signals
      };
    } catch (error) {
      console.error(`Error starting trading bot for ${botKey}:`, error.message);
      throw error;
    }
  }
  
  // Stop monitoring for a symbol
  stopMonitoring(symbol, interval = '5m', userId = 'default') {
    const formattedSymbol = symbol.toUpperCase();
    const botKey = `${formattedSymbol}-${interval}-${userId}`;
    
    if (this.activeSymbols.has(botKey)) {
      const botData = this.activeSymbols.get(botKey);
      
      // Unsubscribe from Binance
      binanceService.unsubscribeFromCandleUpdates(
        formattedSymbol, 
        interval, 
        botData.updateCallback
      );
      
      this.activeSymbols.delete(botKey);
      console.log(`Stopped monitoring ${botKey}`);
      
      // Emit bot stopped event
      this.emit('bot_stopped', {
        symbol: formattedSymbol,
        userId,
        interval,
        time: Date.now()
      });
      
      // Check if there are other active symbols
      this.isRunning = this.activeSymbols.size > 0;
      
      return true;
    }
    
    return false;
  }
  
  // Callback for real-time updates
  async updateCallback(candle, symbol, interval, userId) {
    if (candle.isClosed) {
      // Get the latest candles (at least 50)
      const cacheKey = `${symbol}-${interval}`;
      let candles = binanceService.candleCache.get(cacheKey) || [];
      
      // If not enough candles in cache, request more
      if (candles.length < 50) {
        candles = await binanceService.getHistoricalCandles(symbol, interval, 100);
      }
      
      // Calculate indicators
      const indicators = indicatorsService.calculateIndicators(candles);
      
      // Check for trading signals
      const signals = indicatorsService.checkTradingSignals(symbol, candles, indicators);
      
      // Process new signals
      if (signals.length > 0) {
        console.log(`Processing ${signals.length} new signals for ${symbol}`);
        this.processSignals(symbol, signals, userId);
      }
      
      // Emit the indicators update event - ensure we include both 'current' and 'historical'
      this.emit('indicators_update', {
        symbol,
        userId,
        indicators,
        time: candle.time
      });
    }
    
    // Emit the price update event
    this.emit('price_update', {
      symbol,
      userId,
      price: candle.close,
      time: candle.time,
      candle
    });
  }
  
  // Process trading signals
  processSignals(symbol, signals, userId) {
    if (!signals || signals.length === 0) return;
    
    // Create the signal window if it doesn't exist
    if (!this.signalWindow) {
      this.signalWindow = {};
    }
    
    if (!this.signalWindow[symbol]) {
      this.signalWindow[symbol] = [];
    }
    
    // Add the new signals to the window
    this.signalWindow[symbol] = [...this.signalWindow[symbol], ...signals];
    
    // Keep only recent signals (last 15 minutes)
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    this.signalWindow[symbol] = this.signalWindow[symbol].filter(signal => signal.time > fifteenMinutesAgo);
    
    // Get the current price from the most recent signal
    const currentPrice = signals[0].price;
    
    // Process individual signals (for display in UI)
    for (const signal of signals) {
      const signalKey = `${symbol}-${signal.indicator}-${signal.action}`;
      
      // Check if we've already processed this signal recently
      if (this.lastSignals.has(signalKey)) {
        const lastTime = this.lastSignals.get(signalKey);
        // Skip if signal was given again in the last 30 minutes
        if (signal.time - lastTime < 30 * 60 * 1000) {
          continue;
        }
      }
      
      // Save the signal time
      this.lastSignals.set(signalKey, signal.time);
      
      console.log(`Emitting trade signal: ${signal.indicator} ${signal.action} for ${symbol}`);
      
      // Emit trading signal (for display, not execution)
      this.emit('trade_signal', {
        ...signal,
        userId
      });
    }
    
    // Analyze signals for consensus
    const consensus = consensusService.analyzeSignals(this.signalWindow[symbol]);
    
    // If we have consensus, create consensus signal and execute it
    if (consensus) {
      const consensusSignal = consensusService.createConsensusSignal(consensus, symbol, currentPrice);
      if (consensusSignal) {
        const consensusKey = `${symbol}-CONSENSUS-${consensusSignal.action}`;
        
        // Avoid repeated consensus signals
        if (this.lastSignals.has(consensusKey)) {
          const lastTime = this.lastSignals.get(consensusKey);
          if (consensusSignal.time - lastTime < 30 * 60 * 1000) {
            return; // Skip consensus signal if given recently
          }
        }
        
        this.lastSignals.set(consensusKey, consensusSignal.time);
        
        console.log(`Emitting consensus signal: ${consensusSignal.action} for ${symbol}`);
        
        // Emit consensus signal
        this.emit('trade_signal', {
          ...consensusSignal,
          userId
        });
        
        // Execute trade based on consensus signal
        this.executeTrade(consensusSignal, userId);
      }
    }
  }
  
  // Execute trade based on signal
  executeTrade(signal, userId) {
    if (!signal) return;
    
    console.log(`Executing consensus trade: ${signal.action} ${signal.symbol} based on consensus`);
    
    try {
      // Process the signal to actually perform the trade
      virtualTradingService.processSignal(signal, userId)
        .then(result => {
          console.log(`Trade executed successfully for ${signal.symbol}: ${signal.action}`);
        })
        .catch(error => {
          console.error(`Error executing trade for ${signal.symbol}:`, error.message);
        });
    } catch (error) {
      console.error(`Failed to execute trade for ${signal.symbol}:`, error);
    }
  }
  
  // Get active symbols being monitored
  getActiveSymbols(userId = null) {
    const result = [];
    
    for (const [botKey, botData] of this.activeSymbols.entries()) {
      if (!userId || botData.userId === userId) {
        result.push({
          symbol: botData.symbol,
          interval: botData.interval,
          userId: botData.userId,
          startTime: botData.startTime,
          uptime: Date.now() - botData.startTime
        });
      }
    }
    
    return result;
  }
  
  // Get bot status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeSymbolsCount: this.activeSymbols.size,
      activeSymbols: Array.from(this.activeSymbols.keys())
    };
  }
  
  // Load settings from configuration database
  async loadSettingsFromConfig() {
    try {
      const configSettings = await configService.getSettings("default");
      
      if (configSettings && Object.keys(configSettings).length > 0) {
        // We have settings stored in the database
        console.log("Loading bot settings from configuration database");
        
        // Only use stored settings if they have the required fields
        if (configSettings.signalScores && configSettings.thresholds && 
            configSettings.indicators && configSettings.moneyManagement) {
          
          // Update consensus service settings
          if (configSettings.signalScores) {
            Object.keys(configSettings.signalScores).forEach(key => {
              if (consensusService.SIGNAL_SCORES.hasOwnProperty(key)) {
                consensusService.SIGNAL_SCORES[key] = configSettings.signalScores[key];
              }
            });
          }
          
          if (configSettings.thresholds) {
            if (configSettings.thresholds.BUY_THRESHOLD !== undefined) {
              consensusService.BUY_THRESHOLD = configSettings.thresholds.BUY_THRESHOLD;
            }
            
            if (configSettings.thresholds.SELL_THRESHOLD !== undefined) {
              consensusService.SELL_THRESHOLD = configSettings.thresholds.SELL_THRESHOLD;
            }
            
            if (configSettings.thresholds.TIME_WINDOW_MS !== undefined) {
              consensusService.TIME_WINDOW_MS = configSettings.thresholds.TIME_WINDOW_MS;
            }
          }
          
          console.log("Successfully loaded settings from database");
          return true;
        }
      }
      
      // If we reach here, either no settings in DB or they're incomplete
      // Save the current settings to the database
      console.log("Saving default settings to database");
      const defaultSettings = {
        signalScores: { ...consensusService.SIGNAL_SCORES },
        thresholds: {
          BUY_THRESHOLD: consensusService.BUY_THRESHOLD,
          SELL_THRESHOLD: consensusService.SELL_THRESHOLD,
          TIME_WINDOW_MS: consensusService.TIME_WINDOW_MS
        },
        indicators: {
          RSI_PERIOD: 14,
          EMA_SHORT_PERIOD: 9,
          EMA_LONG_PERIOD: 21,
          BOLLINGER_PERIOD: 20,
          BOLLINGER_STD_DEV: 2
        },
        moneyManagement: {
          BUY_AMOUNT_PERCENTAGE: 10,
          SELL_AMOUNT_PERCENTAGE: 25
        }
      };
      
      await configService.saveSettings(defaultSettings, "default");
      return false;
    } catch (error) {
      console.error("Error loading settings from config:", error);
      return false;
    }
  }
  
  // Save bot settings to configuration database
  async saveBotSettings(settings) {
    try {
      await configService.saveSettings(settings, "default");
      console.log("Bot settings saved to configuration database");
      return true;
    } catch (err) {
      console.error("Failed to save bot settings to database:", err);
      return false;
    }
  }
}

// Create singleton instance
const tradingBot = new TradingBot();

module.exports = tradingBot;