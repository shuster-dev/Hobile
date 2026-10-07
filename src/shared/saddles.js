// A saddle before a ride. A creature that is big enough to carry you
// (shared/riding.js `mountKind`) still needs a saddle made for its kind:
//
//   1. hunt its family — win against, or catch, any creature of its line (the
//      little one it grew from counts) — and each leaves one piece of material:
//      a hide, a feather, a scale;
//   2. with five pieces and some gold, the yard's workbench makes the saddle
//      and fits it on that creature (server/game/saddles.js);
//   3. then the ride button shows — a wing to fly, a wave to swim, a horse
//      to run.
//
// Shared: the server counts and checks by it, the client shows the progress.
import { SPECIES } from './gamedata.js';
import { mountKind } from './riding.js';

export const SADDLE = {
  need: 5,                                        // pieces of the family's material
  gold: { land: 1200, swim: 1800, fly: 2600 },    // the workbench's price
  keep: 99,                                       // most pieces held of one family
};

// who each species grew from
const PARENT = {};
for (const s of Object.values(SPECIES)) if (s.evolve?.into && SPECIES[s.evolve.into]) PARENT[s.evolve.into] = s.id;

/** The first of a species' line: the family its material is counted under. */
export function familyOf(species) {
  let s = species, n = 0;
  while (PARENT[s] && n++ < 8) s = PARENT[s];
  return s;
}

/** Every species in a family, smallest first. */
export function familyMembers(root) {
  const out = [];
  for (let s = root, n = 0; s && SPECIES[s] && n < 8; s = SPECIES[s].evolve?.into, n++) out.push(s);
  return out;
}

/** Could anyone in this family ever carry a trainer (at its best)? */
export function familyRides(root) {
  return familyMembers(root).some((s) => !!mountKind(s, 3));
}

/** How a family's pieces are called: what it would leave behind. */
export function materialName(root) {
  const kinds = familyMembers(root).map((s) => mountKind(s, 3)).filter(Boolean);
  const kind = kinds.at(-1) || 'land';
  const word = kind === 'fly' ? 'נוצה' : kind === 'swim' ? 'קשקש' : 'פרווה';
  return { word, he: `${word} של ${SPECIES[root]?.he || root}`, icon: kind === 'fly' ? '🪶' : kind === 'swim' ? '🐚' : '🧶' };
}

export function saddleCost(species, star = 1) {
  const kind = mountKind(species, star);
  return kind ? { kind, gold: SADDLE.gold[kind], pieces: SADDLE.need, family: familyOf(species) } : null;
}

/** The pieces a player holds, by family. */
export function materialsOf(doc) {
  const m = doc && typeof doc.mats === 'object' && doc.mats ? doc.mats : {};
  return m;
}
