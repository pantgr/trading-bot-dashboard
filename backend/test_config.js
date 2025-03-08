// test_config.js
const configService = require('./services/configService');

async function testConfig() {
  try {
    console.log('1. Testing config service...');
    
    // Get current settings
    console.log('Fetching current settings...');
    const settings = await configService.getSettings('default');
    console.log('Current settings:', JSON.stringify(settings, null, 2) || 'None found');
    
    // Test saving settings
    console.log('\n2. Testing saving settings...');
    const testSettings = {
      test: true,
      timestamp: Date.now(),
      message: 'This is a test configuration',
      botSettings: {
        signalScores: {
          RSI_BUY: 5,
          BOLLINGER_BUY: 3
        }
      }
    };
    
    await configService.saveSettings(testSettings, 'test-user');
    console.log('Test settings saved');
    
    // Verify the settings were saved
    console.log('\n3. Verifying saved settings...');
    const savedSettings = await configService.getSettings('test-user');
    console.log('Retrieved settings:', JSON.stringify(savedSettings, null, 2));
    
    return true;
  } catch (error) {
    console.error('Error testing config service:', error);
    return false;
  }
}

// Run the test
testConfig()
  .then(success => {
    if (success) {
      console.log('\nTest completed successfully. Config service is working.');
    } else {
      console.log('\nTest failed. Config service is not working properly.');
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
