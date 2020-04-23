const Discord = require('discord.js')
const client = new Discord.Client()
const { JSDOM } = require("jsdom");
const $q = require('q');
var rp = require('request-promise');
const axios = require('axios').default;
var csrfLogin = require('csrf-login');
const fs = require('fs');
var jp = require('jsonpath');
var https = require('https');
require('date-fns')
require('dotenv').config();
const nlp = require('./modules/nlp/typoify.js')
const { Wit, log } = require('node-wit');
var parseDate = require('date-fns/parse')
const dialogflow = require('dialogflow');
const uuid = require('uuid');
const sessionId = uuid.v4();
const dflow = new dialogflow.SessionsClient();
const sessionPath = dflow.sessionPath(process.env.GOOGLE_CLOUD_PROJECT, sessionId);
const dFlowEnt = require('./helpers/update.js')

setInterval(() => updateData(), 30 * 60 * 1000);   // UPDATE OWNAGE DATA EVERY 30 MINUTES

const wit = new Wit({                              // Setup wit connection for mapping messages to intents
  accessToken: process.env.WIT_TOKEN,
  logger: new log.Logger(log.DEBUG)
});

async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}




function elapsedDays(date) {
  var thisTime = new Date();
  var diff = thisTime.getTime() - date.getTime();  // Get the time elapsed
  return Math.round(diff / (1000 * 60 * 60 * 24)); // ... As a positive number of days 
}

function getOsImage(osName) {
  switch (osName) {
    case "Linux": return 'https://i.ibb.co/mHXrhyC/linux.png'
    case "Windows": return 'https://i.ibb.co/61JG09j/windark.png'
    case "Solaris": return 'https://www.hackthebox.eu/images/solaris.png'
    case "FreeBSD": return 'https://www.hackthebox.eu/images/freebsd.png'
    case "Android": return 'https://www.hackthebox.eu/images/android.png'
    default:
      return 'https://www.hackthebox.eu/images/favicon.png'
  }
}


function FMT(str, inType) { //Converts text to the unicode special math font equivalent specified in switch [ bs, s, b, m ]
  var out = ""
  type = "𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓"           // Default to math sans
  var normalSet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" // Normal alphabet
  if (inType == "bs") {       // If bold sans
    var type = "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇"
  } else if (inType == "s") { // If sans
    var type = "𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓"
  } else if (inType == "b") { // If bold serif
    var type = "𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳"
  } else if (inType == "m") { // If monospaced
    var type = "𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣"
  }

  var fancySet = [...type]    // Convert to array with new ES6 string to byte array comprehension
  for (let i = 0; i < str.length; i++) {
    var char = str.charAt(i)
    if (normalSet.includes(char)) {
      var x = normalSet.indexOf(char)
      out += fancySet[x]
    } else {
      out += char
    }
  }
  // console.log('String in: ' + str + ' | String out: ' + out) // View conversion results
  return out
}


function numS(str) {
  str = str.toString()
  console.log(str)
  bold = "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"
  var bDig = [...bold]
  var o = ""
  for (let i = 0; i < str.length; i++) {
    switch (str.charAt(i)) {
      case '0': o += bDig[0]; break;
      case '1': o += bDig[1]; break;
      case '2': o += bDig[2]; break;
      case '3': o += bDig[3]; break;
      case '4': o += bDig[4]; break;
      case '5': o += bDig[5]; break;
      case '6': o += bDig[6]; break;
      case '7': o += bDig[7]; break;
      case '8': o += bDig[8]; break;
      case '9': o += bDig[9]; break;
      default:
        o += str.charAt(i)
        break;
    }
  }
  return o
}


function halfMoon(num) {       // HELPER FUNCTION (Returns the sub-integral symbol for 'ratingString' function)
  divd = num % 1
  scale = Math.round(divd * 4);
  switch (scale) {
    case 0: return '🌑'
    case 1: return '🌘'
    case 2: return '🌗'
    case 3: return '🌖'
    case 4: return '🌕'
    default: return '🌝'
  }
}

function ratingString(rating) { // CONVERTS A NUMERIC RATING (0.0 - 5.0) TO UNICODE MOON RATING (e.g. '2.5' => 🌕🌕🌗🌑🌑)
  if (rating == 0) {
    return 'Unrated'
  } else {
    return '🌕'.repeat(Math.floor(rating)) + halfMoon(rating) + '🌑'.repeat(Math.max((5 - Math.floor(rating)) - 1, 0))
  }
}

