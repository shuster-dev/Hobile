/**
 * One player, two sessions, one truth.
 *
 *   node tools/store-test.mjs                                  # the memory store
 *   DB_DRIVER=mongo MONGO_URL=mongodb://127.0.0.1:27017/ \
 *     node tools/store-test.mjs                                # the one production runs
 *
 * The memory store hands every room the same object for a player, so anything
 * one room changes the next room already has. MongoDB hands each caller its own
 * copy, and whoever saves last wins. Every other test in this repo runs on the
 * memory store, which is how a store that loses progress could pass all of them.
 *
 * The case that matters is the one a phone makes on its own: iOS does not close
 * a backgrounded tab's socket straight away, so the player reopens the game while
 * the old session is still in the room holding changes the 20-second autosave has
 * not written yet. The new session must see them, and they must survive both
 * sessions leaving, in whichever order.
 *
 * And then the server restarts — which on a free Render instance is every wake
 * after 15 idle minutes — so the last word comes from a process with nothing in
 * memory. Without that step a store that only ever cached would pass.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from 'colyseus.js';

const PORT = 2577;
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await wait(50); }
  return false;
};

const driver = (process.env.DB_DRIVER || 'memory').toLowerCase();
console.log(`store: ${driver}\n`);

// A database of its own per run, so a previous run's players are not this one's.
// The memory store gets a file, so the restart below means the same for both.
const RUN = Date.now().toString(36);
const env = {
  ...process.env, PORT: String(PORT), AUTH_SECRET: 'store-test', NODE_ENV: 'test',
  MONGO_DB: process.env.MONGO_DB || `store_test_${RUN}`,
  DATA_FILE: process.env.DATA_FILE || path.join(os.tmpdir(), `hobile-store-test-${RUN}.json`),
};
const log = [];
let server = null;
const start = async () => {
  server = spawn(process.execPath, ['src/server/index.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (d) => log.push(String(d)));
  server.stderr.on('data', (d) => log.push('ERR ' + String(d)));
  return until(async () => {
    try { return (await fetch(`${BASE}/api/health`)).ok; } catch { return false; }
  }, 20000);
};
// SIGTERM, the way a platform stops a process, so the server's own shutdown runs.
const stop = () => new Promise((resolve) => {
  if (!server || server.exitCode !== null) return resolve();
  server.once('exit', resolve);
  server.kill('SIGTERM');
  setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 8000);
});
const finish = async () => { await stop(); fs.rmSync(env.DATA_FILE, { force: true }); };

const up = await start();
ok('the server starts on this store', up, log.join('').slice(-400));
if (!up) { await finish(); process.exit(1); }

const api = async (p, body, token) => {
  const r = await fetch(BASE + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const guest = await api('/api/guest', {});
const token = guest.json.token;
await api('/api/character', { name: 'Twice', starter: 'sproutle' }, token);
const fresh = (await api('/api/me', null, token)).json.profile;
ok('a fresh character', !!fresh?.id, JSON.stringify(fresh).slice(0, 120));

// Each session keeps the newest profile the server has sent it.
const join = async () => {
  const client = new Client(`ws://127.0.0.1:${PORT}`);
  const room = await client.joinOrCreate('world', { zone: 'aetherport', token });
  const seen = { profile: null, errors: [] };
  room.onMessage('*', () => {});
  room.onMessage('profile', (p) => { seen.profile = p; });
  room.onMessage('error', (e) => seen.errors.push(e?.code));
  room.send('ready');
  await until(() => !!seen.profile, 5000);
  return { room, seen };
};

// --- session one buys something, and the autosave has not run -------------
const one = await join();
const ITEM = 'fiber';
one.room.send('shopBuy', { itemId: ITEM, qty: 1 });
ok('the purchase goes through',
  await until(() => one.seen.profile && one.seen.profile.gold < fresh.gold, 5000),
  `gold ${fresh.gold} -> ${one.seen.profile?.gold}; errors ${one.seen.errors.join(',')}`);
const bought = one.seen.profile.gold;

// --- the same player opens the game again, before session one has gone -----
const me = (await api('/api/me', null, token)).json.profile;
ok('a second session sees the purchase the first one made',
  me?.gold === bought, `second session sees ${me?.gold} gold, first has ${bought}`);

const two = await join();
ok('and so does the world it joins',
  two.seen.profile?.gold === bought, `joined with ${two.seen.profile?.gold} gold, first has ${bought}`);

// --- both leave: the stale one last, which is the order that loses data -----
await one.room.leave(true);
await wait(300);
await two.room.leave(true);
await wait(600);

const holds = (p) => (p?.inventory || [])?.find?.((i) => i.id === ITEM)?.qty
  ?? p?.inventory?.[ITEM] ?? p?.items?.[ITEM];

const after = (await api('/api/me', null, token)).json.profile;
ok('the purchase survives both sessions leaving',
  after?.gold === bought, `saved ${after?.gold} gold, should be ${bought}`);
ok('and so does the thing that was bought', !!holds(after), JSON.stringify(after?.inventory || after?.items || {}).slice(0, 160));

// --- the process goes away, as a sleeping instance's does ------------------
await stop();
ok('the server comes back up on the same data', await start(), log.join('').slice(-300));
const cold = (await api('/api/me', null, token)).json.profile;
ok('after a restart the purchase is still there — it reached the database, not just memory',
  cold?.gold === bought && !!holds(cold), `after restart: ${cold?.gold} gold, item ${JSON.stringify(holds(cold))}`);

await finish();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
