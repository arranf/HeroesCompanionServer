const express = require('express')
const app = express()
let rotationData = require('./services/rotation_service')
var patchData = require('./services/patch_service');
let {updateData, updateId} = require('./services/update_service')
var enforce = require('express-sslify');

// app.use(enforce.HTTPS({ trustProtoHeader: true }))

// Serve data at root domain
app.get('/', function (req, res) {
  res.send(rotationData());
})

app.get('/v1/rotation', function (req, res) {
  res.send(rotationData());
})

app.get('/v1/update', function (req, res) {
  // console.log(updateData)
  res.send(updateData());
})

app.get('/v1/update/id', function (req, res) {
  res.send({id: updateId()});
})

app.get('/v1/patches', function (req, res) {
  res.send(patchData());
})

var port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Listening on port ${port}`))