
class HtbChallenge {
    constructor(name, category, date, description, isActive, points, maker, maker2, solverCount, upvotes, downvotes) {
        this.name = name
        this.category = category
        this.releaseDate = date
        this.description = description
        this.isActive = isActive
        this.points = points
        this.maker = maker
        this.maker2 = maker2
        this.solverCount = solverCount
        this.upvotes = upvotes
        this.downvotes = downvotes
        this.owners = []
    }
}

module.exports = HtbChallenge