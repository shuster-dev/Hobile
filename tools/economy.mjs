// The economy, measured: what an hour of play pays at each stage of the game,
// what the things you want cost, and how long each one takes to afford.
//
//   node tools/economy.mjs            the table
//   node tools/economy.mjs --json     the same as data (qa reads `measure`)
//
// It plays nobody: it reads the real tables — the gold a won fight pays
// (creatureScore), the XP (creaturePower), the zones' levels and spawns, the
// quests, the daily gifts, the shop's prices, the buildings, the star costs —
// and puts a typical hour against them. The live half is game/economy.js,
// which counts what real players actually earn and spend.
import * as G from '../src/shared/gamedata.js';
import { DAILY_REWARDS } from '../src/shared/events.js';

/** A typical hour of play, and what it uses up. */
export const HOUR = {
  fights: 26,              // about two minutes a fight, walking included
  captureShare: 0.3,       // fights that end in a sphere rather than a knockout
  spheresPerCapture: 2.2,  // throws, on average, at the right moment
  potionEvery: 6,          // fights between potions
  clinicEvery: 10,         // fights between full heals at the clinic
  dailyQuests: 3,          // the day's three, done in the first hour
};

/** One played hour a day: what the day's one-off rewards add to that hour. */
const DAY_HOURS = 1;

/** Average gold the daily gift pays per day (items at shop value). */
function dailyGiftValue() {
  let sum = 0;
  for (const d of DAILY_REWARDS) {
    sum += d.gold || 0;
    for (const [id, q] of Object.entries(d.items || {})) sum += (G.ITEMS[id]?.price || 0) * q * 0.5;
  }
  return sum / DAILY_REWARDS.length;
}

/** The zone a trainer of this level is meant to be in. */
function zoneFor(level) {
  const wild = Object.values(G.ZONES).filter((z) => !z.urban && z.levels);
  return wild.find((z) => level >= z.levels[0] && level <= z.levels[1]) || wild.sort((a, b) => Math.abs(a.levels[0] - level) - Math.abs(b.levels[0] - level))[0];
}

function avgBase(zone) {
  const rows = (zone.spawns || []).filter((r) => G.SPECIES[r[0]]);
  let w = 0, s = 0;
  for (const r of rows) {
    const b = G.SPECIES[r[0]].base;
    s += (b.hp + b.atk + b.def + b.spa + b.spd + b.spe) * r[1]; w += r[1];
  }
  return w ? s / w : 300;
}

/** An hour at this trainer level: in, out, and XP. */
export function hourAt(level) {
  const z = zoneFor(level);
  const wl = Math.max(z.levels[0], Math.min(z.levels[1], level));
  const goldPerFight = 14 + wl * 7;                              // creatureScore, on average
  const xpPerFight = Math.floor(avgBase(z) * wl / 34 * Math.max(0.35, Math.min(2.2, wl / Math.max(1, level)))) * 0.6;
  const fights = HOUR.fights;
  const daily = Object.values(G.QUESTS).filter((q) => q.chain === 'daily');
  const dailyGold = daily.reduce((a, q) => a + G.questGold(q, level), 0) / Math.max(1, daily.length) * HOUR.dailyQuests / DAY_HOURS;
  const income = {
    fights: Math.round(goldPerFight * fights),
    dailyQuests: Math.round(dailyGold),
    dailyGift: Math.round(dailyGiftValue() / DAY_HOURS),
  };
  const team = Math.min(6, 1 + Math.floor(level / 6));
  // what a sensible player uses: basic spheres for the commons, a better one
  // for the odd rare; potions a tier behind the zone; catching less once the
  // team is made
  const potion = level < 18 ? 'potion_s' : level < 36 ? 'potion_m' : 'potion_l';
  const captures = Math.max(0.1, HOUR.captureShare - level * 0.006);
  const throwCost = level < 15 ? G.ITEMS.sphere_basic.price : 0.75 * G.ITEMS.sphere_basic.price + 0.25 * G.ITEMS[level < 32 ? 'sphere_great' : 'sphere_ultra'].price;
  const upkeep = {
    spheres: Math.round(fights * captures * HOUR.spheresPerCapture * throwCost),
    potions: Math.round(fights / HOUR.potionEvery * G.ITEMS[potion].price),
    clinic: Math.round(fights / HOUR.clinicEvery * G.clinicCost(Array.from({ length: team }, () => ({ level, hp: 1 })))),
  };
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  return { level, zone: z.id, wildLevel: wl, income, upkeep, in: sum(income), out: sum(upkeep), net: sum(income) - sum(upkeep), xp: Math.round(xpPerFight * fights) };
}

