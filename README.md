[![ko-fi](https://www.ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/F1F61UIUZ)
# 💬 Seven
#### An AI-powered Discord Bot for [Hack The Box](https://www.hackthebox.eu) teams. 
![Seven's visage](/branding/seven_thumb_128.png)

## 🍉 About 
Seven is a semi-intelligent AI chatbot built with [DialogFlow](https://dialogflow.cloud.google.com/) and [Node.js](https://nodejs.org/), whose purpose is to make Hack The Box (hackthebox.eu/) achievement data accessible and convenient within team Discord channels. 

## 🦾 Capabilities
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
## 🃏 Talking to Seven:
Seven is super flexible and doesn't rely on templates or specific wordings to understand what users are asking for. However, here are some example queries:
### 🔰 Print a manpage:
 >  "help" / "what can you do" / "user manual"
 <details>
  <summary>📸</summary>
  
  <img src="docs/img/get_help.png?raw=true" width="642">
</details>

### 🔮 Get info on who owned XYZ:
> "Who did [**boxname** | **challengename**]", "Who did mantis"\
> "who rooted **json** last", "who can help me with Forest challenge"
 <details>
  <summary>demo</summary>
  
  <img src="docs/img/get_box_owners_2.png?raw=true" width="642">
  <img src="docs/img/get_last_box_owner.png?raw=true" width="642">
  <img src="docs/img/get_challenge_owners.png?raw=true" width="642">
</details>

### 🐉 Get box / challenge info:
> "[**boxname** | **challengename**]", "[**boxname**] info" etc\
> "what's new", "what's fresh" /* unreleased / latest box */
 <details>
  <summary>demo</summary>
  
  <img src="docs/img/get_box_info.png?raw=true" width="642">
  <img src="docs/img/get_newest_box.png?raw=true" width="642">
  <img src="docs/img/get_oldest_box.png?raw=true" width="642">
  <img src="docs/img/get_challenge_info.png?raw=true" width="642">
</details>

### 🧙 See achievements / profile for a specific team member:
> "what challenges did [**username**] do" / "which boxes has [**username**] owned?"\
> "who is [**username**]", "[**username**] info", "[**username**] ranking"\
> "has [**username**] rooted multimaster yet?", "Did [**username**] solve fuzzy"\
 <details>
  <summary>demo</summary>
  
  <img src="docs/img/get_challenge_ownage_by_member.png?raw=true" width="642">
  <img src="docs/img/get_box_ownage_by_member.png?raw=true" width="642">
  <img src="docs/img/get_member_info.png?raw=true" width="642">
</details>

### 🏅 Get team rank and information:
> "team info", "who are [**teamname**]", "[**teamname**]"\
> "who is the team founder"\
> "team ranking", "how are we doing" `/* team global rank */`\
> "who's on top", "team leaders"` /* group members    */`
 <details>
  <summary>demo</summary>
  
  <img src="docs/img/get_team_info.png?raw=true" width="642">
  <img src="docs/img/get_team_founder_info.png?raw=true" width="642">
  <img src="docs/img/get_team_leaderboard.png?raw=true" width="642">
</details>

### 💚🐒 Try your best to confuse / bond with / annoy Seven:
> "Where are you from?", "what rank are you", "what do you do for fun"\
> "What are you working on", "do you like water skiing", "what is 4+4"\
> "' UNION SELECT ..." ??? "sudo su", "can you help me hack the pentagon"
 <details>
  <summary>demo</summary>
  
  <img src="docs/img/small_talk_0.png?raw=true" width="642">
  <img src="docs/img/small_talk_1.png?raw=true" width="642">
  <img src="docs/img/small_talk_2.png?raw=true" width="642">
  <img src="docs/img/small_talk_3.png?raw=true" width="642">
</details>

## 👥 Privacy
Seven cares about privacy and allows channel users to:
- associate or disassociate their Discord ID to their HTB account ID (enabling this makes achievement information more useful as users may have different handles on each platform.
- disallow (or re-allow) inclusion of their HTB data in bot responses
## 🛠️ Installation and Usage
🚧 This section will be completed soon! A few things have to be finished before Seven can be easily adopted by any team. 
## 📜 Roadmap: 
Some features / nice-to-haves that are under consideration:
 - Offer advice / memory jogs from [RTFM](https://doc.lagout.org/rtfm-red-team-field-manual.pdf) for users LIKE: "stuck on **[STAGE** [*privesc, recon, persistence ...*]**]** with **[TECHNOLOGY** [*linux, nodejs, sql server ...*]**]**
 - Answer questions invoking possibly long data (while respecting Discord embed limitations):
   - "[teamname] members" (get member list, can be up into the hundreds depending on team)
   - "machine list" (this returns around 250 results at time of writing)
   - "all challenges" (same, around 150)
   - Give info on self based on Discord association
