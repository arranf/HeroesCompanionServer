var fetchTips = require('../scrapers/icy_veins_scraper');
const { readFile, writeFile } = require('../services/file_service');
const { uploadtoS3, downloadFromS3 } = require('../services/s3_service');

let tipData = JSON.stringify({});
let lastRead;
const tipDataFileName = 'tips_data.json';

// fetch latest and then schedule getting latest
getInitialTipData();
var cron = require('node-cron');
cron.schedule(
  '* * */12 * *',
  function () {
    updateTips();
  },
  true
);

function updateTips () {
  fetchTips()
    .then(() => readFile(tipDataFileName))
    .then(data => {
      lastRead = Date.now();
      tipData = JSON.parse(data);
      console.log(`Last read tips from file ${lastRead}`);
      uploadtoS3(tipDataFileName);
    })
    .catch(error => console.error(error));
}

function getInitialTipData () {
  downloadFromS3(tipDataFileName)
    .then(data =>
      writeFile(tipDataFileName, data, () =>
        console.log('Got tip data from S3')
      )
    )
    .then(data => {
      lastRead = Date.now();
      tipData = data;
      console.log(`Last read tips from file ${lastRead}`);
    })
    .catch(error => console.error(error));
}

module.exports = () => tipData;
