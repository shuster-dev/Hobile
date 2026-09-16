// Headless checks over the pure game logic. No browser: everything here is
// server/shared code, so it runs in a second and is safe to gate CI on.
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let pass = 0, fail = 0;
const section = (s) => console.log(`\n${s}`);
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------- module hygiene
section('module hygiene');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const modules = walk('src').filter((f) => f.endsWith('.js') && !f.startsWith('src/client'));
for (const m of modules) {
  try { await import(pathToFileURL(path.resolve(m)).href); ok(`imports: ${m}`, true); }
  catch (e) { ok(`imports: ${m}`, false, e.message.slice(0, 120)); }
}

const G = await import('../src/shared/gamedata.js');
const P = await import('../src/shared/props.js');
const C = await import('../src/server/game/combat.js');
const B = await import('../src/server/game/base.js');
const { SPECIES, ZONES, MOVES, ITEMS, QUESTS, DUNGEONS, ELEMENTS, PROGRESSION, captureChance, statsFor } = G;

// ---------------------------------------------------------------- data integrity
section('data integrity');
const { DESIGN } = await import('../src/client/gfx/creatures.js').catch(() => ({ DESIGN: null }));
ok('every zone spawn names a real species',
  Object.values(ZONES).every((z) => (z.spawns || []).every(([s]) => SPECIES[s])),
  Object.values(ZONES).flatMap((z) => (z.spawns || []).map(([s]) => s)).filter((s) => !SPECIES[s]).join(','));
ok('every learnset move exists',
  Object.values(SPECIES).every((s) => s.learn.every(([, m]) => MOVES[m])),
  Object.values(SPECIES).flatMap((s) => s.learn.map(([, m]) => m)).filter((m) => !MOVES[m]).join(','));
ok('every evolution target exists',
  Object.values(SPECIES).every((s) => !s.evolve || SPECIES[s.evolve.into]),
  Object.values(SPECIES).filter((s) => s.evolve && !SPECIES[s.evolve.into]).map((s) => s.id).join(','));
ok('every species type is a known element',
  Object.values(SPECIES).every((s) => s.types.every((t) => ELEMENTS[t])));
ok('every quest reward item exists',
  Object.values(QUESTS).every((q) => (q.reward?.items || []).every(([i]) => ITEMS[i])),
  Object.values(QUESTS).flatMap((q) => (q.reward?.items || []).map(([i]) => i)).filter((i) => !ITEMS[i]).join(','));
ok('every dungeon names a real zone element', Object.values(DUNGEONS).every((d) => ELEMENTS[d.element]));

// ---------------------------------------------------------------- capture curve
section('capture curve (docs/battle-v2.md: 5 / 51 / 99)');
const curve = (species, level) => {
  const st = statsFor(species, level, 0.5, 1);
  const at = (hp) => captureChance({ species, level, hp, maxHp: st.hp }, 'sphere_basic');
  return { full: at(st.hp), half: at(Math.round(st.hp / 2)), one: at(1) };
};
const common = curve('mossnail', 6);
ok('common lv6 at full hp ~5%', near(common.full * 100, 5, 1.5), (common.full * 100).toFixed(1));
ok('common lv6 at half hp ~51%', near(common.half * 100, 51, 6), (common.half * 100).toFixed(1));
ok('common lv6 at 1 hp ~99%', near(common.one * 100, 99, 1), (common.one * 100).toFixed(1));
const rare = Object.values(SPECIES).find((s) => s.rarity === 'rare');
const rareCurve = curve(rare.id, 40);
ok('rare lv40 is much harder at full hp', rareCurve.full < common.full, (rareCurve.full * 100).toFixed(1));
ok('rare lv40 still ~99% at 1 hp', near(rareCurve.one * 100, 99, 2), (rareCurve.one * 100).toFixed(1));
ok('the anchor holds for every species at 1 hp',
  Object.values(SPECIES).filter((s) => s.rarity !== 'boss')
    .every((s) => curve(s.id, 30).one > 0.95));

// ---------------------------------------------------------------- world bounds
section('world bounds');
for (const z of Object.values(ZONES)) {
  const { colliders } = P.propsFor(z);
  const half = z.size / 2;
  let escapes = 0;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    let x = 0, zz = 0;
    for (let step = 0; step < 400; step++) {
      const p = P.resolveCollision(colliders, x + Math.cos(a) * 1.2, zz + Math.sin(a) * 1.2, 0.72);
      x = p.x; zz = p.z;
    }
    if (Math.hypot(x, zz) > half + 2) escapes++;
  }
  ok(`no escapes from ${z.id}`, escapes === 0, `${escapes}/24`);
}
ok('four elemental gates on the home dock',
  ZONES.aetherport.landmarks.filter((l) => l.kind === 'portal' && l.gate).length === 4);
