# Running it for real

The goal this file serves: someone opens the link, plays, closes the tab, comes
back a week later on a different phone, and is exactly where they left off.

## What already happens, and what needs a server

The client keeps a session token in `localStorage` and the server keeps the
player document. Everything about "come back and continue" is already written —
`boot()` renews the token against `/api/me` and drops the player into
`profile.zone`, the zone they were last in. What it needs is somewhere for the
document to live that is not one browser.

The GitHub Pages site is the **single-player** build: it saves to
`localStorage` and nothing else. That is the right thing for a demo link with no
server behind it, and the wrong thing for a player who expects an account. Once
the server below is up, the real link is the server's URL.

## The first click has no form

A first visit calls `/api/guest`, which creates a real account with a real
document — level, dex, team, the lot — identified by the token in that browser.
The player names a character and starts playing. No sign-up, because a form in
front of a game link is where most people stop.

That account can be **claimed** at any time: `/api/claim` puts a username and a
password on it, *keeping its id*, so the document, the level, the collection and
the leaderboard row all carry over. In the client it is the `🔒 שמירת ההתקדמות`
chip under the vitals, and the account panel behind it.

Two consequences worth knowing:

- **An unclaimed guest lives in one browser.** Clearing site data loses it, and
  there is nothing the server can do — nobody can prove the account was theirs.
  That is what the chip is for, and why it is always on screen until it is used.
- **`/api/me` renews the token on every visit.** Tokens last 30 days; without
  renewal a guest who came back after five weeks would find themselves locked
  out of an account that still existed. A player who visits monthly never
  expires.

## Deploying

The server serves the built client from the same origin (`dist/web`, built into
the image), so one deploy is the whole thing and there is no CORS to configure.

### 1. A database that survives a restart

`DB_DRIVER=memory` is per-process: a restart, which every platform does on every
deploy, loses every player. MongoDB Atlas' free tier is plenty.

1. Create a free M0 cluster at mongodb.com/atlas.
2. Database Access → add a user with a password.
3. Network Access → allow `0.0.0.0/0` (the platform's egress IP is not fixed).
4. Connect → Drivers → copy the `mongodb+srv://…` string, with the password in
   it.

### 2. The server

The repo carries `Dockerfile` and `railway.json`. On Railway: New Project →
Deploy from GitHub repo → pick this one. It reads `railway.json`, builds the
Dockerfile and health-checks `/api/health`.

Environment variables:

| variable | value |
|---|---|
| `AUTH_SECRET` | long and random — `openssl rand -hex 32`. It signs every token; changing it logs everyone out |
| `DB_DRIVER` | `mongo` |
| `MONGO_URL` | the Atlas connection string |
| `MONGO_DB` | `hobile` |
| `CORS_ORIGIN` | the site's own URL, or leave `*` while everything is on one origin |
| `PORT` | set by the platform; the server reads it |

`AUTH_SECRET` is not optional: `src/server/auth.js` refuses to start in
production without it, because the fallback is a random key per process, which
would invalidate every session on every restart.

### 3. The link

The server's URL *is* the game. Nothing else to point anywhere.

If you would rather keep the client on GitHub Pages and the server elsewhere,
build the client with the server baked in:

    node tools/build.mjs --server=https://your-server.example

`?server=https://…` on the URL overrides it, which is how to test a build
against staging without rebuilding.

## Checking it worked

    curl https://your-server.example/api/health      # {"ok":true,"zones":8}

and locally, the whole promise end to end — a real server, a real browser, a
first visit with no form, a reload that lands back in the same zone, a claim,
and a login from a browser that has never seen the first one's storage:

    npm run test:session

## What this does not do

- **No password reset.** A claimed account with a forgotten password is lost.
  Worth an email field before the player count justifies a support burden.
- **Guest rows accumulate.** Every first visit writes a user. They are tiny, but
  a cleanup for guests with no document and no activity in 30 days is the sort
  of thing to write before it is needed.
- **One process.** A Colyseus room lives in the memory of the process that
  created it, so scaling past one instance needs `@colyseus/redis-driver` and
  sticky sessions. `numReplicas: 1` in `railway.json` is deliberate.
