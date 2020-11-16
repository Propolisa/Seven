/**
 * A module holding useful classes to describe Hack The Box achievements and resources.
 @module Classes
*/


class HtbMachine {
	constructor(id,
		name,
		os,
		active,
		retired,
		points,
		static_points,
		release,
		user_owns_count,
		root_owns_count,
		free,
		authUserInUserOwns,
		authUserInRootOwns,
		authUserHasReviewed, 
		stars,
		difficulty,
		avatar,
		feedbackForChart,
		difficultyText,
		isCompleted,
		last_reset_time,
		playInfo,
		maker,
		maker2,
		authUserFirstUserTime,
		authUserFirstRootTime,
		userBlood,
		userBloodAvatar,
		rootBlood,
		rootBloodAvatar,
		firstUserBloodTime,
		firstRootBloodTime,
		recommended) 
	{
		this.id = 1
		this.name = name
		this.os = os
		this.active = active
		this.retired = retired
		this.points = points
		this.static_points = static_points
		this.release = release
		this.user_owns_count = user_owns_count
		this.root_owns_count = root_owns_count
		this.free = free
		this.authUserInUserOwns = authUserInUserOwns
		this.authUserInRootOwns = authUserInRootOwns
		this.authUserHasReviewed = authUserHasReviewed
		this.stars = stars
		this.difficulty = difficulty
		this.avatar = avatar
		this.feedbackForChart = feedbackForChart
		this.difficultyText = difficultyText
		this.isCompleted = isCompleted
		this.last_reset_time = last_reset_time
		this.playInfo = playInfo
		this.maker = maker
		this.maker2 = maker2
		this.authUserFirstUserTime = authUserFirstUserTime
		this.authUserFirstRootTime = authUserFirstRootTime
		this.userBlood = userBlood
		this.userBloodAvatar = userBloodAvatar
		this.rootBlood = rootBlood
		this.rootBloodAvatar = rootBloodAvatar
		this.firstUserBloodTime = firstUserBloodTime
		this.firstRootBloodTime = firstRootBloodTime
		this.recommended = recommended
		this.type = "machine"
	}
}

/** Class representing a HTB challenge / box creator.
 * 
 * @typedef HtbMaker
 * @property {number} id - The ID of the member.
 * @property {string} name - Unix time (seconds) at which the own occurred.
 * @property {string} avatar - The HTB avatar url identifier (starting with '/storage/avatars/') of the maker.
 * @property {boolean} isRespected - Whether the API user has respected this member or not.
 */
class HtbMaker {
	/**
	 * Creates a new HtbMaker object.
	 * @param {number} id - The ID of the maker.
	 * @param {string} name - The HTB username of the maker.
	 * @param {string} avatar - The HTB avatar url identifier (starting with '/storage/avatars/') of the maker.
	 * @param {boolean} isRespected - Whether the API user has respected this member or not.
	 * @returns {HtbMaker}
	 */
	constructor(id, name, avatar, isRespected) {
		this.id = id // 1
		this.name = name // 'ch4p'
		this.avatar = avatar // '/storage/avatars/08c255a334e10b3033ab7263e6b32422.png'
		this.isRespected = isRespected // false
	}
}

/**
 * A chart feedback data structure used by the new site redesign.
 */
class HtbFeedbackForChart {
	/**
	 * Constructor
	 * @param {number[]} difficultyBallotArray - An array of 10 numbers representing the votes received from HTB users for each difficulty level specifier on a given target.
	 */
	constructor(difficultyBallotArray) {
		if (difficultyBallotArray.length == 10) {
			var values = ["counterCake", "counterVeryEasy", "counterEasy", "counterTooEasy", "counterMedium", "counterBitHard", "counterHard", "counterTooHard", "counterExHard", "counterBrainFuck"]
			difficultyBallotArray.forEach((difficultyBallot, idx) => {
				this[values[idx]] = Number(difficultyBallot)
			})
		}
	}
}

/**
 * A chart feedback data structure used by the new site redesign.
 */
class HtbSpecialFlag {
	constructor(flagIdx, flagName, parentSpecialTarget) {
		this.idx = flagIdx
		this.name = flagName,
		this.parent = parentSpecialTarget
		this.type = "flag"
	}
}


module.exports = {
	HtbMaker,
	HtbMachine,
	HtbSpecialFlag
}