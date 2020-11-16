/**
 * Class to generate a binary clock with current time
 */
class BinClock {

	constructor(pool) {this.pool = pool}

	static async genImg(phantomPool){
		return phantomPool.use(async (instance) => {
			const page = await instance.createPage()
			await page.property("viewportSize", {width: 600, height: 300})
			await page.property("zoomFactor", 1.5)
			const status = await page.open("helpers/binclock_src/clock.html", { operation: "GET" })
			if (status !== "success") {
				
				throw new Error("cannot open google.com")
			}
			const content = await new Promise(function(resolve) { 
				setTimeout(function () {
					console.log("waited...")
					resolve(page.renderBase64("PNG"))
				}, 0)
			}
			)
			return {content:content, instance:instance}
		}).then((output) => {
			output.instance.exit().then(console.log("Phantom instance exited to free resources.."))
			console.log("Phantom generated a time image. Returning..")
			return new Buffer.from(output.content, "base64")
		})
	}
}

module.exports = {BinClock}