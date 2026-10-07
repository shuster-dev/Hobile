// Where and when each wild is found.
//
// A zone's spawn rows (ZONES[z].spawns in gamedata.js) are
//   [species, weight]            anywhere a wild can stand, any time
//   [species, weight, how]       with `how` saying more:
//     at:   'grass' | 'water' | 'shore' | 'cliff' | 'forest' | 'lava' | 'ice'
//           the kind of ground it keeps to (the world plan says where that
//           is; a zone without any of it falls back to its open ground)
//     when: 'night' | 'day' | 'rain' | 'storm' | 'ash' | 'snow' | 'fog'
//           only then: it comes out when its hour comes and is gone when it
//           passes. Weather is the same pure function of the clock the sky
//           is drawn from (weather.js), so a player sees the rain and the
//           lamb that comes with it from the same millisecond.
//     herd: [min, max] how many come together
//
// Everything here is pure: the server picks with it, the client's species log
// reads it to say where a species lives, and the tests check both sides.
import { SPECIES, ZONES } from './gamedata.js';
import { isNight } from './temper.js';
import { WEATHER, weatherAt } from './weather.js';

export const HABITATS = {
  grass: { he: 'דשא גבוה', icon: '🌾' },
  water: { he: 'ליד המים', icon: '💧' },
  shore: { he: 'על החוף', icon: '🏖' },
  cliff: { he: 'בצוקים', icon: '⛰' },
  forest: { he: 'ביער', icon: '🌲' },
  lava: { he: 'ליד הלבה', icon: '🌋' },
  ice: { he: 'על הקרח', icon: '🧊' },
};

export const HOURS = {
  night: { he: 'רק בלילה', icon: '🌙' },
  day: { he: 'רק ביום', icon: '☀' },
  rain: { he: 'רק בגשם', icon: '🌧' },
  storm: { he: 'רק בסופה', icon: '⛈' },
  ash: { he: 'רק כשיורד אפר', icon: '🌋' },
  snow: { he: 'רק בשלג', icon: '❄' },
  fog: { he: 'רק בערפל', icon: '🌫' },
};

/** The `how` of a spawn row, never undefined. */
export const howOf = (row) => (row && typeof row[2] === 'object' && row[2]) || {};

/** Is it this row's hour in `zone` at server time `now`? */
export function inHour(row, zone, now = Date.now()) {
  const when = howOf(row).when;
  if (!when) return true;
  if (when === 'night') return isNight(now);
  if (when === 'day') return !isNight(now);
  if (!WEATHER[when]) return false;
  const sky = weatherAt(zone, now).id;
  // a storm is rain too, to anything that only wants the wet
  return sky === when || (when === 'rain' && sky === 'storm');
}

/** The rows of `zone` that can be met right now. */
export function spawnPool(zone, now = Date.now()) {
  return (zone?.spawns || []).filter((r) => SPECIES[r[0]] && inHour(r, zone, now));
}

/** The row this species has in this zone, if it lives there. */
export function rowFor(zone, species) {
  return (zone?.spawns || []).find((r) => r[0] === species) || null;
}

/** How many come together: one, or a herd's worth. */
export function herdSize(row, rnd = Math.random) {
  const h = howOf(row).herd;
  if (!Array.isArray(h)) return 1;
  const [a, b] = h;
  return a + Math.floor(rnd() * (b - a + 1));
}

/** A wild out of its hour leaves the field (unless someone is fighting it). */
export function outOfHour(zone, species, now = Date.now()) {
  const row = rowFor(zone, species);
  return !!row && !inHour(row, zone, now);
}

/**
 * Where a species is found, for the species log: one line per zone it lives
 * in, with the ground and the hour. Ordered by how early the zone comes.
 */
export function foundWhere(species) {
  const out = [];
  for (const z of Object.values(ZONES)) {
    if (z.capturable === false) continue;
    const row = rowFor(z, species);
    if (!row) continue;
    const how = howOf(row);
    const total = z.spawns.filter((r) => !howOf(r).when).reduce((a, r) => a + r[1], 0) || 1;
    out.push({
      zone: z.id, he: z.he, levels: z.levels,
      at: how.at || null, when: how.when || null,
      // a feel for it rather than a number: common, uncommon, rare
      often: how.when ? 'rare' : row[1] / total >= 0.12 ? 'common' : row[1] / total >= 0.05 ? 'uncommon' : 'rare',
    });
  }
  return out.sort((a, b) => a.levels[0] - b.levels[0]);
}

/** One line of Hebrew for the log: "אחו · ליד המים · 🌙 רק בלילה". */
export function whereLine(f) {
  const bits = [f.he];
  if (f.at && HABITATS[f.at]) bits.push(HABITATS[f.at].he);
  if (f.when && HOURS[f.when]) bits.push(`${HOURS[f.when].icon} ${HOURS[f.when].he}`);
  return bits.join(' · ');
}
