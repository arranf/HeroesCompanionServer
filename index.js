const express = require('express');
const app = express();
let shrinkRay = require('shrink-ray')
let rotationData = require('./services/rotation_service');
let patchData = require('./services/patch_service');
let {updateData, updateId} = require('./services/update_service');
let tipData = require('./services/tips_service')

app.use(shrinkRay())

// Serve data at root domain
app.get('/', function (req, res) {
  res.send(['/v1/rotation', '/v1/update', '/v1/update/id', '/v1/patches', '/v1/tips']);
});

app.get('/v1/rotation', function (req, res) {
  res.send(rotationData());
});

app.get('/v1/update', function (req, res) {
  res.send(updateData());
});

app.get('/v1/update/id', function (req, res) {
  res.send({id: updateId()});
})

app.get('/v1/patches', function (req, res) {
  res.send(patchData());
})

app.get('/v1/tips', function (req, res) {
  res.send(tipData());
})

var port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}`))