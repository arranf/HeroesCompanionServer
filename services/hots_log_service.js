let fetchHotsLogsData = require('../scrapers/hots_log_scraper');
const { readFile, writeJSONFile } = require('../services/file_service');
const { uploadtoS3, downloadFromS3 } = require('../services/s3_service');

let hotsLogData = JSON.stringify({});
let hotsLogWinrates = JSON.stringify({});
let lastRead;

const hotsLogFileName = 'hots_log.json';

// fetch latest and then schedule getting latest
// updateHotslogData();
getInitialData();
let cron = require('node-cron');
cron.schedule(
  '13 */1 * * *',
  function () {
    updateHotslogData();
  },
  true
);

function generateData (data) {
  lastRead = Date.now();
  hotsLogData = data.heroes;
  let wr = JSON.parse(JSON.stringify(data.heroes));
  wr.forEach(hero => {
    delete hero.builds;
  });
  hotsLogWinrates = wr;
  console.log(`Last read hots_log from file ${lastRead}`);
}

function updateHotslogData () {
  fetchHotsLogsData()
    .then(() => readFile(hotsLogFileName))
    .then(data => {
      generateData(JSON.parse(data));
      return uploadtoS3(hotsLogFileName);
    });
}

function getInitialData () {
  downloadFromS3(hotsLogFileName)
    .then(data =>
      writeJSONFile(hotsLogFileName, data, () =>
        console.log('Got hots log data from S3')
      )
    )
    .then(data => {
      generateData(data);
    })
    .catch(error => console.error(error));
}

function hotsLogBuilds (heroName) {
  if (Array.isArray(hotsLogData)) {
    let hero = hotsLogData.find(h => h.name === heroName);
    if (hero) {
      return hero.builds;
    }
  }
  return null;
}

module.exports = { hotslogsWinRates: () => hotsLogWinrates, hotsLogBuilds };
