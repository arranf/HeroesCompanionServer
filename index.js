const express = require('express')
const app = express()
const fs = require('fs')
var cron = require('node-cron');

var fetch = require('./fetch');

let data =  ''
let lastRead

function updateRotation() {
  fetch()
  .then(() => readData())
  .then(updatedData => {
    lastRead = Date.now()
    data = updatedData
    console.log(`Last read from file ${lastRead}`)
  })
}

function readData() {
  return new Promise(function (resolve, reject) {
    fs.readFile('./data.json', 'utf8', function (err, newData) {
      if (err) {
        reject(err);
      }
      resolve(newData)
    });
  })
}

// fetch latest and then schedule getting latest 
// TODO remove this, for testing only
// updateRotation()
cron.schedule('27,57 * * * *', function() {
  updateRotation()
}, true)

app.get('/', function (req, res) {
  res.send(data);
})

var port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}`))