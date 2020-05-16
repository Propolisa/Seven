'use strict';

// Loads in our node.js client library which we will use to make API calls.
const dialogflow = require('dialogflow');
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS)
const entitiesClient = new dialogflow.EntityTypesClient({
  credentials: credentials,
});

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const agentPath = entitiesClient.projectAgentPath(projectId);

function updateEntity(displayName, newFieldName){

  class EntityNotFoundError extends Error {};

entitiesClient
// Tell client library to call Dialogflow with a request to
// list all EntityTypes.
    .listEntityTypes({parent: agentPath})
// Go through all EntityTypes and find the one we wish to update
// (in this case, the EntityType named 'city').
    .then((responses) => {
    // The array of EntityTypes is the 0th element of the response.
      const resources = responses[0];
      // Loop through and find the EntityType we wish to update.
      for (let i = 0; i < resources.length; i++) {
        const entity = resources[i];
        if (entity.displayName === displayName) {
          return entity;
        }
      }
      // If we couldn't find the expected entity, throw a custom error.
      throw new EntityNotFoundError();
    })
// Update the city EntityType with a new list of Entities.
    .then((entity) => {
      //console.log('Found city: ', JSON.stringify(field));
      // These Entities are hardcoded, but we could easily query
      // this data from a database or API call.
      var newField = {"value": newFieldName, "synonyms": [newFieldName]}
      entity.entities.push(newField)
      // Replace the EntityType's existing Entities with our new list.
      //city.entities = updatedEntityList;

      const request = {
        entityType: entity,
        // Tell the API to only modify the 'entities' field, not any other
        // fields of the EntityType.
        updateMask: {
          paths: ['entities'],
        },
      };
      // Tell Dialogflow to update the EntityType.
      return entitiesClient.updateEntityType(request);
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
        console.error('Could not find the entity named ' + displayName + '.');
        return;
      }
      console.error('Error updating entity type:', err);
    });


}
// Create a path string for our agent based
// on its project ID (from first tab of Settings).


/** Define a custom error object to help control flow in our Promise chain. */
exports.updateEntity = updateEntity;