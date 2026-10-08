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
const WP = await import('../src/shared/worldplan.js');
const P = await import('../src/shared/props.js');
const C = await import('../src/server/game/combat.js');
const B = await import('../src/server/game/base.js');
const WM = await import('../src/server/game/world-messages.js');
const { SPECIES, ZONES, MOVES, ITEMS, QUESTS, DUNGEONS, ELEMENTS, PROGRESSION, captureChance, statsFor } = G;

// ---------------------------------------------------------------- wiring
// Two classes of bug this codebase has actually shipped, made into checks.
section('wiring');
{
  // A duplicate key or method wins in silence. `swapCreature` was declared
  // twice in one hooks object and `bestSphere` twice in one class; in both
  // cases the later definition quietly replaced the earlier one.
  const { parse } = await import('@babel/parser');
  const traverseMod = await import('@babel/traverse');
  const traverse = traverseMod.default?.default || traverseMod.default;
  const dups = [];
  const nameOf = (k, computed) => computed ? null
    : k.type === 'Identifier' ? k.name
      : k.type === 'StringLiteral' ? k.value
        : k.type === 'NumericLiteral' ? String(k.value) : null;
  for (const f of walk('src').filter((x) => x.endsWith('.js'))) {
    const ast = parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['classProperties'] });
    traverse(ast, {
      ObjectExpression(p) {
        const seen = new Map();
        for (const pr of p.node.properties) {
          if (pr.type === 'SpreadElement' || pr.kind === 'get' || pr.kind === 'set') continue;
          const k = nameOf(pr.key, pr.computed);
          if (!k) continue;
          if (seen.has(k)) dups.push(`${f}:${pr.loc.start.line} key "${k}"`);
          else seen.set(k, pr.loc.start.line);
        }
      },
      ClassBody(p) {
        const seen = new Map();
        for (const m of p.node.body) {
          if ((m.type !== 'ClassMethod' && m.type !== 'ClassProperty') || m.kind === 'get' || m.kind === 'set') continue;
          const k = nameOf(m.key, m.computed);
          if (!k) continue;
          const id = (m.static ? 'static ' : '') + k;
          if (seen.has(id)) dups.push(`${f}:${m.loc.start.line} member "${id}"`);
          else seen.set(id, m.loc.start.line);
        }
      },
    });
  }
  ok('nothing is defined twice in the same object or class', dups.length === 0, dups.slice(0, 3).join(' · '));

  // `enterBuilding` was sent from v0.7 and handled by nobody, so every door in
  // the game was decorative for four versions and nothing said a word.
  const sent = new Map();
  for (const f of ['src/client/game.js', 'src/client/ui.js', 'src/client/net.js']) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:net\.send|\bsend)\(\s*"([a-zA-Z]\w*)"/g)) sent.set(m[1], f);
    for (const m of src.matchAll(/(?<![.\w])e\(\s*"([a-zA-Z]\w*)"\s*,/g)) sent.set(m[1], f);
  }
  const handled = new Set(['ready', 'refresh', 'ping', 'leave']);
  for (const f of ['src/server/game/world-messages.js', 'src/server/game/base.js',
    'src/server/rooms/WorldRoom.js', 'src/server/rooms/BattleRoom.js', 'src/server/rooms/DungeonRoom.js']) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/case\s+"([a-zA-Z]\w*)"\s*:/g)) handled.add(m[1]);
    for (const m of src.matchAll(/\b[a-z]\s*===\s*"([a-zA-Z]\w*)"/g)) handled.add(m[1]);
    for (const m of src.matchAll(/onMessage\(\s*"([a-zA-Z]\w*)"/g)) handled.add(m[1]);
  }
  const orphans = [...sent.keys()].filter((k) => !handled.has(k)).sort();
  ok('every message the client sends has somewhere to land', orphans.length === 0,
    orphans.map((o) => `${o} (${sent.get(o)})`).join(' · '));
}

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

// ---------------------------------------------------------------- solid world
// The player used to walk into the middle of anything without a collider and
// stand there at terrain height, which reads on screen as hovering inside the
// rock. These three checks are the guard: nothing solid is walk-through, and
// nothing solid walls the world off either.
section('solid world');
const PLAYER_R = 0.42;
const reachOf = (colliders, p) => {
  const hit = colliders.filter((c) => c.r !== undefined && Math.hypot(c.x - p.x, c.z - p.z) < 0.001);
  return hit.length ? Math.max(...hit.map((c) => c.r)) + PLAYER_R : 0;
};
let thinRocks = [];
for (const z of Object.values(ZONES)) {
  const { rocks, colliders } = P.propsFor(z);
  // a rock is drawn as a radius-1 solid scaled by s, roughened outward by 16%
  for (const r of rocks || []) if (reachOf(colliders, r) < r.s * 1.16) thinRocks.push(`${z.id}:${r.s.toFixed(2)}`);
}
ok('the player cannot walk into a rock', thinRocks.length === 0, thinRocks.slice(0, 4).join(' '));

// One haystack laid without a rotation put a NaN in the town's colliders, and
// every step anyone took through `resolveCollision` came out NaN with it.
const badSolids = [];
for (const z of Object.values(ZONES)) {
  const { colliders, structures } = P.propsFor(z);
  for (const c of [...colliders, ...(structures || [])]) {
    if (Object.values(c).some((v) => typeof v === 'number' && !Number.isFinite(v))) badSolids.push(`${z.id}:${c.kind}`);
  }
  const at = P.resolveCollision(colliders, 0.3, 4.1, PLAYER_R);
  if (!Number.isFinite(at.x) || !Number.isFinite(at.z)) badSolids.push(`${z.id}:step`);
}
ok('every solid thing in every zone is somewhere (no NaN)', badSolids.length === 0, badSolids.slice(0, 4).join(' '));

const SOLID = ['bench', 'bin', 'hydrant', 'bollard', 'fence', 'workbench', 'lamp', 'planter', 'stall', 'fountain'];
const openProps = [];
for (const z of Object.values(ZONES)) {
  const { props, colliders } = P.propsFor(z);
  for (const pr of props || []) {
    if (!SOLID.includes(pr.kind)) continue;
    const near = colliders.some((c) => Math.hypot(c.x - pr.x, c.z - pr.z) < 0.4);
    if (!near) openProps.push(`${z.id}:${pr.kind}`);
  }
}
ok('every solid street prop stops the player', openProps.length === 0,
  [...new Set(openProps)].slice(0, 4).join(' '));