ok('every door has a building behind it',
  Object.values(ZONES).every((z) => (z.landmarks || [])
    .filter((l) => l.door).every((l) => l.interior)));

// ---------------------------------------------------------------- battle rules
section('battle rules');
const doc = C.createPlayerDoc('u1', 'QA', {}, 'cindcub');
C.normalizeDoc(doc);
for (const sp of ['sproutle', 'puddlet']) C.addCreature(doc, C.makeCreature(sp, 6));
const events = [];
const net = { doc, guilds: [], emit: (k, v) => events.push([k, v]), save: () => {}, pendingRooms: new Map() };
const battle = new B.BattleSim(net, { zoneId: 'aetherport', wild: { species: 'mossnail', level: 5 } });
const side = (s) => [...battle.sim.combatants.values()].filter((c) => c.side === s);
ok('the whole team is fielded', side('a').filter((c) => c.kind === 'creature').length === 3,
  String(side('a').filter((c) => c.kind === 'creature').length));
ok('exactly one team member starts on the field',
  side('a').filter((c) => c.kind === 'creature' && !c.benched).length === 1);
ok('the trainer is a combatant', side('a').some((c) => c.kind === 'trainer'));
ok('the trainer starts benched', side('a').find((c) => c.kind === 'trainer').benched === true);
ok('slots are assigned in team order',
  side('a').filter((c) => c.kind === 'creature').every((c, i) => c.slot === i));

const foe = battle.foe;
const enemiesOfFoe = battle.sim.enemiesOf(foe);
ok('the trainer is shielded while a creature lives',
  !enemiesOfFoe.some((c) => c.kind === 'trainer'));
for (const c of side('a')) if (c.kind === 'creature') c.hp = 0;
// Sending the trainer out costs a turn like any switch: the first update
// schedules it at now + PROGRESSION.switchDelayMs, a later one performs it.
battle.sim.update(50);
ok('nothing is targetable during the switch delay',
  battle.sim.enemiesOf(foe).length === 0);
await new Promise((r) => setTimeout(r, PROGRESSION.switchDelayMs + 120));
battle.sim.update(50);
ok('the trainer is exposed once the team is down',
  battle.sim.enemiesOf(foe).some((c) => c.kind === 'trainer'),
  battle.sim.enemiesOf(foe).map((c) => c.kind + (c.benched ? '(benched)' : '')).join(',') || '(no targets)');
ok('the switch delay matches PROGRESSION.switchDelayMs', PROGRESSION.switchDelayMs === 1200);

// switching
const doc2 = C.createPlayerDoc('u2', 'QA2', {}, 'cindcub');
C.normalizeDoc(doc2);
C.addCreature(doc2, C.makeCreature('sproutle', 6));
const net2 = { doc: doc2, guilds: [], emit: () => {}, save: () => {}, pendingRooms: new Map() };
const b2 = new B.BattleSim(net2, { zoneId: 'aetherport', wild: { species: 'mossnail', level: 5 } });
const benchUid = b2.roster.find((r) => r.id !== b2.anchor.id)?.uid;
const before = b2.you.id;
const res = C.swapToUid(b2.sim, b2.anchor, benchUid);
ok('a bench creature can be switched in', res.ok === true, res.reason || '');
ok('the active combatant follows the switch', b2.you.id !== before && b2.you.id === res.in);
const again = C.swapToUid(b2.sim, b2.anchor, b2.roster.find((r) => r.id === before).uid);
ok('switching again is on cooldown', again.ok === false && again.reason === 'cooldown', again.reason || '');
ok('a creature that is already out cannot be switched in',
  C.swapToUid(b2.sim, b2.anchor, benchUid).ok === false);
ok('an unknown uid is rejected', C.swapToUid(b2.sim, b2.anchor, 'nope').ok === false);

