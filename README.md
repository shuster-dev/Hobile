# Hobile V2.1 — Verified Playable Build

Focus of this build: make the match loop and mobile controls reliable before online multiplayer.

Included:
- Counter-Terrorists vs Terrorists, 3v3 bot match
- Working movement collision
- Safari pointer + touch fallbacks
- Long-press/context menu/text selection/double-tap suppression
- Aim, fire, reload, jump
- Visible CT/T characters with HP bars
- Bot pathfinding through the map instead of walking into walls
- Bot shooting, player damage, deaths, kills, kill feed
- Bomb Sites A and B
- Plant / defuse flow
- Bot plant / defuse behavior
- Round timer and CT/T win conditions
- Responsive landscape HUD and portal
- No CDN / npm / external game assets

Automated checks:
Run `node test-core.js`.
The package was created only after all 9 core gameplay tests passed, including three simulated round outcomes.

Note:
A headless Safari/iPhone browser was not available in the build environment, so automated logic tests do not replace final testing on your physical iPhone. Online Create/Join Room synchronization is not implemented yet.
