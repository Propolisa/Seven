const { Format: F } = require("../../helpers/format")

function calcStartDateFromTerm(term){
	const SEC = 1000
	const MIN = 60 * SEC
	const HR = 60 * MIN
	const DY = 24 * HR
	const WK = 7 * DY
	const MO = 7 * DY
	const YR = 365 * DY

	switch (term) {
	case "1W": return new Date(new Date().getTime() - WK).getTime()
	case "1M": return new Date(new Date().getTime() - MO).getTime()
	case "3M": return new Date(new Date().getTime() - (3 * MO)).getTime()
	case "6M": return new Date(new Date().getTime() - (6 * MO)).getTime()
	case "1Y": return new Date(new Date().getTime() - YR).getTime()
	default: return null
	}
}

function termToPeriod(term){
	switch (term) {
	case "1W": return {unit:"day", interval:null}
	case "1M": return {unit:"day", interval:"7"}
	case "3M": return {unit:"day", interval:"7"}
	case "6M": return {unit:"month", interval:null}
	case "1Y": return {unit:"month", interval:null}
	default: return null
	}
}

function genChart(name, type, term, series=false, dateRange=null){
	var options = {}
	switch (type) {
	case "userProgress":
		options = {
			chart: {
				plotBackgroundColor: "#111927",
				plotBorderRadius: 16,
				plotBorderWidth:1,
				plotShadow: true,
				plotBorderColor: "#95A2BF",
				borderColor: "#95A2BF",
				borderWidth: 1,
				borderRadius: 12,
				spacing: 24,
				type: "spline",
				backgroundColor: "#1A2332",
				width: 640,
				height: 480,
			},
			legend: {
				useHTML: true,
				align: "center",
				itemStyle: {
					color: "#A4B1CD",
					fontFamily: "Arial, sans-serif",
					fontWeight: 500,
					fontSize: "13px"
				},
				verticalAlign: "top",
				layout: "horizontal",
				x: 0,
				y: 0,
				margin: 5,
				symbolPadding: 10,
				squareSymbol: false,
				symbolHeight: 10,
				symbolWidth: 10,
				symbolRadius: 1,
				itemMarginBottom: 20,
			},
			title: { text: `${name} [${term}]`, style: {"color": "#FFFFFF", "fontSize": "16px", "fontWeight": "bold"} },
			credits: { enabled: false },
			exporting: { enabled: false },
			xAxis: {
				type: "datetime",
				tickInterval: null,
				lineColor: "#1A2332",
				tickColor: "#1A2332",
				gridLineColor: "#778199",
				gridLineWidth: 1,
				// dateTimeLabelFormats: { month: "%b" },
				labels: {
					y: 50,
					style: {
						color: "#A4B1CD",
						textTransform: "uppercase",
						fontWeight: 600,
						fontFamily: "Arial, sans-serif",
						letterSpacing: "1px",
						fontSize: "10px",
					},
				},
			},
			yAxis: {
				gridLineColor: "#778199",
				gridLineWidth: 1,
				title: { text: null },
				labels: {
					style: {
						color: "#A4B1CD",
						letterSpacing: "1px",
						fontSize: "14px",
						fontWeight: 600,
					},
				},
			},
			plotOptions: {
				series: {
					pointStart: calcStartDateFromTerm(term),
					pointInterval: termToPeriod(term).interval,
					pointIntervalUnit: termToPeriod(term).unit
				},
			},
			responsive: { rules: [{ condition: { minHeight: "340px" } }] },
			series: [
				{
					name: "User Owns",
					data: [],
					color: "#FFAF00",
					lineWidth: 1,
					marker: { symbol: "circle" },
				},
				{
					name: "System Owns",
					data: [],
					color: "#0086FF",
					lineWidth: 1,
					marker: { symbol: "circle" },
				},
				{
					name: "Challenge Owns",
					data: [],
					color: "#9FEF00",
					lineWidth: 1,
					marker: { symbol: "circle" },
				},
				{
					name: "First Bloods",
					data: [],
					color: "#FF2548",
					lineWidth: 1,
					marker: { symbol: "circle" },
				},
				{
					name: "Respect",
					data: [],
					color: "#986CE8",
					lineWidth: 1,
					marker: { symbol: "circle" },
				},
			],
			tooltip: {
				useHTML: true,
				headerFormat: "",
				backgroundColor: "rgba(26, 35, 50, 1)",
				borderWidth: 0,
				padding: 24,
				style: {
					color: "rgba(164, 177, 205)",
					letterSpacing: "1px",
					fontSize: "10px",
					fontWeight: 600,
				},
			},
		}
		break
	case "userActivity":
		options = {
			chart: {
				plotBackgroundColor: "#111927",
				plotBorderRadius: 16,
				plotBorderWidth:1,
				plotShadow: true,
				plotBorderColor: "#95A2BF",
				borderColor: "#95A2BF",
				borderWidth: 1,
				borderRadius: 12,
				spacing: 24,
				type: "spline",
				backgroundColor: "#1A2332",
				width: 600,
				height: 280,
			},
			legend: {
				useHTML: true,
				align: "center",
				itemStyle: {
					color: "#A4B1CD",
					fontFamily: "Arial, sans-serif",
					fontWeight: 500,
					fontSize: "13px"
				},
				verticalAlign: "top",
				layout: "horizontal",
				x: 0,
				y: 0,
				margin: 5,
				symbolPadding: 10,
				squareSymbol: false,
				symbolHeight: 10,
				symbolWidth: 10,
				symbolRadius: 1,
				itemMarginBottom: 20,
			},
			title: { text: `${name} owns [${F.stdDate(new Date(Date.parse(dateRange.oldest)))} - ${F.stdDate(new Date(Date.parse(dateRange.latest)))}]`, style: {"color": "#FFFFFF", "fontSize": "16px", "fontWeight": "bold"} },
			credits: { enabled: false },
			exporting: { enabled: false },
			xAxis: {
				type: "datetime",
				tickInterval: null,
				lineColor: "#1A2332",
				tickColor: "#1A2332",
				gridLineColor: "#778199",
				gridLineWidth: 1,
				// dateTimeLabelFormats: { month: "%b" },
				labels: {
					y: 50,
					style: {
						color: "#A4B1CD",
						textTransform: "uppercase",
						fontWeight: 600,
						fontFamily: "Arial, sans-serif",
						letterSpacing: "1px",
						fontSize: "10px",
					},
				},
			},
			yAxis: {
				gridLineColor: "#778199",
				gridLineWidth: 1,
				title: { text: null },
				labels: {
					style: {
						color: "#A4B1CD",
						letterSpacing: "1px",
						fontSize: "14px",
						fontWeight: 600,
					},
				},
			},
			responsive: { rules: [{ condition: { minHeight: "340px" } }] },
			series: [
				{
					name: "User",
					data: [],
					color: "#FFAF00",
					lineWidth: 1,
					marker: { symbol: "circle" },
				},
				{
					name: "Root",
					data: [],
					color: "#0086FF",
					lineWidth: 3,
					marker: { symbol: "circle" },
				},
				{
					name: "Challenge",
					data: [],
					color: "#9FEF00",
					lineWidth: 2,
					marker: { symbol: "circle" },
				},
				{
					name: "Endgame",
					data: [],
					color: "#FF2548",
					lineWidth: 2,
					marker: { symbol: "circle" },
				},
				{
					name: "Fortress",
					data: [],
					color: "#986CE8",
					lineWidth: 2,
					marker: { symbol: "circle" },
				},
				// {
				// 	name: "Pro Lab",
				// 	data: [],
				// 	color: F.COL.AQUAMARINE,
				// 	lineWidth: 1,
				// 	marker: { symbol: "circle" },
				// },
			],
			tooltip: {
				useHTML: true,
				headerFormat: "",
				backgroundColor: "rgba(26, 35, 50, 1)",
				borderWidth: 0,
				padding: 24,
				style: {
					color: "rgba(164, 177, 205)",
					letterSpacing: "1px",
					fontSize: "10px",
					fontWeight: 600,
				},
			},
		}
		
		break
	
	default:
		break
	}
	
	if (series){
		series.forEach(
			(e, idx) => (options.series[idx].data = e)
		)
	}
	console.log(">> Highcharts: Graph generated successfully")
	return options
}

module.exports = {
	genChart: genChart
}