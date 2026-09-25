// Out in the field: where you stand, and what notices you standing there.
//
// Shared by both drivers, like world-messages.js: WorldRoom (online) and
// WorldSim (the single-player build) each describe themselves to tickField()
// through a small adapter, so the rules below exist once.
//
// Two things live here.
//
// 1. Your spot. A battle, a dungeon or a dropped connection takes you out of
//    the world room and brings you back into a new session of it. Every
//    arrival used to go through spawnPoint(), which is the camp — so each
//    fight, each capture, sent you home. The last position the server
//    accepted is now kept on the document, and coming back to the same zone
//    puts you on it. Crossing into another zone still arrives at its camp;
//    losing a fight (a blackout) still wakes you there, as it always has.
//
// 2. Wilds that come for you. Balanced on purpose:
//      - only fierce species do it (TEMPER in shared/gamedata.js; the
//        nocturnal ones only after dark);
//      - one that shares an element with the creature walking beside you
//        leaves you be — the way to cross a zone in peace is to bring one
//        of its own;
//      - one far weaker than that creature runs from you instead;
//      - it stops and shows "!" before it moves, then gives a short chase
//        a running trainer can outpace, and gives up with "?";
//      - never in town, never inside a camp, never through a door, never in
//        the half-minute after a fight, never at someone who stepped away
//        from the game, never at a trainer with nothing left standing, and
//        never before trainer level 3 — the first fights are yours to pick.
import { resolveCollision } from '../../shared/props.js';
import { FIELD_FROM_LEVEL, isNight, stanceOfLead, temperOf, WEAK_GAP } from '../../shared/temper.js';
import { activeCreature } from './combat.js';

export { isNight, temperOf };

export const FIELD = {
  scanMs: 300,            // how often an idle wild looks around
  noticeR: 6.5,           // metres: it sees you
  noticeChance: 0.55,     // per look, so it is not a tripwire
  alertMs: 900,           // it stands and shows "!" this long before moving
  chaseSpeed: 4.4,        // m/s — a jog; a trainer at a run does 7.4
  chaseMs: 6500,          // then it tires
  loseR: 12,              // metres: out of sight, it gives up
  catchR: 1.8,            // metres: caught, the fight starts here
  lostMs: 1300,           // "?" — it stands, then wanders off
  fleeR: 5.5,             // a much weaker one bolts when you come this close
  fleeMs: 1800,
  fleeSpeed: 3.6,         // slower than you: still catchable
  weakGap: WEAK_GAP,      // levels below your companion that count as "much weaker"
  wildRestMs: 20_000,     // one that gave up leaves everyone alone this long
  foughtRestMs: 45_000,   // and one you just fought, longer
  escapeMs: 8_000,        // nothing starts on a trainer who just got away
  battleCalmMs: 30_000,   // the half-minute after any fight
  joinCalmMs: 6_000,      // arriving in a zone
  awayMs: 60_000,         // no step in this long: not at the game
  pendingMs: 10_000,      // a battle is being set up for this trainer
  safeMargin: 3,          // metres beyond a camp's circle that still count
  bossClearR: 20,         // nobody gets jumped in the middle of a world-boss fight
  minTrainerLevel: FIELD_FROM_LEVEL,
};

const SAFE_KINDS = new Set(['town', 'camp', 'plaza']);

// --- your spot -------------------------------------------------------------

/** Remember where the server last put this player. Called on every accepted
 *  step, so the spot is current whichever way the session ends. */
