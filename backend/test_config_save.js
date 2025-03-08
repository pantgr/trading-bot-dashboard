// fix_bot_settings.js
const fs = require('fs');
const path = require('path');

// Paths to the relevant files
const tradingBotServicePath = path.join(__dirname, 'services', 'tradingBotService.js');

// Read the tradingBotService file
console.log('Reading tradingBotService.js...');
let tradingBotContent = fs.readFileSync(tradingBotServicePath, 'utf8');

// Check if the file already imports configService
const hasConfigImport = tradingBotContent.includes('const configService = require(');

if (!hasConfigImport) {
  console.log('Adding configService import...');
  // Add configService import after other imports
  tradingBotContent = tradingBotContent.replace(
    /const\s+(\w+)\s*=\s*require\(['"]\.\/.+['"]\);/,
    'const $1 = require(\'$&\');\nconst configService = require(\'./configService\');'
  );
}

// Look for a settings initialization or default settings
// This regex looks for object literals assigned to botSettings or DEFAULT_SETTINGS
const settingsRegex = /(const|let|var)\s+(botSettings|DEFAULT_SETTINGS)\s*=\s*({[\s\S]*?});/;
const hasSettings = settingsRegex.test(tradingBotContent);

if (hasSettings) {
  console.log('Adding code to load settings from configService...');
  // Replace the settings initialization with one that loads from configService
  tradingBotContent = tradingBotContent.replace(
    settingsRegex,
    `$1 $2 = $3;

// Load settings from config service
async function loadSettingsFromConfig() {
  try {
    const configSettings = await configService.getSettings('default');
    
    // If we have settings in the config, use them
    if (configSettings && configSettings.signalScores) {
      console.log('Loading bot settings from configuration service');
      $2 = configSettings;
      return true;
    }
    
    // Otherwise save our default settings to config
    console.log('Saving default bot settings to configuration service');
    await configService.saveSettings($2, 'default');
    return false;
  } catch (error) {
    console.error('Error loading settings from config:', error);
    return false;
  }
}`
  );

  // Look for the bot initialization or service export
  const initOrExportRegex = /(module\.exports\s*=|const\s+tradingBot\s*=|exports\s*=)/;
  
  if (initOrExportRegex.test(tradingBotContent)) {
    console.log('Adding initialization code to load settings at startup...');
    // Add code to load settings when the service starts
    tradingBotContent = tradingBotContent.replace(
      initOrExportRegex,
      `// Initialize with settings from config
loadSettingsFromConfig()
  .then(loaded => {
    if (loaded) {
      console.log('Successfully loaded settings from configuration');
    }
  })
  .catch(err => {
    console.error('Failed to load settings from configuration:', err);
  });

$1`
    );
  }

  // Add a save method if there's a function that updates settings
  const updateSettingsRegex = /function\s+(\w+Settings|updateSettings|setSettings|saveBotSettings)\s*\(/;
  
  if (updateSettingsRegex.test(tradingBotContent)) {
    console.log('Enhancing update settings method to save to config...');
    // Find the function
    const match = tradingBotContent.match(updateSettingsRegex);
    if (match) {
      const funcName = match[1];
      const funcRegex = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?}`, 'g');
      
      // Get the function body
      const funcMatch = tradingBotContent.match(funcRegex);
      if (funcMatch) {
        const funcBody = funcMatch[0];
        
        // Replace with enhanced version that saves to config
        const enhancedFunc = funcBody.replace(
          /}$/,
          `
  // Save settings to configuration service
  configService.saveSettings(botSettings, 'default')
    .then(() => {
      console.log('Bot settings saved to configuration service');
    })
    .catch(err => {
      console.error('Failed to save settings to configuration:', err);
    });
}`
        );
        
        tradingBotContent = tradingBotContent.replace(funcBody, enhancedFunc);
      }
    }
  }
}

// Write the updated content back to the file
console.log('Writing updated tradingBotService.js...');
fs.writeFileSync(tradingBotServicePath, tradingBotContent, 'utf8');

console.log('Fix completed. Restart your server for changes to take effect.');