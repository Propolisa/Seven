const LH = "DialogFlow:::"
const fs = require("fs").promises
const ZIP = require("adm-zip")
const zTools = require("../helpers/zip-tools")


/**
 * Loads Google's DialogFlow client library which we will use to make API calls.
 * */
 
const dialogflow = require("@google-cloud/dialogflow").v2beta1
const { agent } = require("superagent")
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}")
const entitiesClient = new dialogflow.EntityTypesClient({
	credentials: credentials,
})

const agentsClient = new dialogflow.AgentsClient({
	credentials: credentials, 
})

const projectId = process.env.GOOGLE_CLOUD_PROJECT
const agentPath = entitiesClient.projectAgentPath(projectId)


function checkAgentExists(){
	return agentsClient.getAgent({parent:`projects/${projectId}/locations/global`})
		.then(res => {
			if (res.find(e => e.parent == `projects/${projectId}`)) {
				// console.log("Agent exists!")
				return true
			} else {
				console.log("Agent not found.")
				return false
			}
		})
		.catch(err => {
			console.error((err.code == 5? "ERROR: Agent was not found (does not exist yet)." : err))
			return false
		})
}

function agentIsEmpty(){
	return entitiesClient
		.listEntityTypes({parent: agentPath})
		.then((responses) => {
			const entities = responses[0]
			// If there are some entities, this isn't an an empty (unconfigured) agent
			if (entities.length) {return false}
			// No entities found, so probably an empty (unconfigured) agent.
			return true
		})
}
// Import the Seven agent. See: https://googleapis.dev/nodejs/dialogflow/latest/v2beta1.AgentsClient.html#importAgent
function importAgentZip(sourcePath){
	return fs.readFile(sourcePath || "static/dflow/agent-latest.zip")
		.then(res => agentsClient.restoreAgent({parent:`projects/${projectId}`,agentContent:res})
			.then(() => {
				console.log("[DFLOW AGENT SYNC]::: Agent was successfully pushed to Dialogflow from backup.\n"+
										"                      NOTE: Agent training may take a minute or two. Please be patient...")
			})
		)
}

function unpackAndAnonymizeTeamData(buffer){
	return new Promise((resolve, reject) => {
		if (buffer) {
			var zip = new ZIP(buffer)
			var zipEntries = zip.getEntries()
			var memberNameEntry = zipEntries.find(zipEntry => zipEntry.entryName == "entities/memberName_entries_en.json")
			var origLength = 0
			if (memberNameEntry) {
				origLength = memberNameEntry.getData().toString("utf8").length
				return fs.readFile("research/templates/memberName_entries_en.json")
					.then(res => {
						zip.updateFile(memberNameEntry, res)
						zip.extractAllToAsync("./cache/agent-latest", true, function (e) {
							console.warn(`[AGENT EXPORT]::: Team Member JSON entity patched: ${origLength}B --> ${memberNameEntry.getData().toString("utf8").length}B`)
							resolve()
						})
					})
			} else {
				reject("[AGENT EXPORT]::: Incomplete agent detected. Discontinuing export...")
			}
		} else {reject("[AGENT EXPORT]::: No agent was found.")}
	})
}

/**
 * (DEV USE ONLY) Download the latest version of the Seven DialogFlow agent, stripping team-specific data from entities.
 * Used only on master branch to keep the latest DFlow agent available on GitHub for third-party deployments.
 */
function syncAgentUpstream(){
	return checkAgentExists().then(exists => {
		if (exists) {
			console.warn("[AGENT EXPORT]::: Agent download job started...")
			return agentsClient.exportAgent({parent: `projects/${projectId}/locations/global`, agentUri: null})
				.then(res => {
					console.warn(`[AGENT EXPORT]::: Got agent data as bytes (${res[0].result.agentContent.length}).`)
					return unpackAndAnonymizeTeamData(res[0].result.agentContent).then(r => {zTools.zipFolder("cache/agent-latest/","static/dflow/agent-latest.zip")})
				})
				.then(() => {
					console.warn("[AGENT EXPORT]::: Agent zip file ('agent_latest.zip') being updated now.")
				})
				.catch(err => {
					console.error(err)
				})
		} else {
			console.error("No agent has been linked to this project. Please create one via DialogFlow web console.")
		}
	}).catch(err => console.warn("Agent didn't exist.", err))
}

/**
 * (PRODUCTION USE) Ensures the agent project exists; if so, determines if it is only a skeleton (just-deployed) 
 * and if so, pushes the latest pulled version to DialogFlow from the local backup / repo zip.
 */
function syncAgentDownstream(){
	return checkAgentExists().then(exists => {
		if (exists) {
			console.warn("[DFLOW AGENT SYNC]::: Project exists and is linked to your provided key (awesome!).")
			return agentIsEmpty().then(empty => {
				console.warn(empty ? "[DFLOW AGENT SYNC]::: Agent is empty." : "[DFLOW AGENT SYNC]::: Agent is not empty. NO SYNC NEEDED...")
				var ret = (empty ? importAgentZip("static/dflow/agent-latest.zip") : null)
				return ret
			})
		} else {
			console.error("[DFLOW AGENT SYNC]::: ERROR: No agent has been linked to this project. Please create one via DialogFlow web console.")
		}
	}).catch(err => console.warn(err))
}


