const { v4: uuidv4 } = require("uuid")
const { Helpers: H } = require("../helpers/helpers.js")

class SevenApiConnector {

	constructor(ds) {
		this.auth = {token:null}
		this.ds = ds
	}
	
	getConfig(req, res) {
		res.status(200).json(process.env)
	}

	getDatastore(req, res) {
		const path = JSON.parse(req.query.path)
		if (path && path.length) {
			res.status(200).json(H.sAcc(this.ds, ...path))
		}
	}

}

module.exports = { SevenApiConnector }