// battleInit contract
const initEvents = [];
const net3 = { doc, guilds: [], emit: (k, v) => initEvents.push([k, v]), save: () => {}, pendingRooms: new Map() };
const b3 = new B.BattleSim(net3, { zoneId: 'aetherport', wild: { species: 'mossnail', level: 5 } });
b3.start();
await new Promise((r) => setTimeout(r, 160));
b3.stop();
const init = initEvents.find(([k]) => k === 'battleInit')?.[1];
ok('battleInit carries the roster', Array.isArray(init?.team) && init.team.length === 3);
ok('battleInit carries the trainer id', !!init?.trainer);
ok('battleInit roster maps combatant ids to creature uids',
  init.team.every((r) => r.id && r.uid && b3.sim.combatants.has(r.id)));

// synced state contract
const synced = { combatants: new Map() };
B.syncBattleState(synced, b3.sim);
const row = [...synced.combatants.values()][0];
ok('synced combatants carry benched', 'benched' in row);
ok('synced combatants carry slot', 'slot' in row);
ok('synced combatants carry frozenUntil', 'frozenUntil' in row);

// ---------------------------------------------------------------- collection
section('collection');
ok('the main chain asks you to catch something second, not sixth', (() => {
  const main = Object.values(QUESTS).filter((q) => q.chain === 'main').sort((a, b) => a.step - b.step);
  return main[1]?.goal?.kind === 'capture';
})(), Object.values(QUESTS).filter((q) => q.chain === 'main').sort((a, b) => a.step - b.step).map((q) => q.goal.kind).join(','));
ok('main quest steps are unique and in order', (() => {
  const steps = Object.values(QUESTS).filter((q) => q.chain === 'main').map((q) => q.step).sort((a, b) => a - b);
  return new Set(steps).size === steps.length && steps.every((v, i) => i === 0 || v > steps[i - 1]);
})());
ok('rewards never go backwards along the chain', (() => {
  const main = Object.values(QUESTS).filter((q) => q.chain === 'main').sort((a, b) => a.step - b.step);
  return main.every((q, i) => i === 0 || q.reward.gold >= main[i - 1].reward.gold);
})());

const ddoc = C.createPlayerDoc('u6', 'QA6', {}, 'cindcub');
C.normalizeDoc(ddoc);
ok('the starter is already in the dex', (ddoc.dex?.cindcub?.caught || 0) === 1, JSON.stringify(ddoc.dex));

const first = C.dexRecord(ddoc, 'mossnail', C.makeCreature('mossnail', 5));
ok('a first catch is a new species', first.isNew && first.caught === 1);
const second = C.dexRecord(ddoc, 'mossnail', C.makeCreature('mossnail', 5));
ok('a second catch is a duplicate', !second.isNew && second.caught === 2);

const invBefore = { ...ddoc.inventory };
const paid = C.duplicateReward(ddoc, 'mossnail');
const el = SPECIES.mossnail.types[0];
ok('a duplicate pays shards of its own element', (paid[`shard_${el}`] || 0) > 0, JSON.stringify(paid));
ok('the shards actually land in the inventory',
  (ddoc.inventory[`shard_${el}`] || 0) > (invBefore[`shard_${el}`] || 0));
ok('a duplicate only pays materials that exist as items',
  Object.keys(paid).every((id) => !!ITEMS[id]), Object.keys(paid).join(','));

// Crystals are what a star upgrade costs, so duplicates have to reach them.
const rdoc = C.createPlayerDoc('u7', 'QA7', {}, 'cindcub');
C.normalizeDoc(rdoc);
let crystals = 0;
for (let i = 0; i < 6; i++) { C.dexRecord(rdoc, 'mossnail', null); crystals += C.duplicateReward(rdoc, 'mossnail')[`crystal_${el}`] || 0; }
ok('six duplicates of a common yield crystals', crystals >= 2, String(crystals));
const rareSp = Object.values(SPECIES).find((sp) => sp.rarity === 'rare');
C.dexRecord(rdoc, rareSp.id, null); C.dexRecord(rdoc, rareSp.id, null);
ok('a rare duplicate always yields a crystal',
  (C.duplicateReward(rdoc, rareSp.id)[`crystal_${rareSp.types[0]}`] || 0) >= 1);

const view = C.dexView(ddoc);
ok('the dex view covers every catchable species',
  view.total === Object.values(SPECIES).filter((sp) => sp.rarity !== 'boss').length, String(view.total));
ok('the dex view counts what has been seen', view.seen === 2, String(view.seen));
ok('bosses are not collectable', !view.rows.some((r) => SPECIES[r.id].rarity === 'boss'));

