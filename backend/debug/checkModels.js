// checkModels.js - Verify that models are correctly defined
const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');

console.log('Checking database models...');

// Check Portfolio model
console.log('Portfolio model:', Portfolio);
console.log('Portfolio prototype methods:', 
  Object.getOwnPropertyNames(Portfolio.prototype || {}).filter(prop => typeof Portfolio.prototype[prop] === 'function')
);

// Check Transaction model
console.log('Transaction model:', Transaction);
console.log('Transaction prototype methods:', 
  Object.getOwnPropertyNames(Transaction.prototype || {}).filter(prop => typeof Transaction.prototype[prop] === 'function')
);

// Check if models have the required methods
console.log('Portfolio has find method:', typeof Portfolio.find === 'function');
console.log('Portfolio has findOne method:', typeof Portfolio.findOne === 'function');
console.log('Portfolio has save method:', 
  Portfolio.prototype && typeof Portfolio.prototype.save === 'function'
);

console.log('Transaction has find method:', typeof Transaction.find === 'function');
console.log('Transaction has findOne method:', typeof Transaction.findOne === 'function');
console.log('Transaction has save method:', 
  Transaction.prototype && typeof Transaction.prototype.save === 'function'
);
