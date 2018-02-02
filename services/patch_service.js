let patchData =  JSON.stringify({})
let axios = require('axios')
let lastRead


// fetch latest and then schedule getting latest 
getPatchData();
var cron = require('node-cron')
cron.schedule('*/29 * * * *', function() {
  getPatchData()
}, true)

function getPatchData() {
  console.log('Fetching patch data')
  let hotsDogBuilds = axios.get('https://hots.dog/api/init')
    .then(response => {
      if (!response.data) {
        throw new Error('Unable to get hots patch data')
      }
      return response.data.Builds
    })
    .catch(e => console.error(e))
  
  let allBuilds = axios.get('https://raw.githubusercontent.com/heroespatchnotes/heroes-patch-data/master/patchversions.json')
    .then(response => {
      if (!response.data) {
        throw new Error('Unable to get patch data from Github')
      }
      return response.data
    })
    .catch(e => console.error(e))

  Promise.all([hotsDogBuilds, allBuilds])
    .then(([hotsDogData, buildData]) => {
      let ourPatchData = []
      hotsDogData.forEach(hotsDogBuild => {
        let fullBuild = buildData.find((b) => b.fullVersion === hotsDogBuild.ID)
        if (fullBuild) {
          fullBuild['patchNotesUrl'] = `heroespatchnotes.com/patch/${fullBuild.liveDate}-${fullBuild.patchType.toLowerCase().replace(' ','-')}.html`
          delete fullBuild['internalId']
          delete fullBuild['liveBuild']
          delete fullBuild['ptrOfficialLink']
          delete fullBuild['ptrDate']
          delete fullBuild['ptrBuild']
          ourPatchData.push(fullBuild)
        }
      });
      patchData = ourPatchData;
      console.log('Got patch data')
    })
    .catch(e => console.error(e))
}

module.exports = () => patchData