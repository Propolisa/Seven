const { Helpers: H } = require("../helpers/helpers.js")

class SevenApiConnector {

	constructor(ds) {
		this.auth = { token: null }
		this.ds = ds
	}

	getConfig(req, res) {
		res.status(200).json(process.env)
	}

	getDatastore(req, res) {
		const path = JSON.parse(req.query.path)
		if (path && path.length) { // Is a nested address
			if (Array.isArray(path)) {
				res.status(200).json(H.sAcc(this.ds, ...path))
			} else { // Is a single string
				res.status(200).json(H.sAcc(this.ds, [path]))
			}

		} else {
			res.status(200).json(this.ds)
		}

	}
	setDatastore(req, res) {
		try {
			const path = JSON.parse(req.query.path)
			const value = JSON.parse(req.body)
			if (Array.isArray(path)) {
				H.sSet(this.ds, ...path)
				res.status(200).json({ message: "Success" })
			}
		} catch (error) {
			res.status(501).json({ error: "Couldn't set value." })
		}

	}

}

module.exports = { SevenApiConnector }