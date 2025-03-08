// config/nedb.js - Improved NeDB configuration
const path = require('path');
const fs = require('fs');

// Define the data directory path
const dataDir = path.join(__dirname, '../data');
console.log('NeDB databases initialized in:', dataDir);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory:', dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
}

// Check for write permissions
try {
  fs.accessSync(dataDir, fs.constants.W_OK);
} catch (error) {
  console.error('Data directory is not writable:', error.message);
  console.log('Changing permissions on data directory');
  try {
    fs.chmodSync(dataDir, 0o755); // Change permissions to rwxr-xr-x
  } catch (chmodError) {
    console.error('Failed to change directory permissions:', chmodError.message);
  }
}

// Export the database configuration
module.exports = {
  dataDir,
  options: {
    // NeDB options
    autoload: true,
    timestampData: true,
    // Safer persistence options
    corruptAlertThreshold: 0.9, // Alert if more than 90% of data seems corrupt
    compareStrings: true, // Use string comparison to detect corrupted strings in database
  }
};
