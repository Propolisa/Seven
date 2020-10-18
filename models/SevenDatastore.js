const {
	Format: F
} = require("../helpers/format.js")
const {
	checkSelfName
} = require("../helpers/nlp.js")
const {
	HtbMachine,
	HtbChallenge,
	TeamMember
} = require("../helpers/classes.js")
const {
	HtbApiConnector: V4
} = require("../modules/api.js")
const {
	HtbLegacyConnector: V3
} = require("../modules/htb-legacy-connector")
const dFlowEnt = require("../helpers/dflow")
const {
	Helpers: H
} = require("../helpers/helpers.js")


class SevenDatastore {

	constructor() {
		this.UPDATE_LOCK = false
		this.LAST_UPDATE = new Date()
		this.V4API = new V4() // v4 API connector.
		this.V3API = new V3() // Legacy (parser + v3 API) data connector.
		this.TEAM_STATS = {}
		this.TEAM_MEMBERS = {}
		this.TEAM_MEMBERS_IGNORED = {}
		this.MACHINES = {}
		this.MISC = {}
		this.CHALLENGES = {}
		this.DISCORD_LINKS = {}
	}



	/**
	 * Useful Aliases
	 */

	get TM() {
		return this.TEAM_MEMBERS
	}
	get TMI() {
		return this.TEAM_MEMBERS_IGNORED
	}
	get M() {
		return this.MACHINES
	}
	get MT() {
		return this.MISC.MACHINE_TAGS
	}
	get C() {
		return this.CHALLENGES
	}
	get D() {
		return this.DISCORD_LINKS
	}
	get TS() {
		return this.TEAM_STATS
	}

	/**
	 * Get value object arrays from target and member structures
	 */

	get vTM() {
		return Object.values(this.TEAM_MEMBERS)
	}
	get vTMI() {
		return Object.values(this.TEAM_MEMBERS_IGNORED)
	}
	get vM() {
		return Object.values(this.MACHINES)
	}
	get vC() {
		return Object.values(this.CHALLENGES)
	}
	get vD() {
		return Object.values(this.DISCORD_LINKS)
	}

	/**
	 * Get key object arrays from target and member structures (generally a list of IDs)
	 */

	get kTM() {
		return Object.keys(this.TEAM_MEMBERS)
	}
	get kTMI() {
		return Object.keys(this.TEAM_MEMBERS_IGNORED)
	}
	get kM() {
		return Object.keys(this.MACHINES)
	}
	get kC() {
		return Object.keys(this.CHALLENGES)
	}
	get kD() {
		return Object.keys(this.DISCORD_LINKS)
	}


	init() {
		return this.V4API.init(process.env.HTB_EMAIL, process.env.HTB_PASS)
			.then(this.V3API.init())
	}

