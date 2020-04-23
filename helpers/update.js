/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// Loads in our node.js client library which we will use to make API calls.
const dialogflow = require('dialogflow');

// Read in credentials from file. To get it, follow instructions here, but
// chose 'API Admin' instead of 'API Client':
// https://dialogflow.com/docs/reference/v2-auth-setup
const credentials = require('../seven-huqece-6f3eb8d4773b.json');

// Create a new EntityTypesClient, which communicates
// with the EntityTypes API endpoints.
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
    .then((city) => {
      // console.log('Found city: ', JSON.stringify(city));
      // These Entities are hardcoded, but we could easily query
      // this data from a database or API call.
      var newMachine = {"value": newFieldName, "synonyms": [newFieldName]}
      city.entities.push(newMachine)
      // Replace the EntityType's existing Entities with our new list.
      //city.entities = updatedEntityList;

      const request = {
        entityType: city,
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
        console.error('Could not find the entity named city.');
        return;
      }
      console.error('Error updating entity type:', err);
    });


}
// Create a path string for our agent based
// on its project ID (from first tab of Settings).


/** Define a custom error object to help control flow in our Promise chain. */
exports.updateEntity = updateEntity;