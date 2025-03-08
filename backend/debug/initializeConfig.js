// initializeConfig.js - Initialize default configuration
const Config = require('../models/Config');

async function initializeConfig() {
  console.log('Initializing default configuration...');
  
  try {
    // Check if default config exists
    const existingConfig = await Config.findOne({ userId: 'default' });
    
    if (existingConfig) {
      console.log('Default config already exists:', existingConfig);
      return existingConfig;
    }
    
    // Create default config with common settings
    const defaultConfig = new Config({
      userId: 'default',
      settings: {
        // Trading parameters
        tradingParams: {
          investmentAmount: 0.1,    // 10% of balance per trade
          stopLoss: 0.05,           // 5% stop loss
          takeProfit: 0.15,         // 15% take profit
          maxActiveTrades: 5,       // Max 5 active trades
          indicators: ['RSI', 'MACD', 'MA'],  // Default indicators
          tradingPairs: ['BTCUSDT', 'ETHUSDT', 'PROSUSDT', 'ADAUSDT', 'DOGEUSDT']  // Default pairs
        },
        
        // UI preferences
        uiPreferences: {
          theme: 'dark',            // Default theme
          chartInterval: '1h',      // Default chart interval
          defaultPair: 'BTCUSDT',   // Default trading pair
          notifications: true       // Enable notifications
        },
        
        // Bot settings
        botSettings: {
          autoTrading: false,       // Auto-trading disabled by default
          riskLevel: 'medium',      // Default risk level
          tradingHours: {
            enabled: false,
            start: '09:00',
            end: '17:00',
            timezone: 'UTC'
          }
        },
        
        // API keys (placeholders - to be filled by user)
        apiKeys: {
          binance: {
            apiKey: '',
            secretKey: ''
          }
        }
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    await defaultConfig.save();
    console.log('Default configuration created successfully:', defaultConfig.settings);
    return defaultConfig;
  } catch (error) {
    console.error('Error initializing configuration:', error);
    throw error;
  }
}

// Run the initialization
initializeConfig()
  .then(() => {
    console.log('Config initialization complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Config initialization failed:', err);
    process.exit(1);
  });
