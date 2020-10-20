/** @module HtbEmbeds */

const { Format: F } = require("../helpers/format.js")
const { MessageEmbed, Message, MessageAttachment: Attachment } = require("discord.js")
const { SevenDatastore } = require("../models/SevenDatastore.js")
const { Helpers: H } = require("../helpers/helpers.js")

const DFLT = null

class HtbEmbeds {
	/**
	 * 
	 * @param {SevenDatastore} sevenDatastore 
	 */
	constructor(sevenDatastore, emojiFactory) {
		this.ds = sevenDatastore
		this.E = emojiFactory
	}
	get MEMBER_INFO_BASE() { return new MessageEmbed().setColor(F.COL.HTB_GREEN) }
	get MEMBER_RANK_BASE() { return new MessageEmbed().setColor(F.COL.NUGGET_YELLOW) }
	get TEAM_INFO_BASE() { return new MessageEmbed().setColor(F.COL.VIVID_PURPLE) }
	get TARGET_INFO_BASE() { return new MessageEmbed().setColor(F.COL.AQUAMARINE) }
	get ERROR_BASE() { return new MessageEmbed().setColor(F.COL.MALWARE_RED) }
	get CHART_BASE() { return new MessageEmbed().setColor(F.COL.AZURE) }
	get PUSHER_BASE() { return new MessageEmbed().setColor(F.COL.AQUAMARINE) }

	get MACHINE_TEMPLATE() {
		return {
			id: DFLT,
			os: DFLT,
			name: DFLT,
			avatar: DFLT,
			maker1: DFLT,
			maker2: DFLT,
			teamSolves: DFLT,
			userBlood: DFLT,
			rootBlood: DFLT,
			IP: DFLT,
			difficulty: DFLT,
			points: DFLT,
			status: DFLT,
			releaseDate: DFLT,
			rating: DFLT,
			age: DFLT,
			tags: DFLT
		}
	}

	get ENTITY_UNFOUND() {
		return this.ERROR_BASE.setTitle(`Unrecognized Entity. ${H.any("👀", "🚀", "🤷‍♀️", "🤦‍♂️", "🐱‍🐉", "🐱‍💻")}`)
			.setDescription(`Maybe I haven't ${H.any("parsed it yet",
				"gotten that one yet",
				"updated recently enough to catch it",
				"read the news recently")}${H.any("?", ".")}${(H.maybe(0.2) ? " " + H.any("🌧", "☔", "🎉", "🤔") : "")}`)
	}

	/* INFOBOXES */