/*
wit.message('what is the weather in London?', {})
  .then((data) => {
    console.log('Yay, got Wit.ai response: ' + JSON.stringify(data));
  })
  .catch(console.error); */


var MACHINES = {}
var MACHINES_BUFFER
var TEAM_MEMBERS = {}
var DATA_HAS_LOADED = false
var MACHINE_STATS = { "totalBoxes": 0, "activeBoxes": 0, "retiredBoxes": 0, "unreleasedBoxes": 0 }
var TEAM_STATS = { "currentGlobalRanking": 5, "teamFounder": "__sx02089__", "topMembers": [0, 1, 2, 3], "teamLeader": 0, "top5": 0, "top10": 0, "top20": 0, "top25": 0 }


function updateMachineStats() {
  var statBuffer = { "totalBoxes": 0, "activeBoxes": 0, "retiredBoxes": 0, "unreleasedBoxes": 0 }
  time = new Date().getTime()
  Object.values(MACHINES).forEach(machine => {
    if (machine.release > time) { // If not yet released
      statBuffer.unreleasedBoxes += 1
    } else if (machine.retired) {
      statBuffer.retiredBoxes += 1
    } else {
      statBuffer.activeBoxes += 1
    }
    statBuffer.totalBoxes += 1
  });
  return statBuffer
}


function isEmpty(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key))
      return false;
  }
  return true;
}

function Set_toJSON(key, value) {
  if (typeof value === 'object' && value instanceof Set) {
    return [...value];
  }
  return value;
}


Set.revive = function (data) {
  return new Set(data.foo, data.bar);
};


function importExistingData() { // Imports machine and team data from json files, enabling the bot to serve answers immediately.
  try {
    MACHINES = JSON.parse(fs.readFileSync('machines.json', 'utf8'));
    TEAM_MEMBERS = JSON.parse(fs.readFileSync('team_members.json', 'utf8'));
    MACHINE_STATS = updateMachineStats()
    console.info("Imported existing datafiles! Will update automatically every half-hour.")
    DATA_HAS_LOADED = true
    machines = []
    Object.values(MACHINES).forEach(machine => {
      machines.push(machine.mname)
    });
  }
  catch (e) {
    console.warn('ERROR: couldn\'t import data. Moving on..')
    console.log(e)
  }
}

function exportData() { // Save JSON files of team and machine data.
  if (!isEmpty(MACHINES)) {

    fs.writeFile("machines.json", JSON.stringify(MACHINES, null, "\t"), 'utf8', function (err) {
      if (err) {
        console.log("An error occured while writing 'MACHINE' settings to File.");
        return console.log(err);
      }
      console.log("JSON file has been saved.");
    });
  }

  if (!isEmpty(TEAM_MEMBERS)) {
    fs.writeFile("team_members.json", JSON.stringify(TEAM_MEMBERS, null, "\t"), 'utf8', function (err) {
      if (err) {
        console.log("An error occured while writing 'TEAM_MEMBERS' settings to File.");
        return console.log(err);
      }
      console.log("JSON file has been saved.");
    });
  }
}

function andifyList(str) { // Convert comma-joined list to English "Bob, Sue, and Jane" format
  if (str.includes(',')) {
    var n = str.lastIndexOf(",");
    return str.substring(0, n + 1) + ' and' + str.substring(n + 1, str.length);
  } else {
    return str
  }
}

function getNewReleaseName() { // Returns the name of either an upcoming release (if announced) or the latest published box.
  var machineArray = Object.values(MACHINES)
  var topmid = 0
  for (let i = 0; i < machineArray.length; i++) {
    // console.log(machineArray[i] + JSON.stringify(machineArray[i]))
    if (machineArray[i].unreleased) {
      console.log('Found unreleased machine ' + machineArray[i].mname + '!')
      return machineArray[i].mname
    }
  }
  if (machineArray['1']) {
    lastBoxName = machineArray[machineArray.length - 1]
    return lastBoxName.mname
  }
  return null
}

function getMachineIdFromName(name) { // Get the ID of the machine whose name matches the parameter string
  var machineArray = Object.values(MACHINES)
  for (let i = 0; i < machineArray.length; i++) {
    //console.log(machineArray[i] + JSON.stringify(machineArray[i]))
    if (machineArray[i].mname.toLowerCase() == name.toLowerCase()) {
      console.log('Machine name ' + name + ' matched MID #' + machineArray[i].mid)
      return machineArray[i].mid
    }
  }
  return null
}

