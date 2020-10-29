const rp = require("request-promise")
const { JSDOM } = require("jsdom")
const { Helpers: H } = require("../helpers/helpers.js")
const { LegacyHtbMachine, LegacyHtbChallenge, LegacyTeamMember } = require("../helpers/classes_legacy.js")
const { HtbMachine, HtbMaker } = require("../helpers/classes.js")
const jp = require("jsonpath")
const { Format: F } = require("../helpers/format.js")
const csrfLogin = require("../helpers/csrf-login/csrf-login-override")
const { id } = require("date-fns/locale")

function parseSingleDate(date,) { // Parse date to timestamp (millis) for various formats used on HTB site, based on length
	if (date) {
		switch (date.length) {
		case 10:
			try {
				return new Date(F.parseDate(date, "y-MM-dd", new Date(0)).setUTCHours(19)).getTime()
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
				return new Date(F.parseDate(date, "MMMM do, yyyy", new Date(0)).setUTCHours(19)).getTime()
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


class HtbLegacyConnector {

	constructor() {
		this.CSRF_TOKEN = ""
		this.SESSION = {}
	}

	async init(){
		this.SESSION = await this.getSession()
		this.CSRF_TOKEN = this.grabCsrfFromJar(this.SESSION)
	}

	getMachines() {
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
						machineSet[machineIds[i].toString()] = new LegacyHtbMachine(machineNames[i],
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
				.catch((err) => {
					resolve(err)
				})
		})
	}


	getMachineSubmissions() {
		return this.SESSION.requestAsync("/home/machines/submissions").then(response => {
			var $ = require("jquery")(new JSDOM(response.body).window)
			var trs = Array.from($($(".table-responsive")[0]).find("table tr")).slice(1)
			var submissionItems = []
			if (trs.length) {
				trs.forEach((tr, idx) => {
					var submissionItem = {
						id: idx+3141592,
						name: (H.sAcc(tr,"cells",0,"textContent") || "[Unknown Name]").trim() || null,
						avatar: (H.sAcc(tr,"cells",0,"children",0,"attributes","data-cfsrc","value") || "").substring(25) || null,
						maker: {name: (H.sAcc(tr,"cells",1,"children",2,"textContent") || "").trim() || null,
							id: Number((H.sAcc(tr,"cells",1,"children",2,"href") || "").substring(45)) || null,
							avatar: (H.sAcc(tr,"cells",1,"children",0,"attributes","data-cfsrc","value") || "").substring(25) || null
						},
						os: (H.sAcc(tr,"cells",2,"textContent") || "").trim() || null,
						difficultyText: (H.sAcc(tr,"cells",3,"textContent") || "").trim(),
						tester: {name: (H.sAcc(tr,"cells",4,"children",2,"textContent") || "").trim() || null,
							id: Number((H.sAcc(tr,"cells",4,"children",2,"href") || "").substring(45)) || null,
							avatar: (H.sAcc(tr,"cells",4,"children",0,"attributes","data-cfsrc","value") || "").substring(25) || null
						},
						status: (H.sAcc(tr,"cells",5,"textContent") || "").trim() || null,
						submission: true
					}
					submissionItems.push(Object.assign(new HtbMachine(), submissionItem))
				})
			}
			return submissionItems
		})	
	}

	async getUnreleasedMachine() {
		return new Promise(async resolve => {
			//for (var i = 0; i < members.length; i++) {
			response = await this.SESSION.requestAsync("/home/machines/unreleased")
			var $ = require("jquery")(new JSDOM(response.body).window)
			if ($("tbody")[0].childElementCount > 0) {
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
					console.log("No 2nd maker ...")
				}
				var response = await this.SESSION.requestAsync("/home/machines/profile/" + urmid)
				$ = require("jquery")(new JSDOM(response.body).window)
				var ip = $("td")[9].innerHTML
				var points = Number($("td span")[1].innerHTML)
				var difficulty = $("td span")[0].innerHTML
				var os = $("td")[1].innerHTML.substring($("td")[1].innerHTML.lastIndexOf(">") + 1).replace(" ", "")
				var unreleasedBox = new LegacyHtbMachine(name,
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
				resolve(unreleasedBox)
			} else {
				resolve(null)
			}
		})
	}

	async getSpecials(){
		try {
			var specialChallengeBuffer = {}
			var specialTypes = ["Endgame", "Fortress", "Pro Labs"]
			var specials = {}
			var homepage = await this.SESSION.requestAsync("/home")
			var $ = require("jquery")(new JSDOM(homepage.body).window)
			specialTypes.forEach(type => { specials[[type]] = []; $("a:contains('" + type + "')").next().find("a").each(function () { specials[[type]].push(this.href.substring(25)) }) })
			var keys = Object.keys(specials)
			console.log(keys, specials)
			for (let specialKey of keys) {
				console.log("Fetching specials:", specialKey)
				var specialLinks = specials[specialKey]
				var thisSpecialCategoryChallenges = []
				for (let i = 0; i < specialLinks.length; i++) {
					var specialLink = specialLinks[i]
					var response = await this.getSpecialCategory(specialLink, this.SESSION)
					try {
						$ = require("jquery")(new JSDOM(response.body).window)
						var specialChallenge = {}
						specialChallenge["id"] = `${specialLink}`
						specialChallenge["name"] = $(".luna-nav").find("li.active").find("span").remove().end().text().trim().trimEnd()
						switch (specialKey) {
						case "Pro Labs": specialChallenge["type"] = "prolab"; break
						default: specialChallenge["type"] = specialKey.toLowerCase(); break
						}
						specialChallenge["flags"] = Object.fromEntries($("i[id^=\"flagIcon\"]").map((idx, ele) => ([[idx + 1, ele.nextSibling.nextSibling.textContent]])).get())
						specialChallenge["makers"] = $("#descriptionTab, .header-title").find("a[href*='/home/users/profile/']").map((idx, ele) => { return { username: ele.textContent, id: Number(ele.href.substring(ele.href.indexOf("users/profile/")+14)) } }).get()
						if (specialKey != "Fortress"){specialChallenge["description"] = $("#descriptionTab").find(".panel-body").find("p, li").map((idx, ele) => {
							if (ele.textContent && !$(ele).children("code, a, strong").length) { return ($(ele).is("li") ? ` • ${ele.textContent}` : ele.textContent + "\n") }
						}).get().join("\n").replace(/\n\s*\n/g, "\n\n").trim()}
						specialChallenge["description"] = $("#descriptionTab").find(".panel-body").find("p, li").map((idx, ele) => {
							if (ele.textContent && !$(ele).children("code, a").length) { return ($(ele).is("li") ? ` • ${ele.textContent}` : ele.textContent + "\n") }
						}).get().join("\n").replace(/\n\s*\n/g, "\n\n").trim()
						if (specialKey == "Endgame") {
							specialChallenge["makers"] = []
							specialChallenge["entries"] = $("#descriptionTab").find("code").map((idx, ele) => ele.textContent).get()
						}
						if (specialKey == "Fortress"){
							specialChallenge["company"] = $(".col-lg-6").find($("span.c-white"))[0].textContent.trim()
							specialChallenge["entries"] = $(".fab.fa-fort-awesome").parent().parent().find("code").map((idx, ele) => ele.textContent).get()
						}

						if (specialChallenge["name" == "Dante"]){specialChallenge["entries"] = ["10.10.110.0/24"]}
						specialChallenge["retired"] = $(".fa-file-pdf").length > 0
						// console.log(specialChallenge)
						thisSpecialCategoryChallenges.push(specialChallenge)
					} catch (error) {
						console.error(error)
					}
				}
				specialChallengeBuffer[specialKey] = thisSpecialCategoryChallenges
			}
			return specialChallengeBuffer
		} catch (error) {
			console.warn(error)
		}

	}
	
	// async getChallenges(session) {
	// 	console.log("Getting challenges...")
	// 	var challengeBuffer = {}
	// 	var specialChallengeBuffer = {}
	// 	var categories = ["Reversing", "Crypto", "Stego", "Pwn", "Web", "Misc", "Forensics", "Mobile", "OSINT", "Hardware"]
	// 	var specialTypes = ["Endgame", "Fortress", "Pro Labs"]
	// 	var specials = {}
	// 	var homepage = await session.requestAsync("/home")
	// 	var $ = require("jquery")(new JSDOM(homepage.body).window)
	// 	specialTypes.forEach(type => { specials[[type]] = []; $("a:contains('" + type + "')").next().find("a").each(function () { specials[[type]].push(this.href.substring(25)) }) })
	// 	return new Promise(async resolve => {
	// 		var keys = Object.keys(specials)
	// 		for await (let specialKey of keys) {
	// 			var specialLinks = specials[specialKey]
	// 			var thisCategoryChallenges = []
	// 			var thisSpecialCategoryChallenges = []
	// 			for (let i = 0; i < specialLinks.length; i++) {
	// 				var specialLink = specialLinks[i]
	// 				var response = await this.getSpecialCategory(specialLink, session)
	// 				try {
	// 					var $ = require("jquery")(new JSDOM(response.body).window)
	// 					var specialChallenge = {}
	// 					specialChallenge["name"] = $(".luna-nav").find("li.active").find("span").remove().end().text().trim().trimEnd()
	// 					specialChallenge["id"] = i + 1
	// 					specialChallenge["category"] = specialKey
	// 					specialChallenge["flags"] = Object.fromEntries($("i[id^=\"flagIcon\"]").map((idx, ele) => ([[idx + 1, ele.nextSibling.nextSibling.textContent]])).get())
	// 					specialChallenge["description"] = $("#descriptionTab").find(".panel-body").find("p, li").map((idx, ele) => {
	// 						if (ele.textContent && $(ele).children().length == 0) { return ($(ele).is("li") ? ele.textContent : ele.textContent + "\n") }
	// 					}).get().join("\n").trim()
	// 					if (specialKey == "Endgame") {specialChallenge["entries"] = $("#descriptionTab").find("code").map((idx, ele) => ele.textContent).get()}
	// 					if (specialKey == "Fortress"){specialChallenge["entries"] = $(".fab.fa-fort-awesome").parent().parent().find("code").map((idx, ele) => ele.textContent).get()}
	// 					specialChallenge["makers"] = $("#descriptionTab, .header-title").find("a[href*='/home/users/profile/']").map((idx, ele) => { return { username: ele.textContent, id: Number(ele.href.substring(20)) } })[0]
	// 					specialChallenge["retired"] = $(".fa-file-pdf").length > 0
	// 					// console.log(specialChallenge)
	// 					thisSpecialCategoryChallenges.push(specialChallenge)
	// 				} catch (error) {
	// 					console.error(error)
	// 				}
	// 			}
	// 			specialChallengeBuffer[specialKey] = thisSpecialCategoryChallenges
	// 		}
	
	//    // console.log("| SPECIAL CHALLENGES [ENDGAME, PROLAB, FORTRESS] |\n", specialChallengeBuffer)
	
	// 		for await (let category of categories) {
	// 			response = await this.getChallengesCategory(category, session)
	// 			thisCategoryChallenges = []
	// 			$ = require("jquery")(new JSDOM(response.body).window)
	
	// 			$(".panel-heading").each(() => {
	// 				var description = this.nextSibling.nextSibling.firstChild.nextSibling.nextSibling.nextSibling.nextSibling.data.trim()
	// 				var points = 0
	// 				var isActive = false
	// 				//console.log(description)
	// 				var dateString = $($(this).children(".panel-tools")[0]).text().trim()
	// 				var releaseDate = new Date(F.parseDate(dateString, "dd/MM/yyyy", new Date(0)).setUTCHours(19)).getTime()
	// 				var spans = $(this).children("span")
	// 				var activeChecker = $(spans[0]).text().trim()
	// 				//console.log(activeChecker.trim())
	// 				if (activeChecker.trim().startsWith("[")) {
	// 					isActive = true
	// 					//console.log(spans.html())
	// 					points = Number($(spans[0]).html().match(/[\d]*(\d+)/g)[0])
	
	// 				} else {
	// 					// console.log("Not Active.")
	// 					// console.log(spans[0].innerText)
	// 				}
	// 				var makers = $(this).find("a[href^='https://www.hackthebox.eu/home/users/profile/']")
	// 				var maker = { "id": makers[0].href.substring(45), "name": makers[0].innerHTML }
	// 				var maker2 = null
	// 				try {
	// 					maker2 = { "id": makers[1].href.substring(45), "name": makers[1].innerHTML }
	// 				} catch (error) {
	// 					//console.log('\nNo 2nd maker ...')
	// 				}
	// 				var tex = $(this).text()
	// 				//console.log("TEX",tex)
	// 				var name = tex.substring(tex.indexOf((isActive ? "] " : "     ")) + 1, tex.indexOf("[by") - 1).trim()
	// 				var solverCount = Number($(spans[1]).text().match(/[\d]*(\d+)/g))
	// 				var ratePro = Number($(spans[2]).text())
	// 				var rateSucks = Number($(spans[3]).text())
	// 				// console.log("GOT CHALLENGE. Datestring:", dateString, "|", "name:", name, "| maker:", maker.name, "| maker2:", (maker2 ? maker2.name : "None"), "| points:", points, "| active:", isActive, "| solvercount:", solverCount, "| ratings:", ratePro, rateSucks * -1)
	// 				// console.log("Got challenge", name + " ...")
	// 				var thisChallenge = new LegacyHtbChallenge(name, category, releaseDate, description, isActive, points, maker, maker2, solverCount, ratePro, rateSucks)
	// 				thisCategoryChallenges.push(thisChallenge)
	// 				if (!this.getChallengeByName(thisChallenge.name)) {
	// 					// dFlowEnt.updateEntity('challenge', thisChallenge.name)
	// 				}
	// 			})
	// 			console.log("Got", thisCategoryChallenges.length, "challenges in the '" + category + "' category")
	// 			challengeBuffer[category] = thisCategoryChallenges
	// 		}
	// 		console.log(challengeBuffer)
	// 		resolve(challengeBuffer)
	// 	})
	// }
	
	getTeamMemberIds(session, teamId, ignored) {
		return new Promise(resolve => {
			console.log(`Enumerating member ids for team #${teamId}...`)
			session.request(`/home/teams/profile/${Number(teamId)}`, function (error, response, body) {
				var teamIds = []
				var $ = require("jquery")(new JSDOM(body).window)
				//console.log("Team page body length:" + body)
				// Parse Team Stats
				// console.log($("#membersTable").children()[0])
				console.log("Getting team members...")
				// Parse Team Members
				try {
					$($("#membersTable").children()[1]).children().each(function() {
						var stats = $(this).children()
						var userCol = $(stats[1]).children()[0]
						var uid = Number(userCol.href.substring(45))
						if (!ignored || !(uid in Object.keys(ignored))) {
							teamIds.push(uid)
						}
					})
				} catch (error) {
					console.error(error)
				}
				resolve(teamIds)
			})
		})
	}

	getUniversityProfile(session, universityId){
		return new Promise(resolve => {
			console.log(`Getting university profile for uni #${universityId}...`)
			session.request(`/home/universities/profile/${Number(universityId)}`, function (error, response, body) {
				var $ = require("jquery")(new JSDOM(body).window)
				var teamInfo = {}
				try {
					var unis = $(".col-lg-6")[0].children[0].children[2].children
					if (unis.length > 5) {
						teamInfo.name = unis[0].textContent || null
						teamInfo.country_name = unis[1].textContent.trim() || null 
						teamInfo.country_code = unis[1].firstChild.classList[1].slice(5).toUpperCase() || null
						teamInfo.url = unis[3].firstChild.href || null
						teamInfo.joined_time_ago = unis[5].textContent.split(" ").slice(1,3).join(" ") || null
						teamInfo.student_count = Number(unis[7].textContent.trim().split(" ")[0]) || null
						teamInfo.respects = Number(unis[8].textContent.trim().split(" ")[0]) || null
					}
				} catch (error) {
					console.error(error)
				}
				resolve(teamInfo)
			})
		})
	}
	

	getUniversityMemberIds(session, universityId, ignored) {
		return new Promise(resolve => {
			console.log(`Enumerating HTB IDs for students of University #${universityId}...`)
			session.request(`/home/universities/profile/${Number(universityId)}`, function (error, response, body) {
				var universityIds = []
				var $ = require("jquery")(new JSDOM(body).window)
				var adminId = Number(Array.from($($(".fa-male")[0].parentNode.parentNode.children[1].childNodes[1].children[1]).find("tr"))[0].childNodes[1].children[2].toString().substring(45))
				try {
					Array.from($($(".fa-graduation-cap")[0].parentNode.parentNode.children[1].childNodes[1].children[1]).find("tr")).map(e => Number(e.childNodes[1].children[2].toString().substring(45))).forEach(uid => {
						if (!ignored || !(uid in Object.keys(ignored))) {
							universityIds.push(uid)
						}
					})
				} catch (error) {
					console.error(error)
				}
				const index = universityIds.indexOf(adminId)
				if (index > -1) {
					universityIds.splice(index, 1)
				}
				universityIds = [adminId, ...universityIds]
				resolve(universityIds)
			})
		})
	}
	
	getTeamStats(session, teamId) {
		return new Promise(resolve => {
			console.log("Getting team stats...")
			session.request(`/home/teams/profile/${teamId}`, (error, response, body) => {
				var teamStats = {}
				var $ = require("jquery")(new JSDOM(body).window)
				// console.log(body)
				// Parse Team Stats
				try {
					var teamName = $(".row-selected").children()[1].innerHTML
					var thumb = $($(".header-icon").find(".image-lg")[0]).attr("data-cfsrc")
					var countryCode = $(".header-title").find("span")[4].firstChild.classList[1].replace(/^[^-]*-/,"").toUpperCase()
					var countryName = $(".header-title").find("span")[4].attributes["title"].value
					var globalRanking = Number($(".row-selected").children()[0].innerHTML)
					var totalPoints = Number($(".row-selected").children()[2].innerHTML)
					var totalRoots = Number($(".row-selected").children()[3].innerHTML)
					var totalUsers = Number($(".row-selected").children()[4].innerHTML)
					var respects = Number($(".header-title").find("span")[3].textContent.trim())
					teamStats.v4Info = {}
					teamStats.id = teamId
					teamStats.name = teamName
					teamStats.teamFounder = process.env.FOUNDER_HTB_ID
					teamStats.countryCode = countryCode
					teamStats.countryName = countryName
					teamStats.respects = respects
					teamStats.thumb = thumb
					teamStats.globalRanking = globalRanking
					teamStats.points = totalPoints
					teamStats.owns = { roots: totalRoots, users: totalUsers }
					console.log("Team Stats Updated:", teamStats)
				} catch (error) {
					console.error(error, "ERROR: Could not parse team stats. Failing gracefully...")
				}
				resolve(teamStats)
			})
		})
	}

	
	
	getTeamData(session, id) {
		return new Promise(resolve => {
			console.log("Getting team details...")
			session.request(`/home/teams/profile/${id}`, (error, response, body) => {
				var teamUsers = {}
				var $ = require("jquery")(new JSDOM(body).window)
				//console.log("Team page body length:" + body)
				// Parse Team Stats
				try {
					var TEAM_STATS = {}
					var teamName = $(".row-selected").children()[1].innerHTML
					var thumb = $($(".header-icon").find(".image-lg")[0]).attr("data-cfsrc")
					var globalRanking = Number($(".row-selected").children()[0].innerHTML)
					var totalPoints = Number($(".row-selected").children()[2].innerHTML)
					var totalRoots = Number($(".row-selected").children()[3].innerHTML)
					var totalUsers = Number($(".row-selected").children()[4].innerHTML)
					var respects = Number($(".header-title").find("span")[3].textContent.trim())
					TEAM_STATS.id = id
					TEAM_STATS.name = teamName
					TEAM_STATS.thumb = thumb // Not working. Needs fixing
					TEAM_STATS.globalRanking = globalRanking
					TEAM_STATS.points = totalPoints
					TEAM_STATS.respects = respects
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
	
					var jq = $($("#membersTable").children()[1]).children().each(() => {
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
						var user = new LegacyTeamMember(uName, uid, { "user": Number(stats[4].innerHTML), "root": Number(stats[3].innerHTML) }, siterank, userpoints)
						teamUsers[uid] = user
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
	
	getSession() {
		var promise = csrfLogin({
			username: process.env.HTB_EMAIL,
			password: process.env.HTB_PASS
		})
		return promise
	}

	updateCsrf(){
		this.CSRF_TOKEN = this.grabCsrfFromJar(this.SESSION)
	}
	grabCsrfFromJar(session) {
		try {
			return session.jar._jar.store.idx["www.hackthebox.eu"]["/"]["csrftoken"].value
		} catch (error) {
			console.error(error)
			return ""
		}
	}

	getUserProfile(id, session) {
		//console.log('getting user profile #' + id)
		return session.requestAsync("/home/users/profile/" + id)
	}
	
	getChallengesCategory(category, session) {
		//console.log('getting user profile #' + id)
		return session.requestAsync("/home/challenges/" + category)
	}
	
	getSpecialCategory(type, session) {
		//console.log('getting user profile #' + id)
		return session.requestAsync(type)
	}
	
	async getOwnageData(session, mbrs) {
		var members = Object.keys(mbrs)
		console.log("Collecting ownage data for " + members.length + " team members...")
		return new Promise(async resolve => {
			for (var i = 0; i < members.length; i++) {
				//for (var i = 0; i < 5; i++) {
				//console.log("#" + i.toString().padStart(2, '0') + ": Parsing owns for member " + members[i])
				var response = await this.getUserProfile(members[i], session)
				await this.parseUserOwns(response.body, members[i])
			}
			console.log("FINISHED PARSING OWNS...")
			resolve()
		})
	}

	
	async parseUserOwns(body, id) {
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
					// TEAM_MEMBERS[id].thumb = thumb
					// TEAM_MEMBERS[id].countryName = countryName
					// TEAM_MEMBERS[id].countryCode = countryCode
					// TEAM_MEMBERS[id].rank = rank
					// TEAM_MEMBERS[id].joinDate = joinDate
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
						// TEAM_MEMBERS[id].stats = chart
					} else {
						// TEAM_MEMBERS[id].stats = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
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

}

module.exports = {
	HtbLegacyConnector
}