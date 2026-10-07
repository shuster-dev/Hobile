// End-to-end, the endgame and the guilds: a party going into a dungeon
// together, the tower, the ranked arena, and a guild from founding to a kick.
// Real players on a real server, as social-test.mjs does it.
//
//   npm run test:endgame
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';

const PORT = 2576;
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};
const section = (s) => console.log(`\n${s}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 6000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await wait(80); }
  return false;
};

const server = spawn(process.execPath, ['src/server/index.js'], {
  env: { ...process.env, PORT: String(PORT), AUTH_SECRET: 'test-secret', NODE_ENV: 'test', ADMIN_USERS: 'alice' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const killServer = () => { try { server.kill('SIGKILL'); } catch {} };
process.on('exit', killServer);
process.on('uncaughtException', (e) => { console.error(e); killServer(); process.exit(1); });
process.on('unhandledRejection', (e) => { console.error(e); killServer(); process.exit(1); });
const log = [];
server.stdout.on('data', (d) => log.push(String(d)));
server.stderr.on('data', (d) => log.push('ERR ' + String(d)));
const up = await until(async () => { try { return (await fetch(`${BASE}/api/health`)).ok; } catch { return false; } }, 15000);
ok('server starts', up, log.join('').slice(-400));
if (!up) process.exit(1);

const api = async (p, body, token) => {
  const r = await fetch(BASE + p, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const quiet = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('onMessage() not registered')) quiet(...a); };
const NAMES = ['alice', 'bob', 'carol'];
const P = {};
for (const u of NAMES) {
  const r = await api('/api/register', { username: u, password: 'hunter22' });
  const name = u[0].toUpperCase() + u.slice(1);
  await api('/api/character', { name, starter: 'cindcub' }, r.json.token);
  const me = await api('/api/me', null, r.json.token);
  P[u] = { name, token: r.json.token, id: me.json.profile?.id, client: new Client(`ws://127.0.0.1:${PORT}`), inbox: [], room: null };
}
ok('three characters made', NAMES.every((u) => P[u].id));

const EVENTS = ['party', 'partyInvite', 'error', 'goto', 'dungeonOffer', 'dungeonInit', 'dungeonLobby', 'floor', 'floorCleared',
  'dungeonEnd', 'battleInit', 'battleStart', 'battleEnd', 'battleEvent', 'battleCountdown', 'allyJoined', 'allyLeft', 'profile',
  'zone', 'gm', 'gmGift', 'inventory', 'actionRejected', 'chat', 'friends', 'arena', 'arenaQueue', 'arenaMatch', 'guild', 'guildList',
  'guildKicked', 'guildBuff', 'towerChest'];
function listen(p, room) {
  for (const ev of EVENTS) room.onMessage(ev, (data) => p.inbox.push({ ev, data, at: Date.now() }));
  room.onMessage('*', () => {});
}
async function enterWorld(u, zone = 'aetherport') {
  const p = P[u];
  if (p.room) { try { await p.room.leave(); } catch {} }
  p.room = await p.client.joinOrCreate('world', { zone, token: p.token });
  listen(p, p.room);
  p.room.send('ready');
  await until(() => p.room.state.players?.size > 0, 4000);
  return p.room;
}
async function enterRoom(u, roomId) {
  const p = P[u];
  if (p.room) { try { await p.room.leave(); } catch {} }
  p.room = await p.client.joinById(roomId, { token: p.token });
  listen(p, p.room);
  p.room.send('ready');
  return p.room;
}
const got = (u, ev, pred = () => true) => P[u].inbox.filter((m) => m.ev === ev && pred(m.data));
const last = (u, ev, pred) => got(u, ev, pred).at(-1)?.data;
const waitFor = (u, ev, pred = () => true, ms = 6000) => until(() => got(u, ev, pred).length > 0, ms);
const clear = (...us) => { for (const u of us) P[u].inbox.length = 0; };
const me = async (u) => (await api('/api/me', null, P[u].token)).json.profile;

for (const u of NAMES) await enterWorld(u);
await wait(400);

