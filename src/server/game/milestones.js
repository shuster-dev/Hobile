// Paying the milestones a trainer has reached (shared/milestones.js): what
// they give goes into the bag or the wardrobe, and the doc remembers it was
// paid so nothing is paid twice. Called wherever something they count can
// change: a wild beaten in the open, a battle, a dungeon, a login.
import { due } from '../../shared/milestones.js';
import { giveItem } from './combat.js';
import { grantCosmetic } from './cosmetics.js';

/** Pays every one now due; returns what was paid, for the client to show. */
export function claimMilestones(doc) {
  if (!doc) return [];
  const out = [];
  for (const m of due(doc)) {
    (doc.milestones ||= []).push(m.id);
    for (const id of m.items || []) giveItem(doc, id, 1);
    for (const id of m.wear || []) grantCosmetic(doc, id);
    out.push({ id: m.id, he: m.he, icon: m.icon, items: m.items || [], wear: m.wear || [], unlocks: m.unlocks || [] });
  }
  return out;
}
