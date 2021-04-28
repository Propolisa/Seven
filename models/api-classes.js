
/**
 * A module holding useful classes to describe Hack The Box achievements and resources.
 @module ApiClasses
*/


/** Class representing a Hack The Box Challenge. */
class Challenge {
	/**
	 * Create a Challenge object.
	 * @param {number} id - Sample: 70
	 * @param {string} name - Sample: Crooked Crockford
	 * @param {number} retired - Sample: 1
	 * @param {string} difficulty - Sample: Medium
	 * @param {number} points - Sample: 0
	 * @param {object} difficulty_chart - Sample: [object Object]
	 * @param {number} solves - Sample: 2289
	 * @param {boolean} authUserSolve - Sample: false
	 * @param {object} authUserSolveTime - Sample: null
	 * @param {number} likes - Sample: 706
	 * @param {number} dislikes - Sample: 92
	 * @param {string} description - Sample: Some bits are missing
	 * @param {string} category_name - Sample: Misc
	 * @param {string} first_blood_user - Sample: xct
	 * @param {number} first_blood_user_id - Sample: 13569
	 * @param {string} first_blood_time - Sample: 01D 02H 52M
	 * @param {string} first_blood_user_avatar - Sample: /storage/avatars/8c9faea377de0…
	 * @param {number} creator_id - Sample: 7383
	 * @param {string} creator_name - Sample: sx02089
	 * @param {string} creator_avatar - Sample: /storage/avatars/ff742f05a3bb9…
	 * @param {boolean} isRespected - Sample: true
	 * @param {object} creator2_id - Sample: null
	 * @param {object} creator2_name - Sample: null
	 * @param {object} creator2_avatar - Sample: null
	 * @param {object} isRespected2 - Sample: null
	 * @param {boolean} download - Sample: true
	 * @param {string} sha256 - Sample: 41a427e48b765325d40be361b312e1…
	 * @param {object} docker - Sample: null
	 * @param {object} docker_ip - Sample: null
	 * @param {object} docker_port - Sample: null
	 * @param {string} release_date - Sample: 2019-06-13T19:00:00.000000Z
	 * @param {boolean} likeByAuthUser - Sample: false
	 * @param {boolean} dislikeByAuthUser - Sample: false
	 * @param {boolean} isTodo - Sample: false
	 * @param {number} recommended - Sample: 0
	*/
	constructor(id,
		name,
		retired,
		difficulty,
		points,
		difficulty_chart,
		solves,
		authUserSolve,
		authUserSolveTime,
		likes,
		dislikes,
		description,
		category_name,
		first_blood_user,
		first_blood_user_id,
		first_blood_time,
		first_blood_user_avatar,
		creator_id,
		creator_name,
		creator_avatar,
		isRespected,
		creator2_id,
		creator2_name,
		creator2_avatar,
		isRespected2,
		download,
		sha256,
		docker,
		docker_ip,
		docker_port,
		release_date,
		likeByAuthUser,
		dislikeByAuthUser,
		isTodo,
		recommended) {
		this.id = id
		this.name = name
		this.retired = retired
		this.difficulty = difficulty
		this.points = points
		this.difficulty_chart = difficulty_chart
		this.solves = solves
		this.authUserSolve = authUserSolve
		this.authUserSolveTime = authUserSolveTime
		this.likes = likes
		this.dislikes = dislikes
		this.description = description
		this.category_name = category_name
		this.first_blood_user = first_blood_user
		this.first_blood_user_id = first_blood_user_id
		this.first_blood_time = first_blood_time
		this.first_blood_user_avatar = first_blood_user_avatar
		this.creator_id = creator_id
		this.creator_name = creator_name
		this.creator_avatar = creator_avatar
		this.isRespected = isRespected
		this.creator2_id = creator2_id
		this.creator2_name = creator2_name
		this.creator2_avatar = creator2_avatar
		this.isRespected2 = isRespected2
		this.download = download
		this.sha256 = sha256
		this.docker = docker
		this.docker_ip = docker_ip
		this.docker_port = docker_port
		this.release_date = release_date
		this.likeByAuthUser = likeByAuthUser
		this.dislikeByAuthUser = dislikeByAuthUser
		this.isTodo = isTodo
		this.recommended = recommended
	}
}