function getMachineByName(name) { // Return machine object with name matching parameter string
  //console.log(name)
  if (name) {
    var machineArray = Object.values(MACHINES)
    for (let i = 0; i < machineArray.length; i++) {
      //console.log(machineArray[i] + JSON.stringify(machineArray[i]))
      if (machineArray[i].mname.toLowerCase() == name.toLowerCase()) {
        //console.log('Machine name ' + name + ' matched validated name ' + machineArray[i].mname)
        return machineArray[i]
      }
    }
  }
  return null
}

function getOwnersByMachineId(machineId) {
  console.log(machineId)
  if (machineId) {
    console.log(Array(MACHINES["232"].rootOwners))
    return Array.from(MACHINES[machineId].rootOwners)
  } else {
    return null
  }
}

function getMdLinksForMemberIds(memberIds) { // Get markdown link to a HTB user's profile, based on UID.
  console.log(memberIds)
  if (memberIds) {
    screenNames = []
    memberIds.forEach(member => {
      screenNames.push('[' + TEAM_MEMBERS[member.uid].uname + ']' + '(' + 'https://www.hackthebox.eu/home/users/profile/' + member.uid + ' ' + "'Hack The Box Profile for " + TEAM_MEMBERS[member.uid].uname + "'" + ')')
    });
    if (screenNames.length == 0) {
      return null
    } else {
      return screenNames
    }
  } else {
    return null
  }
}

function parseSingleDate(date) { // Parse date to timestamp (millis) for various formats used on HTB site, based on length
  if (date) {
    switch (date.length) {
      case 10:
        try {
          return new Date(parseDate(date, 'y-MM-dd', new Date(0)).setUTCHours(19)).getTime()
        } catch (error) {
          console.log(error)
          return 0
        }
      case 23:
        try {
          return new Date(date.replace(' UTC', 'Z')).getTime()
        } catch (error) {
          console.log(error)
          return 0
        }
      default:
        return 0
    }
  } else {
    return 0
  }
}

function parseDateArray(dates) { // Parse array of dates (see parseSingleDate)
  newDates = []
  dates.forEach(dateString => {
    newDates.push(parseSingleDate(dateString))
  });
  return newDates
}

function pointsToDifficulty(points) {
  switch (points) {
    case 0: return "Unknown"
    case 20: return "Easy";
    case 30: return "Medium";
    case 40: return "Hard";
    case 50: return "Insane";
    default: return ""
  }
}
function getMachines() {
  return new Promise(resolve => {
    rp('https://www.hackthebox.eu/api/machines/get/all?api_token=' + process.env.HTB_TOKEN, { json: true })
      .then(function (machines) {
        machineSet = {}
        console.log('Got machines...', machines.length);
        //console.log(value)
        var machineIds = jp.query(machines, '$.*.id');
        var machineNames = jp.query(machines, '$.*.name');
        var machineThumbs = jp.query(machines, '$.*.avatar_thumb')
        var machineIsRetireds = jp.query(machines, '$.*.retired')
        var machineMakers = jp.query(machines, '$.*.maker')
        var machineMaker2s = jp.query(machines, '$.*.maker2')
        var machineOses = jp.query(machines, '$.*.os')
        var machineIps = jp.query(machines, '$.*.ip')
        var machineRatings = jp.query(machines, '$.*.rating')
        var machineReleases = jp.query(machines, '$.*.release')
        var machineRetireDates = jp.query(machines, '$.*.retired_date')
        var machinePoints = jp.query(machines, '$.*.points')
        machineReleases = parseDateArray(machineReleases)
        machineRetireDates = parseDateArray(machineRetireDates)

        for (let i = 0; i < machineIds.length; i++) {
          //console.log(machineNames[i])
          machineSet[machineIds[i].toString()] = new HtbMachine(machineNames[i],
            machineIds[i].toString(),
            machineThumbs[i],
            machineIsRetireds[i],
            machineMakers[i],
            machineMaker2s[i],
            machineOses[i],
            machineIps[i],
            machineRatings[i],
            machineReleases[i],
            machineRetireDates[i],
            machinePoints[i],
            false
          )
        }
        resolve(machineSet);
      })
      .catch(function (err) {
        resolve(err);
      });
  });
}

