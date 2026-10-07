// The tailor (shared/cosmetics.js): buying a hat or a dye with gold, wearing
// it, taking it off. What is worn is kept apart from the appearance the
// character was made with (doc.cosmetics), so nothing can be put on that was
// not bought — and the room state carries it, so everyone sees it.
import { cosmeticById, wardrobeOf } from '../../shared/cosmetics.js';
import { spend } from './economy.js';

export function buyCosmetic(doc, id) {
  const c = cosmeticById(id);
  if (!c) return { ok: false, reason: 'no_such_item' };
  const w = wardrobeOf(doc);
  if (w.owned.includes(id)) return { ok: false, reason: 'already_owned' };
  if (c.pass || !(c.price > 0)) return { ok: false, reason: 'not_for_sale' };
  if ((doc.gold || 0) < c.price) return { ok: false, reason: 'not_enough_gold' };
  spend(doc, c.price, 'cosmetic');
  doc.cosmetics = { ...w, owned: [...w.owned, id] };
  return { ok: true, id, slot: c.slot };
}

/** Earned, not bought (the season's track): it is simply yours. */
export function grantCosmetic(doc, id) {
  const c = cosmeticById(id);
  if (!c) return false;
  const w = wardrobeOf(doc);
  if (!w.owned.includes(id)) doc.cosmetics = { ...w, owned: [...w.owned, id] };
  return true;
}

/** Wear `id` in `slot`, or take off what is there (`id` null). */
export function wearCosmetic(doc, slot, id) {
  if (slot !== 'hat' && slot !== 'dye') return { ok: false, reason: 'bad_slot' };
  const w = wardrobeOf(doc);
  if (id != null) {
    const c = cosmeticById(id);
    if (!c || c.slot !== slot) return { ok: false, reason: 'bad_slot' };
    if (!w.owned.includes(id)) return { ok: false, reason: 'not_owned' };
  }
  doc.cosmetics = { ...w, [slot]: id ?? null };
  return { ok: true, slot, id: id ?? null };
}
