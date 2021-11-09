const htbCharts = require("./htbCharts.js")

function renderChart(member, chart, term, type, series, dateRange=null) {
	console.warn("rendering chart")
	var config = {}
	return new Promise((resolve) => {
		switch (type) {
		case "userProgress":
			config = {type: "png",	options: htbCharts.genChart(member.name, "userProgress", term)}
			Object.values(chart.profile.graphData).forEach(	(e, idx) => (config.options.series[idx].data = e)	); break
		case "userActivity":
			config = {type: "png",	options: htbCharts.genChart(member.name, "userActivity", null, series, dateRange)}; break
		default:break
		}
		
		this.export(config, function (err, res) {
			console.log(
				`Printing ${type} chart for member ${member.name} completed..`
			)
			resolve(res.data)
			// require("fs").writeFile(`chart${idx}.png`, res.data, "base64", function (err) {});
		})
	})
}

function newChartRenderer() {
	const exporter = require("highcharts-export-server")
	exporter.logLevel(4)
	exporter.initPool({ initialWorkers: 1, maxWorkers: 4 })
	exporter.renderChart = renderChart
	return exporter
}

module.exports = {
	newChartRenderer: newChartRenderer
}