function getTeamMembers(session) {
  return new Promise(resolve => {
    session.request('/home/teams/profile/2102', function (error, response, body) {
      teamUsers = {}
      var $ = require('jquery')(new JSDOM(body).window);
      var jq = $($('#membersTable').children()[1]).children().each(function () {
        var stats = $(this).children()
        var userCol = $(stats[1]).children()[0]
        var uName = userCol.innerHTML
        var uid = userCol.href.substring(45)
        var uOwns = Number(stats[3].innerHTML) + Number(stats[4].innerHTML)
        user = new TeamMember(uName, uid, { 'user': Number(stats[4].innerHTML), "root": Number(stats[3].innerHTML) })
        teamUsers[uid] = user
        //console.log('username: ' + uName + ' uid: ' + uid + ' uOwns: ' + uOwns)
      })
      console.log('SUCCESS: Got team members... ' + Object.keys(teamUsers).length)
      resolve(teamUsers)
    })
  })
}

function getSession() {
  return new Promise(resolve => {
    var promOne = csrfLogin({
      username: process.env.HTB_EMAIL,
      password: process.env.HTB_PASS
    }).then(function (info) { resolve(info) })
  })
}

function getUserProfile(id, session) {
  //console.log('getting user profile #' + id)
  return session.requestAsync('/home/users/profile/' + id)
}

async function getOwnageData(session, mbrs) {
  var members = Object.keys(mbrs)
  console.log("Collecting ownage data for " + members.length + " team members...")
  return new Promise(async resolve => {
    for (var i = 0; i < members.length; i++) {
      //for (var i = 0; i < 5; i++) {
      //console.log("#" + i.toString().padStart(2, '0') + ": Parsing owns for member " + members[i])
      response = await getUserProfile(members[i], session)
      await parseUserOwns(response.body, members[i])
    }
    console.log('FINISHED PARSING OWNS...')
    resolve()
  })
}

async function getUnreleasedMachine(session) {
  return new Promise(async resolve => {
    //for (var i = 0; i < members.length; i++) {
    response = await session.requestAsync('/home/machines/unreleased')
    var $ = require('jquery')(new JSDOM(response.body).window);
    if ($('.table tr').length > 1) {
      var trs = $($('.table tr')[1])
      var mids = trs.find("a[href^='https://www.hackthebox.eu/home/machines/profile/']")
      var urmid = mids[0].href.substring(48)
      var oldmid = mids[1].href.substring(48)
      var mname = mids[0].innerHTML
      var rname = mids[1].innerHTML
      var thumb = trs.find("img[src^='https://www.hackthebox.eu/storage/avatars']")[0].src
      var releaseDate = parseSingleDate($($('.table tr')[1]).find(":contains('UTC')")[0].innerHTML)
      var makers = trs.find("a[href^='https://www.hackthebox.eu/home/users/profile/']")
      var maker = makers[0].innerHTML
      var makerId = makers[0].href.substring(45)
      var maker2 = null
      try {
        maker2 = { "id": makers[1].innerHTML, "name": makers[1].href.substring(45) }
      } catch (error) {
        console.log(error + '\nNo 2nd maker ...')
      }
      response = await session.requestAsync('/home/machines/profile/' + urmid)
      var $ = require('jquery')(new JSDOM(response.body).window);
      var ip = $('td')[9].innerHTML
      var points = Number($('td span')[1].innerHTML)
      var difficulty = $('td span')[0].innerHTML
      var os = $('td')[1].innerHTML.substring($('td')[1].innerHTML.lastIndexOf('>') + 1).replace(' ', '')
      var unreleasedBox = new HtbMachine(mname,
        urmid,
        thumb,
        false,
        { "id": makerId, "name": maker },
        maker2,
        os,
        ip,
        0,
        releaseDate,
        null,
        points,
        { "replaces": rname, "mid": oldmid }
      )
      dFlowEnt.updateEntity('Machines', 'unreleasedBox.mname')
      resolve(unreleasedBox)
    } else {
      resolve(null)
    }
  })
}
async function updateData() {
  DATA_HAS_LOADED = false
  MACHINES_BUFFER = await getMachines()
  SESSION = await getSession()
  TEAM_MEMBERS_TEMP = await getTeamMembers(SESSION)
  if (Object.keys(TEAM_MEMBERS_TEMP).length > Object.keys(TEAM_MEMBERS).length) {
    TEAM_MEMBERS = TEAM_MEMBERS_TEMP
  }
  urmachine = await getUnreleasedMachine(SESSION)
  console.warn(urmachine ? "INFO: Got unreleased machine " + urmachine.mname + "..." : "INFO: There are currently no machines in unreleased section.")
  if (urmachine) {
    MACHINES[urmachine.mid.toString()] = urmachine
    MACHINES_BUFFER[urmachine.mid.toString()] = urmachine
  }
  await getOwnageData(SESSION, TEAM_MEMBERS)
  MACHINES = MACHINES_BUFFER
  await removeDuplicates()
  console.log("UPDATED DATA. Total machines: " + Object.values(MACHINES).length)
  DATA_HAS_LOADED = true
  exportData();
}