// strong enough to finish a dungeon: a level-40 creature at the head of each team
for (const u of ['alice', 'bob']) {
  P.alice.room.send('gm', { op: 'give', to: u === 'alice' ? 'me' : P.bob.id, what: 'creature', species: 'pyrelynx', level: 40 });
}
for (const u of ['alice', 'bob']) P.alice.room.send('gm', { op: 'give', to: u === 'alice' ? 'me' : P.bob.id, what: 'level', level: 20 });
await until(async () => (await me('bob')).team.length >= 2 && (await me('alice')).team.length >= 2 && (await me('bob')).level >= 20, 5000);
for (const u of ['alice', 'bob']) {
  const team = (await me(u)).team.map((c) => c.uid);
  P[u].room.send('setTeam', { team: [team[team.length - 1], ...team.slice(0, -1)] });
}
await wait(400);

// ---------------------------------------------------------------- a dungeon together
section('a dungeon, together');
clear('alice', 'bob');
P.alice.room.send('partyInvite', { id: P.bob.id });
await waitFor('bob', 'partyInvite');
P.bob.room.send('partyAccept', { inviteId: last('bob', 'partyInvite').inviteId });
ok('Alice and Bob are a party', await waitFor('alice', 'party', (d) => d?.members?.length === 2));
P.alice.room.send('dungeonEnter', { dungeonId: 'undercity_cistern', tier: 'hard' });
ok('a tier that is not unlocked is refused', await waitFor('alice', 'error', (d) => d.code === 'tier_locked'));
clear('alice', 'bob');
P.alice.room.send('dungeonEnter', { dungeonId: 'undercity_cistern', tier: 'normal' });
ok('Alice goes in', await waitFor('alice', 'goto', (d) => d.kind === 'dungeon'));
const dRoom = last('alice', 'goto').roomId;
ok('Bob is asked along', await waitFor('bob', 'dungeonOffer', (d) => d.roomId === dRoom && d.fromName === 'Alice' && d.tier === 'normal'));
ok('Carol, outside the party, is not', !got('carol', 'dungeonOffer').length);
await enterRoom('alice', dRoom);
ok('the first floor waits for the party', await waitFor('alice', 'dungeonLobby'));
P.bob.room.send('coopJoin', { roomId: dRoom });
ok('Bob says yes and is sent in', await waitFor('bob', 'goto', (d) => d.roomId === dRoom && d.kind === 'dungeon'));
await enterRoom('bob', dRoom);
ok('both are in the run, as two players', await waitFor('bob', 'dungeonInit', (d) => d.players?.length === 2 && d.team?.length >= 2)
  && await waitFor('alice', 'dungeonInit', (d) => d.players?.length === 2));
ok('the first floor opens', await waitFor('alice', 'floor', (d) => d.floor === 1, 8000));
const dst = P.alice.room.state;
ok('both teams stand in it', await until(() => [...dst.combatants.values()].some((c) => c.ownerId === P.bob.id) && [...dst.combatants.values()].some((c) => c.ownerId === P.alice.id), 3000));
ok('and the dungeon stands against them', await until(() => [...dst.combatants.values()].some((c) => c.side === 'b'), 4000));
const attack = (u) => {
  const s = P[u].room?.state;
  if (!s?.combatants) return;
  const mine = [...s.combatants.values()].find((c) => c.ownerId === P[u].id && c.kind === 'creature' && !c.benched && c.hp > 0);
  if (mine?.skills?.length) for (const sk of mine.skills) P[u].room.send('skill', { skill: sk });
};
await until(() => { attack('alice'); attack('bob'); return got('alice', 'dungeonEnd').length && got('bob', 'dungeonEnd').length; }, 120000);
const eA = last('alice', 'dungeonEnd'), eB = last('bob', 'dungeonEnd');
ok('the run ends for both', !!eA && !!eB);
ok('cleared, together, and both paid', eA?.success && eB?.success && eA.players === 2 && eA.xp > 0 && eB.xp > 0 && eA.gold > 0 && eB.gold > 0, JSON.stringify({ a: eA && { s: eA.success, f: eA.floors }, b: eB && { s: eB.success } }));
ok('each took their own treasure', eA?.items?.length >= 1 && eB?.items?.length >= 1);
await enterWorld('alice'); await enterWorld('bob');
const pa = await me('alice');
ok('the hard tier is open now', pa.records?.dungeons?.undercity_cistern === 0);

