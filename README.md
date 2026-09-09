# Hobile V1

Hobile is an original, mobile-first browser FPS project. V1 is a playable core-combat milestone designed primarily for iPhone Safari, then Android Chrome.

## V1 features

- Original 3D training-yard map
- First-person camera
- Mobile virtual joystick
- Touch drag camera control
- Desktop keyboard/mouse fallback for development testing
- Original VX-7 hitscan rifle
- Magazine + reserve ammunition
- Reloading and recoil/spread
- HP, damage feedback and death/restart flow
- Six basic moving enemy bots with line-of-sight return fire
- Body/head hit detection and headshot scoring
- Mobile-conscious rendering: no shadows, no textures, capped device pixel ratio, simple geometry

## Run

This is a static website. Serve the project over HTTPS or a local HTTP server. Opening `index.html` directly with `file://` is not the recommended deployment mode.

The only runtime dependency is Three.js, currently loaded from jsDelivr in `index.html`. All Hobile game code and assets are original project files.

## Controls

### Mobile
- Left thumb: virtual joystick
- Right side drag: camera / aim
- FIRE: hold to fire
- R: reload
- JUMP: jump

### Desktop test fallback
- WASD: move
- Mouse: aim (click canvas to pointer-lock)
- Left mouse: fire
- R: reload
- Space: jump

## Architecture direction

V1 intentionally keeps combat simulation in one browser client while separating responsibilities into clear systems/functions: input, player movement, weapon/combat, bots, world collision, HUD and render loop. For multiplayer milestones, critical state will move to a server-authoritative simulation rather than trusting client hit/damage decisions.

Recommended multiplayer path later: WebSocket room service + authoritative Node.js game server + client-side prediction/interpolation. The static game client can remain deployable independently.

## Product milestones

- V1: core FPS (this build)
- V2: combat feel, weapon feedback, movement tuning
- V3: weapon inventory + economy
- V4: bomb plant/defuse round mode
- V5: bot AI improvements
- V6: multiplayer networking foundation
- V7: room codes / friends
- V8+: maps, audio, polish, progression and settings
