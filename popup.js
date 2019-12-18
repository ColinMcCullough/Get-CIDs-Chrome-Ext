//Event listener on button to run main()
document.getElementById('clickme').addEventListener('click', main);
document.getElementById('save').addEventListener('click', saveApiKey);
chrome.storage.sync.get( ['key'], result => $('#apikeyinput').val(result.key));

/**
 * Gets API Key from Chrome Storage
 * @returns {String} -- API Key
 */
function getPoiKey() {
    return new Promise(resolve => {
        chrome.storage.sync.get( ['key'],
          (result) => { resolve(result.key); }
        );
    });
}

/**
 * Saves API Key to Chrome Storage
 * @returns {String} -- API Key
 */
function saveApiKey() {
    const value = $("#apikeyinput").val();
    chrome.storage.sync.set({key: value}, function() {
        console.log('Value is set to ' + value);
    });
}

/**
 * Gets current active tab url
 * @returns {String} - current tab url
 */
function getUrl() {
    return new Promise(resolve => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          (tabs) => { resolve(tabs[0] || null); }
        );
    });
}

/**
 * Places CID's in each locations object
 * @param {Object} locationData - key >> urn
 * @param {String} apikey
 */
async function getCIDs(locationData,apikey) {
    const locations = Object.keys(locationData)
    for(let i = 0; i < locations.length;i++) {
        const places = await getPlaces(locationData[locations[i]].lat,locationData[locations[i]].lon,apikey);
        const locationName = locationData[locations[i]].name;
        const key = locations[i];
        console.log(locationName)
        await matchBrandName(places, key, locationData, apikey);
        delete locationData[key].lat;
        delete locationData[key].lon;
    }
}

/**
 * Gets Array of Google Place objects near lat,lon passed into function
 * @param {Number} lat - latitude
 * @param {Number} lon - longitude
 * @param {String} apikey
 * @returns {[Array]} - Array of place objects near the lat lon passed in
 */
function getPlaces(lat,lon,apikey) {
    var placesReq = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&rankby=distance&key=${apikey}`
    return fetch(placesReq)
        .then((resp) => resp.json())
        .then(json => json.results)
        .catch(err => console.log(err.message))
}

/**
 * Updates Google cid property in location Data object 
 * @param {*} data - Google Places array
 * @param {*} key - urn of location to match
 * @param {Object} locationData - locationData object
 * @param {String} apikey - String
 */
async function matchBrandName(data, key, locationData, apikey) {
    const locationName = locationData[key].name
    let found = false;
    let i = 0
    while(!found && i < data.length) {
        if(data[i].name.includes(locationName) || locationName.includes(data[i].name)) {
            const cidurl = await placeIDSearch(data[i].place_id,apikey);
            const placeid = cidurl.split("cid=")[1];
            locationData[key]['Google cid'] = `="${placeid}"`;
            found = true;
        }
        i++;
    }
}

/**
 * Gets Google CID URL
 * @param {Number} placeid
 * @param {String} apikey
 * @returns {String} - cid url
 */
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
* @param {String} clientId
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


/**
 * Formates secondary listing as a string
 * @param {[Array]} arr of numbers
 * @returns {String}
 */
function buildFormattedLising(arr) {
    let str = ''
    for(let i = 0; i < arr.length; i++) {
        const category = arr[i]
        str += `"${categories[category]}",`;
    }
    str = str.slice(0, -1);
    return str.length > 0 ? `{"data"=>[${str}]}` : str
}


/**
 * Creates CSV
 * @param {Object} locationData
 * @returns {String} -csv download url
 */
function generateCSV(locationData) {
    const csv = []
    Object.keys(locationData).forEach((key) => {    
        csv.push(locationData[key])
    })
    const unparsedcsv = Papa.unparse(csv);
    const file = new Blob([unparsedcsv], { type: "text/csv" });
    return URL.createObjectURL(file);
}


/**
 * Fixes phone number formatting to just numbers and dashes
 * @param {String} str
 * @returns {String} - formatted phone #
 */
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


/**
 * Downloads csv from URL
 * @param {String} csvurl
 */
function downloadCSV(csvurl) {
    chrome.downloads.download({
        url: csvurl,
        filename: 'cids.csv'
    });
}

/**
 * Updates button to show loading
 * Hides alert class
 */
function setElementsState() {
    $('#clickme.btn').button('loading');
    $(".alert").hide()
}

/**
 * Shows Alert Class with Message passed into function
 * Resets button status
 * @param {String} message
 */
function updateElementsState(message) {
    $(".alert").show().text(message)
    resetbtn();
}

// Resets button
function resetbtn() { $('.btn').button('reset') }

/**
 * Gets from all client locations not deleted and downloads a CSV
 */
async function main() {
    setElementsState()
    const apikey = $('#apikeyinput').val();
    const taburlpromise = await getUrl();
    const url = taburlpromise.url.split('/').pop();
    const locationData = await getLocationData(url);
    if(locationData) {
        await getCIDs(locationData,apikey);
        const csvurl = generateCSV(locationData)
        downloadCSV(csvurl)
        updateElementsState('Success! Your csv is available')
    }
    else {
        updateElementsState('Your on the wrong page,\n Re-run from the client overview in the hub.')
    } 
}



