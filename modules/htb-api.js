const request = require("superagent")
const Throttle = require("superagent-throttle")
// const superdebug = require("superdebug")
require("superagent-retry-delay")(request)
// var logger = require("superagent-logger");
const { Helpers: H } = require("../helpers/helpers.js")

const setTypeForValues = (type, objectMap) => {
	Object.keys(objectMap).map(key => (objectMap[key].type = type))
	return objectMap // Add object type specifier for easier introspection
}

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

class HtbApiConnector {

	constructor() {
		this.API_TOKEN = ""
		this.throttles = {}
		this.throttle = new Throttle({
			active: true,  // set false to pause queue
			rate: 25,       // how many requests can be sent every `ratePer`- 20
			ratePer: 60000, // number of ms in which `rate` requests may be sent - 1 minute / 60,000 ms
			concurrent: 1, // how many requests can be sent concurrently - 20
		})
	}

	async init({ api_token, email, password }) {
		if (api_token) {
			this.API_TOKEN = api_token
		} else {
			this.API_TOKEN = await this.getV4AccessToken(email, password)
		}

		this.AUTH_INFO = { api_token, email, password }
	}

	async getV4AccessToken(email, password) {
		return new Promise(function (resolve, reject) {
			const agent = request.agent()
			agent
				.post("https://www.hackthebox.com/api/v4/login")
				.set({ "Content-Type": "application/json;charset=utf-8" })
				.send({ email: email, password: password, remember: true })
				.then((response) => {
					console.warn(
						`[API CONNECTOR]::: Acquired v4 Session (Valid until ${new Date(parseJwt(response.body.message.access_token).exp * 1000).toLocaleString()})`
					)
					resolve(response.body.message.access_token)
				})
				.catch((err) => {
					console.warn(err.response.request)
					console.warn("[API CONNECTOR]::: Could not get session:", err.status)
				})
		})
	}

	getThrottle(endpoint) {
		if (!this.throttles[endpoint]) {
			this.throttles[endpoint] = new Throttle({
				active: true,   // set false to pause queue
				rate: 10,       // how many requests can be sent every `ratePer`- 20
				ratePer: 60000, // number of ms in which `rate` requests may be sent - 1 minute / 60,000 ms
				concurrent: 1,  // how many requests can be sent concurrently - 20
			})
			console.warn(`SA_THROTTLE::: Added throttling for endpoint ${endpoint}`)
		}
		return this.throttles[endpoint]
	}

	updateThrottle(endpoint, rLimit, rLeft, fullPath) {
		// console.info(`${new Date().toLocaleString()} RL [${fullPath}] ⇛ ${"▓".repeat(rLimit - rLeft)}${"░".repeat(rLeft)} ( ${rLimit - rLeft} / ${rLimit} used )` )
		this.getThrottle(endpoint).rate = Math.floor((Number(rLimit) || 15) * 0.90)
	}




	async htbApiGet(endpointPath, parseText = false) {
		var endpoint = endpointPath.replace(/\d[^$]*/gm, "").replace(/\/$/, "")
		if (this.checkTokenExpiring(this.API_TOKEN)) {
			try {
				this.API_TOKEN = await this.getV4AccessToken(this.AUTH_INFO.email, this.AUTH_INFO.password)
			} catch (error) {
				console.error(error)
			}
		}
		return new Promise((resolve, reject) => {
			const agent = request.agent()
			agent
				.get("https://www.hackthebox.com/api/v4/" + endpointPath)
				.set({ Accept: "application/json, */*" })
				.set({ Authorization: "Bearer " + this.API_TOKEN })
				.retry(10, [1000, 3000, 60000], [])
				.timeout({
					response: 10000,  // Wait 10 seconds for the server to start sending,
					deadline: 60000, // but allow 1 minute for the file to finish loading.
				})
				.use(this.getThrottle(endpoint).plugin())
				// .use(logger)
				.then((response) => {
					var rLimit = H.sAcc(response, "headers", "x-ratelimit-limit") || 60
					var rLeft = H.sAcc(response, "headers", "x-ratelimit-remaining") || 60
					this.updateThrottle(endpoint, rLimit, rLeft, endpointPath)
					console.log(`${new Date().toLocaleTimeString()} ⇛ ${response.status.toString().padStart(3," ")}: GET "${response.request.url.substring(33)}"` + ( response.headers["x-ratelimit-limit"] ? ` | Remaining limiter credit: ${response.headers["x-ratelimit-remaining"]} / ${response.headers["x-ratelimit-limit"]}`: " | (No rate limiter on this endpoint)" ))
					if (parseText) {
						try {
							let res = JSON.parse(response.text)
							resolve(res)
						} catch (error) {
							console.log(response?.text || response)
							reject()
						}

					} else {
						resolve(response.body)
					}
				})
				.catch((err) => {
					console.warn("Could not access '" + endpointPath + "':", H.sAcc(err))
					reject(err)
				})
		})
	}

