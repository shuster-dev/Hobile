// The journey: the main story as one unbroken line, from the first word in
// town to the last world, each step saying plainly what to do and where.
//
// It used to start with seven tutorial steps (walk, turn the camera…) laid
// over the story, a starter handed over on the first word, and steps that
// sent you to the yard and the workshop before anything had happened. Now it
// is the story: Elder Maro in the plaza, your first catch in the town's own
// streets with your own weapon, back to him, your partner grows, the smith
// gives you a real weapon, and out through the gate — every world in turn,
// its own errands, on to the last. Finish the collection and your portrait
// goes up on the Wall of Champions (shared/champions.js).
//
// A step done is a step paid and the next one opened, then and there
// (combat.js syncQuests): nothing waits in a panel to be collected.
//
// Pure data, applied to QUESTS by gamedata.js; the server counts by it, the
// client shows `hint` under the step and has the one it talks to say `say`.

const main = (id, he, descHe, goal, reward, extra = {}) =>
  ({ id, chain: 'main', step: 0, name: he, he, desc: descHe, descHe, goal, reward, ...extra });

/** The worlds in the order the journey walks them: [zone, name]. */
export const WORLD_ORDER = [
  ['verdant_meadow', 'האחו הירוק'],
  ['emberfall_canyon', 'קניון האש'],
  ['stonewake_mesa', 'מישורי האבן'],
  ['tidal_hollow', 'מפרץ הגאות'],
  ['stormreach_heights', 'רמות הסופה'],
  ['frostpeak_ridge', 'רכס הכפור'],
  ['umbral_grove', 'חורש האופל'],
];

/** One step per world: its own errands, the survey and the local catch. */
const world = (zone, he, gold) => main(`q_w_${zone}`, `המשימות של ${he}`,
  `השלם את המשימות של ${he}: סיור באזור ולכידה מקומית. הן נפתחות כשאתה נכנס אליו.`,
  { kind: 'claim', target: `q_${zone}_catch`, zone },
  { gold, xp: Math.round(gold * 0.6), items: [['potion_m', 2], ['sphere_great', 2]] },
  { hint: `לך אל ${he} והשלם את המשימות שלו — סיור ולכידה` });

/** One per world after its errands: its leader, and the badge that opens the
 *  next (shared/leaders.js). */
const leader = (zone, he, gold) => main(`q_l_${zone}`, `התג של ${he}`,
  `נצח את מנהיג ${he} בזירה שליד המחנה וקבל את התג שלו. בלי התג — העולם הבא סגור.`,
  { kind: 'badge', target: zone, zone },
  { gold, xp: Math.round(gold * 0.7), items: [['potion_m', 2]] },
  { hint: `מצא את הזירה של מנהיג ${he} ליד המחנה (⚔ במכ״ם) ונצח את הצוות שלו` });

export const JOURNEY_QUESTS = Object.fromEntries([
  main('q_main_back', 'חוזרים למארו',
    'הראה לזקן מארו את השותף הראשון שלך.',
    { kind: 'talk', target: 'maro' },
    { gold: 350, xp: 60, items: [['potion_s', 3]] },
    { hint: 'חזור לזקן מארו בכיכר והראה לו את השותף שלך',
      say: ['לכדת אחד! עכשיו אתה כבר לא לבד — אתה אחראי על מישהו.',
        'שותף צריך להתחזק. צאו להילחם יחד ברחובות — כל ניצחון מלמד אותו משהו.',
        'כשהוא יעלה רמה, לך לרן הנפח. ביקשתי ממנו להכין לך משהו.'] }),
  main('q_main_grow', 'השותף מתחזק',
    'השותף שלך צריך לעלות רמה אחת. כל יצור שאתה מנצח — בחרב או עם השותף — נותן לו ניסיון.',
    { kind: 'grow', count: 1 },
    { gold: 400, xp: 90, items: [['sphere_basic', 5]] },
    { hint: 'נצח יצורים ברחובות — בחרב או עם השותף. כל ניצחון נותן לשותף ניסיון, עד שיעלה רמה אחת' }),
  main('q_main_arm', 'נשק אמיתי',
    'רן הנפח הכין לך נשק. לך אליו לסדנה.',
    { kind: 'talk', target: 'ren' },
    { gold: 450, xp: 120, items: [['blade_iron', 1]] },
    { hint: 'לך לרן הנפח (⚒) — הוא הכין לך נשק',
      say: ['מארו שלח אותך? אז הנה: להב ברזל. יציב, לא מתכופף.',
        'לבש אותו מהתיק — הוא מכה חזק יותר מחרב העץ.',
        'סלע בשער הצפוני תפתח לך את הדרך לאחו הירוק. שם מתחיל העולם האמיתי.'] }),
  world('verdant_meadow', 'האחו הירוק', 900),
  world('emberfall_canyon', 'קניון האש', 1800),
  world('stonewake_mesa', 'מישורי האבן', 2400),
  world('tidal_hollow', 'מפרץ הגאות', 3600),
  world('stormreach_heights', 'רמות הסופה', 4000),
  world('frostpeak_ridge', 'רכס הכפור', 4500),
  world('umbral_grove', 'חורש האופל', 5800),
  leader('verdant_meadow', 'האחו הירוק', 1000),
  leader('emberfall_canyon', 'קניון האש', 1900),
  leader('stonewake_mesa', 'מישורי האבן', 2600),
  leader('tidal_hollow', 'מפרץ הגאות', 3700),
  leader('stormreach_heights', 'רמות הסופה', 4200),
  leader('frostpeak_ridge', 'רכס הכפור', 4800),
  leader('umbral_grove', 'חורש האופל', 6200),
  main('q_main_dex', 'האוסף המלא',
    'תפוס כל סוג של יצור שיש בעולם. מי שמשלים את האוסף נתלה בקיר האלופים.',
    { kind: 'dex', count: 0 },
    { gold: 25000, xp: 8000, items: [['sphere_ultra', 10]] },
    { hint: 'השלם את האוסף — כל היצורים. התמונה שלך תיתלה בקיר האלופים בנמל האתר' }),
].map((q) => [q.id, q]));

