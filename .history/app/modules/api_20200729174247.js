// NOTE::::::::::::::: REMOVE HARDCODED CREDS FROM THIS FILE
const fs = require("fs");
const request = require("superagent");
const Throttle = require("superagent-throttle");

var API_TOKEN = ""

const throttle = new Throttle({
  active: true, // set false to pause queue
  rate: 15, // how many requests can be sent every `ratePer`
  ratePer: 1000, // number of ms in which `rate` requests may be sent
  concurrent: 20, // how many requests can be sent concurrently
});

const varToString = (varObj) => Object.keys(varObj)[0];

function jsonOut(object, name) {
  try {
    objectJson = JSON.stringify(object, null, 4);
    fs.writeFileSync(`${name}.json`, objectJson);
    console.log(`${name}.json`);
    console.log("JSON data is saved.");
  } catch (error) {
    console.error(err);
  }
}


async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const buff = new Buffer.from(base64, "base64");
    const payloadinit = buff.toString("ascii");
    const payload = JSON.parse(payloadinit);
    return payload;
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function getV4Session(email, password) {
  return new Promise((resolve, reject) => {
    const agent = request.agent();
    agent
      .post("https://www.hackthebox.eu/api/v4/login")
      .set({ "Content-Type": "application/json;charset=utf-8" })
      .send({ email: email, password: password, remember: true })
      .then((response) => {
        console.log(
          "Acquired API v4 Session -->\n",
          response.body.message.access_token
        );
        resolve(response.body.message.access_token);
      })
      .catch((err) => {
        console.warn("Could not get session:", err.status);
      });
  });
}

async function htbApiGet(endpointPath, token = this.API_TOKEN) {
  return new Promise((resolve, reject) => {
    const agent = request.agent();
    agent
      .get("https://www.hackthebox.eu/api/v4/" + endpointPath)
      .set({ Accept: "application/json, text/plain, */*" })
      .set({ Authorization: "Bearer " + token })
      .use(throttle.plugin())
      .then((response) => resolve(response.body))
      .catch((err) => {
        console.warn("Could not access '" + endpointPath + "':", err);
        reject(false);
      });
  });
}

async function init(email, password){
	this.API_TOKEN = await getV4Session()
}

async function getMachineTags() {
  const uri = "machine/tags/list";
}

/**
 * MACHINE DATA GETTERS
 */

async function getCurrentMachines() {
  return (await htbApiGet("machine/list", this.API_TOKEN)).info;
}

async function getRetiredMachines() {
  return (await htbApiGet("machine/list/retired", this.API_TOKEN)).info;
}

async function getAllMachines() {
  var retired = await getRetiredMachines();
  var current = await getCurrentMachines();
  return retired.concat(current);
}

/**
 * CHALLENGE DATA GETTERS
 */

async function getCurrentChallenges() {
  return (await htbApiGet("challenge/list", this.API_TOKEN)).challenges;
}

async function getRetiredChallenges() {
  return (await htbApiGet("challenge/list/retired", this.API_TOKEN)).challenges;
}

async function getAllChallenges() {
  var retired = await getRetiredChallenges();
  console.log(retired);
  var current = await getCurrentChallenges();
  return retired.concat(current);
}

/**
 * MEMBER DATA GETTERS
 */

async function getMemberProfile(memberId) {
  const uri = "user/profile/basic/";
  var TEAM_MEMBERS_TEMP = {};
  result = await htbApiGet(uri + memberId, this.API_TOKEN);
  return result.profile;
}

async function getMemberAchievementChart(memberId, term){
  return htbApiGet(`user/profile/graph/${term}/${memberId}`)
}

async function getMemberProfiles(memberIds) {
  const uri = "user/profile/basic/";
  var TEAM_MEMBERS_TEMP = {};
  var memberPromises = [];

  memberIds.forEach((memberId) => {
    memberPromises.push(htbApiGet(uri + memberId, this.API_TOKEN));
  });

  results = await Promise.all(memberPromises);
  results.forEach(
    (memberProfile) =>
      (TEAM_MEMBERS_TEMP[Number(memberProfile.profile.id)] =
        memberProfile.profile)
  );
  return TEAM_MEMBERS_TEMP;
}

async function getMemberActivities(memberIds) {
  const uri = "user/profile/activity/";
  var TEAM_MEMBERS_ACTIVITIES = {};
  var memberPromises = [];
  memberIds.forEach((memberId) => {
    memberPromises.push(htbApiGet(uri + memberId, this.API_TOKEN));
  });
  results = await Promise.all(memberPromises);
  results.forEach(
    (memberProfile, idx) =>
      (TEAM_MEMBERS_ACTIVITIES[Number(memberIds[idx])] =
        memberProfile.profile.activity)
  );
  return TEAM_MEMBERS_ACTIVITIES;
  // results.forEach(memberActivity => TEAM_MEMBERS_ACTIVITIES[Number(memberActivity.profile.id)] = memberActivity.profile)
  // return TEAM_MEMBERS_ACTIVITIES
}

function checkTokenExpiring(token) {
  console.log(new Date(parseJwt(token).exp * 1000));
  console.log(new Date((Math.floor(Date.now() / 1000) - 60) * 1000));
  return parseJwt(token).exp < Math.floor(Date.now() / 1000) - 120
    ? true
    : false; // Returns true if token is valid for at least two more minutes.
  // return (token.exp)
}

async function main() {
  var id = 254747;
  var term = "1Y";


  members = await Promise.all([
    getMemberProfile(254747),
    getMemberProfile(5833),
    getMemberProfile(9267),
    getMemberProfile(73268),
  ]);

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    var chart = await getMemberAchievementChart(member.id, term);
    console.log(await CHART_RENDERER.renderChart(member, chart, term, "userProgress"))
	}
	
	module.exports = {
		getAllChallenges: getAllChallenges,
		getAllMachines: getAllMachines,
		getCurrentChallenges: getCurrentChallenges,
		getCurrentMachines: getCurrentMachines,
		getMachineTags: getMachineTags,
		getMemberAchievementChart: getMemberAchievementChart,
		getMemberActivities: getMemberActivities,
		getMemberProfile:getMemberProfile,
		getMemberProfiles:getMemberProfiles,
		getRetiredChallenges: getRetiredChallenges,
		getRetiredMachines: getRetiredMachines,
		getV4Session: getV4Session,
		htbApiGet: htbApiGet
	}