	async getMachineTags() {
		var tagsArray = (await this.htbApiGet("machine/tags/list", this.API_TOKEN)).info
		return (H.arrToObj(tagsArray, "id"))
	}

	/**
	 * MACHINE DATA GETTERS
	 */
	async getCompleteMachineProfileById(id) {
		return this.htbApiGet(`machine/profile/${id}`)
	}



	async getCurrentMachines() {
		return setTypeForValues("machine", H.arrToObj((await this.htbApiGet("machine/list")).info, "id"))
	}

	async getRetiredMachines() {
		return setTypeForValues("machine", H.arrToObj((await this.htbApiGet("machine/list/retired")).info, "id"))
	}

	async getStartingPointMachinesForTier(tierNumber) {
		return this.htbApiGet(`sp/tier/${tierNumber}`).then(e => e.data)
	}

	async getAllStartingPointMachines() {
		var t1 = await this.getStartingPointMachinesForTier(1)
		var t2 = await this.getStartingPointMachinesForTier(2)
		var t3 = await this.getStartingPointMachinesForTier(3)
		let machines = [t1, t2, t3].map(t => t.machines.map(m => Object.assign({ tier: { id: t.id, name: t.name, description: t.description } }, m))).flat()
		return setTypeForValues("sp_machine", H.arrToObj(machines, "id"))
	}

	getRecommendedMachineCards() {
		return this.htbApiGet("machine/recommended").then(
			cards => {
				var processed = [cards.card1, cards.card2 || null]
				cards.state.forEach((e, idx) => processed[idx]["state"] = e)
				return processed
			}
		)
	}

	getComingMachine() {
		return this.getRecommendedMachineCards().then(
			cards => {
				var newMachineCard = cards.find(card => card.state == "coming")
				if (newMachineCard) {
					delete newMachineCard.state
					return setTypeForValues("machine", H.arrToObj([newMachineCard], "id"))
				} else {
					return {}
				}
			}
		)
	}

	getUnreleasedMachines() {
		return this.htbApiGet(`machine/unreleased/`).then(e => H.arrToObj(e?.data || [], "id"))
	}


	async getAllMachinesFast() {
		var retired = await this.getRetiredMachines()
		var current = await this.getCurrentMachines()
		var coming = await this.getUnreleasedMachines()
		var all = { ...retired, ...current, ...coming }
		return all
	}

	async getAllCompleteMachineProfiles() {
		var machines = await this.getAllMachinesFast()
		const ids = Object.values(machines).map(machine => machine.id)
		return this.getCompleteMachineProfilesByIds(ids).then(profiles => {
			Object.keys(profiles).map(mId => profiles[mId] = H.combine([machines[mId], profiles[mId]]))
			return profiles
		}
		)
	}

	getCompleteMachineProfilesByIds(machineIds) {
		return Promise.all(machineIds.map(id => this.getCompleteMachineProfileById(id)))
			.then(machines => setTypeForValues("machine", H.arrToObj(machines.map(e => e.info), "id")))
	}

	/**
	 * CHALLENGE DATA GETTERS
	 */

	searchChallengeByExactName(name) {
		return this.htbApiGet(`search/fetch?query=${name}&tags=%5B%22challenges%22%5D`, true).then(res => { console.log((res.challenges ? "FOUNDIT! - " + name + " - " : "NOTFOUND! - " + name + " - ")); return (res.challenges ? res.challenges : []) })
	}

	/** @returns {Challenge[]} */
	async getCurrentChallenges() {
		return setTypeForValues("challenge", H.arrToObj((await this.htbApiGet("challenge/list", this.API_TOKEN)).challenges, "id"))
	}

