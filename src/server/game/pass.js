// The season's track on the server (shared/pass.js): points as rewards are
// paid — every reward in the game goes through economy.earn, so that is where
// the track listens — and the tiers handed out when claimed.
import { REWARDS, addPoints, cannotClaim, passOf } from '../../shared/pass.js';
import { earn, onEarn } from './economy.js';
import { giveItem } from './combat.js';
import { grantCosmetic } from './cosmetics.js';

onEarn((doc, source) => addPoints(doc, source));

/** Claim tier `tier`: what it pays goes to the player. */
export function claimTier(doc, tier, now = Date.now()) {
  const why = cannotClaim(doc, tier, now);
  if (why) return { ok: false, reason: why };
  const r = REWARDS[tier - 1], p = passOf(doc, now);
  p.claimed.push(tier);
  r.gold && earn(doc, r.gold, 'pass');
  for (const [id, n] of r.items || []) giveItem(doc, id, n);
  r.cosmetic && grantCosmetic(doc, r.cosmetic);
  return { ok: true, tier, reward: r };
}
