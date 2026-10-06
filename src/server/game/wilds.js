// The wild ones in a field zone: who comes out, where, in what numbers, how
// they wander, and when the rare ones go home. Shared by both drivers, like
// field.js: WorldRoom (online) and WorldSim (the single-player build) each
// describe themselves through a small adapter —
//   zone, colliders, state.wilds (Map), wildDocs (Map),
//   spawn(species, level, at) → id     the driver's own way of adding one
// — and call tickWilds() every tick.
//
// What changed with the planned zones (shared/worldplan.js, habitats.js):
//   - a species comes out on its own ground (a seal on the ice, a crab on
//     the beach, a salamander by the lava) and the rest keep mostly to the
//     tall grass;
//   - the ones that live in herds come out together and keep together;
//   - a wild wanders round where it came out, not across the whole zone —
//     so it is still on its ground when you get there, and nothing walks
//     into a river trying to reach the other side;
//   - one that only comes out in its hour (the night, the rain) is gone when
//     the hour is over, unless someone is fighting it;
//   - a bigger zone keeps more of them.
import { randomLevel } from '../../shared/gamedata.js';
import { herdSize, howOf, outOfHour, spawnPool } from '../../shared/habitats.js';
import { fieldPoint, planFor, standable, stepWithin, wildTarget } from '../../shared/worldplan.js';

export const WILDS = {
  roam: 9,          // metres a wild wanders from where it came out
  herdRoam: 6,      // and a herd, from its middle
  speed: 1.6,       // m/s, an amble
  checkHourMs: 2000,
};

/** One row of the pool, by weight. */
function pickRow(pool, rnd) {
  let total = 0;
  for (const r of pool) total += r[1];
  let n = rnd() * total;
  for (const r of pool) if ((n -= r[1]) <= 0) return r;
  return pool[pool.length - 1];
}

/** A spot near `at` for the next one of a herd, or null. */
function besideOf(world, at, rnd) {
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, d = 2.2 + rnd() * 3.2;
    const x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d;
    if (standable(world.zone, world.colliders, x, z, 0.9)) return { x, z };
  }
  return null;
}

/** Bring out one group: a species that can be met now, on its ground, alone
 *  or with its herd. Returns how many came. */
export function spawnGroup(world, now = Date.now(), rnd = Math.random, room = Infinity) {
  const pool = spawnPool(world.zone, now);
  if (!pool.length || room < 1) return 0;
  const row = pickRow(pool, rnd), how = howOf(row);
  const at = fieldPoint(world.zone, world.colliders, rnd, how.at || null);
  if (!at) return 0;
  const n = Math.min(room, herdSize(row, rnd));
  let made = 0;
  for (let k = 0; k < n; k++) {
    const p = k === 0 ? at : besideOf(world, at, rnd);
    if (!p) continue;
    const id = world.spawn(row[0], randomLevel(world.zone.id, rnd), p);
    const d = world.wildDocs.get(id);
    if (d) { d.home = { x: at.x, z: at.z }; d.roam = n > 1 ? WILDS.herdRoam : WILDS.roam; d.hour = how.when || ''; }
    made++;
  }
  return made;
}

/** Keep the zone stocked up to its target. */
export function populate(world, now = Date.now(), rnd = Math.random) {
  const target = world.target ?? wildTarget(world.zone);
  for (let guard = 0; guard < 40 && world.state.wilds.size < target; guard++) {
    if (!spawnGroup(world, now, rnd, target - world.state.wilds.size)) break;
  }
}

/** The idle ones amble about where they came out. */
export function wander(world, now, dtMs, rnd = Math.random) {
  const dt = Math.min(0.25, dtMs / 1000);
  for (const [id, w] of world.state.wilds) {
    const d = world.wildDocs.get(id);
    if (!d || w.engagedBy || d.mode) continue;
    if (d.summonedUntil && now > d.summonedUntil) { world.state.wilds.delete(id); world.wildDocs.delete(id); continue; }
    if (now >= (d.next || 0)) {
      const home = d.home || { x: w.x, z: w.z }, R = d.home ? (d.roam ?? WILDS.roam) : 4;
      let t = null;
      for (let i = 0; i < 6 && !t; i++) {
        const a = rnd() * Math.PI * 2, r = 1 + rnd() * R;
        const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
        if (standable(world.zone, world.colliders, x, z, 0.6)) t = { x, z };
      }
      d.target = t || { x: w.x, z: w.z };
      d.next = now + 4000 + rnd() * 6000;
    }
    const dx = d.target.x - w.x, dz = d.target.z - w.z, dist = Math.hypot(dx, dz);
    if (dist > 0.3) {
      const step = Math.min(dist, WILDS.speed * dt);
      const p = stepWithin(world.zone, world.colliders, w.x, w.z, w.x + dx / dist * step, w.z + dz / dist * step, 0.5);
      if (Math.hypot(p.x - w.x, p.z - w.z) < step * 0.2) d.next = 0;   // stuck: choose again
      w.x = p.x; w.z = p.z; w.rot = Math.atan2(dx, dz);
    }
  }
}

/** The rare ones keep their hours: when it stops raining, the rain lamb goes. */
export function departures(world, now) {
  if (now < (world._hourCheckAt || 0)) return 0;
  world._hourCheckAt = now + WILDS.checkHourMs;
  let gone = 0;
  for (const [id, w] of world.state.wilds) {
    const d = world.wildDocs.get(id);
    if (!d || w.engagedBy || d.summonedUntil || !d.hour) continue;
    if (outOfHour(world.zone, w.species, now)) { world.state.wilds.delete(id); world.wildDocs.delete(id); gone++; }
  }
  return gone;
}

/** Everything above, once a tick. */
export function tickWilds(world, now, dtMs, rnd = Math.random) {
  departures(world, now);
  wander(world, now, dtMs, rnd);
  populate(world, now, rnd);
}

export { planFor };
