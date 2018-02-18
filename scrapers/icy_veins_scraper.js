const Nightmare = require('nightmare');
const jquery = require('jquery');
const {writeJSONFile} = require('../services/file_service');
let nightmare = new Nightmare({
  show: false,
  waitTimeout: 5000,
  executionTimeout: 2000
});

async function getTips (url) {
  return nightmare
    .goto('https:' + url)
    .inject('js', 'node_modules/jquery/dist/jquery.js')
    .wait('.heroes_tldr li:last-child')
    .evaluate(() => {
      const tips = $('.heroes_tldr li')
        .map((i, el) => $(el)[0].innerText.trim())
        .toArray();
      const titleText = $('h1.header')[0].innerText;

      let heroNameRegex = /\b((?:\w|\ |\')+) Build Guide /g;
      let match = heroNameRegex.exec(titleText);
      let heroName = '';
      if (match != null && match[1] != null) {
        heroName = match[1].toLowerCase().replace(/\W+/g, '');
      }
      return { name: heroName, tips: tips };
    })
    .catch(e => console.error(e));
}

async function getHeroUrls () {
  return nightmare
    .goto('https://www.icy-veins.com/heroes/warrior-hero-guides')
    .inject('js', `node_modules/jquery/dist/jquery.js`)
    .wait(
      '.page_content > .nav_content_block > .nav_content_entries .nav_content_block_entry_heroes_hero:last-child'
    )
    .evaluate(() => {
      return $('.nav_content_block_entry_heroes_hero a')
        .map((i, el) => $(el).attr('href'))
        .toArray();
    })
    .catch(e => console.error(e))
    .then(data => {
      return (uniqueUrls = [...new Set(data)]);
    });
}

async function run () {
  console.log('Fetching tips');

  const hrefs = await getHeroUrls();
  // Iterate through
  const data = await hrefs.reduce(async (queue, url, index) => {
    const dataArray = await queue;
    dataArray.push(await getTips(url));
    return dataArray;
  }, Promise.resolve([]));

  return nightmare
    .end()
    .then(() => writeJSONFile('tips_data.json', data, () => console.log(`Tip Data Saved ${new Date()}`)))
    .catch(e => console.error(e));
}

module.exports = run;
