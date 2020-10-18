
var typoDict = require('./typos.json')
var mistypables = Object.keys(typoDict)

function typo(message) {
    lemmas = message.replace(/(?<=\s)[^A-Z]+?(?=\w)|(?<=\w)[^a-z]*?(?=\s|$)/gi, '').split(' ');
    var mistyped = false
    typo = mistypables.some(mistypable => (lemmas.includes(mistypable) && (Math.random() > 0.5 ? mistyped = mistypable : '')))
    if (mistyped) {
        return [mistyped, typoDict[mistyped]]
    } else {
        return false
    }
}

exports.typo = typo;