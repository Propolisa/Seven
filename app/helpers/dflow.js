const LH = "DialogFlow:::"

// Loads in our node.js client library which we will use to make API calls.
const dialogflow = require("dialogflow")
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
const entitiesClient = new dialogflow.EntityTypesClient({
	credentials: credentials,
})

const projectId = process.env.GOOGLE_CLOUD_PROJECT
const agentPath = entitiesClient.projectAgentPath(projectId)

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
						console.log(target)
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
	addMissingFieldsToEntity: updateEntity
}