/** Hours of play from level 1 to each trainer level. */
function levelHours(maxLevel = 45) {
  const out = [0, 0];
  let lv = 1, xp = 0, h = 0;
  while (lv < maxLevel && h < 400) {
    const step = 0.1, hr = hourAt(lv);
    xp += hr.xp * step; h += step;
    while (lv < maxLevel && xp >= G.PROGRESSION.xpToLevel(lv + 1)) lv += 1, out[lv] = +h.toFixed(1);
  }
  return out;
}

/** What players save up for, with the trainer level they are likely at. */
function goals() {
  const list = [];
  for (const b of Object.values(G.BUILDINGS)) for (let k = 0; k < b.maxLevel; k++) list.push({ what: `${b.he} ${k + 1}`, gold: b.cost(k).gold, at: [3, 10, 18, 26, 34][k], final: k === b.maxLevel - 1 });
  for (let s = 1; s < G.STARS.max; s++) list.push({ what: `כוכב ${s + 1}`, gold: G.STARS.cost(s).gold, at: [8, 16, 24, 32][s - 1], final: s === G.STARS.max - 1 });
  for (const id of ['blade_iron', 'vest_hide', 'charm_focus', 'blade_storm', 'vest_aegis']) list.push({ what: G.ITEMS[id].he, gold: G.ITEMS[id].price, at: G.ITEMS[id].price > 3000 ? 28 : 12 });
  return list;
}

/** Everything, with judgements: an hour that loses gold, or a goal that takes
 *  more than `wall` hours of saving at its level, is flagged. */
// The last tier of anything is meant to take a few sessions: it gets more room.
export function measure({ wall = 6, finalWall = 10, trivial = 0.15 } = {}) {
  const hours = [1, 3, 5, 8, 12, 16, 20, 25, 30, 35, 40, 45].map(hourAt);
  const lh = levelHours();
  const gs = goals().map((g) => {
    const h = hourAt(g.at);
    const need = g.gold / Math.max(1, h.net);
    return { ...g, net: h.net, hours: +need.toFixed(2), flag: need > (g.final ? finalWall : wall) ? 'wall' : need < trivial ? 'trivial' : '' };
  });
  const flags = [
    ...hours.filter((h) => h.net <= 0).map((h) => `level ${h.level}: an hour loses gold (${h.net})`),
    ...gs.filter((g) => g.flag).map((g) => `${g.what} at level ${g.at}: ${g.hours}h of saving (${g.flag})`),
  ];
  return { hours, levelHours: lh, goals: gs, flags };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = measure();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(m, null, 2)); process.exit(0); }
  console.log('\nan hour of play, by trainer level');
  console.log('lvl  zone                 wild   in      out     net     xp     (fights / daily quests / gift | spheres / potions / clinic)');
  for (const h of m.hours) console.log(`${String(h.level).padStart(3)}  ${h.zone.padEnd(20)} ${String(h.wildLevel).padStart(4)} ${String(h.in).padStart(6)} ${String(h.out).padStart(7)} ${String(h.net).padStart(7)} ${String(h.xp).padStart(6)}     (${h.income.fights} / ${h.income.dailyQuests} / ${h.income.dailyGift} | ${h.upkeep.spheres} / ${h.upkeep.potions} / ${h.upkeep.clinic})`);
  console.log('\nhours of play to reach a trainer level');
  console.log([5, 10, 15, 20, 25, 30, 35, 40, 45].map((l) => `L${l}: ${m.levelHours[l] ?? '—'}h`).join('  '));
  console.log('\nwhat it takes to afford, at the level it is wanted');
  for (const g of m.goals) console.log(`${g.flag ? (g.flag === 'wall' ? '!!' : ' ~') : '  '} ${g.what.padEnd(18)} ${String(g.gold).padStart(6)}⛁ at L${String(g.at).padEnd(3)} ${String(g.hours).padStart(5)}h`);
  console.log(m.flags.length ? `\n${m.flags.length} flags:\n  ${m.flags.join('\n  ')}` : '\nno flags');
}
