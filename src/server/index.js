import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { openStore } from './store.js';
import { hashPassword, verifyPassword, signToken, verifyToken, validateUsername } from './auth.js';
import { adminIds, isAdmin, reportAdmins } from './admin.js';
import { WorldRoom, channelsOf, roomOfPlayer } from './rooms/WorldRoom.js';
import { BattleRoom } from './rooms/BattleRoom.js';
import { DungeonRoom } from './rooms/DungeonRoom.js';
import { createPlayerDoc, normalizeDoc, publicProfile, uid } from './game/combat.js';
import { economyReport } from './game/economy.js';
import * as Guilds from './guilds.js';
import * as Arena from './arena.js';
import * as Push from './push.js';
import * as Social from './social.js';
import { AddressLimiter } from './game/guard.js';
import { HOME_ZONE, ZONES, STARTERS, AVATAR, avatarLook } from '../shared/gamedata.js';

// A log pipe that closes (a supervisor restarting, a test harness that died)
// must not take the server with it. Without a listener, a failed write to
// stdout is an uncaught exception; @pm2/io, which Colyseus pulls in, answers
// every uncaught exception by logging it — to the same dead pipe — and the two
// chase each other at full speed until memory runs out.
for (const out of [process.stdout, process.stderr]) out.on('error', () => {});