function parseUserOwns(body, uid) {
  return new Promise(resolve => {
    //console.log("Parsing owns for uid: " + uid)
    var $ = require('jquery')(new JSDOM(body).window);
    try {
      $('.p-xs').each(function () {
        //console.log('jquery')
        var t = $($(this).children()[1]).text().trim().split(/\s+/);
        var parsedTime = $($(this).children('span.pull-right')[0]).attr('title')
        var timestamp = parseDate(parsedTime, 'MMMM do, yyyy h:mm a', new Date()).getTime() / 1000

        var machineId = ''

        //console.log($(this).children('[href*="/machines/"]'))
        var machineLitmus = $(this).find('[href*="/machines/"]')
        if (machineLitmus.length > 0) { machineId = machineLitmus[0].href.substring(48) }
        //console.log('T[]: '+ t)
        if (t[2].includes('user')) {
          // console.log('USER MACHINE:' + t[2] + '@' + t[3])
          MACHINES_BUFFER[machineId].userOwners.push({ "uid": uid, "timestamp": timestamp })
        } else if (t[2].includes('root')) {
          //console.log('ROOT MACHINE:' + t[6] + '@' + t[3])
          //console.log(MACHINES[machineId].rootOwners)
          MACHINES_BUFFER[machineId].rootOwners.push({ "uid": uid, "timestamp": timestamp })
          //console.log(MACHINES[machineId].rootOwners)

          //MACHINES.add
        } else { /*console.log('Challenge, not parsing...')*/ }
      })
    } catch (error) {
      console.log(error + "Could not parse page. (Likely user has no rank / XP)")
    }
    resolve('Done..')
  })
}

function removeDuplicates() {
  return new Promise(resolve => {
    Object.values(MACHINES).forEach(machine => {
      machine.userOwners = [... new Set(machine.userOwners)]
      machine.rootOwners = [... new Set(machine.rootOwners)]
      machine.userOwners.sort((a, b) => (a.timestamp < b.timestamp) ? 1 : (a.timestamp === b.timestamp) ? ((a.uid < b.uid) ? 1 : -1) : -1)
      machine.rootOwners.sort((a, b) => (a.timestamp < b.timestamp) ? 1 : (a.timestamp === b.timestamp) ? ((a.uid < b.uid) ? 1 : -1) : -1)
    });
    resolve('done')
  })
}

class TeamMember {
  constructor(uname, uid, owns) {
    this.uname = uname;
    this.uid = uid;
    this.totalOwns = owns
  }
}

class HtbMachine {
  constructor(mname, mid, thumb, retired, maker, maker2, os, ip, rating, release, retiredate, points, unreleased) {
    this.mname = mname;
    this.mid = mid;
    this.thumb = thumb;
    this.userOwners = []
    this.rootOwners = []
    this.retired = retired
    this.maker = maker
    this.maker2 = maker2
    this.os = os
    this.ip = ip
    this.rating = rating
    this.release = release
    this.retiredate = retiredate
    this.points = points
    this.difficulty = pointsToDifficulty(points)
    this.unreleased = unreleased
  }
}

function between(str, oTag, cTag) {
  if (oTag == 'XXX') {
    var first = 0
  } else {
    var first = str.indexOf(oTag) + 1
  }
  return str.substring(
    first,
    str.substring(first).indexOf(cTag)
  );
}

importExistingData();
//updateData();

