# Hobile V2.2 — Video Fix / Browser Tested

This build was revised after reviewing the iPhone screen recording.

## Main fixes
- Fixed Terrorist bot spawn coordinates that could place a bot inside wall geometry.
- Reworked hit registration so the angular hitbox matches the enemy's rendered size at different distances.
- Added reliable headshots, hit marker, muzzle flash and damage flash.
- Improved bot pathfinding, movement, shooting, bomb planting and defusing.
- Improved procedural wall materials and character rendering.
- Moved ammo HUD away from FIRE/RELOAD controls to prevent overlap.
- Suppresses text selection, long-press context behavior and touch gestures during gameplay.
- Counter-Terrorists / Terrorists naming.
- No Three.js, no CDN, no npm and no external game assets.

## Automated core checks
11 core checks passed:
- CT/T spawn validity
- movement
- pathfinding
- hitscan
- Bomb Site A/B
- CT elimination win
- T bomb explosion win
- CT defuse win

## Real Chromium browser checks
The build was loaded into a real Chromium browser runtime at a 932x430 landscape viewport.

Passed:
- game boot
- 5 bot spawn
- real browser touch joystick movement
- real browser touch-look
- real browser touch FIRE
- enemy kill / headshot
- real browser touch reload
- no FIRE/ammo HUD overlap
- touch-action/user-select protections
- Round 1: CT win by elimination
- Round 2: T win by bomb explosion
- Round 3: CT win by defuse

Important: Chromium browser testing is not the same as physical iPhone Safari testing. The screen recording remains the final source of truth for iPhone-specific behavior.

## Vercel
Deploy the contents of this folder with `index.html` at the project root.

## Multiplayer
Create Room / Join Room are still UI-only in V2.2. Real network multiplayer requires the next server/WebSocket milestone.
