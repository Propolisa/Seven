/**
 * Contains Natural Language Processing functionality to make Seven a little smarter! 😸
 @module Nlp
*/


/**
 * Check whether the NLP-recognized 'name' is actually a self descriptor.
 * @param {string} name - The recognized 'name'.
 * @returns {boolean}
 */
function checkSelfName(name) {
  return ((["i", "me", "my", "mine", "i'm", "i've", "myself"].includes(name.toLowerCase())) ? true : false)
}

module.exports = {
  checkSelfName: checkSelfName
}