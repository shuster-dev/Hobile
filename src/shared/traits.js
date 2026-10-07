// What makes two of the same species different: a nature and an ability.
//
// Both are rolled once, when a creature is made, and never change — not on a
// level, not on a star, not when it evolves. A wild has them too, and keeps
// them when it is caught: the static spark you saw it throw is the one you
// get. Shared, so the card the client draws says exactly what the server does.
// No imports: shared/gamedata.js (statsFor) depends on this file.

/**
 * Ten natures lean one stat up a tenth and another down a tenth; two lean
 * nowhere. HP is never touched — a nature is a temperament, not a size.
 */
export const NATURES = {
  brave:    { he: 'אמיץ',   up: 'atk', down: 'spd' },
  fierce:   { he: 'עז',     up: 'atk', down: 'spa' },
  stubborn: { he: 'עקשן',   up: 'def', down: 'spa' },
  bold:     { he: 'נועז',   up: 'def', down: 'atk' },
  clever:   { he: 'פיקח',   up: 'spa', down: 'atk' },
  dreamy:   { he: 'חולמני', up: 'spa', down: 'def' },
  calm:     { he: 'שליו',   up: 'spd', down: 'atk' },
  gentle:   { he: 'עדין',   up: 'spd', down: 'def' },
  hasty:    { he: 'נמהר',   up: 'atk', down: 'def' },
  wise:     { he: 'נבון',   up: 'spa', down: 'spd' },
  steady:   { he: 'יציב',   up: null,  down: null },
  playful:  { he: 'שובב',   up: null,  down: null },
};
export const NATURE_IDS = Object.keys(NATURES);
export const NATURE_STEP = 0.1;

export const STAT_HE = { hp: 'חיים', atk: 'התקפה', def: 'הגנה', spa: 'מיוחדת', spd: 'עמידות', spe: 'מהירות' };

/** Multiplier a nature puts on one stat. Unknown or missing natures are neutral. */
export function natureMul(nature, stat) {
  const n = nature && Object.prototype.hasOwnProperty.call(NATURES, nature) ? NATURES[nature] : null;
  if (!n) return 1;
  return n.up === stat ? 1 + NATURE_STEP : n.down === stat ? 1 - NATURE_STEP : 1;
}

/** Stats with the nature applied (a new object). */
export function withNature(stats, nature) {
  if (!nature || !NATURES[nature]?.up) return stats;
  const out = { ...stats };
  for (const k of ['atk', 'def', 'spa', 'spd']) out[k] = Math.floor(out[k] * natureMul(nature, k));
  return out;
}

/**
 * Abilities. Each one is a rule the fight (server/game/combat.js) checks at
 * one moment: when a hit is worked out, when it lands, when the creature
 * comes onto the field, as the seconds pass. Numbers live here so the card
 * and the fight cannot disagree.
 */
export const ABILITIES = {
  surge:      { he: 'פרץ יסוד',    icon: '💥', at: 0.34, mul: 1.25, text: (el) => `מתחת לשליש חיים — מהלכי ${el} שלו חזקים ב‑25%` },
  flame_body: { he: 'גוף בוער',    icon: '🔥', chance: 0.25,          text: () => 'מי שפוגע בו במגע עלול להישרף' },
  intimidate: { he: 'מאיים',       icon: '😠', value: 0.12, dur: 8000, text: () => 'כשהוא עולה לזירה, התקפת היריבים יורדת לזמן מה' },
  regen:      { he: 'התחדשות',     icon: '💚', perSec: 0.006,         text: () => 'מחלים לאט כל עוד הוא בזירה' },
  guard:      { he: 'שריון',       icon: '🛡', hits: 2, mul: 0.7,      text: () => 'שתי הפגיעות הראשונות בכל קרב חלשות ב‑30%' },
  thick_hide: { he: 'עור עבה',     icon: '🦏', mul: 0.8,               text: () => 'פגיעות יעילות במיוחד נגדו חלשות ב‑20%' },
  static:     { he: 'חשמל סטטי',   icon: '⚡', chance: 0.2, dur: 1200, text: () => 'מי שפוגע בו במגע עלול להיתקע לרגע' },
  swift:      { he: 'זריז',        icon: '💨', mul: 0.88,              text: () => 'המהלכים שלו מוכנים מהר יותר ב‑12%' },
  sturdy:     { he: 'עמיד',        icon: '🪨', from: 0.5,              text: () => 'פעם בקרב, מכה שהייתה מפילה אותו משאירה אותו עם נקודת חיים' },
  keen_eye:   { he: 'עין חדה',     icon: '🎯', crit: 0.125,            text: () => 'פי שניים פגיעות קריטיות' },
  frostbite:  { he: 'נשיכת כפור',  icon: '❄', chance: 0.18, value: 0.3, dur: 3000, text: () => 'הפגיעות שלו עלולות להאט את היריב' },
  shadow_veil:{ he: 'מעטה צל',     icon: '🌑', chance: 0.1,            text: () => 'לפעמים מכה פשוט עוברת דרכו' },
  vampiric:   { he: 'מוצץ',        icon: '🦇', share: 0.1,             text: () => 'מחזיר לעצמו עשירית מהנזק שהוא עושה' },
  radiant:    { he: 'קורן',        icon: '✨', heal: 0.08,              text: () => 'כשהוא עולה לזירה, הוא מרפא את כל בעלי בריתו קצת' },
  focus:      { he: 'מיקוד',       icon: '🧘', mul: 1.25,              text: () => 'המרץ שלו מתמלא מהר יותר ב‑25%' },
  poison_touch:{ he: 'מגע רעיל',   icon: '☠', chance: 0.25, value: 0.04, dur: 4000, text: () => 'הפגיעות שלו במגע עלולות להרעיל' },
};
export const ABILITY_IDS = Object.keys(ABILITIES);

