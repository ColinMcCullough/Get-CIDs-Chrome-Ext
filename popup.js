document.getElementById('clickme').addEventListener('click', main);

function getUrl() {
    return new Promise(resolve => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          (tabs) => { resolve(tabs[0] || null); }
        );
    });
  }

async function getCIDs(locationData,apikey) {
    const locations = Object.keys(locationData)
    for(let i = 0; i < locations.length;i++) {
        let places = await getPlaces(locationData[locations[i]].lat,locationData[locations[i]].lon,apikey)
        let locationName = locationData[locations[i]].name
        let key = locations[i]
        console.log(locationName)
        await matchBrandName(places,key,locationName,locationData,apikey)
    }
}

function getPlaces(lat,lon,apikey) {
    var placesReq = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&rankby=distance&key=${apikey}`
    return fetch(placesReq)
        .then((resp) => resp.json())
        .then(json => json.results)
        .catch(err => console.log(err.message))
}

async function matchBrandName(data, key, locationName, locationData, apikey) {
    let found = false;
    let i = 0
    while(!found && i < data.length) {
        if(data[i].name.includes(locationName) || locationName.includes(data[i].name)) {
            const cidurl = await placeIDSearch(data[i].place_id,apikey);
            const placeid = cidurl.split("cid=")[1]
            locationData[key]['Google cid'] = `="${placeid}"`
            found = true
        }
        i++;
    }
}

async function placeIDSearch(placeid,apikey) {
    const apiurl = `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeid}&key=${apikey}`;
    return fetch(apiurl)
        .then((resp) => resp.json())
        .then(json => json.result.url)
        .catch(err => console.log(err.message))
}

/**
* Gets location object holding keys for each location
* Each location key holds object with lat,lon, urn properties
* @returns {Object} Location Obj
*/
async function getLocationData(clientId) {
    const requestURL = `https://g5-hub.herokuapp.com/clients/${clientId}.json`
    return fetch(requestURL)
        .then(resp => resp.json())
        .then(json => buildLocationObjs(json.client.locations))
        .catch(err => console.log(err))
}

 /**
 * Builds object with location names as keys
 * @param {[]} locations
 * @returns {Object} locobj
 */
function buildLocationObjs(locations) {
    let locobj = {}
    for(let i = 0; i < locations.length; i ++) {
        const location = locations[i]
        if ((location.status === 'Live' || location.status === 'Pending') && location.corporate === false) {
            locobj[location.urn] = {
                lat: location.latitude,
                lon: location.longitude,
                urn: location.urn,
                name: location.name,
                display_phone_number: formatPhoneNum(location.display_phone_number),
                phone_number: formatPhoneNum(location.phone_number),
                secondary_listing_categories: buildFormattedLising(location.secondary_listing_category),
                'Google cid': ''
            }
        }
    }
    return locobj
 }
// updated to return nothing if no categories found
 function buildFormattedLising(arr) {
     let str = ''
     for(let i = 0; i < arr.length; i++) {
         const category = arr[i]
         str += `"${categories[category]}",`;
     }
     str = str.slice(0, -1);
     return str.length > 0 ? `{"data"=>[${str}]}` : str
 }

 function generateCSV(locationData) {
    const csv = []
    Object.keys(locationData).forEach((key) => {    
        csv.push(locationData[key])
    })
    const unparsedcsv = Papa.unparse(csv);
    const file = new Blob([unparsedcsv], { type: "text/csv" });
    return URL.createObjectURL(file);
 }

function formatPhoneNum(str) {
    let fullNumber = "";
    str = str.toString().replace(/[^0-9\.]+/g, '').trim();
    if(str != "" || str.length === 10) {
      const areaCode = str.substr(0, 3);
      const first3 = str.substr(3, 3);
      const last4 = str.substr(6, 4);
      fullNumber = `${areaCode}-${first3}-${last4}`;
    }
    return fullNumber;
} 


async function main() {
    $('.btn').button('loading')
    //const apikey = envconfig.apikey
    const apikey = 'AIzaSyD0qNg1CyA0l4_m_reeJP7JbKPUL5wway4'
    const taburlpromise = await getUrl();
    const url = taburlpromise.url.split('/').pop();
    const locationData = await getLocationData(url);
    await getCIDs(locationData,apikey);
    const csvurl = generateCSV(locationData)
    chrome.downloads.download({
        url: csvurl,
        filename: 'cids.csv'
      });
    $('.btn').button('reset')
}

//test with phone number ovverride and no note (error on front end will it work on import)
//tst with chatmeter paused and no note
//test with