	targetInfo(type, identifier, isId = false, discordMessage = null, target=null) {
		target = target || this.ds.resolveEnt(identifier, type, isId, discordMessage) || { type: null }
		if (target.country_name) { // A living, breathing human being
			target.type = "member"
		}
		console.log(target)
		var embed = this.TARGET_INFO_BASE
		switch (target.type) {
		case "machine": {
			/** MACHINE EMBED CONSTRUCTOR **/
			const { id, os, name, ip = "10.10.10.[?]", avatar, maker, maker2, userBlood, rootBlood,
				difficultyText: difficulty, points, retired, retiredate, release, stars, user_owns_count: users,
				root_owns_count: roots } = target
			embed.attachFiles(new Attachment(`./static/img/${F.osNameToIconFile(os)}`, "os.png"))
				.setAuthor(name, "attachment://os.png", F.machineProfileUrl(target))
				.setDescription(
					(os == "Other" ? "A kind of weird" : `${F.aOrAn(os)} ${os}`) + ` box by **${F.memberToMdLink(maker)}` +
						`${(maker2 ? "** & **" + F.memberToMdLink(maker2) : "")}**.` +
						`\nIP Address: **[${ip || "Unknown"}](http://${ip || "Unknown"}/)**`)
				.setThumbnail(F.avatar2Url(avatar))
				.addField("`  " + `${F.difficultySymbol(difficulty)} ${F.STL(difficulty + " [+" + points + "pt]", "bs")}` + "  `",
					"```diff\n" +
						`${(retired ? "-  " : "   ") + "Status   :"} ${(retired ? "🧟 Retired" : (H.isPastDate(release) ? "👾 Active" : "🔥 𝗨𝗡𝗥𝗘𝗟𝗘𝗔𝗦𝗘𝗗"))}\n`
						+ `+  Rating   : ${F.ratingString(stars)}\n`
						+ (roots + users > 0 ? "+  Owns     : " : "")
						+ (users ? "💻 " + users : "") + (users && roots ? " " : "")
						+ (roots ? "👩‍💻 " + roots : "") + (roots + users > 0 ? "\n" : "")
						+ (roots + users > 0 ? "-  Bloods   : " : `-  Bloods   : ${F.STL("None taken!", "bs")}`)
						+ (userBlood ? "🔹 " + userBlood.user.name : (roots + users > 0 ? "(No [U] blood!)" : "")) + " "
						+ (rootBlood ? "🔸 " + rootBlood.user.name : (roots + users > 0 ? "(No [R] blood!)" : "")) + "\n"
						+ `+  ${(H.isPastDate(release) ? "Released" : "Release ")} : ${new Date(release).getUTCFullYear()} (${F.fuzzyAge(new Date(release))})\n`
						+ (retired ? `-  Retired  : ${F.timeSince(new Date(retiredate))}\n` : "")
						+ "```",
					false)
				.setFooter(`ℹ️  Machines last updated ${F.timeSince(this.ds.LAST_UPDATE)}`)
			if ("tags" in target) {
				console.info(this.ds.MISC.MACHINE_TAGS, target.tags)
				var tagDict = {}
				target.tags.map(tag => {
					// console.info(tag)
					const category = Object.values(this.ds.MISC.MACHINE_TAGS).find(e => e.id == tag.tag_category_id)
					// console.info(category)
					const subtype = (category ? category.tags.find(e => e.id == tag.id) || null : null)
					if (subtype && category) {
						if (!Array.isArray(tagDict[category.name])) {
							tagDict[category.name] = []
						}
						tagDict[category.name].push([subtype.name])
					}
				})
				// console.log(tagDict)
				Object.keys(tagDict).forEach(key => embed.addField(key, F.STL(tagDict[key].join("\n"), "spoiler_mono"), true))
			}
			break
		}
		case "member": {
			/** TEAM MEMBER EMBED CONSTRUCTOR **/
			const { id, name, rank, rank_text, points, ranking, rank_id, next_rank, respects, team, avatar, country_code: nat, country_name,
				endgames, fortresses, prolabs, bloods, user_owns: users, system_owns: roots, challenge_owns, current_rank_progress: rankProgress,
				user_bloods, system_bloods, description, university_name: uni, website, github, linkedin, twitter } = target
			const challs = challenge_owns.solved
			const challenge_bloods = bloods.challenges.length
			const hasOwns = (roots + users + challs > 0)
			const hasBloods = (bloods.challenges.length + bloods.machines.length > 0)
			const hasRespect = Boolean(respects)
			console.log(hasRespect, respects)
			embed.setAuthor(this.ds.tryDiscordifyUid(id, target.self) || target.name + "  " + F.rankSymbol(rank),
				(team ? F.avatar2Url(team.avatar) : ""),
				F.memberProfileUrl(target))
				.setDescription(F.getFlag(nat) + "⠀**[" + rank_text + ".]"
						+ `(${F.memberProfileUrl(target)}`
						+ ")**" + (team ? ` ${F.toTitleCase(target.role)} of the **[${team.name}](${F.teamProfileUrlFromId(team.id)} 'View on HTB')** team.\n` : "")
						+ (rank_id < 7 && H.maybe(0.1) ? `(${name} often dreams about achieving the rank of ${next_rank}, but so far the goal has proved elusive.)` : "")
						+ (description ? `\`\`\`fix\n${F.safe(description.trim().slice(0, 200))}\n\`\`\`` : "")
						+ (uni ? "**" + F.safe(uni) + "**\n" : ""))
				.setThumbnail(F.avatar2Url(avatar))
				.addField("`  " + `( 🌍 ${F.STL(F.nth(ranking), "bs")} | 👥 ${F.STL(F.nth(this.ds.getMemberTeamRankById(id)), "bs")} ) 🍕 [+${F.STL(points.toString(), "bs")}]`
						+ "  `",
				"```diff\n"
						+ (hasRespect ? `  Locale   : ${F.STL(country_name,"bs")}\n` : "")
						+ (hasRespect ? `+ Respect  : ${F.numS(respects)}\n` : "")
						+ (hasOwns ? `× Owns     : ${this.ownString(users, roots, challs)}` : "")
						+ (hasBloods ? `- Bloods   : ${this.bloodString(user_bloods, system_bloods, challenge_bloods)}` : "")
						+ (rank_id < 7 ? `+ NextRank : ${F.STL(next_rank,"bs")}\n`
						+ (rankProgress > 0 ? `         ⤷ : ${F.progressBar(rankProgress, 8, true)}\n`:"") : "")
						+ "```",
				false)
				.setFooter(`ℹ️  Members last updated ${F.timeSince(this.ds.LAST_UPDATE)}`)
			const checkProgress = (progressArray) => progressArray.map(e => e.completion_percentage).reduce((prev, next) => prev + next)
			if (this.socialString(github, linkedin, twitter, website)) {
				embed.addField("Social", this.socialString(github, linkedin, twitter, website), false)
			}
			if (checkProgress(endgames)) {
				embed.addField("Endgame", "```md\n"
						+ endgames.map(e => ` [${F.STL(e.name, "s")}]( ${F.progressBar(e.completion_percentage, 8, false)} ) ${e.completion_percentage}%`).join("\n") + "\n```",
				false)
			}
			if (checkProgress(fortresses)) {
				embed.addField("Fortress", "```fix\n"
						+ fortresses.map(e => ` ${F.STL(e.name, "bs")} - ${F.progressBar(e.completion_percentage)}`).join("\n") + "\n```",
				false)
			}
			if (checkProgress(prolabs)) {
				embed.addField("Pro Lab", "```md\n"
						+ prolabs.map((e, idx) => `${(idx % 2 == 1 ? "#" : "-")} ${F.STL(e.name, "s")} - ${F.progressBar(e.completion_percentage)}`).join("\n") + "\n```",
				false)
			}
			break
		}
		case null: {
			embed = this.ENTITY_UNFOUND
		} break
		case "challenge": {
			/** CHALLENGE EMBED CONSTRUCTOR **/
			const { id, name, description, retired, difficulty, avg_difficulty, points, difficulty_chart, solves,
				likes, dislikes, release_date: release, category_name: cat, first_blood_user: fbu, first_blood_user_id: fbi,
				first_blood_time: fbt, creator_id: cid, creator_name: cname, creator_avatar: cimage } = target
			embed.attachFiles(new Attachment(`./static/img/${F.challengeCategoryNameToIconFile(cat)}`, "os.png"))
				.setAuthor(name, "attachment://os.png", F.challengeProfileUrl(target))
				.setDescription(
					`${F.aOrAn(cat)} ${cat} challenge by **${F.memberToMdLink({id:cid,name:cname})}**.` +
						`\n> ${description}`)
				.setThumbnail(F.avatar2Url(cimage))
				.addField("`  " + `${F.difficultySymbol(difficulty)} ${F.STL(difficulty + " [+" + points + "pt]", "bs")}` + "  `",
					"```diff\n" +
						`${(retired ? "- " : "  ") + "Status   :"} ${(retired ? "🧟 Retired" : (H.isPastDate(release) ? "👾 Active" : "🔥 𝗨𝗡𝗥𝗘𝗟𝗘𝗔𝗦𝗘𝗗"))}\n`
						+ `+ Rating   : ${F.ratingString(5 * (likes / (likes + dislikes)))}\n`
						+ (difficulty ? `+ Level    : ${F.STL(difficulty,"bs")} (${avg_difficulty} / 100)\n` : "")
						+ (solves ? `+ Solves   : ${F.STL(solves,"bs")} [G]\n` : "")
						+ (fbu ? "- Blood    : " : `-  Blood    : ${F.STL("None taken!", "bs")}`)
						+ `${(fbu ? "🩸 " + fbu : "")} (${fbt})` + "\n"
						+ `+ ${(H.isPastDate(release) ? "Released" : "Release ")} : ${new Date(release).getUTCFullYear()} (${F.fuzzyAge(new Date(release))})\n`
						+ (retired ? "- Retired  : True" : "")
						+ "```",
					false)
				.setFooter(`ℹ️  Challenges last updated ${F.timeSince(this.ds.LAST_UPDATE)}`)
			break
		}
		default: break
		}
		console.info(embed)
		return embed
	}

