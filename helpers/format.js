const flagEmoji = require("country-flag-emoji")
const dateFormat = require("date-fns/format")
const { Helpers: H } = require("./helpers")
const parseDate = require("date-fns/parse")
const fs = require("fs")
const { remove } = require("nconf")

var IMG_DIR = "./static/img/"
var IMG_FILENAMES = null
/**
 * Formatter class. For lots of string transforms.
 */
class Format {
	/**
	 * Uses unicode special character sets to prettify text, despite all of Discord's precautions.
	 * @param {string} str - The string to format
	 * @param {string} inType - The style / alphabet to apply. One of: [bold sans-serif ('bs'), sans-serif ('s'), bold ('b'), monospaced ('m')]
	 * @returns {string}
	 */

	constructor() {}

	static logRainbow(){
		var header =
		`░░░░░░░▀▄░░░▄▀░░░░░░░░
░░░░░░▄█▀███▀█▄░░░░░░░
░░░░░█▀███████▀█░░░░░░
░░░░░█░█▀▀▀▀▀█░█░░░░░░
░░░░░░░░▀▀░▀▀░░░░░░░░░`
		var headerSeven = 
		`⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀▓██████████▓⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀▓████████████████▓⠀⠀⠀⠀⠀
⠀⠀⠀████████████████████⠀⠀⠀⠀
⠀⠀████⠀⠀⠀⠀⠀▓█⠀⠀⠀⠀⠀██████⠀⠀⠀⠀
⠀▓████⠀⠀⠀⠀⠀▓█⠀⠀⠀⠀⠀██████▓⠀⠀
⠀█████⠀⠀⠀⠀⠀▓█⠀⠀⠀⠀⠀███████⠀⠀
⠀▓████▓▒▒▒▒██▓▒▒▒▒██████▓⠀
⠀⠀█████████░⠀⠀⠀⠀████████⠀⠀⠀
⠀⠀⠀████████████████████⠀⠀⠀⠀
⠀⠀⠀⠀▓████████████████▓⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀▓██████████▓⠀⠀⠀⠀⠀⠀⠀⠀⠀
`
		var cols = [
			"#8012ed",
			"#a005d9",
			"#bf01bf",
			"#d905a0",
			"#ed1280",
			"#fa265f",
			"#ff4040",
			"#fa5f26",
			"#ed7f12",
			"#d9a005",
			"#bfbf01",
			"#a0d905",
			"#80ed12",
			"#5ffa26",
			"#40ff40",
			"#26fa5f",
			"#12ed7f",
			"#05d9a0",
			"#01bfbf",
			"#05a0d9",
			"#1280ed",
			"#265ffa",
			"#4040ff",
			"#5f26fa"
		]
		header = (Math.random() > 0.5 ? header : headerSeven)
		console.log(Array.from(header).map(e => `%c${e}`).join(""), ...(Array.from(header).map((e, idx) => `color:${cols[idx % cols.length]}`)))
	}

	static getImageFileNames(){
		return Array.from(fs.readdirSync(IMG_DIR))
	}