const PORT = Number(process.env.PORT || 2567);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const store = await openStore(process.env);
await reportAdmins(store);
await Guilds.useStore(store);
// the arena opens its fights as any duel is opened (server/arena.js)
Arena.useRooms((opts) => matchMaker.createRoom('battle', { store, ...opts }));
// the phone notifications (server/push.js): keys, the queue sweep
await Push.usePush(store, process.env, { isOnline: (id) => Social.isOnline(id) }).catch((e) => console.warn('[push] off:', e.message));
const app = express();
// behind Render's proxy the client's own address is the first hop
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));
// the doors people guess passwords at, or make accounts by the hundred at (game/guard.js)
// (the test harnesses make dozens of accounts from one address in seconds)
const TESTING = process.env.NODE_ENV === 'test';
const knock = new AddressLimiter(Number(process.env.AUTH_RATE || (TESTING ? 1000 : 0.2)), Number(process.env.AUTH_BURST || (TESTING ? 1e6 : 12)));
const newcomer = new AddressLimiter(Number(process.env.GUEST_RATE || (TESTING ? 1000 : 0.05)), Number(process.env.GUEST_BURST || (TESTING ? 1e6 : 8)));
app.use((req, res, next) => {
  res.setHeader('access-control-allow-origin', CORS_ORIGIN);
  res.setHeader('access-control-allow-headers', 'content-type,authorization');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const bearer = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
};
const requireAuth = (req, res, next) => {
  const claims = bearer(req);
  if (!claims) return res.status(401).json({ error: 'unauthorized' });
  req.userId = claims.sub;
  next();
};

app.get('/api/health', (req, res) => res.json({ ok: true, zones: Object.keys(ZONES).length }));

// --- phone notifications (server/push.js) -------------------------------------
app.get('/api/push/key', (req, res) => res.json({ key: Push.publicKey(), prefs: Push.PREFS }));
app.post('/api/push/subscribe', requireAuth, async (req, res) => {
  const r = await Push.subscribe(req.userId, req.body?.subscription, req.body?.prefs || {});
  r.ok ? res.json(r) : res.status(400).json({ error: r.error });
});
app.post('/api/push/unsubscribe', requireAuth, async (req, res) => res.json(await Push.unsubscribe(req.userId, req.body?.endpoint || null)));
app.post('/api/push/test', requireAuth, async (req, res) => {
  const n = await Push.notify(req.userId, null, { title: 'Hobile', body: 'ההתראות עובדות — נשלח לך כשהאימון נגמר או כשבוס מופיע.', tag: 'test' });
  res.json({ ok: n > 0, sent: n });
});

// --- channels: a zone's rooms, and which one to go into -----------------------
app.get('/api/channels', requireAuth, (req, res) => {
  const zone = String(req.query.zone || '');
  if (!ZONES[zone]) return res.status(400).json({ error: 'bad_zone' });
  const list = channelsOf(zone);
  // with the party, if one of them is in this zone and there is room
  let party = null;
  for (const id of Social.partyOf(req.userId)?.members || []) {
    if (id === req.userId) continue;
    const r = roomOfPlayer(id);
    if (r && r.zoneId === zone && r.clients.length < r.maxClients) { party = r.roomId; break; }
  }
  res.json({ zone, channels: list, party, mine: roomOfPlayer(req.userId)?.roomId || null });
});

app.post('/api/register', knock.middleware(), async (req, res) => {
  const name = validateUsername(req.body?.username);
  if (!name.ok) return res.status(400).json({ error: name.reason });
  const password = String(req.body?.password ?? '');
  if (password.length < 6) return res.status(400).json({ error: 'weak_password' });
  if (await store.findUser(name.value)) return res.status(409).json({ error: 'username_taken' });
  const { salt, hash } = hashPassword(password);
  const user = await store.createUser({ id: uid(), username: name.value, salt, hash });
  res.json({ token: signToken(user.id), hasCharacter: false });
});

app.post('/api/login', knock.middleware(), async (req, res) => {
  const name = validateUsername(req.body?.username);
  if (!name.ok) return res.status(400).json({ error: 'bad_credentials' });
  const user = await store.findUser(name.value);
  if (!user || !verifyPassword(String(req.body?.password ?? ''), user.salt, user.hash)) {
    return res.status(401).json({ error: 'bad_credentials' });
  }
  res.json({ token: signToken(user.id), hasCharacter: !!(await store.getDoc(user.id)) });
});

app.post('/api/guest', newcomer.middleware(), async (req, res) => {
  const user = await store.createUser({ id: uid(), username: `guest_${uid().slice(0, 8)}`, guest: true });
  res.json({ token: signToken(user.id), hasCharacter: false });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const user = await store.findUserById(req.userId);
  // A guest's only credential is the token in their browser, so every visit
  // renews it. Without this a player who came back after the 30-day TTL found
  // an account they had no way to prove was theirs — which is the reset this
  // whole flow exists to prevent.
  const account = {
    guest: !!user?.guest, username: user?.guest ? '' : (user?.username || ''), token: signToken(req.userId),
    ...(isAdmin(user) ? { admin: true } : {}),
  };
  const doc = await store.getDoc(req.userId);
  if (!doc) return res.json({ hasCharacter: false, ...account });
  normalizeDoc(doc);
  await store.saveDoc(doc);
  res.json({ hasCharacter: true, profile: publicProfile(doc), ...account });
});

// Put a name and a password on a guest account, keeping its id — and therefore
// its document, its level, its dex and its place in the leaderboard. This is
// the whole point of letting anyone in without a form: the account is real from
// the first click, and claiming it only adds a way to prove it is yours.
app.post('/api/claim', knock.middleware(), requireAuth, async (req, res) => {
  const user = await store.findUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  if (!user.guest) return res.status(409).json({ error: 'already_claimed' });
  const name = validateUsername(req.body?.username);
  if (!name.ok) return res.status(400).json({ error: name.reason });
  const password = String(req.body?.password ?? '');
  if (password.length < 6) return res.status(400).json({ error: 'weak_password' });
  if (await store.findUser(name.value)) return res.status(409).json({ error: 'username_taken' });
  const { salt, hash } = hashPassword(password);
  const prev = user.username;
  const claimed = { ...user, username: name.value, salt, hash, guest: false, claimedAt: Date.now() };
  await store.replaceUser(prev, claimed);
  res.json({ token: signToken(claimed.id), username: claimed.username });
});

app.post('/api/character', requireAuth, async (req, res) => {
  if (await store.getDoc(req.userId)) return res.status(409).json({ error: 'already_exists' });
  const name = String(req.body?.name ?? '').trim().slice(0, 16);
  if (name.length < 2) return res.status(400).json({ error: 'invalid_name' });
  const starter = STARTERS.includes(req.body?.starter) ? req.body.starter : STARTERS[0];
  const a = req.body?.appearance || {};
  // A kind, a look and a skin from the palette; anything else falls back.
  // (A client from before kinds sends an outfit, which picks the kind.)
  const appearance = avatarLook({
    kind: a.kind, look: a.look, body: a.body, outfit: a.outfit,
    skin: AVATAR.skins.includes(a.skin) ? a.skin : AVATAR.skins[1],
  });
  const doc = createPlayerDoc(req.userId, name, appearance, starter);
  normalizeDoc(doc);
  await store.saveDoc(doc);
  res.json({ profile: publicProfile(doc) });
});

app.get('/api/leaderboard', requireAuth, async (req, res) => {
  // GMs can hand themselves anything, so they are left off the board.
  res.json(await store.leaderboard(String(req.query.kind || 'level'), 50, await adminIds(store)));
});
app.get('/api/guilds', requireAuth, async (req, res) => res.json(await store.listGuilds()));

// Gold in and out since this process started, by source and by hour
// (game/economy.js). GMs only: it is the game's books.
app.get('/api/admin/economy', requireAuth, async (req, res) => {
  const user = await store.findUserById(req.userId);
  if (!isAdmin(user)) return res.status(403).json({ error: 'forbidden' });
  res.json(economyReport());
});

// The built client, when it is served from the same origin.
const webRoot = path.resolve('dist/web');
if (fs.existsSync(webRoot)) {
  // The build writes each script brotli'd and gzipped beside it (tools/build.mjs):
  // a quarter of the bytes, compressed once rather than on every request. A
  // hashed name never changes its content, so the browser may keep it for a
  // year; the page, the service worker and version.json must always be asked for.
  const TYPES = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8', '.json': 'application/json' };
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const name = path.basename(req.path);
    const hashed = /^(main|chunk)\.[A-Z0-9]+\.js$/i.test(name);
    if (name === 'index.html' || req.path === '/' || name === 'sw.js' || name === 'version.json') res.setHeader('cache-control', 'no-cache');
    if (!hashed) return next();
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.setHeader('vary', 'accept-encoding');
    const file = path.join(webRoot, name);
    for (const [enc, ext] of [['br', '.br'], ['gzip', '.gz']]) {
      if (req.acceptsEncodings(enc) === enc && fs.existsSync(file + ext)) {
        res.setHeader('content-encoding', enc);
        res.setHeader('content-type', TYPES['.js']);
        return res.sendFile(file + ext);
      }
    }
    next();
  });
  app.use(express.static(webRoot, { maxAge: '1h', index: 'index.html', setHeaders: (res, f) => {
    const n = path.basename(f);
    if (n === 'index.html' || n === 'sw.js' || n === 'version.json') res.setHeader('cache-control', 'no-cache');
    else if (/^(main|chunk)\.[A-Z0-9]+\.js$/i.test(n)) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
  } }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.setHeader('cache-control', 'no-cache');
    res.sendFile(path.join(webRoot, 'index.html'));
  });
}

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });

// Every room needs the store; passing it through options keeps the rooms free
// of module-level singletons, which is what makes them testable.
gameServer.define('world', WorldRoom, { store })
  .filterBy(['zone']);   // one room per zone, players in a zone share it
gameServer.define('battle', BattleRoom, { store });
gameServer.define('dungeon', DungeonRoom, { store });

await gameServer.listen(PORT);
console.log(`[hobile] listening on :${PORT}  (db=${process.env.DB_DRIVER || 'memory'}, cors=${CORS_ORIGIN})`);

const shutdown = async () => {
  console.log('[hobile] shutting down');
  await gameServer.gracefullyShutdown(false).catch(() => {});
  await store.close().catch(() => {});
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
