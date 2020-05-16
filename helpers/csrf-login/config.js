'use strict'

var debug = require('debug')('csrf')
var nconf = require('nconf')

function getConfig (options) {
  if (options) {
    nconf.overrides(options)
  }

  nconf.env().argv()

  var findFirst = require('first-existing')
  var candidateFiles = ['.csrf.json', 'csrf.json', '.csrf-login.json', 'csrf-login.json']

  var foundFile = findFirst(process.cwd(), candidateFiles)
  if (!foundFile) {
    debug('could not find config file in', process.cwd())
    debug('searching in', __dirname)
    foundFile = findFirst(__dirname, candidateFiles, true)
  }
  if (!foundFile && options.folder) {
    debug('looking for config file in', options.folder)
    foundFile = findFirst(options.folder, candidateFiles)
  }

  if (foundFile) {
    debug('found config file', foundFile)
    nconf.file(foundFile)
  } else {
    console.error('warning: Could not find csrf settings file,\n' +
      'using environment variables only')
  }

  var join = require('path').join
  var defaults = require(join(__dirname, 'defaults.json'))
  nconf.defaults(defaults)

  return nconf
}

module.exports = getConfig

if (!module.parent) {
  console.log('configuration data')
  console.log('host', nconf.get('host'))
  console.log('token field', nconf.get('tokenFieldName'))
}
