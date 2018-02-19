// Express
const express = require('express');
const app = express();
let shrinkRay = require('shrink-ray');

// Data
let rotationData = require('./services/rotation_service');
let {v1PatchData, v2PatchData} = require('./services/patch_service');
let { updateData, updateId } = require('./services/update_service');
let {
  hotslogsWinRates,
  hotsLogBuilds
} = require('./services/hots_log_service');

// DB
const mongoose = require('mongoose');
const Build = require('./models/build');
const Hero = require('./models/hero');
const Talent = require('./models/talent');

// Md5 hashing builds
const crypto = require('crypto');

// Compression
app.use(shrinkRay());
// Body parsing
app.use(express.json());

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
  Build.find({HeroId: req.params.hero}, function(err, builds) {
    if (err) {
      res.send(err);
    }
    res.json(builds);
  });
});

app.post('/v1/builds', async function (req, res) {
  let newBuild = req.body;
  if (!((newBuild.HeroName || newBuild.HeroId) && newBuild.Talents.length === 7)) {  
    res.status(500).send('Requires: HeroName/HeroId and 7 Talents');
    return;
  }

  let hero;
  if (newBuild.HeroName) {
    hero = await Hero.findOne({ 'Name': newBuild.HeroName }).exec(); 
  } else {
    hero = await Hero.findOne({'HeroId': newBuild.HeroId}).exec();
  }

  let talentQueries = [];
  newBuild.Talents.forEach(talent => {
    if (!(talent.Name || talent.TalentTreeId)) {
      res.status(500).send('Invalid talent');
      return;
    }
    if (talent.Name) {
      talentQueries.push(Talent.findOne({'Name': talent.Name, 'HeroId': hero.HeroId}).exec());
    } else {
      talentQueries.push(Talent.findOne({'TalentTreeId': talent.TalentTreeId, 'HeroId': hero.HeroId}).exec());
    }
  });

  Promise.all(talentQueries)
    .then(results => {
      if (results.includes(null)) {
        res.status(500).send('Invalid talent');
        return;
      }

      let talents = results.map(r => ({Name: r.Name, TalentTreeId: r.TalentTreeId}));
      // To make hash deterministic
      talents.sort((a, b) => {
        if (a.Name < b.Name) return -1;
        if (a.Name > b.Name) return 1;
        return 0;
      });
      const md5 = crypto.createHash('md5').update(`${hero.HeroId}${talents.map(t => t.Name).join('')}`).digest('hex');
      let build = new Build({ HeroId: hero.HeroId, Description: newBuild.Description, Talents: talents, Url: newBuild.Url, Md5: md5 });
      return build.save();
  })
  .then(data => {
    res.status(200).send();
  })
  .catch((e) => {console.error(e); res.status(500).send('Error saving build. Likely duplicate.');});
});

// Connect to DB
let connection;
if (process.env.NODE_ENV === 'production') {
  const connectionString = `mongodb://ds241548-a0.mlab.com:41548,ds241548-a1.mlab.com:41548/heroescompanion?replicaSet=rs-ds241548`;
  connection = mongoose.connect(connectionString, {user: process.env.DB_USER, pass: process.env.DB_PASSWORD});
}  else {
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
