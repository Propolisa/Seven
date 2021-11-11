/**
 * @typedef {import('../models/api-classes').Challenge} Challenge
 * @typedef {import('../models/api-classes').Endgame} Endgame
 * @typedef {import('../models/api-classes').EndgameEntry} EndgameEntry
 * @typedef {import('../models/api-classes').EndgameProfile} EndgameProfile
 * @typedef {import('../models/api-classes').Fortress} Fortress
 * @typedef {import('../models/api-classes').FortressEntry} FortressEntry
 * @typedef {import('../models/api-classes').FortressProfile} FortressProfile
 * @typedef {import('../models/api-classes').Machine} Machine
 * @typedef {import('../models/api-classes').ProLab} ProLab
 * @typedef {import('../models/api-classes').ProLabEntry} ProLabEntry
 * @typedef {import('../models/api-classes').ProLabInfo} ProLabInfo
 * @typedef {import('../models/api-classes').ProLabOverview} ProLabOverview
 * @typedef {import('../models/api-classes').Team} Team
 * @typedef {import('../models/api-classes').Track} Track
 * @typedef {import('../models/api-classes').University} University
 * @typedef {import('../models/api-classes').User} User
 *
 */

const { Format: F } = require("../helpers/format.js")
const { checkSelfName } = require("../helpers/nlp.js")
const {
	HtbMachine,
	HtbChallenge,
	TeamMember,
} = require("../helpers/classes.js")

