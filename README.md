# Hobile V5 — Asset-Backed Rebuild

This build changes the visual strategy completely.

Instead of drawing the map, operators and weapons from procedural boxes, Hobile V5 loads a real CC0 tactical FPS asset pack at runtime:

Tactical Shooter Hill Town — 3DAssets.dev

The pack contains:
- Mediterranean modular tactical map pieces
- cobbled floors, plaster/ochre walls, arches, low walls
- fountain, market stall, crates, barrels and olive trees
- defender and attacker operator models
- defender carbine and attacker assault rifle models
- objective props and other tactical assets

The game assembles those assets into an original compact Hobile map and keeps invisible collision/navigation logic separate from the art.

## Gameplay
- Counter-Terrorists vs Terrorists
- 2v2 vertical slice
- touch joystick / touch look
- real GLB first-person weapon model
- real GLB operator models
- shooting, damage, reload, death
- Bomb/Defuse A/B loop
- round score
- mobile HUD
- no text selection / long-press interaction while playing

## Important
The external 3D models are loaded from 3DAssets.dev's CORS-enabled CDN and Three.js is loaded from jsDelivr. An internet connection is required.

This pack is CC0 1.0 Universal according to its publisher and is intended for commercial use without attribution.
