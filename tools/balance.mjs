// Battle balance, measured rather than guessed.
//
//   node tools/balance.mjs            # the report: every zone, three players
//   node tools/balance.mjs --fights=200
//
// A bot fights the wilds each zone actually spawns, at the levels it spawns
// them, through the real BattleSim — team, trainer, cooldowns, stamina, the
// wild's AI — on a fake clock, so a thousand fights take seconds. Two bots
// bracket a real player: "sharp" always picks the best move and reacts in
// 0.7s; "casual" picks any ready move and reacts in 1.2s. Nothing uses a
// potion or switches, so these numbers are the hard edge of the curve.
//
// The same measurement runs in tools/qa.mjs against fixed targets, so a
// balance change that makes the first zone a coin flip again fails CI.
globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const R = new URL('../src/', import.meta.url).href;
const G = await import(R + 'shared/gamedata.js');
const C = await import(R + 'server/game/combat.js');
const B = await import(R + 'server/game/base.js');
const { MOVES, ZONES, typeMultiplier } = G;

/** A seeded generator, so a report is the same report twice. */
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** Run `fn` with Date.now and Math.random under our control. */
export function controlled(seed, fn) {
  const realNow = Date.now, realRandom = Math.random;
  const clock = { now: Date.parse('2026-09-25T10:00:00Z') };
  Date.now = () => clock.now;
  Math.random = mulberry32(seed);
  try { return fn(clock); } finally { Date.now = realNow; Math.random = realRandom; }
}

export function trainerWith(lead, level, bench = []) {
  const doc = C.createPlayerDoc('bal', 'Bal', {}, lead);
  C.normalizeDoc(doc);
  const first = doc.creatures[doc.team[0]];
  Object.assign(first, C.makeCreature(lead, level, { iv: 0.65 }), { uid: first.uid });
  for (const [sp, lv] of bench) C.addCreature(doc, C.makeCreature(sp, lv, { iv: 0.65 }));
  doc.level = Math.max(1, Math.round(level * 0.8));
  return doc;
}

const BOTS = {
  sharp: { react: 700, pick: 'best' },
  casual: { react: 1200, pick: 'any' },
};

function choose(me, foe, bot, now) {
  const ready = (me.skills || []).map((id) => MOVES[id])
    .filter((m) => m && (me.cooldowns[m.id] || 0) <= now && me.stamina >= m.cost);
  if (!ready.length) return null;
  if (bot.pick === 'any') return ready[Math.floor(Math.random() * ready.length)];
  let best = null, score = -1;
  for (const m of ready) {
    const s = m.kind === 'status' ? 10
      : (m.power || 30) * (m.type ? typeMultiplier(m.type, foe.types) : 1)
        * (m.type && me.types.includes(m.type) ? 1.5 : 1) * (m.acc || 1);
    if (s > score) { score = s; best = m; }
  }
  return best;
}

/** One fight. Returns { won, ms, lost: true when the whole side went down }. */
export function fight(doc, zoneId, wild, bot, clock, maxMs = 240_000) {
  const net = { doc, guilds: [], emit: () => {}, save: () => {}, pendingRooms: new Map() };
  const b = new B.BattleSim(net, { zoneId, wild });
  b.state.phase = 'active';
  const t0 = clock.now;
  let next = clock.now + 600;
  while (!b.sim.finished && clock.now - t0 < maxMs) {
    clock.now += 100;
    b.sim.update(100);
    if (b.sim.finished || clock.now < next) continue;
    const m = choose(b.you, b.foe, bot, clock.now);
    if (m) { b.handle('skill', { skill: m.id }); next = clock.now + bot.react; } else next = clock.now + 200;
  }
  const outcome = b.sim.result?.outcome || 'timeout';
  return { won: outcome === 'a', lost: outcome === 'b', ms: clock.now - t0 };
}

/** The wilds a zone spawns, at the levels given, weighted as it weights them. */
export function zoneWilds(zoneId, levels) {
  const out = [];
  for (const [species, w] of ZONES[zoneId].spawns) {
    for (const level of levels) for (let k = 0; k < Math.max(1, Math.round(w / 6)); k++) out.push({ species, level });
  }
  return out;
}

/** Win rate and length of `n` fights of one player against one zone. */
export function measure({ lead, level, bench = [], zone, levels, bot = 'sharp', n = 60, seed = 1 }) {
  return controlled(seed, (clock) => {
    const wilds = zoneWilds(zone, levels);
    let won = 0, ms = 0;
    const byWild = new Map();
    for (let i = 0; i < n; i++) {
      const w = wilds[i % wilds.length];
      const r = fight(trainerWith(lead, level, bench), zone, w, BOTS[bot], clock);
      won += r.won ? 1 : 0; ms += r.ms;
      const k = `${w.species}${w.level}`, row = byWild.get(k) || { won: 0, n: 0 };
      row.n++; row.won += r.won ? 1 : 0; byWild.set(k, row);
    }
    const worst = [...byWild].map(([k, v]) => [k, v.won / v.n]).sort((a, b) => a[1] - b[1]);
    return { win: won / n, seconds: ms / n / 1000, worst: worst[0] ? { wild: worst[0][0], win: worst[0][1] } : null };
  });
}