/** Class representing a Hack The Box Endgame. */
class Endgame {
	/**
	 * Create an Endgame object.
	 * @param {number} id - Sample: 3
	 * @param {string} name - Sample: Hades
	 * @param {string} avatar_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {string} cover_image_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {boolean} retired - Sample: true
	 * @param {boolean} vip - Sample: true
	 * @param {object} creators - Sample: [object Object],[object Object…
	 * @param {number} endgame_machines_count - Sample: 3
	 * @param {number} endgame_flags_count - Sample: 7
	 * @param {object} user_availability - Sample: [object Object]
	 * @param {boolean} new - Sample: false
	 * @param {string} points - Sample: 175
	 * @param {number} players_completed - Sample: 336
	 * @param {number} endgame_reset_votes - Sample: 2
	 * @param {string} most_recent_reset - Sample: 2021-04-20T19:07:23.000000Z
	 * @param {object} entry_points - Sample: 10.13.38.16
	 * @param {object} video_url - Sample: null
	 * @param {string} description - Sample: <h4>Hades</h4> <p class="c-wh…
	 * @param {string} completion_icon - Sample: fa-skull
	 * @param {string} completion_text - Sample: Domain Domination
	 * @param {string} type - Sample: endgame
	*/
	constructor(id,
		name,
		avatar_url,
		cover_image_url,
		retired,
		vip,
		creators,
		endgame_machines_count,
		endgame_flags_count,
		user_availability,
		is_new,
		points,
		players_completed,
		endgame_reset_votes,
		most_recent_reset,
		entry_points,
		video_url,
		description,
		completion_icon,
		completion_text,
		type) {
		this.id = id
		this.name = name
		this.avatar_url = avatar_url
		this.cover_image_url = cover_image_url
		this.retired = retired
		this.vip = vip
		this.creators = creators
		this.endgame_machines_count = endgame_machines_count
		this.endgame_flags_count = endgame_flags_count
		this.user_availability = user_availability
		this.new = is_new
		this.points = points
		this.players_completed = players_completed
		this.endgame_reset_votes = endgame_reset_votes
		this.most_recent_reset = most_recent_reset
		this.entry_points = entry_points
		this.video_url = video_url
		this.description = description
		this.completion_icon = completion_icon
		this.completion_text = completion_text
		this.type = type
	}
}



/** Class representing a Hack The Box EndgameEntry. */
class EndgameEntry {
	/**
	 * Create an EndgameEntry object.
	 * @param {number} id - Sample: 3
	 * @param {string} name - Sample: Hades
	 * @param {string} avatar_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {string} cover_image_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {boolean} retired - Sample: true
	 * @param {boolean} vip - Sample: true
	 * @param {object} creators - Sample: [object Object],[object Object…
	 * @param {number} endgame_machines_count - Sample: 3
	 * @param {number} endgame_flags_count - Sample: 7
	 * @param {object} user_availability - Sample: [object Object]
	 * @param {boolean} new - Sample: false
	*/
	constructor(id,
		name,
		avatar_url,
		cover_image_url,
		retired,
		vip,
		creators,
		endgame_machines_count,
		endgame_flags_count,
		user_availability,
		is_new) {
		this.id = id
		this.name = name
		this.avatar_url = avatar_url
		this.cover_image_url = cover_image_url
		this.retired = retired
		this.vip = vip
		this.creators = creators
		this.endgame_machines_count = endgame_machines_count
		this.endgame_flags_count = endgame_flags_count
		this.user_availability = user_availability
		this.new = is_new
	}
}



/** Class representing a Hack The Box EndgameProfile. */
class EndgameProfile {
	/**
	 * Create an EndgameProfile object.
	 * @param {number} id - Sample: 3
	 * @param {string} name - Sample: Hades
	 * @param {string} avatar_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {string} cover_image_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {boolean} retired - Sample: true
	 * @param {boolean} vip - Sample: true
	 * @param {object} creators - Sample: [object Object],[object Object…
	 * @param {string} points - Sample: 175
	 * @param {number} players_completed - Sample: 336
	 * @param {number} endgame_reset_votes - Sample: 0
	 * @param {object} most_recent_reset - Sample: null
	 * @param {object} entry_points - Sample: 10.13.38.16
	 * @param {object} video_url - Sample: null
	 * @param {string} description - Sample: <h4>Hades</h4> <p class="c-wh…
	 * @param {string} completion_icon - Sample: fa-skull
	 * @param {string} completion_text - Sample: Domain Domination
	*/
	constructor(id,
		name,
		avatar_url,
		cover_image_url,
		retired,
		vip,
		creators,
		points,
		players_completed,
		endgame_reset_votes,
		most_recent_reset,
		entry_points,
		video_url,
		description,
		completion_icon,
		completion_text) {
		this.id = id
		this.name = name
		this.avatar_url = avatar_url
		this.cover_image_url = cover_image_url
		this.retired = retired
		this.vip = vip
		this.creators = creators
		this.points = points
		this.players_completed = players_completed
		this.endgame_reset_votes = endgame_reset_votes
		this.most_recent_reset = most_recent_reset
		this.entry_points = entry_points
		this.video_url = video_url
		this.description = description
		this.completion_icon = completion_icon
		this.completion_text = completion_text
	}
}



