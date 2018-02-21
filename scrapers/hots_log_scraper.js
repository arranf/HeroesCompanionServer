const puppeteer = require('puppeteer');
const scrapeIt = require('scrape-it');
const { writeJSONFile } = require('../services/file_service');
const {v2PatchData} = require('../services/patch_service');
let axios = require('axios');

async function fetchAllHeroWinRates (html) {
  return scrapeIt.scrapeHTML(html, {
    heroes: {
      listItem: '#DataTables_Table_0 > tbody > tr',
      data: {
        name: 'td:nth-child(2)',
        played: {
          selector: 'td:nth-child(3)',
          convert: x => x.replace(',', '')
        },
        popularity: {
          selector: 'td:nth-child(5)',
          convert: x => x.replace(' %', '')
        },
        winPercentage: {
          selector: 'td:nth-child(6)',
          convert: x => x.replace(' %', '')
        },
        link: {
          selector: 'a',
          attr: 'href'
        }
      }
    }
  });
}

async function scrapeHeroPage (html) {
  return scrapeIt.scrapeHTML(html, {
    builds: {
      listItem: "[id$='PopularTalentBuilds'] tbody > tr",
      data: {
        gamesPlayed: {
          selector: 'td:nth-child(1)',
          convert: x => x.replace(',', '')
        },
        winPercentage: {
          selector: 'td:nth-child(2)',
          convert: x => x.replace(' %', '')
        },
        talents: {
          listItem: 'img',
          data: {
            name: {
              attr: 'alt',
              convert: x => x.substr(0, x.indexOf(': '))
            },
            level: {
              attr: 'id',
              // 9 is the length of 'imgTalent'
              convert: x => parseInt(x.substr(x.indexOf('imgTalent')+9), 10)
            }
          }
        }
      }
    }
  });
}


/**
 * Scrape's the hero's hotslogs specific page and combines the data with the hero object and fills missing talents in builds with hots.dog data
 * 
 * @param {any} page A Puppeteer page
 * @param {any} hero The Hero containing the page to visit
 * @returns 
 */
async function getHeroSpecificData (page, hero) {
  const levelIndexMap = {1: 0, 4: 1, 7: 2, 10: 3, 13: 4, 16: 5, 20: 6};
  await page.goto('https://www.hotslogs.com/' + hero.link, { timeout: 0 });
  const html = await page.$eval('html', html => html.innerHTML);
  return scrapeHeroPage(html)
    .then(async data => {
      Object.assign(hero, data);
      await page.close();
      return hero;
    })
    .then(() => {
      // Get hots.dog builds and match any missing talents to existing builds.
      const currentPatch = v2PatchData().find(p => p.hotsDogId !== '');
      // TODO Retry if fail
      // TOODO Use a sensible patch, not the most recent
      return axios.get(`https://hots.dog/api/get-build-winrates?hero=${hero.name}&build=${currentPatch.hotsDogId}`);
      })
    .then((response) => {
      if (!response.data) {
        throw new Exception('Failure getting hots dog build');
      }

      let hotsDogBuilds = [];
      
      response.data.PopularBuilds.forEach(b => {
        hotsDogBuilds.push(b.Build.map(a => response.data.Talents[a].Name));
      });

      response.data.WinningBuilds.forEach(b => {
        hotsDogBuilds.push(b.Build.map(a => response.data.Talents[a].Name));
      });

      hero.builds.forEach(hotsLogBuild => {
        const haveTalentLevels = hotsLogBuild.talents.map(t => t.level);
        const missingTalents = Object.keys(levelIndexMap).filter(x => haveTalentLevels.indexOf(parseInt(x, 10)) < 0 ); 
        const talentNames = hotsLogBuild.talents.map(t => t.name);
        for (let i = 0; i < hotsDogBuilds.length; i++) {
          let hotsDogBuild = hotsDogBuilds[i];
          if (talentNames.every(name => hotsDogBuild.indexOf(name) >= 0)) {
            // We have a match!
            missingTalents.forEach(level => {
              const name = hotsDogBuild[levelIndexMap[level]];
              hotsLogBuild.talents.push(({'name': name, 'level': level}));
            });
            break;
          }
        }
      });
      return hero;
    })
    .catch(e => console.error(e));
}

async function fetch () {
  const isDebug = process.env.NODE_ENV !== 'production';
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.hotslogs.com/Default');
  const html = await page.$eval('html', html => html.innerHTML);
  const heroesData = await fetchAllHeroWinRates(html);
  const promises = [];
  for (let heroIndex = 0; heroIndex < heroesData.heroes.length;) {
    for (let i = 0; i < 10; i++) {
      let hero = heroesData.heroes[heroIndex];
      heroIndex++;
      if (!hero) {
        console.error('Skipping malformed hero?');
        continue;
      }
      if (isDebug) {
        console.log(`Visiting ${hero.name}`);
      }
      let page = await browser.newPage();
      promises.push(getHeroSpecificData(page, hero));
    }
    await Promise.all(promises).catch(e => console.error(e));
  }
  await browser.close();
  return writeJSONFile('hots_log.json', heroesData);
}

module.exports = fetch;
