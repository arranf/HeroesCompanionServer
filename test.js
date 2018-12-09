var fetch = require('./scrapers/hots_log_scraper');

const mongoose = require('mongoose');

let connection;
if (process.env.NODE_ENV === 'production') {
  const connectionString = `mongodb://ds241548-a0.mlab.com:41548,ds241548-a1.mlab.com:41548/heroescompanion?replicaSet=rs-ds241548`;
  connection = mongoose.connect(connectionString, {
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD
  });
} else {
  connection = mongoose.connect('mongodb://localhost:27017/heroescompanion');
}

// Start app after connection
connection.then(() => fetch().then(d => console.log('Done')));