function constructBoxOwnersMessage(message, machineName) {
  if (!machineName) {
    machineName == ""
  } else { console.log("machinename: " + machineName) }
  twentyPlus = false
  console.log("Constructing a box info message for " + machineName + "...")
  ownerList = getMdLinksForMemberIds(getOwnersByMachineId(getMachineIdFromName(machineName)))
  if (ownerList) {
    if (ownerList.length > 20) {
      ownerList = ownerList.slice(0, 20)
      twentyPlus = true
    }
    if (ownerList.length == 1) {
      message.channel.send({
        embed: {
          color: 3447003,
          author: {
            name: getMachineByName(machineName).mname,
            icon_url: getMachineByName(machineName).thumb,
            url: 'https://www.hackthebox.eu/home/machines/profile/' + getMachineByName(machineName).mid,
          },
          description: ('**Owned by** ' + andifyList(ownerList.join(', ')) + (twentyPlus ? ' […]' : '') + ' :woman_detective:').substring(0, 2040)
        }
      }
      )
    } else {
      message.channel.send({
        embed: {
          color: 3447003,
          author: {
            name: getMachineByName(machineName).mname,
            icon_url: getMachineByName(machineName).thumb,
            url: 'https://www.hackthebox.eu/home/machines/profile/' + getMachineByName(machineName).mid,
          },
          description: ('**Most recent team owns:** ' + andifyList(ownerList.join(', ')) + (twentyPlus ? ' […]' : '') + ' :woman_detective:').substring(0, 2040)
        }
      })
    }
  } else {
    message.channel.send((getMachineByName(machineName) ? 'Looks like nobody in the team has done this box yet :tired_face:' : 'That isn\'t even a box!! Trying to trick me … silly Hu-man. :wheelchair:\nAccording to Wikipedia, u can\'t fool me... :woman_mage: '))
  }
}


function constructLastBoxOwnerMessage(message, machineName) {
  if (!machineName) {
    machineName == ""
  } else { console.log("machinename: " + machineName) }
  console.log(machineName)
  ownerList = getMdLinksForMemberIds(getOwnersByMachineId(getMachineIdFromName(machineName)))
  if (ownerList) {
    console.log(ownerList)
    lastOwner = ownerList[0]
    console.log(lastOwner)
    message.channel.send({
      embed: {
        color: 16580705,
        author: {
          name: getMachineByName(machineName).mname,
          icon_url: getMachineByName(machineName).thumb,
          url: 'https://www.hackthebox.eu/home/machines/profile/' + getMachineByName(machineName).mid,
        },
        description: ('**Last owned by: ** ' + lastOwner + ' :woman_detective:').substring(0, 2040)
      }
    }
    )
  } else {
    message.channel.send((getMachineByName(machineName) ? 'Looks like nobody in the team has done this box yet :tired_face:' : 'Not a box... hmm.'))
  }
}

function constructBoxInfoMessage(message, machineName) {
  if (!machineName) {
    machineName == ""
  } else { console.log("machinename: " + machineName) }
  box = getMachineByName(machineName)
  if (box) {
    message.channel.send({
      embed: {
        color: 1146986,
        author: {
          name: getMachineByName(machineName).mname,
          icon_url: getOsImage(box.os),
          url: 'https://www.hackthebox.eu/home/machines/profile/' + getMachineByName(machineName).mid,
        },
        description: ("AEIOU".includes(box.os.charAt(0)) ? 'An ' : 'A ') +
          box.os + ' box by **['
          + box.maker.name
          + '](https://www.hackthebox.eu/home/users/profile/'
          + box.maker.id.toString()
          + ')'
          + (box.maker2 ? '** & **[' + box.maker2.name + '](https://www.hackthebox.eu/home/users/profile/' + box.maker2.id.toString() + ')' : '')
          + '**.' /*
          + '\n```diff\n'
          + '× Status   : ' + (box.retired ? '♻ Retired' : '⛯ Active') + '\n'
          + '+ Points   : ' + box.points + '\n'
          + '+ Released : ' + new Date(box.release).toDateString() + '\n'
          + '+ Rating   : ' + ratingString(box.rating) + '\n'
          + '+ Age      : ' + elapsedDays(new Date(box.release)) + ' days\n'
          + (box.retired ? '- Retired  : ' + (new Date(box.retiredate).toDateString()) : '')
          + '\n```' */,
        thumbnail: {
          url: getMachineByName(machineName).thumb.replace('_thumb', ''),
        },
        fields: [
          {
            name: '` ' + FMT('  ' + difficultySymbol(box.difficulty) + ' ', 's') + FMT(box.difficulty, 'bs') + '     `', inline: false,
            value: '```diff\n'
              + FMT((box.retired ? '- Status   : ' : '  Status   : '), 's') + (box.retired ? '🧟 Retired' : (box.release > (new Date()).getTime() ? '🔥 𝗨𝗡𝗥𝗘𝗟𝗘𝗔𝗦𝗘𝗗' : '👾 Active')) + '\n'
              + '+' + FMT(' Points   : ', 's') + box.points + '\n'
              + '+' + FMT(' Released : ', 's') + new Date(box.release).toDateString() + '\n'
              + '+' + FMT(' Rating   : ', 's') + ratingString(box.rating) + '\n'
              + '+' + FMT(' Age     : ', 's') + elapsedDays(new Date(box.release)) + ' days\n'
              + (box.retired ? FMT('+ Retired  : ') + (new Date(box.retiredate).toDateString()) : '')
              + (box.unreleased ? FMT('- Replaces : ') + box.unreleased.replaces : '')
              + '\n```'
          },
        ]
      }
    }
    )
  } else {
    message.reply('ጠﻉ乇የ ᙏØɾየ')
  }
}

