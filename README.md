
# Seven
#### An AI-powered Discord Bot for [Hack The Box](https://www.hackthebox.eu) teams. 
![Seven's visage](https://raw.githubusercontent.com/Propolisa/Seven/master/branding/seven_thumb_s.png)

## About 
Seven is a semi-intelligent AI chatbot built with [DialogFlow](dialogflow.cloud.google.com/) and [Node.js](https://nodejs.org/), whose purpose is to make Hack The Box (hackthebox.eu/) achievement data accessible from Discord. 

## Capabilities
Seven can provide information about
  - her own functionality (try asking `help`, `what can you do for me`)
  - machines (active, retired and unreleased)
  `what machines / challenges did [username] do`
  - challenges
  - team members
  - team details
  - ownage (e.g. `who did [challenge name, machine name] [last?]`)
  - team global rank
  - team member leaderboard (top members)
## Examples:
Seven is super flexible and doesn't rely on templates or specific wordings to understand what users are asking for. However, here are some example queries:
### Print a manpage:
 >  "help" / "what can you do" / "user manual"
### Get info on who owned XYZ:
> "Who did [**boxname** | **challengename**]", "Who did mantis"
> "who rooted **json** last", "who can help me with Forest challenge"
### Get box / challenge info:
> "[**boxname** | **challengename**]", "[**boxname**] info" etc
> "what's new", "what's fresh" /* unreleased / latest box */
### See achievements / profile for a specific team member:
> "what challenges did [**username**] do" / "which boxes has [**username**] owned?"
> "who is [**username**]", "[**username**] info", "[**username**] ranking"
### Get general info about team:
> "team info", "who are [**teamname**]", "[**teamname**]"
> "who is the team founder"
> "team ranking", "how are we doing" `/* team global rank */`
> "who's on top", "team leaders"` /* group members    */`
### Try your best to confuse / bond with / annoy Seven:
> "Where are you from?", "what rank are you", "what do you do for fun"
> "What are you working on", "do you like water skiing", "what is 4+4"
> "' UNION SELECT ..." ??? "sudo su", "can you help me hack the pentagon"

## Privacy
Seven cares about privacy and allows channel users to:
- associate or disassociate their Discord ID to their HTB account ID (enabling this makes achievement information more useful as users may have different handles on each platform.
- disallow (or re-allow) inclusion of their HTB data in bot responses
## Installation and Usage
🚧 This section will be completed soon! A few things have to be finished before Seven can be easily adopted by any team. 
## [PLANNED]: 
Some features that would make nice additions:
  - Offer advice / memory jogs from [RTFM](https://doc.lagout.org/rtfm-red-team-field-manual.pdf) for users LIKE: "stuck on **[STAGE** [*privesc, recon, persistence ...*]**]** with **[TECHNOLOGY** [*linux, nodejs, sql server ...*]**]**
 - Answer questions invoking possibly long data (while respecting Discord embed limitations):
 - "[teamname] members" (get member list, there are like 75 atm)
 - "machine list" (around 250 results, will default offer 20, ask user to confirm for another 20)
 - "all challenges" (same, around 150)
 - Give info on self based on Discord association
