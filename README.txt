HOBILE V1.4 — SAFARI FIXED

This build removes all external JavaScript dependencies.
The previous black-screen issue could happen when the external Three.js CDN failed
or did not initialize correctly on iPhone Safari.

V1.4 uses a self-contained Canvas raycasting engine:
- No Three.js
- No CDN
- No external assets
- No npm
- One index.html
- iPhone Safari landscape controls
- Portal / servers / rooms UI
- Team selection
- Loading screen
- Playable FPS training map
- Joystick, touch-look, fire, reload, jump
- Ammo, HUD, timer, headshots and targets

Deploy to Vercel:
Make sure index.html is at the root of the deployment.
