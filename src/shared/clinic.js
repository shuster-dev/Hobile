// A clinic's ward: a creature that fainted is brought in, stays a while to
// get better, and is collected — in person, at that clinic — whole again.
// While it is there it walks about the clinic's room (client gfx/world.js),
// and a small meter under the vitals says who is in and how long is left.
//
// Pure: the server admits and discharges by it (world-messages.js), the
// client counts down by it.
import { clinicCost } from './gamedata.js';

export const CLINIC = { stayMs: 5 * 60 * 1000 };

/** The team's creatures that are down and not already in a clinic's care. */
export const toAdmit = (team = []) => team.filter((c) => c && c.hp <= 0 && !c.ward);

/** What bringing them in costs. */
export const admitCost = (team = []) => {
  const down = toAdmit(team);
  return down.length ? clinicCost(down) : 0;
};

/** Everyone in care, with how long is left (0: ready to collect). */
export function inCare(team = [], now = Date.now()) {
  return team.filter((c) => c?.ward).map((c) => ({ c, left: Math.max(0, c.ward.until - now), place: c.ward.place, he: c.ward.he }));
}
