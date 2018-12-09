// Express
const express = require('express');
const app = express();
let shrinkRay = require('shrink-ray');

// Data
let rotationData = require('./services/rotation_service');
let { v1PatchData, v2PatchData } = require('./services/patch_service');
let { updateData, updateId } = require('./services/update_service');
let {
  hotsLogsWinRates,
  hotsLogBuilds
} = require('./services/hots_log_service');

// Endpoint specific logic
const buildsEndpoint = require('./endpoints/builds');
const heroEndpoint = require('./endpoints/heroes');

// DB
const mongoose = require('mongoose');

// Compression
app.use(shrinkRay());
// Body parsing
app.use(express.json());

// Cors
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  next();
});


// Routes
app.get('/', function (req, res) {
  res.send('Heroes Companion - A project of passion');
});

app.get('/v1/rotation', function (req, res) {
  res.send(rotationData());
});

app.get('/v1/update', function (req, res) {
  res.send(updateData());
});

app.get('/v1/update/id', function (req, res) {
  res.send({ id: updateId() });
});

app.get('/v1/patches', function (req, res) {
  res.send(v1PatchData());
});

app.get('/v2/patches', function (req, res) {
  res.send(v2PatchData());
});

app.get('/v1/heroes', function (req, res) {
  heroEndpoint.get(res, req);
});

app.get('/v1/hotslogs/:hero', function (req, res) {
  const heroName = req.params['hero'];
  const patchNumber = req.query['patch'];
  let data = hotsLogBuilds(heroName, patchNumber);
  if (data) {
    res.send(data);
  } else {
    res.status(404);
    res.send({ error: `No data found for ${heroName}` });
  }
});

app.get('/v1/hotslogs', function (req, res) {
  const patchNumber = req.query['patch'];
  let data = hotsLogsWinRates(patchNumber);
  if (!data) {
    res.status(500).send('Error');
  } else {
    res.send(data);
  }
});

app.get('/v1/builds/:hero', function (req, res) {
  buildsEndpoint.getHero(req, res);
});

app.post('/v1/builds', async function (req, res) {
  return await buildsEndpoint.post(req, res);
});

// Connect to DB
let connection;
if (process.env.NODE_ENV === 'production') {
  const connectionString = `mongodb://ds241548-a0.mlab.com:41548,ds241548-a1.mlab.com:41548/heroescompanion?replicaSet=rs-ds241548`;
  connection = mongoose.connect(connectionString, {
    user: process.env.DB_USER,
    pass: process.env.DB_PASSWORD
  });
} else {
  connection = mongoose.connect('mongodb://localhost:27017/heroescompanion');
}

// Start app after connection
connection.then(
  () => {
    let port = process.env.PORT || 8080;
    app.listen(port, () => console.log(`Listening on port ${port}`));
  },
  err => {
    console.error('Error Connecting to database', err);
  }
);
