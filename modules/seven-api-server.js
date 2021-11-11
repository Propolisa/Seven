const express = require("express")
const crypto = require("crypto")

const {
	SevenApiConnector: q
} = require("./seven-api-connector")

var session = require("express-session"),
	passport = require("passport"),
	Strategy = require("passport-discord").Strategy

passport.serializeUser(function (user, done) {
	done(null, user)
})
passport.deserializeUser(function (obj, done) {
	done(null, obj)
})

var scopes = ["identify"]
var prompt = "consent"

passport.use(new Strategy({
	clientID: process.env.API_SERVER_DISCORD_CLIENT_ID,
	clientSecret: process.env.API_SERVER_DISCORD_CLIENT_SECRET,
	callbackURL: "http://localhost:666/callback",
	scope: scopes,
	prompt: prompt
}, function (accessToken, refreshToken, profile, done) {
	process.nextTick(function () {
		return done(null, profile)
	})
}))

function checkAuth(req, res, next) {
	if (req.isAuthenticated() &&
		req?.user?.id && process.env.ADMIN_DISCORD_IDS.includes(req?.user?.id)
	) return next()
	if (req.isAuthenticated()) {
		res.status(403).send("Your powers are insufficient here.")
	} else {
		res.status(401).send("You are not authenticated.")
	}
}



class SevenApiServer {

	constructor(dataStore, servePort) {
		this.q = new q(dataStore)
		let app = express()
		this.port = servePort

		app.use(express.json())
		app.use(
			express.urlencoded({
				extended: true,
			})
		)
			
		app.use(session({
			secret: crypto.randomBytes(32).toString("hex"),
			resave: false,
			saveUninitialized: false
		}))

		app.use(passport.initialize())
		app.use(passport.session())
		app.use((req, res, next) => {
			res.header("Access-Control-Allow-Origin", "http://localhost:8080") // only_one_url_here');
			res.header("Access-Control-Allow-Headers", "Content-Type, POST, GET, OPTIONS, DELETE")
			res.header("Access-Control-Allow-Credentials", true)
			next()
		})
		app.get("/callback",
			passport.authenticate("discord", {
				failureRedirect: "/"
			}),
			function (req, res) {
				res.redirect("http://localhost:8080")
			} // auth success
		)
		app.get("/logout", function (req, res) {
			req.logout()
			res.redirect("/")
		})
		app.get("/info", checkAuth, function (req, res) {
			//console.log(req.user)
			res.json(req.user)
		})

		app.get("/", passport.authenticate("discord", {
			scope: scopes,
			prompt: prompt
		}), (request, response) => {
			response.json({
				info: "Node.js, Express, and Postgres API"
			})
		})

		app.get("/config", checkAuth, this.q.getConfig.bind(this.q))
		app.get("/datastore", checkAuth, this.q.getDatastore.bind(this.q))

		app.listen(this.port, "localhost", () => {
			console.info(`Seven API server is running on localhost:${this.port}.`)
		})
		this.app = app // Store on class instance
	}
}

module.exports = {
	SevenApiServer
}