	async update() {
		if (!this.UPDATE_LOCK) {
			this.UPDATE_LOCK = true
			console.log("Update lock engaged. Beginning update attempt.")
			try {
				/* LEGACY STUFF FOR PARSING / PUSHER CONNECT / DATA ABT TEAMS: */
				await this.V3API.init()
				var SESH = this.V3API.SESSION
				console.log("Got a logged in session.")

				/* API v4 DATA COLLECTION (Who's feeling sexy now..?!) */
				var MACHINES_V3 = await this.V3API.getMachines(SESH)
				var urmachine = false
				urmachine = await this.V3API.getUnreleasedMachine(SESH)
				console.warn(urmachine ? "INFO: Got unreleased machine " + urmachine.name + "..." : "INFO: There are currently no machines in unreleased section.")
				if (urmachine) {
					MACHINES_V3[urmachine.id] = urmachine
				}
				var MACHINES_V4 = await this.V4API.getAllCompleteMachineProfiles()
				var COMBINED_MACHINES = {}
				Object.keys(MACHINES_V3).map(e => COMBINED_MACHINES[e] = H.combine([MACHINES_V3[e], MACHINES_V4[e]]) || (Object.assign({}, MACHINES_V3[e], {
					type: "machine"
				})) || MACHINES_V4[e])

				this.MACHINES = COMBINED_MACHINES
				console.warn(`Got ${Object.keys(this.MACHINES).length} machines...`)
				this.MISC = {}
				this.MISC.MACHINE_TAGS = await this.V4API.getMachineTags()
				console.warn(`Got ${Object.keys(this.MISC.MACHINE_TAGS).length} machine tag categories...`)


				this.TEAM_STATS = await this.V4API.getCompleteTeamProfile(process.env.HTB_TEAM_ID)
				console.info(this.TEAM_STATS)
				var TEAM_MEMBERS_BASE = await this.V4API.getTeamMembers(process.env.HTB_TEAM_ID, Object.keys(this.TEAM_MEMBERS_IGNORED))
				console.info(TEAM_MEMBERS_BASE)
				this.TEAM_MEMBERS = await this.V4API.getCompleteMemberProfilesByMemberPartials(TEAM_MEMBERS_BASE)
				console.info(this.TEAM_MEMBERS)

				console.warn(`Got ${Object.keys(this.TEAM_MEMBERS).length} team member profiles...`)
				this.CHALLENGES = await this.V4API.getAllCompleteChallengeProfiles()
				this.MISC.CHALLENGE_CATEGORIES = await this.V4API.getChallengeCategories()
				console.warn(`Got ${this.kC.length} challenges spanning ${Object.keys(this.MISC.CHALLENGE_CATEGORIES).length} categories...`)

				// dFlowEnt.addMissingFieldsToEntity(Object.values(this.CHALLENGE_CATEGORIES).map(category => category.name), "challengeCategoryName")
				// dFlowEnt.addMissingFieldsToEntity(this.MACHINE_TAGS["7" ].tags.map(attackPath => attackPath.name), "boxAttackPath")
				// dFlowEnt.addMissingFieldsToEntity(this.MACHINE_TAGS["11" ].tags.map(attackSub  => attackSub.name ), "boxAttackSub")
				// dFlowEnt.addMissingFieldsToEntity(this.MACHINE_TAGS["9"].tags.map(attackLang => attackLang.name), "boxLanguage")
				// dFlowEnt.addMissingFieldsToEntity(Object.values(this.MACHINES).map(machine => machine.name), "Machines")
				// dFlowEnt.addMissingFieldsToEntity(Object.values(this.TEAM_MEMBERS).map(member => member.name), "memberName")
				// dFlowEnt.addMissingFieldsToEntity(Object.values(this.CHALLENGES).map(challenge => challenge.name), "challenge")

				/* TO HANDLE EXPORTS WITHOUT DB (USING LOCAL JSON FILES ( useful for dev )):::
					|  exportData(MACHINES, "machines.json")
					|  exportData(CHALLENGES, "challenges.json")
					|  exportData(TEAM_MEMBERS, "team_members.json");
					|  exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
					|  exportData(DISCORD_LINKS, "discord_links.json")
					\  exportData(TEAM_STATS, "team_stats.json")  */
				this.LAST_UPDATE = new Date()
				this.UPDATE_LOCK = false
				console.log("Update lock released.")
			} catch (error) {
				console.error(error, "UPDATE FAILED.")
				console.error("\nUPDATE LOCK HAS BEEN RESET AS A PRECAUTION.")
				this.UPDATE_LOCK = false
				// throw(error)
			}

		} else {
			console.warn("WARN: DATA UPDATE NOT STARTED, AS ONE IS ALREADY IN PROGRESS.")
		}
	}