	/** @returns {Challenge[]} */
	async getRetiredChallenges() {
		return setTypeForValues("challenge", H.arrToObj((await this.htbApiGet("challenge/list/retired", this.API_TOKEN)).challenges, "id"))
	}

	/** @returns {Challenge[]} */
	async getAllChallengesFast() {
		var retired = await this.getRetiredChallenges()
		var current = await this.getCurrentChallenges()
		var all = { ...retired, ...current }
		return all
	}

	/** @returns {Challenge} */
	async getCompleteChallengeProfileById(id) {
		return this.htbApiGet(`challenge/info/${id}`)
	}

	/** @returns {Challenge[]} */
	getCompleteChallengeProfilesByIds(challengeIds) {
		return Promise.all(challengeIds.map(id => this.getCompleteChallengeProfileById(id)))
			.then(challenges => setTypeForValues("challenge", H.arrToObj(challenges.map(e => e.challenge), "id")))
	}

	/** @returns {Challenge[]} */
	async getAllCompleteChallengeProfiles() {
		var challenges = await this.getAllChallengesFast()
		const ids = Object.values(challenges).map(challenge => challenge.id)
		return this.getCompleteChallengeProfilesByIds(ids).then(profiles => {
			Object.keys(profiles).map(cId => profiles[cId] = H.combine([challenges[cId], profiles[cId]]))
			return profiles
		})
	}

	getChallengeCategories() {
		return this.htbApiGet("challenge/categories/list").then(res => H.arrToObj(res.info, "id"))
	}

	/**
	 * FORTRESS DATA GETTERS
	 */

	/** @returns {FortressEntry[]} */
	async getAllFortressEntries() {
		return Object.values((await this.htbApiGet("fortresses", this.API_TOKEN)).data)
	}

	/** @returns {FortressProfile} */
	async getFortressProfile(id) {
		return this.htbApiGet(`fortress/${id}`).then(e => Object.assign(e.data, { type: "fortress" }))
	}

	/** @returns {Fortress[]} */
	async getAllFortresses() {
		let entries = await this.getAllFortressEntries()
		let profiles = await Promise.all(entries.map(entry => this.getFortressProfile(entry.id)))
		let fortresses = H.arrToObj(entries.map((e, i) => H.combine([e, profiles[i]])), "id")
		return fortresses
	}


	/**
	 * ENDGAME DATA GETTERS
	 */

	/** @returns {EndgameEntry[]} */
	async getAllEndgameEntries() {
		return Object.values((await this.htbApiGet("endgames")).data)
	}

	/** @returns {EndgameProfile} */
	async getEndgameProfile(id) {
		// console.log(await this.htbApiGet(`endgame/${id}`))
		return this.htbApiGet(`endgame/${id}`).then(e => Object.assign(e.data, { type: "endgame" }))
	}

	/** @returns {Flag[]} */
	async getEndgameFlags(id) {
		// console.log(await this.htbApiGet(`endgame/${id}`))
		return this.htbApiGet(`endgame/${id}/flags`).then(e => e.data)
	}

	/** @returns {Endgame[]} */
	async getAllEndgames() {
		let entries = await this.getAllEndgameEntries()
		let profiles = await Promise.all(entries.map(entry => this.getEndgameProfile(entry.id)))
		let flags = await Promise.all(entries.map(entry => this.getEndgameFlags(entry.id)
			.then(flags => ({ flags: flags }))
		))
		let endgames = H.arrToObj(entries.map((e, i) => H.combine([e, flags[i], profiles[i]])), "id")
		return endgames
	}


	/**
	 * PRO LAB DATA GETTERS
	 */

	/** @returns {ProLabEntry[]} */
	async getAllProLabEntries() {
		return Object.values((await this.htbApiGet("prolabs")).data.labs)
	}

	/** @returns {Flag[]} */
	async getProLabFlags(id) {
		return this.htbApiGet(`prolab/${id}/flags`).then(e => Object.assign(e.data, { type: "prolab" }))
	}

	/** @returns {ProLabInfo} */
	async getProLabInfo(id) {
		return this.htbApiGet(`prolab/${id}/info`).then(e => Object.assign(e.data, { type: "prolab" }))
	}

	/** @returns {ProLabOverview} */
	async getProLabOverview(id) {
		return this.htbApiGet(`prolab/${id}/overview`).then(e => Object.assign(e.data, { type: "prolab" }))
	}

