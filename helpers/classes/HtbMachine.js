function pointsToDifficulty(points) {
    switch (points) {
      case 0: return "Unknown"
      case 20: return "Easy";
      case 30: return "Medium";
      case 40: return "Hard";
      case 50: return "Insane";
      default: return ""
    }
  }
  
/** Class representing a Hack the Box machine. */
class HtbMachine {
    /**
     * Create a machine object.
     * @param {string} title - The name of the machine (e.g. 'Fatty')).
     * @param {number} id - The numeric id representing the machine.
     * @param {string} thumb - The full url to the machine's public thumbnail image.
     * @param {array} userOwners - A list of OwnInfo objects containing user id and timestamp values for user owns.
     * @param {array} rootOwners - A list of OwnInfo objects (containing user id and timestamp values for root owns.
     * @param {boolean} retired - A boolean value indicating whether the machine is retired. (todo: consolodate retired/unreleased into single 'state' member.)
     * @param {boolean} unreleased - A boolean value indicating whether the machine is unreleased.
     * @param {number} retiredate - A number representing the UTC timestamp (in seconds) at which the machine was retired.
     * @param {number} release - A number representing the UTC timestamp (in seconds) at which the machine was released.
     * @param {string} maker - The name of the machine's primary maker.
     * @param {string} maker2 - The name of the machine's secondary maker (if applicable).
     * @param {string} os - A string representing the machine's operating system (e.g. 'Linux' / 'Windows' ...).
     * @param {number} rating - A number ranging from 0 to 5 indicating the overall user rating the machine has received.
     * @param {number} points - The amount of points the machine is worth, if it is active.
     * @param {string} difficulty - The difficulty of the box as a string, e.g. "Easy", "Hard".
     */
    constructor(title, id, thumb, retired, maker, maker2, os, ip, rating, release, retiredate, points, unreleased) {
        this.title = title;
        this.id = id;
        this.thumb = thumb;
        this.userOwners = []
        this.rootOwners = []
        this.retired = retired
        this.maker = maker
        this.maker2 = maker2
        this.os = os
        this.ip = ip
        this.rating = rating
        this.release = release
        this.retiredate = retiredate
        this.points = points
        this.difficulty = pointsToDifficulty(points)
        this.unreleased = unreleased
    }
}

module.exports = HtbMachine