// Riding: any creature can carry its trainer once it wears a saddle
// (shared/saddles.js) — over land faster than a run, through the water where
// nobody can walk, or up into the air over everything. How it carries you is
// in its body and its element; a small one is made big enough to carry you
// while you ride (client gfx/world.js setMount). The server and the client
// both read it here. (Meir, 12.10: "every creature can be ridden".)
import { SPECIES } from './gamedata.js';

export const RIDE = {
  land: { speed: 1.75, he: 'רכיבה', icon: '🐎' },
  swim: { speed: 1.5, he: 'שחייה', icon: '🌊' },
  fly: { speed: 2.5, he: 'תעופה', icon: '🪽', lift: 0 },
};

/**
 * How this creature carries a trainer: 'fly', 'swim' or 'land' — every
 * creature but a boss carries one. Anything with wings flies (the birds, the
 * moths and the beetles), and so does anything of the wind, a serpent of the
 * sky or the light, and the ghosts that float; a creature of the water swims;
 * the rest walk. (`star` is kept for callers; it no longer decides.)
 */
export function mountKind(species, star = 1) {
  const s = SPECIES[species];
  if (!s || s.rarity === 'boss') return null;
  const shape = s.model?.shape, t = s.types || [];
  if (shape === 'avian' || shape === 'insect') return 'fly';
  if (t[0] === 'gale') return 'fly';
  if (shape === 'serpent' && (t[0] === 'lumen' || t[1] === 'gale')) return 'fly';
  if (t[0] === 'umbra' && (shape === 'blob' || shape === 'sprite')) return 'fly';
  if (t.includes('aqua')) return 'swim';
  return 'land';
}

/** The creatures in a team that can be ridden — big enough, and wearing a
 *  saddle (shared/saddles.js) — best first (air, water, land). */
export function mountsOf(team = []) {
  const rank = { fly: 0, swim: 1, land: 2 };
  return team.filter((c) => c && c.saddle).map((c) => ({ uid: c.uid, species: c.species, star: c.star || 1, kind: mountKind(c.species, c.star || 1) }))
    .filter((m) => m.kind).sort((a, b) => rank[a.kind] - rank[b.kind]);
}

/** Big enough to carry you, but no saddle yet: what the workbench is for. */
export function saddleWanted(team = []) {
  return team.filter((c) => c && !c.saddle && mountKind(c.species, c.star || 1));
}

/** What `stepWithin` should let a body cross, for how it is travelling. */
export const moveMode = (kind) => (kind === 'fly' ? 'fly' : kind === 'swim' ? 'swim' : 'walk');
