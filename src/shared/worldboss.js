// When the world bosses are out: on a fixed clock, the same for every server
// and every player, so "when does it come?" has an answer.
//
// It used to be "so many minutes after the zone's room opened": a room closes
// when the last player leaves, so a player who came alone waited the whole
// half hour, and one who stepped out and back started the wait again. Now
// each boss comes every quarter of an hour, a third of the way round from the
// one before, so one of the three is never more than five minutes away.
//
// Pure: the online room spawns by it (rooms/WorldRoom.js), the client says
// when and where the next one is and the arrow leads there.
import { WORLD_BOSSES } from './gamedata.js';

export const BOSS_CYCLE_MS = 15 * 60_000;

/** This boss's window now or next: { active, startsAt, endsAt }. */
export function bossWindow(def, now = Date.now()) {
  const i = Math.max(0, WORLD_BOSSES.indexOf(def)),
    off = (i * BOSS_CYCLE_MS) / Math.max(1, WORLD_BOSSES.length),
    win = Math.min(BOSS_CYCLE_MS - 60_000, (def.windowMinutes || 6) * 60_000),
    start = Math.floor((now - off) / BOSS_CYCLE_MS) * BOSS_CYCLE_MS + off;
  return now < start + win ? { active: true, startsAt: start, endsAt: start + win } : { active: false, startsAt: start + BOSS_CYCLE_MS, endsAt: start + BOSS_CYCLE_MS + win };
}

/** The boss that is out now, or the soonest to come: { def, active, startsAt, endsAt }. */
export function nextBoss(now = Date.now()) {
  return WORLD_BOSSES.map((def) => ({ def, ...bossWindow(def, now) }))
    .sort((a, b) => (a.active ? -1 : a.startsAt) - (b.active ? -1 : b.startsAt))[0] || null;
}
