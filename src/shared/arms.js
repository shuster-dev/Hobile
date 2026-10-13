// What a trainer fights with when they fight themselves: a sword, a hammer,
// a bow or a staff. Every weapon (ITEMS, slot `weapon`) is one of these four
// kinds (`arm`), and has its own power on top of the stats it gives.
//
// In the open (server/game/field-fight.js armStrike) a trainer hits a wild
// with what is in their hand — the one circle that shows when a wild is near
// (client ui.js syncCluster). In a battle the trainer's Strike is the same
// weapon (combat.js trainer actions), so it is how a trainer with nobody yet
// catches their first.
//
// Pure: the server reaches and hurts by it, the client swings and shows it.
import { ITEMS } from './gamedata.js';

/**
 * `reach` metres, `cdMs` between two swings, `kind` physical or special (the
 * staff: by spa, against spd), `clip` the figure's move (gfx/heroes.js),
 * `fx` what flies or flashes (gfx/world.js strike).
 */
export const ARMS = {
  sword: { id: 'sword', he: 'חרב', icon: '🗡', reach: 4.2, cdMs: 650, kind: 'physical', clip: 'swing', fx: 'slash' },
  hammer: { id: 'hammer', he: 'פטיש', icon: '🔨', reach: 4.0, cdMs: 1150, kind: 'physical', clip: 'smash', fx: 'smash' },
  bow: { id: 'bow', he: 'קשת', icon: '🏹', reach: 10, cdMs: 900, kind: 'physical', clip: 'shoot', fx: 'arrow' },
  staff: { id: 'staff', he: 'מקל קסמים', icon: '🪄', reach: 9, cdMs: 1000, kind: 'special', clip: 'cast', fx: 'bolt' },
};

/** Bare hands: what a trainer with nothing in them still has. */
export const FISTS = { id: 'fists', arm: 'sword', power: 18, he: 'אגרופים', icon: '👊' };

/** The weapon in a doc's hand, as { item, arm, power, reach, cdMs, kind, ... }. */
export function armOf(doc) {
  const id = doc?.gear?.weapon;
  const it = id && ITEMS[id]?.slot === 'weapon' ? ITEMS[id] : FISTS;
  const a = ARMS[it.arm] || ARMS.sword;
  return { ...a, item: it === FISTS ? null : it.id, he: it.he, power: it.power || FISTS.power, icon: a.icon, fists: it === FISTS };
}

/** The trainer's fighting stats, as a battle counts them (combat.js
 *  Combatant, trainer kind), from their level and what they wear. */
export function trainerStats(level = 1, gear = {}, hpBase = 0) {
  const n = (v) => (Number.isFinite(v) ? v : 0), L = Math.max(1, level);
  return {
    hp: hpBase + Math.max(0, n(gear.hp)),
    atk: 10 + L * 2 + n(gear.atk),
    def: 10 + L * 2 + n(gear.def),
    spa: 10 + L * 2 + n(gear.spa),
    spd: 10 + L * 2 + n(gear.spd),
    spe: 10 + L + n(gear.spe),
  };
}