function addSingleEntity(displayName, newFieldName){

	class EntityNotFoundError extends Error {}

	entitiesClient
	// Tell client library to call Dialogflow with a request to
	// list all EntityTypes.
		.listEntityTypes({parent: agentPath})
	// Go through all EntityTypes and find the one we wish to update
	// (in this case, the EntityType named 'city').
		.then((responses) => {
			// The array of EntityTypes is the 0th element of the response.
			const resources = responses[0]
			// Loop through and find the EntityType we wish to update.
			var existingEntity = resources.find(entity => entity.displayName === displayName)
			if (existingEntity) {return existingEntity}
			// If we couldn't find the expected entity, throw a custom error.
			throw new EntityNotFoundError()
		})
	// Update the city EntityType with a new list of Entities.
		.then((entity) => {
			//console.log(`Found ${displayName}: `, JSON.stringify(field));
			var newField = {"value": newFieldName, "synonyms": [newFieldName]}
			entity.entities.push(newField)
			// Replace the EntityType's existing Entities with our new list.
			//city.entities = updatedEntityList;

			const request = {
				entityType: entity,
				// Tell the API to only modify the 'entities' field, not any other
				// fields of the EntityType.
				updateMask: {
					paths: ["entities"],
				},
			}
			// Tell Dialogflow to update the EntityType.
			return entitiesClient.updateEntityType(request)
		})
	// Log the updated EntityType.
		.then((responses) => {
			//console.log('Updated entity type:', JSON.stringify(responses[0]));
		})
	// Catch any errors.
		.catch((err) => {
			// If this is the error we throw earlier in the chain, log the
			// cause of the problem.
			if (err instanceof EntityNotFoundError) {
				console.error("Could not find the entity named " + displayName + ".")
				return
			}
			console.error("Error updating entity type:", err)
		})
}

/**
 * 
 * @param {Entity[]} fieldMap An array of EntityType objects (containing )
 */
function updateEntity(fields, entityTypeName){
	var needsUpdate = false
	class EntityNotFoundError extends Error {} entitiesClient
	// Tell client library to call Dialogflow with a request to
	// list all EntityTypes.
		.listEntityTypes({parent: agentPath})
	// Go through all EntityTypes and find the one we wish to update
	// (in this case, the EntityType named 'city').
		.then((responses) => {
			// The array of EntityTypes is the 0th element of the response.
			const resources = responses[0]
			// Loop through and find the EntityType we wish to update.
			var existingEntityType = resources.find(entity => entity.displayName === entityTypeName)
			if (existingEntityType) {return existingEntityType}
			// If we couldn't find the expected entity, throw a custom error.
			throw new EntityNotFoundError()
		})
	// Update the city EntityType with a new list of Entities.
		.then(existingEntity => {
			// console.dir(existingEntityType)
			var newEntries = []
			fields.forEach(field => {
				if (!(existingEntity.entities.some( entity => (typeof field === "object" ? field["value"] : field) == entity.value ))){
					needsUpdate = true
					console.warn(`Field ${field} did not exist.`)
					if (typeof field === "object"){
						existingEntity.entities.push(field)
						newEntries.push(field.synonyms)
					} else {
						existingEntity.entities.push({synonyms:[field], value: field})
						newEntries.push(field)
					}
				} else {
					// console.warn(`Field ${field} exists already.`)
					if (typeof field === "object"){
						var target = existingEntity.entities.find(e => e.value == field.value)
						const origCount = target.synonyms.length
						target.synonyms = [...new Set([].concat(target.synonyms,field.synonyms))]
						newEntries.push(field.synonyms)
						// console.log(target)
						if (origCount < target.synonyms.length){
							needsUpdate = true
						}
					} 					
				}
			})
			// Replace the EntityType's existing Entities with our new list.
			//city.entities = updatedEntityList;

			const request = {
				entityType: existingEntity,
				// Tell the API to only modify the 'entities' field, not any other
				// fields of the EntityType.
				updateMask: {
					paths: ["entities"],
				},
			}
			// Tell Dialogflow to update the EntityType.
			if (needsUpdate) {
				entitiesClient.updateEntityType(request)
				return newEntries
			} else {
				return null
			}
		})
	// Log the updated EntityType.
		.then((updatedFields) => {
			if (!updatedFields){
				console.warn(`${LH} Entity ${entityTypeName} did not need to be updated (no new entries).`)
			} else {
				console.info(`${LH} Updated entity type '${entityTypeName}', affecting ${updatedFields.length} ${(updatedFields.length == 1 ? "field" : "fields")}: '${updatedFields.join("', '")}'`)
			}
		})
	// Catch any errors.
		.catch((err) => {
			// If this is the error we throw earlier in the chain, log the
			// cause of the problem.
			if (err instanceof EntityNotFoundError) {
				console.error(`${LH} Could not find the entity named ${entityTypeName}.`)
				return
			}
			console.error(`${LH} Error updating entity type '${entityTypeName}':`, err)
		})
}





/** Define a custom error object to help control flow in our Promise chain. */
module.exports = {
	addSingleEntity: addSingleEntity,
	addMissingFieldsToEntity: updateEntity,
	syncAgentDownstream,
	syncAgentUpstream
}
