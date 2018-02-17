let fetch = require('../scrapers/hots_log_scraper');
import {uploadtoS3, downloadFromS3} from '../services/s3_service';

const fs = require('fs');
let rotationData = JSON.stringify({});
let lastRead;

// fetch latest and then schedule getting latest
updateRotation();
var cron = require('node-cron');
cron.schedule(
  '*/15 * * * *',
  function () {
    updateRotation();
  },
  true
);

function updateRotation () {
  fetch()
    .then(() => readRotationData())
    .then(data => {
      lastRead = Date.now();
      rotationData = data;
      console.log(`Last read rotation from file ${lastRead}`);
    });
}

function readRotationData () {
  return new Promise(function (resolve, reject) {
    fs.readFile('rotation_data.json', 'utf8', function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

module.exports = () => rotationData;
