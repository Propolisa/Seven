/**
 * A module holding useful legacy classes to describe Hack The Box achievements and resources.
 @module LegacyClasses
*/


/** 
 * Converts a numeric points value to an scaled 'difficulty' indicator.
 * @param {number} points - The points offered for solving a machine (proportional to difficulty).
 * @returns {('Unknown'|'Easy'|'Medium'|'Hard'|'Insane')}
 */
function pointsToDifficulty(points) {
	switch (points) {
	case 0: return "Unknown"
	case 20: return "Easy"
	case 30: return "Medium"
	case 40: return "Hard"
	case 50: return "Insane"
	default: return ""
	}
}


/** Class representing a (legacy) Hack the Box machine. 
 * @typedef LegacyHtbMachine
 * @property {string} name - The name of the machine (e.g. 'Fatty')).
 * @property {number} id - The numeric id representing the machine.
 * @property {string} thumb - The full url to the machine's public thumbnail image.
 * @property {HtbOwn[]} userOwners - A list of HtbOwn objects, containing uid and timestamp values for each member user own.
 * @property {HtbOwn[]} rootOwners - A list of HtbOwn objects, containing uid and timestamp values for each member root own.
 * @property {boolean} retired - A boolean value indicating whether the machine is retired. (todo: consolodate retired/unreleased into single 'state' member.)
 * @property {boolean} unreleased - A boolean value indicating whether the machine is unreleased.
 * @property {number} retiredate - A number representing the Unix time (seconds from epoch) at which the machine was retired.
 * @property {number} release - A number representing the Unix time (seconds from epoch) at which the machine was released.
 * @property {LegacyHtbMaker} maker - An object containing the id and name of the primary maker.
 * @property {LegacyHtbMaker} maker2 - An object containing the id and name of the secondary maker (if applicable).
 * @property {string} os - A string representing the machine's operating system (e.g. 'Linux' / 'Windows' ...).
 * @property {string} ip - The machine's IP address.
 * @property {number} rating - A number ranging from 0 to 5 indicating the overall user rating the machine has received.
 * @property {number} points - The amount of points the machine is worth, if it is active.
 * @property {string} difficulty - The difficulty of the box as a string, e.g. "Easy", "Hard".
 */
class LegacyHtbMachine {
	/** Creates a new HtbMachine object. 
     * @param {string} name
     * @param {number} id
     * @param {string} thumb
     * @param {boolean} retired
     * @param {LegacyHtbMaker} maker
     * @param {LegacyHtbMaker} maker2
     * @param {string} os
     * @param {string} ip
     * @param {number} rating
     * @param {number} release
     * @param {number} retiredate
     * @param {number} points
     * @param {boolean} unreleased
     * @returns {LegacyHtbMachine}
     */
	constructor(name, id, thumb, retired, maker, maker2, os, ip, rating, release, retiredate, points, unreleased) {
		this.name = name
		this.id = id
		this.thumb = thumb
		this.userOwners = []
		this.rootOwners = []
		this.retired = retired
		this.maker = maker
		this.maker2 = maker2
		this.os = os
		this.ip = ip
		this.rating = rating
		this.release = release
		this.retiredate = retiredate
		this.points = points
		this.difficulty = pointsToDifficulty(points)
		this.unreleased = unreleased
	}
}


/** Class representing a Hack the Box challenge.
 * @typedef LegacyHtbChallenge
 * @property {string} name - The name of the challenge (e.g. 'Nostalgia')).
 * @property {string} category - The category of the challenge (e.g. 'Crypto')).
 * @property {number} releaseDate - A number representing the Unix time (seconds from epoch) at which the challenge was released.
 * @property {string} description - A brief description of the challenge, if one is provided.
 * @property {boolean} isActive - A boolean value indicating whether the challenge is active or not.
 * @property {number} points - The amount of points the challenge is worth, if it is active.
 * @property {LegacyHtbMaker} maker - An object containing the id and name of the primary maker.
 * @property {LegacyHtbMaker} maker2 - An object containing the id and name of the secondary maker (if applicable).
 * @property {number} solverCount - The number of times this challenge has been solved.
 * @property {number} upvotes - Number of positive user ratings this challenge has received.
 * @property {number} downvotes - Number of positive user ratings this challenge has received.
 * @property {HtbOwn[]} owners - A list of HtbOwn objects, containing uid and timestamp values for each member own.
 */
