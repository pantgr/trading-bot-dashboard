// fix_bot_settings.js
const fs = require('fs');
const path = require('path');

// Function to update the tradingBotService.js file
function updateTradingBotService() {
  const tradingBotServicePath = path.join(__dirname, 'services', 'tradingBotService.js');
  console.log(`Reading file: ${tradingBotServicePath}`);

  // Check if file exists
  if (!fs.existsSync(tradingBotServicePath)) {
    console.error(`File not found: ${tradingBotServicePath}`);
    return false;
  }

  // Read the tradingBotService file
  let tradingBotContent = fs.readFileSync(tradingBotServicePath, 'utf8');

  // Make a backup before making changes
  const backupPath = `${tradingBotServicePath}.backup`;
  fs.writeFileSync(backupPath, tradingBotContent, 'utf8');
  console.log(`Created backup at: ${backupPath}`);

  // Check if the file already imports configService
  if (!tradingBotContent.includes('configService')) {
    console.log('Adding configService import...');
    // Find a good place to add the import
    const importLine = "const configService = require('./configService');\n";
    
    if (tradingBotContent.includes("require('./")) {
      // Add after the last require statement
      const requireMatch = tradingBotContent.match(/const\s+\w+\s*=\s*require\(['"]\.\/[^'"]+['"]\);/g);
      if (requireMatch && requireMatch.length > 0) {
        const lastRequire = requireMatch[requireMatch.length - 1];
        tradingBotContent = tradingBotContent.replace(lastRequire, `${lastRequire}\n${importLine}`);
      } else {
        // Add at the beginning of the file
        tradingBotContent = importLine + tradingBotContent;
      }
    } else {
      // Add at the beginning of the file
      tradingBotContent = importLine + tradingBotContent;
    }
  }

  // Look for updateSettings or saveBotSettings function
  const updateFunctionMatch = tradingBotContent.match(/function\s+(updateSettings|saveBotSettings|setBotSettings)\s*\([^)]*\)\s*{/);
  
  if (updateFunctionMatch) {
    const functionName = updateFunctionMatch[1];
    console.log(`Found update function: ${functionName}`);
    
    // Find the function body
    const functionRegex = new RegExp(`function\\s+${functionName}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?}`);
    const functionBody = tradingBotContent.match(functionRegex);
    
    if (functionBody) {
      // Check if the function already saves to config
      if (!functionBody[0].includes('configService.saveSettings')) {
        console.log('Adding code to save settings to database in the update function...');
        
        // Find the end of the function
        const updatedFunction = functionBody[0].replace(
          /}$/,
          '\n  // Save settings to configuration database\n' +
          '  configService.saveSettings(botSettings, "default")\n' +
          '    .then(() => console.log("Bot settings saved to configuration database"))\n' +
          '    .catch(err => console.error("Failed to save bot settings to database:", err));\n' +
          '}'
        );
        
        tradingBotContent = tradingBotContent.replace(functionBody[0], updatedFunction);
      } else {
        console.log('Update function already saves to database.');
      }
    }
  } else {
    console.log('No update settings function found. Adding a new one...');
    
    // Find the end of the file or before module.exports
    const exportMatch = tradingBotContent.match(/module\.exports\s*=/);
    if (exportMatch) {
      const index = tradingBotContent.lastIndexOf(exportMatch[0]);
      
      // Add save function before exports
      const saveFunction = `
// Save bot settings to configuration database
function saveBotSettings() {
  configService.saveSettings(botSettings, "default")
    .then(() => console.log("Bot settings saved to configuration database"))
    .catch(err => console.error("Failed to save bot settings to database:", err));
}

`;
      tradingBotContent = tradingBotContent.slice(0, index) + saveFunction + tradingBotContent.slice(index);
    }
  }

  // Add initialization code to load settings at startup
  if (!tradingBotContent.includes('loadSettingsFromConfig')) {
    console.log('Adding code to load settings from database at startup...');
    
    const loadFunction = `
// Load settings from configuration database
async function loadSettingsFromConfig() {
  try {
    const configSettings = await configService.getSettings("default");
    
    if (configSettings && Object.keys(configSettings).length > 0) {
      // We have settings stored in the database
      console.log("Loading bot settings from configuration database");
      
      // Only use stored settings if they have the required fields
      if (configSettings.signalScores && configSettings.thresholds && 
          configSettings.indicators && configSettings.moneyManagement) {
        
        // Make a backup of current settings
        const originalSettings = { ...botSettings };
        
        // Update bot settings with stored values
        botSettings = configSettings;
        
        console.log("Successfully loaded settings from database");
        return true;
      }
    }
    
    // If we reach here, either no settings in DB or they're incomplete
    // Save the current settings to the database
    console.log("Saving default bot settings to configuration database");
    await configService.saveSettings(botSettings, "default");
    return false;
  } catch (error) {
    console.error("Error loading settings from config:", error);
    return false;
  }
}

// Initialize settings from database
loadSettingsFromConfig()
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
`;

    // Find a good place to add the initialization code
    const classMatch = tradingBotContent.match(/class\s+\w+\s*{/);
    const eventMatch = tradingBotContent.match(/EventEmitter\.call\(this\)/);
    
    if (classMatch) {
      // Add before class definition
      const index = tradingBotContent.lastIndexOf(classMatch[0]);
      tradingBotContent = tradingBotContent.slice(0, index) + loadFunction + "\n" + tradingBotContent.slice(index);
    } else if (eventMatch) {
      // Add before EventEmitter initialization
      const index = tradingBotContent.lastIndexOf(eventMatch[0]);
      tradingBotContent = tradingBotContent.slice(0, index) + loadFunction + "\n" + tradingBotContent.slice(index);
    } else {
      // Add near the top, after imports
      const importMatch = tradingBotContent.match(/const\s+\w+\s*=\s*require\([^)]+\);/g);
      if (importMatch && importMatch.length > 0) {
        const lastImport = importMatch[importMatch.length - 1];
        const index = tradingBotContent.lastIndexOf(lastImport) + lastImport.length;
        tradingBotContent = tradingBotContent.slice(0, index) + "\n\n" + loadFunction + tradingBotContent.slice(index);
      } else {
        // Just add near the top
        tradingBotContent = tradingBotContent.slice(0, 100) + "\n\n" + loadFunction + tradingBotContent.slice(100);
      }
    }
  }

  // Write the updated content back to the file
  console.log('Writing updated content to tradingBotService.js...');
  fs.writeFileSync(tradingBotServicePath, tradingBotContent, 'utf8');
  
  return true;
}

// Execute the update
const result = updateTradingBotService();
if (result) {
  console.log('\nTradingBotService.js has been updated to save and load settings from the database.');
  console.log('Please restart your server for changes to take effect.');
} else {
  console.log('\nFailed to update TradingBotService.js.');
}