	teamInfo() {
		/** TEAM SUMMARY EMBED CONSTRUCTOR **/
		const { id: tid, twitter,facebook,discord, motto, description, name:tname, country_code:cc, country_name:cn, rank, points, respects, captain, user_owns, system_owns, first_bloods, avatar_url: tavatar} = this.ds.TEAM_STATS
		var leaderList = this.ds.getMdLinksForUids(this.ds.getTopMembers(15), "points")
		var founder = this.ds.getMemberById(captain.id)
		var TEAM_EMBED = this.TEAM_INFO_BASE
			.setAuthor(`Group by ${founder.name}`, F.avatar2Url(founder.avatar), F.memberProfileUrl(founder))
			.setTitle(`${F.getFlag(cc)}  ${tname}`)
			.setThumbnail(tavatar)
			.setDescription(`Team from ${F.STL(cn,"bs")}.\n\`\`\`fix\n${motto}\n\`\`\`` + (respects ? `\n⭐ The members of ${tname} have earned the ${H.any("deepest","profoundest","fullest","heartiest","most hearty of","dedicated", "sincere")} respect of ${F.STL(respects,"bs")} HTB users for their ${H.any("baudy","insane","ridiculously clever", "unbelievably dextrous", "haphazard string of", "mind-blowing")} accomplishments.`: ""))
		if (this.teamSocialString(twitter,facebook,discord)) {
			TEAM_EMBED.addField("Social", this.teamSocialString(twitter,facebook,discord), false)
		}
		TEAM_EMBED.addField("Ranking","Global: **[#" + rank + "](http://0)**", true)
			.addField("Points","**[" + points + "](http://0)**", true)
			.addField("0wnage",`Roots:** [${system_owns}](http://0)\n**Users:** [${user_owns}](http://0)**`, true)
			.addField("MVP List",`**${leaderList.slice(0, 5).join("**\n**")}**`, true)
			.addField("…",`**${leaderList.slice(5, 10).join("**\n**")}**`, true)
			.addField("…",`**${leaderList.slice(10, 15).join("**\n**")}**`, true)
			.setImage(F.noncifyUrl(`https://www.hackthebox.eu/badge/team/image/${tid}`))
			.setFooter("ℹ️  Team info last updated " + F.timeSince(this.ds.LAST_UPDATE))
		return TEAM_EMBED
	}

