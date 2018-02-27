const Nightmare = require('nightmare');
const jquery = require('jquery');
const nightmare = new Nightmare({ show: false });
const chrono = require('chrono-node');
const titleCase = require('title-case');
const scrapeIt = require('scrape-it');
const { writeJSONFile } = require('../services/file_service');

function fetch() {
  const regex = /(\d{1,2}-[A-Za-z]{3,4}-\d{4}) [–,-] (\d{1,2}-[A-Za-z]{3,4}-\d{4})/;
  console.log('Fetching rotation data');
  // Nightmare example: https://github.com/nelsonkhan/nightmare-gigs/blob/master/gigs.js
  return nightmare
    .goto('http://eu.battle.net/heroes/en/heroes/')
    .wait('.hero-list:last-child')
    .evaluate(() => {
      let heroes = [];
      $('.hero-container:not(.placeholder)').each((i, el) => {
        el = $(el);
        item = {};
        var name = el.find('.hero-list__item__name')[0];
        if (name) {
          item.name = name.innerText;
        }

        var isFreeToPlay = $(el).find('.hero-list__item__free-flag');
        item.isFreeToPlay = isFreeToPlay.length > 0;

        heroes.push(item);
      });
      let durationNodes = $('.free-rotation__date');
      if (!durationNodes || durationNodes.length <= 0) {
        throw new Error('Things broke: Cant determine duration');
      }
      let duration = durationNodes[0].innerText;

      return { heroes: heroes, duration: duration };
    })
    .end()
    .catch(error => console.error(error))
    .then(data => {
      let duration = data['duration'];
      let matches = regex.exec(data['duration']);
      if (!matches || matches.length != 3) {
        throw new Error('Duration string matching failed');
      }
      let start = chrono.parseDate(matches[1]);
      let end = chrono.parseDate(matches[2]);
      end.setHours(03);
      if (end < new Date()) {
        console.log(`Fetching rotation from forum as previous ended at ${end.toISOString()} and the time is ${new Date().toISOString()}`)
        // Shit, the website isn't updated yet
        return fetchFromForum();
      } else {
        console.log(`Trusting the website's rotation data as previous ends at ${end.toISOString()} and the time is ${new Date().toISOString()}`)
        // We can trust the website's data
        data.time = new Date().toISOString();
        data.start = start;
        data.end = end;

        data.heroes = data.heroes.filter(h => h.isFreeToPlay);
        data.heroes.forEach(hero => {
          hero.name = titleCase(hero['name']);
        });
        return writeJSONFile('rotation_data.json', data, () =>
          console.log(`Rotation Data Saved ${new Date()}`)
        );
      }
    })
    .catch(error => console.error(error));
}

function addDays(date, days) {
  var dat = new Date(date.valueOf());
  dat.setDate(dat.getDate() + days);
  return dat;
}

function fetchFromForum() {
  const heroNameRegex = /(.*)( \(.*\))/;
  const startDayRegex = /.*: (.*)/;

  return scrapeIt(
    'https://eu.battle.net/forums/en/heroes/topic/13604571130#post-1',
    {
      heroes: {
        listItem: '.TopicPost:first-child .TopicPost-bodyContent > ul > li'
      },
      starting:
        '.TopicPost:first-child div.TopicPost-bodyContent > span > strong'
    }
  )
    .then(({ data, response }) => {
      let output = {};
      let heroes = [];
      data.heroes.forEach(h => {
        let matches = heroNameRegex.exec(h);
        if (!matches && h.includes('(')) {
          throw new Error('Heroes string matching failed');
        } else if (matches) {
          h = matches[1];
        }
        heroes.push({ name: h, isFreeToPlay: true });
      });
      output['heroes'] = heroes;
      let matches = startDayRegex.exec(data.starting);
      if (!matches || matches.length != 2) {
        throw new Error('Starting date string matching failed');
      }
      output['duration'] = matches[1];
      output['start'] = chrono.parseDate(output.duration);
      output.start.setHours(03);
      output['end'] = addDays(output.start, 8);
      output.end.setHours(02);
      output.end.setMinutes(59);
      output.end.setSeconds(59);
      output['time'] = new Date().toISOString();
      return writeJSONFile('rotation_data.json', output, () =>
        console.log(`Rotation Data Saved ${new Date()}`)
      );
    })
    .catch(error => console.error(error));
}

module.exports = fetch;
