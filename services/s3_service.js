const { readFile } = require('./file_service');
let axios = require('axios');

let AWS = require('aws-sdk');
AWS.config.loadFromPath('./config.json');
AWS.config.update({ region: 'eu-west-1' });
s3 = new AWS.S3({ apiVersion: '2006-03-01' });

function uploadtoS3 (fileName) {
  return new Promise(async function (resolve, reject) {
    let body;
    try {
      body = await readFile(fileName);
    } catch (e) {
      console.error('Error fetching file to UL to S3: ' + fileName);
      reject(e);
    }

    let uploadParams = {
      Bucket: 'data.heroescompanion.com',
      Key: '',
      Body: body
    };
    uploadParams.Key = fileName;
    // call S3 to retrieve upload file to specified bucket
    s3.upload(uploadParams, function (err, data) {
      if (err) {
        reject(err);
      }
      if (data) {
        resolve(data.Location);
      }
    });
  });
}

function downloadFromS3 (filePath) {
  return axios
    .get(
      'https://s3.eu-west-1.amazonaws.com/data.heroescompanion.com/' + filePath
    )
    .then(response => {
      if (!response.data) {
        throw new Error('Unable to get ' + filePath);
      }
      return response.data;
    })
    .catch(e => console.error(e));
}

module.exports = { downloadFromS3, uploadtoS3 };
