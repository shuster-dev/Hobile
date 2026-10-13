// Milestones: the things a trainer does once and is given something for, the
// way the old side-scrollers hand you a weapon for a job done. Each is reached
// by what the doc already counts (stats, records, the dex), and pays:
//   `items`  — gear (or anything in the bag) given free;
//   `wear`   — something from the tailor's, given free;
//   `unlocks`— what the smith or the tailor will sell from now on (an item's
//              or a cosmetic's `unlock` names the milestone it waits on).
//
// Pure: the server checks and pays by it (server/game/milestones.js), the
// archive lists them and the shop shows a 🔒 with what it waits on.
import { ITEMS } from './gamedata.js';
import { cosmeticById } from './cosmetics.js';

const best = (doc) => Math.max(-1, ...Object.values(doc?.records?.dungeons || {}).map((k) => (Number.isFinite(k) ? k : -1)));
const st = (doc, k) => doc?.stats?.[k] || 0;

export const MILESTONES = [
  { id: 'first_blood', he: 'המכה הראשונה', desc: 'נצח יצור בשטח בנשק שלך', icon: '🗡',
    goal: 1, at: (d) => st(d, 'armKills'), items: ['potion_s', 'potion_s', 'sphere_basic', 'sphere_basic'] },
  { id: 'first_catch', he: 'השותף הראשון', desc: 'תפוס את היצור הראשון שלך', icon: '🔴',
    goal: 1, at: (d) => st(d, 'captures'), wear: ['trainer_red'] },
  { id: 'hunter_10', he: 'צייד מתחיל', desc: 'נצח 10 יצורים בשטח הפתוח', icon: '🏹',
    goal: 10, at: (d) => st(d, 'fieldKills'), items: ['bow_hunter'] },
  { id: 'arms_25', he: 'לוחם אמיתי', desc: 'נצח 25 יצורים בשטח בנשק שלך', icon: '⚔',
    goal: 25, at: (d) => st(d, 'armKills'), items: ['hammer_stone'] },
  { id: 'hunter_50', he: 'צייד ותיק', desc: 'נצח 50 יצורים בשטח הפתוח', icon: '🎯',
    goal: 50, at: (d) => st(d, 'fieldKills'), items: ['cloak_ranger'], unlocks: ['bow_wind'] },
  { id: 'collector_10', he: 'אספן', desc: 'תפוס 10 יצורים', icon: '📦',
    goal: 10, at: (d) => st(d, 'captures'), items: ['staff_oak'], wear: ['backpack'] },
  { id: 'dungeon_normal', he: 'סיבוב ראשון במבוך', desc: 'סיים מבוך ברמה רגילה', icon: '🕳',
    goal: 1, at: (d) => (best(d) >= 0 ? 1 : 0), items: ['vest_hide', 'charm_focus'], unlocks: ['wizard'] },
  { id: 'dungeon_hard', he: 'מבוך קשה', desc: 'סיים מבוך ברמה קשה', icon: '🔥',
    goal: 1, at: (d) => (best(d) >= 1 ? 1 : 0), items: ['charm_swift'], unlocks: ['blade_storm', 'vest_aegis', 'staff_star'] },
  { id: 'dungeon_mythic', he: 'כל שלוש הרמות', desc: 'סיים מבוך בכל 3 הרמות — רגיל, קשה ואגדי', icon: '💀',
    goal: 1, at: (d) => (best(d) >= 2 ? 1 : 0), items: ['hammer_titan', 'staff_rift'], unlocks: ['wings'] },
  { id: 'level_10', he: 'רמה 10', desc: 'הגע לרמת מאמן 10', icon: '⭐',
    goal: 10, at: (d) => d?.level || 1, items: ['blade_iron'] },
  { id: 'level_25', he: 'רמה 25', desc: 'הגע לרמת מאמן 25', icon: '🌟',
    goal: 25, at: (d) => d?.level || 1, items: ['ring_champion'], unlocks: ['crown'] },
  { id: 'tower_10', he: 'קומה 10', desc: 'טפס לקומה 10 במגדל', icon: '🗼',
    goal: 10, at: (d) => d?.records?.towerBest || 0, items: ['vest_wyrm'] },
];
export const MILESTONE = Object.fromEntries(MILESTONES.map((m) => [m.id, m]));

/** Reached ones (ids), as the doc keeps them. */
export const reached = (doc) => (Array.isArray(doc?.milestones) ? doc.milestones : []);

/** Whether a thing with an `unlock` may be bought yet. */
export function isUnlocked(doc, def) {
  return !def?.unlock || reached(doc).includes(def.unlock);
}

/** What the thing with `unlock` waits on, in words ("🔒 מבוך קשה"). */
export function lockText(def) {
  const m = def?.unlock && MILESTONE[def.unlock];
  return m ? `${m.icon} ${m.he}` : '';
}

/** Ones the doc has met and not yet been paid for. */
export function due(doc) {
  const have = reached(doc);
  return MILESTONES.filter((m) => !have.includes(m.id) && m.at(doc) >= m.goal);
}

/** Each, for the archive: how far, and what it pays. */
export function milestoneView(doc) {
  const have = reached(doc);
  return MILESTONES.map((m) => ({
    id: m.id, he: m.he, desc: m.desc, icon: m.icon, goal: m.goal,
    at: Math.min(m.goal, m.at(doc)), done: have.includes(m.id),
    items: (m.items || []).filter((id) => ITEMS[id]),
    wear: (m.wear || []).filter((id) => cosmeticById(id)),
    unlocks: m.unlocks || [],
  }));
}
