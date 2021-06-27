/**
 * @module Seven
 */

const { Format: F } = require("./helpers/format")

/*** STARTUP | DECIDE ENV VAR SOURCE ***/
console.log("%c╔════════════════════╗\n║ seven-server 1.01a ║\n╚════════════════════╝","color:#9FEF00; font-weight:bold; font-size: 50")
F.logRainbow()
if (process.env.HEROKU) {
	console.log("Started at " + new Date().toLocaleTimeString() + " on Heroku. Using cloud-configured env vars")
} else {
	console.log("Started at " + new Date().toLocaleTimeString() + " on dev machine. Scanning ./config/env for vars")
	require("dotenv").config({ path: "./config/.env" })
}

/*** IMPORT STUFF ***/

const Discord = require("discord.js")
const client = new Discord.Client()
const fs = require("fs")
const { struct } = require("pb-util")
const dialogflow = require("@google-cloud/dialogflow").v2beta1
const dflow = new dialogflow.SessionsClient({ credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}") })
const strings = require("./static/strings")
const { Helpers: H } = require("./helpers/helpers.js")
const { HtbPusherSubscription } = require("./helpers/pusher-htb")
const pgp = require("pg-promise")({ capSQL: true })
const htbCharts = require("./modules/charts/index.js")
const { HtbEmbeds } = require("./views/embeds.js")
const { SevenDatastore } = require("./models/SevenDatastore.js")
// const { SevenApiServer } = require("./modules/seven-api-server.js")
const { Send } = require("./modules/send.js")
const { HTBEmoji } = require("./helpers/emoji.js")
const { BinClock: BC } = require("./helpers/binclock")

/*** HANDLE DEVELOPMENT INSTANCE CASE ***/

var DEV_MODE_ON = false

if (process.env.IS_DEV_INSTANCE) {
	DEV_MODE_ON = true
	console.error("DEVELOPMENT MODE ON.\n  Only queries by the developer will be responded to by this instance.\n  (Avoids conflicts/ duplicate responses in production use)")
}


/*** INIT GLOBAL STUFF ***/

var DISCORD_ANNOUNCE_CHAN = false         // The Discord Channel object intended to recieve Pusher achievements.
var HTB_PUSHER_OWNS_SUBSCRIPTION = false  // The Pusher Client own channel subscription.
const SEVEN_DB_TABLE_NAME = "seven_data"
var PUSHER_MSG_LOG = DEV_MODE_ON ? require("./cache/PUSHER_MSG_LOG.json") : null

var PHANTOM_POOL = null
const CHART_RENDERER = htbCharts.newChartRenderer()
const DAT = new SevenDatastore()    // Open an abstract storage container for HTB / bot data
// const API = new SevenApiServer(DAT, 666)
const E = new HTBEmoji(client)
const EGI = new HtbEmbeds(DAT, E) 			// Give Embed Constructor access to the datastore
const SEND = new Send()

/* SETUP DB IMPORT TO RESTORE LAST GOOD STATE */
const cn = {
	connectionString: process.env.DATABASE_URL,
	ssl: (process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false })
}

const DB_FIELDNAMES_AUTO = ["MACHINES", "CHALLENGES", "FORTRESSES", "ENDGAMES", "PROLABS", "TEAM_MEMBERS", "TEAM_MEMBERS_IGNORED", "TEAM_STATS", "DISCORD_LINKS", "MISC"]
const db = pgp(cn)

