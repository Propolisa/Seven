# Seven

![Seven's visage](https://raw.githubusercontent.com/Propolisa/Seven/master/branding/seven_thumb.png)

## About 
Seven is a semi-intelligent AI Discord bot built with Google's DialogFlow and NodeJS to relay achievement data to my Hack The Box (hackthebox.eu/) team. It uses a combination of web scraping and API integration to connect team members with achievement data, rankings and machine and challenge details. Seven has a distinct personality and small talk subroutines; in fact, she makes naturally-occurring typos and has dynamic typing speed / status while responding (probably the coolest idea I've ever had in my life 😀). 
Discord bot for HTB users.

## Capabilities
Seven can provide information about
  - her own functionality (try asking "help", "what can you do for me")
  - [active, retired, unreleased] machines
  - challenges
  - team members
  - team details
  - ownage (e.g. who did [challenge name, machine name] [last?])
  - team global rank
  - team member leaderboard (top members)
She allows channel users to:
- associate their Discord ID to their HTB account, which makes achievement information more effective as the usernames will be shown in tandem in cases where the HTB username is different from the Discord username.
- disallow inclusion of their HTB data in bot responses
- unlink Discord ID if one has been associated

## [PLANNED]: 
Ideally, Seven should also be able to
  - Offer advice / memory jogs from [RTFM](https://doc.lagout.org/rtfm-red-team-field-manual.pdf) for users LIKE: "stuck on [STAGE privesc, recon, persistence ...] with [TECHNOLOGY linux, nodejs, sql server ...]
  - Answer questions invoking possibly long data (while respecting Discord embed limitations):
     -* "what machines / challenges did [username] do"*
     -* "clk members" (get member list, there are like 75 atm)*
     - *"machine list" (around 250 results, will default offer 20, ask user to confirm for another 20)*
     - *"all challenges" (same, around 150)*
  - Give info on self based on Discord association