function difficultySymbol(difficulty) {
  switch (difficulty) {
    case "Unknown": return "💩"
    case "Easy": return "📗";
    case "Medium": return "📘";
    case "Hard": return "📙";
    case "Insane": return "📕";
    default: return ""
  }
}



client.on('ready', () => {
  console.warn('INFO: Discord connection established...')
})




/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {string} projectId The project to be used
 */
async function understand(message) {
  return new Promise(async resolve => {
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          // The query to send to the dialogflow agent
          text: message,
          // The language used by the client (en-US)
          languageCode: 'en',
        },
      },
    };

    const responses = await dflow.detectIntent(request);
    console.log('Detected intent');
    const result = responses[0].queryResult;
    //console.log(`  Full response: ${JSON.stringify(result)}`);
    console.log(`  Query: ${result.queryText}`);
    console.log(`  Response: ${result.fulfillmentText}`);

    if (result.intent) {
      console.log(`  Intent: ${result.intent.displayName}`);
    } else {
      console.log(`  No intent matched.`);
    }
    resolve(result)
  })
}

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}


var KEYSTROKE = 10
async function humanSend(message, msg, noMention) {
  return new Promise(async resolve => {
    if (!msg || msg.length == 0) {
      msg == " "
    }
    console.log(msg)
    var msgLines = msg.split('\\n')
    if (noMention) {
      var firstline = false
    } else {
      var firstline = true
    }
    await asyncForEach(msgLines, async ln => {
      message.channel.startTyping()
      console.log(ln)
      if (Math.random() < 0.1) { // random chance we'll try to generate a typo
        var typoData = nlp.typo(ln)
        if (typoData) {
          console.log(typoData)
          message.channel.startTyping()
          await wait(ln.length * ((Math.random() * 50) + KEYSTROKE))
          await message.reply(ln.replace(typoData[0], typoData[1]))
          message.channel.stopTyping()
          await wait(300)
          message.channel.startTyping()
          await wait(300)
          await wait(500 + (typoData[0].length * KEYSTROKE))
          if (firstline) {
            await message.reply((Math.random() > 0.5 ? "*" : "") + typoData[0]);
          } else {
            await message.channel.send((Math.random() > 0.5 ? "*" : "") + typoData[0]);
          }


        } else {
          message.channel.startTyping()
          await wait(500 + (ln.length * KEYSTROKE))
          if (firstline) {
            await message.reply(ln)
          } else {
            await message.channel.send(ln)
          }
          message.channel.stopTyping()
        }
      } else {
        await wait(500 + (ln.length * ((Math.random() * 50) + KEYSTROKE)))
        if (firstline) {
          await message.reply(ln)
        } else {
          await message.channel.send(ln)
        }
        firstline = false
      }
      message.channel.stopTyping()
      resolve()
    });
  })
  //console.log('finished sending message')
}



async function sendTotalBoxCountMsg(message, note) {
  msg = "There are currently " + MACHINE_STATS.totalBoxes + " machines in total. (__" +
        (MACHINE_STATS.unreleasedBoxes > 0 ? MACHINE_STATS.unreleasedBoxes + " unreleased, ": "") +
        MACHINE_STATS.activeBoxes + " active, " + MACHINE_STATS.retiredBoxes + " retired.__)"
  if (note) {
    console.log("NOTE: "+note)
    await humanSend(message, note, true)
  }
  await humanSend(message, msg)
}

async function sendActiveBoxCountMsg(message, note) {
  msg = "There are " + MACHINE_STATS.activeBoxes + ( Math.random() > 0.5 ? " non-retired " : " active ") + "machines."
  if (note) {
    console.log("NOTE: "+note)
    await humanSend(message, note, true)
  }
  await humanSend(message, msg)
}

