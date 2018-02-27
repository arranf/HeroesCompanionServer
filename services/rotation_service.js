const { readFile, writeJSONFile } = require('../services/file_service');
const { uploadtoS3, downloadFromS3 } = require('../services/s3_service');

var fetchRotation = require('../scrapers/rotation_scraper');

let rotationData = JSON.stringify({});
let lastRead;

const rotationFileName = 'rotation_data.json';

// fetch from S3 and then schedule getting latest
getInitialRotation().then(() => updateRotation());
var cron = require('node-cron');
cron.schedule(
  '15 * * * *',
  function () {
    updateRotation();
  },
  true
);

function updateRotation () {
  fetchRotation()
    .then(() => readFile(rotationFileName))
    .then(data => {
      lastRead = Date.now();
      rotationData = JSON.parse(data);
      console.log(`Last read rotation from file ${lastRead}`);
      return uploadtoS3(rotationFileName);
    })
    .catch(error => console.error('Rotation Error: ' + error));
}

function getInitialRotation () {
  return downloadFromS3(rotationFileName)
    .then(data =>
      writeJSONFile(rotationFileName, data, () =>
        console.log('Got rotation data from S3')
      )
    )
    .then(data => {
      lastRead = Date.now();
      rotationData = data;
      console.log(`Last read rotation from file ${lastRead}`);
    })
    .catch(error => console.error('Rotation Error: ' + error));
}

module.exports = () => rotationData;
