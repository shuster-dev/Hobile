# Hobile V4 — Real 3D Vertical Slice

This is a deliberate rebuild of the gameplay presentation layer.

## What changed
- Real WebGL 3D scene using Three.js
- Original compact tactical map: SANDLINE
- Courtyards, warehouse areas, mid lane, connectors, stairs, raised platform, crates, barrels, signs and two bomb sites
- Procedural sandstone, brick, concrete, metal, wood and floor materials
- Dynamic sunlight, shadows, fog and tone mapping
- Real 3D humanoid CT/T models built from articulated geometry
- Walk animation, aim orientation and death/fall animation
- Real 3D first-person rifle + hands
- Recoil and reload motion
- Hitscan shooting with head/body hit parts
- Muzzle/recoil feedback, hit marker, damage flash and kill feed
- Bomb plant/defuse round loop
- Mobile joystick, touch look, fire, reload, jump, use and pause
- Counter-Terrorists / Terrorists naming

## Important
This is a vertical slice: one rifle and a small 2v2 match are intentionally prioritized over a large feature list.

The Three.js engine is loaded from cdnjs at runtime. This build uses the stable r128 browser build. If the engine cannot load, the page displays an explicit engine error instead of a black screen.

## Vercel
Upload all files in this folder with `index.html` at the project root.

## Next pass after acceptance
- Pistol and knife as full 3D view weapons
- Buy menu and economy
- Better model detail / imported original GLB art
- More character animation states
- Audio
- Real WebSocket multiplayer rooms