async function sendRetiredBoxCountMsg(message, note) {
  msg = "There are " + MACHINE_STATS.retiredBoxes + ( Math.random() > 0.5 ? " retired " : " inactive ") + "machines."
  if (note) {
    console.log("NOTE: " + note)
    await humanSend(message, note, true)
  }
  await humanSend(message, msg)
}


async function doFakeReboot(message, note) {
  await humanSend(message, note, true)
  await client.user.setStatus('idle')
    .then(console.log)
    .catch(console.error);
  await wait(3500)
  await client.user.setStatus('online')
    .then(console.log)
    .catch(console.error);
}

const checkIsSevenMsg = /[\t ]?seven\W?/g;

async function handleMessage(message) {
  if (message.channel.type == "dm" || message.content.toLowerCase().includes('seven')) {
    if (!message.author.bot) {
      if (message.content.toLowerCase().match(checkIsSevenMsg)) {
        message.content = message.content.toLowerCase().replace(checkIsSevenMsg, "")
      }
      console.log('got dm')
      result = await understand(message.content)
      isRipe = result.allRequiredParamsPresent
      console.log('result.intent: ' + result.intent.displayName + "  |  isRipe(hasParams): " + isRipe)
      if (result.intent && isRipe) {
        var job = result.intent.displayName
        var inf = result.parameters.fields
        console.log('jobinf: ' + job + ' | ' + JSON.stringify(inf))
        message.channel.startTyping()
        switch (job) {
          case "removeLastXMessages": break;
          case "getBoxInfo": try { constructBoxInfoMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getBoxOwners": try { constructBoxOwnersMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getLastBoxOwner": try { constructLastBoxOwnerMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getBoxLaunchDate": try { constructBoxInfoMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getBoxRetireDate": break;
          case "getTotalBoxCount": try { sendTotalBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getActiveBoxCount": try { sendActiveBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getRetiredBoxCount": try { sendRetiredBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "agent.doReboot": doFakeReboot(message, result.fulfillmentText); break;
          case "getNewBox": console.log("got here6.."); constructBoxInfoMessage(message, getNewReleaseName()); break;
          default:
            message.channel.stopTyping(true)
            if (result.fulfillmentText) {
              message.channel.startTyping()
              await humanSend(message, result.fulfillmentText)
            }
            message.channel.stopTyping(true)

        }
        message.channel.stopTyping(true)
      }




      /*
      wit.message(message.content, {})
        .then((data) => {
          //message.reply('Yay, got Wit.ai response: ' + JSON.stringify(data));
          if (!message.content.trim().includes(' ') && message.content.length > 1) {
            
          } else if (data.entities.intent[0].value.toLowerCase() == 'getboxowners' && data.entities.machine[0]) {
            machineName = data.entities.machine[0].value
            constructBoxOwnersMessage(message, machineName)
            console.log('We want to ' + data.entities.intent[0].value + ' for ' + data.entities.machine[0].value)
          } else if (data.entities.intent[0].value.toLowerCase() == 'getlastboxowner' && data.entities.machine) {
            machineName = data.entities.machine[0].value
            constructLastBoxOwnerMessage(message, machineName)
            console.log('We want to ' + data.entities.intent[0].value + ' for ' + data.entities.machine[0].value)
          } else if (data.entities.intent[0].value.toLowerCase() == 'getmachineinfo' && data.entities.machine) {
            machineName = data.entities.machine[0].value
            constructBoxInfoMessage(message, machineName)
            console.log('We want to ' + data.entities.intent[0].value + ' for ' + data.entities.machine[0].value)
          } else if (data.entities.intent[0].value.toLowerCase() == 'getupcomingrelease') {
            constructBoxInfoMessage(message, getNewReleaseName())
            console.log('We want to ' + data.entities.intent[0].value + '.')
          } else {
            message.reply('Sorry, I didn\'t understand that. ٩(๏̯๏)۶')
          }
        })
        .catch(function (error) {
          console.error(error);
          message.reply('What...? :monkey:')
        }); */
    }
  }
}

client.on('message', message => {
  try {
    handleMessage(message)
  } catch (error) {
    console.log(error)
    message.channel.stopTyping()
  }

})

client.login(process.env.BOT_TOKEN) // BOT_TOKEN is the Client Secret

//client.channels.get(CODE).send({ embed: exampleEmbed });
