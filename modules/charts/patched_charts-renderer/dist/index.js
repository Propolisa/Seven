"use strict"

Object.defineProperty(exports, "__esModule", {
	value: true
})

function _interopDefault(ex) {
	return (ex && (typeof ex === "object") && "default" in ex) ? ex["default"] : ex
}

var puppeteer = require("puppeteer")
var path = _interopDefault(require("path"))
var serialize = _interopDefault(require("serialize-javascript"))

// TODO: remove render function?
async function render(exporter, options) {
	let res
	for await (const result of iterableRender(exporter, options)) {
		res = result
	}
	return res
}
async function* iterableRender(exporter, options) {
	const browser = await puppeteer.launch({
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
	const page = await browser.newPage()
	// globally init page
	await page.setViewport({
		width: options.init.width,
		height: options.init.height,
		deviceScaleFactor: 1,
	})
	const renderIteration = async (chartOptions) => {
		if (chartOptions.preRenderCb !== void 0) {
			chartOptions.preRenderCb(page)
		}
		try {
			return await exporter.render(page, chartOptions, options.init)
		} catch (err) {
			console.error("Error throwed while rendering chart", err)
		}
		if (chartOptions.postRenderCb !== void 0) {
			chartOptions.postRenderCb(page)
		}
	}
	if (typeof exporter.init === "function") {
		await exporter.init(page, options.init)
	}
	if (typeof options.init.cb === "function") {
		await options.init.cb(page)
	}
	if (options.charts instanceof Array) {
		for (const chartOptions of options.charts) {
			yield renderIteration(chartOptions)
		}
	} else {
		yield renderIteration(options.charts)
	}
	if (process.env.NODE_ENV !== "chartdev") {
		await browser.close()
	}
	return true
}

const modulePath = path.dirname(require.resolve("highcharts"))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
// TODO: solve mangle issue more elegantly
async function init(page, init) {
	await page.addScriptTag({
		path: init.highstock === true ?
			modulePath + "/highstock.js" :
			modulePath + "/highcharts.js"
	})
	// create main element
	if ("containerSelector" in init === false) {
		await page.setContent("<div id=\"container\"></div>")
	}
	// disable features needed for interactive usage
	await page.evaluate(new AsyncFunction(`
    Highcharts.setOptions({
      plotOptions: {
        series: {
          animation: false
        }
      }
    });
  `))
}
async function render$1(page, options, init) {
	const containerSelector = init.containerSelector || "#container"
	const screenshotSelector = init.screenshotSelector || ".highcharts-container"
	await page.evaluate(new AsyncFunction("serializedConfig", "containerSelector", `
    function deserialize(v) {
      return eval('(' + v + ')');
    }

    const renderTo = document.querySelector(containerSelector);
    const config = deserialize(serializedConfig);
    Highcharts.chart(renderTo, config);
  `), serialize(options.config), containerSelector)
	const containerElem = await page.$(screenshotSelector)
	if (containerElem === null) {
		throw new Error("No screenshot element exists")
	}
	if (init.pdf === true) {
		return await page.pdf({
			...options.file,
		})
	} else {
		return await containerElem.screenshot({
			omitBackground: true,
			...options.file,
		})
	}
}
var highcharts = {
	render: render$1,
	init,
}

const modulePath$1 = path.dirname(require.resolve("chart.js"))
const AsyncFunction$1 = Object.getPrototypeOf(async function () {}).constructor
// TODO: solve mangle issue more elegantly
async function init$1(page) {
	await page.addScriptTag({
		path: modulePath$1 + "/Chart.min.js",
	})
	// create main element
	await page.setContent("<canvas id=\"container\"></canvas>")
	// disable features needed for interactive usage
	await page.evaluate(new AsyncFunction$1(`
    Object.assign(Chart.defaults.global, {
      animation: false,
      responsive: false,
    });
  `))
}
async function render$2(page, options, init) {
	const containerElem = await page.$("#container")
	if (containerElem === null) {
		throw new Error("No container element exists")
	}
	await page.evaluate(new AsyncFunction$1("chart", "width", "height", `
    const ctx = document.getElementById('container');
    ctx.width = width;
    ctx.height = height;
    new Chart(ctx, chart);
  `), options.config, options.chartWidth || init.width, options.chartHeight || init.height)
	if (init.pdf === true) {
		return await page.pdf({
			...options.file,
		})
	} else {
		return await containerElem.screenshot({
			omitBackground: true,
			...options.file,
		})
	}
}
var chartjs = {
	render: render$2,
	init: init$1,
}

var index = /*#__PURE__*/ Object.freeze({
	__proto__: null,
	highcharts: highcharts,
	chartjs: chartjs
})

exports.exporters = index
exports.iterableRender = iterableRender
exports.render = render