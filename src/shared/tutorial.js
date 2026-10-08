// The first ten minutes (checklist c1): a guide that points rather than
// explains. Seven small things, each said in one line with a hand or a ring on
// the thing to touch, each done by doing it — walk, turn the camera, talk to
// someone, take on a wild creature, use a move, throw a sphere, open the base.
// They can come in any order (a creature that jumps you in the first minute
// is the fight step done early); the guide shows the first one still to do
// that fits where you are. "Skip" ends it.
//
// Shared: the client's coach (client/coach.js) draws it, the server keeps
// which steps are done on the document (world-messages "tutorial"), pays the
// little gift at the end once, and the metrics count how far people got.
export const TUTORIAL = [
  { id: 'move', mode: 'world', he: 'גרור את האגודל השמאלי כדי ללכת', icon: '👣' },
  { id: 'look', mode: 'world', he: 'גרור עם אצבע בצד ימין כדי לסובב את המצלמה', icon: '🔄' },
  { id: 'talk', mode: 'world', he: 'לך אחרי החץ ודבר עם מי שמחכה לך — כשאתה לידו לחץ "דבר"', icon: '💬' },
  { id: 'fight', mode: 'world', he: 'יצור פראי! גש אליו ולחץ "קרב"', icon: '⚔️' },
  { id: 'attack', mode: 'battle', he: 'לחץ על מהלך כדי לתקוף', icon: '✊' },
  { id: 'capture', mode: 'battle', he: 'כשהחיים שלו בצהוב או באדום — "זרוק כדור" כדי ללכוד אותו', icon: '🔵' },
  { id: 'base', mode: 'world', he: 'הבסיס שלך: אימון, ייצור ובנייה — פתח אותו', icon: '🏕' },
];
export const TUTORIAL_IDS = TUTORIAL.map((s) => s.id);

/** What finishing the guide pays, once. */
export const TUTORIAL_GIFT = { gold: 300, items: [['sphere_basic', 5], ['potion_s', 3]] };

/** The guide's state on a document, made whole. */
export function tutorialOf(doc) {
  const t = doc.tutorial && typeof doc.tutorial === 'object' ? doc.tutorial : (doc.tutorial = { steps: [] });
  Array.isArray(t.steps) || (t.steps = []);
  return t;
}

/** The next step to show, for where the player is ('world' | 'battle'), or null. */
export function nextStep(tut, mode) {
  if (!tut || tut.done || tut.skipped) return null;
  const done = new Set(tut.steps || []);
  return TUTORIAL.find((s) => !done.has(s.id) && s.mode === mode) || null;
}

export const tutorialFinished = (tut) => !!tut && TUTORIAL_IDS.every((id) => (tut.steps || []).includes(id));
