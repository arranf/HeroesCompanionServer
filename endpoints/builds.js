const Build = require('../models/build');
const Hero = require('../models/hero');
const Talent = require('../models/talent');


// Md5 hashing builds
const crypto = require('crypto');

async function post(req, res) {
    if (req.get('Authorization')!== process.env.API_SECRET) {
        res.status(500).send('Secret Does Not Match');
        return;
      }
    
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
}

async function getHero(req, res) {
    Build.find({ HeroId: req.params.hero }, function (err, builds) {
        if (err) {
            res.send(err);
        }
        res.json(builds);
        });
}

module.exports = {post, getHero}