const request = require("superagent")
const Throttle = require("superagent-throttle")
const superdebug = require("superdebug")
const { Helpers: H } = require("../helpers/helpers.js")

const arrToObj = (array, key) => {
	const initialValue = {}
	return array.reduce((obj, item) => {
		return {
			...obj,
			[item[key]]: item,
		}
	}, initialValue)
}

const setTypeForValues = (type, objectMap) => {
	Object.keys(objectMap).map( key => ( objectMap[key].type = type ))
	return objectMap // Add object type specifier for easier introspection
}



class HtbApiConnector {

	constructor() {
		this.API_TOKEN = ""
		this.throttle = new Throttle({
			active: true, // set false to pause queue
			rate: 20, // how many requests can be sent every `ratePer`- 20
			ratePer: 1000, // number of ms in which `rate` requests may be sent - 1000
			concurrent: 20, // how many requests can be sent concurrently - 20
		})
	}

	async init(email, password){
		this.API_TOKEN = await this.getV4AccessToken(email, password)
		this.AUTH_INFO = {"email": email, "password": password}
	}
	

	async getV4AccessToken(email, password) {
		return new Promise(function(resolve, reject) {
			const agent = request.agent()
			agent
				.post("https://www.hackthebox.eu/api/v4/login")
				.set({ "Content-Type": "application/json;charset=utf-8" })
				.send({ email: email, password: password, remember: true })
				.then((response) => {
					console.warn(
						`Acquired API v4 Session (Valid until ${new Date(parseJwt(response.body.message.access_token).exp * 1000).toLocaleString()})`
					)
					resolve(response.body.message.access_token)
				})
				.catch((err) => {
					console.warn(err.response.request)
					console.warn("Could not get session:", err.status)
				})
		})
	}
	
	async htbApiGet(endpointPath, parseText=false) {
		if (this.checkTokenExpiring(this.API_TOKEN)){
			try {
				this.API_TOKEN = await this.getV4AccessToken(this.AUTH_INFO.email,this.AUTH_INFO.password)
			} catch (error) {
				console.error(error)
			}
		}
		return new Promise((resolve, reject) => {
			const agent = request.agent()
			agent
				.get("https://www.hackthebox.eu/api/v4/" + endpointPath)
				.set({ Accept: "application/json, */*" })
				.set({ Authorization: "Bearer " + this.API_TOKEN })
				.use(this.throttle.plugin())
				//.use(superdebug(console.info))
				.then((response) => {
					if (parseText) {
						resolve(JSON.parse(response.text))
					} else {
						resolve(response.body)
					}
				})
				.catch((err) => {
					console.warn("Could not access '" + endpointPath + "':", err)
					reject(false)
				})
		})
	}
	
	async getMachineTags() {
		var tagsArray = (await this.htbApiGet("machine/tags/list", this.API_TOKEN)).info
		return (arrToObj(tagsArray, "id"))
	}
	
	/**
	 * MACHINE DATA GETTERS
	 */
	async getCompleteMachineProfileById(id) {
		return this.htbApiGet(`machine/profile/${id}`)
	}

	

	async getCurrentMachines() {
		return setTypeForValues("machine", arrToObj((await this.htbApiGet("machine/list")).info, "id"))
	}
	
