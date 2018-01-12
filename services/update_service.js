let updateData =  JSON.stringify({})
let axios = require('axios')
let lastRead
let updateId = ''


// fetch latest and then schedule getting latest 
getUpdateData();
var cron = require('node-cron')
cron.schedule('*/10 * * * *', function() {
  getUpdateData()
}, true)

function getUpdateData() {
  console.log('Fetching update data')
  axios.get('https://s3-eu-west-1.amazonaws.com/data.heroescompanion.com/data.json')
  .then(response => {
    console.log(`Id: ${response.data.id}`)
    lastRead = Date.now()
    updateData = response.data
    updateId = updateData.id
    console.log(`Last read from file ${lastRead}`)
  })
  .catch(e => console.error(e))
}

module.exports = {updateData: () => updateData, updateId: () => updateId}