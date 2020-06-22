/**
 * Implements functionality for parsing and responding to Pusher events from the public HTB Shoutbox.
 @module Pusher-Htb
*/

const EventEmitter = require('events');
const Pusher = require('pusher-client');
const HTMLParser = require('node-html-parser');
const TD = require("turndown")

const td = new TD()

/**
 * Handles a single Pusher achievement message, sending it to our announcement channel as a pretty embed if it concerns our team.
 * @param {Object} data - Contains the Pusher event data.
 * @param {Discord.Channel} channel - The Discord channel to send the announcement to, if one is configured.
 * @returns {string} - Debug description of the event / achievement.
 */


function parsePusherEvent(data) {
  try {
    var msg = HTMLParser.parse(data.text)
    var nodes = (msg.lastChild.rawText == "[Tweet]" ? msg.childNodes.slice(0, -1) : msg.childNodes)        // MD: Eliminate the "[Tweet]" link
    nodes.forEach(node => { node = node.rawText; }) // MD: Get HTML from each remaining node
    var md = td.turndown(nodes.join(""))          // MD: Recombine HTML and convert to Markdown
    var uid = Number(msg.firstChild.rawAttributes.href.substring(45))
    var type = undefined
    var target = undefined
    var lemmas = msg.childNodes[1].rawText.trim().split(" ")
    verb = lemmas[0]
    if (verb == "solved") {
      // This is a challenge own.
      type = "challenge"
      target = msg.childNodes[2].structuredText.trim()
    } else {
      // This is (probably) a box own.
      target = lemmas[1]
      switch (target) {
        case "root": case "system": type = "root"; break;
        case "user": type = "user"; break;
        default: break;
      }
    }
    target = msg.childNodes[2].structuredText.trim()
    return new HtbPusherEvent(uid, type, target, "", md, msg.structuredText)
  } catch (error) {
    console.error(error)
    return null
  }

}

class HtbPusherEvent {
  /**
   * An object containing data parsed from a HTB Pusher event. Contains structured information about the specific achievement, target and users involved, as well as the original text for debugging.
   * @param {number} uid  - The Htb UID of the user involved.
   * @param {string} type - The type of message this was, e.g. a challenge own, fortress milestone, machine rating etc.
   * @param {string} target - The string name of the target (thing that was owned), if relevant.
   * @param {string} flag - The string name of the flag / milestone, if a pro lab or other necessitating challenge.
   * @param {string} markdown - The bare markdown representation of the original HTML announcement string.
   * @param {string} debug - The raw HTML string passed in the Pusher event.
   */
  constructor(uid, type, target, flag, markdown, debug) {
    this.uid = uid
    this.time = new Date().getTime()
    this.type = type
    this.target = target
    this.flag = flag
    this.markdown = markdown
    this.debug = debug
  }

}



/** Class representing a HTB challenge / box creator.
 * 
 * @typedef HtbPusherSubscription
 * @property {number} client - The Pusher Client instance.
 * @property {string} channel - The channel being listened on.
 */
class HtbPusherSubscription extends EventEmitter {
  /**
   * Creates a new HtbPusherSubscription object.
   * @param {string} apiToken - The Pusher Client instance.
   * @param {string} channel - The Pusher Client instance.
   * @param {string} bindEvent - The event trigger to bind to (e.g. 'newmessage')
   * @param {string} csrfToken - The Htb CSRF protection token, used for (primitive) authentication.
   * @returns {HtbPusherSubscription}
   */

  // new HtbPusherSubscription('97608bf7532e6f0fe898', 'owns-channel', 'display-info', token)
  //'97608bf7532e6f0fe898' (Htb pusher api token)
  constructor(apiToken, channel, bindEvent, csrfToken) {
    super()
    this.client = new Pusher(apiToken, {
      authEndpoint: 'https://www.hackthebox.eu/pusher/auth',
      auth: { "X-CSRF-Token": csrfToken },
      authTransport: "ajax",
      cluster: 'eu',
      encrypted: true
    });
    this.channel = this.client.subscribe(channel);
    this.channel.bind(bindEvent,
      (data) => {
        try {
          this.alertSeven(parsePusherEvent(data)) // Pass the parsed message back for processing
        } catch (error) {
          console.error(error)
        }
      }
    );
    this.client.connection.bind('state_change', function (states) {
      console.log("Pusher client state changed from " + states.previous + " to " + states.current);
    });
  }

   /**
   * 
   * @param {*} message 
   */
  alertSeven(message) {
    if (message) {
      this.emit("pusherevent", message);
    }
  };

  /**
   * Updates the CSRF-token based authentication for the Pusher Client.
   * @param {Object} csrfToken - This param should be a token string.
   */
  set auth(csrfToken) {
    try {
      this.client.config.auth['X-CSRF-Token'] = csrfToken
    } catch (error) {
      console.error(error)
    }
  };
}

module.exports = {
  HtbPusherEvent: HtbPusherEvent,
  HtbPusherSubscription: HtbPusherSubscription,
  parsePusherEvent: parsePusherEvent
}