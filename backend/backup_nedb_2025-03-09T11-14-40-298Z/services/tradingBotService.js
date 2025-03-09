// services/tradingBotService.js - Updated to use database instead of memory
const binanceService = require('./binanceService');
const indicatorsService = require('./indicatorsService');
const { EventEmitter } = require('events');
const consensusService = require('./consensusService');
const configService = require('./configService');
const virtualTradingService = require('./virtualTrading');

// Import new database models
const Signal = require('../models/Signal');
const ActiveBot = require('../models/ActiveBot');
const MarketData = require('../models/MarketData');

// Trading Bot with event emitter to send updates
class TradingBot extends EventEmitter {
  constructor() {
    super();
    this.isRunning = false;
    
    // Load settings from config service at startup
    this.loadSettingsFromConfig()
      .then(loaded => {
        if (loaded) {
          console.log("Bot initialized with settings from database");
        } else {
          console.log("Bot initialized with default settings");
        }
        
        // Restore active bots from database
        this.restoreActiveBots()
          .then(count => {
            console.log(`Restored ${count} active bots from database`);
            
            // Set up periodic cleanup of old data
            this.setupCleanupTasks();
          })
          .catch(err => {
            console.error("Failed to restore active bots:", err);
          });
      })
      .catch(err => {
        console.error("Failed to initialize settings:", err);
      });
  }
  
