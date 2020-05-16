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
if (process.env.HEROKU) {
  console.log("SEVEN-SERVER: Started at " + new Date().toLocaleTimeString() + " on Heroku. Using cloud-configured env vars")
} else {
  console.log("SEVEN-SERVER: Started at " + new Date().toLocaleTimeString() + " on dev machine. Scanning ./config/env for vars")
  require('dotenv').config({ path: './config/.env' });
}
const nlp = require('./modules/nlp/typoify.js')
const { Wit, log } = require('node-wit');
const parseDate = require('date-fns/parse')
const formatRelative = require('date-fns/formatRelative')
const dialogflow = require('dialogflow');
const uuid = require('uuid');
const sessionId = uuid.v4();
const dflow = new dialogflow.SessionsClient({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) });
const dFlowEnt = require('./helpers/update.js')
const strings = require('./static/strings.js')
const safeEval = require('safe-eval')
const { Client } = require('pg');
const pgp = require('pg-promise')({
  capSQL: true // capitalize all generated SQL
});

const cn = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
};

const db = pgp(cn);

// const pgClient = new Client({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false
//   }
// });

// pgClient.connect();
async function importDbBackup() {
  try {
    rows = await db.any('SELECT json FROM cache', [true]);
    DB_FIELDNAMES = ["MACHINES", "CHALLENGES", "TEAM_MEMBERS", "TEAM_MEMBERS_IGNORED", "TEAM_STATS", "DISCORD_LINKS"]
    MACHINES = rows[0].json
    CHALLENGES = rows[1].json
    TEAM_MEMBERS = rows[2].json
    TEAM_MEMBERS_IGNORED = rows[3].json
    TEAM_STATS = rows[4].json
    DISCORD_LINKS = rows[5].json
    console.log("IMPORT: Restored from DB backup.")
    return true
  }
  catch (e) {
    console.error(e)
    return false
  }
}

// async function exportDbBackup() {
//   //pgClient.connect();
//   const dataForUpdate = [
//     { id: 1, json: MACHINES },
//     { id: 2, json: CHALLENGES },
//     { id: 3, json: TEAM_MEMBERS },
//     { id: 4, json: TEAM_MEMBERS_IGNORED },
//     { id: 5, json: TEAM_STATS },
//     { id: 6, json: DISCORD_LINKS }
//   ];
//   const cs = new pgp.helpers.ColumnSet(['?id', { name: 'json', cast: 'json' }], { table: 'cache' });
//   const update = pgp.helpers.update(dataForUpdate, cs) + ' WHERE v.id = t.id';
//   await db.result(update)
//     .then(() => {
//       console.log("EXPORT: Updated database backup.")
//       return true
//     })
//     .catch(error => {
//       console.error(e)
//       return false
//     });
// }

async function updateCache(fields = DB_FIELDNAMES) {
  var fieldData = []
  for (let i = 0; i < fields.length; i++) {
    var fieldName = fields[i];
    switch (fieldName.toLowerCase()) {
      case "machines": fieldData.push({ id: 1, json: MACHINES }); break;
      case "challenges": fieldData.push({ id: 2, json: CHALLENGES }); break;
      case "team_members": fieldData.push({ id: 3, json: TEAM_MEMBERS }); break;
      case "team_members_ignored": fieldData.push({ id: 4, json: TEAM_MEMBERS_IGNORED }); break;
      case "team_stats": fieldData.push({ id: 5, json: TEAM_STATS }); break;
      case "discord_links": fieldData.push({ id: 6, json: DISCORD_LINKS }); break;
      default:
        break;
    }
  }
  const cs = new pgp.helpers.ColumnSet(['?id', { name: 'json', cast: 'json' }], { table: 'cache' });
  const update = pgp.helpers.update(fieldData, cs) + ' WHERE v.id = t.id';
  return await db.result(update)
    .then(() => {
      console.log("EXPORT: Updated database backup.")
      return true
    })
    .catch(error => {
      console.error(e)
      return false
    });
}


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

function realMax(a1, a2) {
  if (a1) {
    if (a2) {
      return max(a1, a2)
    } else {
      return a1
    }
  } else {
    if (a2) {
      return a2
    } else {
      return 0
    }
  }
}

function nth(n) { return ["st", "nd", "rd"][((n + 90) % 100 - 10) % 10 - 1] || "th" }

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


function timeSince(date) {
  var seconds = Math.floor((new Date() - date) / 1000);
  var interval = Math.floor(seconds / 31536000);
  if (interval > 1) {
    return interval + " years ago";
  }
  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return interval + " months ago";
  }
  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return interval + " days ago";
  }
  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return interval + " hours ago";
  }
  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return interval + " minutes ago";
  }
  return Math.floor(seconds) + " seconds ago";
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


var LAST_UPDATE = new Date()
var MACHINES = {}
var MACHINES_BUFFER
var CHALLENGES
var DISCORD_LINKS = {}
var TEAM_MEMBERS = {}
var TEAM_MEMBERS_IGNORED = {}
var MACHINE_STATS = { "totalBoxes": 0, "activeBoxes": 0, "retiredBoxes": 0, "unreleasedBoxes": 0 }
var TEAM_STATS = { "globalRanking": 5, "points": 0, "teamFounder": "7383", "topMembers": [0, 1, 2, 3], "name": "", "owns": { "users": 0, "roots": 0 }, "imgUrl": "" }

function ignoreMember(uid) {
  if (uid in TEAM_MEMBERS) {
    console.log(Object.keys(TEAM_MEMBERS).length)
    console.log(TEAM_MEMBERS_IGNORED)
    TEAM_MEMBERS_IGNORED[uid] = TEAM_MEMBERS[uid]
    delete TEAM_MEMBERS[uid]
    updateCache(["team_members","team_members_ignored"])
    // exportData(TEAM_MEMBERS, "team_members.json");
    // exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
    console.log(Object.keys(TEAM_MEMBERS).length)
    console.log(TEAM_MEMBERS_IGNORED)
    return TEAM_MEMBERS_IGNORED[uid].name
  } else {
    return false
  }
}

