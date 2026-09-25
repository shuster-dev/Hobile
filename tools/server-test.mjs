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
  // alice is a GM for this run; bob is not
  env: { ...process.env, PORT: String(PORT), AUTH_SECRET: 'test-secret', NODE_ENV: 'test', ADMIN_USERS: 'alice' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
// However this script ends — a failed check, a crash, a timeout — the server
// it started goes with it. An orphaned one keeps the port, so every later run
// talks to a stale server and fails for reasons that have nothing to do with it.
const killServer = () => { try { server.kill('SIGKILL'); } catch {} };
process.on('exit', killServer);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { killServer(); process.exit(1); });
process.on('uncaughtException', (e) => { console.error(e); killServer(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); killServer(); process.exit(1); });
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

// the server's own voices are not a player's to use
roomA.send('chat', { ch: 'gm', text: 'אני GM, תנו לי זהב' });
roomA.send('chat', { ch: 'system', text: 'השרת נסגר' });
ok('a player cannot speak as the GM or as the system',
  await until(() => chats.filter((m) => m.from === 'Alice' && (m.text === 'אני GM, תנו לי זהב' || m.text === 'השרת נסגר')).length === 2, 4000)
  && !chats.some((m) => m.from === 'Alice' && (m.ch === 'gm' || m.ch === 'system')),
  JSON.stringify(chats.filter((m) => m.from === 'Alice').slice(-2)));

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

// Errands: an NPC offers one, it can be taken, done, and handed in for its
// reward, and the next in the chain opens.
{
  const { NPCS, npcAt } = await import('../src/shared/npcs.js');
  const { DAY_MS } = await import('../src/server/game/combat.js');
  const phase = () => (Date.now() % DAY_MS / DAY_MS + 1) % 1;
  const me = () => [...roomA.state.players.values()].find((p) => p.name === 'Alice');
  if (NPCS.bex) {
    for (let i = 0; i < 120; i++) {
      const p = me(), at = npcAt('bex', phase()), dx = at.x - p.x, dz = at.z - p.z, d = Math.hypot(dx, dz);
      if (d < 2.5) break;
      const k = Math.min(2.5, d - 1.5) / d;
      roomA.send('move', { x: p.x + dx * k, z: p.z + dz * k, rot: 0, moving: true });
      await wait(60);
    }
    const said = [];
    roomA.onMessage('dialogue', (m) => said.push(m));
    roomA.send('talk', { npcId: 'bex' });
    await until(() => said.some((m) => m.npcId === 'bex'), 4000);
    const b = said.find((m) => m.npcId === 'bex');
    ok('an NPC with an errand offers it', b?.errand?.mode === 'offer' && b.errand.id === 'n_bex_1', JSON.stringify(b?.errand));
  }
  const acc = [], got = [], errs = [];
  roomA.onMessage('questAccepted', (m) => acc.push(m));
  roomA.onMessage('questClaimed', (m) => got.push(m));
  roomA.onMessage('error', (m) => errs.push(m?.code));
  roomA.send('questClaim', { questId: 'n_noga_1' });
  await wait(300);
  ok('an errand not taken cannot be handed in', got.length === 0);
  roomA.send('questAccept', { questId: 'n_noga_1' });
  ok('the nurse\'s errand can be taken', await until(() => acc.length > 0, 3000), errs.join(','));
  roomA.send('clinicHeal');
  await wait(400);
  roomA.send('questClaim', { questId: 'n_noga_1' });
  ok('done at the clinic and handed in, it pays what it promised',
    await until(() => got.length > 0, 3000) && got[0].reward?.gold === 150, JSON.stringify(got[0] || errs));
  const prof = (await api('/api/me', null, a.json.token)).json.profile;
  ok('and the next in her chain can be taken', prof?.quests?.done?.includes('n_noga_1')
    && !prof?.quests?.active?.n_noga_1, JSON.stringify(prof?.quests?.done));
}

