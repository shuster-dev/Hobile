import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';

import { openStore } from './store.js';
import { hashPassword, verifyPassword, signToken, verifyToken, validateUsername } from './auth.js';
import { adminIds, isAdmin, reportAdmins } from './admin.js';
import { WorldRoom } from './rooms/WorldRoom.js';
import { BattleRoom } from './rooms/BattleRoom.js';
import { DungeonRoom } from './rooms/DungeonRoom.js';
import { createPlayerDoc, normalizeDoc, publicProfile, uid } from './game/combat.js';
import { HOME_ZONE, ZONES, STARTERS, AVATAR } from '../shared/gamedata.js';

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
const app = express();
app.use(express.json({ limit: '64kb' }));
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

app.post('/api/register', async (req, res) => {
  const name = validateUsername(req.body?.username);
  if (!name.ok) return res.status(400).json({ error: name.reason });
  const password = String(req.body?.password ?? '');
  if (password.length < 6) return res.status(400).json({ error: 'weak_password' });
  if (await store.findUser(name.value)) return res.status(409).json({ error: 'username_taken' });
  const { salt, hash } = hashPassword(password);
  const user = await store.createUser({ id: uid(), username: name.value, salt, hash });
  res.json({ token: signToken(user.id), hasCharacter: false });
});

app.post('/api/login', async (req, res) => {
  const name = validateUsername(req.body?.username);
  if (!name.ok) return res.status(400).json({ error: 'bad_credentials' });
  const user = await store.findUser(name.value);
  if (!user || !verifyPassword(String(req.body?.password ?? ''), user.salt, user.hash)) {
    return res.status(401).json({ error: 'bad_credentials' });
  }
  res.json({ token: signToken(user.id), hasCharacter: !!(await store.getDoc(user.id)) });
});

app.post('/api/guest', async (req, res) => {
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
app.post('/api/claim', requireAuth, async (req, res) => {
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
  const appearance = {
    body: AVATAR.bodies.includes(a.body) ? a.body : AVATAR.bodies[0],
    skin: AVATAR.skins.includes(a.skin) ? a.skin : AVATAR.skins[0],
    hair: AVATAR.hair.includes(a.hair) ? a.hair : AVATAR.hair[0],
    outfit: AVATAR.outfits.some((o) => o.id === a.outfit) ? a.outfit : AVATAR.outfits[0].id,
  };
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

// The built client, when it is served from the same origin.
const webRoot = path.resolve('dist/web');
if (fs.existsSync(webRoot)) {
  app.use(express.static(webRoot, { maxAge: '1h', index: 'index.html' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
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
