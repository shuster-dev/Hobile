# Hobile V2 — Playable Mobile FPS

This build is a clean rewrite focused on being **playable on iPhone Safari**.

## What is actually implemented
- Fully self-contained Canvas FPS engine (no CDN, no Three.js, no npm)
- Working mobile joystick movement
- Right-side touch aiming
- Prevents text selection, long-press menu, double-tap zoom and browser touch gestures while playing
- Working rifle, ammo, reload and hits
- Visible enemy and friendly bot characters
- Bot movement, line-of-sight shooting, damage and deaths
- Kill feed
- Round system and CT/T round score
- Bomb/Defuse objective
- Bomb Site A and B
- Terrorists can plant with USE
- Counter-Terrorists can defuse with USE
- Terrorist bots can plant
- Counter-Terrorist bots can defuse
- Round win conditions: elimination, timeout, bomb explosion, defuse
- Cleaner responsive portal and team selection
- English Counter-Terrorists / Terrorists naming
- Pause/leave controls
- Keyboard fallback for desktop testing

## Important
Create Room / Join Room are still UI placeholders. This version focuses on making the **game itself work correctly first**. Real online multiplayer requires a server/WebSocket layer and is the next major milestone.

## Deploy to Vercel
Upload the contents of this folder with `index.html` at the project root.
No external dependencies are required.