/** Class representing a Hack The Box Fortress. */
class Fortress {
	/**
	 * Create a Fortress object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: Jet
	 * @param {string} image - Sample: https://www.hackthebox.eu/stor…
	 * @param {string} cover_image_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {number} number_of_flags - Sample: 11
	 * @param {object} user_availability - Sample: [object Object]
	 * @param {string} ip - Sample: 10.13.37.10
	 * @param {object} company - Sample: [object Object]
	 * @param {number} reset_votes - Sample: 1
	 * @param {string} description - Sample: Lift off with this introductor…
	 * @param {boolean} has_completion_message - Sample: false
	 * @param {object} completion_message - Sample: null
	 * @param {number} progress_percent - Sample: 0
	 * @param {number} players_completed - Sample: 971
	 * @param {string} points - Sample: 100
	 * @param {object} flags - Sample: [object Object],[object Object…
	 * @param {string} type - Sample: fortress
	*/
	constructor(id,
		name,
		image,
		cover_image_url,
		number_of_flags,
		user_availability,
		ip,
		company,
		reset_votes,
		description,
		has_completion_message,
		completion_message,
		progress_percent,
		players_completed,
		points,
		flags,
		type) {
		this.id = id
		this.name = name
		this.image = image
		this.cover_image_url = cover_image_url
		this.number_of_flags = number_of_flags
		this.user_availability = user_availability
		this.ip = ip
		this.company = company
		this.reset_votes = reset_votes
		this.description = description
		this.has_completion_message = has_completion_message
		this.completion_message = completion_message
		this.progress_percent = progress_percent
		this.players_completed = players_completed
		this.points = points
		this.flags = flags
		this.type = type
	}
}



/** Class representing a Hack The Box FortressEntry. */
class FortressEntry {
	/**
	 * Create a FortressEntry object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: Jet
	 * @param {string} image - Sample: https://www.hackthebox.eu/stor…
	 * @param {string} cover_image_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {number} number_of_flags - Sample: 11
	 * @param {object} user_availability - Sample: [object Object]
	*/
	constructor(id, name, image, cover_image_url, number_of_flags, user_availability) {
		this.id = id
		this.name = name
		this.image = image
		this.cover_image_url = cover_image_url
		this.number_of_flags = number_of_flags
		this.user_availability = user_availability
	}
}



/** Class representing a Hack The Box FortressProfile. */
class FortressProfile {
	/**
	 * Create a FortressProfile object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: Jet
	 * @param {string} ip - Sample: 10.13.37.10
	 * @param {string} image - Sample: https://www.hackthebox.eu/stor…
	 * @param {string} cover_image_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {object} company - Sample: [object Object]
	 * @param {number} reset_votes - Sample: 1
	 * @param {string} description - Sample: Lift off with this introductor…
	 * @param {boolean} has_completion_message - Sample: false
	 * @param {object} completion_message - Sample: null
	 * @param {number} progress_percent - Sample: 0
	 * @param {number} players_completed - Sample: 971
	 * @param {string} points - Sample: 100
	 * @param {object} flags - Sample: [object Object],[object Object…
	*/
	constructor(id,
		name,
		ip,
		image,
		cover_image_url,
		company,
		reset_votes,
		description,
		has_completion_message,
		completion_message,
		progress_percent,
		players_completed,
		points,
		flags) {
		this.id = id
		this.name = name
		this.ip = ip
		this.image = image
		this.cover_image_url = cover_image_url
		this.company = company
		this.reset_votes = reset_votes
		this.description = description
		this.has_completion_message = has_completion_message
		this.completion_message = completion_message
		this.progress_percent = progress_percent
		this.players_completed = players_completed
		this.points = points
		this.flags = flags
	}
}



