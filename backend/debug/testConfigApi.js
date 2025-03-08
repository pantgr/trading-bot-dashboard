// testConfigApi.js - Test the config API endpoints
const axios = require('axios');

async function testConfigApi() {
  console.log('Testing config API endpoints...');
  
  try {
    const baseUrl = 'http://localhost:5000/api/config';
    
    // Test GET /settings
    console.log('\n1. Testing GET /settings');
    const getSettingsResponse = await axios.get(`${baseUrl}/settings`);
    console.log('Response:', getSettingsResponse.data);
    
    // Test POST /settings
    console.log('\n2. Testing POST /settings');
    const testSettings = {
      tradingParams: {
        investmentAmount: 0.2,  // 20% of balance per trade
        stopLoss: 0.03,         // 3% stop loss
        takeProfit: 0.12,       // 12% take profit
        maxActiveTrades: 4      // Max 4 active trades
      }
    };
    
    const postSettingsResponse = await axios.post(`${baseUrl}/settings`, { settings: testSettings });
    console.log('Response:', postSettingsResponse.data);
    
    // Test GET /settings/:key
    console.log('\n3. Testing GET /settings/:key');
    const getSpecificSettingResponse = await axios.get(`${baseUrl}/settings/tradingParams`);
    console.log('Response:', getSpecificSettingResponse.data);
    
    // Test POST /settings/:key
    console.log('\n4. Testing POST /settings/:key');
    const newTradingParams = {
      investmentAmount: 0.15,  // 15% of balance per trade
      stopLoss: 0.04,          // 4% stop loss
      takeProfit: 0.10,        // 10% take profit
      maxActiveTrades: 3       // Max 3 active trades
    };
    
    const postSpecificSettingResponse = await axios.post(
      `${baseUrl}/settings/tradingParams`, 
      { value: newTradingParams }
    );
    console.log('Response:', postSpecificSettingResponse.data);
    
    // Verify updated settings
    console.log('\n5. Verifying updated settings');
    const verifySettingsResponse = await axios.get(`${baseUrl}/settings`);
    console.log('Final settings:', verifySettingsResponse.data);
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error testing config API:', error.response?.data || error.message);
  }
}

// Run the tests
testConfigApi()
  .then(() => {
    console.log('Config API test complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Config API test failed:', err);
    process.exit(1);
  });
