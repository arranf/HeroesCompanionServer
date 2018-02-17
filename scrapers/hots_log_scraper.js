const puppeteer = require('puppeteer');
const scrapeIt = require('scrape-it');
const fs = require('fs');

async function fetchAllHeroWinRates (html) {
  return scrapeIt.scrapeHTML(html,
    {
      heroes: {
        listItem: '#DataTables_Table_0 > tbody > tr',
        data: {
          name: 'td:nth-child(2)',
          played: 'td:nth-child(3)',
          popularity: 'td:nth-child(5)',
          winPercentage: 'td:nth-child(6)',
          link: {
            selector: 'a',
            attr: 'href'
          },
        }
      }
    });
}

async function scrapeHeroPage (html) {
  return scrapeIt.scrapeHTML(html, 
  {
    builds: {
      listItem: '[id$=\'PopularTalentBuilds\'] tbody > tr',
      data: {
        gamesPlayed: 'td:nth-child(1)',
        winPercentage: 'td:nth-child(2)',
        talents: {
          listItem: 'img',
          data: {
            name: {
              attr: 'alt',
              convert: x => x.substr(0, x.indexOf(': '))
            },
          }
        }
      }
    }
  });
}

async function getHeroSpecificData(page, hero) {
    await page.goto('https://www.hotslogs.com/' + hero.link, {timeout: 0});
    const html = await page.$eval('html', (html) => html.innerHTML);
    return scrapeHeroPage(html)
    .then((data) => {hero['individualData'] = data; page.close();})
    .catch(e => console.error(e))
}

async function fetch () {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.hotslogs.com/Default');
  const html = await page.$eval('html', (html) => html.innerHTML);
  const heroesData = await fetchAllHeroWinRates(html);
  const promises = [];
  for (let heroIndex = 0; heroIndex < heroesData.heroes.length;) {
    for (let i = 0; i < 10; i++) {
      let hero = heroesData.heroes[heroIndex];
      heroIndex++;
      if (!hero) {
        console.error('Skipping Malformed hero?')
        continue;
      }
      console.log(`Visiting ${hero.name}`);
      let page = await browser.newPage();
      promises.push(getHeroSpecificData(page, hero));
    }
    await Promise.all(promises)
    .catch(e => console.error(e));
  }
  await browser.close();
  return heroesData;
}


module.exports = fetch;