/** Class representing a Hack The Box Machine. */
class Machine {
	/**
	 * Create a Machine object.
	 * @param {number} id - Sample: 298
	 * @param {string} name - Sample: Laboratory
	 * @param {string} os - Sample: Linux
	 * @param {number} active - Sample: 1
	 * @param {number} retired - Sample: 1
	 * @param {number} points - Sample: 0
	 * @param {number} static_points - Sample: 20
	 * @param {string} release - Sample: 2020-11-14T17:00:00.000000Z
	 * @param {number} user_owns_count - Sample: 4385
	 * @param {number} root_owns_count - Sample: 4257
	 * @param {boolean} free - Sample: true
	 * @param {boolean} authUserInUserOwns - Sample: true
	 * @param {boolean} authUserInRootOwns - Sample: true
	 * @param {boolean} authUserHasReviewed - Sample: true
	 * @param {string} stars - Sample: 4.3
	 * @param {number} difficulty - Sample: 53
	 * @param {string} avatar - Sample: /storage/avatars/97b6b79de8182…
	 * @param {object} feedbackForChart - Sample: [object Object]
	 * @param {string} difficultyText - Sample: Easy
	 * @param {boolean} isCompleted - Sample: true
	 * @param {string} last_reset_time - Sample: 2 weeks before
	 * @param {object} playInfo - Sample: [object Object]
	 * @param {object} maker - Sample: [object Object]
	 * @param {object} maker2 - Sample: null
	 * @param {string} authUserFirstUserTime - Sample: 02H 37M 45S
	 * @param {string} authUserFirstRootTime - Sample: 02H 37M 45S
	 * @param {object} userBlood - Sample: [object Object]
	 * @param {string} userBloodAvatar - Sample: /storage/avatars/db430c868179c…
	 * @param {object} rootBlood - Sample: [object Object]
	 * @param {string} rootBloodAvatar - Sample: /storage/avatars/158165f72c4fa…
	 * @param {string} firstUserBloodTime - Sample: 1h 48m 28s
	 * @param {string} firstRootBloodTime - Sample: 2h 3m 10s
	 * @param {number} recommended - Sample: 0
	 * @param {number} sp_flag - Sample: 0
	*/
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
		recommended,
		sp_flag) {
		this.id = id
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
		this.sp_flag = sp_flag
	}
}



/** Class representing a Hack The Box ProLab. */
class ProLab {
	/**
	 * Create a ProLab object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: RastaLabs
	 * @param {string} release_at - Sample: 2018-01-02T06:00:00.000000Z
	 * @param {number} pro_machines_count - Sample: 15
	 * @param {number} pro_flags_count - Sample: 22
	 * @param {number} ownership - Sample: 0
	 * @param {boolean} user_eligible_for_certificate - Sample: false
	 * @param {boolean} new - Sample: false
	 * @param {string} skill_level - Sample: INTERMEDIATE
	 * @param {string} designated_category - Sample: Red Team Operator
	 * @param {string} team - Sample: red
	 * @param {number} level - Sample: 1
	 * @param {number} lab_servers_count - Sample: 4
	 * @param {object} cover_img_url - Sample: null
	 * @param {string} version - Sample: 1.3
	 * @param {object} entry_points - Sample: 10.10.110.0/24
	 * @param {string} description - Sample: <h4>RastaLabs</h4><p>RastaLab…
	 * @param {object} video_url - Sample: null
	 * @param {object} cover_image_url - Sample: null
	 * @param {number} active_users - Sample: 8
	 * @param {object} lab_master - Sample: [object Object]
	 * @param {string} type - Sample: prolab
	 * @param {object} excerpt - Sample: null
	 * @param {object} social_links - Sample: [object Object]
	 * @param {boolean} new_version - Sample: false
	 * @param {object} overview_image_url - Sample: null
	 * @param {object} designated_level - Sample: [object Object]
	*/
	constructor(id,
		name,
		release_at,
		pro_machines_count,
		pro_flags_count,
		ownership,
		user_eligible_for_certificate,
		is_new,
		skill_level,
		designated_category,
		team,
		level,
		lab_servers_count,
		cover_img_url,
		version,
		entry_points,
		description,
		video_url,
		cover_image_url,
		active_users,
		lab_master,
		type,
		excerpt,
		social_links,
		new_version,
		overview_image_url,
		designated_level) {
		this.id = id
		this.name = name
		this.release_at = release_at
		this.pro_machines_count = pro_machines_count
		this.pro_flags_count = pro_flags_count
		this.ownership = ownership
		this.user_eligible_for_certificate = user_eligible_for_certificate
		this.new = is_new
		this.skill_level = skill_level
		this.designated_category = designated_category
		this.team = team
		this.level = level
		this.lab_servers_count = lab_servers_count
		this.cover_img_url = cover_img_url
		this.version = version
		this.entry_points = entry_points
		this.description = description
		this.video_url = video_url
		this.cover_image_url = cover_image_url
		this.active_users = active_users
		this.lab_master = lab_master
		this.type = type
		this.excerpt = excerpt
		this.social_links = social_links
		this.new_version = new_version
		this.overview_image_url = overview_image_url
		this.designated_level = designated_level
	}
}