	teamRank() {
		return this.TEAM_INFO_BASE
			.attachFiles(new Attachment("./static/img/ui/rank.png", "rank.png"))
			.setAuthor(this.ds.TEAM_STATS.name, "attachment://rank.png", F.teamProfileUrl(this.ds.TEAM_STATS))
			.setThumbnail(this.ds.TEAM_STATS.avatar_url)
			.setDescription(`Global Rank: ${F.mdLink(this.ds.TEAM_STATS.globalRanking, F.teamProfileUrl(this.ds.TEAM_STATS))}`)
			.setFooter(`ℹ️  Rank data last updated ${F.timeSince(this.ds.LAST_UPDATE)}`)
	}

	teamLeaderboard() {
		var leaderLinkArray = F.mdItemizeList((this.ds.getMdLinksForUids(this.ds.getTopMembers(60), false, "points")))
		var embed = this.TEAM_INFO_BASE
			.attachFiles(new Attachment("./static/img/ui/rank.png", "rank.png"))
			.setAuthor(this.ds.TEAM_STATS.name, "attachment://rank.png", F.teamProfileUrl(this.ds.TEAM_STATS))
			.setTitle("Leaderboard")
			.setThumbnail(F.avatarFullUrl(this.ds.getMemberById(this.ds.getTopMembers(1))))
			.setFooter("ℹ️  Hover over a name to see individual points [Desktop]")
		var chunkedFields = H.chunk(leaderLinkArray, 10)
		// console.log(chunkedFields)
		chunkedFields.forEach(field => embed.addField("…", field, true))
		return embed
	}

	teamLeader(member) {
		
		if (member) {

			return this.MEMBER_RANK_BASE.setTitle(this.ds.tryDiscordifyUid(member.id))
				.setAuthor(H.any("💯", "🏆", "🎖️", "🔮", "💠", "💎", "👑") + " Team Leader", F.memberTeamAvatarUrl(member), "")
				.setThumbnail(F.avatarFullUrl(member))
				.setDescription(`Global Rank: ${F.memberToMdLink(member, true, member.ranking)}\nTeam Rank:  ${F.memberToMdLink(member, true, "1")}`)
				.setFooter(`ℹ️  Rank data last updated ${F.timeSince(this.ds.LAST_UPDATE)}`)
		} else {
			return this.ENTITY_UNFOUND
		}
	}

	teamFlagboard(){
		// var flags = []
		var flags = this.ds.vTM.map(member => F.getFlag(member.country_code))
		
		var flagsSorted = flags.slice().sort()

		console.log(flags,flagsSorted)
		var flagString = ""
		var sortedFlagString = ""
		// flags = []
		// TEAM_STATS.topMembers.forEach(memberId => {
		//   member = TEAM_MEMBERS[memberId]
		//   var flagLink = "["+getFlag(member.countryCode)+"](http://" + member.id + ")"
		//   flags.push(flagLink)
		// });
		// flags.join("")
		
		var spliced = H.sp(9, flags)
		spliced.forEach(flagRow => {
			flagString += "\n" + flagRow.join(" ")
		})
		
		var sortSpliced = H.sp(9, flagsSorted)
		sortSpliced.forEach(flagRow => {
			sortedFlagString += "\n" + flagRow.join(" ")
		})
		console.log(spliced, sortSpliced)

		return this.TEAM_INFO_BASE.attachFiles(new Attachment("./static/img/ui/rank.png", "rank.png"))
			.setAuthor(H.any("🗺️", "🌎", "🌏", "🌍", "🌐", "🚩", "⛳", "🛂", "🛫", "✈️", "🛩️") + " Team Locales", "attachment://rank.png", F.teamProfileUrl(this.ds.TEAM_STATS))
			.setThumbnail(this.ds.TEAM_STATS.avatar_url)
			.setColor(F.COL.VIVID_PURPLE)
			.setFooter("ℹ️  How cool is this feature?!")
			.setDescription(H.any(sortedFlagString, flagString))
		
	}

	achievementInfo() {

	}

	/* OWNAGE CHECKS */

