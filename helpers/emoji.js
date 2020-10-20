/**
 * Emoji module makes it possible to get a small emoji identifier (eases embed limits) from a proper name, e.g. "cybernetics" ==> 304.
 */

const { Format: F } = require("../helpers/format.js")

var cache = {
	os: [
		["win", "windows"],
		["lin", "linux"],
		["mac", "macintosh"],
		["sol", "solaris"],
		["fbsd", "fsd", "freebsd"],
		["obsd", "osd", "openbsd"],
		["droid", "android", "droid"],
	],
	chall: [
		["cryp", "crypto"],
		["fnsc", "forensic", "forensics"],
		["hw", "hardware"],
		["misc"],
		["mobl", "mobile"],
		["osint"],
		["pwn"],
		["rev", "reversing"],
		["stego", "stego"],
		["web"]
	],
	specials: [
		["cnetics","cybernetics"],
		["dante"],
		["rlabs", "rastalabs"],
		["offsh", "offshore"],
		["endg","endgame"],
		["fort", "fortress"],
		["jet", "jet.com"],
		["akrv", "akerva"],
		["prolab"]
	],
	ui: [
		["oth", "other"],
		["usr", "user"],
		["sys", "root"],
		["own", "complete"],
		["rnk", "rank"],
		["easy", "easy"],
		["medi", "medium"],
		["hard", "hard"],
		["insn", "insane"],
		["poor"],
		["fair"],
		["good"],
		["great"]
	]
}

class HTBEmoji {
	/**
	 * 
	 * @param {SevenDatastore} ds 
	 */
	constructor(client) {
		this.client = client
		this.state = {}
		var fields = ["os", "chall", "specials", "ui"]
		fields.forEach((fieldName,idx) => {
			this.state[fieldName] = cache[fieldName].map((e, i) => ({
				id: e[0], names: e
			}))
		})
	}

	initCustEmoji(client){
		var emojis = client.guilds.resolve(process.env.EMOJI_CHAN_ID).emojis
		console.log(emojis)
		var initPromises = []
		Object.values(this.state).forEach(cat => {
			cat.forEach(catItems => {
				// console.log(catItems)
				var match = catItems.names.find(e => F.getIcon(e))
				if (match){
					var iconFileName = F.getIcon(match)
					var alreadyExisting = [...emojis.cache.values()].find(e => e.name == catItems.id)
					if (!alreadyExisting) {
						console.log(`:${catItems.id}: doesn't exist yet...`)
						var prom = emojis.create(iconFileName, catItems.id)
						initPromises.push(prom)
					}
				}
			})
		})
		// console.log(initPromises)
		return Promise.all(initPromises)
	}

	clearCustEmoji(client){
		var emoji = client.guilds.resolve(process.env.EMOJI_CHAN_ID).emojis
		console.log(emoji)
		var deletionPromises = []
		Object.values(this.state).forEach(cat => {
			cat.forEach(catItems => {
				var deletable = [...emoji.cache.values()].find(e => e.name == catItems.id)
				if (deletable){
					var prom = deletable.delete()
						.then(emoji => console.log(`Deleted emoji with name ${emoji.name}!`))
						.catch(console.error)
					deletionPromises.push(prom)
				}
			})
		})
		return Promise.all(deletionPromises)
	}

	populateEmoji(){
		this.initCustEmoji(this.client)
	}

	of(emojiName){
		var eId = this.idOf(emojiName)
		//console.log("EID:", eId)
		var resolved = this.client.guilds.resolve(process.env.EMOJI_CHAN_ID).emojis.cache.find(emoji => emoji.name == eId) || ""
		//if (resolved) {console.warn(`EMOJI SIGHTED! ${resolved}`)}
		return resolved
	}



	idOf(name){
		var res = Object.values(this.state).map(catItems => catItems.find(e => e.names.includes(name.toLowerCase()))).filter(x => x)[0]
		return (res? res.id : undefined)
	}

}






module.exports = {
	HTBEmoji
}