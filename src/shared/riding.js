// Riding: a grown creature can carry its trainer — over land faster than a
// run, through the water where nobody can walk, or up into the air over
// everything. Which creature can carry you, and how, is in its body and its
// element; the server and the client both read it here.
import { SPECIES } from './gamedata.js';

export const RIDE = {
  land: { speed: 1.75, he: 'רכיבה', icon: '🐎' },
  swim: { speed: 1.5, he: 'שחייה', icon: '🌊' },
  fly: { speed: 2.1, he: 'תעופה', icon: '🪽', lift: 2.8 },
};

/** Small ones carry nobody; a third star makes even a small one strong enough. */
const BIG = new Set(['evolved', 'final', 'rare', 'legendary']);

/**
 * How this creature carries a trainer: 'fly', 'swim', 'land', or null.
 * Birds fly; a serpent of the sky or the light flies; a creature of the
 * water swims; anything four-legged or built like a golem walks.
 */
export function mountKind(species, star = 1) {
  const s = SPECIES[species];
  if (!s || s.rarity === 'boss') return null;
  if (!BIG.has(s.rarity) && star < 3) return null;
  const shape = s.model?.shape, t = s.types || [];
  if (shape === 'avian') return 'fly';
  if (shape === 'serpent' && (t[0] === 'gale' || t[0] === 'lumen' || t[1] === 'gale')) return 'fly';
  if (t.includes('aqua') && (shape === 'serpent' || shape === 'quad' || shape === 'blob')) return 'swim';
  if (shape === 'quad' || shape === 'golem') return 'land';
  return null;
}

/** The creatures in a team that can be ridden, best first (air, water, land). */
export function mountsOf(team = []) {
  const rank = { fly: 0, swim: 1, land: 2 };
  return team.filter(Boolean).map((c) => ({ uid: c.uid, species: c.species, star: c.star || 1, kind: mountKind(c.species, c.star || 1) }))
    .filter((m) => m.kind).sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** What `stepWithin` should let a body cross, for how it is travelling. */
export const moveMode = (kind) => (kind === 'fly' ? 'fly' : kind === 'swim' ? 'swim' : 'walk');
