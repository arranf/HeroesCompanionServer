let patchDatav1 = JSON.stringify({});
let patchDatav2 = JSON.stringify({});
let axios = require('axios');
let lastRead;

// fetch latest and then schedule getting latest
getPatchData();
var cron = require('node-cron');
cron.schedule(
  '*/29 * * * *',
  function () {
    getPatchData();
  }
);

function saveV1PatchData (hotsDogData, buildData) {
  let ourPatchData = [];
  hotsDogData.forEach(hotsDogBuild => {
    let fullBuild = buildData.find(
      b => b.fullVersion && b.fullVersion.includes(hotsDogBuild.ID)
    );
    if (fullBuild) {
      fullBuild['patchNotesUrl'] = `heroespatchnotes.com/patch/${
        fullBuild.liveDate
      }-${fullBuild.patchType.toLowerCase().replace(' ', '-')}.html`;
      fullBuild['fullVersion'] = hotsDogBuild.ID;
      fullBuild['hotsDogId'] = hotsDogBuild.ID;
      fullBuild['gameVersion'] = fullBuild['gameVersion'] + 'UNIQUE';
      delete fullBuild['internalId'];
      delete fullBuild['liveBuild'];
      delete fullBuild['ptrOfficialLink'];
      delete fullBuild['ptrDate'];
      delete fullBuild['ptrBuild'];
      ourPatchData.push(fullBuild);
    } else {
      // TODO MAKE THIS SAFE if a hots.dog patch is available before a patch notes update
      cheekyBuild = {
        patchNotesUrl:
          'https://us.battle.net/heroes/en/blog/21509171/heroes-of-the-storm-patch-notes-february-6-2018-2-6-2018',
        patchName: '',
        officialLink:
          'https://us.battle.net/heroes/en/blog/21509171/heroes-of-the-storm-patch-notes-february-6-2018-2-6-2018',
        alternateLink: '',
        patchType: 'Unknown',
        gameVersion: ''
      };
    }
  });
  patchDatav1 = ourPatchData;
  console.log('Got v1 patch data');
}

function saveV2PatchData (hotsDogData, buildData) {
  let ourPatchData = [];
  let year = new Date().getFullYear();
  buildData.forEach(patchNotesBuild => {
    if (
      !patchNotesBuild.fullVersion ||
      !(
        patchNotesBuild.liveDate.includes(year.toString()) ||
        patchNotesBuild.liveDate.includes((year - 1).toString())
      )
    ) {
      return;
    }

    let hotsDogBuild = hotsDogData.find(b =>
      patchNotesBuild.fullVersion.includes(b.ID)
    );

    patchNotesBuild['patchNotesUrl'] = `heroespatchnotes.com/patch/${
      patchNotesBuild.liveDate
    }-${patchNotesBuild.patchType.toLowerCase().replace(' ', '-')}.html`;
    if (hotsDogBuild) {
      patchNotesBuild['hotsDogId'] = hotsDogBuild.ID;
      patchNotesBuild['finish'] = hotsDogBuild.Finish;
    }
    delete patchNotesBuild['internalId'];
    delete patchNotesBuild['liveBuild'];
    delete patchNotesBuild['ptrOfficialLink'];
    delete patchNotesBuild['ptrDate'];
    delete patchNotesBuild['ptrBuild'];
    ourPatchData.push(patchNotesBuild);
  });
  ourPatchData.reverse();
  ourPatchData = ourPatchData.slice(0, 4);
  patchDatav2 = ourPatchData;
  console.log('Got v2 patch data');
}

function getPatchData () {
  console.log('Fetching patch data');
  let hotsDogBuilds = axios
    .get('https://hots.dog/api/init')
    .then(response => {
      if (!response.data) {
        throw new Error('Unable to get hots patch data');
      }
      return response.data.Builds;
    })
    .catch(e => console.error(e));

  let allBuilds = axios
    .get(
      'https://raw.githubusercontent.com/heroespatchnotes/heroes-patch-data/master/patchversions.json'
    )
    .then(response => {
      if (!response.data) {
        throw new Error('Unable to get patch data from Github');
      }
      return response.data;
    })
    .catch(e => console.error(e));

  Promise.all([hotsDogBuilds, allBuilds])
    .then(([hotsDogData, buildData]) => {
      saveV1PatchData(
        JSON.parse(JSON.stringify(hotsDogData)),
        JSON.parse(JSON.stringify(buildData))
      );
      saveV2PatchData(hotsDogData, buildData);
    })
    .catch(e => console.error(e));
}

module.exports = {
  v1PatchData: () => patchDatav1,
  v2PatchData: () => patchDatav2
};
