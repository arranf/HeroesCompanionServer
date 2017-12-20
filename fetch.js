
const Nightmare = require('nightmare');
const jquery = require('jquery'); 
const nightmare = new Nightmare({ show: false });
const chrono = require('chrono-node')
const fs = require('fs');
const titleCase = require('title-case');

function fetch() {
  const regex = /(\d{1,2}-[A-Za-z]{3,4}-\d{4}) [–,-] (\d{1,2}-[A-Za-z]{3,4}-\d{4})/;
  console.log('Fetching data')
  // Nightmare example: https://github.com/nelsonkhan/nightmare-gigs/blob/master/gigs.js
  nightmare
      .goto('http://eu.battle.net/heroes/en/heroes/')
      .wait('.hero-list:last-child')
      .evaluate(() => {
        let heroes = [];
        $('.hero-container:not(.placeholder)')
        .each((i, el) => {
          el = $(el)
          item = {}
          var name = el.find('.hero-list__item__name')[0]
          if (name){
            item.name = name.innerText
          }

          var title = el.find('.hero-list__item__title')[0]
          if (title) {
            item.title = title.innerText
          }

          var isFreeToPlay = $(el).find('.hero-list__item__free-flag')
          item.isFreeToPlay = isFreeToPlay.length > 0

          heroes.push(item)
        })
        let durationNodes = $('.free-rotation__date')
        if (!durationNodes || durationNodes.length <= 0){ 
          throw new Error('Things broke: Cant determine duration')
        }
        let duration = durationNodes[0].innerText
        
        return {'heroes': heroes, 'duration': duration}
      })
      .end()
      .catch((error) => console.error(error))
      .then((data) => {
        let duration = data['duration']
        let matches = regex.exec(data['duration'])
        if (!matches || matches.length != 3){
          throw new Error('Duration string matching failed')
        }
        let start = chrono.parseDate(matches[1])
        let end = chrono.parseDate(matches[2])
        data['start'] = start
        data['end'] = end
        data['heroes'].forEach((hero) => {
          hero['name'] = titleCase(hero['name'])
          hero['title'] = titleCase(hero['title'])
        })
        fs.writeFile('data.json', JSON.stringify(data), (err) => {  
          // throws an error, you could also catch it here
          if (err) throw err;
      
          // success case, the file was saved
          console.log(`Data Saved ${new Date()}`);
      })
    })
    .catch((error) => console.error(error))
}

module.exports = fetch