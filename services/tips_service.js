var fetchTips = require('../scrapers/icy_veins_scraper');

const fs = require('fs')
let tipData =  JSON.stringify({})
let lastRead

// fetch latest and then schedule getting latest
readTipData()
  .then(data => {
    lastRead = Date.now()
    tipData = data
    console.log(`Last read tips from file ${lastRead}`)
  });
updateTips();
var cron = require('node-cron');
cron.schedule('* * */12 * *', function() {
  updateTips()
}, true)

function updateTips() {
  fetchTips()
  .then(() => readTipData())
  .then(data => {
    lastRead = Date.now()
    tipData = data
    console.log(`Last read tips from file ${lastRead}`)
  })
}

function readTipData() {
  return new Promise(function (resolve, reject) {
    fs.readFile('./tips_data.json', 'utf8', function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data)
    });
  })
}

module.exports = () => tipData