class LegacyHtbChallenge {
	/**
     * Creates a new HtbChallenge object.
     * @param {string} name 
     * @param {string} category 
     * @param {number} date 
     * @param {string} description 
     * @param {boolean} isActive 
     * @param {number} points 
     * @param {LegacyHtbMaker} maker
     * @param {LegacyHtbMaker} maker2
     * @param {*} solverCount 
     * @param {*} upvotes 
     * @param {*} downvotes 
     * @returns {LegacyHtbChallenge}
     */
	constructor(name, category, date, description, isActive, points, maker, maker2, solverCount, upvotes, downvotes) {
		this.name = name
		this.category = category
		this.releaseDate = date
		this.description = description
		this.isActive = isActive
		this.points = points
		this.maker = maker
		this.maker2 = maker2
		this.solverCount = solverCount
		this.upvotes = upvotes
		this.downvotes = downvotes
		this.owners = []
	}
}

/**
 * Class representing a Hack the Box team member.
 * @typedef LegacyTeamMember
 * @property {number} siterank - The current global rank of the member as an integer, e.g. 112 (112th).
 * @property {number} points - The total points currently held by the member.
 * @property {string} name - The member's formal name, e.g. 'bkr32'.
 * @property {number} id - The unique ID number identifying the user on Hack The Box.
 * @property {Object} totalOwns - An object containing ownage info.
 * @param {number} totalOwns.user - The total number of user owns (inactive and active) for the member.
 * @param {number} totalOwns.root - The total number of system owns (inactive and active) for the member.
 * @param {number} totalOwns.challenge - The total number of challenge owns (inactive and active) for the member.
 * @property {string} thumb - The full url to the member's public thumbnail image.
 * @property {string} rank - The member's title / level, e.g. ['Noob', 'Script Kiddie', 'Hacker', 'Pro Hacker', 'Elite Hacker', 'Guru', 'Omniscient', 'Admin']
 * @property {string} countryName - The country associated with the member's profile.
 * @property {string} countryCode - The country code associated with the member's profile (used for flag lookup).
 * @property {number} joinDate - The Unix timestamp (in seconds) representing when the member joined Hack The Box (NOTE: Team join date information is currently not available.)
 * @property {Object} stats - A container holding various metrics, as parsed from the profile page chart area. (this is updated only nightly -- prefer totalOwns where possible data as it is realtime).
 * @property {number} stats.users - Member user owns (nightly update)
 * @property {number} stats.roots - Member system owns (nightly update)
 * @property {number} stats.challenges - Member challenge owns (nightly update)
 * @property {number} stats.respects - Member total respect (nightly update)
 * @property {number} stats.bloods - Member total first bloods (nightly update)
 */
class LegacyTeamMember {
	/**
     * Creates a new TeamMember object.
     * @param {string} name
     * @param {number} id
     * @param {Object} owns
     * @param {number} siterank
     * @param {number} points
     * @returns {LegacyTeamMember}
     */
	constructor(name, id, owns, siterank, points) {
		this.siterank = siterank
		this.points = points
		this.name = name
		this.id = id
		this.totalOwns = owns
		this.thumb = false
		this.rank = "Noob"
		this.countryName = "Pangea"
		this.countryCode = ""
		this.joinDate = 0
		this.stats = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
	}
}

/** Class representing a member own. (challenge, user, or root)
 * 
 * @typedef HtbOwn
 * @property {number} uid - The ID of the member.
 * @property {number} timestamp - Unix time (seconds) at which the own occurred.
 */
class HtbOwn {
	/**
     * Creates a new HtbOwn object.
     * @param {number} uid 
     * @param {number} timestamp 
     * @returns {HtbOwn}
     */
	constructor(uid, timestamp) {
		this.uid = uid
		this.timestamp = timestamp
	}
}

/** Class representing a HTB challenge / box creator.
 * 
 * @typedef LegacyHtbMaker
 * @property {number} id - The ID of the member.
 * @property {string} name - Unix time (seconds) at which the own occurred.
 */
class LegacyHtbMaker {
	/**
     * Creates a new HtbMaker object.
     * @param {number} id - The ID of the maker.
     * @param {string} name - The HTB username of the maker.
     * @returns {LegacyHtbMaker}
     */
	constructor(id, name) {
		this.id = id
		this.name = name
	}
}

module.exports = {
	LegacyHtbMachine: LegacyHtbMachine,
	LegacyHtbChallenge: LegacyHtbChallenge,
	LegacyTeamMember: LegacyTeamMember,
	HtbOwn: HtbOwn,
	LegacyHtbMaker: LegacyHtbMaker,
	pointsToDifficulty: pointsToDifficulty
}