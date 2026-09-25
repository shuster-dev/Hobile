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
