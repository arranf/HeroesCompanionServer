const Hero = require('../models/hero');
const Talent = require('../models/talent');

let updateData = JSON.stringify({});
let axios = require('axios');
let lastRead;
let updateId = '';

// fetch latest and then schedule getting latest
getUpdateData();
var cron = require('node-cron');
cron.schedule(
  '*/10 * * * *',
  function () {
    getUpdateData();
  }
);

function getUpdateData () {
  console.log('Fetching update data');
  axios
    .get(
      'https://s3-eu-west-1.amazonaws.com/data.heroescompanion.com/data.json'
    )
    .then(response => {
      console.log(`Update Id: ${response.data.id}`);
      lastRead = Date.now();
      updateData = response.data;
      updateId = updateData.id;
      console.log(`Last read update from file ${lastRead}`);
      doSelfUpdate();
    })
    .catch(e => console.error(e));
}

async function doSelfUpdate () {
  console.log('Starting DB Update');
  updateData.heroes.forEach(hero => {
    let query = { HeroId: hero.HeroId };
    Hero.findOneAndUpdate(query, hero, { upsert: true }, function (err, doc) {
      if (err) console.error(`Error updating hero - Name: ${hero.Name}`);
    });
  });

  // https://stackoverflow.com/questions/14446511/what-is-the-most-efficient-method-to-groupby-on-a-javascript-array-of-objects
  let groupBy = function(xs, key) {
    return xs.reduce(function(rv, x) {
      (rv[x[key]] = rv[x[key]] || []).push(x);
      return rv;
    }, {});
  };

  let talents = JSON.parse(JSON.stringify(updateData.talents));
  let talentsGroupedByHeroId = groupBy(talents, 'HeroId');
  const talentsToDelete = [];
  // Find the talents to delete - they are ones where the TalentTreeId does not exist in the new set of talents
  // Can't async foreach here so we create promises then wait for them
  const promises = await Object.keys(talentsGroupedByHeroId).map(async (heroId) => {
    const newTalents = talentsGroupedByHeroId[heroId];
    const existingTalents = await Talent.find({HeroId: heroId}).exec()
    existingTalents.forEach((t) => {
      // This should match the update procedure in the app
      if (!(newTalents.find(n => n.HeroId === t.HeroId && n.ToolTipId === t.ToolTipId))) {
        // Doesn't exist in new talents, delete it
        talentsToDelete.push(t);
      }
    });
  });
  await Promise.all(promises);
  // Remove the talents that need deleting
  await Promise.all(talentsToDelete.map(t => t.remove()));
  
  updateData.talents.forEach(talent => {
    let query = { HeroId: talent.HeroId, ToolTipId: talent.ToolTipId };
    Talent.findOneAndUpdate(query, talent, { upsert: true }, function (
      err,
      doc
    ) {
      if (err) {
        console.error(
          `Error updating talent - Hero Id: ${talent.HeroId} Talent: ${
            talent.Name
          }`
        );
      }
    });
  });
  console.log('Finished DB Update');
}

module.exports = { updateData: () => updateData, updateId: () => updateId };
