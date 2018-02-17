const fs = require('fs');

function readFile (fileName) {
  return new Promise(function (resolve, reject) {
    fs.readFile(fileName, 'utf8', function (err, data) {
      if (err) {
        reject(err);
      }
      resolve(data);
    });
  });
}

function writeJSONFile (fileName, data, successCallback) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(fileName, JSON.stringify(data), err => {
      // throws an error, caught outside
      if (err) {
        reject(err);
      }

      // success case, the file was saved
      if (successCallback) {
        successCallback();
      }
      resolve(data);
    });
  });
}

function writeFile (fileName, data, successCallback) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(fileName, data, err => {
      // throws an error, caught outside
      if (err) {
        reject(err);
      }

      // success case, the file was saved
      if (successCallback) {
        successCallback();
      }
      resolve(data);
    });
  });
}


module.exports = {writeJSONFile, readFile, writeFile};