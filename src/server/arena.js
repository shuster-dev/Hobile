// The ranked arena: a queue, a match by rating, a one-against-one fought even
// (every creature at the arena's level, full health, no guild buffs), and a
// rating that moves by Elo. Seasons are calendar months; the best tier a
// player reached in one pays out once the next begins (shared/endgame.js).
//
// The queue spans the whole server — players in any zone are matched with
// each other — and the room for the fight is made through `useRooms`
// (index.js hands it matchMaker and the store).
import { ARENA, ARENA_TIERS, arenaOf, arenaTier, arenaView, eloAfter, weekly } from '../shared/endgame.js';
import { ITEMS } from '../shared/gamedata.js';
import { giveItem } from './game/combat.js';
import { earn } from './game/economy.js';
import * as Social from './social.js';

export const ARENA_QUEUE = { tickMs: 1000 };

const QUEUE = new Map();   // playerId -> { id, name, rating, since }
let CREATE = null;

/** How to open a fight room: (options) => Promise<{ roomId }>. */
export function useRooms(create) { CREATE = create; }

export function queued(id) { return QUEUE.has(id); }

export function enqueue(doc) {
  if (!Social.worldSink(doc.id)) return { ok: false, code: 'not_in_world' };
  if (QUEUE.has(doc.id)) return { ok: true, already: true };
  const a = arenaOf(doc);
  QUEUE.set(doc.id, { id: doc.id, name: doc.name, rating: a.rating, since: Date.now() });
  Social.sendTo(doc.id, 'arenaQueue', { queued: true, since: Date.now(), size: QUEUE.size });
  tick();
  return { ok: true };
}

export function dequeue(id, why = 'cancelled') {
  if (!QUEUE.delete(id)) return false;
  Social.sendTo(id, 'arenaQueue', { queued: false, why });
  return true;
}

/** Pair the queue: the longest-waiting first, each with the closest rating
 *  inside a window that widens the longer either has waited. */
export function tick(now = Date.now()) {
  for (const [id] of QUEUE) if (!Social.worldSink(id)) QUEUE.delete(id);
  const list = [...QUEUE.values()].sort((a, b) => a.since - b.since);
  const used = new Set();
  for (const a of list) {
    if (used.has(a.id)) continue;
    let best = null, bestGap = Infinity;
    for (const b of list) {
      if (b.id === a.id || used.has(b.id)) continue;
      const gap = Math.abs(a.rating - b.rating);
      const win = Math.min(ARENA.maxWindow, ARENA.window(now - Math.min(a.since, b.since)));
      if (gap <= win && gap < bestGap) { best = b; bestGap = gap; }
    }
    if (!best) continue;
    used.add(a.id); used.add(best.id);
    QUEUE.delete(a.id); QUEUE.delete(best.id);
    open(a, best);
  }
}

async function open(a, b) {
  const sides = { a: [a.id], b: [b.id] };
  if (!CREATE) { for (const p of [a, b]) Social.sendTo(p.id, 'arenaQueue', { queued: false, why: 'unavailable' }); return; }
  let room;
  try { room = await CREATE({ mode: 'pvp', ranked: true, sides, zoneId: 'arena' }); }
  catch (err) {
    console.error('[arena] room', err);
    for (const p of [a, b]) Social.sendTo(p.id, 'arenaQueue', { queued: false, why: 'error' });
    return;
  }
  for (const [p, foe] of [[a, b], [b, a]]) {
    Social.sendTo(p.id, 'arenaMatch', { foe: foe.name, foeRating: foe.rating });
    Social.worldSink(p.id)?.send('goto', { roomId: room.roomId, kind: 'battle', duel: true, ranked: true });
  }
}

/**
 * The result of a ranked fight, written into both documents. `outcome` is the
 * side that won ('a' or 'b') or 'draw'. Returns each side's change.
 */
export function rate(docA, docB, outcome) {
  const A = arenaOf(docA), B = arenaOf(docB);
  const score = outcome === 'a' ? 1 : outcome === 'b' ? 0 : 0.5;
  const r = eloAfter(A.rating, B.rating, score, A.games, B.games);
  const out = {};
  for (const [doc, rec, after, s] of [[docA, A, r.a, score], [docB, B, r.b, 1 - score]]) {
    const before = rec.rating, tierBefore = arenaTier(before).id;
    rec.rating = after; rec.games += 1; rec.best = Math.max(rec.best, after);
    s === 1 ? (rec.wins += 1, weekly(doc).arenaWins += 1) : s === 0 && (rec.losses += 1);
    const tier = arenaTier(after).id;
    out[doc.id] = { before, after, delta: after - before, tier, tierUp: ARENA_TIERS.findIndex((t) => t.id === tier) > ARENA_TIERS.findIndex((t) => t.id === tierBefore) };
  }
  return out;
}

/** Last season's reward, once. */
export function claimSeason(doc) {
  const a = arenaOf(doc);
  if (!a.pending) return { ok: false, code: 'nothing_to_claim' };
  const t = ARENA_TIERS.find((x) => x.id === a.pending.tier) || ARENA_TIERS[0];
  const gold = earn(doc, t.reward.gold, 'pvp');
  for (const [id, q] of Object.entries(t.reward.items || {})) ITEMS[id] && giveItem(doc, id, q);
  const was = a.pending;
  a.pending = null;
  return { ok: true, season: was.season, tier: t.id, gold, items: t.reward.items };
}

export { arenaView };

const timer = setInterval(() => QUEUE.size > 1 && tick(), ARENA_QUEUE.tickMs);
timer.unref?.();

export function _reset() { QUEUE.clear(); }
