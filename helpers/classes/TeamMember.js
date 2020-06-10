/** Class representing a Hack the Box team member. */
class TeamMember {
    constructor(name, id, owns, siterank, points) {
      this.siterank = siterank
      this.points = points
      this.name = name;
      this.id = id;
      this.totalOwns = owns
      this.thumb = false
      this.rank = "Noob"
      this.countryName = "Pangea"
      this.countryCode = ""
      this.joinDate = 0
      this.stats = { users: 0, roots: 0, challenges: 0, respects: 0, bloods: 0 }
    }
  }

  module.exports = TeamMember