/** Class representing a Hack The Box ProLabEntry. */
class ProLabEntry {
	/**
	 * Create a ProLabEntry object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: RastaLabs
	 * @param {string} release_at - Sample: 2018-01-02T06:00:00.000000Z
	 * @param {number} pro_machines_count - Sample: 15
	 * @param {number} pro_flags_count - Sample: 22
	 * @param {number} ownership - Sample: 0
	 * @param {boolean} user_eligible_for_certificate - Sample: false
	 * @param {boolean} new - Sample: false
	 * @param {string} skill_level - Sample: INTERMEDIATE
	 * @param {string} designated_category - Sample: Red Team Operator
	 * @param {string} team - Sample: red
	 * @param {number} level - Sample: 1
	 * @param {number} lab_servers_count - Sample: 4
	 * @param {object} cover_img_url - Sample: null
	*/
	constructor(id,
		name,
		release_at,
		pro_machines_count,
		pro_flags_count,
		ownership,
		user_eligible_for_certificate,
		is_new,
		skill_level,
		designated_category,
		team,
		level,
		lab_servers_count,
		cover_img_url) {
		this.id = id
		this.name = name
		this.release_at = release_at
		this.pro_machines_count = pro_machines_count
		this.pro_flags_count = pro_flags_count
		this.ownership = ownership
		this.user_eligible_for_certificate = user_eligible_for_certificate
		this.new = is_new
		this.skill_level = skill_level
		this.designated_category = designated_category
		this.team = team
		this.level = level
		this.lab_servers_count = lab_servers_count
		this.cover_img_url = cover_img_url
	}
}



/** Class representing a Hack The Box ProLabInfo. */
class ProLabInfo {
	/**
	 * Create a ProLabInfo object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: RastaLabs
	 * @param {string} version - Sample: 1.3
	 * @param {object} entry_points - Sample: 10.10.110.0/24
	 * @param {string} description - Sample: <h4>RastaLabs</h4><p>RastaLab…
	 * @param {object} video_url - Sample: null
	 * @param {number} pro_machines_count - Sample: 15
	 * @param {number} pro_flags_count - Sample: 22
	 * @param {object} cover_image_url - Sample: null
	 * @param {number} lab_servers_count - Sample: 4
	 * @param {number} active_users - Sample: 8
	 * @param {object} lab_master - Sample: [object Object]
	*/
	constructor(id,
		name,
		version,
		entry_points,
		description,
		video_url,
		pro_machines_count,
		pro_flags_count,
		cover_image_url,
		lab_servers_count,
		active_users,
		lab_master) {
		this.id = id
		this.name = name
		this.version = version
		this.entry_points = entry_points
		this.description = description
		this.video_url = video_url
		this.pro_machines_count = pro_machines_count
		this.pro_flags_count = pro_flags_count
		this.cover_image_url = cover_image_url
		this.lab_servers_count = lab_servers_count
		this.active_users = active_users
		this.lab_master = lab_master
	}
}



/** Class representing a Hack The Box ProLabOverview. */
class ProLabOverview {
	/**
	 * Create a ProLabOverview object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: RastaLabs
	 * @param {string} version - Sample: 1.3
	 * @param {object} excerpt - Sample: null
	 * @param {number} pro_machines_count - Sample: 15
	 * @param {number} pro_flags_count - Sample: 22
	 * @param {object} social_links - Sample: [object Object]
	 * @param {boolean} new_version - Sample: false
	 * @param {object} overview_image_url - Sample: null
	 * @param {string} skill_level - Sample: INTERMEDIATE
	 * @param {object} designated_level - Sample: [object Object]
	 * @param {object} lab_master - Sample: [object Object]
	*/
	constructor(id,
		name,
		version,
		excerpt,
		pro_machines_count,
		pro_flags_count,
		social_links,
		new_version,
		overview_image_url,
		skill_level,
		designated_level,
		lab_master) {
		this.id = id
		this.name = name
		this.version = version
		this.excerpt = excerpt
		this.pro_machines_count = pro_machines_count
		this.pro_flags_count = pro_flags_count
		this.social_links = social_links
		this.new_version = new_version
		this.overview_image_url = overview_image_url
		this.skill_level = skill_level
		this.designated_level = designated_level
		this.lab_master = lab_master
	}
}



