/**
 * Class to generate a binary clock with current time
 */

const { readFileSync } = require("fs")
const puppeteer = require("puppeteer")
var contentHtml = readFileSync("./helpers/binclock_src/clock.html", "utf8")

async function generateBinaryClockImage(){
	const browser = await puppeteer.launch({
		executablePath: "/usr/bin/chromium-browser",
		headless: process.env.NODE_ENV === "chartdev" ? false : true,
		devtools: process.env.NODE_ENV === "chartdev" ? true : false,
		args: [
		// Required for Docker version of Puppeteer
			"--no-sandbox",
			"--disable-setuid-sandbox",
			// This will write shared memory files into /tmp instead of /dev/shm,
			// because Docker’s default for /dev/shm is 64MB
			"--disable-dev-shm-usage"
		],
	})
	try {	
		const page = await browser.newPage()
		await page.setContent(contentHtml)
		await page.setViewport({
			width: 600,
			height: 300,
			deviceScaleFactor: 2,
		})
		
		const containerElem = await page.$("#screenshot")
		if (containerElem === null) {
			await browser.close()
			throw new Error("No screenshot element exists")
		} else {
			await browser.close()
			return await containerElem.screenshot({ encoding: "base64" })
		}
	} catch (error) {
		await browser.close()
	}
}

module.exports = {generateBinaryClockImage}