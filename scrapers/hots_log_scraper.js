const Nightmare = require('nightmare');
const scrapeIt = require('scrape-it');
const { writeJSONFile } = require('../services/file_service');
const { v2PatchData } = require('../services/patch_service');
const axiosRetry = require('axios-retry');

let axios = require('axios');
axiosRetry(axios, { retries: 3 });

const isDebug = process.env.NODE_ENV !== 'production';
let nightmare = new Nightmare({ show: isDebug,  gotoTimeout: 90000 });

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
async function _fetchAllHeroWinRates (html) {
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
async function _scrapeHeroPage (html) {
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
 * @param {any} hero The Hero containing the page to visit
 * @returns
 */
async function _getHeroSpecificData (hero) {
  const levelIndexMap = { 1: 0, 4: 1, 7: 2, 10: 3, 13: 4, 16: 5, 20: 6 };

  if (isDebug) {
    console.log(`Visiting ${hero.name}`);
  }
  await nightmare.goto('https://www.hotslogs.com/' + hero.link);
  const html = await nightmare.evaluate(() => document.querySelector('html').innerHTML);
  return _scrapeHeroPage(html)
    .then(async data => {
      Object.assign(hero, data);
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
          } else if (missingTalents.length === 1 && missingTalents[0] === 20 && i === hotsDogBuild.length - 1) {
            // In this case we weren't going to match but we can guess a level 20 talent here
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

function _selectCorrectPatch(currentData, previousData) {
  let newPatch = false;
  
  // Find out if a significant number of heroes have less builds - a new patch indicator
  if (previousData) {
    let numberOfHeroesWithLessBuilds = 0;
    for (let i = 0; i < currentData.heroes.length; i++) {
      let hero = currentData.heroes[i];
      let previousDataHero = previousData.find(h => h.name === hero.name);
      if (hero.builds.length < previousDataHero.builds) {
        numberOfHeroesWithLessBuilds++;
      }
  
      if (numberOfHeroesWithLessBuilds >= previousDataHero.length * 0.2 && previousData.scrapedDate && new Date(previousData.scrapedDate) > twoDaysAgo) {
        newPatch = true;
        break;
      }
    }
  }

  let patch = null;
  const twoDaysAgo = getDate2DaysAgo();
  let patches = v2PatchData();
  if (newPatch) {
    // tomorrow > today
    patch = patches.find(p => new Date(p.liveDate) > twoDaysAgo);
  } else {
    // yesterday < today
    patch = patches.find(p => new Date(p.liveDate) <= twoDaysAgo);
  }

  return patch;
}

async function fetch (previousData) {
  nightmare = new Nightmare({ show: isDebug,  gotoTimeout: 90000 });
  await nightmare.goto('https://www.hotslogs.com/Sitewide/HeroAndMapStatistics');
  await nightmare.click('#ctl00_MainContent_ComboBoxReplayDateTime_Input');
  await nightmare.wait(500);
  await nightmare.click(
    '#ctl00_MainContent_ComboBoxReplayDateTime_DropDown > div > ul > li:nth-child(1) > label'
  );
  await nightmare.wait(1000);
  // await nightmare.mouseover('#h1Title > h1');
  await nightmare.click('#ctl00_MainContent_ComboBoxReplayDateTime_Arrow');
  await nightmare.wait(3000);
  const selector =  '#ctl00_MainContent_ComboBoxReplayDateTime_Input';
  const isFilteredCorrect = await nightmare.evaluate( selector => {
      return document.querySelector(selector).getAttribute('value').includes('Current');
    }, selector
  );

  if (!isFilteredCorrect) {
    throw new Error(
      'Failed to set hotlsogs filters correctly in nightmare'
    );
  }

  const html = await nightmare.evaluate( () => document.querySelector('html').innerHTML);
  const heroesData = await _fetchAllHeroWinRates(html);
  
  heroesData.scrapedDate = new Date();
  
  for (let heroIndex = 0; heroIndex < heroesData.heroes.length;) {
    let hero = heroesData.heroes[heroIndex];
    heroIndex++;
    
    if (!hero) {
      continue;
    }
    
    await _getHeroSpecificData(hero);
  }
  await nightmare.end();
  
  const patch = _selectCorrectPatch(heroesData, previousData);
  
  if (!patch) {
    // This is the case where hotslog knows there's a new patch before we do, we'll collect the data later
    return;
  }
  
  const fileName = `hots_log_${patch.fullVersion}.json`;
  return writeJSONFile(fileName, heroesData, () =>
    console.log(`Written hotslogs.com data to ${fileName}`)
  )
  // return the filename of the app
  .then(() => patch.fullVersion) 
  .catch(e => console.error(e));
}

module.exports = fetch;
