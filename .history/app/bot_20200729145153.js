/**
 * @module Seven
 */

/*** STARTUP | DECIDE ENV VAR SOURCE ***/

if (process.env.HEROKU) {
	console.log("SEVEN-SERVER: Started at " + new Date().toLocaleTimeString() + " on Heroku. Using cloud-configured env vars")
} else {
	console.log("SEVEN-SERVER: Started at " + new Date().toLocaleTimeString() + " on dev machine. Scanning ./config/env for vars")
	require("dotenv").config({ path: "./config/.env" })
}

/*** HANDLE STANDARD IMPORTS ***/
require("./helpers/helpers.js")
const winston = require("winston")
const flagEmoji = require("country-flag-emoji")
const Discord = require("discord.js")
const client = new Discord.Client()
const { JSDOM } = require("jsdom")
const rp = require("request-promise")
const csrfLogin = require("./helpers/csrf-login/csrf-login-override")
const fs = require("fs")
const jp = require("jsonpath")
const typoify = require("./modules/nlp/typoify")
const parseDate = require("date-fns/parse")
const formatRelative = require("date-fns/formatRelative")
const { FMT, test } = require("./helpers/format")
const dialogflow = require("dialogflow").v2beta1
const dflow = new dialogflow.SessionsClient({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) })
const dFlowEnt = require("./helpers/dflow")
const strings = require("./static/strings")
const safeEval = require("safe-eval")
const { checkSelfName } = require("./helpers/nlp")
const { HtbMachine, HtbChallenge, TeamMember, HtbOwn, HtbMaker } = require("./helpers/classes")
const { HtbPusherEvent, HtbPusherSubscription } = require("./helpers/pusher-htb")
const pgp = require("pg-promise")({ capSQL: true })
const htbCharts = require("./modules/charts/index.js");
const CHART_RENDERER = htbCharts.newChartRenderer()



const log = winston.createLogger({
	transports: [
		new winston.transports.Console()
	]
})

/*** INIT GLOBAL VARIABLES ***/

var UPDATE_LOCK = false           // Simple way to prevent slow / lagging updates from clashing with new ones

var DISCORD_ANNOUNCE_CHAN = false // The Discord Channel object intended to recieve Pusher achievements.
var HTB_PUSHER_OWNS_SUBSCRIPTION = false         // The Pusher Client own channel subscription.
var CSRF_TOKEN = ""


/*** HANDLE DEVELOPMENT INSTANCE CASE ***/

var DEV_MODE_ON = false

if (process.env.IS_DEV_INSTANCE) {
	DEV_MODE_ON = true
	console.error("DEVELOPMENT MODE ON.\n  Only queries by the developer will be responded to by this instance.\n  (Avoids conflicts/ duplicate responses in production use)")
}


/* SETUP DB IMPORT TO RESTORE LAST GOOD STATE */
const cn = {
	connectionString: process.env.DATABASE_URL,
	ssl: (process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false } )
}

const DB_FIELDNAMES_AUTO = ["MACHINES", "CHALLENGES", "TEAM_MEMBERS", "TEAM_STATS"]
const db = pgp(cn)

/** Imports globals from the cloud backup (Objects stored as raw, singular JSON columns in DB)
 * @returns {Promise}
*/
async function importDbBackup() {
	return new Promise(async resolve => {
		try {
			var rows = await db.any("SELECT json FROM cache ORDER BY id ASC;", [true])
			MACHINES = JSON.parse(rows[0].json)
			CHALLENGES = JSON.parse(rows[1].json)
			TEAM_MEMBERS = JSON.parse(rows[2].json)
			TEAM_MEMBERS_IGNORED = JSON.parse(rows[3].json)
			TEAM_STATS = JSON.parse(rows[4].json)
			DISCORD_LINKS = JSON.parse(rows[5].json)
			if (TEAM_STATS == {}) {
				TEAM_STATS = { "globalRanking": 5, "points": 0, "teamFounder": 7383, "topMembers": [], "name": "", "owns": { "users": 0, "roots": 0 }, "thumb": "https://www.hackthebox.eu/storage/teams/8232e119d8f59aa83050a741631803a6.jpg" }
			}
			updateTeamStats()
			console.log("IMPORT: Restored from DB backup.")
			resolve()
		}
		catch (e) {
			console.error(e)
			resolve()
		}
	})
}


/** Updates the cloud backup, with options for selective update. 
 * @param {string[]} fields - The specific data types / buffers specified for the update operation, e.g. ["MACHINES","TEAM_MEMBERS"]
*/
async function updateCache(fields = DB_FIELDNAMES_AUTO) {
	var fieldData = []
	for (let i = 0; i < fields.length; i++) {
		var fieldName = fields[i]
		switch (fieldName.toLowerCase()) {
		case "machines": fieldData.push({ id: 1, json: MACHINES }); break
		case "challenges": fieldData.push({ id: 2, json: CHALLENGES }); break
		case "team_members": fieldData.push({ id: 3, json: TEAM_MEMBERS }); break
		case "team_members_ignored": fieldData.push({ id: 4, json: TEAM_MEMBERS_IGNORED }); break // These should only update manually
		case "team_stats": fieldData.push({ id: 5, json: TEAM_STATS }); break
		case "discord_links": fieldData.push({ id: 6, json: DISCORD_LINKS }); break               // These should only update manually
		default:
			break
		}
	}
	const cs = new pgp.helpers.ColumnSet(["?id", { name: "json", cast: "json" }], { table: "cache" })
	const update = pgp.helpers.update(fieldData, cs) + " WHERE v.id = t.id"
	return await db.result(update)
		.then(() => {
			console.log("EXPORT: Updated database backup.")
			return true
		})
		.catch(e => {
			console.error(e)
			return false
		})
}

function tryResolveEntityByName(name) {
	try {
		var result = {}
		result["member"] = getMemberByName(name)
		result["machine"] = getMachineByName(name)
		result["challenge"] = getChallengeByName(name)
		if (result["member"]) {
			return {type: "member", ent: result["member"]}
		} else if (result["machine"]) {
			return {type: "machine", ent: result["machine"]}
		} else if (result["challenge"]) {
			return {type: "challenge", ent: result["challenge"]}
		} else {
			return false
		}
	} catch (error) {
		console.error(error)
		return false
	}
}


/**
 * Arrow function to generate a random hexadecimal nonce so images always get re-downloaded in Discord client.
 * @param {*} size - The length of the desired hex nonce.
 */
