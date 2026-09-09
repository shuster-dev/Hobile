HOBILE V1.3 — FPS PORTAL

This build upgrades Hobile from a single demo into a browser FPS portal prototype.

Included:
- Hobile landing portal
- Quick Play
- Browse Servers section
- Create Room UI with shareable room code
- Join Room UI
- Team selection: Wardens / Raiders
- Map loading screen
- Original YARD-01 3D map
- Mobile joystick + touch look
- Fire / reload / jump
- Hitscan rifle + headshots
- HUD, timer, kill feed, scoreboard
- iPhone landscape handling
- Single-file static deploy for Vercel

Important:
Create Room / Join Room are currently portal UI only. Real multiplayer networking,
authoritative server state, room synchronization and friend-vs-friend gameplay are the next milestone.

Deploy:
Upload index.html to the root of your Vercel static project.
Internet access is required because Three.js loads from jsDelivr CDN.
