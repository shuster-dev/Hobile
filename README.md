# Hobile V5.1 — Asset Load Fixed

This build fixes the `ASSET LOAD FAILED` screen seen on iPhone Safari.

What changed:
- Removed the runtime JSON manifest request entirely.
- The browser no longer fetches the 3DAssets API.
- Vercel now provides a same-origin `/api/asset` proxy for the GLB pack.
- The main pack is loaded from one known permanent GLB URL.
- CT and T operators have direct same-origin fallback routes.
- The game extracts real map modules and real weapon models from the pack when their object names are present.
- If a specific environment node name is unavailable, only that piece falls back instead of crashing the entire game.

Deploy the WHOLE folder/ZIP to Vercel. The `api/asset.js` file is required.