  // Start bot for a specific symbol
  async startMonitoring(symbol, interval = '5m', userId = 'default') {
    const formattedSymbol = symbol.toUpperCase();
    const botKey = `${formattedSymbol}-${interval}-${userId}`;
    
    try {
      // Check if bot is already running in database
      const existingBot = await ActiveBot.findByKey(formattedSymbol, interval, userId);
      
      if (existingBot && existingBot.active) {
        console.log(`Bot already monitoring ${botKey}`);
        return;
      }
      
      console.log(`Starting trading bot for ${botKey}`);
      
      // Initialize indicators and get historical data
      const initialData = await indicatorsService.initializeIndicators(formattedSymbol, interval);
      
      // Process initial signals
      if (initialData.signals && initialData.signals.length > 0) {
        console.log(`Processing ${initialData.signals.length} initial signals for ${formattedSymbol}`);
        await this.processSignals(formattedSymbol, initialData.signals, userId);
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
      
      // Store active bot in database
      const activeBot = new ActiveBot({
        symbol: formattedSymbol,
        interval,
        userId,
        active: true,
        startTime: Date.now(),
        callbackId: Math.random().toString(36).substring(2, 15)
      });
      
      await activeBot.save();
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
  async stopMonitoring(symbol, interval = '5m', userId = 'default') {
    const formattedSymbol = symbol.toUpperCase();
    const botKey = `${formattedSymbol}-${interval}-${userId}`;
    
    try {
      // Find the bot in database
      const activeBot = await ActiveBot.findByKey(formattedSymbol, interval, userId);
      
      if (activeBot && activeBot.active) {
        // Unsubscribe from Binance
        binanceService.unsubscribeFromCandleUpdates(
          formattedSymbol, 
          interval
        );
        
        // Mark bot as inactive and update database
        activeBot.active = false;
        activeBot.stopTime = Date.now();
        await activeBot.save();
        
        console.log(`Stopped monitoring ${botKey}`);
        
        // Emit bot stopped event
        this.emit('bot_stopped', {
          symbol: formattedSymbol,
          userId,
          interval,
          time: Date.now()
        });
        
        // Update running state
        const activeBots = await ActiveBot.findActive();
        this.isRunning = activeBots.length > 0;
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error stopping bot for ${botKey}:`, error);
      return false;
    }
  }
  
  // Callback for real-time updates
  async updateCallback(candle, symbol, interval, userId) {
    try {
      // First, check if the bot is still active
      const activeBot = await ActiveBot.findByKey(symbol, interval, userId);
      if (!activeBot || !activeBot.active) {
        console.log(`Bot for ${symbol} (${interval}) is no longer active, skipping update`);
        // Unsubscribe from updates
        binanceService.unsubscribeFromCandleUpdates(symbol, interval);
        return;
      }
      
      if (candle.isClosed) {
        // Save candle to database
        await MarketData.saveCandle(symbol, interval, candle);
        
        // Get the latest candles (at least 50)
        const cachedCandles = await MarketData.getCandles(symbol, interval, 100);
        
        // If not enough candles in cache, request more
        let candles = cachedCandles;
        if (candles.length < 50) {
          const historicalCandles = await binanceService.getHistoricalCandles(symbol, interval, 100);
          candles = historicalCandles;
          
          // Save historical candles to database
          for (const histCandle of historicalCandles) {
            await MarketData.saveCandle(symbol, interval, histCandle);
          }
        }
        
        // Calculate indicators
        const indicators = indicatorsService.calculateIndicators(candles);
        
        // Check for trading signals
        const signals = indicatorsService.checkTradingSignals(symbol, candles, indicators);
        
        // Process new signals
        if (signals.length > 0) {
          console.log(`Processing ${signals.length} new signals for ${symbol}`);
          await this.processSignals(symbol, signals, userId);
        }
        
        // Emit the indicators update event
        this.emit('indicators_update', {
          symbol,
          userId,
          indicators,
          time: candle.time
        });
      }
      
      // Save current price to database
      await MarketData.savePrice(symbol, candle.close);
      
      // Emit the price update event
      this.emit('price_update', {
        symbol,
        userId,
        price: candle.close,
        time: candle.time,
        candle
      });
    } catch (error) {
      console.error(`Error in update callback for ${symbol}:`, error);
    }
  }
  
  // Process trading signals
  async processSignals(symbol, signals, userId) {
    if (!signals || signals.length === 0) return;
    
    try {
      // Add signals to database
      for (const signal of signals) {
        // Add userId to the signal
        signal.userId = userId;
        
        // Create a new Signal object and save to database
        const newSignal = new Signal(signal);
        await newSignal.save();
        
        // Emit trading signal (for display, not execution)
        this.emit('trade_signal', {
          ...signal,
          userId
        });
      }
      
      // Get recent signals from database (last 15 minutes)
      const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
      const recentSignals = await Signal.find({
        symbol,
        userId,
        time: { $gte: fifteenMinutesAgo }
      });
      
      // Get the current price from the most recent signal
      const currentPrice = signals[0].price;
      
      // Analyze signals for consensus
      const consensus = consensusService.analyzeSignals(recentSignals);
      
      // If we have consensus, create consensus signal and execute it
      if (consensus) {
        const consensusSignal = consensusService.createConsensusSignal(consensus, symbol, currentPrice);
        
        if (consensusSignal) {
          // Add userId to consensus signal
          consensusSignal.userId = userId;
          
          // Check for recent duplicate consensus signals
          const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
          const recentConsensusSignals = await Signal.find({
            symbol,
            userId,
            indicator: 'CONSENSUS',
            action: consensusSignal.action,
            time: { $gte: thirtyMinutesAgo }
          });
          
          if (recentConsensusSignals.length === 0) {
            // Save consensus signal to database
            const newConsensusSignal = new Signal(consensusSignal);
            await newConsensusSignal.save();
            
            console.log(`Emitting consensus signal: ${consensusSignal.action} for ${symbol}`);
            
            // Emit consensus signal
            this.emit('trade_signal', {
              ...consensusSignal,
              userId
            });
            
            // Execute trade based on consensus signal
            this.executeTrade(consensusSignal, userId);
          } else {
            console.log(`Skipping duplicate consensus ${consensusSignal.action} signal for ${symbol}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error processing signals for ${symbol}:`, error);
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
  async getActiveSymbols(userId = null) {
    try {
      const query = userId ? { userId, active: true } : { active: true };
      const activeBots = await ActiveBot.find(query);
      
      return activeBots.map(bot => ({
        symbol: bot.symbol,
        interval: bot.interval,
        userId: bot.userId,
        startTime: bot.startTime,
        uptime: Date.now() - bot.startTime
      }));
    } catch (error) {
      console.error('Error getting active symbols:', error);
      return [];
    }
  }
  
  // Get bot status
  async getStatus() {
    try {
      const activeBots = await ActiveBot.find({ active: true });
      
      return {
        isRunning: activeBots.length > 0,
        activeSymbolsCount: activeBots.length,
        activeSymbols: activeBots.map(bot => `${bot.symbol}-${bot.interval}-${bot.userId}`)
      };
    } catch (error) {
      console.error('Error getting bot status:', error);
      return {
        isRunning: this.isRunning,
        activeSymbolsCount: 0,
        activeSymbols: []
      };
    }
  }
  
  // Restore active bots from database after restart
  async restoreActiveBots() {
    try {
      const activeBots = await ActiveBot.find({ active: true });
      
      if (activeBots.length === 0) {
        console.log('No active bots to restore');
        return 0;
      }
      
      console.log(`Found ${activeBots.length} active bots to restore`);
      
      for (const bot of activeBots) {
        console.log(`Restoring bot for ${bot.symbol} (${bot.interval})`);
        
        try {
          // Re-subscribe to updates
          await this.startMonitoring(bot.symbol, bot.interval, bot.userId);
        } catch (error) {
          console.error(`Error restoring bot for ${bot.symbol}:`, error);
          
          // Mark bot as inactive if we couldn't restore it
          bot.active = false;
          bot.stopTime = Date.now();
          await bot.save();
        }
      }
      
      // Re-check active bots after restoration attempts
      const stillActive = await ActiveBot.find({ active: true });
      this.isRunning = stillActive.length > 0;
      
      return stillActive.length;
    } catch (error) {
      console.error('Error restoring active bots:', error);
      return 0;
    }
  }
  
  // Set up periodic cleanup of old data
  setupCleanupTasks() {
    // Clean up signals once a day
    setInterval(async () => {
      try {
        await Signal.cleanup(30 * 24 * 60 * 60 * 1000); // 30 days
      } catch (error) {
        console.error('Error in signal cleanup task:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run once a day
    
    // Clean up market data once a day
    setInterval(async () => {
      try {
        await MarketData.cleanup();
      } catch (error) {
        console.error('Error in market data cleanup task:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run once a day
    
    // Clean up inactive bots once a day
    setInterval(async () => {
      try {
        await ActiveBot.cleanup(7 * 24 * 60 * 60 * 1000); // 7 days
      } catch (error) {
        console.error('Error in active bot cleanup task:', error);
      }
    }, 24 * 60 * 60 * 1000); // Run once a day
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