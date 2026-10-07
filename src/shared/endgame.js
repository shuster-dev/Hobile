// What there is to do once the story is behind you: the dungeons again at
// harder tiers, a tower with no top, a ranked arena with seasons, and the
// weekly boards that keep score of all of it. Pure and shared: the server
// runs these rules and the client shows the same numbers.
import { DUNGEONS, ELEMENTS, SPECIES } from './gamedata.js';

// ---------------------------------------------------------------------------
// dungeon tiers
// ---------------------------------------------------------------------------

/** Each tier needs the one before it cleared, in that dungeon. */
export const DUNGEON_TIERS = [
  { id: 'normal', he: 'רגיל',  icon: '⚔',  lvl: 0,  hp: 1,    reward: 1,   minLevel: 0 },
  { id: 'hard',   he: 'קשה',   icon: '🔥', lvl: 6,  hp: 1.35, reward: 1.8, minLevel: 6 },
  { id: 'mythic', he: 'אגדי',  icon: '💀', lvl: 12, hp: 1.8,  reward: 3,   minLevel: 12 },
];
export const TIER_IDS = DUNGEON_TIERS.map((t) => t.id);
export const tierOf = (id) => DUNGEON_TIERS.find((t) => t.id === id) || DUNGEON_TIERS[0];

/** A party is tougher to fight: more of them, each standing up longer. */
export const PARTY_SCALE = { hpPerPlayer: 0.55, extraFoeFrom: 3 };

