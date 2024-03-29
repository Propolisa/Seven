/**
 * Implements functionality for parsing and responding to Pusher events from the public HTB Shoutbox.
 @module Pusher-Htb
*/
const { JSDOM } = require("jsdom")
const EventEmitter = require("events")
const Pusher = require("pusher-client")
const { Helpers: H } = require("../helpers/helpers.js")
const TD = require("turndown")

function cleanAttribute (attribute) {
	return attribute ? attribute.replace(/(\n+\s*)+/g, "\n") : ""
}

const td = new TD().addRule("boldlink", {
	filter: function (node, options) {
		return (
			options.linkStyle === "inlined" &&
      node.nodeName === "A" &&
      node.getAttribute("href")
		)
	},

	replacement: function (content, node) {
		var href = node.getAttribute("href")
		var title = cleanAttribute(node.getAttribute("title"))
		if (title) title = " \"" + title + "\""
		return "**[" + content + "](" + href + title + ")**"
	}
})

/**
 * Handles a single Pusher achievement message, sending it to our announcement channel as a pretty embed if it concerns our team.
 * @param {Object} data - Contains the Pusher event data.
 * @param {Discord.Channel} channel - The Discord channel to send the announcement to, if one is configured.
 * @returns {string} - Debug description of the event / achievement.
 */

function parsePusherEvent(data, source={}) {
	var md = null
	try {
		switch (data["channel"]) {
		case "owns-channel": case "infobox-channel": case null:
		{
			let dom = (new JSDOM(data.text))
			let msg = dom.window.document.body
			Array.from(msg.getElementsByTagName("a")).forEach(element => {
				element.href = encodeURI(element.href)
			})
			// console.log(msg)
			// console.log(msg.querySelector("a"))
			let links = Array.from(msg.getElementsByTagName("a"))
			links.forEach(element => {
				element.href = encodeURI(element.href)
			})
			let machine = (H.sAcc(links.find(e => e.href.includes("machine")), "textContent") || "").trim()
			let challenge = (H.sAcc(links.find(e => e.href.includes("challenge")), "textContent") || "").trim()
			// console.log(Array.from(links))
			let nodes = Array.from((msg.lastChild.textContent == "[Tweet]" ? Array.from(msg.childNodes).slice(0, -1) : msg.childNodes))        // MD: Eliminate the "[Tweet]" link
			let texts = nodes.map(node => node.outerHTML || node.textContent) // MD: Get HTML from each remaining node
			md = td.turndown(texts.join(""))            // MD: Recombine HTML and convert to Markdown
			let uid = (links.length ? (~~links[0].href.match(/profile\/(\d+)/)?.[1] || null): null)
			var isBlood = Array.from(msg.querySelectorAll("span.text-danger")).some(e => e.textContent.includes("1st blood"))
			var isLaunch = msg.textContent.includes("mass-powering")
			var launchName
			if (isLaunch) {
				launchName = H.sAcc(nodes,0,"firstChild","data")
			}
			let type = machine ? "machine" : challenge ? "challenge" : isLaunch ? "launch" : null 
			let flag = undefined
			let target = machine || challenge || launchName

			let lemmas = msg.childNodes[1].textContent.trim().split(" ")
			let verb = lemmas[0]
			if (verb == "solved") {
			// This is a challenge own.
			} else if (isBlood) {
			// This is a blood.
				flag = ["root", "system"].includes(msg.childNodes[3].textContent.trim().split(" ")[1]) ? "root" : "user"
			} else if (machine) {
			// This is (probably) a box own.
				flag = lemmas[1]
				flag = flag == "system" ? "root" : flag
			}
			return new HtbPusherEvent(source.channel || data.channel, source.event, data, uid, type, target, flag, md, isBlood, data.text)}	
		default:
		{
			// console.log("Uncategorized / Other Channel:", data)
			let dom = (new JSDOM(data.text))
			let msg = dom.window.document.body
			Array.from(msg.getElementsByTagName("a")).forEach(element => {
				element.href = encodeURI(element.href)
			})
			// console.log(msg)
			// console.log(msg.querySelector("a"))
			let links = Array.from(msg.getElementsByTagName("a"))
			links.forEach(element => {
				element.href = encodeURI(element.href)
				// console.log(element, element.href)
			})
			// console.log(Array.from(links))
			let nodes = Array.from((msg.lastChild.textContent == "[Tweet]" ? Array.from(msg.childNodes).slice(0, -1) : msg.childNodes))        // MD: Eliminate the "[Tweet]" link
			let texts = nodes.map(node => node.outerHTML || node.textContent) // MD: Get HTML from each remaining node
			md = td.turndown(texts.join(""))            // MD: Recombine HTML and convert to Markdown
			return new HtbPusherEvent(source.channel || data.channel, source.event, data, undefined, undefined, undefined, undefined, md, isBlood, data.text)}
		}
	} catch (error) {
		console.warn(`Error encountered for the following incoming Pusher message (CHAN: ${source.channel} | EVT: ${source.event}):`,)
		console.error(JSON.stringify(data,null,"\t"))
		console.error(error)
		return new HtbPusherEvent(source.channel || data.channel, source.event, data, undefined, undefined, undefined, undefined, md, null, data.text)
	}

}

