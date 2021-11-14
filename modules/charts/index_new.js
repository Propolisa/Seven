const {
	render,
	exporters
} = require("./patched_charts-renderer/dist/index.js")
const htbCharts = require("./htbCharts.js")

async function renderChart(member, chart, term, type, series, dateRange = null) {
	console.warn("Rendering chart with 'charts-rendering' module.")
	let config = {}
	switch (type) {
	case "userProgress":
		config = {
			type: "png",
			options: htbCharts.genChart(member.name, "userProgress", term)
		}
		Object.values(chart.profile.graphData).forEach((e, idx) => (config.options.series[idx].data = e))
		break
	case "userActivity":
		config = {
			type: "png",
			options: htbCharts.genChart(member.name, "userActivity", null, series, dateRange)
		}
		break
	default:
		break
	}
	return await render(exporters.highcharts, {
		init: {
			width: 1000,
			height: 1000,
		},
		charts: [{
			file: {
				encoding: "base64"
			},
			config: config.options,
		}, ],
	})
}

module.exports = {
	renderChart
}