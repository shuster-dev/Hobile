// The rest of the main story: what is behind the rift, who is pulling it
// open, and how it closes.
//
// The first ten steps of the main chain (gamedata.js QUESTS q_main_01..10)
// end with something enormous falling through the rift. These six go on from
// there: a voice in the rift, Maro's old student Vesper and her Hollow Order,
// three anchors she drove into the world to hold the rift open, her keep, and
// the guardian she chained and dragged through — Tehomon — fought on the pier
// under a sky torn wide. Then the rift closes, and the sky over the port is
// quiet for the first time in years.
//
// Pure data, no imports (gamedata.js merges it): the server pays and checks
// by it (server/game/saga.js), the client plays its scenes (client/cutscene.js)
// and draws the anchors and the rift by it.

/** The one who is pulling the rift open. */
export const VILLAIN = {
  id: 'vesper', he: 'וספר', title: 'שומרת הקרע', name: 'Vesper',
  // how she is drawn when she speaks through the rift: a projection of light
  look: { kind: 'mage', look: 'b', skin: '#d8b49a', hairC: '#3a2a6a' },
};

/** Who speaks in the scenes, and how their name is shown. */
export const SPEAKERS = {
  narrator: { he: '', icon: '' },
  rift: { he: 'קול מהקרע', icon: '🌀', color: '#7ff3ff' },
  vesper: { he: 'וספר', icon: '🌀', color: '#7ff3ff' },
  maro: { he: 'הזקן מארו', icon: '🧙', color: '#ffd27a' },
  you: { he: '', icon: '', color: '#ffffff' },
};

/**
 * The three anchors: one in each of the zones she chose, each guarded by a
 * creature the rift has taken. Break all three (win the fight at each) and
 * the rift has nothing left to hold it open but her.
 */
export const ANCHORS = [
  { id: 'anchor_tide', zone: 'tidal_hollow', x: -2, z: -18, he: 'עוגן הגאות', guardian: { species: 'maelstride', level: 26 } },
  { id: 'anchor_storm', zone: 'stormreach_heights', x: -20, z: -30, he: 'עוגן הסערה', guardian: { species: 'skyrender', level: 29 } },
  { id: 'anchor_frost', zone: 'frostpeak_ridge', x: 30, z: 10, he: 'עוגן הכפור', guardian: { species: 'rimeserpent', level: 32 } },
];
export const ANCHOR_REACH = 7;

/** The last fight: the guardian of the rift, on the pier, under the tear. */
export const FINALE = { id: 'finale', zone: 'aetherport', x: 0, z: -62, reach: 12, foe: { species: 'tehomon', level: 40 } };

/** How much harder a story foe is than a wild of its level. */
export const STORY_FOE = { hpScale: 2.4, scale: 1.08, finaleHp: 3.0, finaleScale: 1.12 };

/** Tehomon, the rift's guardian, and the little one that stays behind. */
export const SAGA_SPECIES = {
  tehomon: {
    id: 'tehomon', name: 'Tehomon', he: 'תהומון', types: ['umbra', 'lumen'], rarity: 'boss',
    base: { hp: 340, atk: 128, def: 112, spa: 150, spd: 122, spe: 92 },
    learn: [[1, 'voidpulse'], [1, 'prismbeam'], [1, 'hexbite'], [1, 'duskbind']],
    model: { shape: 'serpent', a: 0x241C4A, b: 0x2FE6D0, scale: 3.8, glow: true, eyes: 0xFF7A59 },
  },
  riftling: {
    id: 'riftling', name: 'Riftling', he: 'קרעונון', types: ['umbra', 'lumen'], rarity: 'legendary', gift: true,
    base: { hp: 92, atk: 70, def: 78, spa: 112, spd: 96, spe: 104 },
    learn: [[1, 'glintray'], [1, 'shadowclaw'], [12, 'prismbeam'], [24, 'nightmare'], [38, 'voidpulse']],
    model: { shape: 'blob', a: 0x2A2258, b: 0x2FE6D0, scale: 1, glow: true, eyes: 0xFF7A59 },
  },
};

/** Where the new ones are written about in the dex. */
export const SAGA_FOUND = {
  tehomon: 'שומר הקרע — נלחמים בו בסוף הסיפור, על מזח הקרע',
  riftling: 'נשאר מאחור כשהקרע נסגר — מתנה מסוף הסיפור',
};

const main = (id, step, he, descHe, goal, reward, scene, outro) =>
  ({ id, chain: 'main', step, name: he, he, desc: descHe, descHe, goal, reward, scene, outro });

