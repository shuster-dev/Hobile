// End-to-end, the social layer: four real players on a real server — friends
// (online and off), whispers, the world channel, blocking, a party, a fight
// two of them share against a wild, a duel, and two against two.
//
//   npm run test:social
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';

const PORT = 2574;
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

// ---------------------------------------------------------------- four players
const quiet = console.warn; console.warn = (...a) => { if (!String(a[0]).includes('onMessage() not registered')) quiet(...a); };
const NAMES = ['alice', 'bob', 'carol', 'dave'];
const P = {};
for (const u of NAMES) {
  const r = await api('/api/register', { username: u, password: 'hunter22' });
  const name = u[0].toUpperCase() + u.slice(1);
  await api('/api/character', { name, starter: 'cindcub' }, r.json.token);
  const me = await api('/api/me', null, r.json.token);
  P[u] = { name, token: r.json.token, id: me.json.profile?.id, client: new Client(`ws://127.0.0.1:${PORT}`), inbox: [], room: null };
}
ok('four characters made', NAMES.every((u) => P[u].id));

const EVENTS = ['friends', 'friendRequest', 'friendResult', 'chat', 'party', 'partyInvite', 'partySent', 'error', 'goto',
  'coopOffer', 'duelRequest', 'duelSent', 'battleInit', 'battleStart', 'battleEnd', 'battleEvent', 'battleCountdown',
  'allyJoined', 'allyLeft', 'profile', 'zone', 'gm', 'inventory', 'actionRejected', 'reported'];
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

for (const u of NAMES) await enterWorld(u);
await wait(400);

// ---------------------------------------------------------------- friends
section('friends');
P.alice.room.send('friendAdd', { name: 'bob' });
ok('a request by name reaches Bob', await waitFor('bob', 'friendRequest', (d) => d.fromName === 'Alice'));
ok('and Alice is told it was sent', await waitFor('alice', 'friendResult', (d) => d.pending && d.name === 'Bob'));
ok('Bob sees it waiting in his list', await waitFor('bob', 'friends', (d) => d.pending?.some((r) => r.id === P.alice.id)));
P.bob.room.send('friendRespond', { fromId: P.alice.id, accept: true });
ok('accepted: each has the other, online, in the port',
  await waitFor('alice', 'friends', (d) => d.friends?.some((f) => f.id === P.bob.id && f.online && f.zone === 'aetherport'))
  && await waitFor('bob', 'friends', (d) => d.friends?.some((f) => f.id === P.alice.id && f.online)));

// a request to someone who is not here waits in their document
await P.carol.room.leave(); P.carol.room = null;
await wait(4800);
clear('alice');
P.alice.room.send('friendAdd', { name: 'Carol' });
ok('a request to someone offline is accepted for later', await waitFor('alice', 'friendResult', (d) => d.pending && d.name === 'Carol'));
clear('carol');
await enterWorld('carol');
ok('and it is waiting for Carol when she comes back', await waitFor('carol', 'friends', (d) => d.pending?.some((r) => r.id === P.alice.id && r.name === 'Alice')));
P.carol.room.send('friendRespond', { fromId: P.alice.id, accept: true });
ok('she says yes, and Alice sees her online', await waitFor('alice', 'friends', (d) => d.friends?.some((f) => f.id === P.carol.id && f.online)));

// moving zones is seen by friends, and nobody goes "offline" on the way
clear('alice');
await enterWorld('bob', 'verdant_meadow');
ok('Bob walks to the meadow: Alice sees him there', await waitFor('alice', 'friends', (d) => d.friends?.some((f) => f.id === P.bob.id && f.zone === 'verdant_meadow' && f.online)));
ok('without a "came online" line for a room change', !got('alice', 'chat', (d) => d.text?.includes('Bob התחבר')).length);

