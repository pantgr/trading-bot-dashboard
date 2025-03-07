// services/tradingBotService.js
const binanceService = require('./binanceService');
const indicatorsService = require('./indicatorsService');
const { EventEmitter } = require('events');
const consensusService = require('./consensusService');

// Trading Bot με event emitter για να στέλνει ενημερώσεις
class TradingBot extends EventEmitter {
  constructor() {
    super();
    this.activeSymbols = new Map(); // Σύμβολα που παρακολουθούνται
    this.lastSignals = new Map(); // Τελευταία σήματα ανά σύμβολο
    this.isRunning = false;
  }
  
  // Εκκίνηση του bot για ένα συγκεκριμένο σύμβολο
  async startMonitoring(symbol, interval = '5m', userId = 'default') {
    const formattedSymbol = symbol.toUpperCase();
    const botKey = `${formattedSymbol}-${interval}-${userId}`;
    
    // Έλεγχος αν παρακολουθείται ήδη
    if (this.activeSymbols.has(botKey)) {
      console.log(`Bot already monitoring ${botKey}`);
      return;
    }
    
    console.log(`Starting trading bot for ${botKey}`);
    
    try {
      // Αρχικοποίηση δεικτών και λήψη ιστορικών δεδομένων
      const initialData = await indicatorsService.initializeIndicators(formattedSymbol, interval);
      
      // Έλεγχος και επεξεργασία αρχικών σημάτων
      if (initialData.signals && initialData.signals.length > 0) {
        this.processSignals(formattedSymbol, initialData.signals, userId);
      }
      
      // Callback για ενημερώσεις σε πραγματικό χρόνο
      const updateCallback = async (candle) => {
        if (candle.isClosed) {
          // Λήψη των τελευταίων κεριών (τουλάχιστον 50)
          const cacheKey = `${formattedSymbol}-${interval}`;
          let candles = binanceService.candleCache.get(cacheKey) || [];
          
          // Αν δεν υπάρχουν αρκετά κεριά στο cache, ζητάμε περισσότερα
          if (candles.length < 50) {
            candles = await binanceService.getHistoricalCandles(formattedSymbol, interval, 100);
          }
          
          // Υπολογισμός δεικτών
          const indicators = indicatorsService.calculateIndicators(candles);
          
          // Έλεγχος για σήματα συναλλαγών
          const signals = indicatorsService.checkTradingSignals(formattedSymbol, candles, indicators);
          
          // Επεξεργασία νέων σημάτων
          if (signals.length > 0) {
            this.processSignals(formattedSymbol, signals, userId);
          }
          
          // Εκπομπή του γεγονότος ενημέρωσης δεικτών
          this.emit('indicators_update', {
            symbol: formattedSymbol,
            userId,
            indicators,
            time: candle.time
          });
        }
        
        // Εκπομπή του γεγονότος ενημέρωσης τιμής
        this.emit('price_update', {
          symbol: formattedSymbol,
          userId,
          price: candle.close,
          time: candle.time,
          candle
        });
      };
      
      // Εγγραφή στις ενημερώσεις κεριών από το Binance
      const connection = binanceService.subscribeToCandleUpdates(
        formattedSymbol, 
        interval, 
        updateCallback
      );
      
      // Αποθήκευση των δεδομένων παρακολούθησης
      this.activeSymbols.set(botKey, {
        symbol: formattedSymbol,
        interval,
        userId,
        connection,
        updateCallback,
        startTime: Date.now()
      });
      
      this.isRunning = true;
      
      // Εκπομπή του γεγονότος έναρξης
      this.emit('bot_started', {
        symbol: formattedSymbol,
        userId,
        interval,
        time: Date.now()
      });
      
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
  
  // Διακοπή παρακολούθησης για ένα σύμβολο
  stopMonitoring(symbol, interval = '5m', userId = 'default') {
    const formattedSymbol = symbol.toUpperCase();
    const botKey = `${formattedSymbol}-${interval}-${userId}`;
    
    if (this.activeSymbols.has(botKey)) {
      const botData = this.activeSymbols.get(botKey);
      
      // Ακύρωση συνδρομής από το Binance
      binanceService.unsubscribeFromCandleUpdates(
        formattedSymbol, 
        interval, 
        botData.updateCallback
      );
      
      this.activeSymbols.delete(botKey);
      console.log(`Stopped monitoring ${botKey}`);
      
      // Εκπομπή του γεγονότος διακοπής
      this.emit('bot_stopped', {
        symbol: formattedSymbol,
        userId,
        interval,
        time: Date.now()
      });
      
      // Έλεγχος αν υπάρχουν άλλα ενεργά σύμβολα
      this.isRunning = this.activeSymbols.size > 0;
      
      return true;
    }
    
    return false;
  }
  
  // Επεξεργασία σημάτων συναλλαγών

processSignals(symbol, signals, userId) {
  if (!signals || signals.length === 0) return;
  
  // Δημιουργία του παραθύρου σημάτων
  if (!this.signalWindow) {
    this.signalWindow = {};
  }
  
  if (!this.signalWindow[symbol]) {
    this.signalWindow[symbol] = [];
  }
  
  // Προσθήκη των νέων σημάτων στο παράθυρο
  this.signalWindow[symbol] = [...this.signalWindow[symbol], ...signals];
  
  // Διατήρηση μόνο των πρόσφατων σημάτων (τελευταία 15 λεπτά)
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  this.signalWindow[symbol] = this.signalWindow[symbol].filter(signal => signal.time > fifteenMinutesAgo);
  
  // Λήψη της τρέχουσας τιμής
  const currentPrice = signals[0].price; // Χρησιμοποιούμε την τιμή του πιο πρόσφατου σήματος
  
  // Ανάλυση των σημάτων για consensus
  const consensus = consensusService.analyzeSignals(this.signalWindow[symbol]);
  
  // Επεξεργασία των μεμονωμένων σημάτων (για εμφάνιση στο UI)
  for (const signal of signals) {
    const signalKey = `${symbol}-${signal.indicator}-${signal.action}`;
    
    // Έλεγχος αν έχουμε ήδη επεξεργαστεί αυτό το σήμα πρόσφατα
    if (this.lastSignals.has(signalKey)) {
      const lastTime = this.lastSignals.get(signalKey);
      // Αγνόηση του σήματος αν έχει δοθεί ξανά τα τελευταία 30 λεπτά
      if (signal.time - lastTime < 30 * 60 * 1000) {
        continue;
      }
    }
    
    // Αποθήκευση του χρόνου του σήματος
    this.lastSignals.set(signalKey, signal.time);
    
    // Εκπομπή του σήματος συναλλαγής (για εμφάνιση, όχι για εκτέλεση)
    this.emit('trade_signal', {
      ...signal,
      userId
    });
  }
  
  // Αν έχουμε consensus, δημιουργούμε το σήμα consensus και το εκτελούμε
  if (consensus) {
    const consensusSignal = consensusService.createConsensusSignal(consensus, symbol, currentPrice);
    if (consensusSignal) {
      const consensusKey = `${symbol}-CONSENSUS-${consensusSignal.action}`;
      
      // Αποφυγή επαναλαμβανόμενων consensus σημάτων
      if (this.lastSignals.has(consensusKey)) {
        const lastTime = this.lastSignals.get(consensusKey);
        if (consensusSignal.time - lastTime < 30 * 60 * 1000) {
          return; // Αγνόηση consensus σήματος αν έχει δοθεί πρόσφατα
        }
      }
      
      this.lastSignals.set(consensusKey, consensusSignal.time);
      
      // Εκπομπή του consensus σήματος
      this.emit('trade_signal', {
        ...consensusSignal,
        userId
      });
      
      // Εκτέλεση της συναλλαγής βάσει του consensus σήματος
      this.executeTrade(consensusSignal, userId);
    }
  }
}

// Προσθέστε μια νέα μέθοδο για την εκτέλεση της συναλλαγής
executeTrade(signal, userId) {
  if (!signal) return;
  
  console.log(`Executing consensus trade: ${signal.action} ${signal.symbol} based on consensus`);
  
  // Εδώ θα προωθούσατε το σήμα στη μέθοδο processSignal του bot
  // Απλοποιημένη προσέγγιση για λόγους συμβατότητας
  this.emit('trade_signal', {
    ...signal,
    userId
  });
}
  
  // Λήψη των ενεργών συμβόλων που παρακολουθούνται
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
  
  // Έλεγχος κατάστασης του bot
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeSymbolsCount: this.activeSymbols.size,
      activeSymbols: Array.from(this.activeSymbols.keys())
    };
  }
}

// Δημιουργία singleton instance του bot
const tradingBot = new TradingBot();

module.exports = tradingBot;