/** Class representing a Hack The Box Team. */
class Team {
	/**
	 * Create a Team object.
	 * @param {number} id - Sample: 2102
	 * @param {string} name - Sample: CommandlineKings
	 * @param {number} points - Sample: 1824
	 * @param {string} motto - Sample: Hacking for the fun of it! Lea…
	 * @param {string} description - Sample: Open for anyone who is: * po…
	 * @param {string} country_name - Sample: Netherlands
	 * @param {string} country_code - Sample: NL
	 * @param {string} avatar_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {object} cover_image_url - Sample: null
	 * @param {object} twitter - Sample: null
	 * @param {object} facebook - Sample: null
	 * @param {object} discord - Sample: null
	 * @param {boolean} public - Sample: true
	 * @param {boolean} can_delete_avatar - Sample: true
	 * @param {object} captain - Sample: [object Object]
	 * @param {boolean} is_respected - Sample: true
	 * @param {boolean} join_request_sent - Sample: false
	*/
	constructor(id,
		name,
		points,
		motto,
		description,
		country_name,
		country_code,
		avatar_url,
		cover_image_url,
		twitter,
		facebook,
		discord,
		is_public,
		can_delete_avatar,
		captain,
		is_respected,
		join_request_sent) {
		this.id = id
		this.name = name
		this.points = points
		this.motto = motto
		this.description = description
		this.country_name = country_name
		this.country_code = country_code
		this.avatar_url = avatar_url
		this.cover_image_url = cover_image_url
		this.twitter = twitter
		this.facebook = facebook
		this.discord = discord
		this.public = is_public
		this.can_delete_avatar = can_delete_avatar
		this.captain = captain
		this.is_respected = is_respected
		this.join_request_sent = join_request_sent
	}
}



/** Class representing a Hack The Box Track. */
class Track {
	/**
	 * Create a Track object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: Beginner Track
	 * @param {string} description - Sample: Welcome to HTB! A collection o…
	 * @param {string} difficulty - Sample: Easy
	 * @param {object} creator - Sample: [object Object]
	 * @param {boolean} official - Sample: true
	 * @param {number} staff_pick - Sample: 0
	 * @param {object} items - Sample: [object Object],[object Object…
	 * @param {string} cover_image - Sample: /storage/tracks/1.png
	 * @param {number} likes - Sample: 828
	 * @param {boolean} liked - Sample: false
	 * @param {boolean} enrolled - Sample: true
	 * @param {boolean} has_completion_message - Sample: false
	 * @param {object} completion_url - Sample: null
	 * @param {object} completion_message - Sample: null
	 * @param {object} completion_cta - Sample: null
	*/
	constructor(id,
		name,
		description,
		difficulty,
		creator,
		official,
		staff_pick,
		items,
		cover_image,
		likes,
		liked,
		enrolled,
		has_completion_message,
		completion_url,
		completion_message,
		completion_cta) {
		this.id = id
		this.name = name
		this.description = description
		this.difficulty = difficulty
		this.creator = creator
		this.official = official
		this.staff_pick = staff_pick
		this.items = items
		this.cover_image = cover_image
		this.likes = likes
		this.liked = liked
		this.enrolled = enrolled
		this.has_completion_message = has_completion_message
		this.completion_url = completion_url
		this.completion_message = completion_message
		this.completion_cta = completion_cta
	}
}



