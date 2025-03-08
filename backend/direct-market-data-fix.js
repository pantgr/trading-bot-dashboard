#!/usr/bin/env node
// direct-market-data-fix.js - Run with: node direct-market-data-fix.js

const fs = require('fs');
const path = require('path');

const filePath = '/root/trading-bot-dashboard/backend/models/MarketData.js';

console.log(`Fixing MarketData.js at ${filePath}`);

// First, check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

// Read file content
let content = fs.readFileSync(filePath, 'utf8');
console.log(`File read, length: ${content.length} characters`);

// Create backup
const backupPath = `${filePath}.backup-${Date.now()}`;
fs.writeFileSync(backupPath, content, 'utf8');
console.log(`Backup created at: ${backupPath}`);

// Search for the problematic find method - be very specific to target the exact issue
let methodRegex = /static\s+async\s+find\s*\(\s*query\s*=\s*\{\}\s*,\s*sort\s*=\s*\{\s*time\s*:\s*-1\s*\}\s*,\s*limit\s*=\s*100\s*\)\s*\{\s*try\s*\{\s*[\s\S]*?db\.findAsync\s*\(\s*query\s*\)[\s\S]*?\.sort\s*\(\s*sort\s*\)[\s\S]*?\.limit\s*\(\s*limit\s*\)[\s\S]*?\}\s*catch/;

// If we can't find the specific pattern, try a more general one
if (!methodRegex.test(content)) {
  console.log("Exact pattern not found, trying a more general pattern...");
  methodRegex = /static\s+async\s+find[\s\S]*?db\.findAsync[\s\S]*?\.sort[\s\S]*?limit[\s\S]*?catch/;
  
  if (!methodRegex.test(content)) {
    console.error("Could not find the pattern to replace. Manual intervention required.");
    console.log("Look for the 'find' method in MarketData.js that uses db.findAsync().sort().limit()");
    process.exit(1);
  }
}

// Extract the entire method - this gives us better context to work with
const match = content.match(methodRegex);
if (!match) {
  console.error("Method matching failed unexpectedly.");
  process.exit(1);
}

console.log("Found problematic method:");
console.log(match[0].substring(0, 100) + "..."); // Print first 100 chars

// Replacement method using direct approach with callbacks
const fixedMethod = `static async find(query = {}, sort = { time: -1 }, limit = 100) {
  try {
    // Use a promise with the original cursor API
    return new Promise((resolve, reject) => {
      db.find(query)
        .sort(sort)
        .limit(limit)
        .exec((err, results) => {
          if (err) return reject(err);
          resolve(results.map(result => new MarketData(result)));
        });
    });
  } catch (error) {
    console.error('Error finding market data:', error);
    throw error;
  }
}`;

// Replace the method
const updatedContent = content.replace(methodRegex, fixedMethod);

// Verify the replacement happened
if (content === updatedContent) {
  console.error("Failed to replace the method. No changes were made.");
  process.exit(1);
}

// Save the changes
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log("Successfully updated MarketData.js");
console.log("Please restart your server for the changes to take effect.");
