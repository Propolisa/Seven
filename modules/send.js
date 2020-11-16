/**
 * A module for human-like Discord message sending.
 @module Send
*/

const typoify = require("./nlp/typoify")
const { wait, asyncForEach, Helpers:H  } = require("../helpers/helpers.js")
const { Format: F  } = require("../helpers/format.js")
class Send {

	constructor() {
		this.GET_PICKLED = false
		this.KEYSTROKE_TIME = 18
	}

	pickleOn(){
		this.GET_PICKLED = true
		setTimeout(function() {this.GET_PICKLED = false; console.info("Pickle mode turned off automatically after 5 minutes...")}, 1000 * 5 * 60)
	}

	pickleOff(){
		this.GET_PICKLED = false
	}

	async human(message, msg, noMention) {
		return new Promise(async (resolve) => {
			if (!msg || msg.length == 0 || msg == undefined) {
				msg = " "
			}
			if (this.GET_PICKLED) msg = H.any(F.getPickled(msg),F.getScrambled(msg),F.getSpoiled(msg))
			var msgLines = msg.split("\\n")
			var firstline = noMention ? false : true
	
			await asyncForEach(msgLines, async (ln) => {
				message.channel.startTyping()
				//console.log(ln)
				if (Math.random() < 0.05) {
					// random chance we'll try to generate a typo
					var typoData = typoify.typo(ln)
					if (typoData) {
						// console.log(typoData)
						message.channel.startTyping()
						await wait(
							Math.min(ln.length * 2 * (Math.random() * 100 + this.KEYSTROKE_TIME), 2000)
						)
						await message.reply(ln.replace(typoData[0], typoData[1]))
						message.channel.stopTyping()
						await wait(150)
						message.channel.startTyping()
						await wait(150)
						await wait(
							200 + (Math.min(typoData[0].length * this.KEYSTROKE_TIME), 600)
						)
						if (firstline) {
							await message.reply((Math.random() > 0.5 ? "*" : "") + typoData[0])
						} else {
							await message.channel.send(
								(Math.random() > 0.5 ? "*" : "") + typoData[0]
							)
						}
					} else {
						message.channel.startTyping()
						await wait(Math.min(250 + (ln.length * this.KEYSTROKE_TIME), 1200))
						if (firstline) {
							await message.reply(ln)
						} else {
							await message.channel.send(ln)
						}
						message.channel.stopTyping()
					}
				} else {
					await wait(
						Math.min(500 + ln.length * (Math.random() * 50 + this.KEYSTROKE_TIME), 800)
					)
					if (firstline) {
						await message.reply(ln)
					} else {
						await message.channel.send(ln)
					}
					firstline = false
				}
				message.channel.stopTyping()
			})
			resolve()
		})
		//console.log('finished sending message')
	}
	
	async embed(message, content, noMention) {
		// console.log(content)
		return new Promise(resolve => {
			if (Array.isArray(content)) {
				// We're looking at multiple embed objects here. Let's send them in order.
				asyncForEach(content, async (embed) => {
					if (noMention){ await message.channel.send(embed) }
					else { await message.reply(embed)}
				})
				resolve()
			} else {
				if (noMention){ message.channel.send(content) }
				else { message.reply(content)}
			}
		}).then(message.channel.stopTyping())
		//console.log('finished sending message')
	}

}


module.exports = {
	Send
}