/** Class representing a Hack The Box University. */
class University {
	/**
	 * Create an University object.
	 * @param {number} id - Sample: 1
	 * @param {string} name - Sample: University of Rome - Tor Verga…
	 * @param {number} points - Sample: 1230
	 * @param {object} motto - Sample: null
	 * @param {string} description - Sample: <div>The University of Rome To…
	 * @param {string} country_name - Sample: Italy
	 * @param {string} country_code - Sample: IT
	 * @param {number} has_auto_generated_logo - Sample: 0
	 * @param {boolean} join_request_sent - Sample: false
	 * @param {boolean} is_respected - Sample: false
	 * @param {string} url - Sample: https://web.uniroma2.it/
	 * @param {object} twitter - Sample: null
	 * @param {object} facebook - Sample: null
	 * @param {object} discord - Sample: null
	 * @param {string} logo_url - Sample: https://www.hackthebox.eu/stor…
	 * @param {object} cover_image_url - Sample: null
	 * @param {object} captain - Sample: [object Object]
	*/
	constructor(id,
		name,
		points,
		motto,
		description,
		country_name,
		country_code,
		has_auto_generated_logo,
		join_request_sent,
		is_respected,
		url,
		twitter,
		facebook,
		discord,
		logo_url,
		cover_image_url,
		captain) {
		this.id = id
		this.name = name
		this.points = points
		this.motto = motto
		this.description = description
		this.country_name = country_name
		this.country_code = country_code
		this.has_auto_generated_logo = has_auto_generated_logo
		this.join_request_sent = join_request_sent
		this.is_respected = is_respected
		this.url = url
		this.twitter = twitter
		this.facebook = facebook
		this.discord = discord
		this.logo_url = logo_url
		this.cover_image_url = cover_image_url
		this.captain = captain
	}
}



/** Class representing a Hack The Box User. */
class User {
	/**
	 * Create an User object.
	 * @param {number} id - Sample: 73268
	 * @param {string} name - Sample: 0xc45
	 * @param {number} system_owns - Sample: 98
	 * @param {number} user_owns - Sample: 98
	 * @param {number} user_bloods - Sample: 0
	 * @param {number} system_bloods - Sample: 0
	 * @param {object} team - Sample: [object Object]
	 * @param {number} respects - Sample: 644
	 * @param {string} rank - Sample: Elite Hacker
	 * @param {number} rank_id - Sample: 5
	 * @param {number} current_rank_progress - Sample: 0
	 * @param {string} next_rank - Sample: Guru
	 * @param {number} next_rank_points - Sample: 13.113
	 * @param {string} rank_ownership - Sample: 14.57
	 * @param {number} rank_requirement - Sample: 70
	 * @param {number} ranking - Sample: 657
	 * @param {string} avatar - Sample: /storage/avatars/f40ff044695ac…
	 * @param {string} timezone - Sample: Europe/Amsterdam
	 * @param {number} points - Sample: 57
	 * @param {string} country_name - Sample: Netherlands
	 * @param {string} country_code - Sample: NL
	 * @param {object} university_name - Sample: null
	 * @param {object} description - Sample: null
	 * @param {object} github - Sample: null
	 * @param {object} linkedin - Sample: null
	 * @param {object} twitter - Sample: null
	 * @param {object} website - Sample: null
	*/
	constructor(id,
		name,
		system_owns,
		user_owns,
		user_bloods,
		system_bloods,
		team,
		respects,
		rank,
		rank_id,
		current_rank_progress,
		next_rank,
		next_rank_points,
		rank_ownership,
		rank_requirement,
		ranking,
		avatar,
		timezone,
		points,
		country_name,
		country_code,
		university_name,
		description,
		github,
		linkedin,
		twitter,
		website) {
		this.id = id
		this.name = name
		this.system_owns = system_owns
		this.user_owns = user_owns
		this.user_bloods = user_bloods
		this.system_bloods = system_bloods
		this.team = team
		this.respects = respects
		this.rank = rank
		this.rank_id = rank_id
		this.current_rank_progress = current_rank_progress
		this.next_rank = next_rank
		this.next_rank_points = next_rank_points
		this.rank_ownership = rank_ownership
		this.rank_requirement = rank_requirement
		this.ranking = ranking
		this.avatar = avatar
		this.timezone = timezone
		this.points = points
		this.country_name = country_name
		this.country_code = country_code
		this.university_name = university_name
		this.description = description
		this.github = github
		this.linkedin = linkedin
		this.twitter = twitter
		this.website = website
	}
}


module.exports = {
	Challenge,
	Endgame,
	EndgameEntry,
	EndgameProfile,
	Fortress,
	FortressEntry,
	FortressProfile,
	Machine,
	ProLab,
	ProLabEntry,
	ProLabInfo,
	ProLabOverview,
	Team,
	Track,
	University,
	User
}