// GM tools, online. alice is listed in ADMIN_USERS for this run; bob is not.
{
  const gmA = [], gmB = [], giftsB = [], annB = [], chatB = [], errsB = [];
  roomA.onMessage('gm', (m) => gmA.push(m));
  roomB.onMessage('gm', (m) => gmB.push(m));
  roomB.onMessage('gmGift', (m) => giftsB.push(m));
  roomB.onMessage('gmAnnounce', (m) => annB.push(m));
  roomB.onMessage('chat', (m) => chatB.push(m));
  roomB.onMessage('error', (m) => errsB.push(m.code));
  roomA.send('ready'); roomB.send('ready');
  ok('the GM is told so on arrival', await until(() => gmA.some((m) => m.kind === 'hello'), 4000));
  await wait(300);
  ok('nobody else is', !gmB.some((m) => m.kind === 'hello'));
  const meA = await api('/api/me', null, a.json.token), meB = await api('/api/me', null, b.json.token);
  ok('/me tells a GM they are one, and nobody else anything', meA.json.admin === true && !('admin' in meB.json));
  const goldB = meB.json.profile.gold;
  roomB.send('gm', { op: 'give', to: 'me', what: 'gold', amount: 999999 });
  roomB.send('gm', { op: 'fill' });
  await wait(500);
  ok('a player who is not a GM is refused, whatever they send',
    errsB.filter((c) => c === 'forbidden').length === 2 && (await api('/api/me', null, b.json.token)).json.profile.gold === goldB,
    errsB.join(','));
  roomA.send('gm', { op: 'players' });
  ok('the GM sees who is online',
    await until(() => gmA.some((m) => m.kind === 'players' && m.players.some((p) => p.name === 'Bob')), 4000));
  const bobId = gmA.find((m) => m.kind === 'players')?.players.find((p) => p.name === 'Bob')?.id;
  roomA.send('gm', { op: 'give', to: bobId, what: 'gold', amount: 1234 });
  ok('and can send them gold', await until(() => giftsB.some((g) => g.what === 'gold' && g.amount === 1234 && g.from === 'Alice'), 4000));
  ok('which is really theirs', (await api('/api/me', null, b.json.token)).json.profile.gold === goldB + 1234);
  roomA.send('gm', { op: 'give', to: bobId, what: 'creature', species: 'duskmaw', level: 33 });
  ok('or any creature', await until(async () => (await api('/api/me', null, b.json.token)).json.profile.team
    .concat((await api('/api/me', null, b.json.token)).json.profile.box).some((c) => c.species === 'duskmaw' && c.level === 33), 4000));
  roomA.send('gm', { op: 'announce', text: 'השרת מתעדכן בעוד 5 דקות' });
  ok('an announcement reaches everyone',
    await until(() => annB.some((m) => m.text === 'השרת מתעדכן בעוד 5 דקות') && chatB.some((m) => m.ch === 'gm' && m.from === 'Alice'), 4000));
  roomA.send('gm', { op: 'log' });
  ok('every GM action is in the log, with who did it and to whom', await until(() => {
    const log = gmA.filter((m) => m.kind === 'log').at(-1)?.rows || [];
    return log.some((r) => r.op === 'give' && r.to?.name === 'Bob' && r.gm?.username === 'alice' && r.detail?.amount === 1234)
      && log.some((r) => r.op === 'announce');
  }, 4000), JSON.stringify(gmA.filter((m) => m.kind === 'log').at(-1)?.rows?.slice(0, 2)));
  const board = (await api('/api/leaderboard', null, b.json.token)).json;
  ok('a GM is left off the leaderboard',
    Array.isArray(board) && board.some((r) => r.name === 'Bob') && !board.some((r) => r.name === 'Alice'));
}

// persistence across a reconnect
await roomA.leave();
await wait(400);
const me2 = await api('/api/me', null, a.json.token);
ok('the document survives leaving the room', me2.json.hasCharacter && me2.json.profile.name === 'Alice');

