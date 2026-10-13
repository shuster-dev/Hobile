// The leaders: one in every world, the strongest trainer there, standing in
// a ring of stones near the camp. Beat their team and you have their badge;
// the badge is what lets you on to the next world (world-messages travel),
// and every badge you hold makes you and your team a little stronger
// (combat.js sumStats). The journey has a step for each (shared/journey.js).
//
// A leader's fight is a battle against their team, one after another; none
// of theirs can be caught (they fight as bosses). A rematch is allowed and
// pays as a battle does, the badge only once.
//
// Pure: the server starts and pays the fight by it (server/game/leaders.js),
// the client draws the ring and the leader and offers the fight.
import { ELEMENTS, SPECIES, ZONES, typeMultiplier } from './gamedata.js';
import { planFor } from './worldplan.js';
import { propsFor, resolveCollision } from './props.js';

/** What every badge held adds, to the trainer and the team. */
export const BADGE_BONUS = { hp: 8, atk: 3, def: 3, spa: 3, spd: 3 };

/** How much harder a leader's creature is than a wild of its level. */
export const LEADER_FOE = { hpScale: 1.35, scale: 1.06 };

export const LEADER_REACH = 6;

const L = (zone, he, title, kind, element, team, badge, gold, items, lines) => ({ id: `leader_${zone}`, zone, he, title, kind, element, team, badge, gold, items, lines });

export const LEADERS = Object.fromEntries([
  L('verdant_meadow', 'ורד', 'שומרת האחו', 'ranger', 'verdant',
    [['lianake', 8], ['thornkin', 9], ['clovhare', 9], ['grovenard', 10]],
    { id: 'badge_leaf', he: 'תג העלה', icon: '🍃' }, 900, [['sphere_great', 3], ['potion_m', 2]],
    { greet: 'האחו לא נכנע לכל מי שעובר בו. הראה לי שהשותף שלך באמת סומך עליך.', win: 'יפה. העלה הזה שלך — ודרך הקניון פתוחה בפניך.', lose: 'עוד לא. תתאמנו, ותחזרו אליי.' }),
  L('emberfall_canyon', 'קורן', 'אש הקניון', 'barbarian', 'ember',
    [['blazehound', 16], ['pyrelynx', 17], ['basalisk', 17], ['calderox', 18]],
    { id: 'badge_flame', he: 'תג הלהבה', icon: '🔥' }, 1600, [['sphere_great', 4], ['revive', 1]],
    { greet: 'בקניון הזה הכול בוער. בוא נראה אם אתה נשרף או מתחשל.', win: 'התחשלת. קח את הלהבה — מישורי האבן מחכים.', lose: 'נשרפת. תחזור כשתהיה חם יותר.' }),
  L('stonewake_mesa', 'גרניט', 'ענק המישורים', 'knight', 'terra',
    [['ramstone', 20], ['boulderon', 21], ['titanox', 21], ['terracolos', 22]],
    { id: 'badge_stone', he: 'תג הסלע', icon: '🪨' }, 2400, [['sphere_great', 4], ['potion_m', 3]],
    { greet: 'סלע לא זז. אם אתה רוצה לעבור — תצטרך לשבור אותו.', win: 'שברת סלע. מעטים עושים את זה. מפרץ הגאות שלך.', lose: 'הסלע עומד. אתה לא.' }),
  L('tidal_hollow', 'נאיה', 'מלכת הגאות', 'mage', 'aqua',
    [['torrentoad', 24], ['tidefin', 25], ['maelstride', 25], ['koimperor', 26]],
    { id: 'badge_wave', he: 'תג הגל', icon: '🌊' }, 3200, [['sphere_ultra', 1], ['revive', 2]],
    { greet: 'הגאות עולה ויורדת, אבל תמיד חוזרת. גם אני.', win: 'הגל שלך. הרמות שמעל המפרץ — שם הסערה מחכה.', lose: 'הגאות סחפה אותך. תחזור כשהמים יירגעו.' }),
  L('stormreach_heights', 'ברק', 'אדון הסערה', 'rogue', 'volt',
    [['joltusk', 28], ['voltmane', 29], ['tempestral', 29], ['thundrift', 30]],
    { id: 'badge_bolt', he: 'תג הברק', icon: '⚡' }, 4000, [['sphere_ultra', 2], ['potion_l', 2]],
    { greet: 'ברק לא מכה פעמיים באותו מקום. אני כן.', win: 'עמדת בסערה. רכס הכפור מעבר לעננים.', lose: 'הסערה ניצחה. תחכה לשמש.' }),
  L('frostpeak_ridge', 'שלגית', 'רוח הכפור', 'mage', 'frost',
    [['glacivix', 32], ['glacilisk', 33], ['walrune', 33], ['yetimaul', 34]],
    { id: 'badge_frost', he: 'תג הכפור', icon: '❄️' }, 4600, [['sphere_ultra', 2], ['revive_full', 1]],
    { greet: 'כאן למעלה הכול שקט, ואני אוהבת את השקט. אל תשבור אותו סתם.', win: 'חם לך בלב, מאמן. החורש האפל מחכה למטה.', lose: 'קפאת. תתחמם ותחזור.' }),
  L('umbral_grove', 'צל', 'שומר החורש', 'rogue', 'umbra',
    [['nightfang', 42], ['phantomire', 43], ['sporeking', 44], ['nocturnix', 45]],
    { id: 'badge_shade', he: 'תג הצל', icon: '🌑' }, 6000, [['sphere_ultra', 3], ['revive_full', 2]],
    { greet: 'בחורש הזה גם האור מפחד. ואתה?', win: 'לא פחדת. שבעה תגים — אין הרבה שהגיעו עד לכאן.', lose: 'הצל בלע אותך. תחזור כשתראה בחושך.' }),
].map((l) => [l.zone, l]));