	teamOwnsForTarget(target=null, limit=25, ownType=null, ownFilter=null){

		if (target) {
			var embeds = []
			var embed0 = this.MEMBER_INFO_BASE
				.setDescription("Member owns for the " + F.mdLink(target.name,F.profileUrl(target))+" "+ target.type +" (sorted by most recent first):")
				.setAuthor("Team owns", "attachment://icon.png", F.teamProfileUrl(this.ds.TEAM_STATS))
				.setThumbnail(F.avatar2Url(target.avatar))
				.setFooter("ℹ️  Hover over a name to see age of own [Desktop]")
			var owns
			var filteredOwns = this.ds.getTeamOwnsForTarget(target) || []
			if (target.type == "machine"){
				var {user, root, both} = H.deduplicateMachineOwns(filteredOwns)
				switch (ownType) {
				case "user": root = []; break
				case "root": user = []; break
				default: break
				}
				console.log(user,root,both)
				new Array(user, root, both).forEach(arr => arr.sort((a,b)=> H.sortByZuluDatestring(a,b,"date",false)))
				owns = [...both, ...user, ...root]
			} else {
				owns = filteredOwns
			}
			
			switch (ownFilter) {
			case "last": owns = [owns.shift()]
				if (owns[0]) {
					embed0.setDescription(`${F.mdLink(target.name, F.profileUrl(target))} was owned most recently by ${F.memberToMdLink(this.ds.getMemberById(owns[0].uid))}. *[${F.timeSince(new Date(owns[0].date))}]*`)
						.setThumbnail(F.avatar2Url(this.ds.getMemberById(owns[0].uid).avatar))
						.setAuthor("Last Owned", F.avatar2Url(target.avatar), F.teamProfileUrl(this.ds.TEAM_STATS))
					return embed0
				}
				break
			case "first": owns = [owns.pop()] 
				if (owns[0]) {
					embed0.setDescription(`${F.mdLink(target.name, F.profileUrl(target))} was owned first by ${F.memberToMdLink(this.ds.getMemberById(owns[0].uid))}. *[${F.timeSince(new Date(owns[0].date))}]*`)
						.setThumbnail(F.avatar2Url(this.ds.getMemberById(owns[0].uid).avatar))
						.setAuthor("First Owned", F.avatar2Url(target.avatar), F.teamProfileUrl(this.ds.TEAM_STATS))
					return embed0
				}
				break
			default: break
			}
			
			var chunkedOwns

			if (owns.length){
				chunkedOwns = this.embedSubdivide(owns, this.ownerString, 800, 5500, 15, "type", true)
				console.log(chunkedOwns)
				chunkedOwns.forEach((embeddableGroup, ix) => {
					if (embeddableGroup.length > 0  && embeddableGroup[0].length > 0) {
						embeds.push((ix == 0 ? embed0 : this.MEMBER_INFO_BASE)
							.attachFiles(new Attachment(F.getIcon("rank"), "rank.png"))
							.setAuthor("Team Owns", "attachment://rank.png", F.teamProfileUrl(this.ds.TEAM_STATS))
							.addFields(embeddableGroup.map((e,idx) => ({inline:true, name:`${this.E.of((["root","user"].includes(e[0].label) ? e[0].label : "complete" ))} ${(target.type == "machine" ? (["root","user"].includes(e[0].label) ? ":regional_indicator_" + e[0].label[0] + ":" : "☑" ):"")} ${idx+1}/${embeddableGroup.length}`,value:`${e.map(x => x.str).join("\n")}`}))))
					}
				})
			}
			console.log(embeds)
			// embeds = []

			if (!(owns.length > 0)) {
				embed0.setDescription("Looks like no one on the team has owned the " + F.mdLink(target.name,F.profileUrl(target))+" "+ target.type +" yet!")
				return embed0
			}
			return embeds
		} else {
			return this.ENTITY_UNFOUND
		}
	}

	filteredTargets(targets, sortend="release date", inf={}, message={}){
		// console.warn(targets)
		console.log(inf.targetFilterBasis, inf.targetFilterBasis.find(e => (e.cust || "").includes("complete")))
		var isIncomplete = inf.targetFilterBasis.some(e => (e.cust || "").includes("incomplete"))
		var filterRuleDescription = inf.targetFilterBasis.filter(e => (e.cust && !["complete", "incomplete"].includes(e.cust) ) || e.ccat || e.bpath || e.bsub || e.blang).map(e => Object.values(e)[0]).join(", ")
		if (filterRuleDescription){
			filterRuleDescription = ` (${filterRuleDescription})`
		}
		var embeds = []
		var chunkedTargets = this.embedSubdivide(targets || [], this.filteredTargetString, 800, 5500, 15) || []
		chunkedTargets.forEach(embeddableGroup => {
			if (embeddableGroup.length > 0  && embeddableGroup[0].length > 0) {
				embeds.push(this.TARGET_INFO_BASE
					.attachFiles(new Attachment(F.getIcon("complete"), "icon.png"))
					.setAuthor("Filtered Targets", "attachment://icon.png", F.teamProfileUrl(this.ds.TEAM_STATS))
					.setDescription(`📊 Showing ${targets.length}${filterRuleDescription} ${inf.targettype} target${(targets.length != 1 ? "s" : "")}`
					+ ((inf.memberName.length && inf.targetFilterBasis.some(e => (e.cust || "").includes("complete"))) ? ( isIncomplete ? " not yet owned by ": " completed by ")+ F.andifyList(inf.memberName.map(e => F.memberToMdLink(this.ds.resolveEnt(e,"member",false,message))),", ",isIncomplete) : "")
					+(sortend[0] ? `, sorted by ${inf.sortby[0]} ` : " "))
					.addFields(embeddableGroup.map((e,idx) => ({inline: true, name:`${idx+1}/${embeddableGroup.length}`,value:`${e.map(x => x.str).join("\n")}`}))))
			}
		})
		return embeds
	}