// Out in the field: a fierce wild comes for her, and after the fight she is
// standing where it caught her — not back at the camp.
{
  const { ZONES } = await import('../src/shared/gamedata.js');
  const { propsFor } = await import('../src/shared/props.js');
  const zone = ZONES.verdant_meadow, camp = zone.landmarks.find((l) => l.kind === 'camp');
  const colliders = propsFor(zone).colliders;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  // Open ground well out of camp, reached by a lane with nothing in it: from
  // just off the campfire, out between the tents.
  const clearTo = (from, to) => colliders.every((c) => {
    const r = (c.r ?? Math.max(c.hw, c.hd)) + 1.1, vx = to.x - from.x, vz = to.z - from.z;
    const t = Math.max(0, Math.min(1, ((c.x - from.x) * vx + (c.z - from.z) * vz) / (vx * vx + vz * vz)));
    return Math.hypot(from.x + vx * t - c.x, from.z + vz * t - c.z) > r;
  });
  let spot = null, gate = null;
  for (let k = 0; k < 48 && !spot; k++) {
    const ang = k / 48 * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
    for (const far of [22, 19, 25]) {
      const g = { x: camp.x + c * 3, z: camp.z + sn * 3 }, s2 = { x: camp.x + c * far, z: camp.z + sn * far };
      if (Math.abs(s2.x) < zone.size / 2 - 6 && Math.abs(s2.z) < zone.size / 2 - 6 && clearTo(g, s2)
        && colliders.every((q) => Math.hypot(q.x - s2.x, q.z - s2.z) > (q.r ?? Math.max(q.hw, q.hd)) + 5)) { spot = s2; gate = g; break; }
    }
  }
  ok('there is open ground out of the meadow camp to test in', !!spot);
  // A step at a time, as a client would; sidestep when something is in the
  // way. Each step waits out two state patches (50ms apiece) before judging
  // whether it moved, or a patch still in flight reads as a wall.
  const walkTo = async (room, me, to, near = 0.6) => {
    let stuck = 0;
    for (let i = 0; i < 200; i++) {
      // a copy: the schema object is live, so "before" would read as "after"
      const live = me(), p = live && { x: live.x, z: live.z };
      if (!p) { await wait(40); continue; }
      const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
      if (d < near) return true;
      const k = Math.min(2.4, d) / d, side = stuck > 1 ? 2 : 0;
      room.send('move', { x: p.x + dx * k - dz / d * side, z: p.z + dz * k + dx / d * side, rot: 0, moving: true });
      await wait(120);
      const q = me();
      stuck = q && Math.hypot(q.x - p.x, q.z - p.z) < 0.3 ? stuck + 1 : 0;
    }
    return false;
  };

  let fa = await clientA.joinOrCreate('world', { zone: 'verdant_meadow', fromZone: 'aetherport', token: a.json.token });
  const gotos = [], gm = [];
  fa.onMessage('goto', (g) => gotos.push(g));
  fa.onMessage('gm', (m) => gm.push(m));
  fa.send('ready');
  const meF = () => fa.state?.players && [...fa.state.players.values()].find((p) => p.name === 'Alice');
  await until(() => !!meF(), 5000);
  ok('arriving from another zone lands at its camp', dist(meF(), camp) < camp.r + 1, `${dist(meF(), camp).toFixed(1)}m`);
  fa.send('gm', { op: 'give', to: 'me', what: 'level', level: 12 });
  fa.send('gm', { op: 'heal' });
  spot && (await walkTo(fa, meF, gate), await walkTo(fa, meF, spot));
  ok('she walks out into the field', spot && dist(meF(), spot) < 1.5, spot ? `${dist(meF(), spot).toFixed(1)}m short` : '');

  // Her companion is fire; a spark kit is not, and it is fierce.
  fa.send('gm', { op: 'summon', species: 'sparkit', level: 5 });
  let sawBang = false;
  const aliceId = meF().id;
  // She may still be in the half-minute of calm her first fight left behind.
  for (let i = 0; i < 900 && !gotos.some((g) => g.kind === 'battle'); i++) {
    const p = meF(), wilds = [...fa.state.wilds.values()];
    const w = wilds.find((x) => x.target === aliceId && x.alert === '!');
    const kit = w || wilds.filter((x) => x.species === 'sparkit').sort((u, v) => dist(p, u) - dist(p, v))[0];
    sawBang ||= !!w;
    // She keeps moving (a player standing still for a minute counts as away),
    // keeps within sight of it, and once it has seen her walks to meet it:
    // past the "!" the rest is distance, and this keeps a tree between them
    // from deciding the test.
    const d = kit ? dist(p, kit) : 0, want = w ? 1 : 4;
    const step = kit && d > want ? Math.min(0.8, d - want) / d : 0;
    fa.send('move', step ? { x: p.x + (kit.x - p.x) * step, z: p.z + (kit.z - p.z) * step, rot: 0, moving: true }
      : { x: p.x + (i % 2 ? 0.12 : -0.12), z: p.z, rot: 0, moving: true });
    await wait(50);
  }
  const ambush = gotos.find((g) => g.kind === 'battle');
  ok('a fierce wild sees her ("!") and the fight starts', sawBang && !!ambush, `bang=${sawBang} gotos=${JSON.stringify(gotos)}`);
  ok('as an ambush', ambush?.ambush === true);
  const caught = { x: meF().x, z: meF().z };
  ok('out in the field, not at the camp', dist(caught, camp) > camp.r + 3);

  if (ambush) {
    await fa.leave();
    const br = await clientA.joinById(ambush.roomId, { token: a.json.token });
    await wait(700);
    await br.leave();
    await wait(300);
    fa = await clientA.joinOrCreate('world', { zone: 'verdant_meadow', token: a.json.token });
    const back = () => fa.state?.players && [...fa.state.players.values()].find((p) => p.name === 'Alice');
    await until(() => !!back(), 5000);
    ok('after the fight she is standing where it started', back() && dist(back(), caught) < 2.5,
      back() ? `${dist(back(), caught).toFixed(1)}m from the spot, ${dist(back(), camp).toFixed(1)}m from camp` : 'not back');
    ok('and nothing jumps her again the moment she is back', await (async () => {
      const again = [];
      fa.onMessage('goto', (g) => again.push(g));
      fa.send('gm', { op: 'summon', species: 'sparkit', level: 5 });
      for (let i = 0; i < 60; i++) {
        const p = back();
        fa.send('move', { x: p.x + (i % 2 ? 0.1 : -0.1), z: p.z, rot: 0, moving: true });
        await wait(50);
      }
      return !again.length && ![...fa.state.wilds.values()].some((w) => w.target === aliceId);
    })());
  }
  await fa.leave();
}

await roomB.leave();
server.kill('SIGTERM');
await wait(300);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('\nserver log:\n' + serverLog.join('').slice(-1500));
process.exit(fail ? 1 : 0);