	async getRetiredMachines() {
		return setTypeForValues("machine", arrToObj((await this.htbApiGet("machine/list/retired")).info, "id"))
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
					return setTypeForValues("machine", arrToObj([newMachineCard], "id"))
				} else {
					return {}
				}
			}
		)
	}
	
	async getAllMachinesFast() {
		var retired = await this.getRetiredMachines()
		var current = await this.getCurrentMachines()
		var coming = await this.getComingMachine()
		var all = {...retired, ...current, ...coming}
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
			.then(machines => setTypeForValues("machine", arrToObj(machines.map(e => e.info), "id")))
	}
	
	/**
	 * CHALLENGE DATA GETTERS
	 */

	searchChallengeByExactName(name) {
		return this.htbApiGet(`search/fetch?query=${name}&tags=%5B%22challenges%22%5D`,true).then(res => {console.log((res.challenges? "FOUNDIT! - " + name + " - " : "NOTFOUND! - " + name + " - ")); return (res.challenges? res.challenges : [])})
	}
	
	async getCurrentChallenges() {
		return setTypeForValues("challenge", arrToObj((await this.htbApiGet("challenge/list", this.API_TOKEN)).challenges, "id"))
	}
	
	async getRetiredChallenges() {
		return setTypeForValues("challenge", arrToObj((await this.htbApiGet("challenge/list/retired", this.API_TOKEN)).challenges, "id"))
	}
	
	async getAllChallengesFast() {
		var retired = await this.getRetiredChallenges()
		var current = await this.getCurrentChallenges()
		var all = {...retired, ...current}
		return all
	}

	async getCompleteChallengeProfileById(id) {
		return this.htbApiGet(`challenge/info/${id}`)
	}


	getCompleteChallengeProfilesByIds(challengeIds) {
		return Promise.all(challengeIds.map(id => this.getCompleteChallengeProfileById(id)))
			.then(challenges => setTypeForValues("challenge", arrToObj(challenges.map(e => e.challenge), "id")))
	}
	
	async getAllCompleteChallengeProfiles() {
		var challenges = await this.getAllChallengesFast()
		const ids = Object.values(challenges).map(challenge => challenge.id)
		return this.getCompleteChallengeProfilesByIds(ids).then(profiles => {
			Object.keys(profiles).map(cId => profiles[cId] = H.combine([challenges[cId], profiles[cId]]))
			return profiles
		})
	}

	getChallengeCategories() {
		return this.htbApiGet("challenge/categories/list").then(res => arrToObj(res.info, "id"))
	}
	/**
	 * TEAM DATA GETTERS
	 */

	getTeamProfile(teamId) {
		return this.htbApiGet(`team/info/${teamId}`)
	}

	getCompleteTeamProfile(teamId) {
		return Promise.all([this.getTeamProfile(teamId),
			this.getTeamOwnStats(teamId),
			this.getTeamStatsGraphForDuration(teamId,"1W").then(res => ({respects: res.respect.pop()}))]
		).then(res => H.combine(res))
	}

	getTeamMembers(teamId, excludedIds=[]) {
		return this.htbApiGet(`team/members/${teamId}`).then(res => res.filter(member => !excludedIds.includes(member.id) && member.role != "pending"))
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

	getTeamStatsGraphForDuration(teamId, duration="1Y") { // One of ["1Y", "6M", "3M", "1M", "1W"]
		return this.htbApiGet(`team/graph/${teamId}?duration=${duration}`).then(res => res.data)
	}

	getSelfTeamRankHistory(period="1Y") { // One of ["1Y", "6M", "3M", "1M", "1W"]
		return this.htbApiGet(`rankings/team/best?period=${period}`).then(res => res.data)
	}

	getSelfTeamPointsHistory(period="1Y") { // One of ["1Y", "6M", "3M", "1M", "1W"]
		return this.htbApiGet(`rankings/team/overview?period=${period}`).then(res => res.data)
	}

	getSelfTeamRankOverview() {
		return this.htbApiGet("rankings/team/ranking_bracket").then(res => res.data)
	}

	getTopHundredTeams() {
		return this.htbApiGet("rankings/teams").then(res => res.data)
	}

	/**
	 * MEMBER DATA GETTERS
	 */
	
	getMemberIdFromUsername(username) {
		var val = this.htbApiGet(`search/fetch?query=${username}&tags=[%22users%22]`,true).then(res => (res.users? res.users[0].id : null))
		console.log(username, val)
		return val
	}

	getMemberProfile(memberId) {
		const uri = "user/profile/basic/"
		return this.htbApiGet(uri + memberId, this.API_TOKEN)
	}

	getCompleteMemberProfileById(memberId) {
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
		]).then((results) => H.combine(results.map(e => e.profile).concat(member)))
		return memberData
	}

	getCompleteMemberProfilesByIds(memberIds) {
		const promises = memberIds.map(id => this.getCompleteMemberProfileById(id))
		const combinedData = Promise.all(promises).then(results => setTypeForValues("member", arrToObj(results, "id")))
		return combinedData
	}

	getCompleteMemberProfilesByMemberPartials(members) {
		const promises = members.map(member => this.getCompleteMemberProfileByMemberPartial(member))
		const combinedData = Promise.all(promises).then(results => setTypeForValues("member", arrToObj(results, "id")))
		return combinedData
	}
	
	getMemberAchievementChart(memberId, term){
		return this.htbApiGet(`user/profile/graph/${term}/${memberId}`)
	}

	getMemberMachineOsProgress(memberId){
		return this.htbApiGet(`user/profile/progress/machines/os/${memberId}`)
	}

	getMemberChallengeProgress(memberId){
		return this.htbApiGet(`user/profile/progress/challenges/${memberId}`)
	}

	getMemberEndgameProgress(memberId){
		return this.htbApiGet(`user/profile/progress/endgame/${memberId}`)
	}

	getMemberFortressProgress(memberId){
		return this.htbApiGet(`user/profile/progress/fortress/${memberId}`)
	}

	getMemberProlabProgress(memberId){
		return this.htbApiGet(`user/profile/progress/prolab/${memberId}`)
	}

	getMemberBloods(memberId){
		return this.htbApiGet(`user/profile/bloods/${memberId}`)
	}
	
	getMachineAttackDataChart(memberId){
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
		// results.forEach(memberActivity => TEAM_MEMBERS_ACTIVITIES[Number(memberActivity.profile.id)] = memberActivity.profile)
		// return TEAM_MEMBERS_ACTIVITIES
	}

	async getMemberActivity(memberId) {
		const uri = "user/profile/activity/"
		return this.htbApiGet(uri + memberId, this.API_TOKEN)
	}
	
	checkTokenExpiring(token) {
		// console.log(new Date(parseJwt(token).exp * 1000))
		// console.log(new Date((Math.floor(Date.now() / 1000) - 60) * 1000))
		return parseJwt(token).exp < Math.floor(Date.now() / 1000) - 120
			? true
			: false // Returns true if token is valid for at least two more minutes.
		// return (token.exp)
	}

}