/** What each element's creatures may be born with: two common, one rare. */
export const ABILITY_POOLS = {
  ember:   ['surge', 'flame_body', 'intimidate'],
  aqua:    ['surge', 'regen', 'guard'],
  verdant: ['surge', 'regen', 'thick_hide'],
  volt:    ['surge', 'static', 'swift'],
  terra:   ['surge', 'sturdy', 'thick_hide'],
  gale:    ['surge', 'swift', 'keen_eye'],
  frost:   ['surge', 'frostbite', 'guard'],
  umbra:   ['surge', 'shadow_veil', 'vampiric'],
  lumen:   ['surge', 'focus', 'radiant'],
  metal:   ['surge', 'guard', 'sturdy'],
};
const POOL_WEIGHTS = [0.45, 0.43, 0.12];

/** A creature's surge is named for its element. */
const SURGE_HE = {
  ember: 'להבה פנימית', aqua: 'זרם', verdant: 'צמיחה', volt: 'מתח גבוה', terra: 'לב אבן',
  gale: 'סערה', frost: 'קור עז', umbra: 'חושך', lumen: 'זוהר', metal: 'פלדה',
};

const EL_HE = { ember: 'אש', aqua: 'מים', verdant: 'טבע', volt: 'חשמל', terra: 'אדמה', gale: 'רוח', frost: 'קרח', umbra: 'אופל', lumen: 'אור', metal: 'מתכת' };

/** A number in [0,1) from any string, the same everywhere (FNV-1a). */
function unit(s) {
  s = String(s);
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h ^= s.charCodeAt(k), h = Math.imul(h, 16777619);
  return (h >>> 0) % 100000 / 100000;
}

/** Roll a nature. `rand` may be seeded; `seed` (a uid) makes it repeatable. */
export function rollNature(rand = Math.random, seed = null) {
  const r = seed != null ? unit(`nature:${seed}`) : rand();
  return NATURE_IDS[Math.floor(r * NATURE_IDS.length) % NATURE_IDS.length];
}

/** Roll an ability for a species' first element. */
export function rollAbility(types, rand = Math.random, seed = null) {
  const pool = ABILITY_POOLS[types?.[0]] || ABILITY_POOLS.terra;
  let r = seed != null ? unit(`ability:${seed}`) : rand();
  for (let k = 0; k < pool.length; k++) {
    if (r < POOL_WEIGHTS[k]) return pool[k];
    r -= POOL_WEIGHTS[k];
  }
  return pool[0];
}

/** Whether an ability is the rare one of its element's pool. */
export function abilityRare(types, ability) {
  const pool = ABILITY_POOLS[types?.[0]] || [];
  return pool.indexOf(ability) === pool.length - 1;
}

/** Name, icon and one line, for a card. */
export function abilityInfo(ability, types = []) {
  const a = ABILITIES[ability];
  if (!a) return null;
  const el = types[0];
  const elHe = EL_HE[el] || '';
  return {
    id: ability,
    he: ability === 'surge' && SURGE_HE[el] ? SURGE_HE[el] : a.he,
    icon: a.icon,
    text: a.text(elHe),
    rare: abilityRare(types, ability),
  };
}

export function natureInfo(nature) {
  const n = NATURES[nature];
  if (!n) return null;
  return { id: nature, he: n.he, up: n.up, down: n.down, upHe: STAT_HE[n.up] || null, downHe: STAT_HE[n.down] || null };
}