	static STL(str, inType) {
		str = String(str)
		//Converts text to the unicode special math font equivalent specified in switch [ bs, s, b, m ]
		var out = ""
		var type = "𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓'" // Default to math sans
		var normalSet =
			"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'" // Normal alphabet
		var realphabetize = true
		if (inType == "bs") {
			// If bold sans
			type = "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇’"
		} else if (inType == "s") {
			// If sans
			type = "𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝖠𝖡𝖢𝖣𝖤𝖥𝖦𝖧𝖨𝖩𝖪𝖫𝖬𝖭𝖮𝖯𝖰𝖱𝖲𝖳𝖴𝖵𝖶𝖷𝖸𝖹𝖺𝖻𝖼𝖽𝖾𝖿𝗀𝗁𝗂𝗃𝗄𝗅𝗆𝗇𝗈𝗉𝗊𝗋𝗌𝗍𝗎𝗏𝗐𝗑𝗒𝗓’"
		} else if (inType == "b") {
			// If bold serif
			type = "𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳’"
		} else if (inType == "m") {
			// If monospaced
			type = "𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿𝙰𝙱𝙲𝙳𝙴𝙵𝙶𝙷𝙸𝙹𝙺𝙻𝙼𝙽𝙾𝙿𝚀𝚁𝚂𝚃𝚄𝚅𝚆𝚇𝚈𝚉𝚊𝚋𝚌𝚍𝚎𝚏𝚐𝚑𝚒𝚓𝚔𝚕𝚖𝚗𝚘𝚙𝚚𝚛𝚜𝚝𝚞𝚟𝚠𝚡𝚢𝚣’"
		} else if (inType == "spoiler_mono") {
			// If should be obfuscated as individual spoiler characters
			realphabetize = false
			out = str.replace(/(.{1})/g, "||`$1`||")
		}
		if (realphabetize) {
			var fancySet = [...type] // Convert to array with new ES6 string to byte array comprehension
			for (let i = 0; i < str.length; i++) {
				var char = str.charAt(i)
				if (normalSet.includes(char)) {
					var x = normalSet.indexOf(char)
					out += fancySet[x]
				} else {
					out += char
				}
			}
		}
		// console.log('String in: ' + str + ' | String out: ' + out) // View conversion results
		return out
	}

	/**
 * Converts a textual list (e.g. "Bob, Jane, Alice") to "Bob, Jane, and Alice".
 * @param {string} - A ", " separated textual list
 * @returns {string} The converted text.
 */
	static andifyList(strings, sep=", ",or=false) { //
		var string
		if (strings.length == 2){
			string = strings.join((or? " or " : " and "))
		} else {
			string = strings.join(sep)
		}
		if (string.includes(",")) {
			var n = string.lastIndexOf(",")
			return string.substring(0, n) + (or? " or" : " and") + string.substring(n + 1, string.length)
		} else {
			return string
		}
	}

	static getPickled(str){
		return str.replace(/\b(\w)(\w+)\b/g, "$2$1ay")
	}

	static getScrambled(s) {
		return s.replace(
			/\b([a-z])([a-z]+)([a-z])\b/gi,
			function( t, a, b, c ) {
				b = b.split( /\B/ )
				for( var i = b.length, j, k; i; j = parseInt( Math.random() * i ),
				k = b[--i], b[i] = b[j], b[j] = k ) {}
				return a + b.join( "" ) + c
			}
		)
	}

	static getSpoiled(s) {
		return s.replace("\\n"," ").split(/\s/).map(lemma => `||${lemma.replace("\\n"," ")}||`).join(" ")
	}

	static toTitleCase(str="unknown") {
		return str.replace(
			/\w\S*/g,
			function(txt) {
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
			}
		)
	}
	static validURL(str) {
		var pattern = new RegExp("^(https?:\\/\\/)?"+ // protocol
			"((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|"+ // domain name
			"((\\d{1,3}\\.){3}\\d{1,3}))"+ // OR ip (v4) address
			"(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*"+ // port and path
			"(\\?[;&a-z\\d%_.~+=-]*)?"+ // query string
			"(\\#[-a-z\\d_]*)?$","i") // fragment locator
		return !!pattern.test(str)
	}

