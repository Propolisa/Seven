/**
 * A module for human-like Discord message sending.
 @module Send
*/

const typoify = require("./nlp/typoify")
const { wait, asyncForEach, Helpers:H  } = require("../helpers/helpers.js")
const { Format: F  } = require("../helpers/format.js")
class Send {

	constructor() {
		this.PASSTHRU = false
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

	passthruOn(){
		if (this.PT_TIMER) {clearTimeout(this.PT_TIMER); delete this.PT_TIMER}
		this.PASSTHRU = this.PASSTHRU || {}
		this.PT_TIMER = setTimeout(function() {this.PASSTHRU = false; console.info("ADMIN::: Passthru turned off automatically after 20 minutes...")}, 1000 * 5 * 60)
		console.warn("ADMIN::: PASSTHROUGH MODE ENABLED.")
	}

	passthruOff(){
		if (this.PT_TIMER) {clearTimeout(this.PT_TIMER); delete this.PT_TIMER}
		this.PASSTHRU = false
		console.warn("ADMIN::: PASSTHROUGH MODE DISABLED.")
	}

	async passthru_register(ogMsg){
		if (this.PASSTHRU){
			if(H.maybe(0.7)) await this.hesitate(ogMsg)
			let dmId = await ogMsg.client.users.cache.get(`${process.env.ADMIN_DISCORD_ID}`).send(`🦜 [${F.STL(ogMsg.author.username + "@" + ogMsg.channel.name, "bs")}]: \`\`\`fix\n` + (ogMsg.content.replace("`","").slice(0,500) || "(No text content)") + "\n```", Array.from(ogMsg.attachments.values())).then(msg => msg.id)
			this.PASSTHRU[dmId] = ogMsg
			console.warn(`Total registered passthru messages: ${Object.keys(this.PASSTHRU || {}).length}`)
		}
	}

	passthru(message){
		let originalMessage = this.PASSTHRU[message.referencedMessage.id]
		let s = message.attachments.size
		console.warn(s)
		if (!originalMessage) {
			return message.reply(`I don't have the original message for <!${message.id}> in cache anymore. Sorry!`)
		}	else {
			if ([`${message.client.user.id}`, originalMessage.author.id].includes(H.sAcc(originalMessage, "channel", "lastMessage", "author", "id"))) {
				if (message.attachments.size) {
					return originalMessage.channel.send(message.content || "\u200b", Array.from(message.attachments.values()))
				} else {
					return this.human(originalMessage, message.content || "\u200b", true)
				}
			} else if (message.content) {
				if (message.attachments.size) {
					return originalMessage.reply(message.content, Array.from(message.attachments.values()))
				} else {
					return this.human(originalMessage, message.content, false)
				}
			}
			
		}
	}

		
	async hesitate(message) {
		message.channel.startTyping()
		await H.wait(Math.random()*1000)
		message.channel.stopTyping(true)
	}

	async human(message, msg, noMention=true) {
		return new Promise(async (resolve) => {
			if (!msg || msg.length == 0 || msg == undefined) {
				msg = " "
			}
			if (this.GET_PICKLED) msg = H.any(F.getPickled(msg),F.getScrambled(msg),F.getSpoiled(msg))
			var msgLines = msg.split("\n")
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
						message.channel.stopTyping(true)
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
						message.channel.stopTyping(true)
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
				message.channel.stopTyping(true)
			})
			resolve()
		})

		//console.log('finished sending message')
	}
	
	async embed(message, content, noMention=true) {
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
		}).then(message.channel.stopTyping(true))
		//console.log('finished sending message')
	}

}


module.exports = {
	Send
}