/** Imports globals from the cloud backup (Objects stored as raw, singular JSON columns in DB)
 * @returns {Promise}
*/
async function importDbBackup() {
	return db.any(`SELECT EXISTS (
		SELECT 1 
		FROM   pg_catalog.pg_class c
		JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
		WHERE    c.relname = '${SEVEN_DB_TABLE_NAME}'
		);`)
		.then(res => res[0].exists || false)
		.then(exists => {
			if (!exists) {
				console.warn("[SEVEN_DB]::: Table doesn't exist.")
				return db.any(`CREATE TABLE ${SEVEN_DB_TABLE_NAME}(
													id SERIAL PRIMARY KEY,
													name text DEFAULT 'Unknown'::text,
													json json DEFAULT '{}'::json
											);

											INSERT INTO ${SEVEN_DB_TABLE_NAME}(id,name,json) 
											VALUES
												(DEFAULT, 'machines', '{}'),
												(DEFAULT, 'challenges', '{}'),
												(DEFAULT, 'fortresses', '{}'),
												(DEFAULT, 'endgames', '{}'),
												(DEFAULT, 'prolabs', '{}'),
												(DEFAULT, 'team_members', '{}'),
												(DEFAULT, 'team_members_ignored', '{}'),
												(DEFAULT, 'team_stats', '{}'),
												(DEFAULT, 'discord_links', '{}'),
												(DEFAULT, 'misc', '{}');
												`).then(console.log("Inserted!"))}
			else {
				// console.log("[SEVEN_DB]::: Data table found.")
				return true
			}
		}).then( () => {
			return db.any(`SELECT json FROM ${SEVEN_DB_TABLE_NAME} ORDER BY id ASC;`, [true]).then(
				rows => {
					DAT.MACHINES = rows[0].json
					DAT.CHALLENGES = rows[1].json
					DAT.FORTRESSES = rows[2].json
					DAT.ENDGAMES = rows[3].json
					DAT.PROLABS = rows[4].json
					DAT.TEAM_MEMBERS = rows[5].json
					DAT.TEAM_MEMBERS_IGNORED = rows[6].json
					DAT.TEAM_STATS = rows[7].json
					DAT.DISCORD_LINKS = rows[8].json
					DAT.MISC = rows[9].json
					console.log("[DB IMPORT]::: Restored from DB backup.")
					console.info(`Machines   : ${Object.values(DAT.MACHINES).length}\n` +
								`Challenges : ${Object.values(DAT.CHALLENGES).length}\n` +
								`Fortresses : ${Object.values(DAT.FORTRESSES).length}\n` +
								`Endgames : ${Object.values(DAT.ENDGAMES).length}\n` +
								`Pro Labs : ${Object.values(DAT.PROLABS).length}\n` +
								`Members    : ${Object.values(DAT.TEAM_MEMBERS).length}${(DAT.kTMI.length ? " tracked, " + DAT.kTMI.length + " untracked":"")}\n` +
								`Linked DC  : ${Object.values(DAT.DISCORD_LINKS).length}`)
				}
			).catch(
				err => console.error(err)
			)

		})
}
// console.log()

// }


/** Updates the cloud backup, with options for selective update. 
 * @param {string[]} fields - The specific data types / buffers specified for the update operation, e.g. ["MACHINES","TEAM_MEMBERS"]
*/
async function updateCache(fields = DB_FIELDNAMES_AUTO) {
	var fieldData = []
	for (let i = 0; i < fields.length; i++) {
		var fieldName = fields[i]
		switch (fieldName.toLowerCase()) {
		case "machines": fieldData.push({ id: 1, json: JSON.stringify(DAT.MACHINES) }); break
		case "challenges": fieldData.push({ id: 2, json: JSON.stringify(DAT.CHALLENGES) }); break
		case "fortresses": fieldData.push({ id: 3, json: JSON.stringify(DAT.FORTRESSES) }); break
		case "endgames": fieldData.push({ id: 4, json: JSON.stringify(DAT.ENDGAMES) }); break
		case "prolabs": fieldData.push({ id: 5, json: JSON.stringify(DAT.PROLABS) }); break
		case "team_members": fieldData.push({ id: 6, json: JSON.stringify(DAT.TEAM_MEMBERS) }); break
		case "team_members_ignored": fieldData.push({ id: 7, json: JSON.stringify(DAT.TEAM_MEMBERS_IGNORED) }); break // These should only update manually
		case "team_stats": fieldData.push({ id: 8, json: JSON.stringify(DAT.TEAM_STATS) }); break
		case "discord_links": fieldData.push({ id: 9, json: JSON.stringify(DAT.D_STATIC) }); break               // These should only update manually
		case "misc": fieldData.push({ id: 10, json: JSON.stringify(DAT.MISC) }); break
		default:
			break
		}
	}
	const cs = new pgp.helpers.ColumnSet(["?id", { name: "json", cast: "json" }], { table: SEVEN_DB_TABLE_NAME })
	const update = pgp.helpers.update(fieldData, cs) + " WHERE v.id = t.id"
	return await db.result(update)
		.then(() => {
			console.log(`[DB BACKUP]::: Backed up ${F.andifyList(fields.map(e => `'${e}'`))} to DB for a rainy day.`)
			return true
		})
		.catch(e => {
			console.error(e)
			return false
		})
}