	static safe(str){
		return str.replace(/[^\w\s,;:\-"'.a-zA-Z\u00C0-\u017F]/gi, "")
	}

	static safeUrl(href){
		return (this.validURL(href) ? href : "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
	}

	static avatarFullUrl(item){
		return `https://hackthebox.com${item.avatar}`
	}
	static avatar2Url(avatarLink){
		return (avatarLink ? `https://hackthebox.com${avatarLink}` : null)
	}

	static memberTeamAvatarUrl(member){
		return `https://hackthebox.com${member.team.avatar}`
	}

	static teamProfileUrl(team){
		return `https://hackthebox.com/home/teams/profile/${team.id}`
	}

	static teamProfileUrlFromId(id){
		return `https://hackthebox.com/home/teams/profile/${id}`
	}

	static memberProfileUrl(member){
		return `https://app.hackthebox.com/users/${member.id}`
	}

	static machineProfileUrl(machine){
		return `https://app.hackthebox.com/machines/${machine.id}`
	}

	static challengeProfileUrl(challenge){
		return `https://app.hackthebox.com/challenges/${challenge.id}`
	}

	static special2Proper(specialName){
		switch (specialName){
		case "endgame": return "Endgame"
		case "fortress": return "Fortress"
		case "prolab": return "Pro Lab"
		case "flag": return "challenge flag"
		default: break
		}
	}

	static profileUrl(target){
		var kwd = "user"
		switch (target.type) {
		case "member": kwd = "users";			  	break
		case "machine":	kwd = "machines";			break
		case "challenge": kwd = "challenges";	break
		case "endgame":	case "fortress": case "prolab": return `https://app.hackthebox.com/${target.type}/${target.id}`
		default:	break
		}
		return `https://app.hackthebox.com/${kwd}/${target.id}`
	}

	static targetLink(target){
		var kwd = "user"
		switch (target.type) {
		case "member": kwd = "users";			  	break
		case "machine":	kwd = "machines";			break
		case "challenge": kwd = "challenges";	break
		case "endgame":	case "fortress": case "prolab": return this.mdLink(target.name, `https://www.hackthebox.com${target.id}`)
		default:	break
		}
		return this.mdLink(target.name, `https://app.hackthebox.com/${kwd}/${target.id}`)
	}

	static targetPercentRating(target){
		switch (target.type) {
		case "machine":	return target.rating * 20
		case "challenge": return ((target.likes / (target.likes + target.dislikes)) * 100) || 0
		default:	break
		}
	}

	static ownHeaderEmoji(target, sampleOwn){
		switch (sampleOwn.label) {
		case "user": return "🇺"
		case "root": return "#️⃣"
		case "both": return "🏆"
		case "partial": return "🚩"
		case "total": return "🏆"
		default: return ""
		}
	}	


	/** Returns the appropriate ordinal form (concatenated) for a given number.
 * @param {number} n - The number to get the ordinal suffix for.
 */
	static nth(n) { return n ? n+(["st", "nd", "rd"][((n + 90) % 100 - 10) % 10 - 1] || "th" ) : ""}

	/**
 * Returns the number of days that have elapsed since the provided date.
 * @param {Date} date - The Date object to compare against.
 * @returns {number}
 */
	static elapsedDays(date) {
		var thisTime = new Date()
		var diff = thisTime.getTime() - date.getTime()  // Get the time elapsed
		return Math.round(diff / (1000 * 60 * 60 * 24)) // ... As a positive number of days 
	}

	static get COL() {
		return {
			HTB_GREEN: "#9fef00",
			HACKER_GREY: "#a4b1cd",
			NODE_BLACK: "#141d2b",
			AZURE: "#0086ff",
			NUGGET_YELLOW: "#ffaf00",
			MALWARE_RED: "#ff3e3e",
			VIVID_PURPLE: "#9f00ff",
			AQUAMARINE: "#2ee7b6",
		}
	}

	static noncifyUrl(url) {
		return (url.includes("?") ? `${url}&nonce=${H.genRanHex(4)}` : `${url}?nonce=${H.genRanHex(4)}`)
	}
	

	/**
	 * Get the filename of the local thumbnail for a given OS.
	 * @param {string} osName - The OS name.
	 */

	static osNameToIconFile(osName) {
		switch (osName) {
		case "Linux":   return "linux.png"
		case "Windows": return "windows.png"
		case "Solaris": return "solaris.png"
		case "FreeBSD": return "freebsd.png"
		case "OpenBSD": return "openbsd.png"
		case "Android": return "other.png"
		default:
			return "other.png"
		}
	}

	/**
	 * Get the filename of the local thumbnail for a given OS.
	 * @param {string} challengeCategoryName - The challenge category name.
	 */
	
	static challengeCategoryNameToIconFile(challengeCategoryName) {
		switch (challengeCategoryName.toLowerCase()) {
		case "crypto":    return "crypto.png"
		case "forensics": return "forensics.png"
		case "hardware":  return "hardware.png"
		case "misc":      return "misc.png"
		case "mobile":    return "mobile.png"
		case "osint":     return "osint.png"
		case "pwn":       return "pwn.png"
		case "reversing": return "reversing.png"
		case "stego":     return "stego.png"
		case "web":       return "web.png"
		default:
			return "challenge_cat/other_c.png"
		}
	}

	static getIcon(name) {
		if (!IMG_FILENAMES) IMG_FILENAMES = this.getImageFileNames()
		if (IMG_FILENAMES.includes(`${name}.png`)){
			return `${IMG_DIR}${name}.png`
		} else {
			// console.warn(`Invalid icon name '${name}' specified`)
			return `${IMG_DIR}other.png`
		}
	}

	static challengeDifficulty(challenge) {
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

	static difficultySymbol(difficulty) {
		switch (difficulty) {
		case "Unknown": return "💩"
		case "Easy": return "📗"
		case "Medium": return "📘"
		case "Hard": return "📙"
		case "Insane": return "📕"
		default: return "📓"
		}
	}

	static challengeSymbol(category) {
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

	static targetDifficultyToEmojiName(target){
		switch (target.type) {
		case "machine": return (target?.difficultyText || "").toLowerCase()
		case "challenge": return target.difficulty.toLowerCase()
		case "fortress": return null
		case "prolab": return null
		default: return null
		}
	}

	static targetRatingToEmojiName(target){
		var rating = this.targetPercentRating(target)
		if (!rating || !target) return "empty"
		if (rating <= 25) return "bad"
		if (rating <= 50) return "poor"
		if (rating <= 75) return "fair"
		return "good"
	}

	static boxOsSymbol(category) {
		switch (category.toLowerCase()) {
		case "Linux": return "🐧"
		case "Windows": return H.any("🔷", "🔶", "💠")
		case "Solaris": return "☀️"
		case "FreeBSD": return "😈"
		case "Android": return "🍈"
		default: return "❓"
		}
	}

	static rankSymbol(rankText) {
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
 * Returns a Discord Markdown formatted list of member rankings.
 * @param {string[]} arr - A list of hyperlinked member names sorted by rank (descending) where index 0 is the highest ranking member.
 * @returns {string[]}
 */
	static mdItemizeList(arr) {
		var out = []
		for (const [index, element] of arr.entries()) {
			if (index == 0) {
				out.push("` " + (index + 1).toString().padStart(2, "0") + " `" + element + "⠀🔥")
			} else {
				out.push("` " + (index + 1).toString().padStart(2, "0") + " `" + element)
			}
		}
		return out
	}


	/**
	 * This function exists as evidence that Propolis (spoken in true third person style)
	 * does not have any standards regarding time management. 🤷‍♀️
	 * @param {*} len - How many dominoes to assemble (obviously!)
	 */
	static randomDominoes(len = 0) {
		var dominoes = ""
		for (let i = 0; i < len; i++) {
			dominoes += H.any(
				"🀱", "🀲", "🀳", "🀴", "🀵", "🀶", "🀷", "🀸",
				"🀹", "🀺", "🀻", "🀼", "🀽", "🀾", "🀿", "🁀",
				"🁁", "🁂", "🁃", "🁄", "🁅", "🁆", "🁇", "🁈",
				"🁉", "🁊", "🁋", "🁌", "🁍", "🁎", "🁏", "🁐",
				"🁑", "🁒", "🁓", "", "🁔", "🁕", "🁖", "🁗",
				"🁘", "🁙", "🁚", "🁛", "🁜", "🁝", "🁞",
				"🁟", "🁠", "🁡")
		}
		return dominoes
	}

	
	/**
	 * Refine a MD turned-down version of the HTML description of a Pro Lab
	 * @param {*} description - The already turned-down description field from the ProLab object
	 */
	static convertProLabDescription(description) {
		var paras = description.split("\n\n")
		var backup = [...paras]
		var listIndex = -1
		for (let i = 0; i < paras.length; i++) {
			if (typeof paras[i] == "string" & new RegExp(/.*\*\*.*Level.*\*\*/).test(paras[i])){
				paras[i] = "**This lab exposes players to:**"
				listIndex = i + 1
				for (let x = 0; x < i - 1; x++) {
					paras[x] = undefined	
				}
				paras[i-1] = "\n> " + backup.slice(0,i).join("\n> ")
			}
			if (i == listIndex){
				paras[i - 1] = paras[i - 1] + paras[i].replace(/\*\s\s/gi,"• ")
				paras[i] = undefined
			}
			
			if (paras[i]){
				if (paras[i].includes("entry point") || paras[i].includes("out of scope")){
					paras[i] = "```fix\n⚠ " + paras[i].replace(/\*\*/gi, "") + "\n```"
				} else if (i == listIndex || i == listIndex -1) {
					paras[i] = "\n" + paras[i] + "\n"
				} else {
					paras[i] = "```md\n" + paras[i] + "\n```"
				}
			}
			
			
		}
		let out = paras.filter(e => typeof e != undefined).join("\n").trim()
		out = out ? "\n" + out : out
		return out
	}

	static progressBar(progressAsPercent = 75, length = 10, label = true) {
		// Returns pretty unicode progress bar, like:	▰▰▰▱▱▱▱▱ 38%
		var normalized = (progressAsPercent / 100) * length
		// console.log(length, Math.round(normalized))
		return "🀰".repeat(Math.round(normalized)) + this.randomDominoes(length - Math.round(normalized)) + (label ? " " + progressAsPercent + "%" : "")
	}

	static mdLink(text, url, bold = true, hoverText = "View on HTB") {
		return (bold ? "**" : "") + `[${text}](${url + (hoverText ? " '" + hoverText + "'" : "")})` + (bold ? "**" : "")
	}

	/**
 * Returns a fuzzy time estimate for a given date, relative to the present, that some date occurred (e.g. "4 months ago").
 * @param {Date} date 
 */
	static timeSince(date) {
		var seconds = ~~((new Date() - date) / 1000)
		var interval = ~~(seconds / 31536000)
		if (interval < 0) {
			return "just now"
		}
		if (interval > 1) {
			return interval + " years ago"
		}
		interval = ~~(seconds / 2592000)
		if (interval > 1) {
			return interval + " months ago"
		}
		interval = ~~(seconds / 604800)
		if (interval > 1) {
			return interval + " weeks ago"
		}
		interval = ~~(seconds / 86400)
		if (interval > 1) {
			return interval + " days ago"
		}
		interval = ~~(seconds / 3600)
		if (interval > 1) {
			return interval + " hours ago"
		}
		interval = ~~(seconds / 60)
		if (interval > 1) {
			return interval + " minutes ago"
		}
		return ~~seconds + " seconds ago"
	}

	/**
 * Returns a fuzzy time estimate for a given date, relative to the present, that some date occurred (e.g. "4 months ago").
 * @param {Date} date 
 */
	static timeSinceSmall(date) {
		var seconds = ~~((new Date() - date) / 1000)
		var interval = ~~(seconds / 31536000)
		if (interval < 0) {
			return "0s"
		}
		if (interval > 1) {
			return interval + "Y"
		}
		interval = ~~(seconds / 2592000)
		if (interval > 1) {
			return interval + "M"
		}
		interval = ~~(seconds / 604800)
		if (interval > 1) {
			return interval + "w"
		}
		interval = ~~(seconds / 86400)
		if (interval > 1) {
			return interval + "d"
		}
		interval = ~~(seconds / 3600)
		if (interval > 1) {
			return interval + "h"
		}
		interval = ~~(seconds / 60)
		if (interval > 1) {
			return interval + "m"
		}
		return ~~seconds + "s"
	}

	/**
 * Returns a fuzzy time estimate for a given date, relative to the present, that some date occurred (e.g. "4 months ago").
 * @param {Date} date 
 */
	static fuzzyAge(date) {
		var isFuture = false
		var seconds = ~~((new Date() - date) / 1000)
		if (seconds < 0) {
			seconds = Math.abs(seconds)
			isFuture = true
		}
		var PRE = (isFuture ? "in " : "")
		var SUF = (isFuture ? "" : " ago")
		var interval = ~~(seconds / 31536000)
		if (interval < 0) {
			return "[Newly hatched]"
		}
		if (interval > 1) {
			return PRE + interval + " years" + SUF
		}
		interval = ~~(seconds / 2592000)
		if (interval > 1) {
			return PRE + interval + " months" + SUF
		}
		interval = ~~(seconds / 604800)
		if (interval > 1) {
			return PRE + interval + " weeks" + SUF
		}
		interval = ~~(seconds / 86400)
		if (interval > 1) {
			return PRE + interval + " days" + SUF
		}
		interval = ~~(seconds / 3600)
		if (interval > 1) {
			return PRE + interval + " hours" + SUF
		}
		interval = ~~(seconds / 60)
		if (interval > 1) {
			return PRE + interval + " minutes" + SUF
		}
		return PRE + ~~seconds + " seconds" + SUF
	}

	/**
 * Formats a given number in Unicode bold characters, for emphasis.
 * @param {string} str - The number to style in bold text.
 */
	static numS(str) {
		str = str.toString()
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
 * Calculates and returns the sub-integral symbol, used in 'ratingString' static
 * @param {number} num - the sub-integral value, between 0 - 1.
 */
	static halfMoon(num) {
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
 * Returns a pretty emoji flag for a given country code. If not recognized, returns the Jolly Roger.
 * @param {string} countryCode - Example: "EU", "AU", "NZ"
 * @returns {string} - The emoji, e.g. 🏴‍☠️
 */
	static getFlag(countryCode) {
		var flag = "🏴‍☠️"
		try {
			flag = flagEmoji.data[countryCode].emoji
		} catch (error) {
			// console.error(error)
		}
		return flag
	}

	/**
 * Converts a numeric rating (0.0 - 5.0) to a Unicode moon rating expression (e.g. '2.5' => 🌕🌕🌗🌑🌑)
 * @param {number} rating - The rating, a positive number from 0 - 5. 
 */
	static ratingString(rating) {
		if (rating == 0) {
			return "Unrated"
		} else {
			return "🌕".repeat(~~rating) + this.halfMoon(rating) + "🌑".repeat(Math.max((5 - ~~rating) - 1, 0))
		}
	}

	static test() {
		var STR = "This is a test of the various formatting styles."
		console.warn(Format(STR, "bs"))
		console.warn(Format(STR, "s"))
		console.warn(Format(STR, "b"))
		console.warn(Format(STR, "m"))
		console.warn(Format("Active Directory", "spoiler_mono"))
	}

	static aOrAn(noun) {
		return ("AEIOUaeiou".includes(noun.charAt(0)) ? "An" : "A")
	}

	static memberToMdLink(member, bold = true, customText=null) {
		return (bold ? "**" : "") + `[${customText || H.sAcc(member,"name")}](https://app.hackthebox.com/users/${member.id} 'View on HTB')` + (bold ? "**" : "")
	}

	static shortDate(date){
		return dateFormat(date, "dd/MM")
	}
	static stdDate(date){
		return dateFormat(date, "MMM d, yyyy")
	}
	static dateFmt(date, fmtString){
		return dateFormat(date, fmtString)
	}
	static get parseDate(){
		return parseDate
	}

}

module.exports = {
	Format
}