// Playing with the creature that walks beside you: throw it a ball, pet it,
// toss it a treat. Nothing here changes a number — it is the reason to keep a
// favourite out, and something to do while waiting for a friend.
//
// Shared: the client draws the buttons from it and plays the scene
// (client/gfx/pettricks.js); the server checks the id and how often, then
// tells the room, so everyone standing near sees your creature fetch.
import { SPECIES } from './gamedata.js';

export const TRICKS = {
  fetch: { id: 'fetch', he: 'זרוק כדור', icon: '🎾', ms: 4200 },
  pet: { id: 'pet', he: 'ליטוף', icon: '❤️', ms: 2600 },
  treat: { id: 'treat', he: 'חטיף', icon: '🍖', ms: 3200 },
};
export const TRICK_IDS = Object.keys(TRICKS);

/** The least time between two tricks from one player (the server's rule). */
export const TRICK_GAP_MS = 1200;

/**
 * How this creature plays: a bird catches the ball in the air, one of the
 * water brings it back with a splash, anything else runs for it.
 */
export function trickStyle(species) {
  const s = SPECIES[species], shape = s?.model?.shape, t = s?.types || [];
  if (shape === 'avian' || (shape === 'serpent' && (t[0] === 'gale' || t[0] === 'lumen'))) return 'fly';
  if (t[0] === 'aqua' && (shape === 'serpent' || shape === 'blob')) return 'swim';
  return 'walk';
}
