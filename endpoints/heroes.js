function get(req, res) {
  let heroes;

  Hero.find().exec()
  .then(values => {
    heroes = values;
    const promises = [];
    heroes.forEach(h => promises.push(Talent.find({HeroId: h.HeroId}).exec()));
    return Promise.all(promises);
  })
  .then(values => {
    let combinedHeroTalents = [];
    for (let i = 0; i < heroes.length; i++) {
      let hero = heroes[i];
      let talents = values[i];
      combinedHeroTalents.push(({Name: hero.Name, HeroId: hero.HeroId, Talents: talents}));
    }
    res.json(combinedHeroTalents);
  })
  .catch(err => {res.status(404); res.send(err);});
}

module.exports = {get}