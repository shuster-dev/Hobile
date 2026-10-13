// What a quest wants, said plainly, and where to go for it.
//
// A quest's card says what it is ("Patrol the Frost Ridge — defeat 11
// creatures in the Frost Ridge"); it never said that the Frost Ridge is two
// portals from where you stand, or that "defeat" means walk into a wild one
// and win. Tapping a quest (ui.panelQuests) opens this: the steps, in order,
// and a button that puts the arrow, the radar's star and a beam of light on
// the way (game.js guideQuest / objectivePoint / world.setBeacon).
import { DUNGEONS, ITEMS, MATERIALS, SPECIES, ZONES } from '../shared/gamedata.js';
import { NPCS } from '../shared/npcs.js';
import { GIVERS } from '../shared/story.js';

const loc = (o) => o?.he || o?.name || '';
const zoneName = (id) => loc(ZONES[id]) || id;

// Where each townsperson stands: the landmark that is theirs (shared ZONES).
// Nurse Noga has no street to stand in — she is at the clinic's counter.
const GIVER_SPOT = Object.fromEntries(Object.values(GIVERS).filter((g) => g.where).map((g) => [g.id, g.where]));

/** The landmark a giver is found at, and its zone. */
export function giverSpot(giver) {
  for (const z of Object.values(ZONES)) {
    const l = z.landmarks.find((m) => m.npc === giver || (GIVER_SPOT[giver] && m.kind === GIVER_SPOT[giver]));
    if (l) return { zone: z.id, landmark: l };
  }
  return null;
}

/** The zone a dungeon's door is in (the first one, if it has two). */
export function dungeonZone(id) {
  for (const z of Object.values(ZONES)) if (z.landmarks.some((l) => l.kind === 'dungeon' && (!id || l.to === id))) return z.id;
  return null;
}

/**
 * The way from one zone to another through the portals: the list of zones
 * walked through, `from` first. Null when there is none.
 */
export function route(from, to) {
  if (!ZONES[from] || !ZONES[to]) return null;
  if (from === to) return [from];
  const prev = new Map([[from, null]]), queue = [from];
  while (queue.length) {
    const z = queue.shift();
    for (const l of ZONES[z].landmarks) {
      if (l.kind !== 'portal' || !ZONES[l.to] || prev.has(l.to)) continue;
      prev.set(l.to, z);
      if (l.to === to) {
        const path = [to];
        for (let p = z; p; p = prev.get(p)) path.unshift(p);
        return path;
      }
      queue.push(l.to);
    }
  }
  return null;
}

/** The zone a quest's goal sends you to, if it has one. */
export function goalZone(q, live) {
  const g = q.goal || {};
  if (live?.done && q.chain === 'npc') return giverSpot(q.giver)?.zone || null;
  if (g.kind === 'talk') return giverSpot(g.target)?.zone || null;
  if (g.kind === 'dungeon') return dungeonZone(g.target);
  if (g.kind === 'visit' || g.kind === 'craft' || g.kind === 'star' || g.kind === 'train' || g.kind === 'saddle') return g.zone || 'aetherport';
  if (g.kind === 'heal' || g.kind === 'deliver') return q.giver ? giverSpot(q.giver)?.zone || null : null;
  return g.zone || null;
}

const itemName = (id) => loc(ITEMS[id]) || loc(MATERIALS?.[id]) || id;
const npcName = (id) => loc(NPCS?.[id]) || loc(GIVERS?.[id]) || id;

/**
 * The steps, in Hebrew, for one quest as it stands for this player.
 * `here` is the zone they are in. Returns { steps: [string], zone, canGuide }.
 */