const genRanHex = size => [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")

/**
 * Returns one of the items passed as parameters, at random. Ex. usage: any("Hi","Hello","Hey")
 */
function any() {
	return arguments[arguments.length * Math.random() | 0]
}

/**
 * Returns either true or false based on the provided probabilty value (a number between 0-1, where 1 => 100% true and 0 => 100% false).
 * @param {number} probability 
 * @returns boolean
 */
function maybe(probability) {
	if (Math.random() < probability) return true
	else return false
}

/**
 * Promise-based sleep function (blocks only the caller (async) function)
 * @param {number} ms - The time in milliseconds to sleep.
 */
async function wait(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

/**
 * Returns the larger of the two objects, or -- alternatively -- the more real of the two (if one is falsey).
 * Returns 0 if both are falsey.
 * @param {Object} a1 
 * @param {Object} a2 
 */
function realMax(a1, a2) {
	if (a1) {
		if (a2) {
			return Math.max(a1, a2)
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

/** Returns the appropriate ordinal suffix (does NOT concatenate) for a given number.
 * @param {number} n - The number to get the ordinal suffix for.
 */
function nth(n) { return ["st", "nd", "rd"][((n + 90) % 100 - 10) % 10 - 1] || "th" }

/**
 * Returns the number of days that have elapsed since the provided date.
 * @param {Date} date - The Date object to compare against.
 * @returns {number}
 */
function elapsedDays(date) {
	var thisTime = new Date()
	var diff = thisTime.getTime() - date.getTime()  // Get the time elapsed
	return Math.round(diff / (1000 * 60 * 60 * 24)) // ... As a positive number of days 
}

/**
 * Returns the appropriate OS thumbnail for a specified OS name.
 * @param {string} osName
 * @returns {string}
 */
function getOsImage(osName) {
	switch (osName) {
	case "Linux": return "https://i.ibb.co/mHXrhyC/linux.png"
	case "Windows": return "https://i.ibb.co/61JG09j/windark.png"
	case "Solaris": return "https://www.hackthebox.eu/images/solaris.png"
	case "FreeBSD": return "https://www.hackthebox.eu/images/freebsd.png"
	case "Android": return "https://www.hackthebox.eu/images/android.png"
	default:
		return "https://www.hackthebox.eu/images/favicon.png"
	}
}

/**
 * Returns a fuzzy time estimate for a given date, relative to the present, that some date occurred (e.g. "4 months ago").
 * @param {Date} date 
 */
function timeSince(date) {
	var seconds = Math.floor((new Date() - date) / 1000)
	var interval = Math.floor(seconds / 31536000)
	if (interval < 0) {
		return "just now"
	}
	if (interval > 1) {
		return interval + " years ago"
	}
	interval = Math.floor(seconds / 2592000)
	if (interval > 1) {
		return interval + " months ago"
	}
	interval = Math.floor(seconds / 86400)
	if (interval > 1) {
		return interval + " days ago"
	}
	interval = Math.floor(seconds / 3600)
	if (interval > 1) {
		return interval + " hours ago"
	}
	interval = Math.floor(seconds / 60)
	if (interval > 1) {
		return interval + " minutes ago"
	}
	return Math.floor(seconds) + " seconds ago"
}

/**
 * Formats a given number in Unicode bold characters, for emphasis.
 * @param {string} str - The number to style in bold text.
 */
function numS(str) {
	str = str.toString()
	console.log(str)
	var bold = "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵"
	var bDig = [...bold]
	var o = ""
	for (let i = 0; i < str.length; i++) {
		switch (str.charAt(i)) {
		case "0": o += bDig[0]; break
		case "1": o += bDig[1]; break
		case "2": o += bDig[2]; break
		case "3": o += bDig[3]; break
		case "4": o += bDig[4]; break
		case "5": o += bDig[5]; break
		case "6": o += bDig[6]; break
		case "7": o += bDig[7]; break
		case "8": o += bDig[8]; break
		case "9": o += bDig[9]; break
		default:
			o += str.charAt(i)
			break
		}
	}
	return o
}

/**
 * Calculates and returns the sub-integral symbol, used in 'ratingString' function
 * @param {number} num - the sub-integral value, between 0 - 1.
 */
function halfMoon(num) {
	var divd = num % 1
	var scale = Math.round(divd * 4)
	switch (scale) {
	case 0: return "🌑"
	case 1: return "🌘"
	case 2: return "🌗"
	case 3: return "🌖"
	case 4: return "🌕"
	default: return "🌝"
	}
}

/**
 * Converts a numeric rating (0.0 - 5.0) to a Unicode moon rating expression (e.g. '2.5' => 🌕🌕🌗🌑🌑)
 * @param {number} rating - The rating, a positive number from 0 - 5. 
 */
function ratingString(rating) {
	if (rating == 0) {
		return "Unrated"
	} else {
		return "🌕".repeat(Math.floor(rating)) + halfMoon(rating) + "🌑".repeat(Math.max((5 - Math.floor(rating)) - 1, 0))
	}
}

/**
 * Returns whether the provided Discord user has admin privileges.
 * @param {Discord.User} author 
 * @returns {boolean}
 */
function isAdmin(author) {
	return author.id == process.env.ADMIN_DISCORD_ID
}


/*** INITIALIZE HACKTHEBOX STATE VARIABLES ***/
const HTBROOT = "https://www.hackthebox.eu/"
var LAST_UPDATE = new Date()
var MACHINES = {}
var MACHINES_BUFFER
var CHALLENGES
var DISCORD_LINKS = {}
var TEAM_MEMBERS = {}
var TEAM_MEMBERS_IGNORED = {}
var MACHINE_STATS = { "totalBoxes": 0, "activeBoxes": 0, "retiredBoxes": 0, "unreleasedBoxes": 0 }
var TEAM_STATS = { "globalRanking": 5, "points": 0, "teamFounder": "7383", "topMembers": [], "name": "", "owns": { "users": 0, "roots": 0 }, "thumb": "" }

/**
 * Moves a member to the 'ignored' set, meaning that their data will not be updated
 * or shared by the bot until the user undoes this (see unignoreMember()).
 * @param {number} uid 
 */
function ignoreMember(uid) {
	if (uid in TEAM_MEMBERS) {
		console.log(Object.keys(TEAM_MEMBERS).length)
		console.log(TEAM_MEMBERS_IGNORED)
		TEAM_MEMBERS_IGNORED[uid] = TEAM_MEMBERS[uid]
		delete TEAM_MEMBERS[uid]
		updateCache(["team_members", "team_members_ignored"])
		// exportData(TEAM_MEMBERS, "team_members.json");
		// exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
		console.log(Object.keys(TEAM_MEMBERS).length)
		console.log(TEAM_MEMBERS_IGNORED)
		return TEAM_MEMBERS_IGNORED[uid].name
	} else {
		return false
	}
}

/**
 * Moves a member out of the 'ignored' set, meaning that their data will now be
 * updated and shared by the bot unless the user requests otherwise again (see ignoreMember()).
 * @param {number} uid
 * @returns {(string|false)} 
 */
function unignoreMember(uid) {
	console.log("Unignoring member " + uid)
	if (uid in TEAM_MEMBERS_IGNORED) {
		console.log(Object.keys(TEAM_MEMBERS).length)
		console.log(TEAM_MEMBERS_IGNORED)
		TEAM_MEMBERS[uid] = TEAM_MEMBERS_IGNORED[uid]
		delete TEAM_MEMBERS_IGNORED[uid]
		updateCache(["team_members", "team_members_ignored"])
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



/**
 * Calculates the total machine count and the subcounts of active, retired and unreleased machines.
 * @returns {Object}
 */
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
	})
	return statBuffer
}

/**
 * Returns a Discord Markdown formatted list of member rankings.
 * @param {string[]} arr - A list of hyperlinked member names sorted by rank (descending) where index 0 is the highest ranking member.
 * @returns {string[]}
 */
function mdItemizeList(arr) {
	var out = []
	for (const [index, element] of arr.entries()) {
		if (index == 0) {
			out.push("` " + index.toString().padStart(2, "0") + " `⠀⟶⠀" + element + "⠀🔥")
		} else {
			out.push("` " + index.toString().padStart(2, "0") + " `⠀⟶⠀" + element)
		}
	}
	return out
}

/**
 * Returns a pretty emoji flag for a given country code. If not recognized, returns the Jolly Roger.
 * @param {string} countryCode - Example: "EU", "AU", "NZ"
 * @returns {string} - The emoji, e.g. 🏴‍☠️
 */
function getFlag(countryCode) {
	flag = "🏴‍☠️"
	try {
		flag = flagEmoji.data[countryCode].emoji
	} catch (error) {
		// console.error(error)
	}
	return flag
}

/** Updates the top team member tally. Should be done after every achievement update (or Pusher own receipt) */
async function updateTeamStats() {
	var teamMembersAll = { ...TEAM_MEMBERS, ...TEAM_MEMBERS_IGNORED }
	sortedByTPoints = Object.keys(teamMembersAll).sort(function (a, b) { return teamMembersAll[b].points - teamMembersAll[a].points })
	TEAM_STATS.topMembers = sortedByTPoints
}

/**
 * Returns true if the object has any properties (is not empty), else returns false.
 * @param {Object} obj 
 * @returns {boolean}
 */
function isEmpty(obj) {
	for (var key in obj) {
		if (obj.hasOwnProperty(key))
			return false
	}
	return true
}

/**
 * A local file-based method for restoring local backups, useful for early testing without a database instance.
 */
function importExistingData() { // Imports machine and team data from json files, enabling the bot to serve answers immediately.
	try {
		MACHINES = JSON.parse(fs.readFileSync("cache/machines.json", "utf8"))
		CHALLENGES = JSON.parse(fs.readFileSync("cache/challenges.json", "utf8"))
		TEAM_MEMBERS = JSON.parse(fs.readFileSync("cache/team_members.json", "utf8"))
		TEAM_MEMBERS_IGNORED = JSON.parse(fs.readFileSync("cache/team_members_ignored.json", "utf8"))
		DISCORD_LINKS = JSON.parse(fs.readFileSync("cache/discord_links.json", "utf8"))
		TEAM_STATS = JSON.parse(fs.readFileSync("cache/team_stats.json", "utf8"))
		MACHINE_STATS = updateMachineStats()
		updateTeamStats()
		console.info("Imported existing datafiles! Will update automatically every half-hour.")
	}
	catch (e) {
		console.warn("ERROR: couldn't import data. Moving on..")
		console.log(e)
	}
}

/**
 * A local file-based export method that serializes a specific HTB state data to a JSON file. Useful for pre-deployment testing.
 * @param {Object} object - The object to back up as JSON.
 * @param {*} filename - The name to use for the JSON file.
 */
function exportData(object, filename) { // Save JSON files of team and machine data.
	var objectName = varObj => Object.keys(varObj)[0]
	//if (!isEmpty(object)) {
	fs.writeFile("cache/" + filename, JSON.stringify(object, null, "\t"), "utf8", function (err) {
		if (err) {
			console.log("An error occured while writing " + objectName + " settings to File.")
			return console.log(err)
		}
		console.log("JSON file " + filename + " has been saved.")
	})
	//}
}

/**
 * Converts a textual list (e.g. "Bob, Jane, Alice") to "Bob, Jane, and Alice".
 * @param {string} - A ", " separated textual list
 * @returns {string} The converted text.
 */
function andifyList(str) { // 
	if (str.includes(",")) {
		var n = str.lastIndexOf(",")
		return str.substring(0, n + 1) + " and" + str.substring(n + 1, str.length)
	} else {
		return str
	}
}

/**
 * Returns the name of either an upcoming release (if announced) or the latest published box.
 * @returns {(string|null)}
 */
function getNewReleaseName() {
	try {
		const unreleasedBox = Object.values(MACHINES).find(machine => machine.unreleased)
		if (unreleasedBox) {
			console.log(unreleasedBox)
			return unreleasedBox.name
		} else {
			return Object.values(MACHINES).slice(-1)[0].name
		}
	} catch (error) {
		console.error(error)
		return "Lame" // First HTB machine, may it RIP :)
	}
}

/**
 * Get the ID of the machine whose name matches the parameter string.
 * @param {string} name - The machine name.
 * @returns {(number|null)}
 */
function getMachineIdFromName(name) {
	var machineArray = Object.values(MACHINES)
	const fetchedId = Number(Object.values(MACHINES).find(machine => machine.name.toLowerCase() == name.toLowerCase()).id)

	return fetchedId
}

/**
 * Get the machine object whose name matches the parameter string.
 * @param {string} name - The machine name.
 * @returns {(HtbMachine|null)}
 */
function getMachineByName(name) {
	if (name) {
		var machineArray = Object.values(MACHINES)
		return machineArray.find(machine => machine.name.toLowerCase() == name.toLowerCase())
	}
	return null
}

/**
 * Get the machine object whose id matches the parameter string.
 * @param {string} id - The machine id.
 * @returns {(HtbMachine|null)}
 */
function getMachineById(id) {
	try { return MACHINES[id] } catch (error) { console.error(error); return null }
}

/**
 * Get the challenge object whose name matches the parameter string.
 * @param {string} name - The challenge name.
 * @returns {(HtbChallenge|null)}
 */
function getChallengeByName(name) { // Return machine object with name matching parameter string
	//console.log(name)
	if (name && CHALLENGES) {
		var challengeArray = Object.values(CHALLENGES)
		for (let i = 0; i < challengeArray.length; i++) {
			for (let j = 0; j < challengeArray[i].length; j++) {
				// console.log(machineArray[i] + JSON.stringify(machineArray[i]))
				if (challengeArray[i][j].name.replace(/\W/g, "").toLowerCase() == name.replace(/\W/g, "").toLowerCase()) {
					//console.log('Challenge name ' + name + ' matched validated name ' + challengeArray[i][j].name)
					return challengeArray[i][j]
				}
			}
		}
	}
	return null
}

/**
 * Get the  current rank of a team member by ID.
 * @param {number} id - The member ID.
 * @returns {(number|"Unknown")}
 */
function getMemberTeamRankById(id) {
	try {
		return TEAM_STATS.topMembers.indexOf(id) + 1
	} catch (error) {
		console.log(error)
		return ("Unknown")
	}
}

/**
 * Get the member object whose name matches the parameter string.
 * @param {string} name - The member name.
 * @returns {(TeamMember|null)}
 */
function getMemberByName(name) {
	//console.log(name)
	if (name) {
		var match = (Object.values(TEAM_MEMBERS).find(member => member.name.toLowerCase() == name.toLowerCase()))
		if (match) {
			return match
		} else {
			match = getIdFromDiscordName(name)
			return TEAM_MEMBERS[match] || null
		}
	}
}

/**
 * Takes information about a new own achievement and adds it to our records.
 * @param {number} uid - The ID of the user associated with the achievement.
 * @param {string} type - A string value describing the thing / milestone owned, e.g. "root", "user", "challenge", "endgame", "akerva" etc.
 * @param {(number|string)} target - If a machine user/system own, use the numeric machine ID (e.g. 238). If a challenge or fortress own, use the title.
 * @param {string} flag - For pro labs and fortresses with multiple flags, use this field to specify the milestone title.
 */
function addOwn(uid, time, type, target, flag = "", isPusher = false) {
	if (uid in TEAM_MEMBERS) {
		try {
			switch (type) {
			case "user":
				var own = getMachineByName(target).userOwners.find(ownItem => ownItem.uid == uid)
				if (!own) {
					console.log((isPusher ? "user owns for this target: " + getMachineByName(target).userOwners.length : ""))
					getMachineByName(target).userOwners.push(new HtbOwn(uid, time))
					console.log((isPusher ? "user owns for this target: " + getMachineByName(target).userOwners.length : ""))
					TEAM_MEMBERS[uid].totalOwns.user++
					console.log((isPusher ? "Added user own for " + uidToUname(uid) : ""))
				} break

			case "root":
				console.log((isPusher ? "root owns for this target:" + getMachineByName(target).userOwners.length : ""))
				var own = getMachineByName(target).rootOwners.find(ownItem => ownItem.uid == uid)
				console.log((isPusher ? "root owns for this target: " + getMachineByName(target).userOwners.length : ""))
				if (!own) {
					getMachineByName(target).rootOwners.push(new HtbOwn(uid, time))
					TEAM_MEMBERS[uid].totalOwns.user++
					console.log((isPusher ? "Added root own for " + uidToUname(uid) : ""))
				}	break

			case "challenge":
				var challenge = getChallengeByName(target)
				var own = challenge.owners.find(ownItem => ownItem.uid == uid)
				if (!own) {
					console.log((isPusher ? "root owns for this target: " + challenge.userOwners.length : ""))
					challenge.owners.push(new HtbOwn(uid, time))
					console.log((isPusher ? "root owns for this target: " + challenge.userOwners.length : ""))
					TEAM_MEMBERS[uid].totalOwns.challenge++
					console.log((isPusher ? "Added challenge own for " + uidToUname(uid) : ""))
				} break
			default: break
			}
		} catch (error) {
			console.error(error)
		}
	}
}

// FIX SORTING
/**
 * Returns a list of HtbOwn objects representing the members who have owned the specified challenge.
 * @param {string} challengeName - Name of the challenge.
 * @returns {(HtbOwn[]|null)}
 */
function getOwnersByChallengeName(challengeName) {
	console.log("Getting owners by challenge name:", challengeName)
	if (challengeName) {
		return Array.from(getChallengeByName(challengeName).owners)
	} else {
		return null
	}
}

/**
 * Returns a list of HtbOwn objects representing the members who have rooted the machine with the specified ID.
 * @param {number} machineId - Name of the challenge.
 * @returns {(HtbOwn[]|null)}
 */
function getOwnersByMachineId(machineId) {
	console.log(machineId)
	if (machineId) {
		return Array.from(MACHINES[machineId].rootOwners)
	} else {
		return null
	}
}

/**
 * Gets the HTB user ID for a given Discord username, if such an association exists.
 * @param {string} username - The Discord username to lookup linked account for.
 * @returns {(number|false)}
 */
function getIdFromDiscordName(username) {
	var id = Object.keys(DISCORD_LINKS).find(link => DISCORD_LINKS[link].username.toLowerCase() == username.toLowerCase())
	return id || false
}

/**
 * Returns a pretty-printable version of the Discord username and / or HTB username for a given HTB UID, in hyperlinked Discord markdown.
 * @param {number} uid
 * @returns {(string|"[Invalid ID]")}
 */
function tryDiscordifyUid(uid) {
	if (uid in TEAM_MEMBERS) {
		if (uid in DISCORD_LINKS) {
			var discordName = DISCORD_LINKS[uid].username
			if (discordName != TEAM_MEMBERS[uid].name) {
				return TEAM_MEMBERS[uid].name + " (🌀" + FMT(discordName, "bs") + ")"
			} else {
				return "🌀" + FMT(discordName, "bs")
			}
		} else {
			return TEAM_MEMBERS[uid].name
		}
	} else {
		return "[Invalid ID]"
	}
}

/**
 * Returns a set of markdown-formatted username links for a given list of HTB ids.
 * @param {number[]} memberIds - An array of HTB UIDs 
 * @returns {(string[]|"[Invalid ID]")}
 */
function getMdLinksForUids(memberIds) { // Get markdown link to a HTB user's profile, based on UID.
	//console.log(memberIds)
	if (memberIds) {
		var screenNames = []
		memberIds.forEach(uid => {
			//console.log("UID: " + uid)
			if (uid in TEAM_MEMBERS) {
				screenNames.push("[" + tryDiscordifyUid(uid) + "]" + "(" + "https://www.hackthebox.eu/home/users/profile/" + uid + " " + "'Goto HTB page for " + TEAM_MEMBERS[uid].name + (uid in DISCORD_LINKS ? " / @" + DISCORD_LINKS[uid].tag : "") + "')")
			} else {
				console.log("UID opted out of data collection.")
				screenNames.push("[٩(͡๏̯͡๏)۶](https://www.hackthebox.eu/ 'This user has disabled data collection by Seven.')")
			}
		})
		if (screenNames.length == 0) {
			return null
		} else {
			return screenNames
		}
	} else {
		return null
	}
}

function getMdLinksForBoxIds(boxIds) { // Get markdown link to a HTB user's profile, based on UID.
	// console.log(boxIds)
	if (boxIds) {
		var boxLinks = []
		boxIds.forEach(boxId => {
			if (boxId in MACHINES) {
				var box = MACHINES[boxId]
				boxLinks.push("**[" + box.name + "](" + "https://www.hackthebox.eu/home/machines/profile/" + box.id + " 'Goto HTB page')**")
			}
		})
		// console.log(boxLinks)
		if (boxLinks.length == 0) {
			return null
		} else {
			return boxLinks
		}
	} else {
		return null
	}
}

function getMdLinksForChallengeCategoriesByChallengeNames(challengeNames) { // Get markdown link to a HTB user's profile, based on UID.
	var categories = {}
	Object.keys(CHALLENGES).forEach(challengeCategoryName => {
		categories[challengeCategoryName] = []
	})
	// console.log(challengeNames)
	if (challengeNames) {
		challengeNames.forEach(challengeName => {
			// console.log(challengeName)
			var challenge = getChallengeByName(challengeName)
			if (challenge) {
				categories[challenge.category].push("**[" + challenge.name + "](http://0)**")
			}

		})
		console.log(categories)
		return categories

	} else {
		return null
	}
}

function getMdLinksForOwnList(memberOwnList) { // Get markdown link to a HTB user's profile, based on UID.
	// console.log(memberOwnList)
	if (memberOwnList) {
		var screenNames = []
		memberOwnList.forEach(memberOwn => {
			if (memberOwn.uid in TEAM_MEMBERS) {
				if (memberOwn.uid in DISCORD_LINKS) {
					console.log(DISCORD_LINKS[memberOwn.uid].username + " / " + TEAM_MEMBERS[memberOwn.uid].name)
				}
				screenNames.push("[" + tryDiscordifyUid(memberOwn.uid) + "]" + "(" + "https://www.hackthebox.eu/home/users/profile/" + memberOwn.uid + " " + "'HTB Profile for " + TEAM_MEMBERS[memberOwn.uid].name + (memberOwn.uid in DISCORD_LINKS ? " / @" + DISCORD_LINKS[memberOwn.uid].tag : "") + "')")
			} else {
				console.log("UID opted out of data collection.")
				screenNames.push("[٩(͡๏̯͡๏)۶](https://www.hackthebox.eu/ 'This user has disabled data collection by Seven.')")
			}
		})
		if (screenNames.length == 0) {
			return null
		} else {
			return screenNames
		}
	} else {
		return null
	}
}

function parseSingleDate(date,) { // Parse date to timestamp (millis) for various formats used on HTB site, based on length
	if (date) {
		switch (date.length) {
		case 10:
			try {
				return new Date(parseDate(date, "y-MM-dd", new Date(0)).setUTCHours(19)).getTime()
			} catch (error) {
				console.log(error)
				return 0
			}
		case 23:
			try {
				return new Date(date.replace(" UTC", "Z")).getTime()
			} catch (error) {
				console.log(error)
				return 0
			}
		default:
			try {
				return new Date(parseDate(date, "MMMM do, yyyy", new Date(0)).setUTCHours(19)).getTime()
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
	var newDates = []
	dates.forEach(dateString => {
		newDates.push(parseSingleDate(dateString))
	})
	return newDates
}

function getMachines() {
	return new Promise(resolve => {
		rp("https://www.hackthebox.eu/api/machines/get/all?api_token=" + process.env.HTB_TOKEN, { json: true })
			.then(function (machines) {
				var machineSet = {}
				console.log("Got", machines.length, "machines...")
				//console.log(value)
				var machineIds = jp.query(machines, "$.*.id")
				var machineNames = jp.query(machines, "$.*.name")
				var machineThumbs = jp.query(machines, "$.*.avatar_thumb")
				var machineIsRetireds = jp.query(machines, "$.*.retired")
				var machineMakers = jp.query(machines, "$.*.maker")
				var machineMaker2s = jp.query(machines, "$.*.maker2")
				var machineOses = jp.query(machines, "$.*.os")
				var machineIps = jp.query(machines, "$.*.ip")
				var machineRatings = jp.query(machines, "$.*.rating")
				var machineReleases = jp.query(machines, "$.*.release")
				var machineRetireDates = jp.query(machines, "$.*.retired_date")
				var machinePoints = jp.query(machines, "$.*.points")
				machineReleases = parseDateArray(machineReleases)
				machineRetireDates = parseDateArray(machineRetireDates)
				for (let i = 0; i < machineIds.length; i++) {
					machineSet[machineIds[i].toString()] = new HtbMachine(machineNames[i],
						Number(machineIds[i]),
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
				// console.log(machineSet)
				resolve(machineSet)
			})
			.catch(function (err) {
				resolve(err)
			})
	})
}

async function getChallenges(session) {
	console.log("Getting challenges...")
	var challengeBuffer = {}
	var specialChallengeBuffer = {}
	var categories = ["Reversing", "Crypto", "Stego", "Pwn", "Web", "Misc", "Forensics", "Mobile", "OSINT", "Hardware"]
	var specialTypes = ["Endgame", "Fortress", "Pro Labs"]
	var specials = {}
	var homepage = await session.requestAsync("/home")
	var $ = require("jquery")(new JSDOM(homepage.body).window)
	specialTypes.forEach(type => { specials[[type]] = []; $("a:contains('" + type + "')").next().find("a").each(function () { specials[[type]].push(this.href.substring(25)) }) })
	return new Promise(async resolve => {
		var keys = Object.keys(specials)
		for await (let specialKey of keys) {
			var	specialLinks = specials[specialKey]
			var thisCategoryChallenges = []
			var thisSpecialCategoryChallenges = []
			for (let i = 0; i < specialLinks.length; i++) {
				var specialLink = specialLinks[i]
				var response = await getSpecialCategory(specialLink, session)
				try {
					var $ = require("jquery")(new JSDOM(response.body).window)
					var specialChallenge = {}
					specialChallenge["name"] = $(".luna-nav").find("li.active").find("span").remove().end().text().trim().trimEnd()
					specialChallenge["id"] = i + 1
					specialChallenge["category"] = specialKey
					specialChallenge["flags"] = Object.fromEntries($("i[id^=\"flagIcon\"]").map((idx, ele) => ([[idx + 1, ele.nextSibling.nextSibling.textContent]])).get())
					specialChallenge["description"] = $("#descriptionTab").find(".panel-body").find("p, li").map(function (idx, ele) {
						if (ele.textContent && $(ele).children().length == 0) { return ($(ele).is("li") ? ele.textContent : ele.textContent + "\n") }
					}).get().join("\n")
					specialChallenge["entries"] = $("code").map((idx, ele) => ele.textContent).get()
					specialChallenge["makers"] = $("#descriptionTab, .header-title").find("a[href*='/home/users/profile/']").map((idx, ele) => { return { username: ele.textContent, id: Number(ele.href.substring(20)) } })[0]
					specialChallenge["retired"] = $(".fa-file-pdf").length > 0
					// console.log(specialChallenge)
					thisSpecialCategoryChallenges.push(specialChallenge)
				} catch (error) {
					console.error(error)
				}
			}
			specialChallengeBuffer[specialKey] = thisSpecialCategoryChallenges
		}

		console.log("| SPECIAL CHALLENGES [ENDGAME, PROLAB, FORTRESS] |\n", JSON.stringify(specialChallengeBuffer, null, "  "))

		for await (let category of categories) {
			response = await getChallengesCategory(category, session)
			thisCategoryChallenges = []
			$ = require("jquery")(new JSDOM(response.body).window)

			$(".panel-heading").each(function () {
				var description = this.nextSibling.nextSibling.firstChild.nextSibling.nextSibling.nextSibling.nextSibling.data.trim()
				var points = 0
				var isActive = false
				//console.log(description)
				var dateString = $($(this).children(".panel-tools")[0]).text().trim()
				var releaseDate = new Date(parseDate(dateString, "dd/MM/yyyy", new Date(0)).setUTCHours(19)).getTime()
				var spans = $(this).children("span")
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
				var maker = { "id": makers[0].href.substring(45), "name": makers[0].innerHTML }
				var maker2 = null
				try {
					maker2 = { "id": makers[1].href.substring(45), "name": makers[1].innerHTML }
				} catch (error) {
					//console.log('\nNo 2nd maker ...')
				}
				var tex = $(this).text()
				//console.log("TEX",tex)
				var name = tex.substring(tex.indexOf((isActive ? "] " : "     ")) + 1, tex.indexOf("[by") - 1).trim()
				var solverCount = Number($(spans[1]).text().match(/[\d]*(\d+)/g))
				var ratePro = Number($(spans[2]).text())
				var rateSucks = Number($(spans[3]).text())
				// console.log("GOT CHALLENGE. Datestring:", dateString, "|", "name:", name, "| maker:", maker.name, "| maker2:", (maker2 ? maker2.name : "None"), "| points:", points, "| active:", isActive, "| solvercount:", solverCount, "| ratings:", ratePro, rateSucks * -1)
				// console.log("Got challenge", name + " ...")
				var thisChallenge = new HtbChallenge(name, category, releaseDate, description, isActive, points, maker, maker2, solverCount, ratePro, rateSucks)
				thisCategoryChallenges.push(thisChallenge)
				if (!getChallengeByName(thisChallenge.name)) {
					// dFlowEnt.updateEntity('challenge', thisChallenge.name)
				}
			})
			console.log("Got", thisCategoryChallenges.length, "challenges in the '" + category + "' category")
			challengeBuffer[category] = thisCategoryChallenges
		}
		console.log(challengeBuffer)
		resolve(challengeBuffer)
	})
}

function getTeamData(session) {
	return new Promise(resolve => {
		console.log("Getting team details...")
		session.request("/home/teams/profile/2102", function (error, response, body) {
			var teamUsers = {}
			var $ = require("jquery")(new JSDOM(body).window)
			//console.log("Team page body length:" + body)
			// Parse Team Stats
			try {
				var teamName = $(".row-selected").children()[1].innerHTML
				var thumb = $($(".header-icon").find(".image-lg")[0]).attr("data-cfsrc")
				var globalRanking = Number($(".row-selected").children()[0].innerHTML)
				var totalPoints = Number($(".row-selected").children()[2].innerHTML)
				var totalRoots = Number($(".row-selected").children()[3].innerHTML)
				var totalUsers = Number($(".row-selected").children()[4].innerHTML)
				TEAM_STATS.name = teamName
				TEAM_STATS.thumb = thumb // Not working. Needs fixing
				TEAM_STATS.globalRanking = globalRanking
				TEAM_STATS.points = totalPoints
				TEAM_STATS.owns.roots = totalRoots
				TEAM_STATS.owns.users = totalUsers
				console.log("Team Stats Updated:", TEAM_STATS)
			} catch (error) {
				console.error(error)
				console.error("ERROR: Could not parse team Data. Failing gracefully...")
			}
			console.log("Getting team members...")
			// Parse Team Members
			try {

				var jq = $($("#membersTable").children()[1]).children().each(function () {
					var stats = $(this).children()
					var siterank = 99999999
					var userpoints = 0
					if (stats[0].innerHTML && stats[0].innerHTML != "unranked") {
						siterank = Number(stats[0].innerHTML)
						userpoints = Number(stats[2].innerHTML)
					}
					var userCol = $(stats[1]).children()[0]
					var uName = userCol.innerHTML
					var uid = userCol.href.substring(45)
					var user = new TeamMember(uName, uid, { "user": Number(stats[4].innerHTML), "root": Number(stats[3].innerHTML) }, siterank, userpoints)

					if (!(uid in Object.keys(TEAM_MEMBERS_IGNORED))) {
						//console.log("got here")
						teamUsers[uid] = user
					}
					// console.log(user)
					//console.log('username: ' + uName + ' uid: ' + uid + ' uOwns: ' + uOwns)
				})
			} catch (error) {
				console.error(error)
			}
			console.log("SUCCESS: Got team members... " + Object.keys(teamUsers).length)
			resolve(teamUsers)
		})
	})
}

function getSession() {
	return csrfLogin({
		username: process.env.HTB_EMAIL,
		password: process.env.HTB_PASS
	})
}

function getUserProfile(id, session) {
	//console.log('getting user profile #' + id)
	return session.requestAsync("/home/users/profile/" + id)
}

function getChallengesCategory(category, session) {
	//console.log('getting user profile #' + id)
	return session.requestAsync("/home/challenges/" + category)
}

function getSpecialCategory(type, session) {
	//console.log('getting user profile #' + id)
	return session.requestAsync(type)
}

async function getOwnageData(session, mbrs) {
	var members = Object.keys(mbrs)
	console.log("Collecting ownage data for " + members.length + " team members...")
	return new Promise(async resolve => {
		for (var i = 0; i < members.length; i++) {
			//for (var i = 0; i < 5; i++) {
			//console.log("#" + i.toString().padStart(2, '0') + ": Parsing owns for member " + members[i])
			var response = await getUserProfile(members[i], session)
			await parseUserOwns(response.body, members[i])
		}
		console.log("FINISHED PARSING OWNS...")
		resolve()
	})
}

function uidToUname(uid) {
	// console.log("uidToUname(uid):", uid)
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
	var id = false
	//console.log(Object.values(TEAM_MEMBERS))
	Object.values(TEAM_MEMBERS).forEach(member => {
		if (member.name.toLowerCase() == username.toLowerCase()) {
			id = member.id
		}
	})
	return id
}

async function getUnreleasedMachine(session) {
	return new Promise(async resolve => {
		//for (var i = 0; i < members.length; i++) {
		response = await session.requestAsync("/home/machines/unreleased")
		var $ = require("jquery")(new JSDOM(response.body).window)
		if ($(".table tr").length > 1) {
			var trs = $($(".table tr")[1])
			var mids = trs.find("a[href^='https://www.hackthebox.eu/home/machines/profile/']")
			var urmid = mids[0].href.substring(48)
			var oldmid = mids[1].href.substring(48)
			var name = mids[0].innerHTML
			var rname = mids[1].innerHTML
			var thumb = trs.find("img[src^='https://www.hackthebox.eu/storage/avatars']")[0].src
			var releaseDate = parseSingleDate($($(".table tr")[1]).find(":contains('UTC')")[0].innerHTML)
			var makers = trs.find("a[href^='https://www.hackthebox.eu/home/users/profile/']")
			var maker = makers[0].innerHTML
			var makerId = makers[0].href.substring(45)
			var maker2 = null
			try {
				maker2 = { "id": makers[1].innerHTML, "name": makers[1].href.substring(45) }
			} catch (error) {
				console.log("\nNo 2nd maker ...")
			}
			var response = await session.requestAsync("/home/machines/profile/" + urmid)
			$ = require("jquery")(new JSDOM(response.body).window)
			var ip = $("td")[9].innerHTML
			var points = Number($("td span")[1].innerHTML)
			var difficulty = $("td span")[0].innerHTML
			var os = $("td")[1].innerHTML.substring($("td")[1].innerHTML.lastIndexOf(">") + 1).replace(" ", "")
			var unreleasedBox = new HtbMachine(name,
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
			dFlowEnt.addSingleEntity("Machines", unreleasedBox.name)
			resolve(unreleasedBox)
		} else {
			resolve(null)
		}
	})
}

function grabCsrfFromJar(session) {
	try {
		return session.jar._jar.store.idx["www.hackthebox.eu"]["/"]["csrftoken"].value
	} catch (error) {
		console.error(error)
		return ""
	}
}

async function updateData(client) {
	if (!UPDATE_LOCK) {
		UPDATE_LOCK = true
		console.log("Update lock engaged. Beginning update attempt.")
		return new Promise(async resolve => {
			try {
				await updateDiscordIds(client, "679990388911767553")
				var SESH = await getSession()
				CSRF_TOKEN = grabCsrfFromJar(SESH)
				console.log("Got CSRF TOKEN:", CSRF_TOKEN)
				HTB_PUSHER_OWNS_SUBSCRIPTION.auth = CSRF_TOKEN
				console.log("Got a logged in session.")
				console.log("BEGINNING DATA COLLECTION [HTML Parse]")
				MACHINES_BUFFER = await getMachines()
				CHALLENGES = await getChallenges(SESH)
				var TEAM_MEMBERS_TEMP = await getTeamData(SESH)
				if (Object.keys(TEAM_MEMBERS_TEMP).length > Object.keys(TEAM_MEMBERS).length) {
					TEAM_MEMBERS = TEAM_MEMBERS_TEMP
				}
				var urmachine = await getUnreleasedMachine(SESH)
				console.warn(urmachine ? "INFO: Got unreleased machine " + urmachine.name + "..." : "INFO: There are currently no machines in unreleased section.")
				if (urmachine) {
					MACHINES[urmachine.id.toString()] = urmachine
					MACHINES_BUFFER[urmachine.id.toString()] = urmachine
				}
				await getOwnageData(SESH, TEAM_MEMBERS)
				MACHINES = MACHINES_BUFFER
				await cleanTargetSets()
				console.log("UPDATED DATA. Total machines : " + Object.values(MACHINES).length)
				console.log("               Total members : " + Object.values(TEAM_MEMBERS).length)
				var updateCacheSuccessful = await updateCache()
				console.log(updateCacheSuccessful ? "All data backed up to the cloud for a rainy day..." : "Export failed...")
				/* TO HANDLE EXPORTS WITHOUT DB (USING LOCAL JSON FILES ( useful for dev )):::
        |  exportData(MACHINES, "machines.json")
        |  exportData(CHALLENGES, "challenges.json")
        |  exportData(TEAM_MEMBERS, "team_members.json");
        |  exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
        |  exportData(DISCORD_LINKS, "discord_links.json")
        \  exportData(TEAM_STATS, "team_stats.json")  */
				LAST_UPDATE = new Date()
				UPDATE_LOCK = false
				console.log("Update lock released.")
				resolve()
			} catch (error) {
				console.error("UPDATE FAILED.")
				console.error(error, "\nUPDATE LOCK HAS BEEN RESET AS A PRECAUTION.")
				UPDATE_LOCK = false
				resolve()
			}
		})
	} else {
		console.warn("WARN: DATA UPDATE NOT STARTED, AS ONE IS ALREADY IN PROGRESS.")
	}
}


async function parseUserOwns(body, id) {
	return new Promise(resolve => {
		//console.log("Parsing owns for uid: " + uid)
		try {
			var $ = require("jquery")(new JSDOM(body).window)
			var thumb = $($(".header-icon").find(".image-lg")[0]).attr("data-cfsrc") || "https://www.hackthebox.eu/images/favicon.png"
			var rank = $($(".header-title")[0]).find(".c-white").text() || "Noob"
			var joinDate = parseSingleDate($("div[title^=\"Joined on\"]").attr("title").substring(10)) || 0
			var countryName = $(".flag")[0].parentNode.attributes["title"].value || "Pangea"
			var countryCode = $(".flag").attr("class").split(/\s+/)[1].split("-")[1].toUpperCase() || ""
			//console.log($('div[title^="Joined on"]').attr("title").substring(10))
			//console.log(joinDate)
			try {
				TEAM_MEMBERS[id].thumb = thumb
				TEAM_MEMBERS[id].countryName = countryName
				TEAM_MEMBERS[id].countryCode = countryCode
				TEAM_MEMBERS[id].rank = rank
				TEAM_MEMBERS[id].joinDate = joinDate
				// console.log(TEAM_MEMBERS[id])
			} catch (error) {
				console.error(error)
			}
			try {
				var charts = $("script:contains(\"var globalOptions = {\")").html()
				var chartData = safeEval(charts.substring(charts.indexOf("var lineData = ") + 15, charts.indexOf(";", charts.indexOf("var lineData = ")))).datasets
				var chart = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
				chart.users = realMax(chartData[0].data.slice(-1)[0], 0)      // user owns
				chart.roots = realMax(chartData[1].data.slice(-1)[0], 0)      // root owns
				chart.challenges = realMax(chartData[2].data.slice(-1)[0], 0) // challenge owns
				chart.respects = realMax(chartData[3].data.slice(-1)[0], 0)   // respects
				chart.bloods = realMax(chartData[4].data.slice(-1)[0], 0)     // bloods
				if (chart.users || chart.roots || chart.challenges || chart.respects || chart.bloods) {
					TEAM_MEMBERS[id].stats = chart
				} else {
					TEAM_MEMBERS[id].stats = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
				}
				console.log("Parsing owns for " + TEAM_MEMBERS[id].name + "...")
			} catch (error) {
				// There was a problem getting stats for the user based on profile timechart
				console.log(error)
			}
			var up2DateStats = { user: 0, root: 0, challenge: 0 } // Let's actually count these ourselves when parsing.
			$(".p-xs").each(function () { // Go through the user profile ownage rows (on right of page)
				var t = $($(this).children()[1]).text().trim().split(/\s+/)
				var parsedTime = $($(this).children("span.pull-right")[0]).attr("title")
				var timestamp = parseDate(parsedTime, "MMMM do, yyyy h:mm a", new Date()).getTime() / 1000
				var machineId = ""
				var machineLitmus = $(this).find("[href*=\"/machines/\"]")
				if (machineLitmus.length > 0) { machineId = machineLitmus[0].href.substring(48) }
				if (t[2].includes("user")) { // It is a machine user own
					up2DateStats.user++
					MACHINES_BUFFER[machineId].userOwners.push({ "uid": id, "timestamp": timestamp })
				} else if (t[2].includes("root")) { // It is a machine root own
					up2DateStats.root++
					MACHINES_BUFFER[machineId].rootOwners.push({ "uid": id, "timestamp": timestamp })
				} else if (t[2].includes("challenge")) {
					if ($(this).find("i.far.fa-cog.text-warning").length) {// It is a valid challenge
						up2DateStats.challenge++
						var challengeName = $(this).find("i.far.fa-cog.text-warning")[0].nextSibling.data.trim()
						getChallengeByName(challengeName).owners.push({ "uid": id, "timestamp": timestamp })
					} else {
						// It is not a challenge
					}
				}
				else { /*console.log('Something unparsable (e.g. special challenge, fortress OR a site update has screwed our parsing (PLS GIV US API, PLSSS HTB)...')*/ }
			})
			try {
				TEAM_MEMBERS[id].totalOwns = up2DateStats
			} catch (error) {
				console.error(error)
			}
		} catch (error) {
			//console.log(error + " - Could not parse page. (Likely user has no rank / XP)")
		}
		resolve("Done..")
	})
}

function cleanTargetSets() {
	return new Promise(resolve => {
		Object.values(MACHINES).forEach(machine => {
			machine.userOwners = [... new Set(machine.userOwners)]
			machine.rootOwners = [... new Set(machine.rootOwners)]
			machine.userOwners.sort((a, b) => (a.timestamp < b.timestamp) ? 1 : (a.timestamp === b.timestamp) ? ((a.uid < b.uid) ? 1 : -1) : -1)
			machine.rootOwners.sort((a, b) => (a.timestamp < b.timestamp) ? 1 : (a.timestamp === b.timestamp) ? ((a.uid < b.uid) ? 1 : -1) : -1)
		})

		Object.values(CHALLENGES).forEach(category => {
			category.forEach(challenge => {
				try {
					challenge.owners = [...new Map(challenge.owners.map(item => [item.uid, item])).values()]
					challenge.owners.sort((a, b) => (a.timestamp < b.timestamp) ? 1 : (a.timestamp === b.timestamp) ? ((a.uid < b.uid) ? 1 : -1) : -1)
				} catch (error) {
					console.error(error)
				}
			})
		})
		resolve("done")
	})
}


function between(str, oTag, cTag) {
	var first = (oTag == "XXX" ? 0 : str.indexOf(oTag) + 1 )
	return str.substring(
		first,
		str.substring(first).indexOf(cTag)
	)
}

function sendFileMsg() {
	try {
		var contents = JSON.parse(fs.readFileSync("config/sendable.json", "utf8"))
		client.channels.cache.get(contents.channel.toString()).send(contents.message)
	} catch (error) {
		console.error(error)
	}
}

async function setStatus(client, statusType, activityVerb, activityName) {
	await client.user.setPresence({ activity: { name: activityName, type: activityVerb }, status: statusType })
		.then(console.log)
		.catch(console.error)
	await client.user.setStatus(statusType)
		.then(console.log)
		.catch(console.error)
}

async function updateDiscordIds(client, guildIdString) {
	var keys = Object.keys(DISCORD_LINKS)
	var guild = await client.guilds.resolve(guildIdString)

	for (let i = 0; i < keys.length; i++) {
		var link = DISCORD_LINKS[keys[i]]
		try {
			var guildMember = await guild.members.resolve(link.id) || false
			if (guildMember) {
				var member = guildMember.user
				// console.log(DISCORD_LINKS[keys[i]], member)
				DISCORD_LINKS[keys[i]] = member || DISCORD_LINKS[i]
			}
		} catch (error) {
			console.error(error)
		}
	}
	updateCache(["DISCORD_LINKS"])
}

async function main() {
	test()
	await importDbBackup()
	client.login(process.env.BOT_TOKEN)               // BOT_TOKEN is the Discord client secret
	client.on("ready", async () => {
		dFlowEnt.addMissingFieldsToEntity([],"Machines")
		var SESH = await getSession()
		CSRF_TOKEN = grabCsrfFromJar(SESH)
		HTB_PUSHER_OWNS_SUBSCRIPTION = new HtbPusherSubscription("97608bf7532e6f0fe898", "owns-channel", "display-info", CSRF_TOKEN)
		HTB_PUSHER_OWNS_SUBSCRIPTION.on("pusherevent", message => {
			if (uidToUname(message.uid)) {
				console.log("PUSHER: " + message.debug)
				addOwn(message.uid, message.time, message.type, message.target, true)
			}
		})
		var DISCORD_ANNOUNCE_CHAN = await client.users.cache.get("679986418466029568").createDM()
		// console.log(DISCORD_ANNOUNCE_CHAN)
		console.log("DISCORD LINKS:", Object.values(DISCORD_LINKS).map(link => link.username).join(", "))
		updateData(client)
		setInterval(() => updateData(client), 30 * 60 * 1000)   // UPDATE OWNAGE DATA BY PARSING, EVERY 30 MINUTES
		console.log("Updated Discord User Objects...")
		console.warn("INFO: Discord connection established...")
		client.on("message", message => {
			if (!DEV_MODE_ON) {
				try {
					handleMessage(message)
				} catch (error) {
					console.log(error)
					message.channel.stopTyping()
				}
			} else if (isAdmin(message.author)) {
				console.log("Message is from dev admin, responding...")
				if (message.content.includes("📤")) {
					console.log("Sending file msg...")
					sendFileMsg()
				} else {
					try {
						handleMessage(message)
					} catch (error) {
						console.log(error)
						message.channel.stopTyping()
					}
				}
			} else if (!message.author.bot) {
				console.log("Dev mode enabled but received message not from admin. Not responding from this instance...")
			}
		})
	})

}
main()






function sendBoxOwnersMsg(message, machineName) {
	if (!machineName) {
		machineName == ""
	} else { console.log("machinename: " + machineName) }
	var twentyPlus = false
	console.log("Constructing a box info message for " + machineName + "...")
	var ownerList = getMdLinksForOwnList(getOwnersByMachineId(getMachineIdFromName(machineName)))
	if (ownerList) {
		if (ownerList.length > 15) {
			ownerList = ownerList.slice(0, 15)
			twentyPlus = true
		}
		if (ownerList.length == 1) {
			message.channel.send({
				embed: {
					color: 3447003,
					author: {
						name: getMachineByName(machineName).name,
						icon_url: getMachineByName(machineName).thumb,
						url: "https://www.hackthebox.eu/home/machines/profile/" + getMachineByName(machineName).id,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Owned by** " + andifyList(ownerList.join(", ")) + (twentyPlus ? " […]" : "") + " :woman_detective:").substring(0, 2040)
				}
			}
			)
		} else {
			message.channel.send({
				embed: {
					color: 3447003,
					author: {
						name: getMachineByName(machineName).name,
						icon_url: getMachineByName(machineName).thumb,
						url: "https://www.hackthebox.eu/home/machines/profile/" + getMachineByName(machineName).id,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Most recent team owns:** " + andifyList(ownerList.join(", ")) + (twentyPlus ? " […]" : "") + " :woman_detective:").substring(0, 2040)
				}
			})
		}
	} else {
		message.channel.send((getMachineByName(machineName) ? "Looks like nobody in the team has done this box yet :tired_face:" : "That isn't even a box!! Trying to trick me … silly Hu-man. :wheelchair:\nAccording to Wikipedia, u can't fool me... :woman_mage: "))
	}
}


function sendUserOwnersMsg(message, machineName) {
	if (!machineName) {
		machineName == ""
	} else { console.log("machinename: " + machineName) }
	var twentyPlus = false
	console.log("Constructing a user owner info message for " + machineName + "...")
	var ownerList = getMdLinksForOwnList(getOwnersByMachineId(getMachineIdFromName(machineName)))
	if (ownerList) {
		if (ownerList.length > 15) {
			ownerList = ownerList.slice(0, 15)
			twentyPlus = true
		}
		if (ownerList.length == 1) {
			message.channel.send({
				embed: {
					color: 3447003,
					author: {
						name: getMachineByName(machineName).name,
						icon_url: getMachineByName(machineName).thumb,
						url: "https://www.hackthebox.eu/home/machines/profile/" + getMachineByName(machineName).id,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Owned by** " + andifyList(ownerList.join(", ")) + (twentyPlus ? " […]" : "") + " :woman_detective:").substring(0, 2040)
				}
			}
			)
		} else {
			message.channel.send({
				embed: {
					color: 3447003,
					author: {
						name: getMachineByName(machineName).name,
						icon_url: getMachineByName(machineName).thumb,
						url: "https://www.hackthebox.eu/home/machines/profile/" + getMachineByName(machineName).id,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Most recent team owns:** " + andifyList(ownerList.join(", ")) + (twentyPlus ? " […]" : "") + " :woman_detective:").substring(0, 2040)
				}
			})
		}
	} else {
		message.channel.send((getMachineByName(machineName) ? "Looks like nobody in the team has done this box yet :tired_face:" : "That isn't even a box!! Trying to trick me … silly Hu-man. :wheelchair:\nAccording to Wikipedia, u can't fool me... :woman_mage: "))
	}
}

function sendLastBoxOwnerMsg(message, machineName) {
	if (!machineName) {
		machineName == ""
	} else { console.log("machinename: " + machineName) }
	console.log(machineName)
	var ownerList = getMdLinksForOwnList(getOwnersByMachineId(getMachineIdFromName(machineName)))
	if (ownerList) {
		// console.log(ownerList)
		var lastOwner = ownerList[0]
		// console.log(lastOwner)
		message.channel.send({
			embed: {
				color: 16580705,
				author: {
					name: getMachineByName(machineName).name,
					icon_url: getMachineByName(machineName).thumb,
					url: "https://www.hackthebox.eu/home/machines/profile/" + getMachineByName(machineName).id,
				},
				footer: {
					text: "ℹ️  Data last updated " + timeSince(LAST_UPDATE)
				},
				description: ("**Last owned by: ** " + lastOwner + " :woman_detective:").substring(0, 2040)
			}
		}
		)
	} else {
		message.channel.send((getMachineByName(machineName) ? "Looks like nobody in the team has done this box yet :tired_face:" : "Not a box... hmm."))
	}
}


function sendChallengeOwnersMsg(message, challengeName) {
	if (!challengeName) {
		challengeName == ""
	} else { console.log("Challenge name: " + challengeName) }
	var twentyPlus = false
	var challenge = getChallengeByName(challengeName)
	console.log("Constructing a challenge owner info message for " + challengeName + "...")
	var ownerList = getMdLinksForOwnList(getOwnersByChallengeName(challengeName))
	if (ownerList) {
		if (ownerList.length > 15) {
			ownerList = ownerList.slice(0, 15)
			twentyPlus = true
		}
		if (ownerList.length == 1) {
			message.channel.send({
				embed: {
					color: 3447003,
					author: {
						name: challenge.name,
						icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/24/cogs.png",
						url: "https://www.hackthebox.eu/home/challenges/" + challenge.category,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Owned by** " + andifyList(ownerList.join(", ")) + (twentyPlus ? " […]" : "") + " :woman_detective:").substring(0, 2040)
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
						url: "https://www.hackthebox.eu/home/challenges/" + challenge.category,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Most recent team owns:** " + andifyList(ownerList.join(", ")) + (twentyPlus ? " […]" : "") + " :woman_detective:").substring(0, 2040)
				}
			})
		}
	} else {
		message.channel.send((challenge ? "Looks like nobody in the team has done this challenge yet." : "That challenge doesn't even exist! Trying to trick me … silly Hu-man. :wheelchair:\nAccording to Wikipedia, u can't fool me... :woman_mage: "))
	}
}

function sendLastChallengeOwnerMsg(message, challengeName) {
	if (!challengeName) {
		challengeName == ""
	} else { console.log("Challenge name: " + challengeName) }
	var challenge = getChallengeByName(challengeName)
	var ownerList = getMdLinksForOwnList(getOwnersByChallengeName(challengeName))
	if (ownerList) {
		console.log(ownerList)
		var lastOwner = ownerList[0]
		console.log(lastOwner)
		message.channel.send({
			embed: {
				color: 16580705,
				author: {
					name: challenge.name,
					icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/24/cogs.png",
					url: "https://www.hackthebox.eu/home/challenges/" + challenge.category,
				},
				footer: {
					text: "ℹ️  Challenge data last updated " + timeSince(LAST_UPDATE)
				},
				description: ("**Most recently completed by: ** " + lastOwner + " 🧙").substring(0, 2040)
			}
		}
		)
	} else {
		message.channel.send((challenge.name ? "Looks like nobody in the team has done this challenge yet :tired_face:" : "Not a challenge... hmm."))
	}
}



async function sendTeamRankingMsg(message, note) {

	message.channel.send({
		embed: {
			title: "🌍⠀Team Global Rank",
			color: 3447003,
			author: {
				icon_url: TEAM_STATS.thumb,
				url: "https://www.hackthebox.eu/home/teams/profile/2102",
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


function sp(size, arr) { //size - child_array.length
	var out = [], i = 0, n = Math.ceil((arr.length) / size)
	while (i < n) { out.push(arr.splice(0, (i == n - 1) && size < arr.length ? arr.length : size)); i++ }
	return out
}

async function sendFlagboardMsg(message) {
	// var flags = []
	var flags = Object.values(TEAM_MEMBERS).map(member => getFlag(member.countryCode))
	var flagsSorted = flags.slice().sort()
	var flagString = ""
	var sortedFlagString = ""
	// TEAM_STATS.topMembers.forEach(memberId => {
	//   member = TEAM_MEMBERS[memberId]
	//   var flagLink = "["+getFlag(member.countryCode)+"](http://" + member.id + ")"
	//   flags.push(flagLink)
	// });
	var sortSpliced = sp(9, flagsSorted)
	var spliced = sp(9, flags)
	spliced.forEach(flagRow => {
		flagString += "\n" + flagRow.join(" ")
	})
	sortSpliced.forEach(flagRow => {
		sortedFlagString += "\n" + flagRow.join(" ")
	})

	await message.channel.send({
		embed: {
			color: "LUMINOUS_VIVID_PINK",
			author: {
				name: any("🗺️", "🌎", "🌏", "🌍", "🌐", "🚩", "⛳", "🛂", "🛫", "✈️", "🛩️") + " Team Locales",
				url: "https://www.hackthebox.eu/home/teams/profile/2102",
			},
			thumbnail: {
				url: TEAM_STATS.thumb,
			},
			footer: {
				text: "ℹ️  Accurate as of " + timeSince(LAST_UPDATE)
			},
			description: any(sortedFlagString, flagString)
		}
	})
	if (maybe(0.20)) await humanSend(message, any("Globalization is a form of artificial intelligence. 🍉", "Teamwork makes the dream work 👑"), true)
}

async function sendTeamLeaderMsg(message, note) {
	var member = TEAM_MEMBERS[TEAM_STATS.topMembers[0]]
	await message.channel.send({
		embed: {
			title: tryDiscordifyUid(member.id),
			color: "GREEN",
			author: {
				name: any("💯", "🏆", "🎖️", "🔮", "💠", "💎", "👑") + " Team Leader",
				icon_url: TEAM_STATS.thumb,
				url: "https://www.hackthebox.eu/home/teams/profile/2102",
			},
			thumbnail: {
				url: member.thumb,
			},
			footer: {
				text: "ℹ️  Accurate as of " + timeSince(LAST_UPDATE)
			},
			description: "Global Rank: **[# " + member.siterank + "](http://0)**\nTeam Rank:  **[# " + getMemberTeamRankById(member.id) + "](http://0)**"
		}
	})
	if (maybe(0.6)) await humanSend(message, "Let's give a round of applause!", true)
	if (maybe(0.4)) await humanSend(message, "Pain is the heart of success. No one knows that like " + member.name + "! 🎉", true)
}

async function sendMemberRankMsg(message, username) {
	if (!username) {
		username == ""
	} else { console.log("challengeName: " + username) }
	var member = tryGetValidMember(username, message.author.username)

	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}

	if (member) {
		teamRank = getMemberTeamRankById(member.id)
		if (teamRank == 1) {
			sendTeamLeaderMsg(message)
			return
		}
		message.channel.send({
			embed: {
				title: tryDiscordifyUid(member.id),
				color: 3447003,
				author: {
					name: "Member Rank",
					icon_url: TEAM_STATS.thumb,
					url: "https://www.hackthebox.eu/home/teams/profile/2102",
				},
				thumbnail: {
					url: member.thumb,
				},
				footer: {
					text: "ℹ️  Accurate as of " + timeSince(LAST_UPDATE)
				},
				description: "Global Rank: **[# " + member.siterank + "](http://0)**\nTeam Rank:  **[# " + teamRank + "](http://0)**"
			}
		})
	} else {
		message.channel.send({
			embed: {
				color: 3447003,
				author: {
					name: "Unrecognized User",
					icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/32/question.png",
					url: ""
				},
				description: "Member not found."
			}
		})
	}
}

async function sendCheckMemberOwnedChallengeMsg(message, challengename, username) {
	var challenge = getChallengeByName(challengename)
	var member = tryGetValidMember(username, message.author.username)

	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}

	console.log(challenge, member)
	if (member && challenge) {
		var own = (challenge.owners.find(own => own.uid == member.id))
		if (own) {
			await message.channel.send({
				embed: {
					color: "AQUA",
					author: {
						name: challenge.name,
						icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/24/cogs.png",
						url: "https://www.hackthebox.eu/home/challenges/" + challenge.category,
					},
					thumbnail: {
						url: member.thumb,
					},
					footer: {
						text: "ℹ️  Accurate as of " + timeSince(new Date(Math.max(LAST_UPDATE.getTime(), own.timestamp)))
					},
					description: "🥳 W00t! " + (checkSelfName(username) ? " **[You](https://www.hackthebox.eu/home/users/profile/" + member.id + ")**" : getMdLinksForUids([member.id])) + " completed challenge **[" + challenge.name + "](https://www.hackthebox.eu/home/challenges/" + challenge.category + ") " + timeSince(new Date(own.timestamp * 1000)) + "**."
				}
			})
		} else {
			await message.channel.send({
				embed: {
					color: "GOLD",
					author: {
						name: challenge.name,
						icon_url: "https://raw.githubusercontent.com/encharm/Font-Awesome-SVG-PNG/master/white/png/24/cogs.png",
						url: "https://www.hackthebox.eu/home/challenges/" + challenge.category,
					},
					thumbnail: {
						url: member.thumb,
					},
					footer: {
						text: "ℹ️  Accurate as of " + timeSince(LAST_UPDATE)
					},
					description: "It seems " + (checkSelfName(username) ? " **[you](https://www.hackthebox.eu/home/users/profile/" + member.id + ")** haven't " : getMdLinksForUids([member.id]) + " hasn't ") + " owned challenge **[" + challenge.name + "](https://www.hackthebox.eu/home/challenges/" + challenge.category + ")** yet. 🐳"
				}
			})
		}
	} else {
		await humanSend(message, "Sorry, username and / or challenge name was invalid. 🍔", true)
	}
}

function tryGetValidMember(username, discordName) {
	var member = getMemberByName(username)
	if (!member && checkSelfName(username)) {
		member = getMemberByName(discordName)
	}
	return (member ? member : null)
}

async function sendCheckMemberOwnedBoxMsg(message, boxname, username) {
	var machine = getMachineByName(boxname)
	var member = tryGetValidMember(username, message.author.username)

	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}

	if (member && machine) {
		var own = {}
		if (machine.rootOwners.some(own => own.uid == member.id)) {
			own = machine.rootOwners.find(own => own.uid == member.id)
		}
		else if (machine.userOwners.some(own => own.uid == member.id)) {
			own = machine.userOwners.find(own => own.uid == member.id)
			own["userOnly"] = true
		} else {
			own["userOnly"] = false
		}
		if ("uid" in own) {
			await message.channel.send({
				embed: {
					color: "AQUA",
					author: {
						name: machine.name,
						icon_url: machine.thumb,
						url: "https://www.hackthebox.eu/home/machines/profile/" + machine.id,
					},
					thumbnail: {
						url: member.thumb,
					},
					footer: {
						text: "ℹ️  Accurate as of " + timeSince(new Date(Math.max(LAST_UPDATE.getTime(), own.timestamp)))
					},
					description: (own.userOnly == true ? "🥳 Looks like " : "👑 W00t! ") + (checkSelfName(username) ? " **[You](https://www.hackthebox.eu/home/users/profile/" + member.id + ")**" : getMdLinksForUids([member.id])) + (own.userOnly == true ? " got " : " owned ") + (own.userOnly == true ? "user" : "root") + " on " + getMdLinksForBoxIds([machine.id]) + (own.userOnly == true ? " **" : " ") + timeSince(new Date(own.timestamp * 1000)) + (own.userOnly == true ? "**." : ".")
				}
			})
		} else {
			await message.channel.send({
				embed: {
					color: "GOLD",
					author: {
						name: machine.name,
						icon_url: machine.thumb,
						url: "https://www.hackthebox.eu/home/machines/profile/" + machine.id,
					},
					thumbnail: {
						url: member.thumb,
					},
					footer: {
						text: "ℹ️  Accurate as of " + timeSince(LAST_UPDATE)
					},
					description: "It seems " + (checkSelfName(username) ? " **[you](https://www.hackthebox.eu/home/users/profile/" + member.id + ")** haven't " : getMdLinksForUids([member.id]) + " hasn't ") + "got user or root on " + getMdLinksForBoxIds([machine.id]) + " yet. 🍟"
				}
			})
		}
	} else {
		await humanSend(message, "Sorry, username and / or machine name was invalid. 🍔", true)
	}
}

async function sendTeamLeadersMsg(message, note) {
	var leaderList = mdItemizeList(getMdLinksForUids(TEAM_STATS.topMembers).slice(0, 10))

	if (note & Math.random() > 0.5) {
		console.log("NOTE: " + note)
		await humanSend(message, note, true)
	}

	message.channel.send({
		embed: {
			title: ":bar_chart:⠀Team Leaderboard",
			color: "AQUA",
			author: {
				icon_url: "https://www.hackthebox.eu/storage/teams/8232e119d8f59aa83050a741631803a6.jpg",
				url: "https://www.hackthebox.eu/home/teams/profile/2102",
			},
			footer: {
				text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
			},
			description: ("**" + leaderList.join("**\n**") + "**").substring(0, 2040)
		}
	})
}

async function sendTeamInfoMsg(message, note) {
	console.log(TEAM_STATS)
	var leaderList = getMdLinksForUids(TEAM_STATS.topMembers)
	message.channel.send({
		embed: {
			color: 15844367,
			title: TEAM_STATS.name,
			author: {
				name: "Group by " + TEAM_MEMBERS[TEAM_STATS.teamFounder].name,
				icon_url: TEAM_MEMBERS[TEAM_STATS.teamFounder].thumb,
				url: "https://www.hackthebox.eu/home/users/profile/7383",
			},
			"footer": {
				//"icon_url": "https://cdn.discordapp.com/embed/avatars/0.png",
				"text": "ℹ️  Team info last updated " + timeSince(LAST_UPDATE)
			},
			thumbnail: {
				url: TEAM_STATS.thumb,
			},
			description: (":flag_nl:⠀Hacking for the fun of it! Learning it as a bonus").substring(0, 2040),
			image: {
				url: genBadgeUrl(),
			},
			fields: [
				{
					name: "R4NK1ng", inline: true,
					value: "Global: **[# " + TEAM_STATS.globalRanking + "](http://0)**"
				},
				{
					name: "P01NTz", inline: true,
					value: "**[" + TEAM_STATS.points + "](http://0)**"
				},
				{
					name: "0Wn4g3", inline: true,
					value: "Roots:** [" + TEAM_STATS.owns.roots + "](http://0)\n**Users:** [" + TEAM_STATS.owns.users + "](http://0)**"
				},
				{
					name: "L34d3Rbo4rd", inline: true,
					value: "**" + leaderList.slice(0, 5).join("**\n**") + "**"
				},
				{
					name: "...", inline: true,
					value: "**" + leaderList.slice(5, 10).join("**\n**") + "**"
				},
				{
					name: "...", inline: true,
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



function sendBoxInfoMsg(message, machineName) {
	if (!machineName) {
		machineName == ""
	} else { console.log("machinename: " + machineName) }
	var box = getMachineByName(machineName)
	if (box) {
		var embed = { 
			embed: {
				color: 1146986,
				author: {
					name: getMachineByName(machineName).name,
					icon_url: getOsImage(box.os),
					url: "https://www.hackthebox.eu/home/machines/profile/" + getMachineByName(machineName).id,
				},
				description: ("AEIOU".includes(box.os.charAt(0)) ? "An " : "A ") +
          box.os + " box by **["
          + box.maker.name
          + "](https://www.hackthebox.eu/home/users/profile/"
          + box.maker.id.toString()
          + ")"
          + (box.maker2 ? "** & **[" + box.maker2.name + "](https://www.hackthebox.eu/home/users/profile/" + box.maker2.id.toString() + ")" : "")
          + "**.\nIP Address: **" + (box.ip ? "[" + box.ip + "](http://" + box.ip + "/)**" : "Unknown**"),
				thumbnail: {
					url: getMachineByName(machineName).thumb.replace("_thumb", ""),
				},
				footer: {
					text: "ℹ️  Machines last updated " + timeSince(LAST_UPDATE)
				},
				fields: [
					{
						name: "` " + FMT("  " + difficultySymbol(box.difficulty) + " ", "s") + FMT(box.difficulty, "bs") + "     `", inline: false,
						value: "```diff\n"
              + FMT((box.retired ? "- Status   : " : "  Status   : "), "s") + (box.retired ? "🧟 Retired" : (box.release > (new Date()).getTime() ? "🔥 𝗨𝗡𝗥𝗘𝗟𝗘𝗔𝗦𝗘𝗗" : "👾 Active")) + "\n"
              + "+" + FMT(" Points   : ", "s") + box.points + "\n"
              + "+" + FMT(" Released : ", "s") + new Date(box.release).toDateString() + "\n"
              + "+" + FMT(" Rating   : ", "s") + ratingString(box.rating) + "\n"
              + "+" + FMT(" Age     : ", "s") + elapsedDays(new Date(box.release)) + " days\n"
              + (box.retired ? FMT("+ Retired  : ") + (new Date(box.retiredate).toDateString()) : "")
              + (box.unreleased ? FMT("- Replaces : ") + box.unreleased.replaces : "")
              + "\n```"
					},
				]
			}
		}
		message.channel.send(embed)
	} else {
		message.reply("ጠﻉ乇የ ᙏØɾየ")
	}
}

function sendMemberInfoMsg(message, username) {
	if (!username) {
		username == ""
	} else { console.log("memberName: " + username) }
	var member = tryGetValidMember(username, message.author.username)

	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}

	if (member) {
		message.channel.send({
			embed: {
				color: 3066993,
				author: {
					name: tryDiscordifyUid(member.id) + (checkSelfName(username) ? "  [You]" : ""),
					icon_url: TEAM_STATS.thumb,
					url: "https://www.hackthebox.eu/home/users/profile/" + member.id,
				},
				description: getFlag(member.countryCode) + "⠀**[" + member.rank + ".](http://0)** | HTB member since **" + formatRelative(new Date(member.joinDate), new Date()) + "**",
				thumbnail: {
					url: member.thumb,
				},
				footer: {
					text: "ℹ️  Achievements last updated " + timeSince(LAST_UPDATE)
				},
				fields: [
					{
						name: "` " + FMT(rankSymbol(member.rank) + " Site Rank : ", "s") + FMT((member.siterank == 99999999 ? "Unranked" : member.siterank + nth(member.siterank)), "bs") + "     `", inline: false,
						value: "```diff\n"
              + "+ 🧡 𝖱𝖾𝗌𝗉𝖾𝖼𝗍    : " + member.stats.respects + "\n"
              + "+ 👨‍💻 𝖱𝗈𝗈𝗍𝗌      : " + member.totalOwns.root + "\n"
              + "  💻 𝖴𝗌𝖾𝗋𝗌      : " + member.totalOwns.user + "\n"
              + "  ⚙️ 𝖢𝗁𝖺𝗅𝗅𝖾𝗇𝗀𝖾𝗌  : " + member.totalOwns.challenge + "\n"
              + "- 🔴 𝟣𝗌𝗍 𝖡𝗅𝗈𝗈𝖽𝗌  : " + member.stats.bloods + "\n"
              // + (challenge.unreleased ? FMT('- Replaces : ') + challenge.unreleased.replaces : '')
              + "\n```"
					},
				]
			}
		}
		)
	} else {
		message.reply("Sorry, I don't know a '" + username + "'. 🤔")
	}
}

function sendChallengeInfoMsg(message, challengeName) {
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
					url: "https://www.hackthebox.eu/home/challenges/" + challenge.category,
				},
				description: ("AEIOU".includes(challenge.category.toUpperCase().charAt(0)) ? "An " : "A ") +
          challenge.category.toLowerCase() + " challenge by **["
          + challenge.maker.name
          + "](https://www.hackthebox.eu/home/users/profile/"
          + challenge.maker.id.toString()
          + ")"
          + (challenge.maker2 ? "** & **[" + challenge.maker2.name + "](https://www.hackthebox.eu/home/users/profile/" + challenge.maker2.id.toString() + ")" : "")
          + "**.\n> _" + challenge.description + "_\n",
				thumbnail: {
					url: "",
				},
				footer: {
					text: "ℹ️  Challenges last updated " + timeSince(LAST_UPDATE)
				},
				fields: [
					{
						name: "` " + FMT("  " + difficultySymbol(difficulty) + " ", "s") + FMT(difficulty, "bs") + "     `", inline: false,
						value: "```diff\n"
              + FMT((!challenge.isActive ? "- Status   : " : "  Status   : "), "s") + (!challenge.isActive ? "🧟 Retired" : (challenge.releaseDate > (new Date()).getTime() ? "🔥 𝗨𝗡𝗥𝗘𝗟𝗘𝗔𝗦𝗘𝗗" : "👾 Active")) + "\n"
              + "+" + FMT(" Points   : ", "s") + challenge.points + "\n"
              + "+" + FMT(" Solved   : ", "s") + challenge.solverCount + " times.\n"
              + "+" + FMT(" Released : ", "s") + new Date(challenge.releaseDate).toDateString() + "\n"
              + "+" + FMT(" Rating   : ", "s") + "🍏: " + challenge.upvotes + " 🍎: " + challenge.downvotes + "\n"
              + "+" + FMT(" Age     : ", "s") + elapsedDays(new Date(challenge.releaseDate)) + " days\n"
              // + (challenge.unreleased ? FMT('- Replaces : ') + challenge.unreleased.replaces : '')
              + "\n```"
					},
				]
			}
		}
		)
	} else {
		message.reply("ጠﻉ乇የ ᙏØɾየ")
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
	case "Easy": return "📗"
	case "Medium": return "📘"
	case "Hard": return "📙"
	case "Insane": return "📕"
	default: return "📓"
	}
}

function challengeSymbol(category) {
	switch (category.toLowerCase()) {
	case "reversing": return "↩️"
	case "crypto": return "👩‍💻️"
	case "stego": return "🖼️"
	case "pwn": return "🧊"
	case "forensics": return "🔎"
	case "misc": return "🎲"
	case "mobile": return "☎️"
	case "osint": return "🌐"
	case "hardware": return "🧰"
	default: return "❓"
	}
}

function boxOsSymbol(category) {
	switch (category.toLowerCase()) {
	case "Linux": return "🐧"
	case "Windows": return any("🔷", "🔶", "💠")
	case "Solaris": return "☀️"
	case "FreeBSD": return "😈"
	case "Android": return "🍈"
	default: return "❓"
	}
}

function rankSymbol(rankText) {
	switch (rankText) {
	case "Noob": return "👽"
	case "Script Kiddie": return "🐍"
	case "Hacker": return "🤖"
	case "Pro Hacker": return "👩‍💻"
	case "Elite Hacker": return "👾"
	case "Guru": return "🔮"
	case "Omniscient": return "🧙"
	case "Admin": return "🤺"
	default: return "💯"
	}
}








/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {Object} message A Discord Message object.
 */
async function understand(message) {
	var sessionPath = dflow.sessionPath(process.env.GOOGLE_CLOUD_PROJECT, message.author.id)
	console.log("Sending message to DialogFlow for comprehension. Session ID:", sessionPath)
	return new Promise(async resolve => {
		const request = {
			session: sessionPath,
			queryInput: {
				text: {
					// The query to send to the dialogflow agent
					text: message.content,
					// The language used by the client (en-US)
					languageCode: "en",
				},
			},
		}

		const responses = await dflow.detectIntent(request)
		console.log("Detected intent")
		const result = responses[0].queryResult
		//console.log(`  Full response: ${JSON.stringify(result)}`);
		console.warn(`  Query: ${result.queryText}`)
		console.info(`  Response: ${result.fulfillmentText}`)

		if (result.intent) {
			console.log(`  Intent: ${result.intent.displayName}`)
		} else {
			console.log("  No intent matched.")
		}
		resolve(result)
	})
}

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array)
	}
}

var KEYSTROKE = 7
async function humanSend(message, msg, noMention) {
	return new Promise(async resolve => {
		if (!msg || msg.length == 0 || msg == undefined) {
			msg = " "
		}
		var msgLines = msg.split("\\n")
		if (noMention) {
			var firstline = false
		} else {
			var firstline = true
		}
		await asyncForEach(msgLines, async ln => {
			message.channel.startTyping()
			//console.log(ln)
			if (Math.random() < 0.1) { // random chance we'll try to generate a typo
				var typoData = typoify.typo(ln)
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
						await message.reply((Math.random() > 0.5 ? "*" : "") + typoData[0])
					} else {
						await message.channel.send((Math.random() > 0.5 ? "*" : "") + typoData[0])
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
		})
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

async function sendIncompleteBoxesByMemberMsg(message, note, username) {
	boxIds = []
	var member = tryGetValidMember(username, message.author.username)
	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}
	if (member) {
		uid = member.id
		console.log("Constructing incomplete boxes by member message... [", "UID:", uid, "Username: ", username, "]")
		Object.values(MACHINES).sort((a, b) => (Number(a.id) < Number(b.id)) ? 1 : -1).forEach(machine => {
			var match = machine.rootOwners.find(user => user.uid === uid)
			if (!match) {
				boxIds.push(machine.id)
			}
		})
		console.log

		twentyPlus = false
		console.log("Constructing an incomplete box tally message for " + username + "...")
		var ownedBoxList = getMdLinksForBoxIds(boxIds)
		if (ownedBoxList) {
			if (ownedBoxList.length > 15) {
				ownedBoxList = ownedBoxList.slice(0, 15)
				twentyPlus = true
			}
			message.channel.send({
				embed: {
					color: 15105570,
					author: {
						name: (uid in TEAM_MEMBERS ? tryDiscordifyUid(member.id) + ": Incomplete machines" : "٩(͡๏̯͡๏)۶"),
						icon_url: member.thumb,
						url: "https://www.hackthebox.eu/home/users/profile/" + uid,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ((twentyPlus ? ownedBoxList.join(", ") : (ownedBoxList.length < 10 ? andifyList(ownedBoxList.join("\n")) : andifyList(ownedBoxList.join(", ")))) + (twentyPlus ? " […]" : "")).substring(0, 2040)
				}
			}
			)
		} else {
			message.channel.send("Looks like " + tryDiscordifyUid(member.id) + " has done them all!!! 👑\n(Is that even possible???)")
		}

	} else {
		message.channel.send("Sorry, I don't know a '" + username + "'. 🤔")
	}
}

async function sendOwnedBoxesByMemberMsg(message, note, username) {
	boxIds = []
	var member = tryGetValidMember(username, message.author.username)

	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}

	if (member) {
		var uid = member.id
		console.log("Constructing owned boxes by member message... [", "UID:", uid, "Username: ", username, "]")
		Object.values(MACHINES).sort((a, b) => (Number(a.id) < Number(b.id)) ? 1 : -1).forEach(machine => {
			var match = machine.rootOwners.find(user => user.uid === uid)
			if (match) {
				boxIds.push(machine.id)
			} else {
				// console.error("User w/ ID of '" + uid + "' not found.")
			}
		})
		console.log

		twentyPlus = false
		console.log("Constructing a box ownage tally message for " + username + "...")
		var ownedBoxList = getMdLinksForBoxIds(boxIds)
		if (ownedBoxList) {
			if (ownedBoxList.length > 15) {
				ownedBoxList = ownedBoxList.slice(0, 15)
				twentyPlus = true
			}
			message.channel.send({
				embed: {
					color: "AQUA",
					author: {
						name: (uid in TEAM_MEMBERS ? "Root ownage for " + tryDiscordifyUid(member.id) : "٩(͡๏̯͡๏)۶"),
						icon_url: member.thumb,
						url: "https://www.hackthebox.eu/home/users/profile/" + uid,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ((twentyPlus ? ownedBoxList.join(", ") : (ownedBoxList.length < 10 ? andifyList(ownedBoxList.join("\n")) : andifyList(ownedBoxList.join(", ")))) + (twentyPlus ? " […] 👑" : "")).substring(0, 2040)
				}
			}
			)
		} else {
			message.channel.send("Looks like " + tryDiscordifyUid(member.id) + " hasn't completed any boxes yet.")
		}

	} else {
		message.channel.send("Sorry, I don't know a '" + username + "'. 🤔")
	}
}

async function sendOwnedChallengesByMemberMsg(message, note, username) {
	console.log(username)
	var challengeNames = []
	var member = tryGetValidMember(username, message.author.username)

	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}

	if (member) {
		uid = member.id
		console.log("UID: ", uid)
		Object.values(CHALLENGES).forEach(challengecategory => {
			challengecategory.forEach(challenge => {
				var match = challenge.owners.find(user => user.uid === uid)
				if (match) {
					console.log(challenge.name + " completed by " + tryDiscordifyUid(member.id) + ": YES")
					challengeNames.push(challenge.name)
				} else {
					// console.error("User w/ ID of '" + uid + "' not found.")
				}
			})
		})
		console.log
		console.log("Constructing a box ownage tally message for " + tryDiscordifyUid(member.id) + "...")
		var ownedChallengeLinks = getMdLinksForChallengeCategoriesByChallengeNames(challengeNames)
		if (ownedChallengeLinks) {
			categoryOverflows = {}
			Object.keys(CHALLENGES).forEach(challengeCategoryName => {
				categoryOverflows[challengeCategoryName] = false
			})


			for (let i = 0; i < Object.keys(ownedChallengeLinks).length; i++) {
				const catKey = Object.keys(ownedChallengeLinks)[i]
				const catList = ownedChallengeLinks[catKey]

				if (catList.length > 15) {
					categoryOverflows[catKey] = true
					ownedChallengeLinks[catKey] = ownedChallengeLinks[catKey].slice(0, 15)
				}
			}

			catFields = []

			Object.keys(ownedChallengeLinks).forEach(challengeCategory => {
				// console.log(ownedChallengeLinks[challengeCategory])
				catFields.push(
					{
						name: challengeCategory, inline: true,
						value: (ownedChallengeLinks[challengeCategory].length == 0 ? "∅" : (categoryOverflows[challengeCategory] ? ownedChallengeLinks[challengeCategory].join(", ") : (ownedChallengeLinks[challengeCategory].length < 10 && ownedChallengeLinks[challengeCategory].length > 0 ? andifyList(ownedChallengeLinks[challengeCategory].join("\n")) : andifyList(ownedChallengeLinks[challengeCategory].join(", ")))) + (categoryOverflows[challengeCategory] ? " […] 👑" : ""))
					})
			})
			console.log(catFields)
			message.channel.send({
				embed: {
					color: "AQUA",
					author: {
						name: "Challenge ownage for " + tryDiscordifyUid(member.id),
						icon_url: member.thumb,
						url: "https://www.hackthebox.eu/home/users/profile/" + uid,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Challenge owns by category:**"),
					fields: catFields
				}
			}
			)
		} else {
			message.channel.send("Looks like " + tryDiscordifyUid(member.id) + " hasn't completed any challenges yet.")
		}

	} else {
		message.channel.send("Sorry, I don't know a '" + username + "'. 🤔")
	}
}


async function sendIncompleteChallengesByMemberMsg(message, note, username) {
	console.log(username)
	var challengeNames = []
	var member = tryGetValidMember(username, message.author.username)

	if (checkSelfName(username) && !member) {
		humanSend(message, (maybe(0.4) ? "" : "Hmm... ") + "I don't know who you are yet! Try saying `I am (username) on HTB` to associate your HTB account with your Discord username.\n(You can find my man page with the `help` command anytime.)")
		return
	}

	if (member) {
		var uid = member.id
		console.log("UID: ", uid)
		Object.values(CHALLENGES).forEach(challengecategory => {
			challengecategory.forEach(challenge => {
				var match = challenge.owners.find(user => user.uid === uid)
				if (!match) {
					console.log(challenge.name + " not completed by " + tryDiscordifyUid(member.id) + ": TRUE")
					challengeNames.push(challenge.name)
				} else {
					// console.error("User w/ ID of '" + uid + "' not found.")
				}
			})
		})
		console.log
		console.log("Constructing an incomplete challenge tally message for " + tryDiscordifyUid(member.id) + "...")
		var ownedChallengeLinks = getMdLinksForChallengeCategoriesByChallengeNames(challengeNames)
		if (ownedChallengeLinks) {
			categoryOverflows = {}
			Object.keys(CHALLENGES).forEach(challengeCategoryName => {
				categoryOverflows[challengeCategoryName] = false
			})


			for (let i = 0; i < Object.keys(ownedChallengeLinks).length; i++) {
				const catKey = Object.keys(ownedChallengeLinks)[i]
				const catList = ownedChallengeLinks[catKey]

				if (catList.length > 15) {
					categoryOverflows[catKey] = true
					ownedChallengeLinks[catKey] = ownedChallengeLinks[catKey].slice(0, 15)
				}
			}

			catFields = []

			Object.keys(ownedChallengeLinks).forEach(challengeCategory => {
				// console.log(ownedChallengeLinks[challengeCategory])
				catFields.push(
					{
						name: challengeCategory, inline: true,
						value: (ownedChallengeLinks[challengeCategory].length == 0 ? "👑 All done!" : (categoryOverflows[challengeCategory] ? ownedChallengeLinks[challengeCategory].join(", ") : (ownedChallengeLinks[challengeCategory].length < 10 && ownedChallengeLinks[challengeCategory].length > 0 ? andifyList(ownedChallengeLinks[challengeCategory].join("\n")) : andifyList(ownedChallengeLinks[challengeCategory].join(", ")))) + (categoryOverflows[challengeCategory] ? " […]" : ""))
					})
			})
			console.log(catFields)
			message.channel.send({
				embed: {
					color: 16737095,
					author: {
						name: tryDiscordifyUid(member.id) + ": Incomplete challenges",
						icon_url: member.thumb,
						url: "https://www.hackthebox.eu/home/users/profile/" + uid,
					},
					footer: {
						text: "ℹ️  Ownage data last updated " + timeSince(LAST_UPDATE)
					},
					description: ("**Challenges, incomplete, by category:**"),
					fields: catFields
				}
			}
			)
		} else {
			message.channel.send("Looks like " + tryDiscordifyUid(member.id) + " has done them all!!! 👑\n(Is that even possible???)")
		}

	} else {
		message.channel.send("Sorry, I don't know a '" + username + "'. 🤔")
	}
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
			await humanSend(message, any("Associated HTB user " + uidToUname(id) + " (" + id + ")", "HTB user " + uidToUname(id) + " (" + id + ") has been linked") + " to your Discord account (" + message.author.tag + ")", true)
			updateCache(["discord_links"])
			//exportData(DISCORD_LINKS, "discord_links.json")
		} catch (error) { console.log(error) }
		break

	case "uname": try {
		console.log("ID:", id)
		DISCORD_LINKS[unameToUid(id)] = message.author
		await humanSend(message, "Associated HTB user " + uidToUname(unameToUid(id)) + " (" + unameToUid(id) + ") to your Discord account (" + message.author.tag + ")", true)
		updateCache(["discord_links"])
		// exportData(DISCORD_LINKS, "discord_links.json")
	} catch (error) { console.log(error) }
		break
	default:
		break
	}

}

async function unlinkDiscord(message, id) {
	if (id in DISCORD_LINKS) {
		try {
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
		 break
	case "discord":
		unlinkDiscord(message, uid)
		break
	case "all":
		try {
			ignoreMember(uid)
		} catch (error) {
			console.error(error)
		}
		unlinkDiscord(message, uid)
		await humanSend(message, "Forgetting any HTB data and Discord association for this user and ignoring future achievements.", true); break
	default:
		break
	}

}

function genBadgeUrl() {
	return (HTBROOT + "badge/team/image/2102?nonce=" + genRanHex(4))
}



async function doFakeReboot(message, note) {
	await humanSend(message, note, true)
	await client.user.setStatus("idle")
		.then(console.log)
		.catch(console.error)
	await wait(3500)
	await client.user.setStatus("online")
		.then(console.log)
		.catch(console.error)
}

async function admin_setStatus(message, params) {
	if (message.author.id == process.env.ADMIN_DISCORD_ID) {
		status = params.discordStatusType.stringValue
		activity = params.discordStatusActivity.stringValue
		actverb = params.discordStatusVerb.stringValue
		humanSend(message, any("You're the boss!\nsetting the status 😊",
			"Ok " + message.author.username + ", you got it!",
			"you got it, " + message.author.username + " 😁",
			"no prob, i'm on it 🍉",
			"ok, on it! 🍉"), false)
		await setStatus(message.client, (status ? status : "online"), (actverb ? actverb : ""), (activity ? activity : ""))
	} else {
		humanSend(message, "You're not the boss. 👔\nTry asking __@Propolis__!")
	}
}


async function admin_forceUpdate(message) {
	if (message.author.id == process.env.ADMIN_DISCORD_ID) {
		humanSend(message, any("You're the boss!\nupdating the DB 😊",
			"Ok " + message.author.username + ", you got it!",
			"you got it, boss! 😁",
			"no prob, i'm on it 🍉",
			"ok, on it! 🍉"), false)
		await updateData(message.client)
		humanSend(message, any("hey I finished updating the DB! 😊",
			"Heyo, the DB update is finished!",
			"The data has been updated!",
			"DB update complete!",
			"Achivement data has been updated. 😊"), false)
	} else {
		humanSend(message, "You're not my boss! 🤔\nno can do.\nAsk __@Propolis__!")
	}
}

const checkIsSevenMsg = /[\t ]?seven\W?/g





async function handleMessage(message) {
	if (message.channel.type == "dm" || message.content.toLowerCase().includes("seven")) {
		if (!message.author.bot) {
			if (message.content.toLowerCase().match(checkIsSevenMsg)) {
				message.content = message.content.toLowerCase().replace(checkIsSevenMsg, "")
			}
			var htbItem = tryResolveEntityByName(message.content)
			if (htbItem) {
				switch (htbItem.type) {
				case "member": try { sendMemberInfoMsg(message, htbItem.ent.name) } catch (e) { message.channel.stopTyping(true); console.log(e) } break
				case "machine": try { sendBoxInfoMsg(message, htbItem.ent.name) } catch (e) { console.log(e) } break
				case "challenge": try { sendChallengeInfoMsg(message, htbItem.ent.name) } catch (e) { console.log(e) } break
				default: break
				}
			} else {
				var result = await understand(message)
				var isRipe = result.allRequiredParamsPresent
				console.log("result.intent: " + result.intent.displayName + "  |  isRipe(hasParams): " + isRipe)
				if (result.intent && isRipe) {
					var job = result.intent.displayName
					var inf = result.parameters.fields
					console.log("jobinf: " + job + " | " + JSON.stringify(inf))
					message.channel.startTyping()
					switch (job) {
					// case "removeLastXMessages": break;
					case "admin.forceUpdateData": try { admin_forceUpdate(message) } catch (e) { console.log(e) } break
					case "admin.setStatus": try { admin_setStatus(message, inf) } catch (e) { console.log(e) } break
					case "help": try { sendHelpMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "forgetMe.htbIgnore.getUserID": try { forgetHtbDataFlow(message, "htb", inf.uid.numberValue) } catch (e) { console.log(e) } break
					case "forgetMe.discordUnlink.getUserID": try { forgetHtbDataFlow(message, "discord", inf.uid.numberValue) } catch (e) { console.log(e) } break
					case "forgetMe.all.getUserID": try { forgetHtbDataFlow(message, "all", inf.uid.numberValue) } catch (e) { console.log(e) } break
					case "linkDiscord": try { linkDiscord(message, ("numberValue" in Object.keys(inf.uid) ? "uid" : "uname"), ("numberValue" in Object.keys(inf.uid) ? inf.uid.numberValue : inf.username.stringValue)) } catch (e) { console.log(e) } break
					case "unforgetMe": try { unignoreMember(inf.uid.numberValue); humanSend(message, result.fulfillmentText, true) } catch (e) { console.log(e) } break
					case "getTeamBadge": try { humanSend(message, genBadgeUrl() + "\n" + result.fulfillmentText, true) } catch (e) { console.log(e) } break
					case "getTeamInfo": try { sendTeamInfoMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "getTeamLeaders": try { sendTeamLeadersMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "getTeamLeader": try { sendTeamLeaderMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "getTeamRanking": try { sendTeamRankingMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "getFlagboard": try { sendFlagboardMsg(message) } catch (e) { console.log(e) } break
					case "getBoxInfo": try { sendBoxInfoMsg(message, inf.machines.stringValue) } catch (e) { console.log(e) } break
					case "getBoxOwners": try { sendBoxOwnersMsg(message, inf.machines.stringValue) } catch (e) { console.log(e) } break
					case "getOwnedBoxesByMember": try { sendOwnedBoxesByMemberMsg(message, result.fulfillmentText, inf.username.stringValue) } catch (e) { console.log(e) } break
					case "checkMemberOwnedBox": try { sendCheckMemberOwnedBoxMsg(message, inf.boxname.stringValue, inf.username.stringValue) } catch (e) { console.log(e) } break
					case "checkMemberOwnedChallenge": try { sendCheckMemberOwnedChallengeMsg(message, inf.challengename.stringValue, inf.username.stringValue) } catch (e) { console.log(e) } break
					case "getIncompleteBoxesByMember": try { sendIncompleteBoxesByMemberMsg(message, result.fulfillmentText, inf.username.stringValue) } catch (e) { console.log(e) } break
					case "getOwnedChallengesByMember": try { sendOwnedChallengesByMemberMsg(message, result.fulfillmentText, inf.username.stringValue) } catch (e) { console.log(e) } break
					case "getIncompleteChallengesByMember": try { sendIncompleteChallengesByMemberMsg(message, result.fulfillmentText, inf.username.stringValue) } catch (e) { console.log(e) } break
					case "getLastBoxOwner": try { sendLastBoxOwnerMsg(message, inf.machines.stringValue) } catch (e) { console.log(e) } break
					case "getBoxLaunchDate": try { sendBoxInfoMsg(message, inf.machines.stringValue) } catch (e) { console.log(e) } break
					case "getBoxRetireDate": try { sendBoxInfoMsg(message, inf.machines.stringValue) } catch (e) { console.log(e) } break
					case "getTotalBoxCount": try { sendTotalBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "getActiveBoxCount": try { sendActiveBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "getRetiredBoxCount": try { sendRetiredBoxCountMsg(message, result.fulfillmentText) } catch (e) { console.log(e) } break
					case "getFirstBox": try { sendBoxInfoMsg(message, "Lame") } catch (e) { console.log(e) } await humanSend(message, result.fulfillmentText); break
					case "agent.doReboot": doFakeReboot(message, result.fulfillmentText); break
					case "getNewBox": sendBoxInfoMsg(message, getNewReleaseName()); break
					case "getChallengeInfo": try { sendChallengeInfoMsg(message, inf.challengeName.stringValue) } catch (e) { console.log(e) } break
					case "getChallengeOwners": try { sendChallengeOwnersMsg(message, inf.challengeName.stringValue) } catch (e) { console.log(e) } break
					case "getLastChallengeOwner": try { sendLastChallengeOwnerMsg(message, inf.challengeName.stringValue) } catch (e) { console.log(e) } break
					case "getMemberInfo": try { sendMemberInfoMsg(message, inf.username.stringValue) } catch (e) { message.channel.stopTyping(true); console.log(e) } break
					case "getMemberRank": try { sendMemberRankMsg(message, inf.username.stringValue) } catch (e) { message.channel.stopTyping(true); console.log(e) } break
					case "getMemberChart": console.log("GOT HERE..."); message.reply(new Discord.MessageAttachment(new Buffer(sampleChart, "base64"))); break
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
}

