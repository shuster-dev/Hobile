// The season's track (a "battle pass", fairly): play earns season points,
// points climb thirty tiers, every tier pays something — gold, spheres,
// potions, crystals, cores — and the milestone tiers pay the season's own
// hats and dyes, which cannot be bought for gold (shared/cosmetics.js `pass`).
//
// Fair, by rule: the track is the same for everyone, and nothing on it is
// for sale. If a paid track is ever added it carries looks only — never a
// stat, never a creature, never a shortcut — and that is held by the test
// that checks the rewards (tools/qa.mjs). Points have a daily ceiling, so
// the track rewards coming back, not grinding through the night.
//
// Pure: the server adds points as rewards are paid (server/game/pass.js, on
// economy's earn) and hands out what is claimed; the panel shows it.
import { seasonEnds, seasonStamp } from './endgame.js';

export const PASS = { tiers: 30, perTier: 100, dailyCap: 450 };

/** Season points for what was just paid for (economy.js sources). */
export const POINTS = { battle: 2, capture: 4, quest: 12, daily: 15, boss: 12, dungeon: 15, pvp: 6 };

/** What each tier pays. `cosmetic` ids are the season's (cosmetics.js `pass: true`). */
export const REWARDS = Array.from({ length: PASS.tiers }, (_, i) => {
  const t = i + 1;
  if (t === 6) return { cosmetic: 'gold' };
  if (t === 12) return { cosmetic: 'halo' };
  if (t === 18) return { cosmetic: 'rift' };
  if (t === 24) return { cosmetic: 'horns' };
  if (t === 30) return { cosmetic: 'riftcrown' };
  if (t % 5 === 0) return { items: [['aether_core', 1 + Math.floor(t / 10)]], gold: 500 * t };
  if (t % 3 === 0) return { items: [['sphere_ultra', 1 + Math.floor(t / 12)]] };
  if (t % 2 === 0) return { items: [[t < 10 ? 'potion_m' : 'potion_l', 2]], gold: 150 * t };
  return { items: [[t < 15 ? 'sphere_great' : 'sphere_ultra', t < 15 ? 3 : 1]], gold: 100 * t };
});

const utcDay = (now) => { const d = new Date(now); return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`; };

/** The player's track for this season (a new season starts it over). */
export function passOf(doc, now = Date.now()) {
  const season = seasonStamp(now);
  let p = doc.pass;
  if (!p || typeof p !== 'object' || p.season !== season) p = doc.pass = { season, points: 0, claimed: [], day: '', today: 0 };
  Array.isArray(p.claimed) || (p.claimed = []);
  return p;
}

export const tierOfPoints = (points) => Math.min(PASS.tiers, Math.floor((points || 0) / PASS.perTier));

/** Add points for `source`, up to the day's ceiling; returns how many went on. */
export function addPoints(doc, source, now = Date.now(), times = 1) {
  const n = (POINTS[source] || 0) * times;
  if (!n) return 0;
  const p = passOf(doc, now), day = utcDay(now);
  if (p.day !== day) { p.day = day; p.today = 0; }
  const room = Math.max(0, PASS.dailyCap - p.today), add = Math.min(n, room);
  p.today += add;
  p.points += add;
  return add;
}

/** Why a tier cannot be claimed, or null if it can. */
export function cannotClaim(doc, tier, now = Date.now()) {
  const p = passOf(doc, now);
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS.tiers) return 'bad_tier';
  if (p.claimed.includes(tier)) return 'already_claimed';
  if (tierOfPoints(p.points) < tier) return 'not_reached';
  return null;
}

/** What the panel shows. */
export function passView(doc, now = Date.now()) {
  const p = passOf(doc, now), tier = tierOfPoints(p.points);
  return {
    season: p.season, points: p.points, tier, perTier: PASS.perTier, tiers: PASS.tiers,
    into: p.points - tier * PASS.perTier, claimed: [...p.claimed],
    today: p.day === utcDay(now) ? p.today : 0, dailyCap: PASS.dailyCap, ends: seasonEnds(now),
    ready: Array.from({ length: tier }, (_, i) => i + 1).filter((t) => !p.claimed.includes(t)).length,
  };
}