export function keepSpot(doc, zoneId, p) {
  if (!doc || !p || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return;
  let s = doc.pos;
  if (!s || typeof s !== 'object' || s.zone !== zoneId) s = doc.pos = { zone: zoneId, x: 0, z: 0 };
  s.x = Math.round(p.x * 100) / 100;
  s.z = Math.round(p.z * 100) / 100;
}

/** Where a player coming back into this zone should stand, or null for the
 *  zone's usual arrival point. Only a return counts: arriving from another
 *  zone is a journey, and a journey ends at the camp. */
export function savedSpot(doc, zoneId, zone, colliders, fromZone) {
  const s = doc?.pos;
  if (fromZone || !s || s.zone !== zoneId || !Number.isFinite(s.x) || !Number.isFinite(s.z)) return null;
  const half = zone.size / 2 - 1;
  const x = Math.max(-half, Math.min(half, s.x)), z = Math.max(-half, Math.min(half, s.z));
  return resolveCollision(colliders, x, z, 0.72);
}

// --- what notices you ---------------------------------------------------------
// isNight, temperOf and the stance itself live in shared/temper.js, so the
// client's nameplates read the same rules the server acts on.

/** Said once per player, the first time they stand somewhere this applies:
 *  the "!" explains itself, the rule about elements does not. */
export function fieldHint(doc, zone) {
  if (!doc || !zone || zone.urban || (doc.level || 1) < FIELD.minTrainerLevel) return null;
  const hints = doc.hints && typeof doc.hints === 'object' ? doc.hints : (doc.hints = {});
  if (hints.field) return null;
  hints.field = Date.now();
  return '⚔ יש כאן יצורים תוקפניים — הסימן ⚔ ליד השם. כשאחד מבחין בך מופיע מעליו ! והוא רודף אחריך: אפשר לברוח או להילחם. '
    + 'יצור שהולך איתך מאותו יסוד שומר עליך מבני היסוד שלו, ובמחנה ובעיר אתה בטוח.';
}

/** Town, a camp's circle, or a plaza: ground no wild starts anything on. */
export function inSafeGround(zone, x, z, margin = 0) {
  if (!zone || zone.urban) return true;
  return zone.landmarks.some((l) => SAFE_KINDS.has(l.kind) && l.r && Math.hypot(l.x - x, l.z - z) < l.r + margin);
}

/** How a fierce wild takes this trainer: 'kin', 'unarmed', 'flee' or
 *  'fight' (shared/temper.js), judged by the creature at their side. */
export function stanceToward(species, level, doc) {
  return stanceOfLead(species, level, activeCreature(doc));
}

/** The first reason this player cannot be noticed right now, or '' if they
 *  can. Exported for the tests, which is also why it returns a reason. */
export function unnoticeable(world, entry, now) {
  const { p, doc, ctx } = entry;
  if (!p || !doc || !ctx) return 'gone';
  if (ctx.inside || p.status === 'inside') return 'indoors';
  if (now < (ctx.calmUntil || 0)) return 'calm';
  if (now < (ctx.escapedUntil || 0)) return 'escaped';
  if (now < (ctx.battlePending || 0)) return 'busy';
  if (ctx.away || now - (ctx.lastStepAt || 0) > FIELD.awayMs) return 'away';
  if ((doc.level || 1) < FIELD.minTrainerLevel) return 'new';
  if (inSafeGround(world.zone, p.x, p.z, FIELD.safeMargin)) return 'safe';
  const b = world.state.boss;
  if (b?.active && Math.hypot(b.x - p.x, b.z - p.z) < FIELD.bossClearR) return 'boss';
  return '';
}

// `d.prey` is the session key of the player it is on; `d.target` stays what the
// room's wander loop uses it for, the point it is walking to.
function setMood(w, d, mode, targetKey, targetId, until) {
  d.mode = mode; d.prey = targetKey || ''; d.until = until || 0;
  w.alert = mode === 'notice' || mode === 'chase' ? '!' : mode === 'lost' ? '?' : mode === 'flee' ? '~' : '';
  w.target = targetId || '';
}

/** Back to wandering. `rest` keeps it from starting on anyone for a while. */
export function calmWild(w, d, now, rest = 0) {
  if (!w || !d) return;
  setMood(w, d, '', '', '', 0);
  d.restUntil = Math.max(d.restUntil || 0, now + rest);
  d.next = 0;                     // pick a fresh wander target straight away
}

function giveUp(world, w, d, now) {
  const entry = world.player(d.prey);
  if (entry?.ctx) {
    entry.ctx.escapedUntil = now + FIELD.escapeMs;
    if (entry.ctx.chasedBy === w.id) entry.ctx.chasedBy = null;
  }
  setMood(w, d, 'lost', '', '', now + FIELD.lostMs);
  d.restUntil = now + FIELD.wildRestMs;
}

function step(world, w, tx, tz, dist, speed, dt, away = false) {
  if (!(dist > 1e-3)) return;
  const k = (away ? -1 : 1) * Math.min(dist, speed * dt) / dist;
  const dx = tx - w.x, dz = tz - w.z;
  const half = world.zone.size / 2 - 2;
  const nx = Math.max(-half, Math.min(half, w.x + dx * k)), nz = Math.max(-half, Math.min(half, w.z + dz * k));
  const p = resolveCollision(world.colliders, nx, nz, 0.5);
  w.x = p.x; w.z = p.z;
  w.rot = Math.atan2(dx * (away ? -1 : 1), dz * (away ? -1 : 1));
}

/**
 * One tick of the field. `world` is an adapter:
 *   zone, colliders, state (with .wilds and .boss), wildDocs,
 *   players()   → iterable of { key, p, doc, ctx }
 *   player(key) → one of those, or null
 *   engage(entry, wildId) → true if a battle is on its way
 * Wilds with a mood are moved here; the room's own wander loop skips them.
 */
export function tickField(world, now, dtMs) {
  const dt = Math.min(0.25, dtMs / 1000);
  const scan = now >= (world._fieldScanAt || 0);
  if (scan) world._fieldScanAt = now + FIELD.scanMs;
  const night = isNight(now);
  let people = null;   // built lazily: most ticks nothing needs it

  for (const [id, w] of world.state.wilds) {
    const d = world.wildDocs.get(id);
    if (!d || w.engagedBy) continue;

    if (d.mode === 'notice' || d.mode === 'chase') {
      const entry = world.player(d.prey);
      const why = entry ? unnoticeable(world, entry, now) : 'gone';
      // Losing sight of you to a door, a camp or your own calm ends it; the
      // chase itself having been what made you "busy" does not.
      if (why && why !== 'busy') { giveUp(world, w, d, now); continue; }
      const p = entry.p, dx = p.x - w.x, dz = p.z - w.z, dist = Math.hypot(dx, dz);
      if (d.mode === 'notice') {
        w.rot = Math.atan2(dx, dz);
        if (dist > FIELD.loseR) { giveUp(world, w, d, now); continue; }
        if (now >= d.until) setMood(w, d, 'chase', d.prey, w.target, now + FIELD.chaseMs);
        continue;
      }
      if (dist <= FIELD.catchR) {
        if (entry.ctx.chasedBy === id) entry.ctx.chasedBy = null;
        if (world.engage(entry, id)) { setMood(w, d, '', '', '', 0); continue; }
        giveUp(world, w, d, now); continue;
      }
      if (dist > FIELD.loseR || now >= d.until) { giveUp(world, w, d, now); continue; }
      step(world, w, p.x, p.z, dist - FIELD.catchR * 0.6, FIELD.chaseSpeed, dt);
      continue;
    }

    if (d.mode === 'flee') {
      const entry = world.player(d.prey);
      if (!entry?.p || now >= d.until) { calmWild(w, d, now, 3_000); continue; }
      const p = entry.p;
      step(world, w, p.x, p.z, Math.hypot(p.x - w.x, p.z - w.z) || 1, FIELD.fleeSpeed, dt, true);
      continue;
    }

    if (d.mode === 'lost') {
      if (now >= d.until) calmWild(w, d, now, 0);
      continue;
    }

    // Idle: look around, now and then.
    if (!scan || now < (d.restUntil || 0) || temperOf(w.species, night) !== 'fierce') continue;
    people ||= [...world.players()].filter((e) => !unnoticeable(world, e, now));
    let best = null, bestD = Infinity, bestStance = '';
    for (const entry of people) {
      const dist = Math.hypot(entry.p.x - w.x, entry.p.z - w.z);
      if (dist > FIELD.noticeR || dist >= bestD) continue;
      const stance = stanceToward(w.species, w.level, entry.doc);
      if (stance === 'kin' || stance === 'unarmed') continue;
      if (stance === 'flee' && dist > FIELD.fleeR) continue;
      // One pursuer at a time: a second one waits its turn — as long as the
      // first really is still on this player (it may have been fought, caught
      // or taken on by someone else since, none of which pass through here).
      if (stance === 'fight' && entry.ctx.chasedBy && entry.ctx.chasedBy !== id) {
        const other = world.wildDocs.get(entry.ctx.chasedBy);
        if (other && (other.mode === 'notice' || other.mode === 'chase') && other.prey === entry.key) continue;
        entry.ctx.chasedBy = null;
      }
      best = entry; bestD = dist; bestStance = stance;
    }
    if (!best) continue;
    if (bestStance === 'flee') { setMood(w, d, 'flee', best.key, '', now + FIELD.fleeMs); continue; }
    if (Math.random() > FIELD.noticeChance) continue;
    best.ctx.chasedBy = id;
    setMood(w, d, 'notice', best.key, best.p.id || best.doc.id, now + FIELD.alertMs);
    w.rot = Math.atan2(best.p.x - w.x, best.p.z - w.z);
  }
}