	/** @returns {ProLab[]} */
	async getAllProlabs() {
		let entries = await this.getAllProLabEntries()
		let flags = await Promise.all(entries.map(entry => this.getEndgameFlags(entry.id)
			.then(flags => ({ flags: flags }))
		))
		let infos = await Promise.all(entries.map(entry => this.getProLabInfo(entry.id)))
		let overviews = await Promise.all(entries.map(entry => this.getProLabOverview(entry.id)))
		let prolabs = H.arrToObj(entries.map((e, i) => H.combine([e, flags[i], infos[i], overviews[i]])), "id")
		return prolabs
	}


	/**
	 * TEAM DATA GETTERS
	 */

	/** @returns {Team} */
	getTeamProfile(teamId) {
		return this.htbApiGet(`team/info/${teamId}`)
	}

	/** @returns {Team} */
	getCompleteTeamProfile(teamId) {
		return Promise.all([this.getTeamProfile(teamId),
		this.getTeamOwnStats(teamId),
		this.getTeamStatsGraphForDuration(teamId, "1W").then(res => ({ respects: res.respect.pop() }))]
		).then(res => H.combine([...res, { type: "team" }]))
	}

	/** @returns {User[]} */
	getTeamMembers(teamId, excludedIds = []) {
		return this.htbApiGet(`team/members/${teamId}`)
			.then(res => res?.filter(member => !excludedIds.includes(member.id) && member.role != "pending"))
	}

	getTeamInvitations(teamId) {
		return this.htbApiGet(`team/invitations/${teamId}`)
	}

	getTeamActivity(teamId) { // Last 20 team owns (owning member not indicated)
		return this.htbApiGet(`team/activity/${teamId}`)
	}

	getTeamOwnStats(teamId) {
		return this.htbApiGet(`team/stats/owns/${teamId}`)
	}

	getTeamOwnStatsByAttackPath(teamId) {
		return this.htbApiGet(`team/chart/machines/attack/${teamId}`)
	}

	getTeamStatsGraphForDuration(teamId, duration = "1Y") { // One of ["1Y", "6M", "3M", "1M", "1W"]
		return this.htbApiGet(`team/graph/${teamId}?duration=${duration}`).then(res => res.data)
	}

	getSelfTeamRankHistory(period = "1Y") { // One of ["1Y", "6M", "3M", "1M", "1W"]
		return this.htbApiGet(`rankings/team/best?period=${period}`).then(res => res.data)
	}

	getSelfTeamPointsHistory(period = "1Y") { // One of ["1Y", "6M", "3M", "1M", "1W"]
		return this.htbApiGet(`rankings/team/overview?period=${period}`).then(res => res.data)
	}

	getSelfTeamRankOverview() {
		return this.htbApiGet("rankings/team/ranking_bracket").then(res => res.data)
	}

	getTopHundredTeams() {
		return this.htbApiGet("rankings/teams").then(res => res.data)
	}


	/**
	 * UNIVERSITY DATA GETTERS (USE AT YOUR OWN RISK!!)
	 */

	getUniversityProfile(universityId) {
		return this.htbApiGet("rankings/universities").then(e => Object.values(e.data).find(uni => uni.id == universityId) || null)
	}


	/**
	 * MEMBER DATA GETTERS
	 */

	getMemberIdFromUsername(username = "ThisUserCouldNotPossiblyExist") {
		var val = this.htbApiGet(`search/fetch?query=${username}&tags=[%22users%22]`, true).then(res => (res.users ? res.users[0].id : null))
		// console.log(username, val)
		return val
	}

	getMemberProfile(memberId) {
		const uri = "user/profile/basic/"
		return this.htbApiGet(uri + memberId, this.API_TOKEN)
	}

	getCompleteMemberProfileById(memberId) {
		if (!memberId) return null
		const memberData = Promise.all([
			this.getMemberProfile(memberId),
			this.getMemberActivity(memberId),
			this.getMemberMachineOsProgress(memberId),
			this.getMemberChallengeProgress(memberId),
			this.getMemberEndgameProgress(memberId),
			this.getMemberFortressProgress(memberId),
			this.getMemberProlabProgress(memberId),
			this.getMemberBloods(memberId)
		]).then((results) => H.combine(results.map(e => e.profile)))
		return memberData
	}

