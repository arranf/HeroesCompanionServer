const express = require('express')
const app = express()
const fs = require('fs')
var cron = require('node-cron');

var fetch = require('./fetch');
 
cron.schedule('15,45 * * * *', function(){
  console.log('Cron Running')
  fetch();
}, true);


function readData() {
  fs.readFile('./data.json', 'utf8', function (err,d) {
    if (err) {
      return console.log(err);
    }
    data = d
  });
}

let data = ''
readData()
let lastRead = Date.now()

app.get('/', function (req, res) {
  //60000
  if (Date.now()  > lastRead + (6 * 15)) {
    readData()
    lastRead =  Date.now()
  }
  res.send(data);
})


var port = process.env.PORT || 8080;

app.listen(port, () => console.log(`Example app listening on port ${port}`))