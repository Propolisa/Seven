/**
 * A module for proxying incoming requests from the Heroku web process to the worker process.
 * Not relevant for other deployment types.
 @module HerokuDualstackProxy
*/

if (!process.env.HEROKU) {
	require("dotenv").config({ path: "../config/.env" })
}

var proxy = require("express-http-proxy")
var app = require("express")()

app.use("/", proxy("http://localhost:666"), (req, res)=> console.log(req))

app.listen(process.env.PORT, "0.0.0.0", () => {
	console.info(`[HEROKU]::: Web worker facing proxy server is running on 0.0.0.0:${process.env.PORT}.`)
})