export function questGuide(q, live = {}, profile = {}, here = null) {
  const g = q.goal || {}, need = g.count || 1, have = Math.min(live.progress || 0, need), left = Math.max(0, need - have);
  const zone = goalZone(q, live), steps = [];
  const way = (z) => {
    if (!z || !here || z === here) return;
    const r = route(here, z);
    if (!r) return steps.push(`לך אל ${zoneName(z)}.`);
    steps.push(r.length === 2
      ? `לך אל ${zoneName(z)} — דרך השער (הפורטל) שבאזור שלך.`
      : `לך אל ${zoneName(z)}: ${r.slice(1).map(zoneName).join(' ← ')} (שער אחרי שער).`);
  };

  if (live.claimed) return { steps: ['המשימה הושלמה והפרס נאסף.'], zone: null, canGuide: false };
  if (live.done) {
    if (q.chain === 'npc') {
      const at = giverSpot(q.giver);
      way(at?.zone);
      steps.push(`חזור אל ${npcName(q.giver)}${at?.landmark?.kind === 'clinic' ? ' במרפאה' : ''} — גש ולחץ על כפתור הפעולה כדי לקבל את הפרס.`);
      return { steps, zone: at?.zone || null, canGuide: true };
    }
    return { steps: ['המשימה הושלמה, והפרס כבר אצלך.'], zone: null, canGuide: false };
  }

  const where = g.zone ? ` ב${zoneName(g.zone)}` : '';
  switch (g.kind) {
    case 'defeat':
      way(g.zone);
      steps.push(`הסתובב${where} ומצא יצורי בר — הם מסתובבים בשטח, ויש סימן אדום שלהם במכ״ם.`);
      steps.push('גש אל יצור והתחל קרב (כפתור הפעולה), ונצח אותו. כל ניצחון נספר.');
      steps.push(`נשארו עוד ${left} מתוך ${need}.`);
      break;
    case 'capture':
      way(g.zone);
      steps.push(g.species
        ? `מצא${where} ${loc(SPECIES[g.species]) || g.species} בר.`
        : `מצא${where} יצור בר שאין לך עדיין${g.zone ? '' : ' (בכל אזור)'}.`);
      steps.push('בקרב, הורד לו חיים — ככל שהורדת יותר, הסיכוי גבוה יותר — וזרוק כדור (🔵).');
      steps.push(`נשארו עוד ${left} מתוך ${need}. צריך כדורים? יש בחנות של נמל האתר.`);
      break;
    case 'talk':
      way(goalZone(q, live));
      steps.push(`מצא את ${npcName(g.target)} — יש סימן מעל הראש — גש ולחץ על כפתור הפעולה כדי לדבר.`);
      break;
    case 'visit':
      way(g.zone);
      steps.push(`לך אל ${g.target === 'base' ? 'הבסיס שלך' : g.target} בנמל האתר והיכנס.`);
      break;
    case 'craft':
      way('aetherport');
      steps.push('לך לבסיס שלך בנמל האתר, פתח את הסדנה ובחר מה לייצר.');
      steps.push(`נשארו עוד ${left} מתוך ${need}. חסרים חומרים? מקבלים אותם מקרבות.`);
      break;
    case 'star':
    case 'train':
      way('aetherport');
      steps.push(`לך לבסיס שלך ושים יצור בתא האימון כדי לשדרג אותו ל-★${g.star || 2}.`);
      steps.push('האימון לוקח זמן — אפשר להמשיך לשחק בינתיים ולחזור לאסוף.');
      break;
    case 'saddle':
      way('aetherport');
      steps.push('לך לבסיס, לחצר: שם מכינים אוכף ליצור שאפשר לרכוב עליו.');
      break;
    case 'dungeon': {
      const dz = dungeonZone(g.target);
      way(dz);
      steps.push(`מצא את הכניסה ל${loc(DUNGEONS[g.target]) || 'מבוך'}${dz ? ` ב${zoneName(dz)}` : ''} והיכנס.`);
      steps.push('נקה את כל הקומות עד הסוף. כדאי להיכנס עם צוות מרופא, ואפשר גם עם קבוצה.');
      break;
    }
    case 'boss':
      steps.push('בוס עולמי מופיע מדי פעם באחד האזורים — תקבל הודעה כשהוא מופיע, והוא מסומן ☠ במכ״ם.');
      steps.push('לך אליו ותקוף אותו יחד עם שאר השחקנים. מספיק לתרום נזק.');
      break;
    case 'heal':
      way(goalZone(q, live));
      steps.push('לך למרפאה בנמל האתר ותן לאחות נוגה לרפא את הצוות — או נוח במעיין של מחנה באחד האזורים.');
      break;
    case 'deliver': {
      const owned = profile?.inventory?.[g.item] || 0;
      steps.push(`אסוף ${need} ${itemName(g.item)} — יש לך ${Math.min(owned, need)}. ${q.descHe?.includes('(') ? q.descHe.slice(q.descHe.indexOf('(')) : 'מקבלים אותם מקרבות ומלכידות.'}`);
      way(goalZone(q, live));
      steps.push(`הבא אותם אל ${npcName(q.giver)} — גש ולחץ על כפתור הפעולה.`);
      break;
    }
    case 'level':
      steps.push(`הגע לרמת מאמן ${need} — כל קרב, לכידה ומשימה נותנים XP.`);
      break;
    case 'dex':
      steps.push(`תפוס ${need} סוגי יצורים שונים (יש לך ${have}). כל אזור מביא יצורים אחרים — נסה אזור חדש.`);
      break;
    case 'grow':
      steps.push('צא עם השותף שלך לקרבות — ברחובות העיר יש יצורים קטנים. כל ניצחון נותן לו ניסיון.');
      steps.push('כשהוא עולה רמה, השלב הזה נגמר מעצמו.');
      break;
    case 'claim': {
      const zq = q.goal.target && q.goal.zone;
      way(zq);
      steps.push(`כשתיכנס ל${zoneName(q.goal.zone)} ייפתחו המשימות שלו: סיור (לנצח יצורים) ולכידה מקומית.`);
      steps.push('השלם את שתיהן — הן מופיעות ברשימת המשימות, והפרס מגיע מעצמו.');
      break;
    }
    case 'anchor':
      steps.push('מצא את העוגנים של הקרע (מסומנים 🌀) — אחד בכל אחד מכמה אזורים — ונפץ אותם.');
      steps.push(`נשארו עוד ${left} מתוך ${need}.`);
      break;
    case 'story':
      way(goalZone(q, live) || 'aetherport');
      steps.push('לך אל לב הקרע ליד המזח בנמל האתר והתעמת.');
      break;
    default:
      steps.push(q.descHe || q.desc || '');
  }
  // the journey's own plain line first (shared/journey.js)
  q.hint && steps.unshift(`${q.hint}.`);
  return { steps: steps.filter(Boolean), zone, canGuide: !['level', 'dex', 'grow'].includes(g.kind) };
}
