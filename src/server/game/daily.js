// The daily reward: open the game, collect today's tile of the week.
//
// The week waits for you — a missed day does not send you back to the start —
// and the streak is counted beside it, for the badge. Days are UTC, the same
// days the daily quests turn over on.
import { DAILY_REWARDS } from '../../shared/events.js';
import { ITEMS, SPECIES } from '../../shared/gamedata.js';
import { earn } from './economy.js';
// (combat.js's publicProfile calls loginView, so nothing from combat.js here)

const dayStamp = (d = new Date()) => `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
const give = (doc, id, q) => { if (ITEMS[id]) (doc.inventory ||= {})[id] = (doc.inventory[id] || 0) + q; };
function leadOf(doc) {
  const team = (doc.team || []).map((u) => doc.creatures?.[u]).filter(Boolean);
  return team.find((c) => c.hp > 0) || team[0] || null;
}

const DAY = 86_400_000;

export function loginOf(doc) {
  if (!doc.login || typeof doc.login !== 'object') doc.login = { day: 0, last: null, streak: 0, total: 0 };
  return doc.login;
}

/** What today's (or a given day's) tile is, made concrete for this player:
 *  "shards of your lead's element" becomes the item it names. */
export function rewardFor(doc, day) {
  const def = DAILY_REWARDS[((day % DAILY_REWARDS.length) + DAILY_REWARDS.length) % DAILY_REWARDS.length];
  const out = { gold: def.gold || 0, items: { ...(def.items || {}) }, big: !!def.big };
  if (def.lead) {
    const el = SPECIES[leadOf(doc)?.species]?.types?.[0] || 'terra';
    for (const [kind, q] of Object.entries(def.lead)) {
      const id = `${kind}_${el}`;
      if (ITEMS[id]) out.items[id] = (out.items[id] || 0) + q;
    }
  }
  return out;
}

/** For the profile: where in the week, whether today is taken, the streak. */
export function loginView(doc, now = Date.now()) {
  const l = loginOf(doc), today = dayStamp(new Date(now)), yday = dayStamp(new Date(now - DAY));
  const claimed = l.last === today;
  return {
    day: l.day % DAILY_REWARDS.length,
    claimed,
    streak: claimed || l.last === yday ? l.streak : 0,
    total: l.total,
    today: rewardFor(doc, l.day),
  };
}

/** Collect today's. Once a day; the week moves on one tile. */
export function claimDaily(doc, now = Date.now()) {
  const l = loginOf(doc), today = dayStamp(new Date(now)), yday = dayStamp(new Date(now - DAY));
  if (l.last === today) return { ok: false, reason: 'daily_taken' };
  const day = l.day % DAILY_REWARDS.length;
  const reward = rewardFor(doc, day);
  earn(doc, reward.gold, 'daily');
  for (const [id, q] of Object.entries(reward.items)) give(doc, id, q);
  l.streak = l.last === yday ? (l.streak || 0) + 1 : 1;
  l.last = today;
  l.day = (day + 1) % DAILY_REWARDS.length;
  l.total = (l.total || 0) + 1;
  return { ok: true, day, reward, streak: l.streak };
}
