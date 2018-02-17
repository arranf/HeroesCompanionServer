const puppeteer = require('puppeteer');
const scrapeIt = require('scrape-it');
const fs = require('fs');

async function fetch() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.hotslogs.com/Default');
  const html = await page.$eval('html', (html) => html.innerHTML);
  console.log(html)
  return scrapeIt.scrapeHTML(html,
    {
      heroes: {
        listItem: '#DataTables_Table_0 > tbody > tr',
        data: {
          name: 'td:nth-child(2)',
          thing: 'a'
        }
      }
    }
  )
}


module.exports = fetch;