// The end of the main story, on the server (shared/saga.js has the story).
//
// Two kinds of fight the story starts itself: an anchor's guardian, in the
// zone the anchor is in, and Tehomon on the pier. Either is only there while
// the step that asks for it is open, and only where it stands; the foe is a
// boss of its level (no sphere takes it), and winning breaks the anchor or
// ends the fight for the rift. Which scenes a player has already watched is
// kept too, so a scene plays once on whichever device they are on.
import { ANCHORS, ANCHOR_REACH, FINALE, SCENES, STORY_FOE, anchorById } from '../../shared/saga.js';
import { syncQuests } from './combat.js';

/** The player's story state: scenes seen, anchors broken. */
export function storyOf(doc) {
  const s = doc.story && typeof doc.story === 'object' ? doc.story : (doc.story = {});
  Array.isArray(s.seen) || (s.seen = []);
  Array.isArray(s.anchors) || (s.anchors = []);
  return s;
}

/** What the client needs: what was seen, what is broken. */
export function storyView(doc) {
  const s = storyOf(doc);
  return { seen: [...s.seen], anchors: [...s.anchors] };
}

/** A scene watched (or skipped): it does not play again. */
export function sceneSeen(doc, id) {
  if (typeof id !== 'string' || !SCENES[id]) return false;
  const s = storyOf(doc);
  s.seen.includes(id) || s.seen.push(id);
  return true;
}

const open = (doc, qid) => { const q = doc.quests?.active?.[qid]; return !!q && !q.done && !q.claimed; };

/**
 * The fight a story spot holds for this player here and now, or why not.
 * `id` is an anchor's id or 'finale'; `at` is where the player stands.
 */
export function storyFoe(doc, id, zoneId, at) {
  if (id === FINALE.id) {
    if (!open(doc, 'q_main_15')) return { error: 'not_now' };
    if (zoneId !== FINALE.zone) return { error: 'not_here' };
    if (!at || Math.hypot(at.x - FINALE.x, at.z - FINALE.z) > FINALE.reach) return { error: 'too_far' };
    return { foe: { ...FINALE.foe, story: id, hpScale: STORY_FOE.finaleHp, scale: STORY_FOE.finaleScale } };
  }
  const a = anchorById(id);
  if (!a) return { error: 'not_here' };
  if (!open(doc, 'q_main_13')) return { error: 'not_now' };
  if (storyOf(doc).anchors.includes(a.id)) return { error: 'anchor_broken' };
  if (zoneId !== a.zone) return { error: 'not_here' };
  if (!at || Math.hypot(at.x - a.x, at.z - a.z) > ANCHOR_REACH) return { error: 'too_far' };
  return { foe: { ...a.guardian, story: id, hpScale: STORY_FOE.hpScale, scale: STORY_FOE.scale } };
}

/** Won a story fight: the anchor breaks (or the rift's guardian falls). */
export function storyWin(doc, id) {
  if (id === FINALE.id) return open(doc, 'q_main_15') ? syncQuests(doc, { kind: 'story', target: FINALE.id }) : [];
  const a = anchorById(id), s = storyOf(doc);
  if (!a || s.anchors.includes(a.id) || !open(doc, 'q_main_13')) return [];
  s.anchors.push(a.id);
  return syncQuests(doc, { kind: 'anchor', target: a.id });
}

export { ANCHORS };
