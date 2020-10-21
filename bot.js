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

/*** IMPORT STUFF ***/

const Discord = require("discord.js")
const client = new Discord.Client()
const fs = require("fs")
const { struct } = require("pb-util")
const { Format: F } = require("./helpers/format")
const dialogflow = require("dialogflow").v2beta1
const dflow = new dialogflow.SessionsClient({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS) })
const strings = require("./static/strings")
const { Helpers: H } = require("./helpers/helpers.js")
const { HtbPusherSubscription } = require("./helpers/pusher-htb")
const pgp = require("pg-promise")({ capSQL: true })
const htbCharts = require("./modules/charts/index.js")
const { HtbEmbeds } = require("./views/embeds.js")
const { SevenDatastore } = require("./models/SevenDatastore.js")
const { Send } = require("./modules/send.js")
const { HTBEmoji } = require("./helpers/emoji.js")



/*** INIT GLOBAL STUFF ***/

var DISCORD_ANNOUNCE_CHAN = false         // The Discord Channel object intended to recieve Pusher achievements.
var HTB_PUSHER_OWNS_SUBSCRIPTION = false  // The Pusher Client own channel subscription.
// var PUSHER_MSG_LOG = require("./cache/PUSHER_MSG_LOG.json")


const CHART_RENDERER = htbCharts.newChartRenderer()
const DAT = new SevenDatastore()    // Open an abstract storage container for HTB / bot data
const E = new HTBEmoji(client)
const EGI = new HtbEmbeds(DAT, E) 			// Give Embed Constructor access to the datastore
const SEND = new Send()

/*** HANDLE DEVELOPMENT INSTANCE CASE ***/

var DEV_MODE_ON = false

if (process.env.IS_DEV_INSTANCE) {
	DEV_MODE_ON = true
	console.error("DEVELOPMENT MODE ON.\n  Only queries by the developer will be responded to by this instance.\n  (Avoids conflicts/ duplicate responses in production use)")
}


/* SETUP DB IMPORT TO RESTORE LAST GOOD STATE */
const cn = {
	connectionString: process.env.DATABASE_URL,
	ssl: (process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false })
}

const DB_FIELDNAMES_AUTO = ["MACHINES", "CHALLENGES", "TEAM_MEMBERS", "TEAM_MEMBERS_IGNORED", "TEAM_STATS", "DISCORD_LINKS", "MISC"]
const db = pgp(cn)

/** Imports globals from the cloud backup (Objects stored as raw, singular JSON columns in DB)
 * @returns {Promise}
*/
async function importDbBackup() {
	return db.any("SELECT json FROM cache ORDER BY id ASC;", [true]).then(
		rows => {
			DAT.MACHINES = JSON.parse(rows[0].json)
			DAT.CHALLENGES = JSON.parse(rows[1].json)
			DAT.TEAM_MEMBERS = JSON.parse(rows[2].json)
			DAT.TEAM_MEMBERS_IGNORED = JSON.parse(rows[3].json)
			DAT.TEAM_STATS = JSON.parse(rows[4].json)
			DAT.DISCORD_LINKS = JSON.parse(rows[5].json)
			DAT.MISC = JSON.parse(rows[6].json)
			console.log("IMPORT: Restored from DB backup.")
			console.info(`Machines   : ${Object.values(DAT.MACHINES).length}` + "\n" +
									`Challenges : ${Object.values(DAT.CHALLENGES).length}` + "\n" +
									`Members    : ${Object.values(DAT.TEAM_MEMBERS).length}${(DAT.kTMI.length ? " tracked, " + DAT.kTMI.length + " untracked":"")}` + "\n" +
									`Linked DC  : ${Object.values(DAT.DISCORD_LINKS).length}`)
		}
	).catch(
		err => console.error(err)
	)
}