function unignoreMember(uid) {
  console.log("Unignoring member " + uid)
  if (uid in TEAM_MEMBERS_IGNORED) {
    console.log(Object.keys(TEAM_MEMBERS).length)
    console.log(TEAM_MEMBERS_IGNORED)
    TEAM_MEMBERS[uid] = TEAM_MEMBERS_IGNORED[uid]
    delete TEAM_MEMBERS_IGNORED[uid]
    updateCache(["team_members","team_members_ignored"])
    //exportData(TEAM_MEMBERS, "team_members.json");
    //exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
    console.log(Object.keys(TEAM_MEMBERS).length)
    console.log(TEAM_MEMBERS_IGNORED)
    updateTeamStats()
    return TEAM_MEMBERS[uid].name
  } else {
    return false
  }
}

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


function mdItemizeList(arr) {
  var out = []
  for (const [index, element] of arr.entries()) {
    if (index == 0) {
      out.push("` " + index.toString().padStart(2, '0') + " `⠀⟶⠀" + element + "⠀🔥")
    } else {
      out.push("` " + index.toString().padStart(2, '0') + " `⠀⟶⠀" + element)
    }
  }
  return out
}



async function updateTeamStats() {
  var teamMembersAll = { ...TEAM_MEMBERS, ...TEAM_MEMBERS_IGNORED }
  sortedByTPoints = Object.keys(teamMembersAll).sort(function (a, b) { return teamMembersAll[b].points - teamMembersAll[a].points })
  top25 = sortedByTPoints.slice(0, 25)
  TEAM_STATS.topMembers = top25
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
    MACHINES = JSON.parse(fs.readFileSync('cache/machines.json', 'utf8'));
    CHALLENGES = JSON.parse(fs.readFileSync('cache/challenges.json', 'utf8'));
    TEAM_MEMBERS = JSON.parse(fs.readFileSync('cache/team_members.json', 'utf8'));
    TEAM_MEMBERS_IGNORED = JSON.parse(fs.readFileSync('cache/team_members_ignored.json', 'utf8'));
    DISCORD_LINKS = JSON.parse(fs.readFileSync('cache/discord_links.json', 'utf8'));
    TEAM_STATS = JSON.parse(fs.readFileSync('cache/team_stats.json', 'utf8'));
    MACHINE_STATS = updateMachineStats()
    updateTeamStats()
    console.info("Imported existing datafiles! Will update automatically every half-hour.")
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

function exportData(object, filename) { // Save JSON files of team and machine data.
  var objectName = varObj => Object.keys(varObj)[0]
  //if (!isEmpty(object)) {
  fs.writeFile("cache/" + filename, JSON.stringify(object, null, "\t"), 'utf8', function (err) {
    if (err) {
      console.log("An error occured while writing " + objectName + " settings to File.");
      return console.log(err);
    }
    console.log("JSON file " + filename + " has been saved.");
  });
  //}
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

function getChallengeByName(name) { // Return machine object with name matching parameter string
  //console.log(name)
  if (name) {
    var challengeArray = Object.values(CHALLENGES)
    for (let i = 0; i < challengeArray.length; i++) {
      for (let j = 0; j < challengeArray[i].length; j++) {
        // console.log(machineArray[i] + JSON.stringify(machineArray[i]))
        if (challengeArray[i][j].name == name) {
          //console.log('Challenge name ' + name + ' matched validated name ' + challengeArray[i][j].name)
          return challengeArray[i][j]
        }
      }
    }
  }
  return null
}

function getMemberByName(name) { // Return machine object with name matching parameter string
  //console.log(name)
  if (name) {
    var memberArray = Object.values(TEAM_MEMBERS)
    for (let i = 0; i < memberArray.length; i++) {
      // console.log(machineArray[i] + JSON.stringify(machineArray[i]))
      if (memberArray[i].name.toLowerCase() == name.toLowerCase()) {
        console.log('Username ' + name + ' matched validated name ' + memberArray[i].name)
        return memberArray[i]
      }
    }
  }
  return null
}

function getOwnersByChallengeName(challengeName) {
  console.log("Getting owners by challenge name:", challengeName)
  if (challengeName) {
    return Array.from(getChallengeByName(challengeName).owners)
  } else {
    return null
  }
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


function getMdLinksForUids(memberIds) { // Get markdown link to a HTB user's profile, based on UID.
  console.log(memberIds)
  if (memberIds) {
    screenNames = []
    memberIds.forEach(uid => {
      //console.log("UID: " + uid)
      if (uid in TEAM_MEMBERS) {
        screenNames.push('[' + (uid in DISCORD_LINKS ? (DISCORD_LINKS[uid].username != TEAM_MEMBERS[uid].name ? TEAM_MEMBERS[uid].name + " (@" + DISCORD_LINKS[uid].username + ")" : TEAM_MEMBERS[uid].name) : TEAM_MEMBERS[uid].name) + ']' + '(' + 'https://www.hackthebox.eu/home/users/profile/' + uid + ' ' + "'Hack The Box Profile for " + TEAM_MEMBERS[uid].name + (uid in DISCORD_LINKS ? " / @" + DISCORD_LINKS[uid].tag : "") + '\')')
      } else {
        console.log("UID opted out of data collection.")
        screenNames.push('[٩(͡๏̯͡๏)۶](https://www.hackthebox.eu/ \'This user has disabled data collection by Seven.\')')
      }
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


function getMdLinksForMemberIds(memberIds) { // Get markdown link to a HTB user's profile, based on UID.
  console.log(memberIds)
  if (memberIds) {
    screenNames = []
    memberIds.forEach(member => {
      if (member.uid in TEAM_MEMBERS) {
        if (member.uid in DISCORD_LINKS) {
          console.log(JSON.stringify(DISCORD_LINKS[member.uid].username) + " " + TEAM_MEMBERS[member.uid].name)
        }
        screenNames.push('[' + (member.uid in DISCORD_LINKS ? (DISCORD_LINKS[member.uid].username != TEAM_MEMBERS[member.uid].name ? TEAM_MEMBERS[member.uid].name + " **(@" + DISCORD_LINKS[member.uid].username + ")**" : "**" + TEAM_MEMBERS[member.uid].name + "**") : TEAM_MEMBERS[member.uid].name) + ']' + '(' + 'https://www.hackthebox.eu/home/users/profile/' + member.uid + ' ' + "'Hack The Box Profile for " + TEAM_MEMBERS[member.uid].name + (member.uid in DISCORD_LINKS ? " / @" + DISCORD_LINKS[member.uid].tag : "") + '\')')
      } else {
        console.log("UID opted out of data collection.")
        screenNames.push('[٩(͡๏̯͡๏)۶](https://www.hackthebox.eu/ \'This user has disabled data collection by Seven.\')')
      }
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

function parseSingleDate(date, ) { // Parse date to timestamp (millis) for various formats used on HTB site, based on length
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
        try {
          return new Date(parseDate(date, 'MMMM do, yyyy', new Date(0)).setUTCHours(19)).getTime()
        } catch (error) {
          console.log(error)
          return 0
        }
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

async function getChallenges(session) {
  challengeBuffer = {}
  var categories = ["Reversing", "Crypto", "Stego", "Pwn", "Web", "Misc", "Forensics", "Mobile", "OSINT"]
  return new Promise(async resolve => {
    for (let i = 0; i < categories.length; i++) {
      category = categories[i]
      response = await getChallengesCategory(category, session)
      var thisCategoryChallenges = []
      var $ = require('jquery')(new JSDOM(response.body).window);

      $('.panel-heading').each(function () {
        var description = this.nextSibling.nextSibling.firstChild.nextSibling.nextSibling.nextSibling.nextSibling.data.trim()
        var points = 0
        var isActive = false
        //console.log(description)
        var dateString = $($(this).children('.panel-tools')[0]).text().trim()
        var releaseDate = new Date(parseDate(dateString, 'dd/MM/yyyy', new Date(0)).setUTCHours(19)).getTime()
        var spans = $(this).children('span')
        var activeChecker = $(spans[0]).text().trim()
        //console.log(activeChecker.trim())
        if (activeChecker.trim().startsWith("[")) {
          isActive = true
          //console.log(spans.html())
          points = Number($(spans[0]).html().match(/[\d]*(\d+)/g)[0])

        } else {
          // console.log("Not Active.")
          // console.log(spans[0].innerText)
        }
        var makers = $(this).find("a[href^='https://www.hackthebox.eu/home/users/profile/']")
        maker = { "id": makers[0].href.substring(45), "name": makers[0].innerHTML }
        var maker2 = null
        try {
          maker2 = { "id": makers[1].href.substring(45), "name": makers[1].innerHTML }
        } catch (error) {
          //console.log('\nNo 2nd maker ...')
        }
        var tex = $(this).text()
        //console.log("TEX",tex)
        var title = tex.substring(tex.indexOf((isActive ? '] ' : '     ')) + 1, tex.indexOf('[by') - 1).trim()
        var solverCount = Number($(spans[1]).text().match(/[\d]*(\d+)/g))
        var ratePro = Number($(spans[2]).text())
        var rateSucks = Number($(spans[3]).text())
        // console.log("GOT CHALLENGE. Datestring:", dateString, "|", "title:", title, "| maker:", maker.name, "| maker2:", (maker2 ? maker2.name : "None"), "| points:", points, "| active:", isActive, "| solvercount:", solverCount, "| ratings:", ratePro, rateSucks * -1)
        console.log("Got challenge", title + "...")
        var thisChallenge = new HtbChallenge(title, category, releaseDate, description, isActive, points, maker, maker2, solverCount, ratePro, rateSucks)
        thisCategoryChallenges.push(thisChallenge)
        if (!getChallengeByName(thisChallenge.name)) {
          dFlowEnt.updateEntity('challenge', thisChallenge.name)
        }
      })
      challengeBuffer[category] = thisCategoryChallenges
    };
    resolve(challengeBuffer)
  })
}

function getTeamData(session) {
  return new Promise(resolve => {
    session.request('/home/teams/profile/2102', function (error, response, body) {
      teamData = {}
      teamUsers = {}
      var $ = require('jquery')(new JSDOM(body).window);
      // Parse Team Stats
      try {
        var teamName = $('.row-selected').children()[1].innerHTML
        var imgUrl = $($('.header-icon').find('.image-lg')[0]).attr('data-cfsrc')
        var globalRanking = Number($('.row-selected').children()[0].innerHTML)
        var totalPoints = Number($('.row-selected').children()[2].innerHTML)
        var totalRoots = Number($('.row-selected').children()[3].innerHTML)
        var totalUsers = Number($('.row-selected').children()[4].innerHTML)
        TEAM_STATS.name = teamName
        TEAM_STATS.imgUrl = imgUrl // Not working. Needs fixing
        console.log(imgUrl)
        TEAM_STATS.globalRanking = globalRanking
        TEAM_STATS.points = totalPoints
        TEAM_STATS.owns.roots = totalRoots
        TEAM_STATS.owns.users = totalUsers

      } catch (error) {
        console.error('ERROR: Could not parse team Data. Failing gracefully...')
      }

      // Parse Team Members
      var jq = $($('#membersTable').children()[1]).children().each(function () {
        var stats = $(this).children()
        var siterank = 99999999;
        userpoints = 0;
        if (stats[0].innerHTML && stats[0].innerHTML != 'unranked') {
          siterank = Number(stats[0].innerHTML)
          userpoints = Number(stats[2].innerHTML)
        }
        var userCol = $(stats[1]).children()[0]
        var uName = userCol.innerHTML
        var uid = userCol.href.substring(45)
        user = new TeamMember(uName, uid, { 'user': Number(stats[4].innerHTML), "root": Number(stats[3].innerHTML) }, siterank, userpoints)
        if (!(uid in TEAM_MEMBERS_IGNORED)) {
          teamUsers[uid] = user
        }
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

function getChallengesCategory(category, session) {
  //console.log('getting user profile #' + id)
  return session.requestAsync('/home/challenges/' + category)
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

function uidToUname(uid) {
  console.log("uidToUname(uid):", uid)
  try {
    if (uid in TEAM_MEMBERS) {
      return TEAM_MEMBERS[uid].name
    } else return null
  } catch (error) {
    console.error(error)
    return null
  }
}

function unameToUid(username) {
  id = 0
  Object.values(TEAM_MEMBERS).forEach(member => {
    //console.log(member.name)
    if (member.name.toLowerCase() == username.toLowerCase()) {
      id = member.id
    }
  });
  return id
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
      dFlowEnt.updateEntity('Machines', unreleasedBox.mname)
      resolve(unreleasedBox)
    } else {
      resolve(null)
    }
  })
}
async function updateData() {
  SESSION = await getSession()
  console.log("Got a logged in session.")
  MACHINES_BUFFER = await getMachines()
  CHALLENGES = await getChallenges(SESSION)
  TEAM_MEMBERS_TEMP = await getTeamData(SESSION)
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
  updateCacheSuccessful = await updateCache()
  console.log(updateCacheSuccessful ? "All data backed up to the cloud for a rainy day..." : "Export failed...")
  // exportData(MACHINES, "machines.json")
  // exportData(CHALLENGES, "challenges.json")
  // exportData(TEAM_MEMBERS, "team_members.json");
  // exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
  // exportData(DISCORD_LINKS, "discord_links.json")
  // exportData(TEAM_STATS, "team_stats.json")
  LAST_UPDATE = new Date()
}


async function parseUserOwns(body, id) {
  return new Promise(resolve => {
    //console.log("Parsing owns for uid: " + uid)
    try {
      var $ = require('jquery')(new JSDOM(body).window);
      imgPath = $($('.header-icon').find('.image-lg')[0]).attr('data-cfsrc')
      rank = $($('.header-title')[0]).find('.c-white').text()
      joinDate = parseSingleDate($('div[title^="Joined on"]').attr("title").substring(10))
      //console.log($('div[title^="Joined on"]').attr("title").substring(10))
      //console.log(joinDate)
      try {
        TEAM_MEMBERS[id].imageUrl = imgPath
        TEAM_MEMBERS[id].rank = rank
        TEAM_MEMBERS[id].joinDate = joinDate
        // console.log(TEAM_MEMBERS[uid])
      } catch (error) {
        console.error(error)
      }
      try {
        charts = $('script:contains("var globalOptions = {")').html()
        var chartData = safeEval(charts.substring(charts.indexOf("var lineData = ") + 15, charts.indexOf(";", charts.indexOf("var lineData = ")))).datasets
        var chart = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
        chart.users = realMax(chartData[0].data.slice(-1)[0], 0) // user owns
        chart.roots = realMax(chartData[1].data.slice(-1)[0], 0)// root owns
        chart.challenges = realMax(chartData[2].data.slice(-1)[0], 0)// challenge owns
        chart.respects = realMax(chartData[3].data.slice(-1)[0], 0)// respects
        chart.bloods = realMax(chartData[4].data.slice(-1)[0], 0)// bloods
        if (chart.users || chart.roots || chart.challenges || chart.respects || chart.bloods) {
          TEAM_MEMBERS[id].stats = chart
        } else {
          TEAM_MEMBERS[id].stats = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
        }
        console.log("Parsing owns for " + TEAM_MEMBERS[id].name + "...")
        // console.log(TEAM_MEMBERS[id].stats)

      } catch (error) {
        console.log(error)
      }

      $('.p-xs').each(function () {
        // console.log('jquery')
        var t = $($(this).children()[1]).text().trim().split(/\s+/);
        var parsedTime = $($(this).children('span.pull-right')[0]).attr('title')
        var timestamp = parseDate(parsedTime, 'MMMM do, yyyy h:mm a', new Date()).getTime() / 1000
        var machineId = ''
        // console.log($(this).children('[href*="/machines/"]'))
        var machineLitmus = $(this).find('[href*="/machines/"]')
        if (machineLitmus.length > 0) { machineId = machineLitmus[0].href.substring(48) }
        //console.log('T[]: '+ t)
        if (t[2].includes('user')) {
          // console.log('USER MACHINE:' + t[2] + '@' + t[3])
          MACHINES_BUFFER[machineId].userOwners.push({ "uid": id, "timestamp": timestamp })
        } else if (t[2].includes('challenge')) {
          if ($(this).find('i.far.fa-cog.text-warning').length) {
            var challengeName = $(this).find('i.far.fa-cog.text-warning')[0].nextSibling.data.trim()
            //console.log("Challenge: ",challengeName)
            //console.log(getChallengeByName(challengeName).owners)
            getChallengeByName(challengeName).owners.push({ "uid": id, "timestamp": timestamp })
            //console.log(getChallengeByName(challengeName).owners)

          } else {
            //console.log("not a challenge...")
          }
          // console.log($($(this).children()[1]).text().trim())
        } else if (t[2].includes('root')) {
          //console.log('ROOT MACHINE:' + t[6] + '@' + t[3])
          //console.log(MACHINES[machineId].rootOwners)
          MACHINES_BUFFER[machineId].rootOwners.push({ "uid": id, "timestamp": timestamp })
          //console.log(MACHINES[machineId].rootOwners)

          //MACHINES.add
        } else { /*console.log('Challenge, not parsing...')*/ }
      })
    } catch (error) {
      //console.log(error + " - Could not parse page. (Likely user has no rank / XP)")
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

    Object.values(CHALLENGES).forEach(category => {
      category.forEach(challenge => {
        challenge.owners = [...new Map(challenge.owners.map(item => [item.uid, item])).values()]
        challenge.owners.sort((a, b) => (a.timestamp < b.timestamp) ? 1 : (a.timestamp === b.timestamp) ? ((a.uid < b.uid) ? 1 : -1) : -1)
      })
    });
    resolve('done')
  })
}

class TeamMember {
  constructor(name, id, owns, siterank, points) {
    this.siterank = siterank
    this.points = points
    this.name = name;
    this.id = id;
    this.totalOwns = owns
    this.imageUrl = false
    this.rank = "Noob"
    this.joinDate = 0
    this.stats = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
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

class HtbChallenge {
  constructor(name, category, date, description, isActive, points, maker, maker2, solverCount, upvotes, downvotes) {
    this.name = name
    this.category = category
    this.releaseDate = date
    this.description = description
    this.isActive = isActive
    this.points = points
    this.maker = maker
    this.maker2 = maker2
    this.solverCount = solverCount
    this.upvotes = upvotes
    this.downvotes = downvotes
    this.owners = []
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

importDbBackup()
updateData();






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
          footer: {
            text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
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
          footer: {
            text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
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
        footer: {
          text: "ℹ️  Data last updated " + timeSince(LAST_UPDATE)
        },
        description: ('**Last owned by: ** ' + lastOwner + ' :woman_detective:').substring(0, 2040)
      }
    }
    )
  } else {
    message.channel.send((getMachineByName(machineName) ? 'Looks like nobody in the team has done this box yet :tired_face:' : 'Not a box... hmm.'))
  }
}


function constructChallengeOwnersMessage(message, challengeName) {
  if (!challengeName) {
    challengeName == ""
  } else { console.log("Challenge name: " + challengeName) }
  var twentyPlus = false
  var challenge = getChallengeByName(challengeName)
  console.log("Constructing a challenge owner info message for " + challengeName + "...")
  var ownerList = getMdLinksForMemberIds(getOwnersByChallengeName(challengeName))
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
            name: challenge.name,
            icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/24/cogs.png",
            url: 'https://www.hackthebox.eu/home/challenges/' + challenge.category,
          },
          footer: {
            text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
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
            name: challenge.name,
            icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/24/cogs.png",
            url: 'https://www.hackthebox.eu/home/challenges/' + challenge.category,
          },
          footer: {
            text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
          },
          description: ('**Most recent team owns:** ' + andifyList(ownerList.join(', ')) + (twentyPlus ? ' […]' : '') + ' :woman_detective:').substring(0, 2040)
        }
      })
    }
  } else {
    message.channel.send((challenge ? 'Looks like nobody in the team has done this challenge yet :tired_face:' : 'That challenge doesn\'t even exist! Trying to trick me … silly Hu-man. :wheelchair:\nAccording to Wikipedia, u can\'t fool me... :woman_mage: '))
  }
}

function constructLastChallengeOwnerMessage(message, challengeName) {
  if (!challengeName) {
    challengeName == ""
  } else { console.log("Challenge name: " + challengeName) }
  var challenge = getChallengeByName(challengeName)
  var ownerList = getMdLinksForMemberIds(getOwnersByChallengeName(challengeName))
  if (ownerList) {
    console.log(ownerList)
    lastOwner = ownerList[0]
    console.log(lastOwner)
    message.channel.send({
      embed: {
        color: 16580705,
        author: {
          name: challenge.name,
          icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/24/cogs.png",
          url: 'https://www.hackthebox.eu/home/challenges/' + challenge.category,
        },
        footer: {
          text: "ℹ️  Challenge data last updated " + timeSince(LAST_UPDATE)
        },
        description: ('**Most recently completed by: ** ' + lastOwner + ' 🧙').substring(0, 2040)
      }
    }
    )
  } else {
    message.channel.send((challenge.name ? 'Looks like nobody in the team has done this challenge yet :tired_face:' : 'Not a challenge... hmm.'))
  }
}



async function sendTeamRankingMsg(message, note) {

  message.channel.send({
    embed: {
      title: "🌍⠀Team Global Rank",
      color: 3447003,
      author: {
        icon_url: TEAM_STATS.imgUrl,
        url: 'https://www.hackthebox.eu/home/teams/profile/2102',
      },
      footer: {
        text: "ℹ️  Accurate as of " + timeSince(LAST_UPDATE)
      },
      description: "Global Rank: **[# " + TEAM_STATS.globalRanking + "](http://0)**"
    }
  })

  if (Math.random() > 0.5) {
    await humanSend(message, note, true)
    console.log("NOTE: " + note)
  }

}

async function sendTeamLeadersMsg(message, note) {

  leaderList = mdItemizeList(getMdLinksForUids(TEAM_STATS.topMembers).slice(0, 10))

  if (note & Math.random() > 0.5) {
    console.log("NOTE: " + note)
    await humanSend(message, note, true)
  }
  message.channel.send({
    embed: {
      title: ":bar_chart:⠀Team Leaderboard",
      color: "AQUA",
      author: {
        icon_url: TEAM_MEMBERS[TEAM_STATS.teamFounder].imageUrl,
        url: 'https://www.hackthebox.eu/home/teams/profile/2102',
      },
      footer: {
        text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
      },
      description: ("**" + leaderList.join("**\n**") + "**").substring(0, 2040)
    }
  })
}

async function sendTeamInfoMsg(message, note) {
  console.log(TEAM_STATS.imgUrl)
  leaderList = getMdLinksForUids(TEAM_STATS.topMembers)

  message.channel.send({
    embed: {
      color: 15844367,
      title: TEAM_STATS.name,
      author: {
        name: "Group by " + TEAM_MEMBERS[TEAM_STATS.teamFounder].name,
        icon_url: TEAM_MEMBERS[TEAM_STATS.teamFounder].imageUrl,
        url: 'https://www.hackthebox.eu/home/users/profile/7383',
      },
      "footer": {
        //"icon_url": "https://cdn.discordapp.com/embed/avatars/0.png",
        "text": "ℹ️  Team info last updated " + timeSince(LAST_UPDATE)
      },
      thumbnail: {
        url: TEAM_STATS.imgUrl,
      },
      description: (":flag_nl:⠀Hacking for the fun of it! Learning it as a bonus").substring(0, 2040),
      image: {
        url: 'https://www.hackthebox.eu/badge/team/image/2102',
      },
      fields: [
        {
          name: 'R4NK1ng', inline: true,
          value: "Global: **[# " + TEAM_STATS.globalRanking + "](http://0)**"
        },
        {
          name: 'P01NTz', inline: true,
          value: "**[" + TEAM_STATS.points + "](http://0)**"
        },
        {
          name: '0Wn4g3', inline: true,
          value: "Roots:** [" + TEAM_STATS.owns.roots + "](http://0)\n**Users:** [" + TEAM_STATS.owns.users + "](http://0)**"
        },
        {
          name: 'L34d3Rbo4rd', inline: true,
          value: "**" + leaderList.slice(0, 5).join("**\n**") + "**"
        },
        {
          name: '...', inline: true,
          value: "**" + leaderList.slice(5, 10).join("**\n**") + "**"
        },
        {
          name: '...', inline: true,
          value: "**" + leaderList.slice(10, 15).join("**\n**") + "**"
        },
      ]
    }
  })

  if (note & Math.random() > 0.5) {
    console.log("NOTE: " + note)
    await humanSend(message, note, true)
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
        footer: {
          text: "ℹ️  Machines last updated " + timeSince(LAST_UPDATE)
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

function constructMemberInfoMessage(message, memberName) {
  if (!memberName) {
    memberName == ""
  } else { console.log("challengeName: " + memberName) }
  var member = getMemberByName(memberName)
  if (member) {
    message.channel.send({
      embed: {
        color: 3066993,
        author: {
          name: member.name,
          icon_url: TEAM_STATS.imgUrl,
          url: 'https://www.hackthebox.eu/home/users/profile/' + member.id,
        },
        description: "**[" + member.rank + "](http://0)** | Member of Hack The Box since __" + formatRelative(new Date(member.joinDate), new Date()) + "__.",
        thumbnail: {
          url: member.imageUrl,
        },
        footer: {
          text: "ℹ️  Achievements last updated " + timeSince(LAST_UPDATE)
        },
        fields: [
          {
            name: '` ' + FMT(rankSymbol(member.rank) + ' Site Rank : ', 's') + FMT((member.siterank == 99999999 ? "Unranked" : member.siterank + nth(member.siterank)), 'bs') + '     `', inline: false,
            value: '```diff\n'
              + '+ 🧡 𝖱𝖾𝗌𝗉𝖾𝖼𝗍    : ' + member.stats.respects + '\n'
              + '+ 👨‍💻 𝖱𝗈𝗈𝗍𝗌      : ' + member.stats.roots + '\n'
              + '  💻 𝖴𝗌𝖾𝗋𝗌      : ' + member.stats.users + '\n'
              + '  ⚙️ 𝖢𝗁𝖺𝗅𝗅𝖾𝗇𝗀𝖾𝗌  : ' + member.stats.challenges + '\n'
              + '- 🔴 𝟣𝗌𝗍 𝖡𝗅𝗈𝗈𝖽𝗌  : ' + member.stats.bloods + '\n'
              // + (challenge.unreleased ? FMT('- Replaces : ') + challenge.unreleased.replaces : '')
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

function constructChallengeInfoMessage(message, challengeName) {
  if (!challengeName) {
    challengeName == ""
  } else { console.log("challengeName: " + challengeName) }
  var challenge = getChallengeByName(challengeName)
  difficulty = challengeDifficulty(challenge)
  if (challenge) {
    message.channel.send({
      embed: {
        color: 3066993,
        author: {
          name: challenge.name,
          // icon_url: getChallengeImage(challenge.category),
          icon_url: "",
          url: 'https://www.hackthebox.eu/home/challenges/' + challenge.category,
        },
        description: ("AEIOU".includes(challenge.category.toUpperCase().charAt(0)) ? 'An ' : 'A ') +
          challenge.category.toLowerCase() + ' challenge by **['
          + challenge.maker.name
          + '](https://www.hackthebox.eu/home/users/profile/'
          + challenge.maker.id.toString()
          + ')'
          + (challenge.maker2 ? '** & **[' + challenge.maker2.name + '](https://www.hackthebox.eu/home/users/profile/' + challenge.maker2.id.toString() + ')' : '')
          + '**.\n> _' + challenge.description + '_\n'  /*
          + '\n```diff\n'
          + '× Status   : ' + (box.retired ? '♻ Retired' : '⛯ Active') + '\n'
          + '+ Points   : ' + box.points + '\n'
          + '+ Released : ' + new Date(box.release).toDateString() + '\n'
          + '+ Rating   : ' + ratingString(box.rating) + '\n'
          + '+ Age      : ' + elapsedDays(new Date(box.release)) + ' days\n'
          + (box.retired ? '- Retired  : ' + (new Date(box.retiredate).toDateString()) : '')
          + '\n```' */,
        thumbnail: {
          url: "",
        },
        footer: {
          text: "ℹ️  Challenges last updated " + timeSince(LAST_UPDATE)
        },
        fields: [
          {
            name: '` ' + FMT('  ' + difficultySymbol(difficulty) + ' ', 's') + FMT(difficulty, 'bs') + '     `', inline: false,
            value: '```diff\n'
              + FMT((!challenge.isActive ? '- Status   : ' : '  Status   : '), 's') + (!challenge.isActive ? '🧟 Retired' : (challenge.releaseDate > (new Date()).getTime() ? '🔥 𝗨𝗡𝗥𝗘𝗟𝗘𝗔𝗦𝗘𝗗' : '👾 Active')) + '\n'
              + '+' + FMT(' Points   : ', 's') + challenge.points + '\n'
              + '+' + FMT(' Solved   : ', 's') + challenge.solverCount + ' times.\n'
              + '+' + FMT(' Released : ', 's') + new Date(challenge.releaseDate).toDateString() + '\n'
              + '+' + FMT(' Rating   : ', 's') + '🍏: ' + challenge.upvotes + ' 🍎: ' + challenge.downvotes + '\n'
              + '+' + FMT(' Age     : ', 's') + elapsedDays(new Date(challenge.releaseDate)) + ' days\n'
              // + (challenge.unreleased ? FMT('- Replaces : ') + challenge.unreleased.replaces : '')
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

function challengeDifficulty(challenge) {
  var p = challenge.points
  if (p <= 25) {
    return "Easy"
  } else if (p <= 50) {
    return "Medium"
  } else if (p <= 75) {
    return "Hard"
  } else {
    return "Insane"
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

function rankSymbol(rankText) {
  switch (rankText) {
    case "Noob": return "👽"
    case "Script Kiddie": return "🐍";
    case "Hacker": return "🤖";
    case "Pro Hacker": return "👩‍💻";
    case "Elite Hacker": return "👾";
    case "Guru": return "🔮";
    case "Omniscient": return "🧙";
    case "Admin": return "🤺";
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
  var sessionPath = dflow.sessionPath(process.env.GOOGLE_CLOUD_PROJECT, message.author.id);
  var sessionId = message.author.id
  console.log("Sending message to DialogFlow for comprehension. Session ID:", sessionPath)
  return new Promise(async resolve => {
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          // The query to send to the dialogflow agent
          text: message.content,
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

var KEYSTROKE = 7
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
      //console.log(ln)
      if (Math.random() < 0.1) { // random chance we'll try to generate a typo
        var typoData = nlp.typo(ln)
        if (typoData) {
          console.log(typoData)
          message.channel.startTyping()
          await wait(Math.min(ln.length * ((Math.random() * 50) + KEYSTROKE), 600))
          await message.reply(ln.replace(typoData[0], typoData[1]))
          message.channel.stopTyping()
          await wait(150)
          message.channel.startTyping()
          await wait(150)
          await wait(200 + (Math.min(typoData[0].length * KEYSTROKE), 600))
          if (firstline) {
            await message.reply((Math.random() > 0.5 ? "*" : "") + typoData[0]);
          } else {
            await message.channel.send((Math.random() > 0.5 ? "*" : "") + typoData[0]);
          }


        } else {
          message.channel.startTyping()
          await wait(Math.min(500 + (ln.length * KEYSTROKE), 800))
          if (firstline) {
            await message.reply(ln)
          } else {
            await message.channel.send(ln)
          }
          message.channel.stopTyping()
        }
      } else {
        await wait(Math.min(500 + (ln.length * ((Math.random() * 50) + KEYSTROKE)), 800))
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
    (MACHINE_STATS.unreleasedBoxes > 0 ? MACHINE_STATS.unreleasedBoxes + " unreleased, " : "") +
    MACHINE_STATS.activeBoxes + " active, " + MACHINE_STATS.retiredBoxes + " retired.__)"
  if (note) {
    console.log("NOTE: " + note)
    await humanSend(message, note, true)
  }
  await humanSend(message, msg)
}

async function sendHelpMsg(message, note) {
  if (note) {
    console.log("NOTE: " + note)
    await humanSend(message, note, true)
  }
  await wait(300)
  await message.channel.send(strings.manual)
}

async function sendActiveBoxCountMsg(message, note) {
  msg = "There are " + MACHINE_STATS.activeBoxes + (Math.random() > 0.5 ? " non-retired " : " active ") + "machines."
  if (note) {
    console.log("NOTE: " + note)
    await humanSend(message, note, true)
  }
  await humanSend(message, msg)
}

async function sendRetiredBoxCountMsg(message, note) {
  msg = "There are " + MACHINE_STATS.retiredBoxes + (Math.random() > 0.5 ? " retired " : " inactive ") + "machines."
  if (note) {
    console.log("NOTE: " + note)
    await humanSend(message, note, true)
  }
  await humanSend(message, msg)
}

async function linkDiscord(message, idType, id) {
  switch (idType) {
    case "uid":
      try {
        DISCORD_LINKS[id] = message.author
        await humanSend(message, "Associated HTB user " + uidToUname(id) + " (" + id + ") to your Discord account (" + message.author.tag + ")", true)
        updateCache(["discord_links"])
        //exportData(DISCORD_LINKS, "discord_links.json")
      } catch (error) { console.log(error) }
      break;

    case "uname": try {
      console.log("ID:", id)
      DISCORD_LINKS[unameToUid(id)] = message.author
      await humanSend(message, "Associated HTB user " + uidToUname(unameToUid(id)) + " (" + unameToUid(id) + ") to your Discord account (" + message.author.tag + ")", true)
      updateCache(["discord_links"])
      // exportData(DISCORD_LINKS, "discord_links.json")
    } catch (error) { console.log(error) }
      break;
    default:
      break;
  }

}

async function unlinkDiscord(message, id) {
  if (id in DISCORD_LINKS) {
    try {
      console.log(typeof id, id)
      delete DISCORD_LINKS[id]
      await humanSend(message, "[Discord Unlink] Dissociated HTB user " + uidToUname(id) + " (" + id + ") from Discord account (" + message.author.tag + ")", true)
      updateCache(["discord_links"])
      // exportData(DISCORD_LINKS, "discord_links.json")
      return true
    } catch (error) {
      await humanSend(message, "[Discord Unlink] There was an issue dissociating '" + uidToUname(id) + "' (" + id + ") from Discord account (" + message.author.tag + "). \nMaybe the id is wrong, or perhaps I wasn't tracking that in the first place.", true)
      console.log(error)
      return true
    }
  } else {
    await humanSend(message, "[Discord Unlink] It looks like no Discord association exists for this user (make sure the ID is correct).\nNo changes were made.", true)
    return false
  }

}


async function forgetHtbDataFlow(message, identifier, uid) {
  switch (identifier) {
    case "htb":
      try {
        deletedUname = ignoreMember(uid)
        if (deletedUname) {
          await humanSend(message, "Blacklisted user " + uid + " (" + deletedUname + ") from future scans.", true)
        } else {
          await humanSend(message, "It looks like no HTB user data is actually being collected for this user (make sure the ID is correct).", true)
        }
      } catch (error) { console.log(error) }
      ; break;
    case "discord":
      unlinkDiscord(message, uid)
      break;
    case "all":
      try {
        ignoreMember(uid)
      } catch (error) {
        console.error(error)
      }
      unlinkDiscord(message, uid)
      await humanSend(message, "Forgetting any HTB data and Discord association for this user and ignoring future achievements.", true); break;
    default:
      break;
  }

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
      result = await understand(message)
      isRipe = result.allRequiredParamsPresent
      console.log('result.intent: ' + result.intent.displayName + "  |  isRipe(hasParams): " + isRipe)
      if (result.intent && isRipe) {
        var job = result.intent.displayName
        var inf = result.parameters.fields
        console.log('jobinf: ' + job + ' | ' + JSON.stringify(inf))
        message.channel.startTyping()
        switch (job) {
          // case "removeLastXMessages": break;
          case "help": try { sendHelpMsg(message, result.fulfillmentText) } catch (e) { console.log(e) };; break;
          case "forgetMe.htbIgnore.getUserID": try { forgetHtbDataFlow(message, "htb", inf.uid.numberValue) } catch (e) { console.log(e) }; break;
          case "forgetMe.discordUnlink.getUserID": try { forgetHtbDataFlow(message, "discord", inf.uid.numberValue) } catch (e) { console.log(e) }; break;
          case "forgetMe.all.getUserID": try { forgetHtbDataFlow(message, "all", inf.uid.numberValue) } catch (e) { console.log(e) }; break;
          case "linkDiscord": try { linkDiscord(message, ("numberValue" in Object.keys(inf.uid) ? "uid" : "uname"), ("numberValue" in Object.keys(inf.uid) ? inf.uid.numberValue : inf.username.stringValue)) } catch (e) { console.log(e) }; break;
          case "unforgetMe": try { unignoreMember(inf.uid.numberValue); humanSend(message, result.fulfillmentText, true) } catch (e) { console.log(e) }; break;
          case "getTeamInfo": try { sendTeamInfoMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getTeamLeaders": try { sendTeamLeadersMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getTeamRanking": try { sendTeamRankingMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getBoxInfo": try { constructBoxInfoMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getBoxOwners": try { constructBoxOwnersMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getLastBoxOwner": try { constructLastBoxOwnerMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getBoxLaunchDate": try { constructBoxInfoMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getBoxRetireDate": try { constructBoxInfoMessage(message, inf.machines.stringValue) } catch (e) { console.log(e) }; break;
          case "getTotalBoxCount": try { sendTotalBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getActiveBoxCount": try { sendActiveBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getRetiredBoxCount": try { sendRetiredBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) }; break;
          case "getFirstBox": try { constructBoxInfoMessage(message, "Lame") } catch (e) { console.log(e) };
          case "agent.doReboot": doFakeReboot(message, result.fulfillmentText); break;
          case "getNewBox": console.log("got here6.."); constructBoxInfoMessage(message, getNewReleaseName()); break;
          case "getChallengeInfo": try { constructChallengeInfoMessage(message, inf.challengeName.stringValue); } catch (e) { console.log(e) }; break;
          case "getChallengeOwners": try { constructChallengeOwnersMessage(message, inf.challengeName.stringValue); } catch (e) { console.log(e) }; break;
          case "getLastChallengeOwner": try { constructLastChallengeOwnerMessage(message, inf.challengeName.stringValue) } catch (e) { console.log(e) }; break;
          case "getMemberInfo": try { constructMemberInfoMessage(message, inf.username.stringValue); } catch (e) { message.channel.stopTyping(true); console.log(e) }; break;
          default:
            message.channel.stopTyping(true)
            if (result.fulfillmentText) {
              message.channel.startTyping()
              await humanSend(message, result.fulfillmentText)
              message.channel.stopTyping(true)
            }


        }
        message.channel.stopTyping(true)
      } else {
        if (result.fulfillmentText) {
          message.channel.startTyping()
          await humanSend(message, result.fulfillmentText)
        }
      }
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