// const varToString = (varObj) => Object.keys(varObj)[0]

// function jsonOut(object, name) {
// 	try {
// 		objectJson = JSON.stringify(object, null, 4)
// 		fs.writeFileSync(`${name}.json`, objectJson)
// 		console.log(`${name}.json`)
// 		console.log("JSON data is saved.")
// 	} catch (error) {
// 		console.error(err)
// 	}
// }




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

// async function getV4AccessToken(email, password) {
// 	return new Promise(function(resolve, reject) {
// 		const agent = request.agent()
// 		agent
// 			.post("https://www.hackthebox.eu/api/v4/login")
// 			.set({ "Content-Type": "application/json;charset=utf-8" })
// 			.send({ email: email, password: password, remember: true })
// 			.then((response) => {
// 				console.warn(
// 					`Acquired API v4 Session (Valid until ${new Date(parseJwt(response.body.message.access_token).exp * 1000).toLocaleString()})`
// 				)
// 				resolve(response.body.message.access_token)
// 			})
// 			.catch((err) => {
// 				console.warn(err.response.request)
// 				console.warn("Could not get session:", err.status)
// 			})
// 	})
// }

// async function this.htbApiGet(endpointPath, token = this.API_TOKEN) {
// 	console.log(this.API_TOKEN)
// 	return new Promise((resolve, reject) => {
// 		const agent = request.agent()
// 		agent
// 			.get("https://www.hackthebox.eu/api/v4/" + endpointPath)
// 			.set({ Accept: "application/json, text/plain, */*" })
// 			.set({ Authorization: "Bearer " + token })
// 			.use(throttle.plugin())
// 			.then((response) => resolve(response.body))
// 			.catch((err) => {
// 				console.warn("Could not access '" + endpointPath + "':", err)
// 				reject(false)
// 			})
// 	})
// }

// async function init(email, password){
// 	this.API_TOKEN = await getV4AccessToken(email, password)
// }