	getCsrfToken() {
		return this.V3API.CSRF_TOKEN
	}
	/**
	 * @param {*} message - Optional: the Discord message (to resolve self username if 'i' is used)
	 * @param {*} targetType - One of ["member", "memberActivity", "machine", "challenge"]. Specifies the target DS to filter.
	 * @param {*} sortOrder - One of "asc" or "desc". Does what it sounds like. 🙂
	 * @param {*} sortBy  - The object property name to sort by.
	 * @param {*} limit - The maximum number of entity results to return as an array. (A sliced result is returned)
	 * @param {*} memberId - If filtering a user's achievements, specify the user's HTB ID here.
	 * @param {*} ownType - If filtering user own activity, specify the type (optional). ["machine", "challenge", "fortress", "prolab", "endgame"]
	 * @param {*} memberNames  - Optional - array of member usernames to filter ownage for.
	 * @param {*} targetFilterBases  - Optional - an array of names of the other fields / abstract properties to filter by.
	 */
	filterEnt(message, targetType = "member", sortBy = null, sortOrder = null, limit = 20, memberId = null, ownType = null, memberNames = [], targetFilterBases = []) {
		var sorter = undefined
		var targets = []
		if (!targetFilterBases.some(e => e.cust == "incomplete") && !targetFilterBases.some(e => e.cust == "complete")) targetFilterBases.push({
			cust: "complete"
		})

		/** GET ALL CACHED TARGETS OF THE SPECIFIED TYPE */
		switch (targetType) {
		case "memberActivity":
			return this.filterMemberOwns(memberId, ownType, sortBy || "date", sortOrder || "desc", limit)
		case "member":
			targets = this.vTM
			break
		case "machine":
			targets = this.vM
			break
		case "challenge":
			targets = this.vC
			break
		default:
			break
		}

		/** SET HOW THE ARRAY WILL BE PRE-SORTED */
		switch (sortBy[0]) {
		case "best rated":
			console.warn("SORTED BY BEST rATED")
			if (targetType == "machine") {
				sorter = (a, b) => (b.stars - a.stars)
			} else if (targetType == "challenge") {
				sorter = (a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes)
			}
			break
		case "worst rated":
			if (targetType == "machine") {
				sorter = (a, b) => (a.stars - b.stars)
			} else if (targetType == "challenge") {
				sorter = (a, b) => (a.likes - a.dislikes) - (b.likes - b.dislikes)
			}
			break
		case "hardest":
			if (targetType == "machine") {
				sorter = (a, b) => (b.difficulty - a.difficulty)
			} else if (targetType == "challenge") {
				sorter = (a, b) => (b.avg_difficulty - a.avg_difficulty)
			}
			break
		case "easiest":
			if (targetType == "machine") {
				sorter = (a, b) => (a.difficulty - b.difficulty)
			} else if (targetType == "challenge") {
				sorter = (a, b) => (a.avg_difficulty - b.avg_difficulty)
			}
			break
		case "newest":
			if (targetType == "machine") {
				sorter = (a, b) => (new Date(b.release).getTime() - new Date(a.release).getTime())
			} else if (targetType == "challenge") {
				sorter = (a, b) => (new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
			}
			break
		case "oldest":
			if (targetType == "machine") {
				sorter = (a, b) => (new Date(a.release).getTime() - new Date(b.release).getTime())
			} else if (targetType == "challenge") {
				sorter = (a, b) => (new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
			}
			break
		default:
			break
		}

		/** PRE-FILTER THE TARGET ARRAY BY EXCLUSION / INCLUSION RULES */
		targetFilterBases.filter(e => e.cust).forEach(filterBasis => {
			switch (filterBasis.cust) {
			case "nolimit":
				console.log("USER DON'T WANT NO LIMITS")
				limit = 0
				break
			case "incomplete":
				if (memberNames) {
					memberNames.forEach(memberName => {
						var member = this.resolveEnt(memberName, "member", false, message, false)
						targets = targets.filter(target => !(this.getMemberOwnsForTarget(member, target)))
					})
				}
				break
			case "complete":
				if (memberNames) {
					// console.log(memberNames)
					memberNames.forEach(memberName => {
						console.log(targets.length)
						var member = this.resolveEnt(memberName, "member", false, message, false)
						targets = targets.filter(target => (this.getMemberOwnsForTarget(member, target)))
						console.log(targets.length)
						console.log(("checked " + memberName))
					})
				}
				break
			case "active":
				targets = targets.filter(target => !target.retired)
				break
			case "inactive":
				targets = targets.filter(target => target.retired)
				break
			case "well rated":
				if (targetType == "machine") {
					targets = targets.filter(target => target.rating >= 3)
				} else if (targetType == "challenge") {
					targets = targets.filter(target => (target.likes - target.dislikes) > 0)
				}
				break
			case "poorly rated":
				console.log("Got here!")
				if (targetType == "machine") {
					targets = targets.filter(target => target.rating < 3)
				} else if (targetType == "challenge") {
					targets = targets.filter(target => (target.likes - target.dislikes) < 0)
				}
				break
			default:
				break
			}
		})

		targetFilterBases.filter(e => e.lvl).forEach(filterBasis => {
			switch (targetType) {
			case "machine":
				targets = targets.filter(t => t.difficultyText == filterBasis.lvl)
				break
			case "challenge":
				targets = targets.filter(t => t.difficulty == filterBasis.lvl)
				break
			default:
				break
			}
		})

		var ccats = targetFilterBases.filter(e => e.ccat).map(e => e.ccat)
		if (ccats.length && targetType == "challenge") {
			targets = targets.filter(t => ccats.includes(t.category_name))
		}

		var bbos = targetFilterBases.filter(e => e.bos).map(e => e.bos)
		if (bbos.length && targetType == "machine") {
			targets = targets.filter(t => bbos.includes(t.os))
		}

		var bInf = targetFilterBases.filter(e => e.ccat || e.bpath || e.bsub || e.blang).map(e => e.ccat || e.bpath || e.bsub || e.blang)
		bInf.forEach(tag => {
			if (targetType == "machine") {
				console.log("BEFORE", targets.length)
				var tagSeq = this.getMachineTagSeqByName(tag)
				console.log(tagSeq)
				if (tagSeq) {
					targets = targets.filter(t => this.checkMachineHasTagSeq(t, tagSeq))
				}

				console.log("AFTER", targets.length)
			}
		})

		const process = (arr, sortOrder, key, limit) => {
			return [...arr].sort((sorter ? sorter : (a, b) => (a[key] - b[key]) * (sortOrder == "asc" ? 1 : -1))).slice(0, (limit ? limit : 999999))
		}
		// console.log(targets)
		try {
			return process(targets, sortOrder, sortBy || "id", limit)
		} catch (error) {
			console.warn(`No entities returned by these filter settings (EntType: ${targetType} | SortOrder: ${sortOrder} | SortBy: ${sortBy} | Limit: ${limit})`)
		}

	}

	resolveExternalMember(id, name = null) {
		console.log("resolving external member...", arguments)
		if (id) {
			return this.V4API.getCompleteMemberProfileById(id)
		} else if (name) {
			return this.V4API.getMemberIdFromUsername(name).then(resolvedId => this.V4API.getCompleteMemberProfileById(resolvedId))
		}
	}

	resolveEnt(kwd, targetType = null, isIdLookup = false, discordMessage = null, lookup = false) {
		try {
			if (!kwd) {
				return false
			}
			var result = {}
			const isSelf = checkSelfName(kwd)
			kwd = (targetType == "member" && checkSelfName(kwd) ? discordMessage.author.username : kwd)
			console.log("Resolving '" + kwd + "'...")
			if (targetType) {
				switch (targetType) {
				case "member":
					return (isIdLookup ? this.getMemberById(kwd, isSelf) : this.getMemberByName(kwd, isSelf)) || (lookup && !/\s/.test(kwd) ? this.resolveExternalMember((isIdLookup ? kwd : null), (!isIdLookup ? kwd : null)) : null)
				case "machine":
					return (isIdLookup ? this.getMachineById(kwd) : this.getMachineByName(kwd))
				case "challenge":
					return (isIdLookup ? this.getChallengeById(kwd) : this.getChallengeByName(kwd))
				default:
					console.warn(`Resolving datastore entity ${(isIdLookup ? "by ID" : "")} from '${kwd}' failed. ${(targetType ? "(Target type '" + targetType + " specified.)" : "")}`)
				}
			}
			if (isIdLookup && Number(kwd)) {
				result["member"] = this.getMemberById(kwd, isSelf)
				result["machine"] = this.getMachineById(kwd)
				result["challenge"] = this.getChallengeById(kwd)
				if (lookup && !/\s/.test(kwd) && !Object.values(result).some(e => e)) {
					result["member"] = this.resolveExternalMember((isIdLookup ? kwd : null), (!isIdLookup ? kwd : null))
				}
			} else {
				result["member"] = this.getMemberByName(kwd, isSelf)
				result["machine"] = this.getMachineByName(kwd)
				result["challenge"] = this.getChallengeByName(kwd)
				if (lookup && !/\s/.test(kwd) && !Object.values(result).some(e => e)) {
					result["member"] = this.resolveExternalMember((isIdLookup ? kwd : null), (!isIdLookup ? kwd : null))
				}
			}
			return result["member"] || result["machine"] || result["challenge"]
		} catch (error) {
			console.error(error)
			console.warn(`Resolving datastore entity ${(isIdLookup ? "[by ID] " : "")}from '${kwd}' failed. ${(targetType ? "(Target type '" + targetType + "' specified.)" : "")}`)
			return false
		}
	}


	/**
	 * Get the member object whose name matches the parameter string.
	 * @param {string} name - The member name.
	 * @returns {(TeamMember|null)}
	 */
	getMemberByName(name, isSelf = false) {
		var match = (Object.values(this.TEAM_MEMBERS).find(member => member.name.toLowerCase() == name.toLowerCase()))
		if (match) {
			if (isSelf) {
				match = Object.assign({}, match)
				match.self = true
			}
			return match
		} else {
			match = this.getIdFromDiscordName(name)
			return this.TEAM_MEMBERS[match] || null
		}
	}

	/**
	 * Get the machine object whose name matches the parameter string.
	 * @param {string} name - The machine name.
	 * @returns {(HtbMachine|null)}
	 */
	getMachineByName(name) {
		return Object.values(this.MACHINES).find(machine => machine.name.toLowerCase() == name.toLowerCase())
	}

	/**
	 * Get the latest box, (or unreleased box, if one is found).
	 * @returns {HtbMachine} - The latest / unreleased machine
	 */
	getNewestOrUnreleasedBox() {
		return Object.values(this.MACHINES).reduce(function (prev, current) {
			return (prev.id > current.id ? prev : current)
		})
	}

	/**
	 * Get the ID of the latest box, (or unreleased box, if one is found).
	 * @returns {number} - The latest / unreleased machine id
	 */
	getNewBoxId() {
		return Object.values(this.MACHINES).reduce(function (prev, current) {
			return (prev.id > current.id ? prev : current)
		}).id || null
	}

	/**
	 * Get the challenge object whose name matches the parameter string.
	 * @param {string} name - The challenge name.
	 * @returns {(HtbChallenge|null)}
	 */
	getChallengeByName(name) { // Return machine object with name matching parameter string
		return Object.values(this.CHALLENGES).find(challenge => challenge.name.toLowerCase() == name.toLowerCase())
	}

	/**
	 * Get the member object whose id matches the parameter string.
	 * @param {number} id - The member id.
	 * @returns {TeamMember}
	 */
	getMemberById(id, isSelf = false) {
		if (this.TEAM_MEMBERS[id]) {
			var match = this.TEAM_MEMBERS[id]
			if (isSelf) {
				match = Object.assign({}, match)
				match.self = true
			}
			return match
		}
		return null
	}

	/**
	 * Get the machine object whose id matches the parameter string.
	 * @param {number} id - The machine id.
	 * @returns {(HtbMachine|null)}
	 */
	getMachineById(id) {
		return Object.values(this.MACHINES).find(machine => machine.id == id) || null
	}

	/**
	 * Get the challenge object whose id matches the parameter string.
	 * @param {number} id - The challenge id.
	 * @returns {(HtbChallenge|null)}
	 */
	getChallengeById(id) {
		return Object.values(this.CHALLENGES).find(challenge => challenge.id == id) || null
	}

	getMemberOwnsForTarget(member, target) {
		if (member && target) {
			// console.log(member)
			var validOwns = member.activity.filter(own => own.object_type == target.type && own.name == target.name)
			// console.info(`Got ${validOwns.length} valid owns...`)
			return (!validOwns.length ? null : validOwns)
		} else {
			return undefined
		}
	}

	filterMemberOwns(memberId, targetType = null, sortBy = "date", sortOrder = "desc", limit = 12) {
		const process = (arr, sortOrder, key, limit) => {
			if (key == "date") {
				return [...arr].sort((a, b) => (Date.parse(b.date) - Date.parse(a.date)) * (sortOrder == "asc" ? 1 : -1)).slice(0, (limit ? limit : 999999))
			} else {
				return [...arr].sort((a, b) => (b[key] - a[key]) * (sortOrder == "asc" ? 1 : -1)).slice(0, (limit ? limit : 999999))
			}
		}
		const member = this.getMemberById(memberId)
		console.log(member)
		var owns = (targetType ? [...member.activity].filter(e => e.object_type == targetType) : [...member.activity])
		const filteredOwns = process(owns, sortOrder, sortBy, limit)
		return filteredOwns || null
	}

	getTeamOwnsForTarget(target) {
		if (!target) {
			return undefined
		}
		var teamOwns = Object.values(this.TEAM_MEMBERS).map(e => ({
			id: e.id,
			act: e.activity
		})).map(owns => owns.act.filter(own => own.object_type == target.type && own.name == target.name).map(k => ({
			...k,
			uid: owns.id
		}))).flat(1).sort((a, b) => H.sortByZuluDatestring(a, b, "date", false))
		console.info(`Got ${teamOwns.length} valid team owns...`)
		return (!teamOwns.length ? null : teamOwns)
	}

	filterTeamOwns(memberId, targetType = null, sortBy = "date", sortOrder = "desc", limit = 12) {
		const process = (arr, sortOrder, key, limit) => {
			if (key == "date") {
				return [...arr].sort((a, b) => (Date.parse(b.date) - Date.parse(a.date)) * (sortOrder == "asc" ? 1 : -1)).slice(0, (limit ? limit : 999999))
			} else {
				return [...arr].sort((a, b) => (b[key] - a[key]) * (sortOrder == "asc" ? 1 : -1)).slice(0, (limit ? limit : 999999))
			}
		}
		const member = this.getMemberById(memberId)
		var owns = (targetType ? [...member.activity].filter(e => e.object_type == targetType) : [...member.activity])
		const filteredOwns = process(owns, sortOrder, sortBy, limit)
		return filteredOwns || null
	}

	getAllMachineTagNames(machine = {
		tags: []
	}, separate = false) {
		if (!machine.tags) {
			machine.tags = []
		}
		var tagDict = {}
		machine.tags.map(tag => {
			console.info(tag)
			const category = Object.values(this.MISC.MACHINE_TAGS).find(e => e.id == tag.tag_category_id)
			console.info(category)
			const subtype = (category ? category.tags.find(e => e.id == tag.id) || null : null)
			if (subtype && category) {
				if (!Array.isArray(tagDict[category.name])) {
					tagDict[category.name] = []
				}
				tagDict[category.name].push([subtype.name])
			}
		})
		if (separate) {
			return tagDict
		} else {
			return [...Object.values(tagDict)]
		}
	}

	getMachineTagSeqByName(tagName) {
		var match = undefined
		Object.keys(this.MISC.MACHINE_TAGS).some(key => {
			var res = this.MISC.MACHINE_TAGS[key]["tags"].find(e => e.name == tagName)
			console.log(this.MISC.MACHINE_TAGS[key])
			console.log(res)
			if (res) {
				match = [key, res.id]
				return true
			}
		})
		return match
	}

	checkMachineHasTag(machine, tagName) {
		if (this.getAllMachineTagNames(machine, false).includes(tagName)) {
			return true
		} else {
			return false
		}
	}

	checkMachineHasTagSeq(machine, tagSeq = [0, 0]) {
		if (!machine.tags) {
			machine.tags = []
		}
		return machine.tags.some(tag => tag.id == tagSeq[1] && tag.tag_category_id == tagSeq[0])
	}
	/**
	 * Get the member object whose name matches the parameter string.
	 * @param {string} name - The member name.
	 * @returns {(TeamMember|null)}
	 */
	getTopMembers(count = 25) {
		var teamMembersAll = {
			...this.TEAM_MEMBERS,
			...this.TEAM_MEMBERS_IGNORED
		}
		var sortedByTPoints = [...Object.values(teamMembersAll)].sort((a, b) => b.points - a.points).map(e => e.id)
		var out = sortedByTPoints.slice(0, count)
		return (out.length == 1 ? out[0] : out)
	}

	/**
	 * Returns a pretty-printable version of the Discord username and / or HTB username for a given HTB UID, in hyperlinked Discord markdown.
	 * @param {number} uid
	 * @returns {(string|"[Invalid ID]")}
	 */
	tryDiscordifyUid(uid, isSelf = false, showBothNames=true) {
		if (uid in this.TEAM_MEMBERS) {
			if (uid in this.DISCORD_LINKS) {
				var discordName = this.DISCORD_LINKS[uid].username
				if (discordName.toLowerCase() != this.TEAM_MEMBERS[uid].name.toLowerCase()) {
					return `🌀${F.STL(discordName, "bs")}${(showBothNames ? " ("+this.TEAM_MEMBERS[uid].name+")" : "" )}${(isSelf ? " [You]":"")}`
				} else {
					return `🌀 ${F.STL(discordName, "bs")}${(isSelf ? " [You]":"")}`
				}
			} else {
				return this.TEAM_MEMBERS[uid].name
			}
		} else {
			return null
		}
	}

	/**
	 * Gets the HTB user ID for a given Discord username, if such an association exists.
	 * @param {string} username - The Discord username to lookup linked account for.
	 * @returns {(number|false)}
	 */
	getIdFromDiscordName(username) {
		var id = Object.keys(this.DISCORD_LINKS).find(link => this.DISCORD_LINKS[link].username.toLowerCase() == username.toLowerCase())
		return id || false
	}

	/**
	 * Get the  current rank of a team member by ID.
	 * @param {number} id - The member ID.
	 * @returns {(number|"Unknown")}
	 */
	getMemberTeamRankById(id) {
		return [...Object.values(this.TEAM_MEMBERS)].sort((a, b) => b.points - a.points).map(e => e.id).indexOf(id) + 1
	}

	/**
	 * Returns a set of markdown-formatted username links for a given list of HTB ids.
	 * @param {number[]} memberIds - An array of HTB UIDs 
	 * @returns {(string[]|"[Invalid ID]")}
	 */
	getMdLinksForUids(memberIds, showBothNames=true, customTextFieldBasis = null) { // Get markdown link to a HTB user's profile, based on UID.
		//console.log(memberIds)
		if (memberIds) {
			var screenNames = []
			memberIds.forEach(uid => {
				console.log("UID: " + uid)
				if (uid in this.TEAM_MEMBERS) {
					screenNames.push(`[\`${this.tryDiscordifyUid(uid,false,showBothNames)}\`](${F.memberProfileUrl({id:uid})} '${(customTextFieldBasis ? this.TEAM_MEMBERS[uid][customTextFieldBasis] : "View on HTB" )}')`)
				} else {
					console.log("UID opted out of data collection.")
					screenNames.push("[٩(͡๏̯͡๏)۶](http://? '👀')")
				}
			})

			if (screenNames.length == 0) {
				return null
			} else {
				console.log(screenNames)
				return screenNames
			}
		} else {
			return null
		}
	}


	/**
	 * Takes information about a new own achievement and adds it to our records.
	 * @param {number} uid - The ID of the user associated with the achievement.
	 * @param {string} type - A string value describing the thing / milestone owned, e.g. "root", "user", "challenge", "endgame", "akerva" etc.
	 * @param {(number|string)} target - If a machine user/system own, use the numeric machine ID (e.g. 238). If a challenge or fortress own, use the title.
	 * @param {string} flag - For pro labs and fortresses with multiple flags, use this field to specify the milestone title.
	 */
	integratePusherOwn(uid, time, type, target, flag = null, isPusher = false) {
		var member = this.getMemberById(uid)
		var targetResolved = this.resolveEnt(target, type)
		if (member && targetResolved) {
			try {
				switch (flag || type) {
				case "user":
					var userOwn = member.activity.find(own => own.type == "user" && (own.name == targetResolved.name || own.id == targetResolved.id))
					if (!userOwn) {
						member.activity.push({
							"date": (new Date(time)).toISOString(),
							"date_diff": F.timeSince(new Date(time)),
							"object_type": target.type,
							"type": "user",
							"id": target.id,
							"name": target.name,
							"points": target.points,
							"machine_avatar": target.avatar
						})
						console.log((isPusher ? "Added user own for " + member.name : ""))
					}
					break

				case "root":
					var rootOwn = member.activity.find(own => own.type == "root" && (own.name == targetResolved.name || own.id == targetResolved.id))
					if (!rootOwn) {
						member.activity.push({
							"date": (new Date(time)).toISOString(),
							"date_diff": F.timeSince(new Date(time)),
							"object_type": target.type,
							"type": "root",
							"id": target.id,
							"name": target.name,
							"points": target.points,
							"machine_avatar": target.avatar
						})
						console.log((isPusher ? "Added root own for " + member.name : ""))
					}
					break

				case "challenge":
					var challOwn = member.activity.find(own => own.type == "root" && (own.name == targetResolved.name || own.id == targetResolved.id))
					if (!challOwn) {
						member.activity.push({
							"date": (new Date(time)).toISOString(),
							"date_diff": F.timeSince(new Date(time)),
							"object_type": target.type,
							"type": "challenge",
							"id": target.id,
							"name": target.name,
							"points": target.points,
							"challenge_category": target.category_name
						})
						console.log((isPusher ? "Added challenge own for " + member.name : ""))
					}
					break
				default:
					break
				}
			} catch (error) {
				console.error(error)
			}
		}
	}

	mdLinksFromBoxIds(boxIds) { // Get markdown links to a HTB user's profile, based on UID.
		// console.log(boxIds)
		if (boxIds) {
			var boxLinks = []
			boxIds.forEach(boxId => {
				if (boxId in this.MACHINES) {
					var box = this.MACHINES[boxId]
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

}


module.exports = {
	SevenDatastore
}