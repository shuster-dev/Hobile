// End-to-end: boot the real server, connect two real clients, prove they see
// each other. This is the check that "multiplayer" is not a claim on a diagram.
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';

const PORT = 2573;
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 6000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await wait(100); }
  return false;
};

const server = spawn(process.execPath, ['src/server/index.js'], {
  env: { ...process.env, PORT: String(PORT), AUTH_SECRET: 'test-secret', NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push('ERR ' + String(d)));
const up = await until(async () => {
  try { const r = await fetch(`${BASE}/api/health`); return r.ok; } catch { return false; }
}, 15000);
ok('server starts', up, serverLog.join('').slice(-400));
if (!up) { server.kill(); process.exit(1); }

const api = async (p, body, token) => {
  const r = await fetch(BASE + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// accounts
const a = await api('/api/register', { username: 'alice', password: 'hunter2' });
const b = await api('/api/register', { username: 'bob', password: 'hunter2' });
ok('two accounts register', a.status === 200 && b.status === 200, JSON.stringify(a.json));
ok('a duplicate username is refused', (await api('/api/register', { username: 'alice', password: 'hunter2' })).status === 409);
ok('a wrong password is refused', (await api('/api/login', { username: 'alice', password: 'nope' })).status === 401);
ok('the right password logs in', (await api('/api/login', { username: 'alice', password: 'hunter2' })).status === 200);
ok('an unauthenticated /me is refused', (await api('/api/me')).status === 401);

await api('/api/character', { name: 'Alice', starter: 'cindcub' }, a.json.token);
await api('/api/character', { name: 'Bob', starter: 'puddlet' }, b.json.token);
const me = await api('/api/me', null, a.json.token);
ok('the character persists', me.json.hasCharacter && me.json.profile.name === 'Alice');
ok('a second character on one account is refused',
  (await api('/api/character', { name: 'Again' }, a.json.token)).status === 409);

// The whole point of the guest-first flow: an account that is real from the
// first click, and a claim that keeps everything it earned.
const g = await api('/api/guest', {});
ok('a guest gets a session with no form', g.status === 200 && !!g.json.token);
const gMe = await api('/api/me', null, g.json.token);
ok('a guest is reported as one', gMe.json.guest === true && gMe.json.username === '');
ok('/me hands back a fresh token', typeof gMe.json.token === 'string' && gMe.json.token.length > 10);
await api('/api/character', { name: 'Ghost', starter: 'sproutle' }, g.json.token);
const asGuest = await api('/api/me', null, g.json.token);
ok('a guest can play and be saved', asGuest.json.hasCharacter && asGuest.json.profile.name === 'Ghost');

ok('claiming a name that is taken is refused',
  (await api('/api/claim', { username: 'alice', password: 'hunter2' }, g.json.token)).status === 409);
ok('claiming with a short password is refused',
  (await api('/api/claim', { username: 'ghosty', password: 'abc' }, g.json.token)).status === 400);
const claim = await api('/api/claim', { username: 'ghosty', password: 'hunter2' }, g.json.token);
ok('a guest can claim a username', claim.status === 200 && claim.json.username === 'ghosty', JSON.stringify(claim.json));

const asOwner = await api('/api/me', null, claim.json.token);
ok('the character survives the claim',
  asOwner.json.hasCharacter && asOwner.json.profile.name === 'Ghost'
  && asOwner.json.profile.id === asGuest.json.profile.id,
  `${asGuest.json.profile?.id} -> ${asOwner.json.profile?.id}`);
ok('the claimed account is no longer a guest', asOwner.json.guest === false && asOwner.json.username === 'ghosty');
ok('the old token still points at the same character',
  (await api('/api/me', null, g.json.token)).json.profile?.id === asGuest.json.profile.id);
ok('claiming twice is refused',
  (await api('/api/claim', { username: 'ghostier', password: 'hunter2' }, claim.json.token)).status === 409);

// and the reason any of this matters: coming back from a different browser
const back = await api('/api/login', { username: 'ghosty', password: 'hunter2' });
ok('the claimed account logs in from nowhere', back.status === 200 && back.json.hasCharacter === true);
ok('and lands on the same character',
  (await api('/api/me', null, back.json.token)).json.profile?.id === asGuest.json.profile.id);
ok('the guest username is gone from the lookup',
  (await api('/api/login', { username: 'ghosty', password: 'wrong' })).status === 401);

// world
const clientA = new Client(`ws://127.0.0.1:${PORT}`);
const clientB = new Client(`ws://127.0.0.1:${PORT}`);
const roomA = await clientA.joinOrCreate('world', { zone: 'aetherport', token: a.json.token });
const roomB = await clientB.joinOrCreate('world', { zone: 'aetherport', token: b.json.token });
ok('both clients land in the same room', roomA.roomId === roomB.roomId, `${roomA.roomId} vs ${roomB.roomId}`);

const chats = [];
roomB.onMessage('chat', (m) => chats.push(m));
const zoneSeen = [];
roomA.onMessage('zone', (z) => zoneSeen.push(z));
roomA.send('ready');
await wait(400);
ok('ready answers with the zone', zoneSeen.length > 0 && zoneSeen[0].id === 'aetherport');

ok('each client sees both players',
  await until(() => roomA.state.players.size === 2 && roomB.state.players.size === 2, 5000),
  `A=${roomA.state.players.size} B=${roomB.state.players.size}`);
ok('wilds are spawned and replicated', await until(() => roomA.state.wilds.size >= 10, 5000),
  String(roomA.state.wilds.size));

// movement replicates
const selfA = [...roomA.state.players.entries()].find(([, p]) => p.name === 'Alice');
const startX = selfA[1].x;
roomA.send('move', { x: startX + 1.5, z: selfA[1].z, rot: 1, moving: true });
ok('a move is replicated to the other client',
  await until(() => {
    const seen = [...roomB.state.players.values()].find((p) => p.name === 'Alice');
    return seen && Math.abs(seen.x - startX) > 0.2;
  }, 5000));

// the server is authoritative about distance
const before = [...roomA.state.players.values()].find((p) => p.name === 'Alice').x;
roomA.send('move', { x: before + 400, z: 0, rot: 0, moving: true });
await wait(500);
const after = [...roomA.state.players.values()].find((p) => p.name === 'Alice').x;
ok('a teleport packet is clamped by the server', Math.abs(after - before) < 50, `moved ${(after - before).toFixed(1)}m`);

// chat crosses between players
roomA.send('chat', { ch: 'zone', text: 'שלום' });
ok('zone chat reaches the other player',
  await until(() => chats.some((m) => m.text === 'שלום'), 5000),
  JSON.stringify(chats.slice(-2)));

// engaging a wild hands back a battle room
const gotos = [], errs = [];
roomA.onMessage('goto', (g) => gotos.push(g));
roomA.onMessage('error', (e) => errs.push(e));
const here = () => [...roomA.state.players.values()].find((p) => p.name === 'Alice');
const wild = [...roomA.state.wilds.values()]
  .sort((u, v) => Math.hypot(u.x - here().x, u.z - here().z) - Math.hypot(v.x - here().x, v.z - here().z))[0];
// Walk there. One packet cannot cover the distance any more - that is the
// clamp working - so this steps like a player would.
for (let i = 0; i < 400; i++) {
  const p = here();
  if (Math.hypot(wild.x - p.x, wild.z - p.z) < 5) break;
  roomA.send('move', { x: wild.x, z: wild.z, rot: 0, moving: true });
  await wait(25);
}
ok('walking across the zone reaches the wild',
  Math.hypot(wild.x - here().x, wild.z - here().z) < 8,
  Math.hypot(wild.x - here().x, wild.z - here().z).toFixed(1) + 'm away');
roomA.send('engage', { wildId: wild.id });
const gotBattle = await until(() => gotos.some((g) => g.kind === 'battle'), 6000);
ok('engaging a wild returns a battle room', gotBattle, JSON.stringify(errs));
ok('the wild is marked as taken while the fight is on',
  await until(() => !!roomA.state.wilds.get(wild.id)?.engagedBy, 4000),
  roomA.state.wilds.get(wild.id)?.engagedBy || '(empty)');

if (gotBattle) {
  const battleRoom = await clientA.joinById(gotos.find((g) => g.kind === 'battle').roomId, { token: a.json.token });
  const inits = [];
  battleRoom.onMessage('battleInit', (m) => inits.push(m));
  battleRoom.send('ready');
  ok('the battle room sends battleInit', await until(() => inits.length > 0, 6000));
  ok('battle state replicates the combatants',
    await until(() => battleRoom.state.combatants.size >= 2, 6000), String(battleRoom.state.combatants.size));
  ok('the trainer is present in the synced battle state',
    [...battleRoom.state.combatants.values()].some((c) => c.kind === 'trainer'));
  ok('benched and slot survive the wire',
    [...battleRoom.state.combatants.values()].every((c) => typeof c.benched === 'boolean' && Number.isFinite(c.slot)));

  // Asking for the state again must not give back less of it. The "ready"
  // handler used to send a shorter battleInit with no team, no trainer and no
  // weather, and the client assigns all three unconditionally — so a re-sync
  // emptied the bench out of the switch UI.
  const first = inits[0];
  ok('the first init carries the team and the trainer',
    Array.isArray(first.team) && first.team.length > 0 && !!first.trainer, JSON.stringify(Object.keys(first)));
  battleRoom.send('ready');
  ok('asking again returns a second init', await until(() => inits.length > 1, 6000));
  const again = inits[inits.length - 1];
  ok('and it is the same payload, not a shorter one',
    JSON.stringify(again.team) === JSON.stringify(first.team)
    && again.trainer === first.trainer
    && JSON.stringify(again.weather ?? null) === JSON.stringify(first.weather ?? null),
    JSON.stringify({ team: again.team?.length, trainer: again.trainer, weather: again.weather }));
  await battleRoom.leave();
  // Walking out of a fight has to give the creature back. `engage` sets
  // `engagedBy` and only `onEnd` clears it, and online that callback was filed
  // in a map nothing read — so every fight permanently bricked one wild: still
  // standing, no longer wandering, impossible to engage again.
  ok('leaving the fight releases the creature',
    await until(() => {
      const w = roomA.state.wilds.get(wild.id);
      return !w || !w.engagedBy;
    }, 8000),
    roomA.state.wilds.get(wild.id)?.engagedBy || '(gone or released)');
}

// NPCs speak — online, not just in the offline build, whose copy of this was
// the only one that worked: the server answered every NPC with no lines.
{
  const { NPCS, npcAt } = await import('../src/shared/npcs.js');
  const { DAY_MS } = await import('../src/server/game/combat.js');
  const phase = () => (Date.now() % DAY_MS / DAY_MS + 1) % 1;
  const me = () => [...roomA.state.players.values()].find((p) => p.name === 'Alice');
  const id = Object.keys(NPCS).filter((k) => !NPCS[k].zone || NPCS[k].zone === 'aetherport')
    .sort((x, y) => { const p = me(), a = npcAt(x, phase()), b = npcAt(y, phase());
      return Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z); })[0];
  for (let i = 0; i < 80; i++) {
    const p = me(), at = npcAt(id, phase()), dx = at.x - p.x, dz = at.z - p.z, d = Math.hypot(dx, dz);
    if (d < 2.5) break;
    const k = Math.min(2.5, d - 1.5) / d;
    roomA.send('move', { x: p.x + dx * k, z: p.z + dz * k, rot: 0, moving: true });
    await wait(60);
  }
  const said = [];
  roomA.onMessage('dialogue', (m) => said.push(m));
  roomA.send('talk', { npcId: id });
  ok(`an NPC answers when spoken to (${id})`, await until(() => said.length > 0, 4000)
    && said[0].lines?.length > 0 && !!said[0].lines[0].he, JSON.stringify(said[0] || {}).slice(0, 160));
}

// persistence across a reconnect
await roomA.leave();
await wait(400);
const me2 = await api('/api/me', null, a.json.token);
ok('the document survives leaving the room', me2.json.hasCharacter && me2.json.profile.name === 'Alice');

await roomB.leave();
server.kill('SIGTERM');
await wait(300);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('\nserver log:\n' + serverLog.join('').slice(-1500));
process.exit(fail ? 1 : 0);