/**
 * What the steps that were already there say now: a plain hint under the
 * step, the lines of the one you talk to for it, and for a few a new
 * description (the starter is not handed over any more; the first catch is
 * in town). `hint` is what the tracker shows; `say` what the NPC says.
 */
export const JOURNEY_TEXT = {
  q_main_01: {
    descHe: 'דבר עם הזקן מארו בכיכר הרסיס.',
    hint: 'לך לכיכר הרסיס ודבר עם הזקן מארו (🧙) — החץ מראה את הדרך',
    say: ['אז הגעת. מאז שהקרע נפתח מעל המזח, יצורים קטנים נופלים ממנו לרחובות העיר.',
      'אין לך עדיין שותף — ככה זה מתחיל אצל כולם. יש לך חרב ביד, וזה מספיק.',
      'מצא יצור ברחובות, הכה אותו עד שייחלש, ואז לחץ ״קרב״ וזרוק עליו כדור. קח את הכדורים האלה.'],
    reward: { gold: 100, items: [['sphere_basic', 5], ['potion_s', 2]], xp: 40 },
  },
  q_main_06: {
    descHe: 'לכוד את היצור הראשון שלך — יש כאלה ברחובות העיר.',
    hint: 'מצא יצור ברחובות (נקודה אדומה במכ״ם), הכה אותו בנשק, ואז ״קרב״ וזרוק כדור',
  },
  q_main_05: {
    descHe: 'צא מהשער הצפוני אל האחו הירוק והבס שם 5 יצורים.',
    hint: 'צא מהשער הצפוני לאחו הירוק והבס 5 יצורים',
  },
  q_main_08: { hint: 'מצא את הכניסה לבורות העיר התחתית ונקה את כל הקומות' },
  q_main_09: { hint: 'לך לקניון האש ונצח שם 3 יצורים' },
  q_main_10: { hint: 'כשבוס עולמי מופיע (☠ במכ״ם) — לך אליו ופגע בו' },
  q_main_11: { hint: 'חזור לזקן מארו בכיכר וספר לו על הקול מהקרע' },
  q_main_12: { hint: 'עבור את צריח הסופה עד הסוף', reward: { gold: 3800, items: [['sphere_ultra', 2], ['aether_core', 2]], xp: 2600 } },
  q_main_13: { hint: 'נפץ את שלושת העוגנים (🌀): בגאות, בסערה ובכפור' },
  q_main_14: { hint: 'עבור את מצודת החלול בחורש האופל' },
  q_main_15: { hint: 'לך למזח הקרע בנמל האתר והתעמת עם תהומון' },
  q_main_16: { hint: 'חזור לזקן מארו בפעם האחרונה' },
};

/** The order of the whole line. Anything 'main' not in it is retired. */
export const MAIN_ORDER = [
  'q_main_01', 'q_main_06', 'q_main_back', 'q_main_grow', 'q_main_arm',
  'q_main_05', 'q_w_verdant_meadow', 'q_l_verdant_meadow', 'q_main_08',
  'q_main_09', 'q_w_emberfall_canyon', 'q_l_emberfall_canyon',
  'q_w_stonewake_mesa', 'q_l_stonewake_mesa', 'q_main_10', 'q_main_11',
  'q_w_tidal_hollow', 'q_l_tidal_hollow', 'q_main_12',
  'q_w_stormreach_heights', 'q_l_stormreach_heights',
  'q_w_frostpeak_ridge', 'q_l_frostpeak_ridge', 'q_main_13',
  'q_w_umbral_grove', 'q_l_umbral_grove', 'q_main_14', 'q_main_15', 'q_main_16',
  'q_main_dex',
];

/** Lay the journey over the quest table (gamedata.js does, once). */
export function applyJourney(QUESTS, dexTotal) {
  Object.assign(QUESTS, JOURNEY_QUESTS);
  for (const [id, t] of Object.entries(JOURNEY_TEXT)) {
    const q = QUESTS[id];
    if (!q) continue;
    Object.assign(q, t);
    t.descHe && (q.desc = t.descHe);
  }
  QUESTS.q_main_dex.goal.count = dexTotal;
  // the steps that sent you to the yard, the workshop and the market before
  // anything had happened: the townsfolk still have their own errands
  for (const q of Object.values(QUESTS)) if (q.chain === 'main' && !MAIN_ORDER.includes(q.id)) q.chain = 'retired';
  MAIN_ORDER.forEach((id, i) => { QUESTS[id] && (QUESTS[id].step = i + 1); });
}
