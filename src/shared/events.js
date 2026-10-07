// Reasons to come back: a reward for every day you open the game, and the
// seasons — stretches of the calendar when something is different out there.
//
// Pure and shared: the server pays by these numbers and the client shows the
// same ones. Dates are UTC, like the daily quests (server dayStamp).

/**
 * Seven days, then round again. Missing a day does not reset the week — it
 * only waits for you; the streak is a separate count, for the badge.
 * `lead`: shards or crystals of your lead creature's element.
 */
export const DAILY_REWARDS = [
  { gold: 200 },
  { items: { sphere_basic: 5 } },
  { gold: 300, items: { potion_m: 2 } },
  { items: { sphere_great: 2 } },
  { lead: { shard: 8 } },
  { gold: 600, items: { revive: 1 } },
  { gold: 1000, items: { sphere_ultra: 1 }, lead: { crystal: 2 }, big: true },
];

/**
 * The seasons. `from`/`to` are MM-DD (a range may cross New Year); `days`
 * are UTC weekdays (0 = Sunday). What each changes:
 *   xp, gold   multipliers on what a won fight pays
 *   shiny      multiplier on the chance a wild is shiny
 *   spawn      {element: weight multiplier} for which wilds come out
 */
export const EVENTS = [
  { id: 'harvest', he: 'חג הקציר', icon: '🍂', color: '#e8913a', from: '09-20', to: '10-31',
    text: 'יצורי טבע ואדמה יוצאים יותר · זהב +15% מקרבות', gold: 1.15, spawn: { verdant: 1.8, terra: 1.8 } },
  { id: 'lanterns', he: 'ליל הפנסים', icon: '🏮', color: '#ff9b4a', from: '10-25', to: '11-03',
    text: 'יצורי אופל ואור בכל מקום · סיכוי כפול לנוצץ', shiny: 2, spawn: { umbra: 2, lumen: 2 } },
  { id: 'frostfest', he: 'פסטיבל הכפור', icon: '❄', color: '#8fd8ff', from: '12-15', to: '01-10',
    text: 'יצורי קרח בכל אזור · ניסיון +20%', xp: 1.2, spawn: { frost: 2.5 } },
  { id: 'bloom', he: 'פריחת האביב', icon: '🌸', color: '#ff9ccf', from: '03-20', to: '04-20',
    text: 'יצורי טבע ורוח פורחים · סיכוי כפול לנוצץ', shiny: 2, spawn: { verdant: 1.8, gale: 1.6 } },
  { id: 'blaze', he: 'קיץ לוהט', icon: '☀', color: '#ffc861', from: '07-01', to: '08-31',
    text: 'יצורי אש ומים בשפע · זהב +10%', gold: 1.1, spawn: { ember: 1.8, aqua: 1.8 } },
  { id: 'weekend', he: 'סוף שבוע כפול', icon: '🎉', color: '#2fe6d0', days: [5, 6],
    text: 'ניסיון +25% מכל קרב', xp: 1.25 },
];

const mmdd = (d) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

function live(e, d) {
  if (e.days) return e.days.includes(d.getUTCDay());
  const m = mmdd(d);
  return e.from <= e.to ? m >= e.from && m <= e.to : m >= e.from || m <= e.to;
}

/** The events on at this moment. */
export function activeEvents(now = Date.now()) {
  const d = new Date(now);
  return EVENTS.filter((e) => live(e, d));
}

/** The product of every live event's `key` multiplier (xp, gold, shiny). */
export function eventMul(key, now = Date.now()) {
  let m = 1;
  for (const e of activeEvents(now)) if (Number.isFinite(e[key])) m *= e[key];
  return m;
}

/** How much more often a wild of these elements comes out right now. */
export function spawnMul(types = [], now = Date.now()) {
  let m = 1;
  for (const e of activeEvents(now)) {
    if (!e.spawn) continue;
    let best = 1;
    for (const t of types) best = Math.max(best, e.spawn[t] || 1);
    m *= best;
  }
  return m;
}

/** When an event that is on ends (UTC ms, the last moment of its last day). */
export function eventEnds(e, now = Date.now()) {
  const d = new Date(now);
  if (e.days) {
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
    let k = 0;
    while (k < 7 && e.days.includes(end.getUTCDay())) end.setUTCDate(end.getUTCDate() + 1), k++;
    return end.getTime() - 1;
  }
  const [mm, dd] = e.to.split('-').map(Number);
  let y = d.getUTCFullYear();
  if (e.from > e.to && mmdd(d) >= e.from) y += 1;
  return Date.UTC(y, mm - 1, dd + 1) - 1;
}

/** The next event to start after `now` (for "coming soon"). */
export function nextEvent(now = Date.now()) {
  const on = new Set(activeEvents(now).map((e) => e.id));
  let best = null;
  for (const e of EVENTS) {
    if (e.days || on.has(e.id)) continue;
    const d = new Date(now);
    const [mm, dd] = e.from.split('-').map(Number);
    let at = Date.UTC(d.getUTCFullYear(), mm - 1, dd);
    if (at <= now) at = Date.UTC(d.getUTCFullYear() + 1, mm - 1, dd);
    if (!best || at < best.at) best = { event: e, at };
  }
  return best;
}
