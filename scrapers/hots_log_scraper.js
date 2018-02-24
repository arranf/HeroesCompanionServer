const puppeteer = require('puppeteer');
const scrapeIt = require('scrape-it');
const { writeJSONFile } = require('../services/file_service');
const { v2PatchData } = require('../services/patch_service');
let axios = require('axios');

function getDate2DaysAgo () {
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  return twoDaysAgo;
}

/**
 * Scrapes the name, number of games played, popularity, win percentage, and a link to the hero's detail page from the hotslogs.com homepage
 *
 * @param {String} html The HTML for the hotslog.com homepage
 * @returns {Promise} An array containing an array of hero objects {name, played, popularity, winPercentage, link}
 */
async function fetchAllHeroWinRates (html) {
  return scrapeIt.scrapeHTML(html, {
    heroes: {
      listItem: '.rgMasterTable > tbody > tr',
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

/**
 * Scrapes the hero page
 *
 * @param {String} html The hero page's html
 * @returns {Promise} which resolves to an object with a build array, each of which contains an object {gamesPlayed, winPercentage, talents {name, level}}
 */
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
              convert: x => parseInt(x.substr(x.indexOf('imgTalent') + 9), 10)
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
  const levelIndexMap = { 1: 0, 4: 1, 7: 2, 10: 3, 13: 4, 16: 5, 20: 6 };
  await page.goto('https://www.hotslogs.com/' + hero.link, { timeout: 0 });
  const html = await page.$eval('html', html => html.innerHTML);
  return scrapeHeroPage(html)
    .then(async data => {
      Object.assign(hero, data);
      await page.close();
      return hero;
    })
    .then(() => {
      // Goal: Get hots.dog builds

      // A patch that's at least 5 days old
      const aWeekAgo = new Date();
      aWeekAgo.setDate(aWeekAgo.getDate() - 5);
      const currentPatch = v2PatchData().find(
        p => p.hotsDogId !== '' && new Date(p.liveDate) <= aWeekAgo
      );

      // TODO Retry if fail
      return axios.get('https://hots.dog/api/get-build-winrates', {
        params: {
          build: currentPatch.hotsDogId,
          hero: hero.name
        }
      });
    })
    .then(response => {
      // Goal fill in any missing hotslogs talents by using hotsdog builds.
      if (!response.data) {
        throw new Exception('Failure getting hots dog build');
      }

      let hotsDogBuilds = [];

      if (response.data.PopularBuilds) {
        response.data.PopularBuilds.forEach(b => {
          if (b.Build.length === 7) {
            hotsDogBuilds.push(b.Build.map(a => response.data.Talents[a].Name));
          }
        });
      }

      if (response.data.WinningBuilds) {
        response.data.WinningBuilds.forEach(b => {
          if (b.Build.length === 7) {
            hotsDogBuilds.push(b.Build.map(a => response.data.Talents[a].Name));
          }
        });
      }

      hero.builds.forEach(hotsLogBuild => {
        const haveTalentLevels = hotsLogBuild.talents.map(t => t.level);
        const missingTalents = Object.keys(levelIndexMap)
          .filter(x => haveTalentLevels.indexOf(parseInt(x, 10)) < 0)
          .map(x => parseInt(x, 10));
        const talentNames = hotsLogBuild.talents.map(t => t.name);
        for (let i = 0; i < hotsDogBuilds.length; i++) {
          let hotsDogBuild = hotsDogBuilds[i];
          if (talentNames.every(name => hotsDogBuild.indexOf(name) >= 0)) {
            // We have a match!
            missingTalents.forEach(level => {
              const name = hotsDogBuild[levelIndexMap[level]];
              // parseInt to produce a number not a string
              hotsLogBuild.talents.push({ name: name, level: level });
            });
            break;
          } else if (
            missingTalents.length === 1 &&
            missingTalents[0] === 20 &&
            i === hotsDogBuild.length - 1
          ) {
            // We weren't going to match this but we can guess a level 20 talent here
            let level10 = hotsLogBuild.talents.find(a => a.level === 10);
            let matchingLevel10Build = hotsDogBuilds.find(a =>
              a.find(b => b.indexOf(level10.name) >= 0)
            );
            if (matchingLevel10Build) {
              let level20TalentName = matchingLevel10Build[levelIndexMap[20]];
              hotsLogBuild.talents.push({ name: level20TalentName, level: 20 });
            }
          }
        }
      });
      hero.builds = hero.builds.filter(b => b.talents.length === 7);
      return hero;
    })
    .catch(e => console.error(e));
}

async function fetch (previousData) {
  const isDebug = process.env.NODE_ENV !== 'production';
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.hotslogs.com/Sitewide/HeroAndMapStatistics');
  await page.click('#ctl00_MainContent_ComboBoxReplayDateTime_Input');
  await page.waitFor(500);
  await page.click(
    '#ctl00_MainContent_ComboBoxReplayDateTime_DropDown > div > ul > li:nth-child(1) > label'
  );
  await page.waitFor(500);
  await page.click('footer');
  await page.waitFor(3000);
  const isFilteredCorrect = await page.$eval(
    '#ctl00_MainContent_ComboBoxReplayDateTime_Input',
    input => input.getAttribute('value').includes('Current')
  );
  if (!isFilteredCorrect) {
    throw new Exception(
      'Failed to set hotlsogs filters correctly in puppeteer'
    );
  }

  const html = await page.$eval('html', html => html.innerHTML);
  const heroesData = await fetchAllHeroWinRates(html);
  await page.close();

  // Identify patch
  heroesData.heroes[0];

  //
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

  // Find out if a significant number of heroes have less builds - a new patch indicator
  let numberOfHeroesWithLessBuilds = 0;
  let newPatch = false;
  for (let i = 0; i < heroesData.heroes.length; i++) {
    let hero = heroesData.heroes[i];
    let previousDataHero = previousData.find(h => h.name === hero.name);
    if (hero.builds.length < previousDataHero.builds) {
      numberOfHeroesWithLessBuilds++;
    }

    if (numberOfHeroesWithLessBuilds >= previousDataHero.length * 0.2) {
      newPatch = true;
      break;
    }
  }

  let patch = null;
  const twoDaysAgo = getDate2DaysAgo();
  let patches = v2PatchData();
  if (newPatch) {
    patch = patches.find(p => new Date(p.liveDate) > twoDaysAgo);
  } else {
    patch = patches.find(p => new Date(p.liveDate) <= twoDaysAgo);
  }

  if (patch == null) {
    return;
  }

  const fileName = `hots_log_${patch.fullVersion}.json`;
  return writeJSONFile(fileName, heroesData, () =>
    console.log(
      `${newPatch ? 'New Patch!' : ''} Written hotslogs.com data to ${fileName}`
    )
  )
    .then(() => patch.fullVersion)
    .catch(e => console.error(e));
}

module.exports = fetch;