/** Whether this player may take on this dungeon at this tier, and why not. */
export function canEnter(doc, def, tierId = 'normal') {
  const tier = tierOf(tierId);
  if (!def) return { ok: false, code: 'no_dungeon' };
  if ((doc.level || 1) < (def.minLevel || 1) + tier.minLevel) return { ok: false, code: 'level_too_low', need: (def.minLevel || 1) + tier.minLevel };
  const k = TIER_IDS.indexOf(tier.id);
  if (k > 0) {
    const best = doc.records?.dungeons?.[def.id] ?? -1;
    if (best < k - 1) return { ok: false, code: 'tier_locked', need: TIER_IDS[k - 1] };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// the endless tower
// ---------------------------------------------------------------------------

const ELEMENT_IDS = Object.keys(ELEMENTS);

export const TOWER = {
  id: 'endless_tower',
  name: 'Endless Tower',
  he: 'המגדל האינסופי',
  minLevel: 15,
  partyMax: 4,
  endless: true,
  bossEvery: 5,
  // milestone chests, every five floors
  chest(floor) {
    const k = Math.floor(floor / 5);
    const items = { sphere_great: 1 + Math.floor(k / 2) };
    if (k >= 2) items.aether_core = Math.floor(k / 2);
    if (k >= 4) items.sphere_ultra = 1;
    return { gold: 400 * k, items };
  },
};

/** A floor's element: the tower turns through all ten, one floor at a time. */
export function towerElement(floor) {
  return ELEMENT_IDS[(Math.max(1, floor) - 1) % ELEMENT_IDS.length];
}

/** Who lives on a floor of that element: anything wild of it, never a boss or
 *  a legendary. */
export function towerPool(floor) {
  const el = towerElement(floor);
  const all = Object.values(SPECIES).filter((s) => s.types?.[0] === el && s.rarity !== 'boss' && s.rarity !== 'legendary');
  return all.length ? all.map((s) => s.id) : Object.values(SPECIES).filter((s) => s.rarity === 'common').map((s) => s.id);
}

/** The guardian of a fifth floor: one of the dungeon bosses, in turn. */
export function towerBoss(floor) {
  const bosses = [...new Set(Object.values(DUNGEONS).map((d) => d.boss))].filter((b) => SPECIES[b]);
  return bosses[Math.floor(floor / TOWER.bossEvery - 1) % bosses.length] || bosses[0];
}

/** Level on a floor: it starts a little under the party and climbs. */
export function towerLevel(floor, partyLevel) {
  return Math.max(8, Math.min(100, Math.round(partyLevel - 4 + floor * 1.4)));
}

// ---------------------------------------------------------------------------
// weeks and seasons
// ---------------------------------------------------------------------------

/** ISO week, "2026-W41": the boards turn over on Monday 00:00 UTC. */
export function weekStamp(now = Date.now()) {
  const d = new Date(now);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
}

/** When the week ends (the next Monday 00:00 UTC). */
export function weekEnds(now = Date.now()) {
  const d = new Date(now);
  const day = d.getUTCDay() || 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (8 - day));
}

/** A player's numbers for this week, started fresh when the week turns. */
export function weekly(doc, now = Date.now()) {
  const w = weekStamp(now);
  if (!doc.weekly || doc.weekly.week !== w) doc.weekly = { week: w, tower: 0, boss: 0, arenaWins: 0, dungeons: 0 };
  return doc.weekly;
}

/** Arena seasons are calendar months: "2026-10". */
export function seasonStamp(now = Date.now()) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function seasonEnds(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

// ---------------------------------------------------------------------------
// the ranked arena
// ---------------------------------------------------------------------------

export const ARENA = {
  start: 1000,
  level: 50,            // every creature fights at this level: a team, not a grind
  kNew: 48, k: 32, newGames: 10,
  // how far apart two ratings may be matched, widening the longer they wait
  window: (waitedMs) => 100 + Math.floor(waitedMs / 1000) * 25,
  maxWindow: 600,
};

export const ARENA_TIERS = [
  { id: 'bronze',   he: 'ארד',    icon: '🥉', from: 0,    reward: { gold: 500,  items: { sphere_great: 2 } } },
  { id: 'silver',   he: 'כסף',    icon: '🥈', from: 1100, reward: { gold: 1200, items: { sphere_great: 4 } } },
  { id: 'gold',     he: 'זהב',    icon: '🥇', from: 1300, reward: { gold: 2500, items: { sphere_ultra: 1, aether_core: 1 } } },
  { id: 'platinum', he: 'פלטינה', icon: '💠', from: 1500, reward: { gold: 4000, items: { sphere_ultra: 2, aether_core: 2 } } },
  { id: 'diamond',  he: 'יהלום',  icon: '💎', from: 1700, reward: { gold: 6500, items: { sphere_ultra: 3, aether_core: 3 } } },
  { id: 'legend',   he: 'אגדה',   icon: '👑', from: 1900, reward: { gold: 10000, items: { sphere_ultra: 5, aether_core: 5 } } },
];

export function arenaTier(rating) {
  let t = ARENA_TIERS[0];
  for (const x of ARENA_TIERS) if (rating >= x.from) t = x;
  return t;
}

/** Elo: what each side's rating becomes. `aWon` 1, 0 or 0.5. */
export function eloAfter(a, b, aWon, gamesA = 99, gamesB = 99) {
  const ea = 1 / (1 + 10 ** ((b - a) / 400));
  const ka = gamesA < ARENA.newGames ? ARENA.kNew : ARENA.k;
  const kb = gamesB < ARENA.newGames ? ARENA.kNew : ARENA.k;
  return {
    a: Math.max(0, Math.round(a + ka * (aWon - ea))),
    b: Math.max(0, Math.round(b + kb * ((1 - aWon) - (1 - ea)))),
  };
}

/** A player's arena record, rolled into the new season when one starts:
 *  half the way back to the start, and last season's best remembered for its
 *  reward. */
export function arenaOf(doc, now = Date.now()) {
  const s = seasonStamp(now);
  if (!doc.arena) doc.arena = { season: s, rating: ARENA.start, best: ARENA.start, wins: 0, losses: 0, games: 0, pending: null };
  const a = doc.arena;
  if (a.season !== s) {
    // the season that ended pays by the best tier reached in it, once
    if (a.games > 0) a.pending = { season: a.season, tier: arenaTier(a.best).id };
    a.season = s;
    a.rating = Math.round(ARENA.start + (a.rating - ARENA.start) / 2);
    a.best = a.rating; a.wins = 0; a.losses = 0; a.games = 0;
  }
  return a;
}

export function arenaView(doc, now = Date.now()) {
  const a = arenaOf(doc, now);
  const t = arenaTier(a.rating);
  const next = ARENA_TIERS[ARENA_TIERS.indexOf(t) + 1] || null;
  return { season: a.season, ends: seasonEnds(now), rating: a.rating, best: a.best, wins: a.wins, losses: a.losses, games: a.games,
    tier: t.id, next: next && { id: next.id, from: next.from }, pending: a.pending };
}
