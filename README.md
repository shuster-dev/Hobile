# Hobile V6 — Online Multiplayer

This build adds real internet multiplayer using Supabase Realtime.

## Free architecture
- Vercel: static hosting + existing same-origin GLB proxy
- Supabase Realtime: Presence + Broadcast
- No paid game server
- No database table is required for the multiplayer room flow

## Online flow
1. Create Online Room
2. Hobile generates a 5-character room code
3. Share Room Link uses the iPhone share sheet
4. Friend opens the link and joins the same Supabase Realtime channel
5. Players choose CT / T
6. Host starts the match
7. Player movement is broadcast over Realtime and interpolated on peers
8. Shooting uses host-side validation before damage is broadcast
9. Host controls round timer, score, Bomb/Defuse state and round reset

## Supabase usage
Presence is only used for slow-changing lobby state (join/leave/name/team).
Broadcast is used for frequent player state, shots and match events.

## Security note
The embedded Supabase key is a publishable browser key by design. Do not replace it
with a secret key or service_role key.

## Current multiplayer target
The first online target is 1v1 / 2-player Bomb/Defuse. This is deliberate: prove
stable iPhone-to-iPhone multiplayer before increasing player count.

## Deploy
Upload the whole ZIP/folder to Vercel. Keep:
- index.html
- style.css
- game.js
- network.js
- net-core.js
- api/asset.js
- vercel.json