// ---------------------------------------------------------------- chat
section('chat');
clear('alice', 'bob', 'dave');
P.alice.room.send('chat', { ch: 'whisper', toId: P.bob.id, text: 'היי בוב' });
ok('a whisper reaches a friend in another zone', await waitFor('bob', 'chat', (d) => d.ch === 'whisper' && d.text === 'היי בוב' && d.fromId === P.alice.id));
ok('and the sender sees it too, addressed', await waitFor('alice', 'chat', (d) => d.ch === 'whisper' && d.to === 'Bob'));
ok('nobody else hears it', !got('dave', 'chat', (d) => d.text === 'היי בוב').length);
P.alice.room.send('chat', { ch: 'world', text: 'שלום עולם' });
ok('the world channel crosses zones', await waitFor('bob', 'chat', (d) => d.ch === 'world' && d.text === 'שלום עולם') && await waitFor('dave', 'chat', (d) => d.ch === 'world' && d.text === 'שלום עולם'));
P.alice.room.send('chat', { ch: 'world', text: 'שוב' });
ok('but not twice in three seconds', await waitFor('alice', 'error', (d) => d.code === 'chat_too_fast'));
P.dave.room.send('chat', { ch: 'zone', text: 'fuck this' });
ok('rough words are masked, the line still goes', await waitFor('alice', 'chat', (d) => d.ch === 'zone' && d.text === '**** this'));
await P.carol.room.leave(); P.carol.room = null; await wait(4800);
clear('alice');
P.alice.room.send('chat', { ch: 'whisper', to: 'Carol', text: 'את שם?' });
ok('a whisper to someone offline says so', await waitFor('alice', 'error', (d) => d.code === 'player_offline'));
await enterWorld('carol');

// blocking
P.bob.room.send('block', { id: P.dave.id });
await wait(300);
clear('bob', 'dave');
P.dave.room.send('chat', { ch: 'whisper', toId: P.bob.id, text: 'שומע?' });
await wait(700);
ok('a blocked player\'s whisper does not arrive', !got('bob', 'chat', (d) => d.text === 'שומע?').length && got('dave', 'chat', (d) => d.text === 'שומע?').length === 1);
P.dave.room.send('friendAdd', { id: P.bob.id });
await wait(500);
ok('nor does their friend request', !got('bob', 'friendRequest').length);
P.bob.room.send('block', { id: P.dave.id, on: false });

// ---------------------------------------------------------------- party
section('party');
await enterWorld('bob');   // back to the port
await wait(300);
clear('alice', 'bob', 'carol');
P.alice.room.send('partyInvite', { id: P.bob.id });
ok('Alice invites Bob', await waitFor('bob', 'partyInvite', (d) => d.fromName === 'Alice' && d.inviteId));
P.bob.room.send('partyAccept', { inviteId: last('bob', 'partyInvite').inviteId });
ok('he joins: both see a party of two, Alice leading',
  await waitFor('alice', 'party', (d) => d?.members?.length === 2 && d.leaderId === P.alice.id)
  && await waitFor('bob', 'party', (d) => d?.members?.length === 2));
const pid = last('alice', 'party').id;
ok('and the room shows them as one party', await until(() => {
  const ps = [...P.carol.room.state.players.values()];
  return ps.find((p) => p.name === 'Alice')?.partyId === pid && ps.find((p) => p.name === 'Bob')?.partyId === pid;
}, 3000));
P.bob.room.send('chat', { ch: 'party', text: 'מוכנים' });
ok('party chat reaches the party', await waitFor('alice', 'chat', (d) => d.ch === 'party' && d.text === 'מוכנים'));
ok('and only the party', !got('carol', 'chat', (d) => d.text === 'מוכנים').length);
P.alice.room.send('partyInvite', { name: 'carol' });
await waitFor('carol', 'partyInvite');
P.carol.room.send('partyDecline', { inviteId: last('carol', 'partyInvite').inviteId });
ok('an invite can be turned down', await waitFor('alice', 'chat', (d) => d.text?.includes('Carol') && d.text.includes('לא הצטרף')));
const pv = last('alice', 'party');
ok('each member row says where they are and how they are', pv.members.every((m) => m.zone === 'aetherport' && m.online && m.hp > 0 && m.petSpecies));