// ---------------------------------------------------------------- the tower
// (Bob climbs: a GM — Alice — is kept off the boards, server/admin.js)
section('the tower');
clear('alice', 'bob', 'carol');
P.carol.room.send('dungeonEnter', { dungeonId: 'endless_tower' });
ok('below its level, the tower says so', await waitFor('carol', 'error', (d) => d.code === 'level_too_low' && d.need === 15));
P.bob.room.send('dungeonEnter', { dungeonId: 'endless_tower' });
ok('at level 20 Bob climbs', await waitFor('bob', 'goto', (d) => d.kind === 'dungeon'));
const tRoom = last('bob', 'goto').roomId;
ok('his party is asked along to the tower too', await waitFor('alice', 'dungeonOffer', (d) => d.roomId === tRoom && d.endless));
await enterRoom('bob', tRoom);
ok('the tower opens on floor 1 with an element of its own', await waitFor('bob', 'floor', (d) => d.floor === 1 && d.endless && !!d.element, 20000));
await until(() => { attack('bob'); return got('bob', 'floorCleared').length || got('bob', 'dungeonEnd').length; }, 60000);
ok('a floor climbed', got('bob', 'floorCleared', (d) => d.floor === 1).length === 1);
await waitFor('bob', 'floor', (d) => d.floor === 2, 6000);
await wait(300);
P.bob.room.send('trainer', { action: 'flee' });
ok('he walks out: the climb ends and pays', await waitFor('bob', 'dungeonEnd', (d) => d.endless && d.floors >= 1 && d.xp > 0, 8000), JSON.stringify(last('bob', 'dungeonEnd')));
ok('and the floor is his record for the week', last('bob', 'dungeonEnd')?.weekBest >= 1);
await enterWorld('bob');
const board = await api('/api/leaderboard?kind=tower', null, P.carol.token);
ok('the weekly tower board has him on it', board.json[0]?.name === 'Bob' && board.json[0].tower >= 1, JSON.stringify(board.json).slice(0, 200));

// ---------------------------------------------------------------- the arena
section('the ranked arena');
clear('bob', 'carol');
P.bob.room.send('arenaView');
ok('the arena shows a season and a starting rating', await waitFor('bob', 'arena', (d) => d.rating === 1000 && d.season && d.tier === 'bronze'));
P.bob.room.send('arenaQueue');
ok('Bob queues', await waitFor('bob', 'arenaQueue', (d) => d.queued));
P.carol.room.send('arenaQueue');
ok('Carol queues: they are matched', await waitFor('bob', 'arenaMatch', (d) => d.foe === 'Carol') && await waitFor('carol', 'arenaMatch', (d) => d.foe === 'Bob'));
ok('and sent to one ranked fight', await waitFor('bob', 'goto', (d) => d.ranked) && await waitFor('carol', 'goto', (d) => d.ranked) && last('bob', 'goto').roomId === last('carol', 'goto').roomId);
const rRoom = last('bob', 'goto').roomId;
await enterRoom('bob', rRoom); await enterRoom('carol', rRoom);
ok('a ranked duel', await waitFor('bob', 'battleInit', (d) => d.ranked && d.duel));
await waitFor('carol', 'battleStart', () => true, 8000);
const rs = P.bob.room.state;
ok('every creature at the arena\'s level', [...rs.combatants.values()].filter((c) => c.kind === 'creature').every((c) => c.level === 50), [...rs.combatants.values()].map((c) => c.level).join(','));
await until(() => { attack('bob'); attack('carol'); return got('bob', 'battleEnd').length && got('carol', 'battleEnd').length; }, 90000);
const rB = last('bob', 'battleEnd'), rC = last('carol', 'battleEnd');
ok('it ends, and both ratings move', !!rB?.ranked && !!rC?.ranked && rB.ranked.delta !== 0 && rB.ranked.delta === -rC.ranked.delta, JSON.stringify({ a: rB?.ranked, c: rC?.ranked }));
ok('the winner up, the loser down', (rB.won ? rB : rC).ranked.after > 1000 && (rB.won ? rC : rB).ranked.after < 1000);
await enterWorld('bob'); await enterWorld('carol');
const ab = await api('/api/leaderboard?kind=arena', null, P.carol.token);
ok('the arena board has both, the winner first', ab.json.length === 2 && ab.json[0].name === (rB.won ? 'Bob' : 'Carol'), JSON.stringify(ab.json.map((r) => [r.name, r.rating])));
P.bob.room.send('arenaQueue');
await waitFor('bob', 'arenaQueue', (d) => d.queued);
P.bob.room.send('arenaCancel');
ok('a queue can be left', await waitFor('bob', 'arenaQueue', (d) => d.queued === false));