	checkMemberOwnedTarget(member, target) {
		if (member && target){
			var owns = this.ds.getMemberOwnsForTarget(member,target)
			console.log(owns)
			if (owns) {
				var confirm
				if (target.type == "machine") {
					confirm = (owns.some(m => m.type == "root") ? H.any("Yep! ", "Indeed, ", "Mhm, ", "W00t! ", "Affirmative - ", "Yup! ", "It looks like ", "Yes. ") : H.any("Partial ownage detected: ", "We're halfway there: ", ""))
					+ F.mdLink((member.self ? "You" : this.ds.tryDiscordifyUid(member.id)), F.profileUrl(member), true, "View on HTB")
					+ ` ${H.any("got","owned", "beat", "got")} ` + (owns.some(m => m.type == "user") ? "user" : "") + (owns.length > 1 ? " and root" : ((owns.some(m => m.type == "root") ? H.any("system","root") : ""))) + " on "
					+ F.mdLink(target.name,F.profileUrl(target),true, "View on HTB") + " "
					+ H.any("(although not without a serious fight)",
						`${H.any("after","following")} a legendary ${(Math.floor(Math.random() * 24)+24).toString()}-hour struggle`,
						"after a hair-pulling effort",
						`after a mere ${Math.floor(Math.random() * 60)} minutes of trial and error`,
						"after significant effort",
						"after a ton of hard work",
						"after gallons of coffee and more than one failed relationship", "", "")
					+ `. *[${F.timeSince(new Date(owns[owns.length-1].date))}]*.`
				} else {
					confirm =  (H.maybe(0.8) ? H.any("Yep! ", "Indeed, ", "Mhm, ", "W00t! ", "Affirmative - ", "Yup! ", "It looks like ") : "Yes. ")
						+ F.mdLink((member.self ? "You" : this.ds.tryDiscordifyUid(member.id)), F.profileUrl(member), true, "View on HTB") + " "
						+ H.any("owned","completed", "finished") + " " + F.mdLink(target.name,F.profileUrl(target),true, "View on HTB") + " "
						+ H.any("(although not without a monstrous fight)",
							`${H.any("after","following")} a legendary ${Math.floor(Math.random() * 24)+24}-hour struggle`,
							"after a hair-pulling effort",
							`after a mere ${Math.floor(Math.random() * 60)} minutes of trial and error`,
							"after significant effort",
							"after a ton of hard work",
							"after gallons of coffee and at least one wrecked relationship", "", "") + `. *[${F.timeSince(new Date(owns[owns.length-1].date))}]*.`
				}
				// Send embed "owns found"
				var embed = this.MEMBER_INFO_BASE
					.setAuthor("Ownage Check", F.avatar2Url(member.avatar), F.memberProfileUrl(member))
					.setThumbnail(F.avatar2Url(target.avatar))
					.setDescription(confirm)
				if (target.type == "challenge"){
					embed.attachFiles(new Attachment(`./static/img/${F.challengeCategoryNameToIconFile(target.category_name)}`, "cat.png"))
						.setThumbnail("attachment://cat.png")
				}
				return embed
			} else {
				var reject = H.any("NOP, ", "Nope, ", "No, ", "It seems like ")
				+ F.mdLink((member.self ? "you" : this.ds.tryDiscordifyUid(member.id)), F.profileUrl(member), true, "View on HTB")
				+ " didn't " + (target.type == "machine" ? `get user or ${H.any("root", "system")} yet on `: H.any("complete","manage to finish", "try", "own")) + " "
				+ F.mdLink(target.name,F.profileUrl(target),true, "View on HTB") + "." + (H.maybe(0.3) ? "\nThere's always tomorrow!" : "" )
				var embed2 = this.MEMBER_INFO_BASE
					.setColor(F.COL.NUGGET_YELLOW)
					.setAuthor("Ownage Check", F.avatar2Url(member.avatar), F.memberProfileUrl(member))
					.setThumbnail(F.avatar2Url(target.avatar))
					.setDescription(reject)
				if (target.type == "challenge"){
					embed2.attachFiles(new Attachment(`./static/img/${F.challengeCategoryNameToIconFile(target.category_name)}`, "cat.png"))
						.setThumbnail("attachment://cat.png")
				}
				return embed2
			}
		}
	}
	

	memberIncompleteTargets() {


	}

	memberCompletedTargets() {

	}