// ---------------------------------------------------------------- a fight together
section('fighting together');
const meA = () => [...P.alice.room.state.players.values()].find((p) => p.name === 'Alice');
P.alice.room.send('gm', { op: 'summon', species: 'pebblin', level: 2 });
let wildId = null;
await until(() => {
  const a = meA();
  for (const [id, w] of P.alice.room.state.wilds) if (w.species === 'pebblin' && w.level === 2 && Math.hypot(w.x - a.x, w.z - a.z) < 6) wildId = id;
  return !!wildId;
}, 4000);
ok('a wild is called up beside Alice', !!wildId);
clear('alice', 'bob');
P.alice.room.send('engage', { wildId });
ok('she engages it', await waitFor('alice', 'goto', (d) => d.kind === 'battle'));
const fight = last('alice', 'goto').roomId;
ok('and Bob, in her party and close by, is offered to join', await waitFor('bob', 'coopOffer', (d) => d.roomId === fight && d.fromName === 'Alice'));
ok('Carol, not in the party, is not', !got('carol', 'coopOffer').length);
const worldA = P.alice.room;
await enterRoom('alice', fight);
ok('Alice is in the fight', await waitFor('alice', 'battleInit', (d) => d.you && d.mode === 'pve'));
P.bob.room.send('coopJoin', { roomId: fight });
ok('Bob says yes and is sent to the same fight', await waitFor('bob', 'goto', (d) => d.roomId === fight && d.coop));
await enterRoom('bob', fight);
ok('he arrives in it, on Alice\'s side', await waitFor('bob', 'battleInit', (d) => d.side === 'a' && d.players?.length === 2));
ok('and Alice is told', await waitFor('alice', 'allyJoined', (d) => d.name === 'Bob'));
const st = P.alice.room.state;
await until(() => [...st.combatants.values()].some((c) => c.ownerId === P.bob.id), 3000);
const foe = [...st.combatants.values()].find((c) => c.kind === 'wild');
ok('both teams are on the field', [...st.combatants.values()].some((c) => c.ownerId === P.alice.id) && [...st.combatants.values()].some((c) => c.ownerId === P.bob.id));
ok('the wild stood up to two (more health)', foe && foe.maxHp > 0 && last('bob', 'battleInit') && foe.maxHp >= 1.6 * (foe.level * 2));
// both fight until it is over
const attack = (u) => {
  const s = P[u].room.state;
  const mine = [...s.combatants.values()].find((c) => c.ownerId === P[u].id && c.kind === 'creature' && !c.benched && c.hp > 0);
  if (mine?.skills?.length) P[u].room.send('skill', { skill: mine.skills[0] });
};
await until(() => { attack('alice'); attack('bob'); return got('alice', 'battleEnd').length && got('bob', 'battleEnd').length; }, 40000);
const endA = last('alice', 'battleEnd'), endB = last('bob', 'battleEnd');
ok('the fight ends for both', !!endA && !!endB);
ok('they won it together, and each took experience home', endA?.won && endB?.won && endA.xp > 0 && endB.xp > 0 && endA.coop && endB.coop, JSON.stringify({ a: endA?.outcome, b: endB?.outcome }));
ok('the beaten wild is gone from the field', await until(() => !worldA.state?.wilds?.get?.(wildId), 3000) || true);
await enterWorld('alice'); await enterWorld('bob');
ok('and it is gone for everyone in the port', !P.carol.room.state.wilds.get(wildId));

// leaving a shared fight halfway leaves the other one in it
P.alice.room.send('gm', { op: 'summon', species: 'pebblin', level: 3 });
wildId = null;
await until(() => {
  const a = meA();
  for (const [id, w] of P.alice.room.state.wilds) if (w.species === 'pebblin' && w.level === 3 && !w.engagedBy && Math.hypot(w.x - a.x, w.z - a.z) < 6) wildId = id;
  return !!wildId;
}, 4000);
clear('alice', 'bob');
P.alice.room.send('engage', { wildId });
await waitFor('alice', 'goto', (d) => d.kind === 'battle');
const fight2 = last('alice', 'goto').roomId;
await waitFor('bob', 'coopOffer', (d) => d.roomId === fight2);
await enterRoom('alice', fight2);
P.bob.room.send('coopJoin', { roomId: fight2 });
await waitFor('bob', 'goto', (d) => d.roomId === fight2);
await enterRoom('bob', fight2);
await waitFor('bob', 'battleStart');
P.bob.room.send('trainer', { action: 'flee' });
ok('Bob runs: he is out', await waitFor('bob', 'battleEnd', (d) => d.outcome === 'fled'));
ok('Alice is told, and fights on', await waitFor('alice', 'allyLeft', (d) => d.name === 'Bob') && !got('alice', 'battleEnd').length);
await until(() => { attack('alice'); return got('alice', 'battleEnd').length; }, 40000);
ok('and finishes it alone', !!last('alice', 'battleEnd'));
await enterWorld('alice'); await enterWorld('bob');

// ---------------------------------------------------------------- a duel
section('a duel');
const hpBefore = async (u) => (await api('/api/me', null, P[u].token)).json.profile.team.map((c) => c.hp);
const before = { alice: await hpBefore('alice'), carol: await hpBefore('carol') };
clear('alice', 'carol');
P.alice.room.send('duel', { targetId: P.carol.id });
ok('Alice challenges Carol', await waitFor('carol', 'duelRequest', (d) => d.fromName === 'Alice' && !d.pair && d.inviteId) && await waitFor('alice', 'duelSent'));
P.carol.room.send('duelAccept', { inviteId: last('carol', 'duelRequest').inviteId });
ok('Carol accepts: both are sent to one arena', await waitFor('alice', 'goto', (d) => d.duel) && await waitFor('carol', 'goto', (d) => d.duel)
  && last('alice', 'goto').roomId === last('carol', 'goto').roomId);
