// backend/models/Transaction.js
const db = require('../config/nedb');
const { promisify } = require('util');

// Convert NeDB callbacks to promises
const insert = promisify(db.transactions.insert.bind(db.transactions));
const find = promisify(db.transactions.find.bind(db.transactions));

class Transaction {
  constructor(data) {
    this.userId = data.userId;
    this.symbol = data.symbol;
    this.action = data.action;
    this.quantity = data.quantity;
    this.price = data.price;
    this.value = data.value;
    this.valueUSD = data.valueUSD;
    this.valueBTC = data.valueBTC;
    this.btcPrice = data.btcPrice;
    this.timestamp = data.timestamp || Date.now();
    this.signal = data.signal || 'MANUAL';
    this._id = data._id;
  }

  // Save the transaction
  async save() {
    const newTransaction = await insert(this);
    this._id = newTransaction._id;
    return this;
  }

  // Find transactions
  static async find(query) {
    const transactions = await find(query);
    return transactions.map(tx => new Transaction(tx));
  }
}

module.exports = Transaction;