/** The main chain, steps 11 to 16. `scene` plays when the step opens. */
export const SAGA_QUESTS = Object.fromEntries([
  main('q_main_11', 11, 'הקול מהקרע',
    'משהו דיבר אליך מתוך הקרע. ספר לזקן מארו — הוא כותב כל דבר שהקרע עושה.',
    { kind: 'talk', target: 'maro' },
    { gold: 3000, items: [['potion_m', 4]], xp: 1400 }, 'voice'),
  main('q_main_12', 12, 'בעקבות המסדר החלול',
    'וספר והמסדר החלול יצאו פעם לצריח הסופה. עבור את הצריח עד הסוף וגלה מה הם עשו שם.',
    { kind: 'dungeon', target: 'storm_spire' },
    { gold: 3500, items: [['sphere_ultra', 2], ['aether_core', 2]], xp: 2600 }, 'student'),
  main('q_main_13', 13, 'שלושת העוגנים',
    'שלושה עוגנים מחזיקים את הקרע פתוח: במפרץ הגאות, ברמות הסופה וברכס הכפור. נצח את השומר של כל אחד ונפץ אותו.',
    { kind: 'anchor', count: 3 },
    { gold: 5000, items: [['sphere_ultra', 3], ['aether_core', 3]], xp: 4200 }, 'anchors'),
  main('q_main_14', 14, 'מצודת החלול',
    'וספר מחכה במקום שבו הכול התחיל. עבור את מצודת החלול בחורש האופל.',
    { kind: 'dungeon', target: 'hollow_keep' },
    { gold: 6500, items: [['revive', 4], ['aether_core', 4]], xp: 6000 }, 'motive'),
  main('q_main_15', 15, 'לב הקרע',
    'השמיים מעל נמל האתר נקרעו. לך למזח הקרע והתעמת עם תהומון, השומר שוספר כבלה.',
    { kind: 'story', target: 'finale' },
    { gold: 12000, items: [['sphere_ultra', 5], ['aether_core', 6]], xp: 9000, creature: { species: 'riftling', level: 35 } }, 'tear'),
  main('q_main_16', 16, 'השקט שאחרי',
    'הקרע נסגר. לך לזקן מארו — הוא כותב את העמוד האחרון.',
    { kind: 'talk', target: 'maro' },
    { gold: 12500, items: [['sphere_ultra', 3]], xp: 3000 }, 'sealed', 'credits'),
].map((q) => [q.id, q]));

/**
 * The scenes. Each line: who says it (SPEAKERS), what, and optionally how it
 * is shot and what happens on screen as it is said:
 *   shot  'self'  close on you      'orbit' slowly round you
 *         'sky'   up past you at the sky (at the rift, in the port)
 *         'holo'  over your shoulder at her projection
 *         'rift'  at the rift itself (in the port; 'sky' anywhere else)
 *   fx    'pulse' the rift beats    'shake' the ground shakes  'flash' a white flash
 *         'holo-in' / 'holo-out' her projection appears / fades
 *         'tear'  the rift tears wide   'seal' the rift closes   'dark' the light goes cold
 */