// ---------------------------------------------------------------- a guild
section('a guild');
clear('alice', 'bob', 'carol');
P.carol.room.send('guildCreate', { name: 'Poor', tag: 'PR' });
ok('founding costs gold Carol has not got', await waitFor('carol', 'error', (d) => d.code === 'not_enough_gold'));
P.alice.room.send('gm', { op: 'give', to: 'me', what: 'gold', amount: 200000 });
await until(async () => (await me('alice')).gold >= 200000, 3000);
P.alice.room.send('guildCreate', { name: 'מסדר הלהבה', tag: 'LHB' });
ok('Alice founds a guild and leads it', await waitFor('alice', 'guild', (d) => d?.name === 'מסדר הלהבה' && d.myRank === 'master' && d.members.length === 1));
ok('her tag is over her head', await until(() => [...P.carol.room.state.players.values()].find((p) => p.name === 'Alice')?.guildTag === 'LHB', 3000));
P.carol.room.send('guildCreate', { name: 'x', tag: 'LHB' });
ok('a name too short is refused', await waitFor('carol', 'error', (d) => d.code === 'guild_name' || d.code === 'not_enough_gold'));
P.bob.room.send('guildList');
ok('Bob finds it in the list', await waitFor('bob', 'guildList', (d) => d.some((g) => g.tag === 'LHB' && g.members === 1)));
const gid = last('bob', 'guildList').find((g) => g.tag === 'LHB').id;
P.bob.room.send('guildJoin', { guildId: gid });
P.carol.room.send('guildJoin', { guildId: gid });
ok('Bob and Carol join; Alice sees three', await waitFor('alice', 'guild', (d) => d?.members?.length === 3));
P.bob.room.send('chat', { ch: 'guild', text: 'לגילדה!' });
ok('guild chat reaches every member', await waitFor('alice', 'chat', (d) => d.ch === 'guild' && d.text === 'לגילדה!') && await waitFor('carol', 'chat', (d) => d.ch === 'guild' && d.text === 'לגילדה!'));
P.alice.room.send('guildContribute', { gold: 15000 });
ok('a contribution fills the treasury and raises the buffs', await waitFor('alice', 'guild', (d) => d?.treasury === 15000 && d.buffLevel === 2) && await waitFor('alice', 'guildBuff', (d) => d.level === 2));
ok('the others see it too', await waitFor('bob', 'guild', (d) => d?.buffLevel === 2));
P.alice.room.send('guildUpgrade', { upgradeId: 'gh_hall' });
ok('the master builds the great hall from the treasury', await waitFor('alice', 'guild', (d) => d?.house?.includes('gh_hall') && d.cap === 60 && d.treasury === 7000));
P.bob.room.send('guildKick', { id: P.carol.id });
ok('a member may not remove another', await waitFor('bob', 'error', (d) => d.code === 'no_rank'));
P.alice.room.send('guildRank', { id: P.bob.id, rank: 'officer' });
ok('Alice makes Bob an officer', await waitFor('bob', 'guild', (d) => d?.myRank === 'officer'));
P.bob.room.send('guildKick', { id: P.carol.id });
ok('an officer removes a member: Carol is told and is out', await waitFor('carol', 'guildKicked') && await waitFor('alice', 'guild', (d) => d?.members?.length === 2));
await wait(1800);
const gl = await api('/api/guilds', null, P.bob.token);
const saved = (gl.json || []).find((g) => g.id === gid);
ok('the guild is kept in the store', saved && Object.keys(saved.members).length === 2 && saved.house.includes('gh_hall'));
clear('alice', 'bob');
P.alice.room.send('guildLeave');
ok('the master leaves: the officer leads', await waitFor('bob', 'guild', (d) => d?.myRank === 'master' && d.members.length === 1));
P.bob.room.send('guildLeave');
ok('the last one out closes it', await waitFor('bob', 'guild', (d) => d === null));
await wait(300);
P.carol.room.send('guildList');
ok('and it is gone from the list', await waitFor('carol', 'guildList', (d) => !d.some((g) => g.id === gid)));

for (const u of NAMES) { try { await P[u].room?.leave(); } catch {} }
server.kill('SIGTERM');
await wait(300);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('\nserver log:\n' + log.join('').slice(-2500));
process.exit(fail ? 1 : 0);