/** Updates the cloud backup, with options for selective update. 
 * @param {string[]} fields - The specific data types / buffers specified for the update operation, e.g. ["MACHINES","TEAM_MEMBERS"]
*/
async function updateCache(fields = DB_FIELDNAMES_AUTO) {
	var fieldData = []
	for (let i = 0; i < fields.length; i++) {
		var fieldName = fields[i]
		switch (fieldName.toLowerCase()) {
		case "machines": fieldData.push({ id: 1, json: DAT.MACHINES }); break
		case "challenges": fieldData.push({ id: 2, json: DAT.CHALLENGES }); break
		case "team_members": fieldData.push({ id: 3, json: DAT.TEAM_MEMBERS }); break
		case "team_members_ignored": fieldData.push({ id: 4, json: DAT.TEAM_MEMBERS_IGNORED }); break // These should only update manually
		case "team_stats": fieldData.push({ id: 5, json: DAT.TEAM_STATS }); break
		case "discord_links": fieldData.push({ id: 6, json: DAT.DISCORD_LINKS }); break               // These should only update manually
		case "misc": fieldData.push({ id: 7, json: DAT.MISC }); break
		default:
			break
		}
	}
	console.info("About to push this data to the DB: ")
	console.dir(fieldData, { depth: 1 } )
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


/**
 * Returns whether the provided Discord user has admin privileges.
 * @param {Discord.User} author 
 * @returns {boolean}
 */
function isAdmin(author) {
	return author.id == process.env.ADMIN_DISCORD_ID
}

/**
 * Moves a member to the 'ignored' set, meaning that their data will not be updated
 * or shared by the bot until the user undoes this (see unignoreMember()).
 * @param {number} uid 
 */
function ignoreMember(uid) {
	if (uid in DAT.TEAM_MEMBERS) {
		console.log(`Before ignoring member #${uid}: ${DAT.kTM.length} already ignored --`)
		console.log(DAT.kTMI.join("\n"))
		DAT.TEAM_MEMBERS_IGNORED[uid] = DAT.TEAM_MEMBERS[uid]
		delete DAT.TEAM_MEMBERS[uid]
		updateCache(["team_members", "team_members_ignored"])
		// exportData(TEAM_MEMBERS, "team_members.json");
		// exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
		console.log(`After ignoring: ${DAT.kTM.length} ignored.`)
		return DAT.TEAM_MEMBERS_IGNORED[uid].name
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
	if (uid in DAT.TEAM_MEMBERS_IGNORED) {
		DAT.TEAM_MEMBERS[uid] = DAT.TEAM_MEMBERS_IGNORED[uid]
		delete DAT.TEAM_MEMBERS_IGNORED[uid]
		updateCache(["team_members", "team_members_ignored"])
		console.warn("DONE.")
		return DAT.TEAM_MEMBERS[uid].name
	} else {
		return false
	}
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
	var keys = Object.keys(DAT.DISCORD_LINKS)
	var guild = await client.guilds.resolve(guildIdString)

	for (let i = 0; i < keys.length; i++) {
		var link = DAT.DISCORD_LINKS[keys[i]]
		try {
			var guildMember = await guild.members.resolve(link.id) || false
			if (guildMember) {
				var member = guildMember.user
				DAT.DISCORD_LINKS[keys[i]] = member || DAT.DISCORD_LINKS[i]
			}
		} catch (error) {
			console.error(error)
		}
	}
	updateCache(["DISCORD_LINKS"])
}

async function refresh(){
	await DAT.update()
	HTB_PUSHER_OWNS_SUBSCRIPTION.auth = DAT.V3API.CSRF_TOKEN
}

async function main() {
	await importDbBackup()
	DAT.TEAM_STATS.teamFounder = process.env.FOUNDER_HTB_ID
	await DAT.init()

	var HTB_PUSHER_OWNS_SUBSCRIPTION = new HtbPusherSubscription("97608bf7532e6f0fe898",
		[
			{channel: "owns-channel", event: "display-info"},
			{channel: "notifications-channel", event: "display-notifications"},
			{channel: "infobox-channel", event: "display-info"},
			{channel: "shoutbox-channel", event: "display-shout"},
			{channel: "joins-channel", event: "display-info"}
		], DAT.V3API.CSRF_TOKEN)
	// refresh().then(console.log("Initial update completed!"))
	
	setInterval(async () => {
		await refresh()
		console.log("Data refresh completed!")
		var updated = await updateCache()
		if (updated) {console.log("Updated the DB...")}
	}, 5 * 60 * 1000)
	HTB_PUSHER_OWNS_SUBSCRIPTION.on("pusherevent", async message => {
		try {
			switch (message.type) {
			case "machine": case "challenge": case "endgame": case "fortress": case	"prolab":
				if (DAT.DISCORD_LINKS[message.uid]) {
					DISCORD_ANNOUNCE_CHAN.send(EGI.pusherOwn(DAT.resolveEnt(message.uid,"member",true,null,true), message.target, message.flag || message.type))
				}
				if (DAT.TEAM_MEMBERS[message.uid]) {
					DAT.integratePusherOwn(message.uid, message.time, message.type, message.target, null, true)
				}
				break
			default:
				// DISCORD_ANNOUNCE_CHAN.send(EGI.pusherNotif(message.markdown))
				break
			}				
		} catch (error) {
			console.error(error)
		}
	
	})
	// updateData()


	client.login(process.env.BOT_TOKEN)               // BOT_TOKEN is the Discord client secret
	client.on("disconnect", function (erMsg, code) {
		console.warn("----- Bot disconnected from Discord with code", code, "for reason:", erMsg, "-----")
		client.connect()
	})

	client.on("ready", async () => {
		console.warn("INFO: Discord connection established...")
		console.log("CLIENT READY")

		DISCORD_ANNOUNCE_CHAN = await client.channels.fetch(process.env.DISCORD_ANNOUNCE_CHAN_ID.toString())

		/** Test the Pusher owns functionality */
		// var PUSHER_DUMMY_DATA = require("./cache/PUSHER_DUMMY_DATA.json")
		// PUSHER_DUMMY_DATA.slice(0,10).forEach(e => {console.info(e); HTB_PUSHER_OWNS_SUBSCRIPTION.channels[0].emit("display-info", {text: e, channel:"owns-channel"})})
		console.log("Discord account associations:", Object.values(DAT.DISCORD_LINKS).length)
		setInterval(() => updateDiscordIds(client, process.env.DISCORD_GUILD_ID.toString()), 30 * 60 * 1000)   // UPDATE OWNAGE DATA BY PARSING, EVERY 30 MINUTES
	})
	client.on("message", message => {
		message.content = message.content.substring(0, 255)
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
}

main()


async function sendFlagboardMsg(message) {
	await SEND.embed(message, EGI.teamFlagboard(), true)
	if (H.maybe(0.20)) await SEND.human(message, H.any("Globalization is a form of artificial intelligence. 🍉", "Teamwork makes the dream work 👑"), true)
}

async function sendTeamLeaderMsg(message) {
	var member = DAT.resolveEnt(DAT.getTopMembers(1), "member", true, message)
	await SEND.embed(message,EGI.teamLeader(member))
	if (H.maybe(0.6)) await SEND.human(message, "Let's give a round of applause!", true)
	if (H.maybe(0.4)) await SEND.human(message, "Pain is the heart of success. No one knows that like " + member.name + "! 🎉", true)
}

async function sendMemberChartMsg(message, username, term) {
	var member = DAT.resolveEnt(username, "member", false, message)
	var chartData = await DAT.V4API.getMemberAchievementChart(member.id, term)
	var chartImageB64 = await CHART_RENDERER.renderChart(member, chartData, term, "userProgress")
	var chartImage = new Buffer.from(chartImageB64, "base64")
	var embed = EGI.memberAchievementTimelineChart(member, term, chartImage)
	message.reply(embed)
}

async function sendActivityMsg(message, member, targetType=undefined, sortBy=undefined, sortOrder=undefined, limit=40) {
	var series = []
	var owns = await DAT.filterMemberOwns(member.id,targetType,"date","asc",limit)
	owns.sort((a, b) => Date.parse(b) - Date.parse(a))
	var orderedDates = owns.map(e => e.date).sort((a, b) => Date.parse(a) - Date.parse(b))
	if (orderedDates.length < 2){
		orderedDates.unshift((new Date(Date.now() - 604800000).toISOString()))
		orderedDates.push((new Date()).toISOString())
	}
	var dateRange = {oldest:new Date(orderedDates[0]), latest: new Date(), interval: new Date(orderedDates[orderedDates.length - 1])}
	console.log(owns)
	var types = ["user","root","challenge","endgame","fortress"]
	types.forEach(thisType => {
		var filtered = owns.filter(e => e.object_type==thisType || e.type == thisType)
		series.push(filtered.map((i,idx) => ([Date.parse(i.date),filtered.length-idx])))
	})
	series.forEach(e => {
		e.unshift([Date.parse(orderedDates[orderedDates.length - 1]) || (new Date()).getTime(), e.length || 0])
		e.push([Date.parse(orderedDates[0]) || (new Date()).getTime(), 0 ])
	})
	
	console.log(series)
	var chartImageB64 = await CHART_RENDERER.renderChart(member, null, null, "userActivity", series, dateRange)
	var chartImage = new Buffer.from(chartImageB64, "base64")
	SEND.embed(message, EGI.memberActivity(member, limit, targetType, sortOrder, sortBy, chartImage))
}


/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {Object} message A Discord Message object.
 */
function understand(message) {
	// console.log(dflow)
	//var sessionPath = dflow.environmentSessionPath(process.env.GOOGLE_CLOUD_PROJECT, "Production", "seven-server", message.author.id)
	var sessionPath = dflow.sessionPath(process.env.GOOGLE_CLOUD_PROJECT, message.author.id)
	console.log("Sending message to DialogFlow for comprehension. Session ID:", sessionPath)
	const request = {
		session: sessionPath,
		queryInput: {
			text: {
				// The query to send to the dialogflow agent
				text: message.cleanContent,
				// The language used by the client (en-US)
				languageCode: "en",
			},
		},
	}

	return dflow.detectIntent(request).then(
		responses => {
			console.log("Detected intent")
			const result = responses[0].queryResult
			console.log("  Full response:")
			// console.log(result)
			console.warn(`  Query: ${result.queryText}`)
			console.info(`  Response: ${result.fulfillmentText}`)

			if (result.intent) {
				console.log(`  Intent: ${result.intent.displayName}`)
			} else {
				console.log("  No intent matched.")
			}
			return result
		}
	)
}

async function sendHelpMsg(message, note) {
	if (note) {
		console.log("NOTE: " + note)
		await SEND.human(message, note, true)
	}
	await H.wait(300)
	await message.channel.send(strings.manual)
}

async function linkDiscord(message, idType, id) {
	switch (idType) {
	case "uid":
		try {
			DAT.DISCORD_LINKS[id] = message.author
			await SEND.human(message, H.any("Associated HTB user " + DAT.getMemberById(id).name + " (" + id + ")", "HTB user " + DAT.getMemberById(id).name + " (" + DAT.getMemberById(id).id + ") has been linked") + " to your Discord account (" + message.author.tag + ")", true)
			updateCache(["discord_links"])
			//exportData(DISCORD_LINKS, "discord_links.json")
		} catch (error) { console.log(error) }
		break

	case "uname": try {
		console.log("ID:", id)
		DAT.DISCORD_LINKS[DAT.getMemberByName(id).id] = message.author
		await SEND.human(message, H.any("Associated HTB user " + DAT.getMemberByName(id).name + " (" + id + ")", "HTB user " + DAT.getMemberByName(id).name + " (" + DAT.getMemberByName(id).id + ") has been linked") + " to your Discord account (" + message.author.tag + ")", true)
		updateCache(["discord_links"])
		// exportData(DISCORD_LINKS, "discord_links.json")
	} catch (error) { console.log(error) }
		break
	default:
		break
	}

}

async function unlinkDiscord(message, id) {
	if (id in DAT.DISCORD_LINKS) {
		try {
			delete DAT.DISCORD_LINKS[id]
			await SEND.human(message, "[Discord Unlink] Dissociated HTB user " + DAT.getMemberById(id).name + " (" + id + ") from Discord account (" + message.author.tag + ")", true)
			updateCache(["discord_links"])
			// exportData(DISCORD_LINKS, "discord_links.json")
			return true
		} catch (error) {
			await SEND.human(message, "[Discord Unlink] There was an issue dissociating '" + DAT.getMemberById(id).name + "' (" + id + ") from Discord account (" + message.author.tag + "). \nMaybe the id is wrong, or perhaps I wasn't tracking that in the first place.", true)
			console.log(error)
			return true
		}
	} else {
		await SEND.human(message, "[Discord Unlink] It looks like no Discord association exists for this user (make sure the ID is correct).\nNo changes were made.", true)
		return false
	}

}


async function forgetHtbDataFlow(message, identifier, uid) {
	switch (identifier) {
	case "htb":
		try {
			var deletedUname = ignoreMember(uid)
			if (deletedUname) {
				await SEND.human(message, "Blacklisted user " + uid + " (" + deletedUname + ") from future scans.", true)
			} else {
				await SEND.human(message, "It looks like no HTB user data is actually being collected for this user (make sure the ID is correct).", true)
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
		await SEND.human(message, "Forgetting any HTB data and Discord association for this user and ignoring future achievements.", true); break
	default:
		break
	}

}

async function doFakeReboot(message, note) {
	await SEND.human(message, note, true)
	await client.user.setStatus("idle")
		.then(console.log)
		.catch(console.error)
	await H.wait(3500)
	await client.user.setStatus("online")
		.then(console.log)
		.catch(console.error)
}

async function admin_setStatus(message, params) {
	if (message.author.id == process.env.ADMIN_DISCORD_ID) {
		var status = params.discordStatusType.stringValue
		var activity = params.discordStatusActivity.stringValue
		var actverb = params.discordStatusVerb.stringValue
		SEND.human(message, H.any("You're the boss!\nsetting the status 😊",
			"Ok " + message.author.username + ", you got it!",
			"you got it, " + message.author.username + " 😁",
			"no prob, i'm on it 🍉",
			"ok, on it! 🍉"), false)
		await setStatus(message.client, (status ? status : "online"), (actverb ? actverb : ""), (activity ? activity : ""))
	} else {
		SEND.human(message, "You're not the boss. 👔\nTry asking __@Propolis__!")
	}
}

async function admin_forceUpdate(message) {
	if (message.author.id == process.env.ADMIN_DISCORD_ID) {
		SEND.human(message, H.any("You're the boss!\nupdating the DB 😊",
			"Ok " + message.author.username + ", you got it!",
			"you got it, boss! 😁",
			"no prob, i'm on it 🍉",
			"ok, on it! 🍉"), false)
		await refresh()
		console.log("Data refresh completed!")
		await updateCache().then(SEND.human(message, H.any("hey I finished updating the DB! 😊",
			"Heyo, the DB update is finished!",
			"The data has been updated!",
			"DB update complete!",
			"Achivement data has been updated. 😊"), false))
	} else {
		SEND.human(message, "You're not my boss! 🤔\nno can do.\nAsk __@Propolis__!")
	}
}

async function admin_clearCached(message) {
	if (message.author.id == process.env.ADMIN_DISCORD_ID) {
		SEND.human(message, "Clearing the in-memory HTB data (not including ignored member or discord link settings)", false)
		DAT.MISC={}
		DAT.TEAM_MEMBERS = {}
		DAT.TEAM_STATS = {}
		DAT.MACHINES = {}
		DAT.CHALLENGES = {}
		updateCache(["MACHINES", "CHALLENGES", "TEAM_MEMBERS", "TEAM_STATS", "MISC"]).then(SEND.human(message, H.any("Done!"), false))
	} else {
		SEND.human(message, "You're not my boss! 🤔\nno can do.\nAsk __@Propolis__!")
	}
}

const checkIsSevenMsg = /[\t ]?seven\W?/g

async function handleMessage(message) {
	message.content = message.content.split("\n").filter(e => !e.startsWith("> ")).join("\n")
	if (message.content.toLowerCase() != "seven" && (message.channel.type == "dm" || message.content.toLowerCase().includes("seven"))) {
		if (!message.author.bot) {
			if (message.content.toLowerCase().match(checkIsSevenMsg)) {
				message.content = message.content.toLowerCase().replace(checkIsSevenMsg, "")
			}
			var htbItem = DAT.resolveEnt(message.content,null,null,message,false)
			if (message.content.toLowerCase().trim() == "help") {
				try { sendHelpMsg(message) } catch (e) { console.log(e) }
			} else if (htbItem) {
				try { SEND.embed(message, EGI.targetInfo(htbItem.type, htbItem.name,null,message,htbItem)) } catch (e) { console.error(e) }
			} else {
				var result = await understand(message)
				var isRipe = result.allRequiredParamsPresent
				console.log("result.intent: " + result.intent.displayName + "  |  isRipe(hasParams): " + isRipe)
				// console.dir(result)
				if (result.intent && isRipe) {
					var job = result.intent.displayName
					var inf = result.parameters.fields
					var params = struct.decode(result.parameters)
					if (Object.keys(params)) console.log(params)
					console.log("[DF] Query returned: " + job + " | " + JSON.stringify(inf))
					try {
						switch (job) {
						case "help": sendHelpMsg(message); break
						case "admin.forceUpdateData":  admin_forceUpdate(message); break
						case "admin.clearCached":  admin_clearCached(message); break
						case "admin.setStatus":  admin_setStatus(message, inf); break
						case "admin.clearEmoji":  E.clearCustEmoji(client).then(SEND.human(message, "Successfully purged Seven-related emoji from supporting channel.", false)); break
						case "admin.setupEmoji":  E.initCustEmoji(client).then(SEND.human(message, "Successfully initialized Seven-related emoji on supporting channel.", false)); break
						case "agent.getPickled":  if (!SEND.GET_PICKLED) {SEND.pickleOn(); SEND.human(message,"Alright, getting pickled!")} else { SEND.human(message, "` ERROR: circuits already scrambled... `")} break
						case "agent.getUnpickled":  if (SEND.GET_PICKLED) {SEND.pickleOff(); SEND.human(message,"Fine then...\nThat was kinda fun though. 😏")} else { SEND.human(message, "I'm already talking normally!!!")} break
						case "forgetMe.htbIgnore.getUserID":  forgetHtbDataFlow(message, "htb", params.uid); break
						case "forgetMe.discordUnlink.getUserID":  forgetHtbDataFlow(message, "discord", params.uid); break
						case "forgetMe.all.getUserID":  forgetHtbDataFlow(message, "all", params.uid); break
						case "linkDiscord":  linkDiscord(message, params.uid ? "uid" : "uname"), (params.uid ? params.uid : params.username); break
						case "unforgetMe":  unignoreMember(params.uid); SEND.human(message, result.fulfillmentText, true); break
						case "getTeamBadge":  SEND.human(message,F.noncifyUrl(`https://www.hackthebox.eu/badge/team/image/${DAT.TEAM_STATS.id}`),true).then(() => SEND.human(message, result.fulfillmentText, true)); break
						case "getTeamInfo": SEND.embed(message, EGI.teamInfo()); break
						case "getTeamLeaders": SEND.embed(message, EGI.teamLeaderboard()); break
						case "getTeamLeader":  sendTeamLeaderMsg(message, result.fulfillmentText); break
						case "getTeamRanking": SEND.embed(message, EGI.teamRank()); break
						case "getFlagboard":  sendFlagboardMsg(message); break
						case "getBoxInfo": SEND.embed(message, EGI.targetInfo("machine", params.machines)); break
						case "getTargetOwners": SEND.embed(message, EGI.teamOwnsForTarget(DAT.resolveEnt(params.target,params.ownType),undefined,params.ownType,params.ownFilter)); break
						case "checkMemberOwnedTarget": SEND.embed(message, EGI.checkMemberOwnedTarget(DAT.resolveEnt(params.username, "member", false, message), DAT.resolveEnt(params.targetname, params.targettype))); break
						case "getFirstBox":  SEND.embed(message, EGI.targetInfo("machine", "Lame")); await SEND.human(message, result.fulfillmentText); break
						case "agent.doReboot": doFakeReboot(message, result.fulfillmentText); break
						case "getNewBox": SEND.embed(message, EGI.targetInfo("machine", DAT.getNewBoxId(), true)); break
						case "getChallengeInfo": SEND.embed(message, EGI.targetInfo("challenge", params.challengeName)); break
						case "getMemberInfo": SEND.embed(message, EGI.targetInfo("member", params.username, false, message, DAT.resolveEnt(params.username, "member", false, message) || { type: null })); break
						case "getMemberRank": SEND.embed(message, EGI.memberRank(DAT.resolveEnt(params.username, "member", false, message))); break
						case "getMemberChart": console.log("GOT HERE..."); sendMemberChartMsg(message, params.username, (params.interval ? params.interval : "1Y")); break
						case "filterMemberOwns": sendActivityMsg(message,	DAT.resolveEnt(params.username, "member", false, message),
							params.targettype, params.sortby, params.sortorder,	params.limit || 24); break
						case "filterTargets": SEND.embed(message, EGI.filteredTargets(DAT.filterEnt(message,
							params.targettype, params.sortby, params.sortorder,	params.limit || 15,	null,	null, params.memberName, params.targetFilterBasis),
						params.sortby,
						params, message), true
						); break
						default:
							message.channel.stopTyping(true)
							if (result.fulfillmentText) {
								message.channel.startTyping()
								await SEND.human(message, result.fulfillmentText)
								message.channel.stopTyping(true)
							}
						}
					} catch (error) {
						console.error(error)
					}
					
					message.channel.stopTyping(true)
				} else {
					if (result.fulfillmentText) {
						message.channel.startTyping()
						await SEND.human(message, result.fulfillmentText)
					}
				}
			}

		}
	}
}

