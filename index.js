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
  console.log(JSON.stringify(data))
  if (!data) {
    res.status(500).send('Error');
  } else {
    res.send(data);
  }
});

app.get('/v1/builds/:hero', function (req, res) {
  Build.find({ HeroId: req.params.hero }, function (err, builds) {
    if (err) {
      res.send(err);
    }
    res.json(builds);
  });
});

app.post('/v1/builds', async function (req, res) {
  let newBuild = req.body;
  if (
    !((newBuild.HeroName || newBuild.HeroId) && newBuild.Talents.length === 7)
  ) {
    res.status(500).send('Requires: HeroName/HeroId and 7 Talents');
    return;
  }

  if (!(newBuild.Tagline || newBuild.Source)) {
    res.status(500).send('Requires: Tagline and Source');
    return;
  }

  let hero;
  if (newBuild.HeroName) {
    hero = await Hero.findOne({ Name: newBuild.HeroName }).exec();
  } else {
    hero = await Hero.findOne({ HeroId: newBuild.HeroId }).exec();
  }

  let talentQueries = [];
  newBuild.Talents.forEach(talent => {
    if (!(talent.Name || talent.TalentTreeId)) {
      res.status(500).send('Each talent must have a TalentTreeId or a Name');
      return;
    }
    if (talent.Name) {
      talentQueries.push(
        Talent.findOne({ Name: talent.Name, HeroId: hero.HeroId }).exec()
      );
    } else {
      talentQueries.push(
        Talent.findOne({
          TalentTreeId: talent.TalentTreeId,
          HeroId: hero.HeroId
        }).exec()
      );
    }
  });

  Promise.all(talentQueries)
    .then(results => {
      let feedback = [];
      for (let i = 0; i < results.length; i++) {
        if (!results[i]) {
          let sentItem = newBuild.Talents[i];
          if (sentItem.Name) {
            feedback.push(`${sentItem.Name} is not a valid talent name`);
          } else {
            feedback.push(
              `${sentItem.TalentTreeId} is not a valid talent TalentTreeId`
            );
          }
        }
      }
      if (feedback.length > 0) {
        res.status(500).send(feedback.join(','));
        return;
      }
      
      // TODO refactor below this to be not repeated here and grubby fetch
      let talents = results.map(r => ({
        Name: r.Name,
        TalentTreeId: r.TalentTreeId,
        Level: r.Level
      }));
      // To make hash deterministic
      talents.sort((a, b) => {
        if (a.Name < b.Name) return -1;
        if (a.Name > b.Name) return 1;
        return 0;
      });
      const md5 = crypto
        .createHash('md5')
        .update(`${hero.HeroId}${talents.map(t => t.Name).join('')}`)
        .digest('hex');
      let build = new Build({
        HeroId: hero.HeroId,
        Tagline: newBuild.Tagline,
        Description: newBuild.Description,
        Talents: talents,
        Url: newBuild.Url,
        Source: newBuild.Source,
        Md5: md5
      });
      return build.save();
    })
    .then(data => {
      res.status(200).send();
    })
    .catch(e => {
      console.error(e);
      if (e.message) {
        res.status(500).send(e.message);
      } else {
        res.status(500).send('Error saving build.');
      }
    });
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