const { HtbSpecialFlag } = require("../helpers/classes.js")
const { HtbApiConnector: V4 } = require("../modules/htb-api.js")
const { HtbLegacyConnector: V3 } = require("../modules/htb-legacy-connector")
const dFlowEnt = require("../helpers/dflow")
const { Helpers: H } = require("../helpers/helpers.js")

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

	get D_STATIC() {
		var buffer = Object.assign({}, this.DISCORD_LINKS)
		Object.keys(buffer).forEach((linKey) => {
			let link = buffer[linKey]
			buffer[linKey] = Object.assign(
				{},
				{
					id: link.id,
					username: link.username || link.user.username,
					nickname: link.nickname,
				}
			)
		})
		return buffer
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
		return this.V4API.init(process.env.HTB_EMAIL, process.env.HTB_PASS).then(
			this.V3API.init()
		)
	}

	syncAgent() {
		if (process.env["IS_DEV_INSTANCE"])
			return setTimeout(() => dFlowEnt.syncAgentUpstream(), 60 * 1000)
		else return dFlowEnt.syncAgentDownstream()
	}

	async getMachinesComplete() {
		console.time("Getting machines [V3] took")
		var MACHINES_V3 = await this.V3API.getMachines()
		var urmachine = false
		urmachine = await this.V3API.getUnreleasedMachine()
		console.warn(
			urmachine
				? "[APIv3]::: Got unreleased machine " + urmachine.name + "..."
				: "[APIv3]::: There are currently no machines in unreleased section."
		)
		if (urmachine) {
			MACHINES_V3[urmachine.id] = urmachine
		}
		var machineSubmissions = await this.V3API.getMachineSubmissions()
		var mSObj = machineSubmissions.length
			? H.arrToObj(machineSubmissions, "id")
			: {}
		console.timeEnd("Getting machines [V3] took")
		console.time("Getting machines [V4] took")
		var MACHINES_V4 = await this.V4API.getAllCompleteMachineProfiles()
		var COMBINED_MACHINES = {}
		Object.keys(MACHINES_V3).map(
			(e) =>
				(COMBINED_MACHINES[e] =
				H.combine([MACHINES_V3[e], MACHINES_V4[e]]) ||
				Object.assign({}, MACHINES_V3[e], {
					type: "machine",
				}) ||
				MACHINES_V4[e])
		)
		console.timeEnd("Getting machines [V4] took")
		return Object.assign(COMBINED_MACHINES, mSObj)
	}

	async getMachineTagsComplete() {
		console.time("Getting machine tags [V4] took")
		var mt = await this.V4API.getMachineTags()
		console.timeEnd("Getting machine tags [V4] took")
		return mt
	}

	async update() {
		if (!this.UPDATE_LOCK) {
			this.UPDATE_LOCK = true
			console.log(
				"[API CONNECTOR]::: Update lock engaged. Beginning update attempt."
			)
			try {
				console.time("Data update took")
				/* LEGACY STUFF FOR PARSING / PUSHER CONNECT / DATA ABT TEAMS: */
				await this.V3API.init()
				var SESH = this.V3API.SESSION
				if (SESH) console.log("[API CONNECTOR]::: Got a logged in V3 session.")
				this.FORTRESSES = await this.V4API.getAllFortresses()
				this.ENDGAMES = await this.V4API.getAllEndgames()
				this.PROLABS = await this.V4API.getAllProlabs()
				let t1 = JSON.stringify(this.FORTRESSES, null, "\t")
				let t2 = JSON.stringify(this.ENDGAMES, null, "\t")
				let t3 = JSON.stringify(this.PROLABS, null, "\t")
				/* API v4 DATA COLLECTION (Who's feeling sexy now..?!) */
				console.time("Getting machines [V3] took")
				var MACHINES_V3 = await this.V3API.getMachines()
				var urmachine = false
				urmachine = await this.V3API.getUnreleasedMachine()
				console.warn(
					urmachine
						? "[APIv3]::: Got unreleased machine " + urmachine.name + "..."
						: "[APIv3]::: There are currently no machines in unreleased section."
				)
				if (urmachine) {
					MACHINES_V3[urmachine.id] = urmachine
				}
				var machineSubmissions = await this.V3API.getMachineSubmissions()
				var mSObj = machineSubmissions.length
					? H.arrToObj(machineSubmissions, "id")
					: {}
				console.timeEnd("Getting machines [V3] took")
				console.time("Getting machines [V4] took")
				var MACHINES_V4 = await this.V4API.getAllCompleteMachineProfiles()
				var COMBINED_MACHINES = {}
				Object.keys(MACHINES_V3).map(
					(e) =>
						(COMBINED_MACHINES[e] =
						H.combine([MACHINES_V3[e], MACHINES_V4[e]]) ||
						Object.assign({}, MACHINES_V3[e], {
							type: "machine",
						}) ||
						MACHINES_V4[e])
				)

				this.MACHINES = Object.assign(COMBINED_MACHINES, mSObj)
				console.timeEnd("Getting machines [V4] took")
				console.warn(
					`[APIv4]::: Got ${Object.keys(this.MACHINES).length
					} machines (Including submissions)...`
				)
				console.time("Getting machine tags [V4] took")
				var mt = await this.V4API.getMachineTags()
				this.MISC.MACHINE_TAGS = mt
				console.timeEnd("Getting machine tags [V4] took")
				console.warn(
					`[APIv4]::: Got ${Object.keys(this.MISC.MACHINE_TAGS).length
					} machine tag categories...`
				)

				console.time("Getting team / uni data [V4] took")
				if (process.env.HTB_TEAM_ID) {
					this.TEAM_STATS = await this.V4API.getCompleteTeamProfile(
						process.env.HTB_TEAM_ID
					)
					delete this.TEAM_STATS.weekly
					var TEAM_MEMBERS_BASE = await this.V4API.getTeamMembers(
						process.env.HTB_TEAM_ID,
						Object.keys(this.TEAM_MEMBERS_IGNORED)
					)
					this.TEAM_MEMBERS =
						await this.V4API.getCompleteMemberProfilesByMemberPartials(
							TEAM_MEMBERS_BASE
						)
				} else if (process.env.HTB_UNIVERSITY_ID) {
					var UNI_MEMBER_IDS = await this.V3API.getUniversityMemberIds(
						SESH,
						process.env.HTB_UNIVERSITY_ID,
						Object.keys(this.TEAM_MEMBERS_IGNORED)
					)
					var UNI_MEMBERS = await this.V4API.getCompleteMemberProfilesByIds(
						UNI_MEMBER_IDS
					)
					Object.values(UNI_MEMBERS).forEach(
						(e) =>
							(e.role =
							e.id == (UNI_MEMBER_IDS[0] || null) ? "admin" : "student")
					)
					this.TEAM_MEMBERS = UNI_MEMBERS
					var captain = this.TEAM_MEMBERS[UNI_MEMBER_IDS[0]]
					this.TEAM_STATS = Object.assign(
						(await this.V3API.getUniversityProfile(
							SESH,
							process.env.HTB_UNIVERSITY_ID
						)) || {},
						(await this.V4API.getUniversityProfile(
							process.env.HTB_UNIVERSITY_ID
						)) || {},
						{
							avatar_url: `https://www.hackthebox.com/storage/universities/${Number(
								process.env.HTB_UNIVERSITY_ID
							)}.png`,
							type: "university",
							captain: { id: captain.id, name: captain.name },
						}
					)
					// this.TEAM_MEMBERS = await this.V4API.getCompleteMemberProfilesByMemberPartials(TEAM_MEMBERS_BASE)
				} else {
					console.warn(
						"[API CONNECTOR]::: No ID (Team or University) was specified!! Please add a definition for either 'HTB_UNIVERSITY_ID' or 'HTB_TEAM_ID' in your environment variables."
					)
				}

				console.timeEnd("Getting team / uni data [V4] took")
				console.warn(
					`[APIv4]::: Got ${Object.keys(this.TEAM_MEMBERS).length
					} team member profiles...`
				)
				var names = this.vTM.map((e) => e.name.toLowerCase())
				console.time("Getting challenge profiles and tags [V4] took")
				this.CHALLENGES = await this.V4API.getAllCompleteChallengeProfiles()
				this.MISC.CHALLENGE_CATEGORIES =
					await this.V4API.getChallengeCategories()

				console.timeEnd("Getting challenge profiles and tags [V4] took")

				console.time("Getting specials took")
				this.MISC.SPECIALS = await this.V3API.getSpecials()
				console.timeEnd("Getting specials took")
				let specialCounts = Object.keys(this.MISC.SPECIALS).map(
					(e) => `${this.MISC.SPECIALS[e].length} ${e}`
				)
				console.warn(`[APIv4]::: Got ${F.andifyList(specialCounts)}.`)

				console.warn(
					`[APIv4]::: Got ${this.kC.length} challenges spanning ${Object.keys(this.MISC.CHALLENGE_CATEGORIES).length
					} categories...`
				)
				console.warn(`[APIv4]::: Got team info for "${this.TEAM_STATS.name}"`)
				dFlowEnt.updateEntity(
					Object.values(this.MISC.SPECIALS)
						.flat()
						.map((e) => Object.values(e.flags))
						.flat(),
					"specialTargetFlagName"
				)
				dFlowEnt.updateEntity(
					Object.values(this.MISC.SPECIALS)
						.map((specialType) => specialType.map((s) => s.name))
						.flat(),
					"specialTargetName"
				)
				dFlowEnt.updateEntity(
					Object.values(this.MISC.CHALLENGE_CATEGORIES).map(
						(category) => category.name
					),
					"challengeCategoryName"
				)
				dFlowEnt.updateEntity(
					this.MISC.MACHINE_TAGS["7"].tags.map((attackPath) => attackPath.name),
					"boxAttackPath"
				)
				dFlowEnt.updateEntity(
					this.MISC.MACHINE_TAGS["11"].tags.map((attackSub) => attackSub.name),
					"boxAttackSub"
				)
				dFlowEnt.updateEntity(
					this.MISC.MACHINE_TAGS["9"].tags.map((attackLang) => attackLang.name),
					"boxLanguage"
				)
				dFlowEnt.updateEntity(
					Object.values(this.MACHINES).map((machine) => machine.name),
					"Machines"
				)
				dFlowEnt.updateEntity(
					Object.values(this.TEAM_MEMBERS).map((member) => ({
						value: member.name,
						synonyms: [
							member.name,
							...this.getDiscordUserSynonymsForUid(member.id, names),
						],
					})),
					"memberName"
				)
				dFlowEnt.updateEntity(
					Object.values(this.CHALLENGES).map((challenge) => challenge.name),
					"challenge"
				)
				dFlowEnt.updateEntity(
					Object.values(this.TEAM_MEMBERS).map((member) => ({
						value: member.name,
						synonyms: [
							member.name,
							...this.getDiscordUserSynonymsForUid(member.id, names),
						],
					})),
					"memberName"
				)
				/* TO HANDLE EXPORTS WITHOUT DB (USING LOCAL JSON FILES ( useful for dev )):::
							|  exportData(MACHINES, "machines.json")
							|  exportData(CHALLENGES, "challenges.json")
							|  exportData(TEAM_MEMBERS, "team_members.json");
							|  exportData(TEAM_MEMBERS_IGNORED, "team_members_ignored.json")
							|  exportData(DISCORD_LINKS, "discord_links.json")
							\  exportData(TEAM_STATS, "team_stats.json")  */
				this.LAST_UPDATE = new Date()
				this.UPDATE_LOCK = false
				console.log("[API CONNECTOR]::: Update lock released.")
				console.timeEnd("Data update took")
			} catch (error) {
				console.error(error, "[API CONNECTOR]::: UPDATE FAILED.")
				console.error(
					"\n[API CONNECTOR]::: UPDATE LOCK HAS BEEN RESET AS A PRECAUTION."
				)
				this.UPDATE_LOCK = false
				// throw(error)
			}
		} else {
			console.warn(
				"[API CONNECTOR]::: WARNING: DATA UPDATE NOT STARTED, AS ONE IS ALREADY IN PROGRESS."
			)
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
	filterEnt(
		message,
		targetType = "member",
		sortBy = null,
		sortOrder = null,
		limit = 20,
		memberId = null,
		ownType = null,
		memberNames = [],
		targetFilterBases = []
	) {
		var sorter = undefined
		var targets = []
		if (
			!targetFilterBases.some((e) => e.cust == "incomplete") &&
			!targetFilterBases.some((e) => e.cust == "complete")
		)
			targetFilterBases.push({
				cust: "complete",
			})

		/** GET ALL CACHED TARGETS OF THE SPECIFIED TYPE */
		switch (targetType) {
		case "memberActivity":
			return this.filterMemberOwns(
				memberId,
				ownType,
				sortBy || "date",
				sortOrder || "desc",
				limit
			)
		case "member":
			targets = this.vTM
			break
		case "machine":
			targets = this.vM
			break
		case "challenge":
			targets = this.vC
			break
		case "endgame":
			targets = this.MISC.SPECIALS["Endgame"]
			break
		case "fortress":
			targets = this.MISC.SPECIALS["Fortress"]
			break
		case "prolab":
			targets = this.MISC.SPECIALS["Pro Labs"]
			break
		default:
			break
		}

		/** SET HOW THE ARRAY WILL BE PRE-SORTED */
		switch (sortBy[0]) {
		case "best rated":
			console.warn("SORTED BY BEST rATED")
			if (targetType == "machine") {
				sorter = (a, b) => b.stars - a.stars
			} else if (targetType == "challenge") {
				sorter = (a, b) => F.targetPercentRating(b) - F.targetPercentRating(a)
			}
			break
		case "worst rated":
			if (targetType == "machine") {
				sorter = (a, b) => a.stars - b.stars
			} else if (targetType == "challenge") {
				sorter = (a, b) => F.targetPercentRating(a) - F.targetPercentRating(b)
			}
			break
		case "hardest":
			if (targetType == "machine") {
				sorter = (a, b) => b.difficulty - a.difficulty
			} else if (targetType == "challenge") {
				sorter = (a, b) => b.avg_difficulty - a.avg_difficulty
			}
			break
		case "easiest":
			if (targetType == "machine") {
				sorter = (a, b) => a.difficulty - b.difficulty
			} else if (targetType == "challenge") {
				sorter = (a, b) => a.avg_difficulty - b.avg_difficulty
			}
			break
		case "newest":
			if (targetType == "machine") {
				sorter = (a, b) =>
					new Date(b.release).getTime() - new Date(a.release).getTime()
			} else if (targetType == "challenge") {
				sorter = (a, b) =>
					new Date(b.release_date).getTime() -
						new Date(a.release_date).getTime()
			}
			break
		case "oldest":
			if (targetType == "machine") {
				sorter = (a, b) =>
					new Date(a.release).getTime() - new Date(b.release).getTime()
			} else if (targetType == "challenge") {
				sorter = (a, b) =>
					new Date(a.release_date).getTime() -
						new Date(b.release_date).getTime()
			}
			break
		default:
			break
		}

		/** PRE-FILTER THE TARGET ARRAY BY EXCLUSION / INCLUSION RULES */
		targetFilterBases
			.filter((e) => e.cust)
			.forEach((filterBasis) => {
				switch (filterBasis.cust) {
				case "nolimit":
					console.warn("[APIv4]::: USER DON'T WANT NO LIMITS")
					limit = 0
					break
				case "incomplete":
					if (memberNames) {
						memberNames.forEach((memberName) => {
							var member = this.resolveEnt(
								memberName,
								"member",
								false,
								message,
								false
							)
							targets = targets.filter(
								(target) => !this.getMemberOwnsForTarget(member, target)
							)
						})
					}
					break
				case "complete":
					if (memberNames) {
						memberNames.forEach((memberName) => {
							var member = this.resolveEnt(
								memberName,
								"member",
								false,
								message,
								false
							)
							targets = targets.filter((target) =>
								this.getMemberOwnsForTarget(member, target)
							)
							console.log("Checked " + memberName)
						})
					}
					break
				case "active":
					targets = targets.filter((target) => !target.retired)
					break
				case "inactive":
					targets = targets.filter((target) => target.retired)
					break
				case "well rated":
					if (targetType == "machine") {
						targets = targets.filter((target) => target.rating >= 3)
					} else if (targetType == "challenge") {
						targets = targets.filter(
							(target) => target.likes - target.dislikes > 0
						)
					}
					break
				case "poorly rated":
					if (targetType == "machine") {
						targets = targets.filter((target) => target.rating < 3)
					} else if (targetType == "challenge") {
						targets = targets.filter(
							(target) => target.likes - target.dislikes < 0
						)
					}
					break
				default:
					break
				}
			})

		targetFilterBases
			.filter((e) => e.lvl)
			.forEach((filterBasis) => {
				switch (targetType) {
				case "machine":
					targets = targets.filter((t) => t.difficultyText == filterBasis.lvl)
					break
				case "challenge":
					targets = targets.filter((t) => t.difficulty == filterBasis.lvl)
					break
				default:
					break
				}
			})

		var ccats = targetFilterBases.filter((e) => e.ccat).map((e) => e.ccat)
		if (ccats.length && targetType == "challenge") {
			targets = targets.filter((t) => ccats.includes(t.category_name))
		}

		var bbos = targetFilterBases.filter((e) => e.bos).map((e) => e.bos)
		if (bbos.length && targetType == "machine") {
			targets = targets.filter((t) => bbos.includes(t.os))
		}

		var bInf = targetFilterBases
			.filter((e) => e.ccat || e.bpath || e.bsub || e.blang)
			.map((e) => e.ccat || e.bpath || e.bsub || e.blang)
		bInf.forEach((tag) => {
			if (targetType == "machine") {
				console.log("BEFORE", targets.length)
				var tagSeq = this.getMachineTagSeqByName(tag)
				console.log(tagSeq)
				if (tagSeq) {
					targets = targets.filter((t) => this.checkMachineHasTagSeq(t, tagSeq))
				}

				console.log("AFTER", targets.length)
			}
		})

		const process = (arr, sortOrder, key, limit) => {
			return [...arr]
				.sort(
					sorter
						? sorter
						: (a, b) => (a[key] - b[key]) * (sortOrder == "asc" ? 1 : -1)
				)
				.slice(0, limit ? limit : 999999)
		}
		// console.log(targets)
		try {
			return process(targets, sortOrder, sortBy || "id", limit)
		} catch (error) {
			console.warn(
				`No entities returned by these filter settings (EntType: ${targetType} | SortOrder: ${sortOrder} | SortBy: ${sortBy} | Limit: ${limit})`
			)
		}
	}

	resolveExternalMember(id, name = null) {
		// console.log("Resolving external member...", arguments)
		if (id) {
			return this.V4API.getCompleteMemberProfileById(id)
		} else if (name) {
			return this.V4API.getMemberIdFromUsername(name)
				.then((resolvedId) =>
					this.V4API.getCompleteMemberProfileById(resolvedId)
				)
				.then((member) =>
					member && member.name
						? Object.assign({ type: "member" }, member)
						: member
				)
		}
	}

	resolveEnt(
		kwd,
		targetType = null,
		isIdLookup = false,
		discordMessage = null,
		lookup = false
	) {
		try {
			if (!kwd) {
				return false
			}
			var result = {}
			const isSelf = checkSelfName(kwd)
			if (isSelf) {
				try {
					var idByDid = this.getIdFromDiscordId(discordMessage.author.id)
					var idByDname = this.getIdFromDiscordName(
						discordMessage.author.username
					)
					kwd =
						H.sAcc(this.getMemberById(idByDid), "name") ||
						H.sAcc(this.getMemberById(idByDname), "name") ||
						kwd
				} catch (error) {
					console.error(error)
				}
			}
			// console.log("Resolving '" + kwd + "'...")
			if (targetType) {
				switch (targetType) {
				case "member":
					return (
						(isIdLookup
							? this.getMemberById(kwd, isSelf)
							: this.getMemberByName(kwd, isSelf)) ||
							(lookup && !/\s/.test(kwd)
								? this.resolveExternalMember(
									isIdLookup ? kwd : null,
									!isIdLookup ? kwd : null
								)
								: null)
					)
				case "machine":
					return isIdLookup
						? this.getMachineById(kwd)
						: this.getMachineByName(kwd)
				case "challenge":
					return isIdLookup
						? this.getChallengeById(kwd)
						: this.getChallengeByName(kwd)
				case "endgame":
				case "fortress":
				case "prolab":
					return this.getSpecialByName(kwd, targetType)
				default:
					console.warn(
						`Resolving datastore entity ${isIdLookup ? "by ID" : ""
						} from '${kwd}' failed. ${targetType ? "(Target type '" + targetType + " specified.)" : ""
						}`
					)
				}
			}
			if (isIdLookup && Number(kwd)) {
				result["member"] = this.getMemberById(kwd, isSelf)
				result["machine"] = this.getMachineById(kwd)
				result["challenge"] = this.getChallengeById(kwd)
				if (
					lookup &&
					!/\s/.test(kwd) &&
					!Object.values(result).some((e) => e)
				) {
					result["member"] = this.resolveExternalMember(
						isIdLookup ? kwd : null,
						!isIdLookup ? kwd : null
					)
				}
			} else {
				result["member"] = this.getMemberByName(kwd, isSelf)
				result["machine"] = this.getMachineByName(kwd)
				result["challenge"] = this.getChallengeByName(kwd)
				result["special"] = this.getSpecialByName(kwd)
				result["specialFlag"] = this.getSpecialFlagByName(kwd)
				if (
					lookup &&
					!/\s/.test(kwd) &&
					!Object.values(result).some((e) => e)
				) {
					result["member"] = this.resolveExternalMember(
						isIdLookup ? kwd : null,
						!isIdLookup ? kwd : null
					)
				}
			}
			return (
				result["member"] ||
				result["machine"] ||
				result["challenge"] ||
				result["special"] ||
				result["specialFlag"]
			)
		} catch (error) {
			console.error(error)
			console.warn(
				`Resolving datastore entity ${isIdLookup ? "[by ID] " : ""
				}from '${kwd}' failed. ${targetType ? "(Target type '" + targetType + "' specified.)" : ""
				}`
			)
			return false
		}
	}

	/**
	 * Get the member object whose name matches the parameter string.
	 * @param {string} name - The member name.
	 * @returns {(TeamMember|null)}
	 */
	getMemberByName(name, isSelf = false) {
		if (name) {
			var match = Object.values(this.TEAM_MEMBERS).find(
				(member) => member.name.toLowerCase() == name.toLowerCase()
			)
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
	}

	/**
	 * Get the machine object whose name matches the parameter string.
	 * @param {string} name - The machine name.
	 * @returns {(HtbMachine|null)}
	 */
	getMachineByName(name) {
		return Object.values(this.MACHINES).find(
			(machine) => machine.name.toLowerCase() == name.toLowerCase()
		)
	}

	/**
	 * Get the latest box, (or unreleased box, if one is found).
	 * @returns {HtbMachine} - The latest / unreleased machine
	 */
	getNewestOrUnreleasedBox() {
		return Object.values(this.MACHINES)
			.filter((e) => !e.submission)
			.reduce(function (prev, current) {
				return prev.id > current.id ? prev : current
			})
	}

	/**
	 * Get the ID of the latest box, (or unreleased box, if one is found).
	 * @returns {number} - The latest / unreleased machine id
	 */
	getNewBoxId() {
		return (
			Object.values(this.MACHINES)
				.filter((e) => !e.submission)
				.reduce(function (prev, current) {
					return prev.id > current.id ? prev : current
				}).id || null
		)
	}

	/**
	 * Get the challenge object whose name matches the parameter string.
	 * @param {string} name - The challenge name.
	 * @returns {(HtbChallenge|null)}
	 */
	getChallengeByName(name) {
		// Return machine object with name matching parameter string
		return Object.values(this.CHALLENGES).find(
			(challenge) => challenge.name.toLowerCase() == name.toLowerCase()
		)
	}

	/**
	 * Get the Fortress object whose name matches the parameter string.
	 * @param {string} name - The fortress name.
	 * @returns {(Fortress|null)}
	 */
	getFortressByName(name) {
		return Object.values(this.FORTRESSES).find((item) =>
			[item.name.toLowerCase(), item.company.name.toLowerCase()].includes(
				name.toLowerCase()
			)
		)
	}

	/**
	 * Get the Endgame object whose name matches the parameter string.
	 * @param {string} name - The endgame name.
	 * @returns {(Endgame|null)}
	 */
	getEndgameByName(name) {
		return Object.values(this.ENDGAMES).find(
			(item) => item.name.toLowerCase() == name.toLowerCase()
		)
	}

	/**
	 * Get the Pro Lab object whose name matches the parameter string.
	 * @param {string} name - The prolab name.
	 * @returns {(ProLab|null)}
	 */
	getProLabByName(name) {
		return Object.values(this.PROLABS).find(
			(item) => item.name.toLowerCase() == name.toLowerCase()
		)
	}

	/**
	 * Get the challenge object whose name matches the parameter string.
	 * @param {string} name - The special item name.
	 * @returns {Object}
	 */
	getSpecialByName(name = null, type = null) {
		// Return endgame, fortress or pro lab with name matching parameter string
		switch (type) {
		case "fortress":
			return this.getFortressByName(name)
		case "endgame":
			return this.getEndgameByName(name)
		case "prolab":
			return this.getProLabByName(name)
		default:
			return (
				this.getFortressByName(name) ||
					this.getEndgameByName(name) ||
					this.getProLabByName(name)
			)
		}
	}

	/**
	 * Get the special challenge flag pseudo-object whose name matches the parameter string.
	 * @param {string} name - The special challenge flag name.
	 * @returns {Object}
	 */
	getSpecialFlagByName(name) {
		// Return endgame, fortress or pro lab with name matching parameter string
		if (this.MISC.SPECIALS) {
			var specialTargetResolved = Object.values(this.MISC.SPECIALS)
				.flat()
				.map((e) => ({
					parent: e,
					flag: Object.values(e.flags)
						.map((f, i) => ({ name: f, idx: i + 1 }))
						.find(
							(f) =>
								f.name.replace(/\W/g, "").toLowerCase() ==
								name.replace(/\W/g, "").toLowerCase()
						),
				}))
				.flat()
				.filter((e) => e.flag)
				.shift()
			var res
			if (specialTargetResolved) {
				res = new HtbSpecialFlag(
					specialTargetResolved.flag.idx,
					specialTargetResolved.flag.name,
					specialTargetResolved.parent
				)
			} else {
				res = null
			}
			return res
		} else {
			return null
		}
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
		return (
			Object.values(this.MACHINES).find((machine) => machine.id == id) || null
		)
	}

	/**
	 * Get the challenge object whose id matches the parameter string.
	 * @param {number} id - The challenge id.
	 * @returns {(HtbChallenge|null)}
	 */
	getChallengeById(id) {
		return (
			Object.values(this.CHALLENGES).find((challenge) => challenge.id == id) ||
			null
		)
	}

	getMemberOwnsForTarget(member, target) {
		if (member && target) {
			// console.log(member)
			var validOwns = []
			switch (target.type) {
			case "machine":
			case "challenge":
				validOwns = member.activity
					.filter(
						(own) =>
							own.object_type == target.type &&
								(own.name == target.name || own.name == target.company)
					)
					.map((own) => ({ ...own, id: member.id }))
				break
			case "endgame":
			case "fortress":
				validOwns = member.activity
					.filter(
						(own) =>
							own.object_type == target.type &&
								(H.ciEquals(own.name, target.name) || H.ciEquals(own.name, target.company.name))
					)
					.map((own) => ({ ...own, id: member.id }))
				break
			case "flag":
				validOwns = member.activity
					.filter(
						(own) =>
							own.object_type == target.parent.type &&
								(own.name == target.parent.name ||
									own.name == target.parent.company)
					)
					.filter(
						(own) => target.name.toLowerCase() == own.flag_title.toLowerCase()
					)
					.map((own) => ({ ...own, id: member.id }))
				break
			case "prolab":
				validOwns = []
				break
			default:
				break
			}

			// console.info(`Got ${validOwns.length} valid owns...`)
			return !validOwns.length ? null : validOwns
		} else {
			return undefined
		}
	}

	filterMemberOwns(
		memberId,
		targetType = null,
		sortBy = "date",
		sortOrder = "desc",
		limit = 12
	) {
		const process = (arr, sortOrder, key, limit) => {
			if (key == "date") {
				return [...arr]
					.sort(
						(a, b) =>
							(Date.parse(b.date) - Date.parse(a.date)) *
							(sortOrder == "asc" ? 1 : -1)
					)
					.slice(0, limit ? limit : 999999)
			} else {
				return [...arr]
					.sort((a, b) => (b[key] - a[key]) * (sortOrder == "asc" ? 1 : -1))
					.slice(0, limit ? limit : 999999)
			}
		}
		const member = this.getMemberById(memberId)
		if (!member) return []
		// console.log(member)
		var owns = targetType
			? [...member.activity].filter((e) => e.object_type == targetType)
			: [...member.activity]
		const filteredOwns = process(owns, sortOrder, sortBy, limit)
		return filteredOwns || []
	}

	getTeamOwnsForTarget(target) {
		if (!target) {
			return undefined
		}
		// console.warn(target)
		var teamOwns = []
		// if (target.type == "flag") {
		// 	teamOwns = this.vTM.map(e => ({
		// 		id: e.id,
		// 		act: e.activity
		// 	})).map(member => member.act.filter(own => own.object_type == target.parent.type && own.flag_title == target.name).map(k => ({
		// 		...k,
		// 		uid: member.id
		// 	}))).filter(own => target.name == own.flag_title).flat(1).sort((a, b) => H.sortByZuluDatestring(a, b, "date", false))
		// } else {
		// 	teamOwns = this.vTM.map(e => ({
		// 		id: e.id,
		// 		act: e.activity
		// 	})).map(member => member.act.filter(own => own.object_type == target.type && own.name == target.name).map(k => ({
		// 		...k,
		// 		uid: member.id
		// 	}))).flat(1).sort((a, b) => H.sortByZuluDatestring(a, b, "date", false))
		// }
		teamOwns = this.vTM
			.map((m) => this.getMemberOwnsForTarget(m, target))
			.flat()
			.filter((e) => e)
			.map((k) => ({
				...k,
				uid: k.id,
			}))
			.flat(1)
			.sort((a, b) => H.sortByZuluDatestring(a, b, "date", false))

		console.info(`Got ${teamOwns.length} valid team owns...`)
		return !teamOwns.length ? null : teamOwns
	}

	filterTeamOwns(
		memberId,
		targetType = null,
		sortBy = "date",
		sortOrder = "desc",
		limit = 12
	) {
		const process = (arr, sortOrder, key, limit) => {
			if (key == "date") {
				return [...arr]
					.sort(
						(a, b) =>
							(Date.parse(b.date) - Date.parse(a.date)) *
							(sortOrder == "asc" ? 1 : -1)
					)
					.slice(0, limit ? limit : 999999)
			} else {
				return [...arr]
					.sort((a, b) => (b[key] - a[key]) * (sortOrder == "asc" ? 1 : -1))
					.slice(0, limit ? limit : 999999)
			}
		}
		const member = this.getMemberById(memberId)
		var owns = targetType
			? [...member.activity].filter((e) => e.object_type == targetType)
			: [...member.activity]
		const filteredOwns = process(owns, sortOrder, sortBy, limit)
		return filteredOwns || null
	}

	getAllMachineTagNames(
		machine = {
			tags: [],
		},
		separate = false
	) {
		if (!machine.tags) {
			machine.tags = []
		}
		var tagDict = {}
		machine.tags.map((tag) => {
			console.info(tag)
			const category = Object.values(this.MISC.MACHINE_TAGS).find(
				(e) => e.id == tag.tag_category_id
			)
			console.info(category)
			const subtype = category
				? category.tags.find((e) => e.id == tag.id) || null
				: null
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
		Object.keys(this.MISC.MACHINE_TAGS).some((key) => {
			var res = this.MISC.MACHINE_TAGS[key]["tags"].find(
				(e) => e.name == tagName
			)
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
		return machine.tags.some(
			(tag) => tag.id == tagSeq[1] && tag.tag_category_id == tagSeq[0]
		)
	}
	/**
	 * Get the member object whose name matches the parameter string.
	 * @param {string} name - The member name.
	 * @returns {(TeamMember|null)}
	 */
	getTopMembers(count = 25) {
		var teamMembersAll = {
			...this.TEAM_MEMBERS,
			...this.TEAM_MEMBERS_IGNORED,
		}
		var sortedByTPoints = [...Object.values(teamMembersAll)]
			.sort((a, b) => b.points - a.points)
			.map((e) => e.id)
		var out = sortedByTPoints.slice(0, count)
		return out.length == 1 ? out[0] : out
	}

	getDiscordUserSynonymsForUid(id, names) {
		var dcMem = this.D_STATIC[id]
		var buffer = [
			...new Set(
				[H.sAcc(dcMem, "username") || "", H.sAcc(dcMem, "nickname") || ""]
					.filter((e) => e)
					.filter((e) => !names.includes(e.toLowerCase()))
			),
		]
		return buffer
	}

	getDiscordUserSynonymsForUidNoVerify(id) {
		var dcMem = this.D_STATIC[id]
		var buffer = [
			...new Set(
				[
					H.sAcc(dcMem, "username") || "",
					H.sAcc(dcMem, "nickname") || "",
				].filter((e) => e)
			),
		]
		return buffer
	}
	/**
	 * Returns a pretty-printable version of the Discord username and / or HTB username for a given HTB UID, in hyperlinked Discord markdown.
	 * @param {number} uid
	 * @returns {(string|"[Invalid ID]")}
	 */
	tryDiscordifyUid(uid, isSelf = false, showBothNames = true) {
		if (uid in this.TEAM_MEMBERS) {
			if (uid in this.D_STATIC) {
				var dcMem = this.D_STATIC[uid]
				var discordName =
					H.sAcc(dcMem, "username") || "" || H.sAcc(dcMem, "nickname") || ""
				if (
					discordName.toLowerCase() != this.TEAM_MEMBERS[uid].name.toLowerCase()
				) {
					return `🌀${F.STL(discordName, "bs")}${showBothNames ? " (" + this.TEAM_MEMBERS[uid].name + ")" : ""
					}${isSelf ? " [You]" : ""}`
				} else {
					return `🌀 ${F.STL(discordName, "bs")}${isSelf ? " [You]" : ""}`
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
		var id = Object.keys(this.D_STATIC).find(
			(link) =>
				((H.sAcc(this.D_STATIC[link], "username") || "").toLowerCase() ||
					H.sAcc(this.D_STATIC[link], "nickname") ||
					"") == username.toLowerCase()
		)
		return id || false
	}

	/**
	 * Gets the HTB user ID for a given Discord username, if such an association exists.
	 * @param {string} dId - The Discord username to lookup linked account for.
	 * @returns {(number|false)}
	 */
	getIdFromDiscordId(dId) {
		var id = Object.keys(this.D_STATIC).find(
			(link) =>
				H.sAcc(this.D_STATIC[link], "id") ||
				H.sAcc(this.D_STATIC[link], "userID") == dId
		)
		return id || false
	}

	/**
	 * Get the  current rank of a team member by ID.
	 * @param {number} id - The member ID.
	 * @returns {(number|"Unknown")}
	 */
	getMemberTeamRankById(id) {
		return (
			[...Object.values(this.TEAM_MEMBERS)]
				.sort((a, b) => b.points - a.points)
				.map((e) => e.id)
				.indexOf(id) + 1
		)
	}

	/**
	 * Returns a set of markdown-formatted username links for a given list of HTB ids.
	 * @param {number[]} memberIds - An array of HTB UIDs
	 * @returns {(string[]|"[Invalid ID]")}
	 */
	getMdLinksForUids(
		memberIds,
		showBothNames = true,
		customTextFieldBasis = null,
		discordMessage = null
	) {
		// Get markdown link to a HTB user's profile, based on UID.
		//console.log(memberIds)
		if (memberIds) {
			var screenNames = []
			memberIds.forEach((uid) => {
				// console.log("UID: " + uid)
				var discordName =
					this.getDiscordUserSynonymsForUidNoVerify(uid)[0] || ""
				var isSameName =
					discordName.toLowerCase() == this.TEAM_MEMBERS[uid].name.toLowerCase()
				if (uid in this.TEAM_MEMBERS) {
					screenNames.push(
						`[\`${this.tryDiscordifyUid(
							uid,
							false,
							showBothNames
						)}\`](${F.memberProfileUrl({ id: uid })} '${!isSameName && discordName && !showBothNames
							? "(" + this.TEAM_MEMBERS[uid].name + ") ⟶ "
							: ""
						}${customTextFieldBasis
							? this.TEAM_MEMBERS[uid][customTextFieldBasis]
							: "View on HTB"
						}')`
					)
				} else {
					console.log("UID opted out of data collection.")
					screenNames.push("[٩(͡๏̯͡๏)۶](http://? '👀')")
				}
			})

			if (screenNames.length == 0) {
				return null
			} else {
				// console.log(screenNames)
				return screenNames
			}
		} else {
			return null
		}
	}

	/**
	 * Returns a set of markdown-formatted username links for a given list of HTB ids.
	 * @param {number[]} memberIds - An array of HTB UIDs
	 * @returns {(string[]|"[Invalid ID]")}
	 */
	modernGetMdLinksForUids(
		memberIds,
		showBothNames = true,
		customTextFieldBasis = null,
		discordMessage = null
	) {
		// Get markdown link to a HTB user's profile, based on UID.
		//console.log(memberIds)
		if (memberIds.length) {
			var screenNames = []
			return memberIds.map((e) => this.tryDiscordifyUid())
		} else {
			return null
		}
	}

	/**
	 * Takes information about a new own achievement and adds it to our records.
	 * @param {number} uid - The ID of the user associated with the achievement.
	 * @param {string} type - A string value describing the thing / milestone owned, e.g. "root", "user", "challenge", "endgame", "akerva" etc.
	 * @param {(number|string)} targetName - If a machine user/system own, use the numeric machine ID (e.g. 238). If a challenge or fortress own, use the title.
	 * @param {string} flag - For pro labs and fortresses with multiple flags, use this field to specify the milestone title.
	 */
	integratePusherOwn(
		uid,
		time,
		type,
		targetName,
		flag = null,
		isPusher = false
	) {
		var member = this.getMemberById(uid)
		var target = this.resolveEnt(targetName, type)
		var entriesAffected = false
		if (member && target) {
			console.log(
				`[PUSHER INTEGRATION]::: Resolved member ${member.name} [${member.id}] and target ${target.name} [${target.type}]`
			)
			try {
				switch (flag || type) {
				case "user":
					var userOwn = member.activity.find(
						(own) =>
							own.type == "user" &&
								(own.name == target.name || own.id == target.id)
					)
					if (!userOwn) {
						member.activity.push({
							date: new Date(time).toISOString(),
							date_diff: F.timeSince(new Date(time)),
							object_type: target.type,
							type: "user",
							id: target.id,
							name: target.name,
							points: target.points,
							machine_avatar: target.avatar,
						})
						entriesAffected = true
						console.log(isPusher ? "Added user own for " + member.name : "")
					} else {
						console.warn(
							`${member.name} already had a '${flag || type
							}' own registered for ${target.name}...`
						)
					}
					break

				case "root":
					var rootOwn = member.activity.find(
						(own) =>
							own.type == "root" &&
								(own.name == target.name || own.id == target.id)
					)
					if (!rootOwn) {
						member.activity.push({
							date: new Date(time).toISOString(),
							date_diff: F.timeSince(new Date(time)),
							object_type: target.type,
							type: "root",
							id: target.id,
							name: target.name,
							points: target.points,
							machine_avatar: target.avatar,
						})
						entriesAffected = true
						console.log(isPusher ? "Added root own for " + member.name : "")
					} else {
						console.warn(
							`${member.name} already had a '${flag || type
							}' own registered for ${target.name}...`
						)
					}
					break

				case "challenge":
					var challOwn = member.activity.find(
						(own) =>
							own.type == "root" &&
								(own.name == target.name || own.id == target.id)
					)
					if (!challOwn) {
						member.activity.push({
							date: new Date(time).toISOString(),
							date_diff: F.timeSince(new Date(time)),
							object_type: target.type,
							type: "challenge",
							id: target.id,
							name: target.name,
							points: target.points,
							challenge_category: target.category_name,
						})
						entriesAffected = true
						console.log(
							isPusher ? "Added challenge own for " + member.name : ""
						)
					} else {
						console.warn(
							`${member.name} already had a '${flag || type
							}' own registered for ${target.name}...`
						)
					}
					break
				default:
					break
				}
			} catch (error) {
				console.error(error)
			}
		}
		return entriesAffected
	}

	/**
	 * Takes information about a new own achievement and adds it to our records.
	 * @param {HtbUser} htbUser - The pre-resolved HTB user object associated with the achievement (useful if external / not from team).
	 * @param {number} uid - The ID of the user associated with the achievement.
	 * @param {string} type - A string value describing the thing / milestone owned, e.g. "root", "user", "challenge", "endgame", "akerva" etc.
	 * @param {(number|string)} targetName - If a machine user/system own, use the numeric machine ID (e.g. 238). If a challenge or fortress own, use the title.
	 * @param {string} flag - For pro labs and fortresses with multiple flags, use this field to specify the milestone title.
	 */
	integratePusherBlood(
		htbUser,
		uid,
		time,
		type,
		targetName,
		flag = null,
		isPusher = false
	) {
		var member = this.getMemberById(uid)
		var user = member || htbUser
		var target = this.resolveEnt(targetName, type)
		var entriesAffected = false
		if (user && target) {
			console.log(
				`[PUSHER INTEGRATION]::: Resolved user ${user.name} [${user.id}] and target ${target.name} [${target.type}] (${flag}}🩸)`
			)
			try {
				switch (flag || type) {
				case "user":
					target.userBlood = {
						user: {
							name: user.name,
							id: user.id,
							avatar: user.avatar,
						},
						created_at: new Date(time).toISOString(),
						blood_difference: "0̗͖̋ͯ̚1̪͍̘̘ͭ1͎͓̅̔̃0̫̮̲ͣ̎2͕̰̈͋̅2͚̹͕̋ͩ", // 👀
					}
					if (member) {
						member.user_bloods = member.user_bloods
							? member.user_bloods + 1
							: 1
					}
					entriesAffected = true
					console.log(isPusher ? "Added user blood for " + user.name : "")
					break

				case "root":
					target.rootBlood = {
						user: {
							name: user.name,
							id: user.id,
							avatar: user.avatar,
						},
						created_at: new Date(time).toISOString(),
						blood_difference: "2̬̖ͧ̊ͧ2̜̫̖̉̔0͔̰͖̍̽1̗̥ͩ̋́1̪͕̀̅̔2̮ͬͩ̇͒", // That'll confuse somebody at some point
					}
					if (member) {
						member.system_bloods = member.system_bloods
							? member.system_bloods + 1
							: 1
					}
					entriesAffected = true
					console.log(isPusher ? "Added root blood for " + user.name : "")
					break

				case "challenge":
					target.solves = target.solves ? target.solves + 1 : 1
					target.first_blood_user = user.name
					target.first_blood_user_id = user.id
					target.first_blood_time = "2̬̖ͧ̊ͧ2̜̫̉̔0͔̰͖̍̽2̜̫̖̉̔1̗̥ͩ̋́2̮ͬͩ̇͒"
					target.first_blood_user_avatar = user.avatar
					entriesAffected = true
					console.log(isPusher ? "Added challenge blood for " + user.name : "")
					break
				default:
					break
				}
			} catch (error) {
				console.error(error)
			}
		}
		return entriesAffected
	}

	mdLinksFromBoxIds(boxIds) {
		// Get markdown links to a HTB user's profile, based on UID.
		// console.log(boxIds)
		if (boxIds) {
			var boxLinks = []
			boxIds.forEach((boxId) => {
				if (boxId in this.MACHINES) {
					var box = this.MACHINES[boxId]
					boxLinks.push(
						"**[" +
						box.name +
						"](" +
						"https://app.hackthebox.com/machines/" +
						box.id +
						" 'Goto HTB page')**"
					)
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
	SevenDatastore,
}
