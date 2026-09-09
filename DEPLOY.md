# Deploy Hobile from an iPhone

Hobile V1 is static, so it does not require a VPS or app-store package.

## Easiest deployment shape

Upload the contents of this project folder to any static HTTPS hosting provider. The public URL should point to `index.html` at the root.

Good categories of hosting for this project are static-site hosts with browser-based upload or Git-based deployment. No server is required for V1.

## Important for iPhone Safari

- Use HTTPS in production.
- Play in landscape orientation.
- Safari may keep browser chrome visible; Hobile requests fullscreen where supported, but iPhone Safari controls this behavior.
- Keep Low Power Mode in mind when evaluating FPS because iOS may reduce refresh behavior.

## Future multiplayer

When multiplayer begins, the static client can stay on static hosting while a separate authoritative WebSocket server handles rooms and match state.