	memberActivity(member=null, limit=500, typeFilter=null, sortOrder, sortBy=null, imageData=null){
		if (member) {
			var embeds = []
			embeds.push(this.MEMBER_INFO_BASE.attachFiles(new Attachment(`./static/img/${F.challengeCategoryNameToIconFile("OSINT")}`, "icon.png"))
				.setTitle(this.ds.tryDiscordifyUid(member.id, member.self))
				.setDescription("*Filtered activity stream + graph for user " + F.memberToMdLink(member, true)+ "*.")
				.setAuthor("Member activity stream", "attachment://icon.png", F.teamProfileUrl(this.ds.TEAM_STATS))
				.setThumbnail(F.avatar2Url(member.avatar))
				.attachFiles([{ name: "chart.png", attachment: imageData }]).setImage("attachment://chart.png"))
			var filteredOwns = this.ds.filterMemberOwns(member.id, typeFilter, sortBy, sortOrder, limit)
			if (filteredOwns.length){
				var chunkedOwns = this.embedSubdivide(filteredOwns, this.achievementString, 800, 5500, 15)
				console.log(chunkedOwns)
				chunkedOwns.forEach(embeddableGroup => {
					if (embeddableGroup.length > 0) {
						embeds.push(this.MEMBER_INFO_BASE
							.addFields(embeddableGroup.map((e,idx) => ({name:(idx == 0 ? "`[...List Data...]`":"`━━━━━━━━ ◦ ❖ ◦ ━━━━━━━━`"),value:`\`\`\`css\n${e.map(x => x.str).join("\n")}\n\`\`\``}))))
					}
				})
			}
			return embeds
		} else {
			return this.ENTITY_UNFOUND
		}
	}

	/**
	 * Processes some array of objects into strings, outputting a 3d array with the structure:
	 * Array       = Embed[] - An array of embeds.
	 * Array[*]    = Field[] - An array of fields meant for one embed.
	 * Array[*][*] = Fieldstring[]- An array of strings meant for one field.
	 * @param {*} array - The array of objects to be consumed by processor.
	 * @param {*} processor - The function that consumes the object and outputs a string.
	 * @param {*} fieldCharLimit - The character limit per embed field.
	 * @param {*} embedCharLimit - The character limit for the entire embed.
	 * @param {*} padding - Padding / tolerance, per field. (Basically subtracts from the char limits)
	 */
	embedSubdivide(array, processor, fieldCharLimit, embedCharLimit, padding = 0, key=null, mixedMode = false){
		var sum = padding
		var lastKey
		if (array.length){
			lastKey = array[0][key]
		}
		var totSum = 0
		var index3d = 0
		var index2d = 0
		var outArrays = [[[]]]
		array.forEach(function (item, idx) {
			//console.log(this, item)
			var outString = processor.call(this, (item.params || item))
			//console.log(outString)
			if (totSum + outString.length + (padding * outArrays.length) > embedCharLimit) {
				index2d += 1
				index3d = 0
				totSum = outString.length
				sum = outString.length
				outArrays.push([])
				outArrays[index2d][index3d]=[]
				outArrays[index2d][index3d].push({idx:idx,str:outString,label:(key ? item[key] : null)})
			} else {
				if (sum + outString.length < fieldCharLimit && !(mixedMode? item[key] != lastKey : false )) {
					outArrays[index2d][index3d].push({idx:idx,str:outString,label:(key ? item[key] :  null)})
					sum += outString.length
					totSum += outString.length
				} else {
					index3d += 1
					outArrays[index2d][index3d]=[]
					sum = outString.length
					totSum += outString.length
					outArrays[index2d][index3d].push({idx:idx,str:outString,label:(key ? item[key] : null)})
				}
			}
			lastKey = item[key]
			
		}, this)
		return outArrays
	}

	memberRank(member) {
		console.log(member)
		if (member) {
			return this.MEMBER_RANK_BASE.setTitle(this.ds.tryDiscordifyUid(member.id, member.self))
				.setAuthor("Member Rank", F.memberTeamAvatarUrl(member), "")
				.setThumbnail(F.avatarFullUrl(member))
				.setDescription(`Global Rank: ${F.memberToMdLink(member, true, member.ranking)}\nTeam Rank:  ${F.memberToMdLink(member, true, this.ds.getMemberTeamRankById(member.id))}`)
				.setFooter(`ℹ️  Rank data last updated ${F.timeSince(this.ds.LAST_UPDATE)}`)
		} else {
			return this.ENTITY_UNFOUND
		}

	}


	/* Formatters */

	ownString(users, roots, challs) {
		return (users ? "💻 " + users : "") + (users && roots ? " " : "")
			+ (roots ? "👩‍💻 " + roots : "") + (roots && challs ? " " : "")
			+ (challs ? "⚙️ " + challs : "") + (roots + users + challs > 0 ? "\n" : "")
	}

	achievementString(achievement) {
		const {object_type: type, type: t, name, date} = achievement
		switch (type) {
		case "machine":	  return `[${F.timeSinceSmall(new Date(date))}] #Box ${name} [${(t == "user" ? "U" : "R")}]`
		case "challenge":	return `[${F.timeSinceSmall(new Date(date))}] #Chl ${name} [${achievement.challenge_category}]`
		case "endgame":		return `[${F.timeSinceSmall(new Date(date))}] #End ${name} ["${achievement.flag_title.substring(0,18)+(achievement.flag_title.length > 18 ? "…" : "")}"]`
		case "fortress":	return `[${F.timeSinceSmall(new Date(date))}] #Frt ${name} ["${achievement.flag_title.substring(0,18)+(achievement.flag_title.length > 18 ? "…" : "")}"]`
		case "prolab":		return `[${F.timeSinceSmall(new Date(date))}] #Pro ${name} ["${achievement.flag_title.substring(0,18)+(achievement.flag_title.length > 18 ? "…" : "")}"]`
		default:	return ""
		}
	}