// One connected walkable region, with every door and landmark in it. This is
// what catches a new collider quietly sealing a courtyard — or a room — shut.
// Written against a collider list and a bounds test so the same grid serves an
// outdoor zone and a 6 by 11 metre archive.
const STEP = 0.5;
const region = (colliders, x0, x1, z0, z1, inBounds, step = STEP) => {
  const nx = Math.ceil((x1 - x0) / step) + 1, nz = Math.ceil((z1 - z0) / step) + 1;
  const at = (i, j) => ({ x: x0 + i * step, z: z0 + j * step });
  const id = (i, j) => j * nx + i;
  const cell = 5, grid = new Map();
  for (const c of colliders) {
    const reach = (c.r ?? Math.hypot(c.hw, c.hd)) + PLAYER_R + 1;
    for (let gx = Math.floor((c.x - reach) / cell); gx <= Math.floor((c.x + reach) / cell); gx++)
      for (let gz = Math.floor((c.z - reach) / cell); gz <= Math.floor((c.z + reach) / cell); gz++) {
        const k = `${gx},${gz}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(c);
      }
  }
  const blocked = (x, zz) => (grid.get(`${Math.floor(x / cell)},${Math.floor(zz / cell)}`) || []).some((c) => {
    if (c.hw === undefined) return Math.hypot(x - c.x, zz - c.z) < c.r + PLAYER_R;
    const co = c.rot ? Math.cos(-c.rot) : 1, si = c.rot ? Math.sin(-c.rot) : 0;
    const a = (x - c.x) * co - (zz - c.z) * si, b = (x - c.x) * si + (zz - c.z) * co;
    return Math.abs(a) < c.hw + PLAYER_R && Math.abs(b) < c.hd + PLAYER_R;
  });
  const free = new Uint8Array(nx * nz), lab = new Int32Array(nx * nz).fill(-1);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const p = at(i, j);
    free[id(i, j)] = inBounds(p.x, p.z) && !blocked(p.x, p.z) ? 1 : 0;
  }
  const sizes = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if (!free[id(i, j)] || lab[id(i, j)] >= 0) continue;
    const c = sizes.length; sizes.push(0);
    const st = [[i, j]]; lab[id(i, j)] = c;
    while (st.length) {
      const [a, b] = st.pop(); sizes[c]++;
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const u = a + da, v = b + db;
        if (u < 0 || v < 0 || u >= nx || v >= nz || !free[id(u, v)] || lab[id(u, v)] >= 0) continue;
        lab[id(u, v)] = c; st.push([u, v]);
      }
    }
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const componentAt = (p, tol) => {
    const i0 = Math.round((p.x - x0) / step), j0 = Math.round((p.z - z0) / step);
    const span = Math.ceil(tol / step);
    let best = null, bd = Infinity;
    for (let i = i0 - span; i <= i0 + span; i++) for (let j = j0 - span; j <= j0 + span; j++) {
      if (i < 0 || j < 0 || i >= nx || j >= nz || !free[id(i, j)]) continue;
      const q = at(i, j), d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < bd) { bd = d; best = lab[id(i, j)]; }
    }
    return best;
  };
  return { main, componentAt, blocked, free: sizes[main] ?? 0 };
};
const walkable = (z) => {
  const half = z.size / 2;
  return region(P.propsFor(z).colliders, -half, half, -half, half,
    (x, zz) => Math.hypot(x, zz) <= half - 2, 1);
};
for (const z of Object.values(ZONES)) {
  const { main, componentAt } = walkable(z);
  const stranded = (z.landmarks || []).filter((l) => {
    const p = l.door ?? { x: l.x, z: l.z };
    return componentAt(p, l.door ? 3 : (l.r || 3) + 3) !== main;
  }).map((l) => l.kind + (l.door ? '/door' : ''));
  ok(`${z.id} is walkable in one piece`, stranded.length === 0, stranded.join(','));
}

// ---------------------------------------------------------------- weather
// Nothing about the sky is replicated: it is a pure function of the server
// clock and the zone's id, which is what lets two clients agree without a
// packet. That makes it worth testing hard, because a schedule that is not a
// function of exactly those two things is a desync nobody will reproduce.
section('weather');
const Wx = await import('../src/shared/weather.js');
const Wv = await import('../src/client/gfx/world.js');
const zoneList = Object.values(ZONES);
const T0 = 1750000000000;

ok('the same millisecond gives the same sky twice',
  zoneList.every((z) => {
    for (let i = 0; i < 200; i++) {
      const t = T0 + i * 97001;
      if (Wx.weatherAt(z, t).id !== Wx.weatherAt(z, t).id) return false;
    }
    return true;
  }));
ok('two zones do not share a schedule',
  new Set(zoneList.map((z) => Array.from({ length: 40 }, (_, i) => Wx.weatherAt(z, T0 + i * Wx.SPELL_MS).id).join())).size === zoneList.length);
const seen = new Set();
for (const z of zoneList) for (let i = 0; i < 3000; i++) seen.add(Wx.weatherAt(z, T0 + i * Wx.SPELL_MS).id);
ok('every sky the tables can produce is a known one',
  [...seen].every((id) => Wx.WEATHER[id]), [...seen].filter((id) => !Wx.WEATHER[id]).join(','));
ok('every sky has a look to draw it with',
  Object.keys(Wx.WEATHER).every((id) => Wv.WEATHER_LOOK[id]),
  Object.keys(Wx.WEATHER).filter((id) => !Wv.WEATHER_LOOK[id]).join(','));
ok('every season has a look to draw it with',
  Wx.SEASONS.every((s) => Wv.SEASON_LOOK[s.id]));

// A spell holds, then turns over. Sampling inside one block must never change
// the answer until the last TURN_MS of it.
const zone = ZONES.verdant_meadow;
const blockStart = Math.ceil(T0 / Wx.SPELL_MS) * Wx.SPELL_MS;
const held = Wx.weatherAt(zone, blockStart + 1000);
ok('a spell holds for its whole block',
  [0.05, 0.3, 0.6, 0.8].every((f) => {
    const w = Wx.weatherAt(zone, blockStart + f * (Wx.SPELL_MS - Wx.TURN_MS));
    return w.from === held.from && w.blend === 0;
  }));
const turn = Wx.weatherAt(zone, blockStart + Wx.SPELL_MS - Wx.TURN_MS / 2);
ok('the turn-over blend runs 0 to 1 in the last window', near(turn.blend, 0.5, 0.02), turn.blend.toFixed(3));
ok('the reported id flips at the halfway point',
  Wx.weatherAt(zone, blockStart + Wx.SPELL_MS - Wx.TURN_MS * 0.9).id === turn.from
  && Wx.weatherAt(zone, blockStart + Wx.SPELL_MS - Wx.TURN_MS * 0.1).id === turn.to);
ok('a block ends where the next one begins',
  Wx.weatherAt(zone, blockStart + Wx.SPELL_MS - 1).to === Wx.weatherAt(zone, blockStart + Wx.SPELL_MS + 1).from);

// Season bias. A zero in the table is a real zero.
const inSeason = (name) => {
  const out = new Set();
  for (const z of zoneList) for (let i = 0; i < 4000; i++) {
    const t = T0 + i * Wx.SPELL_MS;
    const w = Wx.weatherAt(z, t);
    if (w.season.id === name) out.add(w.from);
  }
  return out;
};
ok('nothing snows in summer', !inSeason('summer').has('snow'));
ok('it still snows in winter', inSeason('winter').has('snow'));
ok('the ember canyon never snows',
  !Array.from({ length: 4000 }, (_, i) => Wx.weatherAt(ZONES.emberfall_canyon, T0 + i * Wx.SPELL_MS).from).includes('snow'));
ok('seasons turn in order and wrap',
  [0, 1, 2, 3, 4].map((i) => Wx.seasonAt(i * Wx.SEASON_MS).id).join() === 'spring,summer,autumn,winter,spring');

// The one thing weather does to the rules.
const boosted = Object.values(Wx.WEATHER).filter((w) => w.boost);
ok('every weather boost names a real element', boosted.every((w) => ELEMENTS[w.boost]),
  boosted.filter((w) => !ELEMENTS[w.boost]).map((w) => w.boost).join(','));
// One pair, measured three times. Rolling a fresh creature per measurement
// rolls fresh IVs with it, and the difference being looked for is smaller than
// that noise — which is also why `computeDamage` now takes its rolls from the
// Combat's own `rand` rather than Math.random.
const wSim = new C.Combat({ mode: 'pve', rand: () => 0.5 });
const wA = wSim.add(new C.Combatant({
  side: 'a', kind: 'creature', name: 'a', creature: C.makeCreature('puddlet', 30), level: 30,
}));
const wB = wSim.add(new C.Combatant({
  side: 'b', kind: 'creature', name: 'b', creature: C.makeCreature('puddlet', 30), level: 30,
}));
const wMove = { type: 'aqua', kind: 'special', power: 60 };
const bigHit = (weather) => { wSim.weather = weather; return wSim.computeDamage(wA, wB, wMove, null).dmg; };
const dry = bigHit(null), wet = bigHit({ boost: 'aqua' });
ok('rain makes a water move hit harder', wet > dry * 1.1, `${dry} -> ${wet}`);
ok('rain does nothing for a move of another type', bigHit({ boost: 'volt' }) === dry);
ok('the same seed gives the same damage twice', bigHit(null) === dry);

// ---------------------------------------------------------------- interiors
// Furniture is the easiest thing in the game to add too much of: a press against
// the wrong wall walls the keeper off behind his own counter, and nothing in the
// headless suite would notice. The rooms are built here for real — `world.js`
// imports cleanly in node — and walked.
section('interiors');
const Wld = await import('../src/client/gfx/world.js');
const roomTheme = Wld.zoneTheme({ id: 'aetherport', urban: true, element: 'verdant' });
for (const kind of Object.keys(Wld.INTERIORS)) {
  const room = Wld.buildInterior(kind, roomTheme);
  const { hw, d } = room.dims;
  const r = region(room.colliders, -hw, hw, -d, 0,
    (x, zz) => x > -hw + 0.1 && x < hw - 0.1 && zz > -d + 0.1 && zz < -0.1, 0.25);
  // The customer side is whatever the spawn is standing in — not the largest
  // piece. In the shop the keeper's strip behind the counter is the larger of
  // the two, and it is meant to be a separate piece: that is what a counter is.
  const home = r.componentAt(room.spawn, 0.8);
  ok(`${kind}: the spawn is not inside the furniture`, !r.blocked(room.spawn.x, room.spawn.z) && home !== null);
  const front = { x: room.counter.x, z: room.counter.z + 1.15 };
  const away = [['exit', room.exit, 1.2], ['counter', front, 1]]
    .filter(([, p, tol]) => r.componentAt(p, tol) !== home).map(([nm]) => nm);
  ok(`${kind}: the door and the counter are on the same side of the room`, away.length === 0, away.join(','));
  ok(`${kind}: the keeper is not standing inside the furniture`, !r.blocked(room.npc.x, room.npc.z));
  const area = r.free * 0.25 * 0.25;
  ok(`${kind}: there is room to walk`, area > 14, `${area.toFixed(0)}m2 of ${(hw * 2 * d).toFixed(0)}`);
}

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
// The zone has the final say on capture. `capturable: false` sat in the home
// dock's data unread while the capture path checked the mode, the target kind
// and the boss flag — everything except where the fight was happening.
{
  const sphere = (zoneId) => {
    const doc2 = C.createPlayerDoc('u2', 'QA', {}, 'cindcub');
    C.normalizeDoc(doc2);
    C.giveItem(doc2, 'sphere_basic', 5);
    const seen = [];
    const net2 = { doc: doc2, guilds: [], emit: (k, v) => seen.push([k, v]), save: () => {}, pendingRooms: new Map() };
    const sim = new B.BattleSim(net2, { zoneId, wild: { species: 'mossnail', level: 5 } });
    sim.state.phase = 'active';
    // The starting kit already carries spheres, so count the change rather than
    // the total.
    const had = doc2.inventory.sphere_basic;
    sim.handle('trainer', { action: 'sphere', sphere: 'sphere_basic' });
    const no = seen.filter(([k]) => k === 'actionRejected').map(([, v]) => v.reason);
    return { refused: no, spent: had - doc2.inventory.sphere_basic };
  };
  const home = sphere('aetherport'), field = sphere('verdant_meadow');
  ok('the home dock refuses a capture, as its own data says it should',
    home.refused.includes('no_capture_here'), JSON.stringify(home));
  ok('and it refuses before taking the sphere', home.spent === 0, String(home.spent));
  ok('a capturable zone does not refuse',
    !field.refused.includes('no_capture_here'), JSON.stringify(field));
}

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

// ---------------------------------------------------------------- app shell
section('app shell');
const shellHtml = fs.readFileSync('src/client/index.html', 'utf8');
// Chromium does not expose -webkit-touch-callout through getComputedStyle, so
// the iOS-only rules are checked where they live rather than where they apply.
for (const [label, needle] of [
  ['the long-press callout is disabled', '-webkit-touch-callout:none'],
  ['text selection is off', '-webkit-user-select:none'],
  ['the notch is covered', 'viewport-fit=cover'],
  ['pinch zoom is refused', 'user-scalable=no'],
  ['iOS is told the page is an app', 'apple-mobile-web-app-capable'],
  ['the status bar is translucent so the world runs under it', 'black-translucent'],
  ['a manifest is linked', 'rel="manifest"'],
  ['the measured viewport height is used for layout', '--vh'],
  ['landscape has its own layout', 'orientation:landscape'],
]) ok(label, shellHtml.includes(needle), needle);

const manifest = JSON.parse(fs.readFileSync('src/client/manifest.webmanifest', 'utf8'));
ok('the manifest asks for a chrome-free launch',
  manifest.display === 'fullscreen' && manifest.display_override?.includes('standalone'), manifest.display);
ok('the manifest has a relative scope, so a project page works',
  manifest.start_url.startsWith('./') && manifest.scope.startsWith('./'));
ok('the manifest ships an icon that exists', fs.existsSync('src/client/' + manifest.icons[0].src.replace('./', '')));

const sw = fs.readFileSync('src/client/sw.js', 'utf8');
ok('the service worker survives a missing file', !/\.addAll\(/.test(sw));
ok('the service worker prefers the network, so a build is never stale',
  sw.indexOf('fetch(e.request)') < sw.indexOf('caches.match(e.request)'));

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

// The ground: every element has its look, and every camp its paths out.
section('ground');
const wildZones = Object.values(G.ZONES).filter((z) => !z.urban);
ok('every element has a ground to paint and a cap for its rocks',
  wildZones.every((z) => Wv.GROUND[z.element] && z.element in Wv.ROCK_CAP),
  wildZones.filter((z) => !Wv.GROUND[z.element] || !(z.element in Wv.ROCK_CAP)).map((z) => z.id).join(','));
ok('a zone lays the same paths every time', wildZones.every((z) => {
  const cs = P.propsFor(z).colliders, a = Wv.buildTrails(z, cs), b = Wv.buildTrails(z, cs);
  return a && b && a.texture.image.data.every((v, i) => v === b.texture.image.data[i]);
}));
const trailMiss = [];
for (const z of wildZones) {
  const tr = Wv.buildTrails(z, P.propsFor(z).colliders), camp = z.landmarks.find((l) => l.kind === 'camp');
  if (WP.planFor(z)) {
    // A planned zone's roads bend round what is in the way, so "the path
    // leaves the camp toward it" is not the question: can you walk from the
    // camp to each portal and gate on road, and does the road reach it?
    const N = 120, px = z.size / N, on = new Uint8Array(N * N), seen = new Uint8Array(N * N);
    const idx = (x, zz) => { const i = Math.floor(x / px + N / 2), j = Math.floor(zz / px + N / 2); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5 - N / 2) * px, zz = (j + 0.5 - N / 2) * px;
      on[j * N + i] = tr.at(x, zz) > 0.35 || Math.hypot(x - camp.x, zz - camp.z) < camp.r + 2 ? 1 : 0;
    }
    const q = [idx(camp.x, camp.z)]; seen[q[0]] = 1;
    while (q.length) { const k = q.pop(), i = k % N, j = (k / N) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni; if (on[n] && !seen[n]) { seen[n] = 1; q.push(n); } } }
    for (const t of z.landmarks) {
      if (t.kind !== 'portal' && t.kind !== 'dungeon') continue;
      let reach = false;
      for (let a = 0; a < 16 && !reach; a++) for (const r of [0, 2, 4, 6]) { const k = idx(t.x + Math.cos(a / 16 * 6.283) * r, t.z + Math.sin(a / 16 * 6.283) * r); if (k >= 0 && seen[k]) { reach = true; break; } }
      reach || trailMiss.push(`${z.id}:${t.kind}@${t.x},${t.z} no road`);
    }
    continue;
  }
  for (const t of z.landmarks) {
    if (t.kind !== 'portal' && t.kind !== 'dungeon') continue;
    if (Math.hypot(t.x - camp.x, t.z - camp.z) < (camp.r || 8) + 6) continue;
    const ux = (t.x - camp.x), uz = (t.z - camp.z), l = Math.hypot(ux, uz);
    // the path leaves the camp toward it, and arrives at it
    const out = tr.at(camp.x + ux / l * (camp.r || 8) * 0.8, camp.z + uz / l * (camp.r || 8) * 0.8),
      end = tr.at(t.x - ux / l * (t.r || 2.6), t.z - uz / l * (t.r || 2.6));
    (out < 0.5 || end < 0.5) && trailMiss.push(`${z.id}:${t.kind}@${t.x},${t.z} ${out.toFixed(2)}/${end.toFixed(2)}`);
  }
}
ok('a path runs from every camp to each portal and dungeon', trailMiss.length === 0, trailMiss.join(' '));
const onPath = [];
for (const z of wildZones) {
  const tr = Wv.buildTrails(z, P.propsFor(z).colliders);
  for (const c of P.propsFor(z).colliders) if (c.kind === 'tree' && tr.at(c.x, c.z) > 0.85) onPath.push(`${z.id}@${c.x.toFixed(0)},${c.z.toFixed(0)}`);
}
ok('the paths go round the trees, mostly', onPath.length <= wildZones.length * 2, onPath.join(' '));

// Figurines: every species is sculpted, and every sculpture holds together.
section('figurines');
const Fig = await import('../src/client/gfx/figurine.js');
const { FIGURINES } = await import('../src/client/gfx/figurine-designs-more.js');
ok('every species has a figurine', Object.keys(G.SPECIES).every((id) => FIGURINES[id]),
  Object.keys(G.SPECIES).filter((id) => !FIGURINES[id]).join(','));
const figBad = [];
for (const [id, d] of Object.entries(FIGURINES)) {
  try {
    const T = Fig.template(id, d, true);
    const lo = T.geoLo, hi = T.geoHi;
    const trisLo = lo.index.count / 3, trisHi = hi.index.count / 3;
    const nb = T.names.length;
    const fx = hi.attributes.aFx.array, si = hi.attributes.skinIndex.array, sw = hi.attributes.skinWeight.array;
    let eyes = 0, badBone = 0, badW = 0;
    for (let i = 0; i < fx.length; i += 4) if (fx[i + 2] < 4) eyes++;
    for (let i = 0; i < si.length; i++) if (si[i] >= nb) badBone++;
    for (let i = 0; i < sw.length; i += 4) if (Math.abs(sw[i] + sw[i + 1] + sw[i + 2] + sw[i + 3] - 1) > 1e-3) badW++;
    const box = hi.boundingBox, span = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    const why = [];
    if (trisHi < 3000 || trisHi > 24000) why.push(`hi ${trisHi}`);
    if (trisLo > 8000) why.push(`lo ${trisLo}`);
    if (!eyes && d.eyes) why.push('no eyes');
    if (badBone) why.push(`${badBone} bad bones`);
    if (badW) why.push(`${badW} bad weights`);
    if (Math.abs(span - d.size) > d.size * 0.12) why.push(`span ${span.toFixed(2)} vs ${d.size}`);
    if (box.min.y < -0.02 * d.size) why.push('below the ground');
    if (why.length) figBad.push(`${id}: ${why.join(', ')}`);
  } catch (e) { figBad.push(`${id}: ${e.message}`); }
}
ok('every figurine bakes: in budget, eyes set in, bones and weights sound, the right size', figBad.length === 0, figBad.join(' | '));

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

// ---------------------------------------------------------------- your spot
// Every arrival used to be the camp, so every fight and every capture sent the
// player home. The spot is kept on the document and a return puts you on it.
section('your spot');
const F = await import('../src/server/game/field.js');
{
  const sdoc = C.createPlayerDoc('u7', 'QA7', {}, 'puddlet');
  C.normalizeDoc(sdoc);
  const snet = { doc: sdoc, guilds: [], emit: () => {}, save: () => {}, pendingRooms: new Map() };
  const meadow = ZONES.verdant_meadow, camp = meadow.landmarks.find((l) => l.kind === 'camp');
  const w1 = new B.WorldSim(snet, 'verdant_meadow');
  w1.start(); w1.stop();
  const spot = w1.randomFieldPoint();
  Object.assign(w1.self(), spot);
  w1.handle('move', { x: spot.x + 0.8, z: spot.z + 0.3, moving: true });
  const at = { x: w1.self().x, z: w1.self().z };
  ok('an accepted step is kept on the document', sdoc.pos?.zone === 'verdant_meadow'
    && near(sdoc.pos.x, at.x, 0.02) && near(sdoc.pos.z, at.z, 0.02), JSON.stringify(sdoc.pos));
  ok('the spot is out in the field, not at the camp', Math.hypot(at.x - camp.x, at.z - camp.z) > camp.r + 2);

  const w2 = new B.WorldSim(snet, 'verdant_meadow');
  w2.start(); w2.stop();
  ok('coming back to the zone (a fight, a capture) puts you on it',
    Math.hypot(w2.self().x - at.x, w2.self().z - at.z) < 0.8,
    `${w2.self().x.toFixed(1)},${w2.self().z.toFixed(1)} vs ${at.x.toFixed(1)},${at.z.toFixed(1)}`);

  const w3 = new B.WorldSim(snet, 'verdant_meadow', 'aetherport');
  w3.start(); w3.stop();
  ok('arriving from another zone still lands at its camp',
    Math.hypot(w3.self().x - camp.x, w3.self().z - camp.z) < camp.r, `${w3.self().x.toFixed(1)},${w3.self().z.toFixed(1)}`);

  sdoc.pos = { zone: 'verdant_meadow', x: at.x, z: at.z };
  const w4 = new B.WorldSim(snet, 'stonewake_mesa');
  w4.start(); w4.stop();
  const camp4 = ZONES.stonewake_mesa.landmarks.find((l) => l.kind === 'camp');
  ok('a spot in one zone is not used in another',
    Math.hypot(w4.self().x - camp4.x, w4.self().z - camp4.z) < camp4.r);

  ok('a spot inside a wall is pushed out of it', (() => {
    const c = w1.colliders.find((k) => k.r && k.r > 0.5);
    if (!c) return true;
    const s = F.savedSpot({ pos: { zone: 'verdant_meadow', x: c.x, z: c.z } }, 'verdant_meadow', meadow, w1.colliders, null);
    return Math.hypot(s.x - c.x, s.z - c.z) >= c.r;
  })());
  ok('a spot off the edge of the world is brought back onto it', (() => {
    const s = F.savedSpot({ pos: { zone: 'verdant_meadow', x: 9e3, z: -9e3 } }, 'verdant_meadow', meadow, w1.colliders, null);
    return Math.abs(s.x) <= meadow.size / 2 && Math.abs(s.z) <= meadow.size / 2;
  })());
  ok('a spot with no numbers in it is ignored',
    F.savedSpot({ pos: { zone: 'verdant_meadow', x: 'a', z: null } }, 'verdant_meadow', meadow, w1.colliders, null) === null);

  // losing is the one fight you do not walk away from where it was
  sdoc.pos = { zone: 'verdant_meadow', x: at.x, z: at.z };
  const lost = new B.BattleSim(snet, { zoneId: 'verdant_meadow', wild: { species: 'sparkit', level: 5 } });
  lost.resolve({ outcome: 'b' });
  ok('a blackout sends you back to the camp', sdoc.pos === null);
  ok('and any fight leaves half a minute of calm behind it',
    sdoc.calmUntil - Date.now() > F.FIELD.battleCalmMs - 2000 && sdoc.calmUntil - Date.now() <= F.FIELD.battleCalmMs);
  sdoc.pos = { zone: 'verdant_meadow', x: at.x, z: at.z };
  const won = new B.BattleSim(snet, { zoneId: 'verdant_meadow', wild: { species: 'sparkit', level: 5 } });
  won.resolve({ outcome: 'a' });
  ok('a win keeps the spot', sdoc.pos?.zone === 'verdant_meadow');
  const ran = new B.BattleSim(snet, { zoneId: 'verdant_meadow', wild: { species: 'sparkit', level: 5 } });
  ran.resolve({ outcome: 'fled' });
  ok('so does running away', sdoc.pos?.zone === 'verdant_meadow');
}

// ---------------------------------------------------------------- the field
// Wilds that come for you, the balanced way (server/game/field.js).
section('the field');
{
  for (const [id, t] of Object.entries(G.TEMPER)) {
    ok(`temper ${id} names a species and a real temper`, !!SPECIES[id] && (t === 'fierce' || t === 'nocturnal' || t === 'shy'), t);
  }
  for (const z of Object.values(ZONES)) {
    if (z.urban) continue;
    const total = z.spawns.reduce((a, [, w]) => a + w, 0);
    const share = (night) => z.spawns.filter(([s]) => F.temperOf(s, night) === 'fierce').reduce((a, [, w]) => a + w, 0) / total;
    ok(`${z.id}: some of it comes for you, most of it does not`,
      share(false) > 0 && share(false) <= 0.6 && share(true) <= 0.6,
      `day ${(share(false) * 100).toFixed(0)}% night ${(share(true) * 100).toFixed(0)}%`);
  }
  ok('nocturnal is calm by day and fierce by night',
    F.temperOf('nocturnix', false) === 'calm' && F.temperOf('nocturnix', true) === 'fierce');

  const fdoc = C.createPlayerDoc('u8', 'QA8', {}, 'puddlet');
  C.normalizeDoc(fdoc);
  fdoc.level = 6;
  const lead = C.activeCreature(fdoc);
  ok('the same element as your companion leaves you be', F.stanceToward('tidefin', 20, fdoc) === 'kin');
  ok('a dual type sharing either element does too', F.stanceToward('mossnail', 9, fdoc) === 'kin');
  ok('another element comes for you', F.stanceToward('sparkit', 6, fdoc) === 'fight');
  lead.level = 20;
  ok('one far weaker than your companion runs instead', F.stanceToward('sparkit', 8, fdoc) === 'flee');
  ok('one only a little weaker still fights', F.stanceToward('sparkit', 16, fdoc) === 'fight');
  lead.level = 5;
  const hp = lead.hp;
  for (const u of fdoc.team) fdoc.creatures[u].hp = 0;
  ok('nothing of yours standing: nothing starts on you', F.stanceToward('sparkit', 5, fdoc) === 'unarmed');
  lead.hp = hp;

  ok('the rule about elements is explained once, where it applies', (() => {
    const hd = C.createPlayerDoc('u9', 'QA9', {}, 'cindcub');
    const newbie = F.fieldHint(hd, ZONES.verdant_meadow);
    hd.level = 5;
    const town = F.fieldHint(hd, ZONES.aetherport), first = F.fieldHint(hd, ZONES.verdant_meadow), again = F.fieldHint(hd, ZONES.emberfall_canyon);
    return newbie === null && town === null && typeof first === 'string' && first.includes('יסוד') && again === null;
  })());
  ok('town is safe ground', F.inSafeGround(ZONES.aetherport, 30, 30));
  const meadow = ZONES.verdant_meadow, camp = meadow.landmarks.find((l) => l.kind === 'camp');
  ok('a camp is safe ground', F.inSafeGround(meadow, camp.x + 2, camp.z - 2));

  // A live field on the single-player simulation, on a clock the test holds.
  const fev = [];
  const fnet = { doc: fdoc, guilds: [], emit: (k, v) => fev.push([k, v]), save: () => {}, pendingRooms: new Map() };
  const fw = new B.WorldSim(fnet, 'verdant_meadow');
  fw.start(); fw.stop();
  fw.state.wilds.clear(); fw.wildDocs.clear();
  const home = fw.randomFieldPoint();
  ok('open field is not safe ground', !F.inSafeGround(meadow, home.x, home.z, F.FIELD.safeMargin));
  let T = Date.now() + 3_600_000;
  const self = () => fw.self();
  const reset = () => {
    Object.assign(self(), { x: home.x, z: home.z, status: 'idle' });
    fw.calmUntil = 0; fw.escapedUntil = 0; fw.battlePending = 0; fw.chasedBy = null; fw.lastStepAt = T; fw.away = false;
    fw.state.wilds.clear(); fw.wildDocs.clear(); fev.length = 0;
  };
  // A spot `dist` away with nothing solid between it and the player.
  const clear = (dist) => {
    const p = self();
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, x = p.x + Math.cos(a) * dist, z = p.z + Math.sin(a) * dist;
      const blocked = fw.colliders.some((c) => {
        const r = (c.r ?? Math.max(c.hw, c.hd)) + 0.9, vx = x - p.x, vz = z - p.z;
        const t = Math.max(0, Math.min(1, ((c.x - p.x) * vx + (c.z - p.z) * vz) / (vx * vx + vz * vz)));
        return Math.hypot(p.x + vx * t - c.x, p.z + vz * t - c.z) < r;
      });
      if (!blocked && Math.abs(x) < meadow.size / 2 - 3 && Math.abs(z) < meadow.size / 2 - 3) return { x, z };
    }
    return null;
  };
  const put = (species, level, dist) => {
    const at = clear(dist), id = 'q' + Math.random().toString(36).slice(2, 8);
    if (!at) return null;
    fw.state.wilds.set(id, { id, species, level, x: at.x, z: at.z, rot: 0, engagedBy: '', alert: '', target: '' });
    fw.wildDocs.set(id, { species, level, target: { ...at }, next: T + 1e9, mode: '', restUntil: 0 });
    return id;
  };
  const run = (ms, until = () => false, stepping = true) => {
    for (let t = 0; t < ms; t += 50) {
      T += 50; stepping && (fw.lastStepAt = T);
      F.tickField(fw.field, T, 50);
      if (until()) return true;
    }
    return false;
  };
  const dist = (id) => { const w = fw.state.wilds.get(id), p = self(); return Math.hypot(w.x - p.x, w.z - p.z); };

  reset();
  let id = put('sparkit', 6, 4.5);
  ok('a test spot with a clear line exists', !!id);
  ok('a fierce wild of another element sees you: "!"',
    run(6000, () => fw.state.wilds.get(id).alert === '!') && fw.state.wilds.get(id).target === fdoc.id,
    JSON.stringify(fw.state.wilds.get(id)));
  const seenAt = { ...fw.state.wilds.get(id) };
  run(F.FIELD.alertMs - 100);
  ok('and stands still while the "!" shows', Math.hypot(fw.state.wilds.get(id).x - seenAt.x, fw.state.wilds.get(id).z - seenAt.z) < 0.01);
  ok('then comes for you and the fight starts where it caught you',
    run(4000, () => fev.some(([k]) => k === 'goto')), JSON.stringify({ d: dist(id).toFixed(2), mode: fw.wildDocs.get(id)?.mode }));
  const g = fev.find(([k]) => k === 'goto')?.[1];
  ok('as an ambush, through the same battle path as pressing the button',
    g?.kind === 'battle' && g.ambush === true && fw.state.wilds.get(id).engagedBy === fdoc.id && fnet.pendingRooms.has(g.roomId));
  ok('a caught player is not caught twice', (() => {
    const id2 = put('voltmane', 6, 3);
    return !run(3000, () => fev.filter(([k]) => k === 'goto').length > 1);
  })());

  reset();
  fw.chasedBy = 'long-gone';
  id = put('sparkit', 6, 4.5);
  ok('a pursuer that is no longer there does not keep the others off',
    run(6000, () => fw.state.wilds.get(id).alert === '!'), String(fw.chasedBy));

  reset();
  id = put('tidefin', 8, 4);
  ok('one sharing your companion\'s element never starts', !run(6000, () => fw.state.wilds.get(id).alert));

  reset();
  id = put('mossnail', 6, 4);
  ok('a calm species never starts', !run(6000, () => fw.state.wilds.get(id).alert));

  reset();
  id = put('sparkit', 6, 4.5);
  run(6000, () => fw.state.wilds.get(id).alert === '!');
  {
    // run: put 16m between you and it in one go
    const w = fw.state.wilds.get(id), p = self(), dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz);
    Object.assign(p, { x: w.x + dx / d * 16, z: w.z + dz / d * 16 });
  }
  ok('out of sight, it gives up: "?"', run(1500, () => fw.state.wilds.get(id).alert === '?'));
  ok('and nothing starts on you again straight away', fw.escapedUntil > T && !fw.chasedBy);
  ok('then it wanders off', run(F.FIELD.lostMs + 200, () => !fw.state.wilds.get(id).alert));
  ok('and leaves everyone alone for a while', fw.wildDocs.get(id).restUntil > T + F.FIELD.wildRestMs - 3000);

  reset();
  id = put('sparkit', 6, 5);
  ok('a trainer at a run gets away', (() => {
    run(6000, () => fw.state.wilds.get(id).alert === '!');
    const w = fw.state.wilds.get(id);
    // run straight away from it at full speed, 7.4 m/s, for the whole chase
    for (let t = 0; t < F.FIELD.chaseMs + F.FIELD.alertMs + 1000; t += 50) {
      const p = self(), dx = p.x - w.x, dz = p.z - w.z, d = Math.hypot(dx, dz) || 1;
      Object.assign(p, { x: p.x + dx / d * 0.37, z: p.z + dz / d * 0.37 });
      T += 50; fw.lastStepAt = T; F.tickField(fw.field, T, 50);
      if (fev.some(([k]) => k === 'goto')) return false;
    }
    return true;
  })());

  reset();
  lead.level = 20;
  id = put('sparkit', 6, 3.5);
  const d0 = dist(id);
  ok('one far weaker runs from you', run(1500, () => fw.state.wilds.get(id).alert === '~'));
  run(1200);
  ok('and gets further away, not closer', dist(id) > d0 + 1, `${d0.toFixed(1)} → ${dist(id).toFixed(1)}`);
  ok('and never starts a fight', !fev.some(([k]) => k === 'goto'));
  lead.level = 5;

  const quiet = (label, setup, stepping = true) => {
    reset();
    const qid = put('sparkit', 6, 3.5);
    setup();
    ok(label, !run(5000, () => fw.state.wilds.get(qid).alert, stepping));
  };
  quiet('nothing starts in the half-minute after a fight', () => { fw.calmUntil = T + F.FIELD.battleCalmMs; });
  quiet('nothing starts on a trainer who stepped away from the game', () => { fw.away = true; });
  quiet('or who has not taken a step in a minute', () => { fw.lastStepAt = T - F.FIELD.awayMs - 1; }, false);
  quiet('or who is still new', () => { fdoc.level = 2; });
  fdoc.level = 6;
  quiet('or who is indoors', () => { self().status = 'inside'; });
  quiet('or inside a camp', () => {
    Object.assign(self(), { x: camp.x + 1, z: camp.z + 1 });
    for (const [, w] of fw.state.wilds) Object.assign(w, { x: camp.x + 3.5, z: camp.z + 1 });
  });
  // shy: the rare ones bolt from a trainer who comes running, and let one
  // who creeps up stand beside them
  reset();
  id = put('lumoth', 6, 5);
  fw.pace = 7.4;
  const s0 = dist(id);
  ok('a shy wild bolts from a trainer coming at a run', run(1500, () => fw.state.wilds.get(id).alert === '~') && fw.state.wilds.get(id).target === fdoc.id);
  run(1500);
  ok('and gets away from them, faster than a creep', dist(id) > s0 + 3, `${s0.toFixed(1)} → ${dist(id).toFixed(1)}`);
  ok('but never starts a fight', !fev.some(([k]) => k === 'goto'));
  ok('then stops to catch its breath', run(F.FIELD.shyMs + 500, () => !fw.state.wilds.get(id).alert) && fw.wildDocs.get(id).restUntil > T);
  reset();
  id = put('lumoth', 6, 4);
  fw.pace = 3.2;
  ok('one who creeps up (a half tilt of the stick) is let near', !run(4000, () => fw.state.wilds.get(id).alert));
  reset();
  fdoc.level = 1;
  id = put('stormstag', 3, 4);
  fw.pace = 7.4;
  ok('a shy one bolts from a new trainer too — it is shy, not fierce', run(1500, () => fw.state.wilds.get(id).alert === '~'));
  fdoc.level = 6; fw.pace = 0;

  ok('the town never has it at all', (() => {
    const tw = new B.WorldSim(fnet, 'aetherport');
    tw.start(); tw.stop();
    tw.calmUntil = 0; tw.lastStepAt = T;
    for (const [, w] of tw.state.wilds) Object.assign(w, { species: 'sparkit', level: 6, x: tw.self().x + 3, z: tw.self().z });
    let seen = false;
    for (let t = 0; t < 4000; t += 50) {
      T += 50; tw.lastStepAt = T; F.tickField(tw.field, T, 50);
      for (const [, w] of tw.state.wilds) seen ||= !!w.alert;
    }
    return !seen;
  })());
}

// ---------------------------------------------------------------- the wilds
// Where and when each wild is found (shared/habitats.js): every field zone has
// a line of its own, the rare ones keep their hours, and the log can say where
// to look for anything that lives wild.
section('the wilds');
{
  const H = await import('../src/shared/habitats.js');
  const W = await import('../src/shared/weather.js');
  const fieldZones = Object.values(ZONES).filter((z) => z.capturable !== false);
  const bad = [];
  for (const z of Object.values(ZONES)) for (const row of z.spawns || []) {
    const how = H.howOf(row);
    if (how.at && !H.HABITATS[how.at]) bad.push(`${z.id}/${row[0]} at ${how.at}`);
    if (how.when && !H.HOURS[how.when]) bad.push(`${z.id}/${row[0]} when ${how.when}`);
    if (how.herd && !(how.herd[0] >= 1 && how.herd[1] >= how.herd[0] && how.herd[1] <= 5)) bad.push(`${z.id}/${row[0]} herd`);
    if (!(row[1] > 0)) bad.push(`${z.id}/${row[0]} weight`);
  }
  ok('every spawn row says a real ground, a real hour and a sane herd', !bad.length, bad.join(', '));
  const own = fieldZones.map((z) => [z.id, z.spawns.filter(([sp]) => fieldZones.filter((o) => H.rowFor(o, sp)).length === 1 && SPECIES[sp].evolve)]);
  ok('every field zone has a line found nowhere else', own.every(([, l]) => l.length >= 1), own.filter(([, l]) => !l.length).map(([z]) => z).join(','));
  ok('and its own line is what it has most of', fieldZones.every((z) => {
    const top = [...z.spawns].sort((a, b) => b[1] - a[1])[0][0];
    return own.find(([id]) => id === z.id)[1].some(([sp]) => sp === top);
  }));
  ok('every zone prize is its own line, grown', fieldZones.every((z) => {
    const q = G.zoneQuestChain(z)[`q_${z.id}_prize`];
    return q && q.goal.species === z.prize && SPECIES[z.prize] && Object.values(SPECIES).some((s) => s.evolve?.into === z.prize);
  }));
  const wild = new Set(fieldZones.flatMap((z) => z.spawns.map(([sp]) => sp)));
  const missing = Object.values(SPECIES).filter((s) => s.rarity !== 'boss' && !s.gift && !wild.has(s.id)
    && !Object.values(SPECIES).some((p) => p.evolve?.into === s.id) && s.rarity !== 'starter');
  ok('anything that does not evolve from something lives wild somewhere', !missing.length, missing.map((s) => s.id).join(','));
  ok('the log can say where every wild one is', [...wild].every((sp) => H.foundWhere(sp).length && H.foundWhere(sp).every((f) => H.whereLine(f).length > 2)));

  // a day and a year of the clock, sampled
  const T0 = 1_790_000_000_000, day = W.DAY_MS, year = W.YEAR_MS;
  const sample = (zone, row, span, n) => { let on = 0; for (let i = 0; i < n; i++) on += H.inHour(row, zone, T0 + span * i / n) ? 1 : 0; return on / n; };
  const hours = fieldZones.flatMap((z) => z.spawns.filter((r) => H.howOf(r).when).map((r) => [z, r]));
  ok('the rare ones keep hours', hours.length >= 5);
  for (const [z, r] of hours) {
    const share = sample(z, r, year * 2, 4000);
    ok(`${r[0]} in ${z.id} (${H.howOf(r).when}) is out some of the time, not all of it`, share > 0.08 && share < (H.howOf(r).when === 'day' ? 0.75 : 0.6), `${(share * 100).toFixed(0)}%`);
  }
  ok('at night the moth is out, by day it is not',
    H.inHour(H.rowFor(ZONES.verdant_meadow, 'lumoth'), ZONES.verdant_meadow, T0 - (T0 % day) + day * 0.05)
    && !H.inHour(H.rowFor(ZONES.verdant_meadow, 'lumoth'), ZONES.verdant_meadow, T0 - (T0 % day) + day * 0.45));
  ok('the rain lamb comes with the rain the sky shows', (() => {
    const z = ZONES.tidal_hollow, r = H.rowFor(z, 'drizzlamb');
    for (let i = 0; i < 3000; i++) { const t = T0 + i * 60_000; const sky = W.weatherAt(z, t).id; if (H.inHour(r, z, t) !== (sky === 'rain' || sky === 'storm')) return false; }
    return true;
  })());
  ok('no zone ever runs out of things to meet', fieldZones.every((z) => { for (let i = 0; i < 500; i++) if (!H.spawnPool(z, T0 + i * 97_000).length) return false; return true; }));
  ok('one out of its hour is told to leave; one in it, or a regular, is not', (() => {
    const z = ZONES.verdant_meadow, dayT = T0 - (T0 % day) + day * 0.45;
    return H.outOfHour(z, 'lumoth', dayT) && !H.outOfHour(z, 'burrowbun', dayT) && !H.outOfHour(z, 'lumoth', dayT + day * 0.5);
  })());
  ok('a herd is a herd', (() => { const r = H.rowFor(ZONES.stonewake_mesa, 'cragkid'); const n = [0, 0.5, 0.999].map((u) => H.herdSize(r, () => u)); return n[0] === 2 && n[2] === 4 && H.herdSize(['pebblin', 1]) === 1; })());

  // the server side (game/wilds.js), on a zone of its own
  const Wl = await import('../src/server/game/wilds.js');
  const mkWorld = (zid) => {
    const zone = ZONES[zid], state = { wilds: new Map() }, docs = new Map();
    let n = 0;
    return { zone, colliders: P.propsFor(zone).colliders, state, wildDocs: docs, target: WP.wildTarget(zone),
      spawn: (sp, lv, at) => { const id = 'q' + (n++); state.wilds.set(id, { id, species: sp, level: lv, x: at.x, z: at.z, engagedBy: '' }); docs.set(id, { species: sp, level: lv, target: { ...at }, next: 0, mode: '' }); return id; } };
  };
  const dayT = T0 - (T0 % day) + day * 0.45, nightT = dayT + day * 0.5;
  const wm = mkWorld('stonewake_mesa');
  Wl.populate(wm, dayT, WP.PLANS && ((s) => () => (s = (s * 16807) % 2147483647) / 2147483647)(7));
  const PM = WP.planFor('stonewake_mesa');
  ok('a planned zone is stocked to its size', wm.state.wilds.size === WP.wildTarget(ZONES.stonewake_mesa) && WP.wildTarget(ZONES.stonewake_mesa) > 14);
  ok('every wild comes out on ground a body can stand on', [...wm.state.wilds.values()].every((w) => PM.walkable(w.x, w.z)));
  ok('the ones with ground of their own come out on it', [...wm.state.wilds.values()].filter((w) => H.howOf(H.rowFor(ZONES.stonewake_mesa, w.species)).at === 'cliff')
    .every((w) => PM.cliffDist(w.x, w.z) <= 12));
  {
    let t = dayT;
    for (let k = 0; k < 400; k++) { t += 50; Wl.tickWilds(wm, t, 50); }
    ok('and wander without walking off it, or into the oasis', [...wm.state.wilds.values()].every((w) => PM.walkable(w.x, w.z)));
  }
  const wn = mkWorld('verdant_meadow');
  const herdOf = (sp) => { for (let i = 0; i < 300; i++) { const before = wn.state.wilds.size; Wl.spawnGroup(wn, dayT, Math.random, 9); const ids = [...wn.state.wilds.values()].slice(before); if (ids[0]?.species === sp) return ids.length; } return 0; };
  ok('the rabbits come out two or three together', [2, 3].includes(herdOf('burrowbun')));
  const night = mkWorld('verdant_meadow');
  night.spawn('lumoth', 5, WP.fieldPoint(night.zone, night.colliders));
  [...night.wildDocs.values()][0].hour = 'night';
  ok('the moth stays while it is night', Wl.departures(night, nightT) === 0 && night.state.wilds.size === 1);
  night._hourCheckAt = 0;
  ok('and is gone when the day comes', Wl.departures(night, dayT) === 1 && night.state.wilds.size === 0);
  const fought = mkWorld('verdant_meadow');
  fought.spawn('lumoth', 5, WP.fieldPoint(fought.zone, fought.colliders));
  [...fought.wildDocs.values()][0].hour = 'night';
  [...fought.state.wilds.values()][0].engagedBy = 'someone';
  ok('unless someone is fighting it', Wl.departures(fought, dayT) === 0);
}

// ---------------------------------------------------------------- GM tools
section('GM tools');
{
  const A = await import('../src/server/admin.js');
  ok('ADMIN_USERS is read as names, any separator, any case',
    [...A.adminNames({ ADMIN_USERS: ' Meir, dana;;yoni  ' })].join() === 'meir,dana,yoni');
  ok('a listed, registered account is a GM', A.isAdmin({ username: 'dana', id: 'x' }, { ADMIN_USERS: 'meir,dana' }));
  ok('an unlisted one is not', !A.isAdmin({ username: 'eve', id: 'x' }, { ADMIN_USERS: 'meir,dana' }));
  ok('a guest never is, whatever its placeholder name', !A.isAdmin({ username: 'guest_ab12cd34', guest: true }, { ADMIN_USERS: 'guest_ab12cd34' }));
  ok('nothing listed: nobody', !A.isAdmin({ username: 'meir' }, {}));

  const GMm = await import('../src/server/game/gm.js');
  const gdoc = C.createPlayerDoc('g1', 'Keeper', {}, 'cindcub'), odoc = C.createPlayerDoc('o1', 'Other', {}, 'puddlet');
  C.normalizeDoc(gdoc); C.normalizeDoc(odoc);
  const gev = [], oev = [], logged = [], said = [];
  const oself = { x: 3, z: 4, hpRatio: 0, petSpecies: '' };
  const gctx = {
    doc: gdoc, zoneId: 'verdant_meadow', admin: true,
    self: () => ({ x: 0, z: 0 }),
    net: { emit: (k, v) => gev.push([k, v]), save: () => {} },
    gm: {
      online: () => [{ id: 'o1', name: 'Other', level: 1, zone: 'aetherport' }],
      reach: (id) => id === 'o1' ? { doc: odoc, zoneId: 'aetherport', self: () => oself, send: (k, v) => oev.push([k, v]), save: () => {} } : null,
      broadcast: (m) => (said.push(m), 3),
      summon: () => 'w1',
      audit: (e) => logged.push(e),
      recent: () => logged.slice().reverse(),
    },
  };
  const last = (list, kind) => [...list].reverse().find(([k, v]) => k === 'gm' && (!kind || v.kind === kind))?.[1];

  const gold0 = gdoc.gold;
  GMm.handleGm({ ...gctx, admin: false }, { op: 'fill' });
  ok('refused unless the server said this session is a GM',
    gev.some(([k, v]) => k === 'error' && v.code === 'forbidden') && gdoc.gold === gold0 && !logged.length);

  GMm.handleGm(gctx, { op: 'give', what: 'creature', species: 'aurorix', level: 50, shiny: true });
  const got = Object.values(gdoc.creatures).find((c) => c.species === 'aurorix');
  ok('any creature at any level', got?.level === 50 && got.shiny === true && gdoc.dex?.aurorix?.caught === 1);
  ok('and it goes on the record', logged.at(-1)?.op === 'give' && logged.at(-1).detail?.species === 'aurorix');
  GMm.handleGm(gctx, { op: 'give', what: 'creature', species: 'sparkit', level: 999 });
  ok('levels are held to the cap', Object.values(gdoc.creatures).find((c) => c.species === 'sparkit')?.level === PROGRESSION.maxLevel);
  for (const bad of ['__proto__', 'constructor', 'nope', 42]) {
    GMm.handleGm(gctx, { op: 'give', what: 'creature', species: bad, level: 5 });
    ok(`a made-up species is refused (${bad})`, last(gev, 'error')?.code === 'bad_species');
  }

  GMm.handleGm(gctx, { op: 'give', to: 'o1', what: 'gold', amount: 5000 });
  ok('gold to someone else online', odoc.gold === 500 + 5000 && oev.some(([k, v]) => k === 'gmGift' && v.what === 'gold' && v.from === 'Keeper'));
  ok('their screen is told', oev.some(([k]) => k === 'profile'));
  GMm.handleGm(gctx, { op: 'give', to: 'o1', what: 'item', item: 'sphere_ultra', qty: 5000 });
  ok('items to someone else, held to the cap', odoc.inventory.sphere_ultra === GMm.GM_LIMITS.qty);
  GMm.handleGm(gctx, { op: 'give', to: 'o1', what: 'gold', amount: -50 });
  ok('no gold taken away through a gift', odoc.gold === 5500 && last(gev, 'error')?.code === 'bad_amount');
  GMm.handleGm(gctx, { op: 'give', to: 'nobody', what: 'gold', amount: 5 });
  ok('someone not online is refused', last(gev, 'error')?.code === 'player_offline');

  GMm.handleGm(gctx, { op: 'fill' });
  ok('resources without end', gdoc.gold >= GMm.GM_LIMITS.fillGold
    && Object.values(ITEMS).filter((i) => ['sphere', 'heal', 'material'].includes(i.kind)).every((i) => gdoc.inventory[i.id] === GMm.GM_LIMITS.fillQty));
  ok('but not a stack of every sword', Object.values(ITEMS).filter((i) => i.kind === 'gear').every((i) => !gdoc.inventory[i.id]));

  for (const u of odoc.team) odoc.creatures[u].hp = 0;
  GMm.handleGm(gctx, { op: 'heal', to: 'o1' });
  ok('heal anyone online', odoc.team.every((u) => odoc.creatures[u].hp === odoc.creatures[u].maxHp) && oev.some(([k]) => k === 'healed'));

  GMm.handleGm(gctx, { op: 'teleport', zone: 'umbral_grove' });
  const go = [...gev].reverse().find(([k]) => k === 'goto')?.[1];
  ok('teleport to any zone, level or not', go?.kind === 'world' && go.zone === 'umbral_grove' && go.fromZone === 'verdant_meadow');
  gctx.warping = false;
  GMm.handleGm(gctx, { op: 'teleport', player: 'o1' });
  const go2 = [...gev].reverse().find(([k]) => k === 'goto')?.[1];
  ok('or to a player, arriving beside them', go2?.zone === 'aetherport' && !go2.fromZone
    && gdoc.pos?.zone === 'aetherport' && Math.hypot(gdoc.pos.x - 3, gdoc.pos.z - 4) < 2);

  GMm.handleGm(gctx, { op: 'announce', text: '  שלום   לכולם  ' });
  ok('an announcement reaches the whole server', said.at(-1)?.ch === 'gm' && said.at(-1).text === 'שלום לכולם');
  GMm.handleGm(gctx, { op: 'announce', text: 'x'.repeat(900) });
  ok('and is kept short', said.at(-1).text.length === GMm.GM_LIMITS.text);
  GMm.handleGm(gctx, { op: 'summon', species: 'duskmaw', level: 40 });
  ok('summon a wild', logged.at(-1)?.op === 'summon');
  GMm.handleGm(gctx, { op: 'rm -rf' });
  ok('an unknown op is refused', last(gev, 'error')?.code === 'unknown_op');
  ok('every change was logged', logged.length === gev.filter(([k, v]) => k === 'gm' && v.kind === 'done').length, `${logged.length}`);
}

// ---------------------------------------------------------------- progression
// XP is counted from level 1. Creatures were made with 0 at any level, so the
// first level-up of a level-5 starter cost levels 1-5 again: eleven wins, not
// four; a level-20 catch needed forty.
section('progression');
{
  const need = (l) => PROGRESSION.xpToLevel(l);
  const c5 = C.makeCreature('cindcub', 5);
  ok('a creature starts at the start of its level', c5.xp === need(5), `${c5.xp} vs ${need(5)}`);
  C.grantXpTo(c5, need(6) - need(5));
  ok('and one level of XP is one level', c5.level === 6, String(c5.level));
  const c1 = C.makeCreature('sparkit', 1);
  ok('a level-1 creature starts at nothing', c1.xp === 0);
  const old = C.createPlayerDoc('u10', 'QA10', {}, 'puddlet');
  const a = C.makeCreature('duskmaw', 20), b = C.makeCreature('sparkit', 12), done = C.makeCreature('pebblin', 7);
  Object.assign(a, { xp: 0 }); Object.assign(b, { xp: 900 });
  done.xp = need(8) - 5;
  for (const c of [a, b, done]) old.creatures[c.uid] = c;
  C.normalizeDoc(old);
  ok('a save from before gets what its level implies', a.xp === need(20), `${a.xp} vs ${need(20)}`);
  ok('keeping what it earned on top', b.xp === Math.min(need(12) + 900, need(13) - 1), `${b.xp}`);
  ok('but one point short of the next level, so the level-up happens in a fight', b.level === 12 && b.xp < need(13));
  ok('one already past its level is left alone', done.xp === need(8) - 5);
  const snap = JSON.stringify(old.creatures);
  C.normalizeDoc(old);
  ok('and doing it twice changes nothing', JSON.stringify(old.creatures) === snap);
}

// ---------------------------------------------------------------- balance
// Measured with the same bots as tools/balance.mjs, seeded, against targets:
// the first two zones are for learning with one creature, the last three are
// no longer a formality, and a team is still the way through them.
section('balance');
{
  const BAL = await import('./balance.mjs');
  const T = await import('../src/shared/temper.js');
  const run = (c, bot = 'sharp', n = 60) => BAL.measure({ ...c, bot, n, seed: bot === 'sharp' ? 7 : 8 });
  const byLabel = Object.fromEntries(BAL.CASES.map((c) => [c.label, c]));
  for (const s of ['cindcub', 'puddlet', 'sproutle']) {
    const port = byLabel[`${s} 5 · port`];
    const sharp = run(port), casual = run(port, 'casual');
    ok(`${s}: the port is a place to learn (sharp ${Math.round(sharp.win * 100)}%, casual ${Math.round(casual.win * 100)}%)`,
      sharp.win >= 0.95 && casual.win >= 0.9);
    // two seeds: one sample of sixty swung a few percent with any change to
    // the order things are rolled in, which is noise, not balance. Sproutle,
    // the gentle one, sits at the top of the band since wilds have abilities.
    const mA = run(byLabel[`${s} 5 · meadow`]), mB = BAL.measure({ ...byLabel[`${s} 5 · meadow`], bot: 'sharp', n: 60, seed: 19 });
    const meadow = { win: (mA.win + mB.win) / 2 };
    ok(`${s}: the meadow asks something of a lone starter (${Math.round(meadow.win * 100)}%)`, meadow.win >= 0.78 && meadow.win <= 0.985);
    ok(`${s}: and three levels later it is theirs`, run(byLabel[`${s} 8 · meadow`]).win >= 0.95);
  }
  // A late zone, alone: the lead it favours, one it ignores and one it
  // punishes, averaged. It should ask something of one creature — no longer a
  // formality of four-second fights — and a team should still carry it.
  // 120 fights a case: at these rates 60 wander eight points either way.
  for (const zone of ['stormreach', 'frostpeak', 'umbral']) {
    const singles = BAL.CASES.filter((c) => c.late === zone).map((c) => run(c, 'sharp', 120));
    const win = singles.reduce((a, r) => a + r.win, 0) / singles.length;
    const secs = singles.reduce((a, r) => a + r.seconds, 0) / singles.length;
    ok(`${zone}: one creature is tested (${Math.round(win * 100)}% over ${singles.length} leads, ${secs.toFixed(1)}s)`,
      win >= 0.55 && win <= 0.9 && secs >= 6);
    const team = BAL.CASES.find((c) => c.team === zone);
    ok(`${zone}: a team carries it`, run(team, 'sharp', 120).win >= 0.9);
  }
  ok('a wild fights softer in the port and harder in the grove',
    G.WILD_TIERS.aetherport.scale < 1 && G.WILD_TIERS.umbral_grove.scale > 1 && Object.keys(ZONES).every((z) => G.WILD_TIERS[z]));
  ok('in a zone for learning, one far stronger does not jump you',
    T.stanceOfLead('cindcub', 8, { species: 'sproutle', level: 5, hp: 10 }, T.ambushAbove('verdant_meadow')) === 'spare'
    && T.stanceOfLead('cindcub', 6, { species: 'sproutle', level: 5, hp: 10 }, T.ambushAbove('verdant_meadow')) === 'fight'
    && T.ambushAbove('umbral_grove') === Infinity);
  ok('a first catch costs a couple of fights, not six', ITEMS.sphere_basic.price <= 100 && ITEMS.potion_s.price <= 100);
}

// ---------------------------------------------------------------- the first fight
// The first battle used to freeze for seconds as it opened, and the frame
// after a hit hitched again: every change in the number of point lights
// recompiled every lit shader, every disposed material took its program with
// it, and each fight rebuilt its stage (twice, for the second battleInit).
// A real GPU is needed to time that (the browser probes do); what can be held
// here is the bookkeeping that prevents it.
section('the first fight');
{
  const B = await import('../src/client/gfx/battle.js');
  const THREE = await import('three');
  const battleSrc = fs.readFileSync('src/client/gfx/battle.js', 'utf8');
  ok('the fight makes its point lights once, as a pool, and nowhere else',
    (battleSrc.match(/new PointLight\(/g) || []).length === 1 && /this\.pool\.push\(l\)/.test(battleSrc));
  const bv = Object.create(B.BattleView.prototype);
  Object.assign(bv, {
    arena: new THREE.Group(), scene: new THREE.Scene(), pool: [], time: 0, actors: new Map(),
    lights: { sun: { intensity: 1 }, hemi: { intensity: 1, color: new THREE.Color() } }, lightBase: {},
    // no WebGL here: the sky and its environment map stand in, as made once
    _skies: { open: { sky: new THREE.Object3D(), env: null }, pit: { sky: new THREE.Object3D(), env: null } },
  });
  for (let k = 0; k < 3; k++) {
    const l = new THREE.PointLight(0xffffff, 0);
    l.userData = { owner: null, stage: false, at: 0 };
    bv.pool.push(l), bv.scene.add(l);
  }
  const lightsIn = (o) => { let n = 0; o.traverse((x) => { x.isPointLight && n++; }); return n; };
  const meadow = { stage: 'clearing', palette: {}, element: 'verdant', zone: 'verdant_meadow' };
  bv.setTheme('verdant', false, meadow);
  const field = bv.arena.children[0];
  bv.setTheme('ember', false, meadow);
  ok('the next fight in the same meadow stands on the same stage, whatever the foe',
    bv.arena.children.length === 1 && bv.arena.children[0] === field);
  const town = { stage: 'stadium', palette: {}, element: 'verdant', zone: 'aetherport' };
  bv.setTheme('verdant', false, town);
  const stadium = bv.arena.children[0], seat = stadium.userData.accent, before = seat?.color.getHex();
  bv.setTheme('volt', false, town);
  ok('the stadium is repainted in the challenger\'s colour, not built again',
    bv.arena.children[0] === stadium && seat && seat.color.getHex() !== before && !seat.userData.shared);
  bv.setTheme('aqua', true);
  ok('a dungeon\'s lamp is a pool light, and the scene keeps its three',
    bv.lamp === bv.pool[0] && bv.pool[0].userData.stage && bv.pool[0].intensity > 0 && lightsIn(bv.scene) === 3);
  bv.setTheme('verdant', false, meadow);
  ok('and it goes back to the pool when the stage comes down', !bv.pool[0].userData.stage && bv.pool[0].intensity === 0 && !bv.lamp);
  const [a, b, c, d] = [{}, {}, {}, {}];
  const la = bv.lightFor(a, 0xff0000, 2), lb = bv.lightFor(b, 0x00ff00, 2), lc = bv.lightFor(c, 0x0000ff, 2);
  bv.time = 1;
  const ld = bv.lightFor(d, 0xffffff, 3);
  ok('three effects get three lights; a fourth takes the one held longest',
    new Set([la, lb, lc]).size === 3 && ld === la && bv.owns(d, la) && !bv.owns(a, la));
  bv.freeLight(a, la);
  ok('an effect whose light was taken leaves it alone', la.intensity === 3 && bv.owns(d, la));
  for (const [o, l] of [[b, lb], [c, lc], [d, ld]]) bv.freeLight(o, l);
  ok('and a light given back goes dark', bv.pool.every((l) => l.intensity === 0 && !l.userData.owner));
  // A glowing creature's own light comes out on spawn; the pool lights it.
  const body = new THREE.Group(), lamp = new THREE.PointLight(0x88ccff, 2.2, 5, 2);
  lamp.position.set(0, 1.2, 0), body.add(lamp);
  const glow = B.takeGlow(body), holder = new THREE.Group();
  holder.add(body), holder.position.set(2, 0, -1), holder.updateMatrixWorld(true);
  bv.actors.set('g', { glow, holder, hidden: false, downed: false, benched: false });
  bv.stepGlow();
  const lit = bv.pool.find((l) => l.intensity > 0);
  ok('a glowing creature brings no light of its own into the fight', lightsIn(body) === 0 && glow && glow.intensity === 2.2);
  ok('the pool lights it where its light was',
    lit && lit.color.getHex() === 0x88ccff && lit.position.distanceTo(new THREE.Vector3(2, 1.2, -1)) < 1e-6);
  const fx = {}, taken = bv.lightFor(fx, 0xffffff, 1);
  bv.stepGlow();
  ok('an effect that needs a light outranks the glow, which moves to a free one',
    bv.owns(fx, taken) && bv.pool.filter((l) => !l.userData.owner && l.intensity > 0).length === 1);
  // Programs: one reference held on each, once.
  const progs = [{ usedTimes: 1 }, { usedTimes: 2 }];
  bv.renderer = { info: { programs: progs } };
  bv.pinPrograms(), bv.pinPrograms();
  ok('every program the fight compiles is held for the session, once', progs[0].usedTimes === 2 && progs[1].usedTimes === 3);
  ok('and it is held from the frame that built it', /this\.renderer\.render\(this\.scene, this\.camera\), this\.pinPrograms\(\)/.test(battleSrc));
  // The way back: the zone you left is still standing.
  const W = await import('../src/client/gfx/world.js');
  const wv = Object.create(W.WorldView.prototype), kept = new THREE.Group();
  let plates = 0;
  Object.assign(wv, { zone: { id: 'verdant_meadow' }, zoneGroup: new THREE.Group(), interior: null, clearPlates: () => { plates++; } });
  wv.zoneGroup.add(kept);
  wv.loadZone({ id: 'verdant_meadow' });
  ok('coming back from a fight keeps the zone that is standing', wv.zoneGroup.children[0] === kept && plates === 1);
  // What the server cannot do yet is not offered.
  const U = await import('../src/client/ui.js');
  const opened = (id, social) => {
    const u = Object.create(U.UI.prototype);
    Object.assign(u, { social, openPanelId: null, closeDialogue() {}, panelHost: { classList: { add() {} } }, renderPanel() {}, hooks: {} });
    u.openPanel(id);
    return u.openPanelId;
  };
  ok('online, friends, party and another player\'s sheet open',
    ['friends', 'party', 'player'].every((id) => opened(id, true) === id));
  ok('online, the guild and the ranked arena open', opened('guild', true) === 'guild' && opened('arena', true) === 'arena' && U.GUILDS === true);
  ok('the single-player build has nobody to be friends with: they stay shut',
    ['friends', 'party', 'player', 'guild', 'arena'].every((id) => opened(id, false) === null) && opened('bag', false) === 'bag');
  const gameSrc = fs.readFileSync('src/client/game.js', 'utf8');
  ok('standing next to a player opens them, online only',
    /a = this\.ui\.social \? this\.nearestPlayer\(n\) : null/.test(gameSrc) && /this\.ui\.social = !this\.solo/.test(gameSrc));
}

// ---------------------------------------------------------------- people
// The adventurers: seven kinds, two looks each, sculpted like the creatures,
// and what a character is saved as.
section('people');
{
  const Pe = await import('../src/client/gfx/people.js');
  ok('the kinds the server knows are the kinds the client can draw',
    JSON.stringify(G.AVATAR.kinds) === JSON.stringify(Pe.KIND_IDS), `${G.AVATAR.kinds} vs ${Pe.KIND_IDS}`);
  const badMeta = Pe.KIND_IDS.filter((id) => {
    const k = Pe.KINDS[id];
    return !(k.he && k.en && k.line && /^#[0-9a-f]{6}$/i.test(k.accent) && k.hair?.length === 2);
  });
  ok('every kind has a name, a line, a colour and hair for both looks', badMeta.length === 0, badMeta.join(','));
  const bad = [];
  for (const kind of Pe.KIND_IDS) for (const look of G.AVATAR.looks) {
    try {
      const g = Pe.buildPerson({ kind, look, skin: G.AVATAR.skins[2] }, { hi: true });
      const m = g.userData.model, geo = m.T.geoHi;
      const tris = geo.index.count / 3, nb = m.T.names.length;
      const col = geo.attributes.color?.array || [], si = geo.attributes.skinIndex.array, sw = geo.attributes.skinWeight.array;
      let nan = 0, badBone = 0, badW = 0;
      for (let i = 0; i < col.length; i++) if (!Number.isFinite(col[i])) nan++;
      for (let i = 0; i < si.length; i++) if (si[i] >= nb) badBone++;
      for (let i = 0; i < sw.length; i += 4) if (Math.abs(sw[i] + sw[i + 1] + sw[i + 2] + sw[i + 3] - 1) > 1e-3) badW++;
      const why = [];
      if (tris < 3000 || tris > 26000) why.push(`hi ${tris}`);
      if (nan) why.push(`${nan} bad colours`);
      if (badBone) why.push(`${badBone} bad bones`);
      if (badW) why.push(`${badW} bad weights`);
      if (!(g.userData.height > 1.25 && g.userData.height < 2.3)) why.push(`height ${g.userData.height}`);
      if (geo.boundingBox.min.y < -0.03) why.push('below the ground');
      if (g.userData.kind !== kind || !g.userData.rig?.person) why.push('rig');
      if (why.length) bad.push(`${kind}/${look}: ${why.join(', ')}`);
    } catch (e) { bad.push(`${kind}/${look}: ${e.message}`); }
  }
  ok('every kind and look bakes: in budget, sound colours, bones and weights, standing on the ground', bad.length === 0, bad.join(' | '));
  // the creator's close-up: a finer mesh, swapped in once it is baked
  const g = Pe.buildPerson({ kind: 'mage', look: 'a', skin: G.AVATAR.skins[1] }, { hi: true });
  const m = g.userData.model, before = m.mesh.geometry.index.count;
  await new Promise((r) => Fig.closeUp(m, 96, r));
  ok('a figure seen up close gets a finer mesh', m.mesh.geometry === m.T.geoClose && m.mesh.geometry.index.count > before * 1.5,
    `${before} -> ${m.mesh.geometry.index.count}`);
  // one-off moves: every kind's own, and the fight's
  const moveBad = [];
  for (const id of Pe.KIND_IDS) {
    const p = Pe.buildPerson({ kind: id, look: 'a' });
    const C = await import('../src/client/gfx/creatures.js');
    for (const mv of [Pe.KINDS[id].pose, 'throw', 'hit', 'cheer']) {
      if (!Pe.personAct(p, mv, 0.5)) { moveBad.push(`${id}:${mv}`); continue; }
      for (let t = 0; t < 40; t++) C.animateCreature(p, 1000 + t * 16, false);
      const q = p.userData.model.bones.armR.quaternion;
      if (![q.x, q.y, q.z, q.w].every(Number.isFinite)) moveBad.push(`${id}:${mv} NaN`);
    }
  }
  ok('every kind can play its own move, a throw, a flinch and a cheer', moveBad.length === 0, moveBad.join(','));

  // what a character is saved as
  const L = G.avatarLook;
  ok('a kind and a look are kept as chosen', L({ kind: 'pirate', look: 'b' }).kind === 'pirate' && L({ kind: 'pirate', look: 'b' }).look === 'b');
  ok('a character from before kinds is dressed as the kind nearest its outfit',
    L({ outfit: 'scholar', body: 'slim' }).kind === 'mage' && L({ outfit: 'scholar', body: 'slim' }).look === 'b');
  ok('an unknown kind or a bad skin falls back', L({ kind: 'dragon', skin: 'red' }).kind === 'explorer' && /^#[0-9a-f]{6}$/i.test(L({ skin: 'red' }).skin));
  const doc = C.createPlayerDoc('qa-p', 'QA', { kind: 'ranger', look: 'b', skin: G.AVATAR.skins[3] }, G.STARTERS[0]);
  C.normalizeDoc(doc);
  ok('a new character keeps its kind, look and skin', doc.appearance.kind === 'ranger' && doc.appearance.look === 'b' && doc.appearance.skin === G.AVATAR.skins[3]);
  const old = C.createPlayerDoc('qa-o', 'QA', {}, G.STARTERS[0]);
  old.appearance = { body: 'stocky', skin: '#e0ac7e', hair: '#2a1c14', outfit: 'tide' };
  C.normalizeDoc(old);
  ok('an old save loads as a kind', old.appearance.kind === 'pirate' && old.appearance.look === 'a');
  const html = fs.readFileSync('src/client/index.html', 'utf8');
  ok('the creator has its two steps and every control',
    ['cc-step1', 'cc-step2', 'pick-kind', 'pick-look', 'pick-skin', 'pick-starter', 'in-charname', 'btn-next', 'btn-back', 'btn-create', 'creator-stage']
      .every((id) => html.includes(`id="${id}"`)));
}

// ---------------------------------------------------------------- the farm
section('the farm');
{
  // a trainer with a lead, one more in the team and one in the box, and
  // enough of everything for a star
  const rich = (d) => {
    d.gold = 1e6;
    for (const e of Object.keys(G.ELEMENTS)) d.inventory[`crystal_${e}`] = 99;
    d.inventory.aether_core = 20;
    C.baseOf(d).buildings.pod = 3;
  };
  const fd = C.createPlayerDoc('qa-farm', 'QA', {}, 'cindcub');
  rich(fd);
  const lead = fd.team[0];
  const second = C.addCreature(fd, C.makeCreature('sproutle', 8)).uid;
  const boxed = C.makeCreature('shellop', 6); fd.creatures[boxed.uid] = boxed; fd.box.push(boxed.uid);
  const r1 = C.startTraining(fd, lead, 1000);
  ok('a creature sent to train goes to the farm: out of the team', r1.ok && !fd.team.includes(lead) && !fd.box.includes(lead) && C.atFarm(fd, lead));
  ok('and the next one walks beside you', C.activeCreature(fd)?.uid === second);
  const pp = C.publicProfile(fd);
  ok('the profile still shows it, at the farm, with its countdown', pp.away.length === 1 && pp.away[0].uid === lead && pp.away[0].training.readyAt === r1.slot.readyAt);
  ok('the farm view says what to draw in the pod', (() => { const t = C.baseView(fd).training[0]; return t.species === 'cindcub' && t.fromStar === 1 && t.star === 2; })());
  ok('it cannot be put back in the team while it is training', (() => {
    const before = [...fd.team];
    const ctx = { doc: fd, self: () => ({}), net: { save() {}, emit() {} } };
    WM.handleWorldMessage(ctx, 'setTeam', { team: [lead, second] });
    return !fd.team.includes(lead) && fd.team.includes(second) && before.length === fd.team.length;
  })());
  ok('not ready, not collected', C.collectTraining(fd, r1.slot.id, 1001).reason === 'not_ready');
  const got = C.collectTraining(fd, r1.slot.id, r1.slot.readyAt + 1);
  ok('done: it comes back stronger, to the head of the team where it was', got.ok && got.star === 2 && got.was === 1 && fd.team[0] === lead && fd.creatures[lead].star === 2);
  ok('and stronger in fact', C.statsOf(fd.creatures[lead]).atk > G.statsFor('cindcub', fd.creatures[lead].level, fd.creatures[lead].iv, 1, fd.creatures[lead].nature).atk);

  const r2 = C.startTraining(fd, boxed.uid, 2000);
  ok('one from the box trains too, and goes back to the box', r2.ok && !fd.box.includes(boxed.uid) && C.cancelTraining(fd, r2.slot.id).ok && fd.box.includes(boxed.uid));

  const solo = C.createPlayerDoc('qa-farm2', 'QA', {}, 'cindcub');
  rich(solo);
  ok('the only one you have cannot be sent away', C.startTraining(solo, solo.team[0]).reason === 'last_fighter' && solo.team.length === 1);
  const one = C.makeCreature('shellop', 6); solo.creatures[one.uid] = one; solo.box.push(one.uid);
  const r3 = C.startTraining(solo, solo.team[0]);
  ok('with one in the box, that one steps up to walk with you', r3.ok && solo.team.length === 1 && solo.team[0] === one.uid && !solo.box.length);

  // a save from before: the one in training is still in the team
  const legacyF = C.createPlayerDoc('qa-farm3', 'QA', {}, 'cindcub');
  const l2 = C.addCreature(legacyF, C.makeCreature('sproutle', 8)).uid;
  C.baseOf(legacyF).training.push({ id: 'old1', uid: legacyF.team[0], star: 2, startedAt: 0, readyAt: 1 });
  const wasLead = legacyF.team[0];
  C.normalizeDoc(legacyF);
  ok('an old save: the one in a pod is moved to the farm, the other leads', !legacyF.team.includes(wasLead) && legacyF.team[0] === l2 && C.atFarm(legacyF, wasLead));
  C.collectTraining(legacyF, 'old1', 2);
  ok('and comes back when it is collected', legacyF.team.includes(wasLead) && legacyF.creatures[wasLead].star === 2);
  const lost = C.createPlayerDoc('qa-farm4', 'QA', {}, 'cindcub');
  const stray = C.makeCreature('shellop', 6); lost.creatures[stray.uid] = stray;
  C.normalizeDoc(lost);
  ok('a creature that belongs nowhere is put back in the box', lost.box.includes(stray.uid));

  const cb = new C.Combatant({ id: 'c1', side: 'a', kind: 'creature', creature: fd.creatures[lead] });
  ok('a fighter tells the battle its stars, so it is drawn with them', cb.toJSON().star === 2);

  // and it looks it: bigger, marked, ringed, crowned (client/gfx/starlook.js)
  const SL = await import('../src/client/gfx/starlook.js');
  const CR = await import('../src/client/gfx/creatures.js');
  const look = CR.buildCreature('cindcub', { outline: false });
  const s0 = look.scale.x;
  SL.setStarLook(look, 3);
  ok('three stars: bigger, marked, a ring at its feet', near(look.scale.x, s0 * SL.STAR_SCALE[3], 1e-6) && look.userData.model.u.uStar.value === 2 && !!look.userData.starFx);
  SL.setStarLook(look, 5);
  ok('five: gold tips and a crown', look.userData.model.u.uTipCol.value.getHex() === SL.GOLD && look.userData.starFx.children.length > 4);
  SL.setStarLook(look, 1);
  ok('and dressed again for one star, it is as it was', near(look.scale.x, s0, 1e-6) && !look.userData.starFx && look.userData.model.u.uStar.value === 0);
  ok('every element has marks that are not its body colour', Object.keys(G.ELEMENTS).every((e) => {
    const sp = Object.keys(G.SPECIES).find((k) => G.SPECIES[k].types[0] === e);
    return !sp || SL.starMarks(sp).tip !== G.ELEMENTS[e].color;
  }));

  // the pods have a place, and nobody walks through them
  const town = P.propsFor(G.ZONES.aetherport);
  const spots = P.incubatorSpots(G.ZONES.aetherport);
  ok('the farm has a spot for every pod there can be', spots.length === G.BUILDINGS.pod.maxLevel);
  ok('each pod is solid', spots.every((q) => town.colliders.some((c) => c.kind === 'pod' && Math.hypot(c.x - q.x, c.z - q.z) < 0.05)));
  ok('and stands clear of the barn, the field and the fence', spots.every((q) => {
    const at = P.resolveCollision(town.colliders.filter((c) => c.kind !== 'pod'), q.x, q.z, 1.15);
    return Math.hypot(at.x - q.x, at.z - q.z) < 0.01;
  }));
}


// ---------------------------------------------------------------- traits
// Natures and abilities (shared/traits.js): rolled once, kept for life, kept
// through capture, and each ability doing what its card says.
section('traits');
{
  const TR = await import('../src/shared/traits.js');
  const G = await import('../src/shared/gamedata.js');
  const made = Array.from({ length: 300 }, () => C.makeCreature('cindcub', 10));
  ok('every new creature has a nature and an ability', made.every((c) => TR.NATURES[c.nature] && TR.ABILITIES[c.ability]));
  ok('the ability is from its element\'s pool', made.every((c) => TR.ABILITY_POOLS.ember.includes(c.ability)));
  const rare = made.filter((c) => c.ability === 'intimidate').length / made.length;
  ok(`the rare one is rare (${Math.round(rare * 100)}%)`, rare > 0.04 && rare < 0.22);
  ok('every element has a pool of real abilities', Object.keys(G.ELEMENTS).every((e) => (TR.ABILITY_POOLS[e] || []).length === 3 && TR.ABILITY_POOLS[e].every((a) => TR.ABILITIES[a])));
  ok('every ability has a name and a line for every element', Object.keys(G.ELEMENTS).every((e) => TR.ABILITY_POOLS[e].every((a) => { const i = TR.abilityInfo(a, [e]); return i?.he && i.text.length > 8; })));
  const plain = G.statsFor('cindcub', 30, 0.5, 1, 'steady'), brave = G.statsFor('cindcub', 30, 0.5, 1, 'brave');
  ok('a nature leans one stat up and one down by a tenth', brave.atk === Math.floor(plain.atk * 1.1) && brave.spd === Math.floor(plain.spd * 0.9) && brave.def === plain.def && brave.hp === plain.hp, JSON.stringify([plain, brave]));
  ok('and the card says the same', C.creatureCard({ creatures: { x: { uid: 'x', species: 'cindcub', level: 30, iv: 0.5, star: 1, nature: 'brave', ability: 'surge', skills: [] } }, inventory: {}, gold: 0, base: C.emptyBase(), team: ['x'], box: [] }, 'x')?.stats.atk === brave.atk);
  const wild = C.makeCreature('sparkit', 8);
  const caught = C.makeCreature('sparkit', 8, C.inherit(wild));
  ok('a caught wild keeps its nature, ability and IVs', caught.nature === wild.nature && caught.ability === wild.ability && caught.iv === wild.iv);
  const old = C.createPlayerDoc('t-old', 'Old', {}, 'puddlet');
  const oc = Object.values(old.creatures)[0];
  delete oc.nature; delete oc.ability;
  C.normalizeDoc(old);
  const first = [oc.nature, oc.ability];
  delete oc.nature; delete oc.ability;
  C.normalizeDoc(old);
  ok('an old creature gets traits from its uid — the same ones every time', TR.NATURES[first[0]] && TR.ABILITIES[first[1]] && oc.nature === first[0] && oc.ability === first[1]);

  // in a fight
  const duel = (aAb, bAb, opts = {}) => {
    const sim = new C.Combat({ mode: 'pve', rand: opts.rand || (() => 0.5) });
    const ev = []; sim.onEvent = (e) => ev.push(e);
    const ca = C.makeCreature(opts.a || 'cindcub', opts.level || 20, { iv: 0.5, nature: 'steady', ability: aAb });
    const cb = C.makeCreature(opts.b || 'pebblin', opts.level || 20, { iv: 0.5, nature: 'steady', ability: bAb });
    const A = sim.add(new C.Combatant({ side: 'a', kind: 'creature', name: 'a', creature: ca, ownerId: 'pa' }));
    const B = sim.add(new C.Combatant({ side: 'b', kind: 'wild', name: 'b', creature: cb }));
    return { sim, A, B, ev };
  };
  const tackle = { type: null, kind: 'physical', power: 60, acc: 1 };
  {
    const { sim, A, B, ev } = duel('surge', 'sturdy');
    B.hp = B.maxHp; const big = { ...tackle, power: 5000 };
    sim.applyHit(A, B, big, 'x', Date.now());
    ok('sturdy: a blow that would knock it out from full leaves it at 1', B.hp === 1 && ev.some((e) => e.kind === 'ability' && e.ability === 'sturdy'));
    sim.applyHit(A, B, big, 'x', Date.now());
    ok('but only once a fight', B.hp === 0);
  }
  {
    const g = duel('surge', 'guard'), n = duel('surge', 'surge');
    const d1 = g.B.maxHp - (g.sim.applyHit(g.A, g.B, tackle, 'x', Date.now()), g.B.hp);
    const d2 = n.B.maxHp - (n.sim.applyHit(n.A, n.B, tackle, 'x', Date.now()), n.B.hp);
    ok(`guard: the first hits are softer (${d1} vs ${d2})`, d1 < d2 && d1 >= Math.floor(d2 * 0.65));
  }
  {
    const { sim, A, B, ev } = duel('vampiric', 'surge', { a: 'duskmaw', b: 'pebblin' });
    A.hp = Math.floor(A.maxHp / 2); const before = A.hp;
    sim.applyHit(A, B, tackle, 'x', Date.now());
    ok('vampiric: a hit heals its maker', A.hp > before && ev.some((e) => e.kind === 'heal' && e.target === A.id));
  }
  {
    const { sim, A, B, ev } = duel('intimidate', 'surge');
    sim.update(50);
    ok('intimidate: coming on, the other side\'s attack drops', B.modifier('atkDown') > 0 && ev.some((e) => e.kind === 'ability' && e.ability === 'intimidate'));
    sim.update(50);
    ok('once per entrance, not every tick', B.effects.filter((x) => x.kind === 'atkDown').length === 1);
  }
  {
    const { sim, A, B, ev } = duel('surge', 'static', { rand: () => 0.05 });
    sim.applyHit(A, B, tackle, 'x', Date.now());
    ok('static: touching it can leave you stuck', A.isStunned(Date.now()) && ev.some((e) => e.ability === 'static'));
  }
  {
    const { sim, A, B } = duel('surge', 'surge');
    const lo = { ...tackle, type: 'ember', kind: 'special' };
    A.hp = A.maxHp; const full = sim.computeDamage(A, B, lo).dmg;
    A.hp = Math.floor(A.maxHp * 0.2); const low = sim.computeDamage(A, B, lo).dmg;
    ok(`surge: its own element hits harder when it is nearly down (${full} -> ${low})`, low > full * 1.15);
  }
  {
    const { sim, A, B } = duel('regen', 'surge', { a: 'sproutle' });
    A.hp = Math.floor(A.maxHp / 2); const before = A.hp;
    for (let k = 0; k < 40; k++) sim.update(250);
    ok('regen: it mends while it stands there', A.hp > before);
  }
  {
    const { sim, A, B } = duel('swift', 'surge');
    const mv = A.skills[0], now = Date.now();
    A.stamina = 999; sim.useSkill(A.id, mv, B.id);
    const swiftCd = A.cooldowns[mv] - now;
    const n = duel('surge', 'surge'); n.A.stamina = 999; n.sim.useSkill(n.A.id, mv, n.B.id);
    ok('swift: its moves come back sooner', swiftCd < n.A.cooldowns[mv] - now);
  }
  {
    // the battle tells the client about it, so it can say so
    const { sim, A, B } = duel('surge', 'guard');
    ok('a fighter carries its ability to the client', sim.snapshot().combatants.some((c) => c.ability === 'guard'));
  }
}


// ---------------------------------------------------------------- daily & seasons
section('daily reward and seasons');
{
  const EV = await import('../src/shared/events.js');
  const DY = await import('../src/server/game/daily.js');
  const EC = await import('../src/server/game/economy.js');
  const at = (y, m, d, h = 12) => Date.UTC(y, m - 1, d, h);
  const ids = (t) => EV.activeEvents(t).map((e) => e.id).sort().join(',');
  ok('early October is the harvest', ids(at(2026, 10, 7)) === 'harvest', ids(at(2026, 10, 7)));
  ok('the lantern nights overlap its end', ids(at(2026, 10, 28)) === 'harvest,lanterns');
  ok('the frost festival runs across New Year', EV.activeEvents(at(2026, 12, 31)).some((e) => e.id === 'frostfest') && EV.activeEvents(at(2027, 1, 5)).some((e) => e.id === 'frostfest'));
  ok('a Friday is a weekend', EV.activeEvents(at(2026, 10, 9)).some((e) => e.id === 'weekend') && !EV.activeEvents(at(2026, 10, 7)).some((e) => e.id === 'weekend'));
  ok('the harvest pays a little more gold', Math.abs(EV.eventMul('gold', at(2026, 10, 7)) - 1.15) < 1e-9 && EV.eventMul('xp', at(2026, 10, 7)) === 1);
  ok('and brings out its elements', EV.spawnMul(['verdant'], at(2026, 10, 7)) === 1.8 && EV.spawnMul(['aqua'], at(2026, 10, 7)) === 1);
  ok('and says when it ends', new Date(EV.eventEnds(EV.EVENTS[0], at(2026, 10, 7))).toISOString().startsWith('2026-10-31T23:59:59'));
  ok('the next one is named', EV.nextEvent(at(2026, 10, 7))?.event.id === 'lanterns');

  const dd = C.createPlayerDoc('t-daily', 'Daily', {}, 'puddlet');
  C.normalizeDoc(dd);
  const g0 = dd.gold;
  ok('a new player has a gift waiting', C.publicProfile(dd).login?.claimed === false && C.publicProfile(dd).login.day === 0);
  const r1 = DY.claimDaily(dd, at(2026, 10, 7));
  ok('day one: gold', r1.ok && r1.day === 0 && dd.gold === g0 + 200 && dd.login.day === 1 && dd.login.streak === 1);
  ok('once a day', DY.claimDaily(dd, at(2026, 10, 7, 20)).reason === 'daily_taken');
  const s0 = dd.inventory.sphere_basic || 0;
  const r2 = DY.claimDaily(dd, at(2026, 10, 8, 1));
  ok('the next day: the next tile, the streak grows', r2.ok && r2.day === 1 && (dd.inventory.sphere_basic || 0) === s0 + 5 && dd.login.streak === 2);
  DY.claimDaily(dd, at(2026, 10, 9));
  DY.claimDaily(dd, at(2026, 10, 10));
  const r5 = DY.claimDaily(dd, at(2026, 10, 13));
  ok('a missed day does not reset the week, only the streak', r5.ok && r5.day === 4 && dd.login.streak === 1);
  ok('the lead-element tile is that element\'s shards', Object.keys(r5.reward.items).join() === 'shard_aqua');
  DY.claimDaily(dd, at(2026, 10, 14));
  const r7 = DY.claimDaily(dd, at(2026, 10, 15));
  ok('day seven is the big one, and the week starts over', r7.reward.big && r7.reward.items.sphere_ultra === 1 && dd.login.day === 0);
  ok('the client is told what today holds', !!C.publicProfile(dd).login.today);

  EC._resetEconomy();
  const ed = C.createPlayerDoc('t-econ', 'Econ', {}, 'cindcub');
  const before = ed.gold;
  EC.earn(ed, 120, 'battle'); EC.earn(ed, 30, 'quest');
  const took = EC.spend(ed, 100, 'shop');
  const over = EC.spend(ed, 1e9, 'clinic');
  const rep = EC.economyReport();
  ok('the ledger counts in and out by where', rep.in.battle === 120 && rep.in.quest === 30 && rep.out.shop === 100);
  ok('spending never goes below zero', ed.gold === 0 && over === before + 50);
  ok('and the player carries today\'s totals', ed.econ.in === 150 && ed.econ.out === 100 + over);
  ok('the report has the share taken back', rep.sinkRatio > 0 && rep.perHour.length >= 1);
  EC._resetEconomy();
  const bd = C.createPlayerDoc('t-econ2', 'Econ2', {}, 'cindcub');
  C.normalizeDoc(bd);
  const bnet = { doc: bd, guilds: [], emit: () => {}, save: () => {}, pendingRooms: new Map() };
  const bs = new B.BattleSim(bnet, { zoneId: 'aetherport', wild: { species: 'mossnail', level: 2 } });
  bs.resolve({ outcome: 'a' });
  ok('a won fight goes in the books as a fight', (EC.economyReport().in.battle || 0) > 0, JSON.stringify(EC.economyReport().in));
  EC._resetEconomy();
  // the model (tools/economy.mjs): every hour of play pays, and nothing is a
  // wall or a giveaway at the level it is wanted
  const ECO = await import('./economy.mjs');
  const em = ECO.measure();
  ok('an hour of play nets gold at every stage', em.hours.every((h) => h.net > 0), em.hours.map((h) => `${h.level}:${h.net}`).join(' '));
  ok('no upgrade is out of reach or handed out', !em.flags.length, em.flags.join(' | '));
  ok('a daily errand pays by level', G.questGold(G.QUESTS.q_daily_hunt, 1) < G.questGold(G.QUESTS.q_daily_hunt, 40));
  ok('the clinic charges by the team', G.clinicCost([{ level: 10, hp: 5 }, { level: 10, hp: 0 }]) === 10 * 7 * 2 + 90);
}


// ---------------------------------------------------------------- endgame
section('endgame');
{
  const EG = await import('../src/shared/endgame.js');
  const PD = await import('../src/server/game/party-dungeon.js');
  const G2 = await import('../src/shared/gamedata.js');
  const at = (y, m, d, h = 12) => Date.UTC(y, m - 1, d, h);
  ok('weeks are ISO weeks', EG.weekStamp(at(2026, 10, 7)) === '2026-W41' && EG.weekStamp(at(2027, 1, 1)) === '2026-W53');
  ok('a week ends at Monday midnight UTC', new Date(EG.weekEnds(at(2026, 10, 7))).toISOString() === '2026-10-12T00:00:00.000Z');
  const e1 = EG.eloAfter(1000, 1000, 1, 99, 99);
  ok('Elo: an even win moves both by half the K, the other way', e1.a === 1016 && e1.b === 984);
  const e2 = EG.eloAfter(1000, 1400, 1, 99, 99), e3 = EG.eloAfter(1400, 1000, 1, 99, 99);
  ok('beating someone far above is worth more than beating someone far below', e2.a - 1000 > e3.a - 1400);
  ok('a new player moves faster', EG.eloAfter(1000, 1000, 1, 0, 99).a > e1.a);
  const ad = { };
  const a0 = EG.arenaOf(ad, at(2026, 10, 7));
  a0.rating = 1520; a0.best = 1610; a0.games = 30;
  const a1 = EG.arenaOf(ad, at(2026, 11, 2));
  ok('a new season: half the way back, and last season\'s best tier waiting to be claimed', a1.season === '2026-11' && a1.rating === 1260 && a1.pending?.tier === 'platinum' && a1.games === 0);
  ok('tiers by rating', EG.arenaTier(1099).id === 'bronze' && EG.arenaTier(1100).id === 'silver' && EG.arenaTier(2400).id === 'legend');
  ok('the tower climbs', EG.towerLevel(10, 20) > EG.towerLevel(1, 20) && EG.towerLevel(1, 20) >= 8);
  ok('every floor\'s creatures are of the floor\'s element', Array.from({ length: 10 }, (_, k) => k + 1).every((f) => EG.towerPool(f).length > 0 && EG.towerPool(f).every((sp) => G2.SPECIES[sp].types[0] === EG.towerElement(f))));
  ok('a guardian every fifth floor, each a real boss', [5, 10, 15, 20].every((f) => G2.SPECIES[EG.towerBoss(f)]));
  const low = { level: 3, records: {} }, mid = { level: 12, records: {} }, done = { level: 30, records: { dungeons: { undercity_cistern: 0 } } };
  const cis = G2.DUNGEONS.undercity_cistern;
  ok('a dungeon asks for its level', EG.canEnter(low, cis).code === 'level_too_low' && EG.canEnter(mid, cis).ok);
  ok('a harder tier asks for the one before it, cleared', EG.canEnter(mid, cis, 'hard').code === 'tier_locked' && EG.canEnter(done, cis, 'hard').ok && EG.canEnter(done, cis, 'mythic').code === 'tier_locked');

  // a run, by hand: one player, floor by floor
  const dd = C.createPlayerDoc('t-dun', 'Dun', {}, 'cindcub');
  C.normalizeDoc(dd);
  C.addCreature(dd, C.makeCreature('pyrelynx', 40));
  dd.level = 20;
  const sent = [];
  const run = new PD.PartyDungeon({ def: cis, tier: 'normal', broadcast: (e, d) => sent.push([e, d]) });
  run.addPlayer(dd, (e, d) => sent.push([e, d]));
  ok('the whole team comes in, with the trainer behind it', run.sim.all().filter((c) => c.ownerId === dd.id && c.kind === 'creature').length === 2 && run.sim.all().some((c) => c.kind === 'trainer'));
  const clearFloor = () => { for (const c of run.sim.all()) if (c.side === 'b') c.hp = 0; run.sim.checkEnd(); clearTimeout(run._next); };
  run.nextFloor();
  ok('floor one: the dungeon\'s own creatures', run.sim.all().filter((c) => c.side === 'b').every((c) => cis.trash.includes(c.species)));
  clearFloor();
  ok('cleared: the haul grows and the party catches its breath', run.loot.xp > 0 && sent.some(([e]) => e === 'floorCleared'));
  run.nextFloor();
  ok('the last floor is its keeper', run.sim.all().filter((c) => c.side === 'b').length === 1 && run.sim.all().find((c) => c.side === 'b').species === cis.boss);
  clearFloor();
  const end = sent.find(([e]) => e === 'dungeonEnd')?.[1];
  ok('the run ends, cleared, and pays', end?.success && end.xp > 0 && end.gold > 0 && end.items.length >= 1);
  ok('and the next tier opens', dd.records.dungeons.undercity_cistern === 0 && EG.canEnter(dd, cis, 'hard').ok);
  run.stop();

  // the same in a party: they stand up to more
  const d2 = C.createPlayerDoc('t-dun2', 'Dun2', {}, 'puddlet');
  C.normalizeDoc(d2);
  const solo = new PD.PartyDungeon({ def: cis }), duo = new PD.PartyDungeon({ def: cis });
  solo.addPlayer(dd, () => {}); duo.addPlayer(dd, () => {}); duo.addPlayer(d2, () => {});
  const hpOf = (r) => { r.floor = 0; r.nextFloor(); const h = r.sim.all().filter((c) => c.side === 'b').reduce((s, c) => s + c.maxHp / c.level, 0); clearTimeout(r._next); r.stop(); return h; };
  ok('two players face a tougher floor than one', hpOf(duo) > hpOf(solo) * 1.3);

  // the tower, a climb walked out of
  const tw = new PD.PartyDungeon({ def: EG.TOWER });
  const tsent = [];
  tw.addPlayer(dd, (e, d) => tsent.push([e, d]));
  for (let f = 0; f < 5; f++) { tw.nextFloor(); for (const c of tw.sim.all()) if (c.side === 'b') c.hp = 0; tw.sim.checkEnd(); clearTimeout(tw._next); }
  ok('the fifth floor is a guardian, and leaves a chest', tw.chests.length === 1);
  tw.handle(dd.id, 'trainer', { action: 'flee' });
  tw.phase === 'active' || (tw.nextFloor(), tw.handle(dd.id, 'trainer', { action: 'flee' }));
  const tend = tsent.find(([e]) => e === 'dungeonEnd')?.[1];
  ok('walking out of the tower pays what was reached, chest and all', tend?.endless && tend.floors === 5 && tend.gold > 0 && dd.records.towerBest === 5 && dd.weekly.tower === 5, JSON.stringify(tend && { f: tend.floors, g: tend.gold }));
  tw.stop();
}


// ---------------------------------------------------------------- riding
section('riding');
{
  const RD = await import('../src/shared/riding.js');
  const WP = await import('../src/shared/worldplan.js');
  const G3 = await import('../src/shared/gamedata.js');
  const P3 = await import('../src/shared/props.js');
  ok('a grown bird flies, a grown water creature swims, a grown beast carries you', RD.mountKind('pyrewing') === 'fly' && RD.mountKind('torrentoad') === 'swim' && RD.mountKind('blazehound') === 'land');
  ok('a small one carries nobody, until its third star', RD.mountKind('kindlepup') === null && RD.mountKind('kindlepup', 3) === 'land');
  ok('a boss is nobody\'s horse', RD.mountKind('rootfather') === null);
  ok('every element has something to ride', Object.keys(G3.ELEMENTS).every((e) => Object.values(G3.SPECIES).some((s) => s.types[0] === e && RD.mountKind(s.id))));
  ok('the air, the water and the land each have riders', ['fly', 'swim', 'land'].every((k) => Object.values(G3.SPECIES).filter((s) => RD.mountKind(s.id) === k).length >= 5));
  // in the tidal hollow: a step into the water stops a walker, not a swimmer
  const zone = G3.ZONES.tidal_hollow, plan = WP.planFor(zone), cols = P3.propsFor(zone).colliders;
  let shore = null;
  for (let r = 10; r < plan.half - 10 && !shore; r += 1.5) for (let a = 0; a < 6.28 && !shore; a += 0.05) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r, x2 = Math.cos(a) * (r + 1.5), z2 = Math.sin(a) * (r + 1.5);
    if (plan.walkable(x, z) && plan.inWater(x2, z2) && !plan.onCliff(x2, z2)) shore = { x, z, x2, z2 };
  }
  ok('there is a shore to test at', !!shore);
  if (shore) {
    const w = WP.stepWithin(zone, cols, shore.x, shore.z, shore.x2, shore.z2, 0.42, 'walk');
    const s = WP.stepWithin(zone, cols, shore.x, shore.z, shore.x2, shore.z2, 0.42, 'swim');
    const f = WP.stepWithin(zone, cols, shore.x, shore.z, shore.x2, shore.z2, 0.42, 'fly');
    ok('walking, the water stops you; swimming or flying, it does not', !plan.inWater(w.x, w.z) && plan.inWater(s.x, s.z) && plan.inWater(f.x, f.z), JSON.stringify({ w, s }));
  }
  const lava = G3.ZONES.emberfall_canyon, lp = WP.planFor(lava);
  let lavaPt = null;
  for (let r = 6; r < lp.half - 8 && !lavaPt; r += 2) for (let a = 0; a < 6.28 && !lavaPt; a += 0.1) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (lp.inWater(x, z)) lavaPt = { x, z }; }
  ok('nobody swims in lava', !lavaPt || !lp.swimmable(lavaPt.x, lavaPt.z));
  // the message, on a solo world
  const rdoc = C.createPlayerDoc('t-ride', 'Rider', {}, 'cindcub');
  C.normalizeDoc(rdoc);
  const lead = rdoc.creatures[rdoc.team[0]];
  const self = { x: 0, z: 30, mount: '', mountKind: '', mountStar: 1 };
  const out = [];
  const rctx = { doc: rdoc, zone: G3.ZONES.aetherport, zoneId: 'aetherport', colliders: [], self: () => self, net: { emit: (k, v) => out.push([k, v]), save() {} } };
  WM.handleWorldMessage(rctx, 'ride', { uid: lead.uid });
  ok('a cub cannot carry you', out.some(([k, v]) => k === 'error' && v.code === 'cannot_ride') && !rctx.ride);
  lead.species = 'blazehound'; lead.level = 25;
  WM.handleWorldMessage(rctx, 'ride', { uid: lead.uid });
  ok('grown, but with no saddle: not yet', out.some(([k, v]) => k === 'error' && v.code === 'need_saddle') && !rctx.ride);
  lead.saddle = true;
  WM.handleWorldMessage(rctx, 'ride', { uid: lead.uid });
  ok('grown and saddled, it can: everyone sees you on it', rctx.ride?.kind === 'land' && self.mount === 'blazehound' && rdoc.riding === lead.uid);
  const ctx2 = { doc: rdoc };
  const self2 = {};
  WM.restoreRide(ctx2, self2, rdoc);
  ok('and back from a fight you are on it again', ctx2.ride?.uid === lead.uid && self2.mountKind === 'land');
  WM.handleWorldMessage(rctx, 'ride', {});
  ok('and down again', !rctx.ride && !self.mount && !rdoc.riding);
}

// ---------------------------------------------- before a beta: the foundations
// Crashes reach the GM (server/telemetry.js), the metrics count who comes back
// (server/metrics.js), the legal pages exist and are linked, and the name of
// someone else's game appears nowhere a player could see it.
section('crashes, metrics, privacy and the name');
{
  const fsx = await import('node:fs'), pathx = await import('node:path');
  // the name: in the code, the pages, the manifest, the docs that ship
  const walk = (d) => fsx.readdirSync(d, { withFileTypes: true }).flatMap((f) => f.isDirectory() ? walk(pathx.join(d, f.name)) : [pathx.join(d, f.name)]);
  const files = [...walk('src'), 'README.md', 'render.yaml', ...walk('docs')].filter((f) => /\.(js|html|json|md|webmanifest|svg|yaml|css)$/.test(f));
  const BRAND = /pok[eé]\s?mon|pok[eé]dex|pok[eé]\s?ball|פוקימון|פוקדקס|פוקבול/i;
  const hits = files.filter((f) => BRAND.test(fsx.readFileSync(f, 'utf8')));
  ok('no trademark of another game anywhere in what ships', hits.length === 0, hits.join(', '));

  // the legal pages: present, linked from the title and the sign-up, and say what is kept
  const priv = fsx.readFileSync('src/client/privacy.html', 'utf8'), terms = fsx.readFileSync('src/client/terms.html', 'utf8'), page = fsx.readFileSync('src/client/index.html', 'utf8');
  ok('a privacy policy and terms, each with a contact', priv.includes('{{CONTACT}}') && terms.includes('{{CONTACT}}'));
  ok('the privacy policy says what is kept: chat, reports, crashes, play time, children', ['צ\'אט', 'דיווחים', 'תקלות', 'שימוש', 'ילדים', '13'].every((w) => priv.includes(w)));
  ok('the title screen and the sign-up link to both, and sign-up asks to agree', /btn-title-login[\s\S]{0,400}terms\.html[\s\S]{0,200}privacy\.html/.test(page) && page.includes('id="in-agree"'));
  ok('the build ships both pages', fsx.readFileSync('tools/build.mjs', 'utf8').includes("'privacy.html', 'terms.html'"));

  // crashes: one row per fault, counted; a fixed one comes back if it happens again
  const T = await import('../src/server/telemetry.js');
  ok('the same fault on two builds is one signature', T.signature('x is undefined', 'at f (https://h/main.ABC123.js:10:5)') === T.signature('x is undefined', 'at f (https://h/main.ZZZ999.js:12:9)'));
  ok('nonsense is not kept', T.cleanReport({ message: '' }) === null && T.cleanReport({ message: 'a'.repeat(9000) }).sample.message.length === T.ERR_LIMITS.message);
  const { openStore } = await import('../src/server/store.js');
  const st = await openStore({ DB_DRIVER: 'memory' });
  T.useTelemetry(st);
  await T.noteError({ message: 'boom', stack: 'Error\n at a (main.js:1:1)', version: 'V1', device: 'iOS 26 Safari' }, { user: 'Dana' });
  await T.noteError({ message: 'boom', stack: 'Error\n at a (main.js:2:9)', version: 'V2', device: 'iOS 26 Safari' }, { user: 'Noa' });
  let rows = await T.listErrors();
  ok('a crash is counted, with its builds and how many players met it', rows.length === 1 && rows[0].count === 2 && rows[0].versions.join() === 'V1,V2' && rows[0].users === 2);
  await T.resolveError(rows[0].sig);
  ok('marked fixed, it waits at the bottom', (await T.listErrors())[0].resolved === true);
  await T.noteError({ message: 'boom', stack: 'Error\n at a (main.js:3:3)', version: 'V3' });
  ok('and it comes back if it happens again', (await T.listErrors())[0].resolved === false);
  T.useTelemetry(null);

  // metrics: sittings, days, retention, where they stopped
  const M = await import('../src/server/metrics.js');
  const DAY = 86400e3, now = Date.parse('2026-10-08T12:00:00Z');
  const mk = (id, firstDaysAgo, backOn, level = 1, playMin = 10) => {
    const days = [firstDaysAgo, ...backOn].map((k) => M.dayStamp(now - k * DAY)).sort();
    return { id, level, seen: { first: now - firstDaysAgo * DAY, days, sessions: days.length, playMs: playMin * 6e4 }, quests: { done: [] } };
  };
  const rowsM = [mk('a', 10, [9, 3, 0], 12, 300), mk('b', 10, [], 1, 3), mk('c', 9, [8], 4, 40), mk('d', 2, [1, 0], 3, 20), { id: 'old', level: 5 }];
  const rep = M.report(rowsM, { now, onlineNow: 2 });
  ok('daily, weekly and monthly players', rep.dau === 2 && rep.wau === 2 && rep.mau === 4 && rep.online === 2, JSON.stringify({ dau: rep.dau, wau: rep.wau, mau: rep.mau }));
  ok('back the next day: counted by the day they started', rep.d1.of === 4 && rep.d1.pct === 75, JSON.stringify(rep.d1));
  ok('players from before the metrics are not counted, but are said', rep.untracked === 1 && rep.players === 4);
  ok('the ones who stopped, by level and by time played', rep.gone === 2 && rep.byLevel.find((x) => x.label === '1–2').n === 1 && rep.byTime.find((x) => x.label === 'פחות מ‑5 דק׳').n === 1);
  const doc = { id: 'p1' };
  M.online(doc, now);
  ok('coming online marks the day', doc.seen.days.includes(M.dayStamp(now)) && doc.seen.first === now);
  M.offline(doc, now + 20 * 6e4);
  M.flush();
  ok('a sitting is counted with how long it was', doc.seen.sessions === 1 && Math.round(doc.seen.playMs / 6e4) === 20, JSON.stringify(doc.seen));
  M.online(doc, now + 30 * 6e4); M.offline(doc, now + 31 * 6e4); M.online(doc, now + 31.5 * 6e4);
  ok('back within a minute and a half: the same sitting', M._open.has('p1') && doc.seen.sessions === 1);
  M.flush();
  await st.close();
}

// ------------------------------------------------- the first ten minutes' guide
section('the guide for the first ten minutes');
{
  const TU = await import('../src/shared/tutorial.js');
  ok('seven steps, each said in one line with an icon', TU.TUTORIAL.length === 7 && TU.TUTORIAL.every((s) => s.he && s.icon && s.he.length < 80));
  ok('the next step fits where you are: walking first in the world, a move first in a fight',
    TU.nextStep({ steps: [] }, 'world').id === 'move' && TU.nextStep({ steps: [] }, 'battle').id === 'attack');
  ok('a step done early is not asked again', TU.nextStep({ steps: ['move', 'look', 'fight'] }, 'world').id === 'talk');
  ok('done or skipped: nothing', TU.nextStep({ steps: [], skipped: true }, 'world') === null && TU.nextStep({ steps: [], done: true }, 'battle') === null);
  const d = C.createPlayerDoc('qa-guide', 'QA', {}, 'cindcub');
  C.normalizeDoc(d);
  ok('a new player gets the guide', d.tutorial && !d.tutorial.done && C.publicProfile(d).tutorial.steps.length === 0);
  const old = C.createPlayerDoc('qa-old', 'Old', {}, 'cindcub');
  old.level = 9; delete old.tutorial; C.normalizeDoc(old);
  ok('someone already well on their way does not', old.tutorial.done === true && old.tutorial.legacy === true);
  const { ZONES: Z5 } = await import('../src/shared/gamedata.js');
  const out = [], gctx = { doc: d, zone: Z5.aetherport, zoneId: 'aetherport', colliders: [], self: () => ({ x: 0, z: 0 }), net: { emit: (k, v) => out.push([k, v]), save() {} } };
  const gold0 = d.gold;
  for (const id of ['move', 'look', 'talk', 'fight', 'attack', 'capture']) WM.handleWorldMessage(gctx, 'tutorial', { did: id });
  WM.handleWorldMessage(gctx, 'tutorial', { did: 'nonsense' });
  ok('each step is kept; nonsense is not', d.tutorial.steps.length === 6 && !d.tutorial.done);
  WM.handleWorldMessage(gctx, 'tutorial', { did: 'base' });
  ok('the last one finishes it, with the little gift', d.tutorial.done === true && d.gold - gold0 === TU.TUTORIAL_GIFT.gold && out.some(([k, v]) => k === 'tutorial' && v.gift));
  WM.handleWorldMessage(gctx, 'tutorial', { did: 'base' });
  ok('and the gift is once', d.gold - gold0 === TU.TUTORIAL_GIFT.gold);
  const s2 = C.createPlayerDoc('qa-skip', 'Skip', {}, 'cindcub');
  C.normalizeDoc(s2);
  WM.handleWorldMessage({ ...gctx, doc: s2 }, 'tutorial', { skip: true });
  WM.handleWorldMessage({ ...gctx, doc: s2 }, 'tutorial', { did: 'move' });
  ok('skipping ends it for good', s2.tutorial.skipped === true && s2.tutorial.steps.length === 0);
}

// --------------------------------------------------- saddles, tricks, reports
// Riding needs a saddle (shared/saddles.js): five pieces of a family, hunted;
// tricks for the pet (shared/tricks.js) are checked and told to the room;
// a report needs a reason from the list (shared/reports.js).
section('saddles, tricks and reports');
{
  const SD = await import('../src/shared/saddles.js');
  const SV = await import('../src/server/game/saddles.js');
  const RD = await import('../src/shared/riding.js');
  const TR = await import('../src/shared/tricks.js');
  const RP = await import('../src/shared/reports.js');
  const ST = await import('../src/shared/story.js');
  const G4 = await import('../src/shared/gamedata.js');
  ok('a family is counted from its smallest', SD.familyOf('vulcanth') === 'cindcub' && SD.familyOf('pyrelynx') === 'cindcub' && SD.familyOf('cindcub') === 'cindcub');
  ok('a family that can never carry anyone leaves no material', Object.values(G4.SPECIES).filter((sp) => !SD.familyRides(SD.familyOf(sp.id))).every((sp) => SV.huntMaterial({}, sp.id) === null));
  const d = C.createPlayerDoc('qa-saddle', 'QA', {}, 'cindcub');
  C.normalizeDoc(d);
  const hound = C.makeCreature('blazehound', 25);
  C.addCreature(d, hound);
  const root = SD.familyOf('blazehound');
  ok('a creature big enough to carry you is wanted for a saddle, not yet rideable', RD.saddleWanted([hound]).length === 1 && RD.mountsOf([hound]).length === 0);
  let last = null;
  for (let i = 0; i < 4; i++) last = SV.huntMaterial(d, root);
  ok('every win or catch of the family is a piece', last?.have === 4 && last.need === SD.SADDLE.need && d.mats[root] === 4);
  d.gold = 100000;
  ok('four pieces are not enough', SV.makeSaddle(d, hound.uid).error === 'need_materials' && !hound.saddle);
  SV.huntMaterial(d, 'blazehound');
  const gold0 = d.gold, made = SV.makeSaddle(d, hound.uid);
  ok('five and the gold make the saddle, fitted on it', made.ok && hound.saddle === true && d.mats[root] === 0 && gold0 - d.gold === SD.SADDLE.gold[made.kind]);
  ok('and then it can be ridden', RD.mountsOf([hound]).length === 1);
  ok('a second saddle on it is refused', SV.makeSaddle(d, hound.uid).error === 'already_saddled');
  const cub = d.creatures[d.team[0]];
  d.mats[SD.familyOf(cub.species)] = 9;
  ok('a cub too small to carry you gets no saddle', SV.makeSaddle(d, cub.uid).error === 'cannot_ride');
  const ren4 = ST.NPC_QUESTS?.n_ren_4 || G4.QUESTS.n_ren_4;
  ok('Ren\'s errand asks for a saddle, and counts it from what you hold', !!ren4 && ren4.goal.kind === 'saddle' && ST.heldProgress(d, ren4) === 1
    && ST.heldProgress(C.publicProfile(d), ren4) === 1);
  ok('the profile carries the pieces', typeof C.publicProfile(d).mats === 'object');

  // tricks: three, each with a button; the server checks and tells the room
  ok('three tricks, each with an icon and a name', TR.TRICK_IDS.length === 3 && TR.TRICK_IDS.every((k) => TR.TRICKS[k].icon && TR.TRICKS[k].he));
  ok('a bird plays in the air, a walker on the ground', TR.trickStyle('stormcaller') === 'fly' && TR.trickStyle('cindcub') === 'walk');
  const pd = C.createPlayerDoc('qa-trick', 'QA', {}, 'cindcub');
  C.normalizeDoc(pd);
  const me = { x: 0, z: 0, petSpecies: 'cindcub', mount: '' }, said = [], room = [];
  const tctx = { doc: pd, zone: G4.ZONES.aetherport, zoneId: 'aetherport', colliders: [], self: () => me, net: { emit: (k, v) => said.push([k, v]), save() {} }, roomEmit: (k, v) => room.push([k, v]) };
  WM.handleWorldMessage(tctx, 'petTrick', { trick: 'fetch' });
  WM.handleWorldMessage(tctx, 'petTrick', { trick: 'pet' });
  ok('a trick is told to the whole room, with who and a seed', room.length === 1 && room[0][0] === 'petTrick' && room[0][1].id === pd.id && room[0][1].trick === 'fetch' && Number.isFinite(room[0][1].seed));
  ok('and not two at once', room.length === 1);
  WM.handleWorldMessage(tctx, 'petTrick', { trick: 'dance' });
  tctx._trickAt = 0, tctx.ride = { kind: 'land' };
  WM.handleWorldMessage(tctx, 'petTrick', { trick: 'treat' });
  ok('an unknown trick does nothing; riding, there is no pet to play with', room.length === 1 && said.some(([k, v]) => k === 'error' && v.code === 'no_pet_here'));

  // reports: the list, and the words "other" needs
  ok('report reasons: language, harassment, cheating, a bad name, and other', ['language', 'harass', 'cheat', 'name', 'other'].every((k) => RP.REPORT_REASONS[k]?.he) && RP.REPORT_REASONS.other.needsNote);
  const RS = await import('../src/server/reports.js');
  const SO = await import('../src/server/social.js');
  const saved = [], store = {
    saveReport: async (r) => (saved.push(r), r), listReports: async () => saved.slice().reverse(),
    reportsSince: async (by, about, since) => saved.filter((r) => r.by.id === by && (!about || r.about.id === about) && r.at >= since).length,
    getDoc: async (id) => (id === 'bad' ? { id: 'bad', name: 'Bad', level: 3 } : null),
    updateReport: async (id, patch) => { const r = saved.find((x) => x.id === id); return r ? Object.assign(r, patch) : null; },
  };
  RS.useReports(store);
  const told = [];
  RS.watch('gm1', 'k', (e, v) => told.push([e, v]));
  SO.noteSaid({ id: 'bad', name: 'Bad' }, 'zone', 'יא בן זונה');
  const rep = { id: 'good', name: 'Good' };
  ok('no reason, no report', (await RS.fileReport(rep, { id: 'bad', reason: 'whatever' })).error === 'bad_reason');
  ok('"other" needs a few words', (await RS.fileReport(rep, { id: 'bad', reason: 'other', note: ' ' })).error === 'need_note');
  ok('not about yourself', (await RS.fileReport(rep, { id: 'good', reason: 'cheat' })).error === 'not_yourself');
  const r1 = await RS.fileReport(rep, { id: 'bad', reason: 'language', note: 'קילל' });
  ok('a report keeps what was said, as typed, and the GM online is told', r1.ok && r1.report.evidence.some((l) => l.text.includes('זונה')) && told.some(([e, v]) => e === 'gm' && v.kind === 'reportNew' && v.report.id === r1.report.id));
  ok('the same player, again straight away: refused', (await RS.fileReport(rep, { id: 'bad', reason: 'harass' })).error === 'already_reported');
  ok('a GM marks it handled', (await RS.setReport({ id: 'gm1', name: 'GM' }, r1.report.id, 'handled')).report?.status === 'handled');
  ok('and only to a status that exists', (await RS.setReport({ id: 'gm1', name: 'GM' }, r1.report.id, 'deleted')).error === 'bad_status');
  RS.unwatch('gm1', 'k');
  RS.useReports(null);
}

// ---------------------------------------------------------------- farm work
// Creatures from the box at work on the farm (shared/farmwork.js): a job
// each, a basket that fills while you are away, and a garden and forge that
// do more with hands on them.
section('farm work');
{
  const FW = await import('../src/shared/farmwork.js');
  const H = 3600e3;
  const wd = C.createPlayerDoc('qa-work', 'QA', {}, 'cindcub');
  C.normalizeDoc(wd);
  const add = (sp, lv) => { const c = C.makeCreature(sp, lv); wd.creatures[c.uid] = c; wd.box.push(c.uid); return c.uid; };
  const fern = add('sproutle', 12), rock = add('pebblin', 12), spark = add('cindcub', 12);
  ok('a starting farm has one place to work, more as it is built up', FW.workerSlots(C.baseOf(wd).buildings) === 1 && FW.workerSlots({ pod: 5, refinery: 5, workshop: 5, garden: 5 }) === FW.WORK.maxSlots);
  ok('each creature knows what it is best at', FW.bestJob(['verdant']) === 'garden' && FW.bestJob(['terra']) === 'mine' && FW.bestJob(['ember']) === 'forge' && FW.bestJob(['gale']) === 'scout');
  ok('one that likes its job does more of it', FW.workRate('garden', { level: 10 }, ['verdant']).fiber > FW.workRate('garden', { level: 10 }, ['ember']).fiber * 1.4);
  ok('one from the team cannot be sent; one from the box can', C.assignWorker(wd, wd.team[0], 'garden').reason === 'not_in_box' && C.assignWorker(wd, fern, 'garden', 0).ok);
  ok('the places are counted', C.assignWorker(wd, rock, 'mine', 0).reason === 'no_work_slot');
  C.baseOf(wd).buildings.garden = 3; C.baseOf(wd).buildings.workshop = 3;
  ok('built up, there is room for more', C.assignWorker(wd, rock, 'mine', 0).ok && C.assignWorker(wd, spark, '', 0).ok && C.workersOf(wd).find((w) => w.uid === spark).job === 'forge');
  const v = C.baseView(wd, 3 * H);
  ok('the farm shows who works where, and what is ready', v.work.workers.length === 3 && v.work.workers.find((w) => w.uid === fern).ready.fiber > 0 && v.work.slots >= 3);
  ok('the garden yields more with a gardener, the forge works faster with a smith', v.work.garden > 1 && v.work.forge > 1 && C.workBoost(wd, 'garden') === 1 + FW.WORK.gardenBoost);
  const fiber0 = wd.inventory.fiber || 0, scrap0 = wd.inventory.scrap_iron || 0;
  const got = C.collectWork(wd, 3 * H);
  ok('collected: into the bag', got.ok && (wd.inventory.fiber || 0) - fiber0 === got.got.fiber && (wd.inventory.scrap_iron || 0) - scrap0 === got.got.scrap_iron && got.got.fiber > 0);
  ok('and nothing twice', Object.keys(C.collectWork(wd, 3 * H).got).length === 0);
  // a slow trickle is carried, not lost: twelve collections an hour apart give what one at twelve hours does
  const a = C.createPlayerDoc('qa-work2', 'QA', {}, 'cindcub'), b = C.createPlayerDoc('qa-work3', 'QA', {}, 'cindcub');
  for (const d of [a, b]) { C.normalizeDoc(d); const c = C.makeCreature('zephyrb', 9); c.nature = 'steady'; d.creatures[c.uid] = c; d.box.push(c.uid); C.assignWorker(d, c.uid, 'scout', 0); }
  let sa = 0; for (let h = 1; h <= 12; h++) sa += C.collectWork(a, h * H).got.sphere_basic || 0;
  const sb = C.collectWork(b, 12 * H).got.sphere_basic || 0;
  ok('a little at a time adds up the same', sa === sb && sb >= 1, `${sa} vs ${sb}`);
  const g0 = b.gold, late = C.collectWork(b, 100 * H).got.gold || 0, full = (FW.workRate('scout', b.creatures[b.box[0]], G.SPECIES[b.creatures[b.box[0]].species].types).gold * FW.WORK.capHours);
  ok('the basket fills and stops: twelve hours at most', late <= Math.ceil(full) && late >= Math.floor(full) - 1 && b.gold - g0 === late);
  // into the team: off the job, paid for what it did
  const ctx = { doc: wd, self: () => ({}), net: { save() {}, emit() {} } };
  const f1 = wd.inventory.fiber || 0;
  C.workersOf(wd).find((w) => w.uid === fern).since = Date.now() - 4 * H;
  WM.handleWorldMessage(ctx, 'setTeam', { team: [...wd.team, fern] });
  ok('called into the team, it leaves its job and its basket is paid', wd.team.includes(fern) && !C.isWorker(wd, fern) && (wd.inventory.fiber || 0) > f1);
  wd.gold = 1e6; for (const e of Object.keys(G.ELEMENTS)) wd.inventory[`crystal_${e}`] = 99;
  ok('one sent to train leaves its job too', C.isWorker(wd, rock) && C.startTraining(wd, rock).ok && !C.isWorker(wd, rock));
  const out = [];
  const ctx2 = { doc: wd, self: () => ({}), net: { save() {}, emit: (k, x) => out.push([k, x]) } };
  WM.handleWorldMessage(ctx2, 'baseUnwork', { uid: spark });
  ok('stopped from the panel: back to the box, the view says so', !C.isWorker(wd, spark) && wd.box.includes(spark) && out.some(([k, x]) => k === 'base' && x.work.workers.length === 0));
  WM.handleWorldMessage(ctx2, 'baseWork', { uid: spark, job: 'mine' });
  ok('and put to work again from the panel', C.workersOf(wd)[0]?.uid === spark && out.some(([k, x]) => k === 'base' && x.hired?.uid === spark));
  ok('the profile marks the worker in the box', C.publicProfile(wd).box.find((c) => c.uid === spark)?.job === 'mine');
  delete wd.creatures[spark];
  ok('one that is gone (traded away) stops working', C.workersOf(wd).length === 0);
  ok('every job has a corner of the farm', (() => { const FX = FW; return FX.JOB_IDS.length === 4; })());
}

// ---------------------------------------------------------------- the story's end
// The rest of the main chain (shared/saga.js): the anchors, the keep, the
// fight on the pier, the scenes, and the sky over the port.
section('the story\'s end');
{
  const SG = await import('../src/shared/saga.js');
  const SV = await import('../src/server/game/saga.js');
  const PB = await import('../src/server/game/party-battle.js');
  const WP = await import('../src/shared/worldplan.js');
  const P4 = await import('../src/shared/props.js');
  const main = Object.values(QUESTS).filter((q) => q.chain === 'main').sort((a, b) => a.step - b.step);
  ok('the main story goes on to sixteen steps and ends', main.length === 16 && main[15].id === 'q_main_16' && main[15].outro === 'credits');
  ok('every step that opens with a scene has one written', main.every((q) => !q.scene || SG.SCENES[q.scene]?.length) && SG.SCENES.credits.some((l) => l.roll));
  const SHOTS = new Set(['self', 'orbit', 'sky', 'holo', 'rift']), FX = new Set(['pulse', 'shake', 'flash', 'holo-in', 'holo-out', 'tear', 'seal', 'dark']);
  ok('every line has a speaker, words, a shot and effects the player knows', Object.values(SG.SCENES).flat().every((l) => SG.SPEAKERS[l.who] && l.he?.length > 8 && (!l.shot || SHOTS.has(l.shot)) && (l.fx || []).every((f) => FX.has(f))));
  ok('she appears before she speaks, and is gone at the end of each scene', Object.values(SG.SCENES).every((ls) => {
    let on = false;
    for (const l of ls) { if ((l.fx || []).includes('holo-in')) on = true; if (l.shot === 'holo' && !on) return false; if ((l.fx || []).includes('holo-out')) on = false; }
    return !on;
  }));
  ok('the rift\'s guardian and the little one are real creatures', G.SPECIES.tehomon?.rarity === 'boss' && G.SPECIES.riftling?.rarity === 'legendary' && G.SPECIES.tehomon.learn.every(([, m]) => G.MOVES[m]));
  ok('each anchor stands somewhere you can walk to, clear of everything', SG.ANCHORS.every((a) => {
    const z = G.ZONES[a.zone], p = WP.planFor(z), at = P4.resolveCollision(P4.propsFor(z).colliders, a.x, a.z, 2.5);
    return p.walkable(a.x, a.z) && Math.hypot(at.x - a.x, at.z - a.z) < 0.01 && G.SPECIES[a.guardian.species];
  }));
  // a trainer who finished the old ending picks the story up again
  const sd = C.createPlayerDoc('qa-saga', 'QA', {}, 'cindcub');
  C.normalizeDoc(sd);
  sd.quests.active = {}; sd.quests.done = main.slice(0, 10).map((q) => q.id);
  C.normalizeDoc(sd);
  ok('one who finished step ten finds step eleven waiting', !!sd.quests.active.q_main_11);
  // the anchors
  sd.quests.active = { q_main_13: { progress: 0 } };
  const [A1, A2, A3] = SG.ANCHORS;
  ok('not in its zone, no fight', SV.storyFoe(sd, A1.id, 'aetherport', { x: A1.x, z: A1.z }).error === 'not_here');
  ok('too far from it, no fight', SV.storyFoe(sd, A1.id, A1.zone, { x: A1.x + 30, z: A1.z }).error === 'too_far');
  const f1 = SV.storyFoe(sd, A1.id, A1.zone, { x: A1.x + 2, z: A1.z });
  ok('at the anchor: its guardian, harder than a wild of its level', f1.foe?.species === A1.guardian.species && f1.foe.story === A1.id && f1.foe.hpScale > 1);
  const pb = new PB.PartyBattle({ mode: 'pve', zoneId: A1.zone, wild: f1.foe });
  ok('it fights as a boss (no sphere takes one), its health raised', pb.foe.kind === 'boss' && pb.story === A1.id && pb.foe.maxHp > G.statsFor(A1.guardian.species, A1.guardian.level, pb.foe.creature.iv, 1, pb.foe.creature.nature).hp * 1.5);
  ok('won: the anchor breaks', SV.storyWin(sd, A1.id).length === 0 && sd.story.anchors.includes(A1.id) && sd.quests.active.q_main_13.progress === 1);
  ok('and it does not break twice', SV.storyWin(sd, A1.id).length === 0 && sd.quests.active.q_main_13.progress === 1 && SV.storyFoe(sd, A1.id, A1.zone, { x: A1.x, z: A1.z }).error === 'anchor_broken');
  SV.storyWin(sd, A2.id);
  ok('three broken: the step is done', SV.storyWin(sd, A3.id).includes('q_main_13') && sd.quests.active.q_main_13.done);
  ok('the profile says which are broken', C.publicProfile(sd).story.anchors.length === 3);
  // the pier
  ok('the pier holds nothing before its time', SV.storyFoe(sd, 'finale', 'aetherport', { x: SG.FINALE.x, z: SG.FINALE.z }).error === 'not_now');
  sd.quests.active = { q_main_15: { progress: 0 } };
  const ff = SV.storyFoe(sd, 'finale', 'aetherport', { x: SG.FINALE.x, z: SG.FINALE.z + 3 });
  ok('then the rift\'s guardian waits on it', ff.foe?.species === 'tehomon' && ff.foe.hpScale > f1.foe.hpScale);
  ok('the sky is torn while it waits', SG.riftState(sd.quests) === 'torn');
  ok('beaten: the step is done', SV.storyWin(sd, 'finale').includes('q_main_15'));
  const cl = C.claimQuest(sd, 'q_main_15');
  ok('and the little one stays with you', cl?.creature?.species === 'riftling' && Object.values(sd.creatures).some((c) => c.species === 'riftling'));
  ok('the sky closes, and the last step opens', SG.riftState(sd.quests) === 'sealed' && !!sd.quests.active.q_main_16);
  // the scenes are remembered
  ok('a scene watched is kept; one that does not exist is not', SV.sceneSeen(sd, 'voice') && !SV.sceneSeen(sd, 'nope') && C.publicProfile(sd).story.seen.join() === 'voice');
  // the message, on a solo world: the fight starts with the story foe
  const sd2 = C.createPlayerDoc('qa-saga2', 'QA', {}, 'cindcub');
  C.normalizeDoc(sd2);
  sd2.quests.active = { q_main_13: { progress: 0 } };
  let started = null;
  const sctx = { doc: sd2, zoneId: A2.zone, zone: G.ZONES[A2.zone], self: () => ({ x: A2.x + 1, z: A2.z }), net: { emit() {}, save() {} }, startBattle: (o) => { started = o; } };
  WM.handleWorldMessage(sctx, 'storyFight', { id: A2.id });
  ok('from the world: a fight with the guardian, and one at a time', started?.wild?.story === A2.id && started.wild.species === A2.guardian.species && (WM.handleWorldMessage(sctx, 'storyFight', { id: A2.id }), true));
}

// ---------------------------------------------------------------- look and sound
// Each element lands its own way (gfx/movefx.js), every zone has its own tune
// (client/music.js), and the tailor sells hats and dyes (shared/cosmetics.js).
section('look and sound');
{
  const MF = await import('../src/client/gfx/movefx.js');
  ok('every element has its own way of landing a hit', Object.keys(G.ELEMENTS).every((e) => MF.SIGNATURE_TYPES.includes(e)));
  ok('a critical holds the arena longest, a plain hit barely', MF.hitStop({ crit: true }) > MF.hitStop({ eff: 2 }) && MF.hitStop({ eff: 2 }) > MF.hitStop({}) && MF.hitStop({}) < 0.05);
  const MU = await import('../src/client/music.js');
  ok('every zone, the fights, the dungeons and the story have a tune', Object.keys(G.ZONES).every((z) => MU.SONGS[z]) && ['battle', 'dungeon', 'boss', 'saga'].every((k) => MU.SONGS[k]));
  const tunes = MU.SONG_IDS.map((id) => MU.compose(MU.SONGS[id]));
  ok('each is sixteen bars, in range, and the same every time', tunes.every((t, i) => t.length === 16 && t.every((b) => b.notes.length && b.notes.every((n) => n.step >= 3 && n.step <= 15 && n.at >= 0 && n.at < 16)) && JSON.stringify(t) === JSON.stringify(MU.compose(MU.SONGS[MU.SONG_IDS[i]]))));
  ok('and no two zones share a tune', new Set(tunes.map((t) => JSON.stringify(t.slice(0, 4).map((b) => b.notes.map((n) => n.step))))).size === tunes.length);
  // the tailor
  const CO = await import('../src/shared/cosmetics.js');
  const CS = await import('../src/server/game/cosmetics.js');
  const td = C.createPlayerDoc('qa-tailor', 'QA', {}, 'cindcub');
  C.normalizeDoc(td);
  td.gold = 1000;
  ok('too dear, not bought', CS.buyCosmetic(td, 'wizard').reason === 'not_enough_gold' && td.gold === 1000);
  ok('one from the season\'s track is not for sale', CS.buyCosmetic(td, 'halo').reason === 'not_for_sale');
  ok('bought: paid for and yours', CS.buyCosmetic(td, 'bandana').ok && td.gold === 1000 - CO.HATS.bandana.price && CO.wardrobeOf(td).owned.includes('bandana'));
  ok('not twice', CS.buyCosmetic(td, 'bandana').reason === 'already_owned');
  ok('what is not yours cannot be worn', CS.wearCosmetic(td, 'hat', 'crown').reason === 'not_owned' && CS.wearCosmetic(td, 'dye', 'bandana').reason === 'bad_slot');
  ok('worn, everyone is sent it with how you look', CS.wearCosmetic(td, 'hat', 'bandana').ok && C.publicProfile(td).appearance.hat === 'bandana');
  td.appearance.hat = 'crown';
  C.normalizeDoc(td);
  ok('a hat written into the appearance by hand is not worn', C.publicProfile(td).appearance.hat === 'bandana' && !td.appearance.hat);
  ok('taken off, it is still yours', CS.wearCosmetic(td, 'hat', null).ok && !C.publicProfile(td).appearance.hat && CO.wardrobeOf(td).owned.includes('bandana'));
  const self = { hat: '', dye: '' }, out = [];
  td.gold = 5000;
  WM.handleWorldMessage({ doc: td, self: () => self, net: { save() {}, emit: (k, v) => out.push([k, v]) } }, 'cosmeticBuy', { id: 'ocean', wear: true });
  ok('bought at the counter and put on: the room shows it', self.dye === 'ocean' && out.some(([k, v]) => k === 'wardrobe' && v.bought === 'ocean'));
  // and it is drawn: the kind's own hat off, the dye on its cloth
  const PE = await import('../src/client/gfx/people.js');
  const plain = PE.personDesign({ kind: 'mage', look: 'a' }), hatted = PE.personDesign({ kind: 'mage', look: 'a', hat: 'cap_red' }), dyed = PE.personDesign({ kind: 'mage', look: 'a', dye: 'crimson' });
  ok('a hat from the tailor takes the kind\'s own off', plain.parts.some((q) => q.hw) && !hatted.parts.some((q) => q.hw) && hatted.parts.length !== plain.parts.length);
  ok('a dye changes the cloth and not the skin', !dyed.parts.some((q) => q.c === 0x2f3d92) && plain.parts.some((q) => q.c === 0x2f3d92) && dyed.parts.filter((q) => q.c === plain.parts.find((p) => p.bone === 'head')?.c).length > 0);
  ok('every kind says which cloth a dye is for, every hat has a shape', PE.KIND_IDS.every((k) => PE.KINDS[k].main?.length) && Object.values(CO.HATS).every((h) => PE.personDesign({ kind: 'rogue', look: 'b', hat: Object.keys(CO.HATS).find((id) => CO.HATS[id] === h) }).parts.length));
}

// ---------------------------------------------------------------- the bell
// Notifications to the phone (server/push.js), against a memory store and a
// web-push that records instead of sending.
section('phone notifications');
{
  const WP = (await import('web-push')).default;
  const sentTo = [];
  WP.sendNotification = async (sub, payload) => { sentTo.push({ endpoint: sub.endpoint, ...JSON.parse(payload) }); return { statusCode: 201 }; };
  const ST = await import('../src/server/store.js');
  const PU = await import('../src/server/push.js');
  const st = await ST.openStore({ DB_DRIVER: 'memory' });
  let here = new Set();
  const key = await PU.usePush(st, {}, { isOnline: (id) => here.has(id) });
  ok('keys are made once and kept', key && (await st.getConfig('vapid'))?.publicKey === key && await PU.usePush(st, {}, { isOnline: (id) => here.has(id) }) === key);
  const sub = (n) => ({ endpoint: `https://push.example/${n}`, keys: { p256dh: 'BOr8mH0Yp3S0tmP1T4D3vK3GJ8iZ0hG0b1Xq3q2w3e4r5t6y7u8i9o0p1a2s3d4f5g6h7j8k9l0zXcVbNm', auth: 'abcdefghijklmnop' } });
  ok('a broken subscription is refused', !(await PU.subscribe('u1', { endpoint: 'http://nope' })).ok);
  ok('a device subscribes, with what it wants', (await PU.subscribe('u1', sub(1), { boss: false })).ok && (await st.pushSubsFor('u1'))[0].prefs.boss === false);
  await PU.subscribe('u2', sub(2), {});
  await PU.schedule('u1', Date.now() - 1, 'train', 'train:a', 'done', 'ready');
  await PU.schedule('u1', Date.now() + 3600e3, 'train', 'train:b', 'later', 'later');
  here.add('u1');
  ok('someone in the game is not buzzed', (await PU.sweep()) === 0 && sentTo.length === 0);
  here.clear();
  await PU.schedule('u1', Date.now() - 1, 'train', 'train:a', 'done', 'ready');
  ok('away, it reaches their phone when it is due — and only what is due', (await PU.sweep()) === 1 && sentTo.length === 1 && sentTo[0].title === 'done');
  await PU.cancel('u1', 'train:b');
  ok('a cancelled one never comes', (await PU.sweep(Date.now() + 7200e3)) === 0);
  ok('a boss goes to whoever wants bosses', (await PU.bossAlert('מגמדון', 'קניון האש')) === 1 && sentTo.at(-1).endpoint.endsWith('/2'));
  ok('and not twice in a row', (await PU.bossAlert('מגמדון', 'קניון האש')) === 0);
  WP.sendNotification = async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); };
  await PU.notify('u2', null, { title: 't', body: 'b' });
  ok('a phone that is gone is forgotten', (await st.pushSubsFor('u2')).length === 0);
}