	getCompleteMemberProfileByMemberPartial(member) {
		const memberData = Promise.all([
			this.getMemberProfile(member.id),
			this.getMemberActivity(member.id),
			this.getMemberMachineOsProgress(member.id),
			this.getMemberChallengeProgress(member.id),
			this.getMemberEndgameProgress(member.id),
			this.getMemberFortressProgress(member.id),
			this.getMemberProlabProgress(member.id),
			this.getMemberBloods(member.id)
		]).then((results) => H.combine([member, ...results.map(e => e.profile)]))
		return memberData
	}

	getCompleteMemberProfilesByIds(memberIds) {
		const promises = memberIds.map(id => this.getCompleteMemberProfileById(id))
		const combinedData = Promise.all(promises).then(results => setTypeForValues("member", H.arrToObj(results, "id")))
		return combinedData
	}

	getCompleteMemberProfilesByMemberPartials(members) {
		const promises = members.map(member => this.getCompleteMemberProfileByMemberPartial(member))
		const combinedData = Promise.all(promises).then(results => setTypeForValues("member", H.arrToObj(results, "id")))
		return combinedData
	}

	getMemberAchievementChart(memberId, term) {
		return this.htbApiGet(`user/profile/graph/${term}/${memberId}`)
	}

	getMemberMachineOsProgress(memberId) {
		return this.htbApiGet(`user/profile/progress/machines/os/${memberId}`)
	}

	getMemberChallengeProgress(memberId) {
		return this.htbApiGet(`user/profile/progress/challenges/${memberId}`)
	}

	getMemberEndgameProgress(memberId) {
		return this.htbApiGet(`user/profile/progress/endgame/${memberId}`)
	}

	getMemberFortressProgress(memberId) {
		return this.htbApiGet(`user/profile/progress/fortress/${memberId}`)
	}

	getMemberProlabProgress(memberId) {
		return this.htbApiGet(`user/profile/progress/prolab/${memberId}`)
	}

	getMemberBloods(memberId) {
		return this.htbApiGet(`user/profile/bloods/${memberId}`)
	}

	getMachineAttackDataChart(memberId) {
		return this.htbApiGet(`user/profile/chart/machines/attack/${memberId}`)
	}



	async getMemberProfiles(memberIds) {
		const uri = "user/profile/basic/"
		var TEAM_MEMBERS_TEMP = {}
		var memberPromises = []

		memberIds.forEach((memberId) => {
			memberPromises.push(this.htbApiGet(uri + memberId, this.API_TOKEN))
		})

		const results = await Promise.all(memberPromises)
		results.forEach(
			(memberProfile) =>
			(TEAM_MEMBERS_TEMP[Number(memberProfile.profile.id)] =
				memberProfile.profile)
		)

		return setTypeForValues("user", TEAM_MEMBERS_TEMP)

	}

	async getMemberActivities(memberIds) {
		const uri = "user/profile/activity/"
		var TEAM_MEMBERS_ACTIVITIES = {}
		var memberPromises = []
		memberIds.forEach((memberId) => {
			memberPromises.push(this.htbApiGet(uri + memberId, this.API_TOKEN))
		})
		const results = await Promise.all(memberPromises)
		results.forEach(
			(memberProfile, idx) =>
			(TEAM_MEMBERS_ACTIVITIES[Number(memberIds[idx])] =
				memberProfile.profile.activity)
		)
		return TEAM_MEMBERS_ACTIVITIES
	}

	async getMemberActivity(memberId) {
		const uri = "user/profile/activity/"
		return this.htbApiGet(uri + memberId, this.API_TOKEN)
	}

	checkTokenExpiring(token) {
		return parseJwt(token).exp < Math.floor(Date.now() / 1000) - 120
			? true
			: false // Returns true if token is valid for at least two more minutes.
		// return (token.exp)
	}
}


function parseJwt(token) {
	if (token) {
		try {
			const base64Url = token.split(".")[1]
			const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
			const buff = new Buffer.from(base64, "base64")
			const payloadinit = buff.toString("ascii")
			const payload = JSON.parse(payloadinit)
			return payload
		} catch (e) {
			console.error(e)
			return null
		}
	} else {
		return null
	}
}

module.exports = {
	HtbApiConnector: HtbApiConnector
}