class HtbPusherEvent {
	/**
 	* 	An object containing data parsed from a HTB Pusher event. Contains structured information about the specific achievement, target and users involved, as well as the original text for debugging.
	* @param {string} channel - The channel name associated with the Pusher event.
	* @param {boolean} event - The event name associated with the Pusher event.
	* @param {Object} data  - The original JSON data from Pusher.
	* @param {number} uid  - The Htb UID of the user involved.
	* @param {string} type - The type of message this was, e.g. a challenge own, fortress milestone, machine rating etc.
	* @param {string} target - The string name of the target (thing that was owned), if relevant.
	* @param {string} flag - The string name of the flag / milestone, if a pro lab or other necessitating challenge.
	* @param {string} markdown - The bare markdown representation of the original HTML announcement string.
	* @param {boolean} blood - Whether this is a blood or not.
	* @param {string} debug - The raw HTML string passed in the Pusher event.
   */
	constructor(channel, event, data, uid, type, target, flag, markdown, blood=false, debug) {
		this.data = data
		this.uid = uid
		this.time = new Date().getTime()
		this.type = type
		this.target = target
		this.flag = flag
		this.markdown = markdown
		this.debug = debug
		this.channel = channel
		this.blood = blood
		this.event = event
	}
}



/** Class representing a HTB Pusher Subscription (legacy).
 * 
 * @typedef HtbPusherSubscription
 * @property {number} client - The Pusher Client instance.
 * @property {string} channel - The channel being listened on.
 */
class HtbPusherSubscription extends EventEmitter {
	/**
   * Creates a new HtbPusherSubscription object.
   * @param {string} apiToken - The Pusher Client instance.
   * @param {Object} bindings - An array of channel:event pair objects to subscribe to.
   * @param {string} csrfToken - The Htb CSRF protection token, used for (primitive) authentication.
   * @returns {HtbPusherSubscription}
   */

	// new HtbPusherSubscription('97608bf7532e6f0fe898', 'owns-channel', 'display-info', token)
	//'97608bf7532e6f0fe898' (Htb pusher api token)
	constructor(apiToken, bindings, csrfToken) {
		super()
		this.client = new Pusher(apiToken, {
			authEndpoint: "https://www.hackthebox.com/pusher/auth",
			auth: { "X-CSRF-Token": csrfToken },
			authTransport: "ajax",
			cluster: "eu",
			encrypted: true
		})
		this.channels = []
		for (let i = 0; i < bindings.length; i++) {
			const binding = bindings[i]
			var channel = this.client.subscribe(binding.channel)
			channel.bind(binding.event,
				(data) => {
					try {
						// console.log(data)
						this.alertSeven(parsePusherEvent(data, {channel:binding.channel, event: binding.event})) // Pass the parsed message back for processing
					} catch (error) {
						console.error(error)
					}
				}
			)
			this.channels.push(channel)
		}
		
		this.client.connection.bind("state_change", function (states) {
			console.log("[PUSHER]::: Client state changed from " + states.previous + " to " + states.current)
		})
	}

	/**
   * 
   * @param {HtbPusherEvent} message 
   */
	alertSeven(message) {
		if (message) {
			this.emit("pusherevent", message)
		}
	}

	/**
   * Updates the CSRF-token based authentication for the Pusher Client.
   * @param {Object} csrfToken - This param should be a token string.
   */
	set auth(csrfToken) {
		try {
			this.client.config.auth["X-CSRF-Token"] = csrfToken
		} catch (error) {
			console.error(error)
		}
	}
}

module.exports = {
	HtbPusherEvent: HtbPusherEvent,
	HtbPusherSubscription: HtbPusherSubscription,
	parsePusherEvent: parsePusherEvent
}