export const SCENES = {
  voice: [
    { who: 'narrator', shot: 'sky', fx: ['pulse'], he: 'הקרע מעל הנמל פועם. פעם אחת, ועוד פעם — כמו לב.' },
    { who: 'rift', shot: 'sky', fx: ['shake', 'dark'], he: '…מאמן. הרגשתי אותך כשהכית את מה שנפל דרכי.' },
    { who: 'rift', shot: 'orbit', he: 'הם קוראים לזה קרע. אני קוראת לזה דלת. ואתה עומד בפתח שלה.' },
    { who: 'narrator', shot: 'self', fx: ['flash'], he: 'האור כבה. מישהו בעיר בטח ראה — הזקן מארו כותב כל דבר שהקרע עושה.' },
  ],
  student: [
    { who: 'maro', shot: 'self', he: 'קול? מתוך הקרע? …אז זה נכון. היא חזרה.' },
    { who: 'maro', shot: 'orbit', he: 'קראו לה וספר. התלמידה הכי טובה שהייתה לי. היא האמינה שהקרע הוא לא פצע — שהוא דלת לעולם שבו יצורים לא שייכים לאף אחד.' },
    { who: 'maro', shot: 'orbit', he: 'יום אחד היא יצאה לצריח הסופה עם עוד כמה. הם קראו לעצמם "המסדר החלול". מאז לא שמעתי ממנה מילה.' },
    { who: 'maro', shot: 'sky', fx: ['pulse'], he: 'אם היא מדברת דרך הקרע, היא שואבת ממנו כוח. לך לצריח, וגלה מה הם עשו שם.' },
  ],
  anchors: [
    { who: 'narrator', shot: 'orbit', fx: ['holo-in'], he: 'באוויר מולך נפרש אור תכלת. דמות של אישה בגלימה.' },
    { who: 'vesper', shot: 'holo', he: 'אז אתה זה שטיפס לצריח שלי. מארו תמיד ידע לבחור שליחים.' },
    { who: 'vesper', shot: 'holo', fx: ['pulse'], he: 'שלושה עוגנים כבר נעוצים בעולם — בגאות, בסערה ובכפור. כל אחד מהם מושך את הקרע עוד קצת פתוח.' },
    { who: 'you', shot: 'self', he: 'יצורים חוזרים פצועים מהשדות בגלל זה. תעצרי.' },
    { who: 'vesper', shot: 'holo', he: 'פצועים? הם חוזרים הביתה. נפץ את העוגנים אם אתה מסוגל — השומרים שלי לא יזוזו בשבילך.' },
    { who: 'narrator', shot: 'orbit', fx: ['holo-out'], he: 'האור מתפזר. במפה שלך נדלקות שלוש נקודות.' },
  ],
  motive: [
    { who: 'narrator', shot: 'sky', fx: ['shake', 'pulse'], he: 'העוגן האחרון מתנפץ, והקרע צורח. גם בקצה העולם שומעים אותו.' },
    { who: 'vesper', shot: 'holo', fx: ['holo-in'], he: 'שלושה. יותר משחשבתי שתצליח.' },
    { who: 'vesper', shot: 'holo', he: 'אתה יודע מה יש מעבר לקרע? שקט. יצורים שאף כדור לא נגע בהם. ראיתי את זה פעם אחת, וזה היה הדבר הכי יפה שראיתי.' },
    { who: 'you', shot: 'self', he: 'ומה עם אלה שנופלים דרכו לכאן? הם מבוהלים. הם תוקפים כל מה שזז.' },
    { who: 'vesper', shot: 'holo', fx: ['dark'], he: 'כל דלת חורקת כשפותחים אותה.' },
    { who: 'vesper', shot: 'holo', fx: ['holo-out'], he: 'בוא למצודת החלול, אם אתה רוצה לראות על מה אתה נלחם. משם הכול התחיל.' },
  ],
  tear: [
    { who: 'narrator', shot: 'orbit', fx: ['dark'], he: 'בלב המצודה מצאת את מה שהיא לא הראתה: היומנים שלה. בכל עמוד — אותו יצור, כבול בשרשרת של אור.' },
    { who: 'narrator', shot: 'orbit', he: 'תהומון. שומר הקרע. היא לא פתחה דלת — היא כבלה את השומר שלה ומשכה אותו החוצה.' },
    { who: 'narrator', shot: 'rift', fx: ['tear', 'shake', 'flash'], he: 'ואז השמיים מעל נמל האתר נקרעים לרווחה.' },
    { who: 'vesper', shot: 'holo', fx: ['holo-in'], he: 'מאוחר מדי, מאמן. כשהשומר בצד הזה, אף אחד לא סוגר את הדלת.' },
    { who: 'vesper', shot: 'holo', fx: ['holo-out', 'pulse'], he: 'בוא למזח. תראה בעצמך.' },
  ],
  sealed: [
    { who: 'narrator', shot: 'rift', fx: ['flash'], he: 'תהומון כורע. שרשרת האור סביבו נסדקת, ומתנפצת.' },
    { who: 'vesper', shot: 'holo', fx: ['holo-in'], he: 'לא… הוא היה אמור להיות שלי. הוא היה המפתח.' },
    { who: 'you', shot: 'self', he: 'הוא לא מפתח. הוא שומר. תני לו לחזור.' },
    { who: 'narrator', shot: 'rift', fx: ['seal', 'shake'], he: 'תהומון מרים את ראשו אל הקרע וממריא — והאור נסגר אחריו כמו עין שנעצמת.' },
    { who: 'narrator', shot: 'sky', he: 'השמיים מעל נמל האתר שקטים, בפעם הראשונה מזה שנים. ומשהו קטן נשאר מאחור, מסתכל עליך.' },
    { who: 'vesper', shot: 'holo', fx: ['holo-out'], he: '…מארו צדק לגביך. אני אלך אליו. יש לי הרבה מה להסביר — ועוד יותר מה לתקן.' },
  ],
  credits: [
    { who: 'maro', shot: 'self', he: 'וספר באה אליי אתמול בלילה. ישבנו עד הבוקר. היא תעזור לי לכתוב את הפרק הזה.' },
    { who: 'maro', shot: 'orbit', he: 'רוצה לשמוע איך הוא נגמר? "והמאמן שהגיע לנמל עם יצור אחד — סגר את השמיים."' },
    { who: 'maro', shot: 'sky', he: 'אבל זה לא הסוף. העולם גדול, המגדל לא נגמר, והזירה מחכה. לך — הספר שלך עוד פתוח.', roll: true },
  ],
};

/** The scenes in the order the story plays them (for the replay list). */
export const SCENE_ORDER = ['voice', 'student', 'anchors', 'motive', 'tear', 'sealed', 'credits'];
export const SCENE_TITLES = {
  voice: 'הקול מהקרע', student: 'התלמידה', anchors: 'העוגנים', motive: 'למה', tear: 'הקרע נפתח', sealed: 'הקרע נסגר', credits: 'העמוד האחרון',
};

/** The anchors in a zone. */
export const anchorsIn = (zone) => ANCHORS.filter((a) => a.zone === zone);
export const anchorById = (id) => ANCHORS.find((a) => a.id === id) || null;

/** How the rift over the port looks for a player, from their quests. */
export function riftState(quests) {
  const done = quests?.done || [];
  if (done.includes('q_main_15')) return 'sealed';
  if (quests?.active?.q_main_15) return 'torn';
  return 'calm';
}
