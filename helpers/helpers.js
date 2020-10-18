/**
 @module Helpers
*/


class Helpers {

	constructor(){}

	/**
	 * [Safe Access] - Tries to resolve a nested object without errors (for unknown structures and third party objects).
	 * The object must be passed as the first argument.
	 * Returns undefined or the resolved item.
	 */
	static sAcc(){
		var args = Array.from(arguments)
		return args.reduce((previous, next) => (previous && previous[next]? previous[next] : undefined))
	}

	static chunk(arr, chunkSize) {
		var R = []
		for (var i=0,len=arr.length; i<len; i+=chunkSize)
			R.push(arr.slice(i,i+chunkSize))
		return R
	}

	static combine(list) {
		return Object.assign({},...list)
	}

	static isPastDate(dateString){
		return ((new Date(dateString)).getTime() < new Date().getTime())
	}

	static sortByZuluDatestring(a,b, comparator, ascending=true){
		return (a[comparator] < b[comparator]) ? (ascending? -1: 1) : ((a[comparator] > b[comparator]) ? (ascending? 1: -1) : 0);
	}

	static deduplicateMachineOwns (ownList = []){
		var owns = {user:{},root:{},both:{}}
		ownList.forEach(own => {
			if (["root", "user"].includes(own.type)){
				owns[own.type][own.uid] = own
				if (owns["user"][own.uid] && owns["root"][own.uid]){
					owns["both"][own.uid] = Object.assign(owns["user"][own.uid],owns["root"][own.uid],{type:"both"})
					delete owns["user"][own.uid]
					delete owns["root"][own.uid]
				}
			}
		})
		Object.keys(owns).forEach(type => owns[type] = Object.values(owns[type]))
		return owns
	}

	/**
 * Promise-based sleep function (blocks only the caller (async) function)
 * @param {number} ms - The time in milliseconds to sleep.
 */
	static async wait(ms) {
		return new Promise(resolve => {
			setTimeout(resolve, ms)
		})
	}
	/**
 * Arrow function to generate a random hexadecimal nonce so images always get re-downloaded in Discord client.
 * @param {*} size - The length of the desired hex nonce.
 */
	static genRanHex(size) {return [...Array(size)].map(() => Math.floor(Math.random() * 16).toString(16)).join("")}


	/**
 * Returns one of the items passed as parameters, at random. Ex. usage: any("Hi","Hello","Hey")
 */
	static any() {
		return arguments[arguments.length * Math.random() | 0]
	}

	/**
 * Returns either true or false based on the provided probabilty value (a number between 0-1, where 1 => 100% true and 0 => 100% false).
 * @param {number} probability 
 * @returns boolean
 */
	static maybe(probability) {
		if (Math.random() < probability) return true
		else return false
	}

	/**
	 * Splits an array of characters into a matrix.
	 * @param {*} size 
	 * @param {*} arr 
	 */
	static sp(size, arr) { //size - child_array.length
		var out = [], i = 0, n = Math.ceil((arr.length) / size)
		while (i < n) { out.push(arr.splice(0, (i == n - 1) && size < arr.length ? arr.length : size)); i++ }
		return out
	}

}

/**
 * Promise-based sleep function (blocks only the caller (async) function)
 * @param {number} ms - The time in milliseconds to sleep.
 */
async function wait(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms)
	})
}

/**
 * Allows for performing a given task for a sequence of items, asynchronously (such as sending Discord messages one at a time)
 * @param {*} array - The array of items to process
 * @param {*} callback - The function to wait for on each item
 */
async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array)
	}
}


module.exports = {
	Helpers,
	wait,
	asyncForEach
}