// a document written before the dex existed must not come back empty
const legacy = C.createPlayerDoc('u8', 'QA8', {}, 'sproutle');
C.addCreature(legacy, C.makeCreature('mossnail', 4));
delete legacy.dex;
C.normalizeDoc(legacy);
ok('an older save is backfilled from the creatures it holds',
  (legacy.dex?.sproutle?.caught || 0) === 1 && (legacy.dex?.mossnail?.caught || 0) === 1,
  JSON.stringify(legacy.dex));

// ---------------------------------------------------------------- world interaction
section('world interaction');
const { NPCS, npcAt, npcLines } = await import('../src/shared/npcs.js');
const wdoc = C.createPlayerDoc('u5', 'QA5', {}, 'cindcub');
C.normalizeDoc(wdoc);
const wev = [];
const wnet = { doc: wdoc, guilds: [], emit: (k, v) => wev.push([k, v]), save: () => {}, pendingRooms: new Map() };
const world = new B.WorldSim(wnet, 'aetherport');
world.start();
await new Promise((r) => setTimeout(r, 120));
const me = () => world.state.players.get('me');

// Every resident must actually say something. npcLines returns an array of
// strings; speak used to read it as {lines, en}, so all five said "…".
for (const id of Object.keys(NPCS)) {
  const at = npcAt(id, world.dayPhase());
  Object.assign(me(), { x: at.x, z: at.z });
  wev.length = 0;
  world.handle('talk', { npcId: id });
  const dlg = wev.find(([k]) => k === 'dialogue')?.[1];
  ok(`${id} speaks real dialogue`,
    !!dlg && dlg.lines.length > 0 && dlg.lines[0].he && dlg.lines[0].he !== '…',
    JSON.stringify(dlg?.lines?.[0] || wev.map((e) => e[0])));
}
ok('an unknown npc is refused', (() => {
  wev.length = 0; world.handle('talk', { npcId: 'nobody' });
  return wev.some(([k, v]) => k === 'error' && v.code === 'no_such_npc');
})());

// Every door opens. The client has sent enterBuilding since v0.7 and no room
// ever handled it, so all four buildings were decorative.
const doors = world.zone.landmarks.filter((l) => l.door && l.interior);
ok('the zone has doors to test', doors.length >= 4, String(doors.length));
for (const l of doors) {
  Object.assign(me(), { x: l.door.x, z: l.door.z });
  wev.length = 0;
  world.handle('enterBuilding', { id: l.interior });
  const b = wev.find(([k]) => k === 'building')?.[1];
  ok(`${l.interior} opens`, !!b && b.id === l.interior, wev.map((e) => e[0]).join(',') || 'nothing');
  world.handle('exitBuilding', {});
}
ok('entering from far away is refused', (() => {
  const l = doors[0];
  Object.assign(me(), { x: l.door.x + 40, z: l.door.z + 40 });
  wev.length = 0;
  world.handle('enterBuilding', { id: l.interior });
  return wev.some(([k, v]) => k === 'error' && v.code === 'too_far');
})());
ok('indoors, the overworld avatar does not follow the joystick', (() => {
  const l = doors[0];
  Object.assign(me(), { x: l.door.x, z: l.door.z });
  world.handle('enterBuilding', { id: l.interior });
  const before = { x: me().x, z: me().z };
  world.handle('move', { x: before.x + 2, z: before.z + 2, moving: true });
  const still = me().x === before.x && me().z === before.z;
  world.handle('exitBuilding', {});
  return still;
})());
ok('the welcome line is sent once, not on every refresh', (() => {
  wev.length = 0;
  world.handle('ready', {});
  world.handle('refresh', {});
  return wev.filter(([k, v]) => k === 'chat' && v.ch === 'system').length === 0;
})());
world.stop();

// capture freeze
section('capture freeze');
const doc4 = C.createPlayerDoc('u4', 'QA4', {}, 'cindcub');
C.normalizeDoc(doc4);
const b4 = new B.BattleSim(
  { doc: doc4, guilds: [], emit: () => {}, save: () => {}, pendingRooms: new Map() },
  { zoneId: 'aetherport', wild: { species: 'mossnail', level: 5 } });
const throwRes = b4.sim.trainerAction(b4.you.id, 'sphere', { sphere: 'sphere_basic' });
const now = Date.now();
ok('a thrown sphere freezes every combatant', throwRes.ok
  && [...b4.sim.combatants.values()].every((c) => c.frozenUntil > now), throwRes.reason || '');
ok('the freeze window matches PROGRESSION', [...b4.sim.combatants.values()]
  .every((c) => c.frozenUntil - now <= PROGRESSION.captureWindowMs + 50));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
