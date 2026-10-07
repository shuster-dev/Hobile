// Saddles, on the server (shared/saddles.js has the rules): a piece of the
// family's material for every win or catch, and the workbench that turns five
// of them and some gold into a saddle fitted on one creature.
import { SPECIES } from '../../shared/gamedata.js';
import { SADDLE, familyOf, familyRides, saddleCost } from '../../shared/saddles.js';
import { spend } from './economy.js';

const own = (o, k) => !!o && typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const mats = (doc) => (doc.mats && typeof doc.mats === 'object' ? doc.mats : (doc.mats = {}));

/**
 * Won against (or caught) one of `species`: a piece of its family's material,
 * if anyone of that family can ever carry a trainer. Returns what it came to.
 */
export function huntMaterial(doc, species) {
  if (!SPECIES[species]) return null;
  const root = familyOf(species);
  if (!familyRides(root)) return null;
  const m = mats(doc), had = m[root] || 0;
  if (had >= SADDLE.keep) return null;
  m[root] = had + 1;
  return { family: root, have: m[root], need: SADDLE.need };
}

/** Make a saddle and fit it on creature `uid`. Returns { ok, ... } or { error }. */
export function makeSaddle(doc, uid) {
  const c = own(doc.creatures, uid) ? doc.creatures[uid] : null;
  if (!c) return { error: 'no_creature' };
  if (c.saddle) return { error: 'already_saddled' };
  const cost = saddleCost(c.species, c.star || 1);
  if (!cost) return { error: 'cannot_ride' };
  const m = mats(doc);
  if ((m[cost.family] || 0) < cost.pieces) return { error: 'need_materials' };
  if ((doc.gold || 0) < cost.gold) return { error: 'not_enough_gold' };
  spend(doc, cost.gold, 'craft');
  m[cost.family] -= cost.pieces;
  c.saddle = true;
  return { ok: true, uid: c.uid, species: c.species, kind: cost.kind, family: cost.family };
}

/** A GM fits (or takes off) a saddle by hand. */
export function setSaddle(doc, uid, on = true) {
  const c = own(doc.creatures, uid) ? doc.creatures[uid] : null;
  if (!c) return { error: 'no_creature' };
  if (on && !saddleCost(c.species, c.star || 1)) return { error: 'cannot_ride' };
  const was = !!c.saddle;
  on ? c.saddle = true : delete c.saddle;
  return { ok: true, was, uid: c.uid, species: c.species };
}
