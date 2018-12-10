const Nightmare = require('nightmare');
const scrapeIt = require('scrape-it');
const axiosRetry = require('axios-retry');

const Talent = require('../models/talent');
const Hero = require('../models/hero');

const { writeJSONFile } = require('../services/file_service');
const { v2PatchData } = require('../services/patch_service');


let axios = require('axios');
axiosRetry(axios, { retries: 3 });

const isDebug = process.env.NODE_ENV !== 'production';

const talentDoesntRequireLevel10Ult = (talent, hero) => (!talent.AbilityId.includes("|R1") && !talent.AbilityId.includes("|R2")) || hero.Name === "Alarak";

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
  const levelIndexMap = { 1: 1, 4: 2, 7: 3, 10: 4, 13: 5, 16: 6, 20: 7 };

  if (isDebug) {
    console.log(`Visiting ${hero.name}`);
  }

  const nightmare = new Nightmare({ show: isDebug,  gotoTimeout: 90000 });
  await nightmare.goto('https://www.hotslogs.com/' + hero.link);
  const html = await nightmare.evaluate(() => document.querySelector('html').innerHTML);
  await nightmare.end().catch(e => console.error(e));

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
    .then(async response => {
      return await _fillInMissingTalents(response, hero, levelIndexMap);
    })
    .catch(e => console.error(e));
}

/**
 * Takes partial hotslog builds and attempts to fill in missing talents either using hots.dog builds to fill in blank or by guessing level 20 talents
 * @param {*} response The hots.dog build data for this hero
 * @param {*} hero The scraped hero object
 * @param {*} levelIndexMap The map of hero talent levels to hots.dog indices
 */
async function _fillInMissingTalents(response, hero, levelIndexMap) {
  if (!response.data) {
    throw new Exception('Failure getting hots dog build');
  }

  let data = response.data;

  let hotsDogBuilds = [];
  if (data.PopularBuilds) {
    data.PopularBuilds.forEach(b => {
      if (b.Build.length === 7) {
        hotsDogBuilds.push(b.Build.map(a => data.Talents[a].Name));
      }
    });
  }
  if (data.WinningBuilds) {
    data.WinningBuilds.forEach(b => {
      if (b.Build.length === 7) {
        hotsDogBuilds.push(b.Build.map(a => data.Talents[a].Name));
      }
    });
  }

  // Worst case talent matching data (done here to avoid doing in loop)
  
  // Varian gets his level 10 at level 4
  const firstUltLevel = hero.name === "Varian" ? 4 : 10;

  const heroModel = await Hero.findOne({Name: hero.name}).exec();
  const level20Popularity = Object.entries(data.Current[levelIndexMap[20]]).map(a => ({'TalentTreeId': a[0], 'Total':(a[1].Wins)}));
  const mostPopularLevel20TalentData = level20Popularity.reduce((a, b) => (a.Total > b.Total) ? a : b);
  const mostPopularLevel20TalentTreeId = mostPopularLevel20TalentData.TalentTreeId;
  const mostPopularLevel20Talent = await Talent.findOne({
    TalentTreeId: mostPopularLevel20TalentTreeId,
    HeroId: heroModel.HeroId
  }).exec();



  for (let i = 0; i < hero.builds.length; i++) {
      let hotsLogBuild = hero.builds[i]; 
      const haveTalentLevels = hotsLogBuild.talents.map(t => t.level);
      const missingTalents = Object.keys(levelIndexMap)
        .filter(x => haveTalentLevels.indexOf(parseInt(x, 10)) < 0)
        .map(x => parseInt(x, 10));
      const talentNames = hotsLogBuild.talents.map(t => t.name);
      
      // First try matching with hots dog builds
      for (let i = 0; i < hotsDogBuilds.length; i++) {
        let hotsDogBuild = hotsDogBuilds[i];
        if (talentNames.every(name => hotsDogBuild.indexOf(name) >= 0)) {
          // We have a match!
          missingTalents.forEach(level => {
            const name = hotsDogBuild[levelIndexMap[level]];
            hotsLogBuild.talents.push({ name: name, level: level });
          });
          continue;
        }
        else if (missingTalents.length === 1 && missingTalents[0] === 20 && i === hotsDogBuild.length - 1) {
          // In this case we weren't going to match but we can guess a level 20 talent here
          const level10 = hotsLogBuild.talents.find(a => a.level === firstUltLevel);
          const matchingLevel10Build = hotsDogBuilds.find(a => a.find(b => b.indexOf(level10.name) >= 0));
          if (matchingLevel10Build) {
            const level20TalentName = matchingLevel10Build[levelIndexMap[20]];
            hotsLogBuild.talents.push({ name: level20TalentName, level: 20 });
            continue;
          }
        }
      }
  
      if (missingTalents.length === 1 && missingTalents[0] === 20){
        // We didn't have a hots log build to match a level 20 from - let's use best judgement based on what we know about hero talent popularity
        const chosenLevel10TalentName = hotsLogBuild.talents.find(a => a.level === firstUltLevel).name;
        const chosenLevel10Talent = await Talent.findOne({
          Name: chosenLevel10TalentName,
          HeroId: heroModel.HeroId
        }).exec();

        if (!chosenLevel10Talent) {
          throw new Error(`No chosen level 10 talent found for hero ${hero.name}. Suspected chosen level 10 should be \'${chosenLevel10TalentName}\'`)
        }

        const matchingLevel10Talent = await Talent.findOne({HeroId: heroModel.HeroId, Level: 20, AbilityId: chosenLevel10Talent.AbilityId}).exec();        
        if (mostPopularLevel20Talent && chosenLevel10Talent && (chosenLevel10Talent.AbilityId == mostPopularLevel20Talent.AbilityId || talentDoesntRequireLevel10Ult(mostPopularLevel20Talent, heroModel))) {
         hotsLogBuild.talents.push({ name: mostPopularLevel20Talent.Name, level: 20 });
        } 
        else if (matchingLevel10Talent) {
          hotsLogBuild.talents.push({ name: matchingLevel10Talent.Name, level: 20 });
        }
        else {
          // This hero doesn't have a level 20 talent to match their level 10 choice and the most popular ult is for another level 10 choice we didn't make
          console.error(`We failed to find a level 20 talent to match for ${heroModel.Name} so we're selecting a random one`);
          
          // TODO Make this find all of them then choose the most popular to avoid always selecting the first in the DB
          const randomLevel20 = await Talent.findOne({
            Level: 20,
            HeroId: 80,
            AbilityId: { "$regex": '^([A-Z]+\|)(?!R1|R2)' }
          }).exec();
          hotsLogBuild.talents.push({ name: randomLevel20.Name, level: 20 });
        }
      }
    }

  hero.builds = hero.builds.filter(b => b.talents.length === 7);
  return hero;
}

