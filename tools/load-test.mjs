/**
 * Load test: a crowd of bots on a real server — accounts, characters, a zone,
 * walking about at a legal pace, chatting now and then, pinging — and what the
 * server does under them: round trips, memory and CPU, how the zone split
 * into channels, who was dropped.
 *
 *   node tools/load-test.mjs [bots=200] [seconds=60]
 *   BOTS=500 SECS=90 node tools/load-test.mjs
 *
 * It starts its own server (memory store, NODE_ENV=test) unless BASE is set,
 * in which case it measures that one (and cannot read its CPU).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { Client } from 'colyseus.js';

const N = Number(process.argv[2] || process.env.BOTS || 200);
const SECS = Number(process.argv[3] || process.env.SECS || 60);
const PORT = Number(process.env.PORT || 2591);
const ZONE = process.env.ZONE || 'aetherport';
const PER_ZONE = Number(process.env.MAX_PLAYERS_PER_ZONE || 60);
const external = process.env.BASE || null;
const BASE = external || `http://127.0.0.1:${PORT}`;
const WS = BASE.replace(/^http/, 'ws');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
if (!external) {
  server = spawn(process.execPath, ['src/server/index.js'], {
    env: { ...process.env, PORT: String(PORT), AUTH_SECRET: 'load', NODE_ENV: 'test', DB_DRIVER: 'memory', DATA_FILE: '', MAX_PLAYERS_PER_ZONE: String(PER_ZONE) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {}); server.stderr.on('data', (d) => process.env.VERBOSE && process.stderr.write(d));
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch {} await wait(150); }
}

/** CPU (ms of user+system) and memory of the server process, from /proc. */
function proc() {
  if (!server) return null;
  try {
    const st = fs.readFileSync(`/proc/${server.pid}/stat`, 'utf8').split(') ')[1].split(' ');
    const tick = 100;   // USER_HZ
    const cpuMs = (Number(st[11]) + Number(st[12])) * 1000 / tick;
    const rss = Number(fs.readFileSync(`/proc/${server.pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1]) * 1024;
    return { cpuMs, rss };
  } catch { return null; }
}

const api = async (path, body, token) => {
  const r = await fetch(BASE + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return r.json().catch(() => ({}));
};

const rtts = [], joins = [], channels = new Map(), botChannel = new Map();
let dropped = 0, errors = 0, chats = 0, moves = 0, joined = 0;

async function bot(i) {
  const t0 = Date.now();
  const { token } = await api('/api/guest', {});
  await api('/api/character', { name: `Bot${i}`, starter: ['cindcub', 'sproutle', 'shellop'][i % 3], appearance: { kind: ['rogue', 'mage', 'pirate', 'catcher'][i % 4], look: i % 2 ? 'b' : 'a' } }, token);
  const client = new Client(WS);
  const room = await client.joinOrCreate('world', { zone: ZONE, token });
  joins.push(Date.now() - t0);
  joined++;
  let me = null, alive = true, target = null;
  room.onMessage('zone', (z) => { channels.set(room.roomId, z.channel); botChannel.set(i, z.channel); });
  room.onMessage('pong', (m) => { if (m.t) rtts.push(Date.now() - m.t); });
  room.onMessage('error', () => { errors++; });
  room.onMessage('*', () => {});
  room.onLeave((code) => { alive = false; if (code !== 1000) dropped++; });
  room.send('ready');
  const findMe = () => { for (const p of room.state.players.values()) if (p.name === `Bot${i}`) return p; return null; };
  // walk: toward a random point, at 6 m/s, 12 moves a second; ping every 5s; a line of chat now and then
  let last = Date.now(), lastPing = 0, nextChat = Date.now() + 20_000 + Math.random() * 60_000;
  const step = setInterval(() => {
    if (!alive) return clearInterval(step);
    me = me || findMe();
    if (!me) return;
    const now = Date.now(), dt = (now - last) / 1000; last = now;
    if (!target || Math.hypot(target.x - me.x, target.z - me.z) < 2) target = { x: (Math.random() - 0.5) * 140, z: (Math.random() - 0.5) * 140 };
    const dx = target.x - me.x, dz = target.z - me.z, d = Math.hypot(dx, dz) || 1, go = Math.min(d, 6 * dt);
    room.send('move', { x: me.x + dx / d * go, z: me.z + dz / d * go, rot: Math.atan2(dx, dz), moving: true });
    moves++;
    if (now - lastPing > 5000) { lastPing = now; room.send('ping', { t: now }); }
    if (now > nextChat) { nextChat = now + 60_000 + Math.random() * 60_000; room.send('chat', { ch: 'zone', text: `hello from bot ${i}` }); chats++; }
  }, 83);
  return { room, stop: () => { alive = false; clearInterval(step); return room.leave(true).catch(() => {}); } };
}

console.log(`[load] ${N} bots into ${ZONE} (${PER_ZONE} a channel) for ${SECS}s → ${BASE}`);
const p0 = proc(), tStart = Date.now();
const bots = [];
// arrive in waves, as a crowd does: 25 a second
for (let i = 0; i < N; i += 25) {
  const wave = await Promise.allSettled(Array.from({ length: Math.min(25, N - i) }, (_, k) => bot(i + k)));
  for (const w of wave) w.status === 'fulfilled' ? bots.push(w.value) : (errors++, process.env.VERBOSE && console.warn(w.reason?.message));
  await wait(1000);
}
const tJoined = Date.now(), pJoined = proc();
console.log(`[load] ${bots.length}/${N} in after ${((tJoined - tStart) / 1000).toFixed(1)}s`);
rtts.length = 0;
const samples = [];
for (let s = 0; s < SECS; s += 5) { await wait(5000); const p = proc(); p && samples.push(p); }
const pEnd = proc(), tEnd = Date.now();

const q = (arr, k) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * k))] : null; };
const cpu = pJoined && pEnd ? (pEnd.cpuMs - pJoined.cpuMs) / (tEnd - tJoined) * 100 : null;
const byChannel = {};
for (const ch of botChannel.values()) byChannel[ch] = (byChannel[ch] || 0) + 1;
const report = {
  bots: N, in: bots.length, channels: channels.size, botsPerChannel: byChannel,
  joinMs: { p50: q(joins, 0.5), p95: q(joins, 0.95) },
  rttMs: { n: rtts.length, p50: q(rtts, 0.5), p95: q(rtts, 0.95), p99: q(rtts, 0.99), max: q(rtts, 1) },
  serverCpuPct: cpu != null ? Math.round(cpu) : null,
  serverRssMB: pEnd ? Math.round(pEnd.rss / 1048576) : null,
  rssPerBotKB: pEnd && p0 ? Math.round((pEnd.rss - p0.rss) / 1024 / Math.max(1, bots.length)) : null,
  movesPerSec: Math.round(moves / ((tEnd - tStart) / 1000)), chats, dropped, errors,
};
console.log(JSON.stringify(report, null, 2));
await Promise.allSettled(bots.map((b) => b.stop()));
server?.kill('SIGTERM');
process.exit(0);
