const express = require('express');
const app = express();
let shrinkRay = require('shrink-ray');
const mongoose = require('mongoose');
let rotationData = require('./services/rotation_service');
let patchData = require('./services/patch_service');
let { updateData, updateId } = require('./services/update_service');
let tipData = require('./services/tips_service');
let {
  hotslogsWinRates,
  hotsLogBuilds
} = require('./services/hots_log_service');
const Build = require('./models/build');

let connection;
if (process.env.NODE_ENV === 'production') {
 connection = mongoose.connect(`mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ds241548-a0.mlab.com:41548,ds241548-a1.mlab.com:41548/heroescompanion?replicaSet=rs-ds241548`);
}  else {
  connection = mongoose.connect('mongodb://localhost:27017/heroescompanion');
}

app.use(shrinkRay());

// Serve data at root domain
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
  res.send(patchData());
});

app.get('/v1/tips', function (req, res) {
  res.send(tipData());
});

app.get('/v1/hotslogs/:hero', function (req, res) {
  const heroName = req.params['hero'];
  let data = hotsLogBuilds(heroName);
  if (data) {
    res.send(data);
  } else {
    res.status(404);
    res.send({ error: `No data found for ${heroName}` });
  }
});

app.get('/v1/hotslogs', function (req, res) {
  res.send(hotslogsWinRates());
});

app.get('/v1/builds/:hero', function (req, res) {
  Build.find({HeroName: req.params.hero}, function(err, builds) {
    if (err) {
      res.send(err);
    }
    res.json(builds);
  });
});

connection.then(
  () => {
    let port = process.env.PORT || 8080;
    app.listen(port, () => console.log(`Listening on port ${port}`));
  },
  err => {
    console.error('Error Connecting to database', err);
  }
);