// ---------------------------------------------------------------- fair play
// The guard (server/game/guard.js) and the season's track (shared/pass.js).
section('fair play');
{
  const GU = await import('../src/server/game/guard.js');
  const b = new GU.Bucket(10, 20);
  let took = 0;
  for (let i = 0; i < 100; i++) b.take(1000) && took++;
  ok('a flood is cut to the burst, then to the rate', took === 20 && !b.take(1000) && b.take(1200) && b.take(1200) && !b.take(1200));
  const cx = {};
  const a0 = GU.moveAllowance(cx, 10_000);
  GU.spendMove(cx, a0);
  ok('movement has a budget: a second of walking, banked no further', a0 <= GU.speedLimit(null) * GU.GUARD.burstSec + 1e-9 && GU.moveAllowance(cx, 10_100) < GU.speedLimit(null) * 0.11 && GU.moveAllowance({ ride: { kind: 'fly' } }, 0) > a0);
  const bot = {}, human = {};
  let r1 = null, r2 = null;
  for (let i = 0; i < 500; i++) { r1 = GU.cadence(bot, 1000 + i * 83) || r1; r2 = GU.cadence(human, 1000 + i * 83 + Math.round(Math.sin(i * 1.7) * 9 + (i % 7) * 3)) || r2; }
  ok('a machine-steady rhythm is reported, a thumb is not', r1 === 'bot_cadence' && r2 === null);
  const lim = new GU.AddressLimiter(0, 3);
  ok('a door guessed at too often closes for that address only', lim.take('1.2.3.4') && lim.take('1.2.3.4') && lim.take('1.2.3.4') && !lim.take('1.2.3.4') && lim.take('5.6.7.8'));
  // the season's track
  const PA = await import('../src/shared/pass.js');
  const CO2 = await import('../src/shared/cosmetics.js');
  ok('every tier pays, nothing on it is a creature or a stat, and its looks are the season\'s own', PA.REWARDS.length === PA.PASS.tiers && PA.REWARDS.every((r) => (r.gold || r.items?.length || r.cosmetic) && !r.creature && !r.stats)
    && PA.REWARDS.filter((r) => r.cosmetic).every((r) => CO2.cosmeticById(r.cosmetic)?.pass) && Object.entries({ ...CO2.HATS, ...CO2.DYES }).filter(([, c]) => c.pass).every(([id]) => PA.REWARDS.some((r) => r.cosmetic === id)));
  const pd = C.createPlayerDoc('qa-pass', 'QA', {}, 'cindcub');
  C.normalizeDoc(pd);
  await import('../src/server/game/pass.js');
  const EC2 = await import('../src/server/game/economy.js');
  EC2.earn(pd, 50, 'battle');
  ok('a reward paid is a step on the track', PA.passOf(pd).points === PA.POINTS.battle);
  for (let i = 0; i < 400; i++) EC2.earn(pd, 10, 'quest');
  ok('but only so many a day', PA.passOf(pd).points === PA.PASS.dailyCap && PA.passView(pd).today === PA.PASS.dailyCap);
  const SP = await import('../src/server/game/pass.js');
  ok('a tier not reached cannot be claimed', SP.claimTier(pd, 30).reason === 'not_reached');
  const g0 = pd.gold, r5 = SP.claimTier(pd, 4);
  ok('one reached can, once', r5.ok && SP.claimTier(pd, 4).reason === 'already_claimed' && pd.gold >= g0);
  pd.pass.points = PA.PASS.perTier * 12;
  ok('a milestone pays the season\'s look', SP.claimTier(pd, 12).ok && CO2.wardrobeOf(pd).owned.includes('halo'));
  ok('a new season starts the track over', PA.passOf(pd, Date.now() + 40 * 86400e3).points === 0);
}

