// config/mongodb.js
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Create data directory for backup files if migration needed
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// MongoDB connection function
const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variables with fallback
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradingbot';
    
    // Set up connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    };
    
    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI, options);
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
