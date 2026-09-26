// Which wilds would come for you: the pure half of server/game/field.js.
//
// Shared so the client can say it before the server acts on it — a wild's
// nameplate carries a ⚔ when it would — and so the two cannot disagree.
import { SPECIES, TEMPER, WILD_TIERS } from './gamedata.js';
import { DAY_MS } from './weather.js';

/** Levels below your companion at which a fierce wild runs instead. */
export const WEAK_GAP = 6;

/** Below this trainer level nothing comes for you: the first fights are yours
 *  to pick. */
export const FIELD_FROM_LEVEL = 3;

/** The same night the sky and the NPCs keep. */
export function isNight(now = Date.now()) {
  const phase = (now % DAY_MS / DAY_MS + 1) % 1;
  return phase < 0.15 || phase > 0.78;
}

export function temperOf(species, night = false) {
  const t = Object.prototype.hasOwnProperty.call(TEMPER, species) ? TEMPER[species] : null;
  return t === 'fierce' || (t === 'nocturnal' && night) ? 'fierce' : 'calm';
}

/**
 * How a fierce wild of this species and level takes a trainer whose creature
 * at their side is `lead`, in a zone that lets it pick on something at most
 * `maxAbove` levels below it:
 *   'kin'      shares an element with it; leaves you be
 *   'unarmed'  nothing of yours can fight; it has no quarrel with you
 *   'flee'     far weaker than it; runs
 *   'spare'    far stronger, in a zone for learning (WILD_TIERS ambushAbove):
 *              a new trainer is not jumped by a fight they cannot win
 *   'fight'    comes for you
 */
export function stanceOfLead(species, level, lead, maxAbove = Infinity) {
  if (!lead || !(lead.hp > 0)) return 'unarmed';
  const mine = SPECIES[lead.species]?.types || [];
  if ((SPECIES[species]?.types || []).some((t) => mine.includes(t))) return 'kin';
  if ((lead.level || 1) - (level || 1) >= WEAK_GAP) return 'flee';
  if ((level || 1) - (lead.level || 1) > maxAbove) return 'spare';
  return 'fight';
}

/** The most levels a fierce wild in this zone may have over your companion
 *  and still come for you. */
export function ambushAbove(zoneId) {
  const t = WILD_TIERS[zoneId]?.ambushAbove;
  return Number.isFinite(t) ? t : Infinity;
}