	ownerString(achievement) {
		console.log(this)
		const {object_type: type, type: t, name, date, uid} = achievement
		var member = this.ds.getMemberById(uid)
		return F.mdLink(member.name,F.profileUrl(member), true, F.timeSinceSmall(new Date(date)))
	}

	filteredTargetString(target) {
		//console.log(target)
		switch (target.type) {
		case "machine":	  return `${this.E.of(target.os)}${this.E.of(F.targetDifficultyToEmojiName(target))}${this.E.of(F.targetRatingToEmojiName(target))}` + " " + F.mdLink(`\`${target.name}\``, F.profileUrl(target), false, target.os)
		case "challenge":	return `${this.E.of(target.category_name)}${this.E.of(F.targetDifficultyToEmojiName(target))}${this.E.of(F.targetRatingToEmojiName(target))}` + " " + F.mdLink(`\`${target.name}\``, F.profileUrl(target), false, target.category_name)
		case "endgame":		return `${this.E.of("endgame")}` + " [`"+target.name+"`]("+F.profileUrl(target)+")"
		case "fortress":	break
		case "prolab":		break
		}
		// return F.mdLink(target.name,"http://0", true, F.timeSinceSmall(new Date(date)))
	}


	bloodString(users, roots, challs) {
		return (users ? "🔺 " + users : "") + (users && roots ? " " : "")
			+ (roots ? "🩸 " + roots : "") + (roots && challs ? " " : "")
			+ (challs ? "⭕ " + challs : "") + (roots + users + challs > 0 ? "\n" : "")
	}

	socialString(github, linkedin, twitter, website) {
		return (github ? F.mdLink("GitHub", F.safeUrl(github), true) : "") + (github && linkedin ? " | " : "")
			+ (linkedin ? F.mdLink("LinkedIn", F.safeUrl(linkedin), true) : "") + (linkedin && twitter ? " | " : "")
			+ (twitter ? F.mdLink("Twitter", F.safeUrl(twitter), true) : "") + (twitter && website ? " | " : "")
			+ (website ? F.mdLink("Website", F.safeUrl(website), true) : "") + (github || linkedin || twitter || website ? "\n" : "")
	}

	teamSocialString(twitter, facebook, discord) {
		return (twitter ? F.mdLink("Twitter", F.safeUrl(twitter), true) : "") + (twitter && facebook ? " | " : "")
			+ (facebook ? F.mdLink("Facebook", F.safeUrl(facebook), true) : "") + (facebook && discord ? " | " : "")
			+ (discord ? F.mdLink("Discord", F.safeUrl(discord), true) : "") + (twitter || facebook || discord ? "\n" : "")
	}


	/* PRETTY CHARTS */


	memberAchievementTimelineChart(member, term, chartImageBuffer) {
		var embed = this.CHART_BASE
			.attachFiles([{ name: `chart-${member.id}-${term}.png`, attachment: chartImageBuffer }])
			.setTitle(`User Achievement Timeline for ${member.name} [${term}]`)
			.setImage(`attachment://chart-${member.id}-${term}.png`)
		return embed
	}

	/** REALTIME PUSHER EVENT NOTIFICATIONS */

	pusherOwn(member, target, sub) {
		target = this.ds.resolveEnt(target)
		console.log(member, target)
		if (!member || !target){
			return this.ENTITY_UNFOUND
		}
		return this.PUSHER_BASE
			.setAuthor(F.toTitleCase(target.type || "Unknown") + (["root", "user"].includes(sub) ? ` ${sub} ` : " ") + "own", F.avatarFullUrl(member), "")
			.setThumbnail(F.avatar2Url(target.avatar) || (member.team? F.avatar2Url(member.team.avatar) : F.avatar2Url(member.avatar)))
			.setColor(H.any(...Object.values(F.COL)))
			.setDescription(`${F.memberToMdLink(member,true,this.ds.tryDiscordifyUid(member.id))} owned ${(["root", "user"].includes(sub)? sub + " on" : "")} ${F.mdLink(target.name, F.profileUrl(target))}${(target.type == "challenge" ? " from the *"+target.category_name+"* category":"")}${(H.maybe(0.2) ? H.any(". Nice work! 🙂", ". **Why is all the RUM GONE!!!!**", ", woohoo!!", "!", ". Congrats! 🥳") : "")}` )
			.setFooter(`ℹ️  Source: ${F.STL("Shoutbox", "bs")}`)
	}

	pusherNotif(md) {
		return this.PUSHER_BASE
			.attachFiles(new Attachment(`./static/img/${F.challengeCategoryNameToIconFile("Hardware")}`, "notif.png"))
			.setAuthor("Pusher notification", this.ds.TEAM_STATS.avatar_url)
			.setThumbnail("attachment://notif.png")
			.setColor(H.any(...Object.values(F.COL)))
			.setDescription(md)
			.setFooter(`ℹ️  Source: ${F.STL("Shoutbox", "bs")}`)
	}
}

module.exports = {
	HtbEmbeds: HtbEmbeds
}