// async function getMachineTags() {
// 	const uri = "machine/tags/list"
// }

// /**
//  * MACHINE DATA GETTERS
//  */

// async function getCurrentMachines() {
// 	return (await this.htbApiGet("machine/list", this.API_TOKEN)).info
// }

// async function getRetiredMachines() {
// 	return (await this.htbApiGet("machine/list/retired", this.API_TOKEN)).info
// }

// async function getAllMachines() {
// 	var retired = await getRetiredMachines()
// 	var current = await getCurrentMachines()
// 	return retired.concat(current)
// }

// /**
//  * CHALLENGE DATA GETTERS
//  */

// async function getCurrentChallenges() {
// 	return (await this.htbApiGet("challenge/list", this.API_TOKEN)).challenges
// }

// async function getRetiredChallenges() {
// 	return (await this.htbApiGet("challenge/list/retired", this.API_TOKEN)).challenges
// }

// async function getAllChallenges() {
// 	var retired = await getRetiredChallenges()
// 	console.log(retired)
// 	var current = await getCurrentChallenges()
// 	return retired.concat(current)
// }

// /**
//  * MEMBER DATA GETTERS
//  */

// async function getMemberProfile(memberId) {
// 	const uri = "user/profile/basic/"
// 	var TEAM_MEMBERS_TEMP = {}
// 	result = await this.htbApiGet(uri + memberId, this.API_TOKEN)
// 	return result.profile
// }

// async function getMemberAchievementChart(memberId, term){
// 	return this.htbApiGet(`user/profile/graph/${term}/${memberId}`)
// }

// async function getMemberProfiles(memberIds) {
// 	const uri = "user/profile/basic/"
// 	var TEAM_MEMBERS_TEMP = {}
// 	var memberPromises = []

// 	memberIds.forEach((memberId) => {
// 		memberPromises.push(htbApiGet(uri + memberId, this.API_TOKEN))
// 	})

// 	results = await Promise.all(memberPromises)
// 	results.forEach(
// 		(memberProfile) =>
// 			(TEAM_MEMBERS_TEMP[Number(memberProfile.profile.id)] =
//         memberProfile.profile)
// 	)
// 	return TEAM_MEMBERS_TEMP
// }

// async function getMemberActivities(memberIds) {
// 	const uri = "user/profile/activity/"
// 	var TEAM_MEMBERS_ACTIVITIES = {}
// 	var memberPromises = []
// 	memberIds.forEach((memberId) => {
// 		memberPromises.push(htbApiGet(uri + memberId, this.API_TOKEN))
// 	})
// 	results = await Promise.all(memberPromises)
// 	results.forEach(
// 		(memberProfile, idx) =>
// 			(TEAM_MEMBERS_ACTIVITIES[Number(memberIds[idx])] =
//         memberProfile.profile.activity)
// 	)
// 	return TEAM_MEMBERS_ACTIVITIES
// 	// results.forEach(memberActivity => TEAM_MEMBERS_ACTIVITIES[Number(memberActivity.profile.id)] = memberActivity.profile)
// 	// return TEAM_MEMBERS_ACTIVITIES
// }

// function checkTokenExpiring(token) {
// 	console.log(new Date(parseJwt(token).exp * 1000))
// 	console.log(new Date((Math.floor(Date.now() / 1000) - 60) * 1000))
// 	return parseJwt(token).exp < Math.floor(Date.now() / 1000) - 120
// 		? true
// 		: false // Returns true if token is valid for at least two more minutes.
// 	// return (token.exp)
// }

// async function main() {
// 	var id = 254747
// 	var term = "1Y"


// 	var members = await Promise.all([
// 		getMemberProfile(254747),
// 		getMemberProfile(5833),
// 		getMemberProfile(9267),
// 		getMemberProfile(73268),
// 	])

// 	for (let i = 0; i < members.length; i++) {
// 		const member = members[i]
// 		var chart = await getMemberAchievementChart(member.id, term)
// 		console.log(await CHART_RENDERER.renderChart(member, chart, term, "userProgress"))
// 	}
// }
module.exports = {
	HtbApiConnector:HtbApiConnector
}