function _selectCorrectPatch(currentData, previousData) {
  let newPatch = false;
  const twoDaysAgo = getDate2DaysAgo();
  
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
  let patches = v2PatchData();
  if (newPatch) {
    // Hint for double checking date logic: tomorrow > today
    patch = patches.find(p => new Date(p.liveDate) > twoDaysAgo);
  } else {
    // Hint for double checking date logic: yesterday < today
    patch = patches.find(p => new Date(p.liveDate) <= twoDaysAgo);
  }

  return patch;
}

async function fetch (previousData) {
  console.log('Starting Nightmare')
  const nightmare = new Nightmare({ show: isDebug,  gotoTimeout: 90000 });
  console.log(nightmare);
  await nightmare.goto('https://www.hotslogs.com/Sitewide/HeroAndMapStatistics');
  await nightmare.click('#ctl00_MainContent_ComboBoxReplayDateTime_Input');
  await nightmare.wait(500);
  await nightmare.click(
    '#ctl00_MainContent_ComboBoxReplayDateTime_DropDown > div > ul > li:nth-child(1) > label'
  );
  await nightmare.wait(1000);
  await nightmare.click('#ctl00_MainContent_ComboBoxReplayDateTime_Arrow');
  await nightmare.wait(5000);
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
  await nightmare.end().catch(e => console.error(e));
  
  const heroesData = await _fetchAllHeroWinRates(html);
  
  heroesData.scrapedDate = new Date();
  
  for (let heroIndex = 0; heroIndex < heroesData.heroes.length;) {
    let hero = heroesData.heroes[heroIndex];
    
    if (!hero) {
      continue;
    }
    
    await _getHeroSpecificData(hero);
    heroIndex++;
  }
  
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
