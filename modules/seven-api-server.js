const express = require("express")
const {SevenApiConnector: q} = require("./seven-api-connector")

class SevenApiServer {

	constructor(dataStore, servePort) {
		this.q = new q(dataStore)
		this.app = express()
		this.port = servePort

		this.app.use(express.json())
		this.app.use(
			express.urlencoded({
				extended: true,
			})
		)

		this.app.get("/", (request, response) => {
			response.json({ info: "Node.js, Express, and Postgres API" })
		})

		this.app.get("/config", this.q.getConfig.bind(this.q))
		this.app.get("/datastore", this.q.getDatastore.bind(this.q))

		this.app.listen(this.port, "localhost", () => {
			console.info(`Seven API server is running on localhost:${this.port}.`)
		})

	}

}

module.exports = { SevenApiServer }