'use strict'

var la = require('lazy-ass')
var check = require('check-more-types')

var log = require('debug')('csrf')
var request = require('request')
var cheerio = require('cheerio')

function getLoginForm (conf, body) {
  var LOGIN_FORM_SELECTOR = conf.get('loginFormSelector')
  if (!LOGIN_FORM_SELECTOR) {
    var LOGIN_FORM_ID = conf.get('loginFormId')
    la(check.unemptyString(LOGIN_FORM_ID), 'missing login form id', LOGIN_FORM_ID)
    LOGIN_FORM_SELECTOR = 'id="' + LOGIN_FORM_ID + '"'
  }

  // console.log('body', body);
  var $ = cheerio.load(body)
  var form = $('form[' + LOGIN_FORM_SELECTOR + ']')
  return form
}

function isValidForm (form) {
  return form && form.length === 1
}

function getCsrfTokenName (conf) {
  var CSRF_TOKEN_NAME = conf.get('tokenFieldName')
  la(check.unemptyString(CSRF_TOKEN_NAME), 'missing token field name')
  return CSRF_TOKEN_NAME
}

function getCsrfInput (conf, body) {
  var token = getCsrfTokenName(conf)
  // console.log('body', body);
  var $ = cheerio.load(body)
  var csrf = $('input[name="' + token + '"]').val()
  return csrf
}

function csrfLogin (options) {
  options = options || {}

  var conf = require('./config.js')(options)
  delete conf.stores.env // security measure
  var host = conf.get('host')
  la(check.unemptyString(host), 'missing host', host)

  var username = options.email || options.username || options.USERNAME
  if (!username) {
    return Promise.reject('Missing username, see https://github.com/bahmutov/csrf-login#passing-options')
  }
  var password = options.password || options.PASSWORD
  if (!password) {
    return Promise.reject('Missing password for ' + username +
      ', see https://github.com/bahmutov/csrf-login#passing-options')
  }

  var jar = request.jar()
  request = request.defaults({
    jar: jar,
    baseUrl: host
  })
  request.__jar = jar

  function getCsrf (url) {
    return new Promise(function (resolve, reject) {
      log('fetching page', url)
      request(url, function (error, response, body) {
        if (error) {
          return reject(error)
        }
        // console.log('body', body);
        var form = getLoginForm(conf, body)
        if (!isValidForm(form)) {
          return reject(new Error('Could not find login form'))
        }
        var csrf = getCsrfInput(conf, body)
        if (!csrf) {
          return reject(
            new Error('Could not find hidden input for login at ' + url)
          )
        }
        var tokenName = getCsrfTokenName(conf)

        var pageInfo = {
          method: form.attr('method'),
          url: form.attr('action') || url,
          csrf: csrf,
          csrfName: tokenName,
          headers: response.headers
        }
        log('login page info', pageInfo)
        resolve(pageInfo)
      })
    })
  }

  function login (csrfInfo, answers) {
    var username = answers.email || answers.username
    if (!username) {
      return Promise.reject('Missing username')
    }
    if (!answers.password) {
      return Promise.reject('Missing password for ' + username)
    }
    log('trying to login %s', username)

    var usernameField = conf.get('loginUsernameField') || 'email'
    var passwordField = conf.get('loginPasswordField') || 'password'
    
    // need to set BOTH csrftoken cookie and csrfmiddlewaretoken input fields
    var loginUrl = csrfInfo.url
    var form = {}
    form[csrfInfo.csrfName] = csrfInfo.csrf
    form[usernameField] = username
    form[passwordField] = answers.password

    request.__jar.setCookie(request.cookie('csrftoken=' + csrfInfo.csrf), loginUrl)
    var loginPath = conf.get('loginPath')
    var options = {
      url: loginPath,
      formData: form,
      followAllRedirects: true,
      headers: {
        referer: host
      }
    }

    function requestAsync (options) {
      log('making async request with options', options)

      return new Promise(function (resolve, reject) {
        request(options, function (error, response) {
          if (error) {
            return reject(error)
          }
          resolve(response)
        })
      })
    }

    return new Promise(function (resolve, reject) {
      request.post(options, function onLoggedIn (error, response, body) {
        if (error) {
          console.log('Options that erred: ' + options.url)
          console.error(error)
          return reject(error)
        }
        if (response.statusCode === 403) {
          log('login has received 403')
          log(body)
          log('original login options', options)

          console.error('Could not login', response.statusCode, response.statusMessage)
          return reject(new Error(response.statusCode + ': ' + response.statusMessage))
        }

        // make sure we do not see the login page again
        var form = getLoginForm(conf, body)
        if (isValidForm(form)) {
          log('login form is shown again, wrong login info')
          console.error('Received login form again')
          return reject(new Error('Wrong login info?'))
        }

        log('success login to', response.path)
        log('jar', request.__jar)

        resolve({
          request: request,
          requestAsync: requestAsync,
          response: response,
          config: conf,
          jar: request.__jar
        })
      })
    })
  }

  var loginUrl = conf.get('loginPath')
  return getCsrf(loginUrl)
    .then(function (form) {
      // TODO would be nice to wrap this function in .tap
      log('csrf info', form)
      return form
    })
    .then(function (form) {
      log('Login to %s %s', host, loginUrl)
      return login(form, {
        username: username,
        password: password
      })
    })
}

module.exports = csrfLogin

if (!module.parent) {
  csrfLogin({foo: 'bar'})
    .catch(console.error)
}
