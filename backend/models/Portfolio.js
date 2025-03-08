// backend/models/Portfolio.js
const db = require('../config/nedb');
const { promisify } = require('util');

// Convert NeDB callbacks to promises
const findOne = promisify(db.portfolios.findOne.bind(db.portfolios));
const insert = promisify(db.portfolios.insert.bind(db.portfolios));
const update = promisify(db.portfolios.update.bind(db.portfolios));

class Portfolio {
  constructor(data) {
    this.userId = data.userId;
    this.balance = data.balance || 10000;
    this.btcBalance = data.btcBalance;
    this.assets = data.assets || [];
    this.equity = data.equity || 10000;
    this.btcEquity = data.btcEquity;
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = data.updatedAt || Date.now();
    this._id = data._id;
  }

  // Find a portfolio by userId
  static async findOne(query) {
    const portfolio = await findOne(query);
    return portfolio ? new Portfolio(portfolio) : null;
  }

  // Save the portfolio
  async save() {
    this.updatedAt = Date.now();
    
    if (this._id) {
      // Update existing portfolio
      await update({ _id: this._id }, this, {});
    } else {
      // Insert new portfolio
      const newPortfolio = await insert(this);
      this._id = newPortfolio._id;
    }
    
    return this;
  }
}

module.exports = Portfolio;