// The cases the report prints and qa holds to targets. A new player's single
// starter in the first two zones; a lead at a zone's own level in the middle;
// a lead and two more in the late zones.
export const CASES = [
  ...['cindcub', 'puddlet', 'sproutle'].flatMap((s) => [
    { label: `${s} 5 · port`, lead: s, level: 5, zone: 'aetherport', levels: [2, 3, 4, 5] },
    { label: `${s} 5 · meadow`, lead: s, level: 5, zone: 'verdant_meadow', levels: [3, 5, 6, 8] },
    { label: `${s} 8 · meadow`, lead: s, level: 8, zone: 'verdant_meadow', levels: [3, 5, 6, 8] },
  ]),
  { label: 'cindcub 12 · emberfall', lead: 'cindcub', level: 12, zone: 'emberfall_canyon', levels: [8, 12, 16] },
  { label: 'puddlet 12 · emberfall', lead: 'puddlet', level: 12, zone: 'emberfall_canyon', levels: [8, 12, 16] },
  { label: 'pebblin 15 · stonewake', lead: 'pebblin', level: 15, zone: 'stonewake_mesa', levels: [10, 15, 20] },
  { label: 'tidefin 19 · tidal', lead: 'tidefin', level: 19, zone: 'tidal_hollow', levels: [14, 19, 24] },
  // The late zones, each with a lead it favours, one it does not care about,
  // and one it punishes — the average is what a zone asks of a single
  // creature — and a lead with two more behind it.
  { label: 'boulderon 23 · stormreach', lead: 'boulderon', level: 23, zone: 'stormreach_heights', levels: [18, 23, 28], late: 'stormreach' },
  { label: 'pyrelynx 23 · stormreach', lead: 'pyrelynx', level: 23, zone: 'stormreach_heights', levels: [18, 23, 28], late: 'stormreach' },
  { label: 'tidefin 23 · stormreach', lead: 'tidefin', level: 23, zone: 'stormreach_heights', levels: [18, 23, 28], late: 'stormreach' },
  { label: 'pyrelynx 23 +2 · stormreach', lead: 'pyrelynx', level: 23, bench: [['boulderon', 22], ['tidefin', 22]], zone: 'stormreach_heights', levels: [18, 23, 28], team: 'stormreach' },
  { label: 'pyrelynx 27 · frostpeak', lead: 'pyrelynx', level: 27, zone: 'frostpeak_ridge', levels: [22, 27, 32], late: 'frostpeak' },
  { label: 'tidefin 27 · frostpeak', lead: 'tidefin', level: 27, zone: 'frostpeak_ridge', levels: [22, 27, 32], late: 'frostpeak' },
  { label: 'thornkin 27 · frostpeak', lead: 'thornkin', level: 27, zone: 'frostpeak_ridge', levels: [22, 27, 32], late: 'frostpeak' },
  { label: 'tidefin 27 +2 · frostpeak', lead: 'tidefin', level: 27, bench: [['pyrelynx', 26], ['boulderon', 26]], zone: 'frostpeak_ridge', levels: [22, 27, 32], team: 'frostpeak' },
  { label: 'vulcanth 37 · umbral', lead: 'vulcanth', level: 37, zone: 'umbral_grove', levels: [30, 37, 45], late: 'umbral' },
  { label: 'maelstride 37 · umbral', lead: 'maelstride', level: 37, zone: 'umbral_grove', levels: [30, 37, 45], late: 'umbral' },
  { label: 'verdammoth 37 · umbral', lead: 'verdammoth', level: 37, zone: 'umbral_grove', levels: [30, 37, 45], late: 'umbral' },
  { label: 'vulcanth 37 +2 · umbral', lead: 'vulcanth', level: 37, bench: [['maelstride', 36], ['verdammoth', 36]], zone: 'umbral_grove', levels: [30, 37, 45], team: 'umbral' },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Number(process.argv.find((a) => a.startsWith('--fights='))?.split('=')[1] || 90);
  const pct = (x) => `${String(Math.round(x * 100)).padStart(3)}%`;
  console.log(`${'case'.padEnd(30)}  sharp: win   len   worst          casual: win   len`);
  for (const c of CASES) {
    const s = measure({ ...c, bot: 'sharp', n }), k = measure({ ...c, bot: 'casual', n, seed: 2 });
    const worst = s.worst ? `${s.worst.wild}:${Math.round(s.worst.win * 100)}%` : '';
    console.log(`${c.label.padEnd(30)}  ${pct(s.win)}  ${s.seconds.toFixed(1).padStart(5)}s  ${worst.padEnd(14)}  ${pct(k.win)}  ${k.seconds.toFixed(1).padStart(5)}s`);
  }
}
