
/**
 @module ZipTools
*/

var file_system = require("fs")
var archiver = require("archiver")


class ZipTools {
	constructor(){}

	static zipFolder(sourcePath, zipFilePath) {
		return new Promise((resolve, reject) => {
			var output = file_system.createWriteStream(zipFilePath)
			var archive = archiver("zip")
			output.on("close", function () {
				console.warn("[AGENT EXPORT]::: " + archive.pointer() + " total bytes")
				console.warn("[AGENT EXPORT]::: Archive closed...")
				resolve("Done!")
			})
			archive.on("error", function(err){
				reject(err)
			})
			archive.pipe(output)
			// append files from a sub-directory, putting its contents at the root of archive
			archive.directory(sourcePath, false)
			archive.finalize()
		})
	}
}

module.exports = ZipTools