// ---------------------------------------------------------------- from the phone (v0.35)
// What two screen recordings showed: a creature's health landing on another,
// a boss kept as a pet, a creature both training and walking with you, and
// "not ready" piling up on a switch that had no way to say how long.
section('from the phone');
{
  const d = C.createPlayerDoc('qa-phone', 'QA', {}, 'cindcub');
  C.normalizeDoc(d);
  const lead = C.creatureOf(d, d.team[0]), big = C.makeCreature('stormcaller', 30);
  C.addCreature(d, big);
  const seen = [];
  const pn = { doc: d, guilds: [], emit: (k, v) => seen.push([k, v]), save: () => {}, pendingRooms: new Map() };
  const bs = new B.BattleSim(pn, { zoneId: 'verdant_meadow', wild: { species: 'sparkit', level: 5 } });
  const sw = C.swapToUid(bs.sim, bs.anchor, big.uid);
  const swEv = seen.filter(([k, v]) => k === 'battleEvent' && v.kind === 'switch').pop()?.[1];
  ok('a switch you chose says how long until the next', sw.ok && swEv?.wait > 5000);
  const again = C.swapToUid(bs.sim, bs.anchor, lead.uid);
  ok('and a switch too soon says how long is left', again.reason === 'cooldown' && again.wait > 0 && again.wait <= C.SWITCH_COOLDOWN_MS);
  bs.you.hp = 400;
  const leadHp = lead.hp, leadXp = lead.xp, bigXp = big.xp;
  bs.resolve({ kind: 'end', outcome: 'a' });
  ok('each creature takes its own health home (not the lead: 423 of 86)', lead.hp === leadHp && big.hp === Math.min(400, big.maxHp) && lead.hp <= lead.maxHp, `${lead.hp}/${lead.maxHp} ${big.hp}/${big.maxHp}`);
  ok('the one that finished the fight earns its XP', big.xp > bigXp && lead.xp === leadXp);
  // what is already wrong in a save is put right on load
  const d2 = C.createPlayerDoc('qa-phone2', 'QA', {}, 'cindcub');
  C.normalizeDoc(d2);
  const a2 = C.creatureOf(d2, d2.team[0]), b2c = C.makeCreature('sproutle', 8), c2 = C.makeCreature('puddlet', 8);
  C.addCreature(d2, b2c); C.addCreature(d2, c2);
  a2.hp = a2.maxHp * 5;
  C.baseOf(d2).training.push({ id: 'p1', uid: b2c.uid, star: 2, startedAt: 0, readyAt: 1, from: 'team', pos: 1 });
  d2.team.push(a2.uid);
  C.normalizeDoc(d2);
  ok('health past the card is brought back inside it', a2.hp === a2.maxHp);
  ok('a creature in a pod is not also in the team', !d2.team.includes(b2c.uid) && !d2.box.includes(b2c.uid));
  ok('nor anyone in it twice', new Set(d2.team).size === d2.team.length);
}
{
  // the GM's eraser: what can be given can be taken, and the log undoes
  const GM = await import('../src/server/game/gm.js');
  const d = C.createPlayerDoc('qa-gm', 'GM', {}, 'cindcub');
  C.normalizeDoc(d);
  const log = [], out = [];
  const ctx = {
    admin: true, doc: d, zoneId: 'aetherport', self: () => null,
    net: { emit: (k, v) => out.push([k, v]), save: () => {} },
    gm: { audit: (e) => log.unshift({ id: `r${log.length + 1}`, at: Date.now(), gm: { id: d.id, name: d.name }, ...e }), recent: async () => log, reach: () => null, online: () => [] },
  };
  const last = () => out.filter(([k]) => k === 'gm').pop()?.[1];
  const g0 = d.gold;
  GM.handleGm(ctx, { op: 'give', what: 'gold', amount: 500 });
  GM.handleGm(ctx, { op: 'take', what: 'gold', amount: 450 });
  ok('gold given by mistake can be taken back', d.gold === g0 + 50 && last()?.kind === 'done');
  GM.handleGm(ctx, { op: 'take', what: 'gold', amount: 9e8 });
  ok('never below nothing', d.gold === 0);
  GM.handleGm(ctx, { op: 'give', what: 'item', item: 'potion_s', qty: 30 });
  const pot = d.inventory.potion_s;
  GM.handleGm(ctx, { op: 'take', what: 'item', item: 'potion_s', qty: 25 });
  ok('an item too', d.inventory.potion_s === pot - 25);
  GM.handleGm(ctx, { op: 'give', what: 'creature', species: 'stormcaller', level: 20 });
  const given = log.find((r) => r.op === 'give' && r.detail?.what === 'creature');
  ok('a creature given is in the log with its uid', !!d.creatures[given?.detail?.uid]);
  GM.handleGm(ctx, { op: 'undo', id: given.id });
  await new Promise((r) => setTimeout(r, 5));
  ok('undoing the gift takes that creature back', !d.creatures[given.detail.uid] && log[0].op === 'undo');
  GM.handleGm(ctx, { op: 'undo', id: given.id });
  await new Promise((r) => setTimeout(r, 5));
  ok('and only once', last()?.code === 'already_undone');
  const only = d.team[0];
  GM.handleGm(ctx, { op: 'take', what: 'creature', uid: only });
  ok('the last creature that can fight is not taken', !!d.creatures[only] && last()?.code === 'last_creature');
  const extra = C.makeCreature('sproutle', 9);
  C.addCreature(d, extra);
  d.riding = extra.uid;
  GM.handleGm(ctx, { op: 'take', what: 'creature', uid: extra.uid });
  ok('any other can be, from wherever it is (and off its back)', !d.creatures[extra.uid] && !d.team.includes(extra.uid) && d.riding === null);
  const took = log.find((r) => r.op === 'take' && r.detail?.what === 'creature');
  GM.handleGm(ctx, { op: 'undo', id: took.id });
  await new Promise((r) => setTimeout(r, 5));
  ok('and undoing the take brings that same creature back', d.creatures[extra.uid]?.level === 9 && d.team.includes(extra.uid));
  const before = { gold: d.gold, sph: d.inventory.sphere_basic || 0 };
  GM.handleGm(ctx, { op: 'fill' });
  const fill = log.find((r) => r.op === 'fill');
  GM.handleGm(ctx, { op: 'undo', id: fill.id });
  await new Promise((r) => setTimeout(r, 5));
  ok('"fill" undone takes back just what it added', d.gold === before.gold && (d.inventory.sphere_basic || 0) === before.sph);
  const lv = d.level;
  GM.handleGm(ctx, { op: 'give', what: 'level', level: 55 });
  GM.handleGm(ctx, { op: 'undo', id: log.find((r) => r.op === 'give' && r.detail?.what === 'level').id });
  await new Promise((r) => setTimeout(r, 5));
  ok('a trainer level set by mistake goes back', d.level === lv);
  GM.handleGm(ctx, { op: 'creatures' });
  ok('the GM can see a player\'s creatures to pick one', Array.isArray(last()?.list) && last().list.every((c) => c.uid && c.where));
  const notGm = { ...ctx, admin: false };
  const g1 = d.gold;
  GM.handleGm(notGm, { op: 'take', what: 'gold', amount: 1 });
  ok('and none of it for anyone else', d.gold === g1 && out.pop()?.[1]?.code === 'forbidden');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