/**
 * What hits a team hard: each element, with how many of the team it is strong
 * against, best first. The leader's word before the fight and the league's
 * line-up say it, so a player can bring the right ones (species ids in).
 */
export function weakTo(team) {
  return Object.keys(ELEMENTS)
    .map((el) => ({ el, n: team.filter((sp) => typeMultiplier(el, SPECIES[sp]?.types || []) > 1).length }))
    .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
}

/** The leader of a zone, or null (the town has none). */
export const leaderOf = (zone) => LEADERS[zone] || null;

/** Badges held (ids), as the doc keeps them. */
export const badgesOf = (doc) => (Array.isArray(doc?.badges) ? doc.badges : []);

/** The order the worlds open in, by their levels. */
export const LEADER_ORDER = Object.values(LEADERS).sort((a, b) => ZONES[a.zone].levels[0] - ZONES[b.zone].levels[0]).map((l) => l.zone);

/** The badge a zone asks for before you may travel there, or null. */
export function badgeNeeded(zone) {
  const i = LEADER_ORDER.indexOf(zone);
  return i > 0 ? LEADERS[LEADER_ORDER[i - 1]] : null;
}

/** What all the badges held add up to. */
export function badgeBonus(doc) {
  const n = badgesOf(doc).length, out = {};
  for (const [k, v] of Object.entries(BADGE_BONUS)) out[k] = v * n;
  return out;
}

const SPOT = new Map();
/**
 * Where the leader's ring is: out from the camp toward the middle of the
 * zone, on open ground a ring of stones fits on. The same for everyone.
 */
export function leaderSpot(zone) {
  if (SPOT.has(zone)) return SPOT.get(zone);
  const z = ZONES[zone], camp = z?.landmarks?.find((l) => l.kind === 'camp');
  if (!z || !camp) return SPOT.set(zone, null), null;
  let plan = null, cols = [];
  try { plan = planFor(z); cols = propsFor(z).colliders || []; } catch { /* drawn without */ }
  const free = (x, y) => (!plan || plan.walkable(x, y)) && Math.hypot(resolveCollision(cols, x, y, 0.6).x - x, resolveCollision(cols, x, y, 0.6).z - y) < 0.01;
  const roomy = (x, y) => free(x, y) && [0, 1, 2, 3, 4, 5, 6, 7].every((k) => free(x + Math.cos(k * Math.PI / 4) * 3.4, y + Math.sin(k * Math.PI / 4) * 3.4));
  const d = Math.hypot(camp.x, camp.z) || 1, ux = -camp.x / d, uz = -camp.z / d, half = z.size / 2 - 12;
  let spot = null;
  for (let r = camp.r + 10; r < camp.r + 60 && !spot; r += 3) {
    for (let a = 0; a < 12 && !spot; a++) {
      const turn = (a % 2 ? 1 : -1) * Math.ceil(a / 2) * 0.22, c = Math.cos(turn), s = Math.sin(turn);
      const x = camp.x + (ux * c - uz * s) * r, y = camp.z + (ux * s + uz * c) * r;
      if (Math.abs(x) < half && Math.abs(y) < half && roomy(x, y)) spot = { x: Math.round(x * 10) / 10, z: Math.round(y * 10) / 10 };
    }
  }
  SPOT.set(zone, spot);
  return spot;
}