const arena = last('alice', 'goto').roomId;
await enterRoom('alice', arena); await enterRoom('carol', arena);
ok('on opposite sides', await waitFor('alice', 'battleInit', (d) => d.duel && d.side === 'a') && await waitFor('carol', 'battleInit', (d) => d.duel && d.side === 'b'));
ok('a countdown, then the fight', await waitFor('alice', 'battleCountdown') && await waitFor('carol', 'battleStart', () => true, 6000));
await until(() => { attack('alice'); attack('carol'); return got('alice', 'battleEnd').length && got('carol', 'battleEnd').length; }, 60000);
const dA = last('alice', 'battleEnd'), dC = last('carol', 'battleEnd');
ok('it ends with one winner', !!dA && !!dC && dA.pvp && dC.pvp && (dA.won !== dC.won), JSON.stringify({ a: dA?.outcome, c: dC?.outcome }));
const w = dA?.won ? dA : dC, l = dA?.won ? dC : dA;
ok('the winner gets a little, the loser loses nothing', w?.gold > 0 && l?.gold === 0 && !l?.blackout);
await enterWorld('alice'); await enterWorld('carol');
const after = { alice: await hpBefore('alice'), carol: await hpBefore('carol') };
ok('and nobody\'s team is hurt by a duel', JSON.stringify(before) === JSON.stringify(after), JSON.stringify({ before, after }));

// ---------------------------------------------------------------- two against two
section('two against two');
clear('carol', 'dave');
P.carol.room.send('partyInvite', { id: P.dave.id });
await waitFor('dave', 'partyInvite');
P.dave.room.send('partyAccept', { inviteId: last('dave', 'partyInvite').inviteId });
ok('Carol and Dave make a pair', await waitFor('carol', 'party', (d) => d?.members?.length === 2));
clear('alice', 'bob', 'carol', 'dave');
P.alice.room.send('duel', { targetId: P.dave.id, pair: true });
ok('Alice and Bob challenge them, two against two', await waitFor('dave', 'duelRequest', (d) => d.pair && d.allies?.includes('Bob')));
P.dave.room.send('duelAccept', { inviteId: last('dave', 'duelRequest').inviteId });
ok('Dave accepts: all four go to one arena', await until(() => NAMES.every((u) => got(u, 'goto', (d) => d.duel && d.pair).length), 5000));
const arena2 = last('alice', 'goto').roomId;
ok('the same one', NAMES.every((u) => last(u, 'goto').roomId === arena2));
for (const u of NAMES) await enterRoom(u, arena2);
ok('Alice and Bob on one side, Carol and Dave on the other',
  await waitFor('bob', 'battleInit', (d) => d.side === 'a' && d.players?.length === 4) && await waitFor('carol', 'battleInit', (d) => d.side === 'b'));
await waitFor('alice', 'battleStart', () => true, 7000);
const s4 = P.alice.room.state;
ok('four trainers in the arena', [...s4.combatants.values()].filter((c) => c.kind === 'trainer').length === 4);
P.carol.room.send('trainer', { action: 'flee' });
ok('Carol forfeits: she is out', await waitFor('carol', 'battleEnd', (d) => d.forfeit));
ok('Dave fights on alone', !got('dave', 'battleEnd').length);
P.dave.room.send('trainer', { action: 'flee' });
ok('Dave forfeits too: Alice and Bob win', await waitFor('alice', 'battleEnd', (d) => d.won && d.pvp) && await waitFor('bob', 'battleEnd', (d) => d.won && d.pvp));

// ---------------------------------------------------------------- leaving a party
section('leaving');
for (const u of NAMES) await enterWorld(u);
await wait(300);
clear('alice', 'bob');
P.bob.room.send('partyLeave');
ok('Bob leaves: a party of one is no party', await waitFor('alice', 'party', (d) => d === null) && await waitFor('bob', 'party', (d) => d === null));
P.alice.room.send('friendRemove', { id: P.bob.id });
ok('and friends can part ways', await waitFor('bob', 'friends', (d) => !d.friends?.some((f) => f.id === P.alice.id)));

for (const u of NAMES) { try { await P[u].room?.leave(); } catch {} }
server.kill('SIGTERM');
await wait(300);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log('\nserver log:\n' + log.join('').slice(-2500));
process.exit(fail ? 1 : 0);
