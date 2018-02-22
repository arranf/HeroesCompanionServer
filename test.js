var fetch = require('./scrapers/hots_log_scraper');

fetch().then(d => console.log('Done'));