/**
 * Returns whether the provided Discord user has admin privileges.
 * @param {Discord.User} discordUser 
 * @returns {boolean}
 */
function isAdmin(discordUser) {
	return JSON.parse(process.env.ADMIN_DISCORD_IDS).includes(String(discordUser.id))
}

/**
 * Returns whether the provided Discord user has captain privileges.
 * @param {Discord.User} discordUser 
 * @returns {boolean}
 */
function isCaptain(discordUser) {
	return JSON.parse(process.env.CAPTAIN_DISCORD_IDS).includes(String(discordUser.id))
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
			var guildMember = await guild.members.fetch(link.id) || false
			if (guildMember) {
				var member = guildMember
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
	PHANTOM_POOL = await require("phantom-pool")()
	await importDbBackup()
	DAT.TEAM_STATS.teamFounder = process.env.FOUNDER_HTB_ID
	await DAT.init()
	// await DAT.syncAgent()
	var HTB_PUSHER_OWNS_SUBSCRIPTION = new HtbPusherSubscription("97608bf7532e6f0fe898",
		[
			{channel: "owns-channel", event: "display-info"},
			{channel: "notifications-channel", event: "display-notifications"},
			{channel: "infobox-channel", event: "display-info"},
			{channel: "shoutbox-channel", event: "display-shout"},
			{channel: "joins-channel", event: "display-info"}
		], DAT.V3API.CSRF_TOKEN)
	// refresh().then(console.log("Initial update completed!"))
	
	if (!DEV_MODE_ON){
		await DAT.syncAgent()
		setInterval(async () => {
			await refresh()
			console.log("Data refresh completed!")
			var updated = await updateCache()
			if (updated) {console.log("Updated the DB...")}
		}, 1 * 60 * 60 * 1000) // Lower frequency of update to once every hour after rate limiter issue
	}
	
	HTB_PUSHER_OWNS_SUBSCRIPTION.on("pusherevent", async message => {
		try {
			if (DEV_MODE_ON){
				PUSHER_MSG_LOG.push(message)
				let data = JSON.stringify(PUSHER_MSG_LOG, null, 2)
				fs.writeFileSync("./cache/PUSHER_MSG_LOG.json", data)
			}
			switch (message.type) {
			case "machine": case "challenge": case "endgame": case "fortress": case	"prolab":
				if (DAT.DISCORD_LINKS[message.uid] || message.blood || DAT.TEAM_MEMBERS[message.uid]) {
					DISCORD_ANNOUNCE_CHAN.send(EGI.pusherOwn(await DAT.resolveEnt(message.uid,"member",true,null,true), message.target, message.type, message.flag || message.type, message.blood))
					if (message.blood){
						DAT.integratePusherBlood(await DAT.resolveEnt(message.uid,"member",true,null,true), message.uid, message.time, message.type, message.target, message.flag, true)
						for (let i = 0; i < 3; i++) {
							DISCORD_ANNOUNCE_CHAN.send("‼").then(message => message.delete())
						}
					}
				}
				if (DAT.TEAM_MEMBERS[message.uid]) {
					console.warn("RELEVANT PUSHER OWN INCOMING::: ")
					DAT.integratePusherOwn(message.uid, message.time, message.type, message.target, message.flag, true)
				}
				break
			case "launch":
				DISCORD_ANNOUNCE_CHAN.send(EGI.pusherNotif(message))
				break
			default:
				if (message.uid && DAT.DISCORD_LINKS[message.uid]) {
					DISCORD_ANNOUNCE_CHAN.send(EGI.pusherNotif(message))
				}
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
		console.log("[DISCORD]::: CLIENT READY")

		DISCORD_ANNOUNCE_CHAN = await client.channels.fetch(process.env.DISCORD_ANNOUNCE_CHAN_ID.toString())

		/** Test the Pusher owns functionality */
		// var PUSHER_DUMMY_DATA = require("./cache/PUSHER_DUMMY_DATA.json")
		// PUSHER_DUMMY_DATA.slice(0,2).forEach(e => {HTB_PUSHER_OWNS_SUBSCRIPTION.channels[0].emit("display-info", {text: e, channel: null})})
		
		console.log(`[DISCORD]::: ${Object.values(DAT.DISCORD_LINKS).length} guild members have linked their HTB accounts.`)
		updateDiscordIds(client, process.env.DISCORD_GUILD_ID.toString())
		setInterval(() => updateDiscordIds(client, process.env.DISCORD_GUILD_ID.toString()), 30 * 60 * 1000)   // UPDATE DISCORD LINKS EVERY 30 MINUTES
	})
	client.on("message", message => {
		message.content = message.content.substring(0, 255)
		if (!DEV_MODE_ON) {
			try {
				if (SEND.PASSTHRU && message.channel.type != "dm" && !message.author.bot) {
					SEND.passthru_register(message)
				} else if (isAdmin(message.author)
						&& SEND.PASSTHRU
						&& message.referencedMessage
						&& message.channel.type == "dm"
						&& isAdmin(message.channel.recipient)) {
					SEND.passthru(message)
				} else {
					handleMessage(message)
				}
			} catch (error) {
				console.log(error)
				message.channel.stopTyping()
			}
		} else if (isAdmin(message.author)) {
			console.warn("Message content:",message.content)
			console.log("Message is from dev admin, responding...")
			if (message.content.includes("📤")) {
				console.log("Sending file msg...")
				sendFileMsg()
			} else {
				try {
					if (SEND.PASSTHRU && message.channel.type != "dm" && !message.author.bot) {
						SEND.passthru_register(message)
					} else if (isAdmin(message.author)
							&& SEND.PASSTHRU
							&& message.reference
							&& message.channel.type == "dm"
							&& isAdmin(message.channel.recipient)) {
						SEND.passthru(message)
					} else {
						handleMessage(message)
					}
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
	message.channel.startTyping()
	var member = DAT.resolveEnt(username, "member", false, message)
	var chartData = await DAT.V4API.getMemberAchievementChart(member.id, term)
	var chartImageB64 = await CHART_RENDERER.renderChart(member, chartData, term, "userProgress")
	var chartImage = new Buffer.from(chartImageB64, "base64")
	var embed = EGI.memberAchievementTimelineChart(member, term, chartImage)
	SEND.embed(message, embed)
}

async function sendActivityMsg(message, member, targetType=undefined, sortBy=undefined, sortOrder=undefined, limit=40) {
	var series = []
	message.channel.startTyping()
	var owns = await DAT.filterMemberOwns(member.id,targetType,"date","asc",limit)
	owns.sort((a, b) => Date.parse(b) - Date.parse(a))
	var orderedDates = owns.map(e => e.date).sort((a, b) => Date.parse(a) - Date.parse(b))
	if (orderedDates.length < 2){
		orderedDates.unshift((new Date(Date.now() - 604800000).toISOString()))
		orderedDates.push((new Date()).toISOString())
	}
	var dateRange = {oldest:new Date(orderedDates[0]), latest: new Date(), interval: new Date(orderedDates[orderedDates.length - 1])}
	var types = ["user","root","challenge","endgame","fortress"]
	types.forEach(thisType => {
		var filtered = owns.filter(e => e.object_type==thisType || e.type == thisType)
		series.push(filtered.map((i,idx) => ([Date.parse(i.date),filtered.length-idx])))
	})
	series.forEach(e => {
		e.unshift([Date.parse(orderedDates[orderedDates.length - 1]) || (new Date()).getTime(), e.length || 0])
		e.push([Date.parse(orderedDates[0]) || (new Date()).getTime(), 0 ])
	})
	
	var chartImageB64 = await CHART_RENDERER.renderChart(member, null, null, "userActivity", series, dateRange)
	var chartImage = new Buffer.from(chartImageB64, "base64")
	SEND.embed(message, EGI.memberActivity(member, limit, targetType, sortOrder, sortBy, chartImage))
}


/**
 * Send a query to the dialogflow agent, and return the query result.
 * @param {Object} message A Discord Message object.
 */
function understand(message) {
	// var sessionPath = dflow.sessionPath(process.env.GOOGLE_CLOUD_PROJECT, "Production", "seven-server", message.author.id)
	var sessionPath = dflow.projectAgentSessionPath(process.env.GOOGLE_CLOUD_PROJECT, message.author.id)
	console.log(`[DF]::: Sending message from ${message.author.username} to DialogFlow for comprehension`)
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
			return responses[0].queryResult
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
	Object.entries(DAT.DISCORD_LINKS).filter(e => e[1].id == message.author.id).forEach(e => delete DAT.DISCORD_LINKS[e[0]])
	switch (idType) {
	case "uid":
		try {
			DAT.DISCORD_LINKS[id] = (message.channel.type=="dm" ? message.author : await message.guild.members.fetch(`${message.author.id}`))
			await SEND.human(message, H.any("Associated HTB user " + DAT.getMemberById(id).name + " (" + id + ")", "HTB user " + DAT.getMemberById(id).name + " (" + DAT.getMemberById(id).id + ") has been linked") + " to your Discord account (" + message.author.tag + "). Thanks! 🙂", true)
			updateCache(["DISCORD_LINKS"])
			//exportData(DISCORD_LINKS, "discord_links.json")
		} catch (error) { console.log(error) }
		break

	case "uname": try {
		DAT.DISCORD_LINKS[DAT.getMemberByName(id).id] = (message.channel.type=="dm" ? message.author : await message.guild.members.fetch(`${message.author.id}`))
		await SEND.human(message, "HTB user " + F.STL(F.toTitleCase(id),"bs") + " (" + DAT.getMemberByName(id).id + ") has been linked to your Discord account (" + F.STL("🌀 "+message.author.tag, "bs") + "). Thanks! 🙂", true)
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
	if (isAdmin(message.author)) {
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

async function forceUpdate(message) {
	if (isCaptain(message.author) || isAdmin(message.author)) {
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
		SEND.human(message, `You're not my boss! 🤔\nno can do.\nTry asking <@!${JSON.parse(process.env.ADMIN_DISCORD_IDS)[0]}>!`)
	}
}

async function admin_clearCached(message) {
	if (isAdmin(message.author)) {
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
				console.log("[SEVEN]::: HTB Entity was resolved.")
				try { SEND.embed(message, await EGI.infoFor(htbItem.type, htbItem.name, null,message, htbItem)) } catch (e) { console.error(e) }
			} else {
				var result = await understand(message)
				var isRipe = result.allRequiredParamsPresent
				console.log("[DF]::: Detected intent: " + result.intent.displayName + " | " + (isRipe? (result.parameters.length? "All required params present.": "No required parameters") : "Required parameters missing.") )
				// console.dir(result)
				if (result.intent && isRipe) {
					var job = result.intent.displayName
					var inf = result.parameters.fields
					/** (Dialogflow) The returned entity parameters, parsed from user query. */
					var P = struct.decode(result.parameters)
					if (Object.keys(P).length) console.log("Extracted:",P)
					try {
						switch (job) {
						case "help": sendHelpMsg(message); break
						case "admin.forceUpdateData":  forceUpdate(message); break
						case "admin.passthruOn": if (isAdmin(message.author)) {SEND.human(message, `Parrot mode ${F.STL("ON","bs")}. 🦜`); SEND.passthruOn()} else {SEND.human(message,"Sorry, not for you. 🦜")} break
						case "admin.passthruOff": if (isAdmin(message.author)) {SEND.human(message,`Parrot mode ${F.STL("OFF","bs")}. 🦜`); SEND.passthruOff()} else {SEND.human(message,"Sorry, not for you. 🦜")} break
						case "admin.clearCached":  admin_clearCached(message); break
						case "admin.setStatus":  admin_setStatus(message, inf); break
						case "admin.clearEmoji":  E.clearCustEmoji(client).then(SEND.human(message, "Successfully purged Seven-related emoji from supporting channel.", false)); break
						case "admin.setupEmoji":  E.initCustEmoji(client).then(SEND.human(message, "Successfully initialized Seven-related emoji on supporting channel.", false)); break
						case "agent.getPickled":  if (!SEND.GET_PICKLED) {await SEND.human(message, result.fulfillmentText, true); SEND.human(message,"```css\n[PICKLE MODE ACTIVATED]```",true) ; SEND.pickleOn()} else { SEND.human(message, "` ERROR: circuits already scrambled... `")} break
						case "agent.getUnpickled":  if (SEND.GET_PICKLED) {SEND.pickleOff(); SEND.human(message,"Fine then...\nThat was kinda fun though. 😏")} else { SEND.human(message, "I'm already talking normally!!!")} break
						case "forgetMe.htbIgnore.getUserID":  forgetHtbDataFlow(message, "htb", P.uid); break
						case "forgetMe.discordUnlink.getUserID":  forgetHtbDataFlow(message, "discord", P.uid); break
						case "forgetMe.all.getUserID":  forgetHtbDataFlow(message, "all", P.uid); break
						case "linkDiscord":  linkDiscord(message, (P.uid ? "uid" : "uname"), (P.uid ? P.uid : P.username)); break
						case "unforgetMe":  unignoreMember(P.uid); SEND.human(message, result.fulfillmentText, true); break
						case "getTime": SEND.embed(message, EGI.binClock(await BC.genImg(PHANTOM_POOL))); break
						case "getTeamBadge":  SEND.human(message,F.noncifyUrl(`https://www.hackthebox.eu/badge/team/image/${DAT.TEAM_STATS.id}`),true).then(() => SEND.human(message, result.fulfillmentText, true)); break
						case "getTeamInfo": SEND.embed(message, EGI.teamInfo()); break
						case "getTeamLeaders": SEND.embed(message, EGI.teamLeaderboard()); break
						case "getTeamLeader":  sendTeamLeaderMsg(message, result.fulfillmentText); break
						case "getTeamRanking": SEND.embed(message, EGI.teamRank()); break
						case "getFlagboard":  sendFlagboardMsg(message); break
						case "getTargetInfo": SEND.embed(message, await EGI.infoFor(P.targetType, P.targetName)); break
						case "getTargetOwners": SEND.embed(message, EGI.teamOwnsForTarget(DAT.resolveEnt(P.target,P.htbTargetType),undefined,P.ownType,P.ownFilter)); break
						case "checkMemberOwnedTarget": SEND.embed(message, EGI.checkMemberOwnedTarget(DAT.resolveEnt(P.username, "member", false, message), DAT.resolveEnt(P.targetname, P.targettype), P.flagNames)); break
						case "getFirstBox":  SEND.embed(message, await EGI.infoFor("machine", "Lame")); await SEND.human(message, result.fulfillmentText); break
						case "agent.doReboot": doFakeReboot(message, result.fulfillmentText); break
						case "getNewBox": SEND.embed(message, await EGI.infoFor("machine", DAT.getNewBoxId(), true)); break
						case "getMemberInfo": SEND.embed(message, await EGI.infoFor("member", P.username, false, message, DAT.resolveEnt(P.username, "member", false, message) || { type: null })); break
						case "getMemberRank": SEND.embed(message, EGI.memberRank(DAT.resolveEnt(P.username, "member", false, message))); break
						case "getMemberChart": sendMemberChartMsg(message, H.sAcc(DAT.resolveEnt(P.username, "member", false, message), "name"), (P.interval ? P.interval : "1Y")); break
						case "filterMemberOwns": sendActivityMsg(message,	DAT.resolveEnt(P.username, "member", false, message),
							P.targettype, P.sortby, P.sortorder,	P.limit || 24); break
						case "filterTargets": SEND.embed(message, EGI.filteredTargets(DAT.filterEnt(message,
							P.targettype, P.sortby, P.sortorder,	P.limit || 15,	null,	null, P.memberName, P.targetFilterBasis),
						P.sortby,
						P, message), true
						); break
						case "filterMembers": SEND.embed(message, EGI.filteredTargets(DAT.filterEnt(message,
							P.targettype, P.sortby, P.sortorder,	P.limit || 15,	null,	null, P.memberName, P.targetFilterBasis),
						P.sortby,
						P, message), true
						); break
						case "Default Fallback Intent": {
							htbItem = await DAT.resolveEnt(message.content.replace(/\s/g,""),null,null,message,true)
							if (htbItem) {
								SEND.embed(message, await EGI.infoFor(null,null,null,message,htbItem)); break
							} else { await SEND.human(message, result.fulfillmentText) }
						} break
						default:
							message.channel.stopTyping(true)
							if (result.fulfillmentText) {
								await SEND.human(message, result.fulfillmentText)
								message.channel.stopTyping(true)
							}
						}
					} catch (error) {
						console.error(error)
					}
					message.channel.stopTyping(true)
				} else {
					htbItem = await DAT.resolveEnt(message.content.replace(/\s/g,""),null,null,message,true)
					if (htbItem) {
						SEND.embed(message, await EGI.infoFor(null,null,null,message,htbItem))
					} else { await SEND.human(message, result.fulfillmentText) }
				}
			}
		}
	}
}

