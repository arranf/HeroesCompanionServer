const Hero = require('../models/hero')
const Talent = require('../models/talent')

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
  },
  true
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

function doSelfUpdate () {
  console.log('Starting DB Update');
  updateData.heroes.forEach(hero => {
    let query = {HeroId: hero.HeroId};
    Hero.findOneAndUpdate(query, hero, {upsert:true}, function(err, doc){
        if (err) console.error(`Error updating hero - Name: ${hero.Name}`);
    });
  });

  updateData.talents.forEach(talent => {
    let query = {HeroId: talent.HeroId, ToolTipId: talent.ToolTipId};
    Talent.findOneAndUpdate(query, talent, {upsert:true}, function(err, doc){
        if (err) console.error(`Error updating talent - Hero Id: ${talent.HeroId} Talent: ${talent.Name}`);
    });
  });
  console.log('Finished DB Update');
}

module.exports = { updateData: () => updateData, updateId: () => updateId };
