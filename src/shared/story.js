/**
 * The people of Aetherport and what they ask of you.
 *
 * The main story is the rift over the harbour. Everyone in town lives under
 * it, and each of them has their own piece of it: the nurse whose clinic fills
 * with hurt creatures, the trader buying the shards that fall, the smith who
 * needs iron, the warden who watches the gate, the kid who wants a friend, and
 * the old man writing it all down. Each gives a chain of three errands, and
 * the last of each chain pays with something worth the walk — a creature you
 * could not otherwise have yet, gear, or rare spheres.
 *
 * Shared by the server (what can be accepted, what is done, what it pays) and
 * the client (the ! and ? over heads, the offer cards), so the two agree.
 *
 * Goal kinds, beyond the engine's defeat / capture / craft / star / dungeon:
 *   heal     — heal the team at the clinic or at a camp's spring
 *   train    — start a training session in your yard
 *   deliver  — bring `count` of `item`; taken when the reward is handed over
 *   level    — reach trainer level `count`
 *   dex      — have caught `count` different species
 */

// Quest givers who are not street NPCs (they stand behind a counter).
export const GIVERS = {
  noga: { id: 'noga', he: 'האחות נוגה', name: 'Nurse Noga', icon: '✚', where: 'clinic' },
};

const q = (id, giver, step, he, descHe, goal, reward, req, lines) =>
  ({ id, chain: 'npc', giver, step, he, name: he, descHe, desc: descHe, goal, reward, req, lines });

export const NPC_QUESTS = Object.fromEntries([
  // --- Nurse Noga, the clinic --------------------------------------------
  q('n_noga_1', 'noga', 1, 'יד מרפאה',
    'תן לאחות נוגה לטפל בצוות שלך במרפאה — או נוח במעיין של מחנה.',
    { kind: 'heal', count: 1 },
    { gold: 150, xp: 60, items: [['potion_s', 4], ['bandage', 2]] },
    { level: 1 },
    { offer: ['מאז שהקרע מעל הנמל התרחב, יצורים חוזרים מהשדות פצועים.', 'בוא נתחיל ממך. תן לי לטפל בצוות שלך — או תנוח במעיין שבמחנה.'],
      busy: ['הצוות שלך עוד לא טופל. המרפאה פתוחה, והמעיין במחנה חינם.'],
      done: ['הרבה יותר טוב. קח את אלה לדרך — שיקויים לא גדלים על עצים.'] }),
  q('n_noga_2', 'noga', 2, 'עשבי מרפא',
    'הבא לאחות נוגה 6 סיבי עשב מהאחו.',
    { kind: 'deliver', item: 'fiber', count: 6 },
    { gold: 300, xp: 180, items: [['potion_m', 3], ['revive', 1]] },
    { after: ['n_noga_1'] },
    { offer: ['העשב של האחו מרגיע כוויות של יצורי אש. נגמר לי.', 'תביא לי שש אלומות סיבים — אתה מוצא אותם בקרבות ובחצר שלך.'],
      busy: ['עוד לא שש אלומות. היצורים באחו מפילים אותן לפעמים.'],
      done: ['מושלם, ריח של שדה. הנה — זה מה שהכנתי מהמשלוח הקודם.'] }),
  q('n_noga_3', 'noga', 3, 'המטופלת מהמעיין',
    'הרגע את היצורים הפראיים באחו: הבס 6 מהם.',
    { kind: 'defeat', count: 6, zone: 'verdant_meadow' },
    { gold: 600, xp: 400, items: [['revive', 1]], creature: { species: 'glimmer', level: 8 } },
    { after: ['n_noga_2'], level: 4 },
    { offer: ['מצאתי גורה קטנה ליד המעיין באחו, פצועה. היצורים שם תוקפים כל מי שזז.', 'תרגיע אותם — הבס שישה — ואני אדע שהדרך בטוחה בשבילה.'],
      busy: ['היא עוד מפחדת לצאת. האחו עוד סוער.'],
      done: ['האחו שקט. והיא… היא לא מפסיקה להסתכל עליך.', 'היא בחרה בך. שמור עליה — היא זוהרת בחושך.'] }),

  // --- Tavi, Market Row ----------------------------------------------------
  q('n_tavi_1', 'tavi', 1, 'סחורה חיה',
    'לכוד 2 יצורים בכל אזור.',
    { kind: 'capture', count: 2 },
    { gold: 250, xp: 120, items: [['sphere_basic', 6]] },
    { level: 2 },
    { offer: ['לקוחות שואלים אם יש ביצורים מהקרע משהו מיוחד. אני לא יודעת — עוד לא ראיתי אחד מקרוב.', 'תלכוד שניים. אני אשלם בכדורים — ככה תלכוד עוד.'],
      busy: ['שניים, מותק. אני סופרת.'],
      done: ['יפים! אמרתי ללקוחות שהם מיוחדים, ועכשיו זה אפילו נכון.'] }),
  q('n_tavi_2', 'tavi', 2, 'רסיסי אחו',
    'הבא לטאבי 4 רסיסי אחו (מתקבלים מיצור כפול שנלכד).',
    { kind: 'deliver', item: 'shard_verdant', count: 4 },
    { gold: 500, xp: 260, items: [['sphere_great', 3]] },
    { after: ['n_tavi_1'] },
    { offer: ['כשאתה לוכד יצור שכבר יש לך, הוא משאיר רסיס. את הירוקים אני קונה ביוקר.', 'ארבעה רסיסי אחו, ואני נותנת לך כדורים משופרים — לא מהמדף.'],
      busy: ['עוד לא ארבעה. לכוד שוב את מה שכבר יש לך באחו.'],
      done: ['ירוקים ומבריקים. אל תשאל מה אני עושה איתם. באמת, אל תשאל.'] }),
  q('n_tavi_3', 'tavi', 3, 'הלקוח הגדול',
    'הגע לרמת מאמן 10.',
    { kind: 'level', count: 10 },
    { gold: 1500, xp: 600, items: [['sphere_ultra', 2], ['charm_swift', 1]] },
    { after: ['n_tavi_2'] },
    { offer: ['יש לי לקוח שקונה רק ממאמנים ותיקים. רמה עשר, לפחות.', 'תגיע לשם ותחזור — יש לי בשבילך משהו שאני לא מראה לאף אחד.'],
      busy: ['עוד לא רמה עשר. הלקוח שלי סבלני. אני פחות.'],
      done: ['רמה עשר! הנה, קמע המהירות — וזוג כדורי אולטרה. שלא תגיד שטאבי קמצנית.'] }),

  // --- Ren, the workshop -----------------------------------------------------
  q('n_ren_1', 'ren', 1, 'ידיים עובדות',
    'ייצר 2 פריטים בחצר שלך.',
    { kind: 'craft', count: 2 },
    { gold: 300, xp: 150, items: [['scrap_iron', 10]] },
    { level: 3 },
    { offer: ['מי שלא מייצר בעצמו, קונה ביוקר אצל טאבי.', 'תייצר שני דברים בחצר. אחר כך נדבר.'],
      busy: ['שניים. לא אחד. שניים.'],
      done: ['לא רע. קח ברזל — תצטרך אותו.'] }),
  q('n_ren_2', 'ren', 2, 'ברזל מהקניון',
    'הבא לרן 12 גרוטאות ברזל.',
    { kind: 'deliver', item: 'scrap_iron', count: 12 },
    { gold: 400, xp: 300, items: [['blade_iron', 1]] },
    { after: ['n_ren_1'] },
    { offer: ['אני מכין לך להב. להב צריך ברזל.', 'שתים עשרה גרוטאות. יצורי מתכת ואבן מפילים אותן.'],
      busy: ['עוד חסר ברזל.'],
      done: ['להב ברזל. תצייד אותו — ההבדל בקרב מורגש.'] }),
  q('n_ren_3', 'ren', 3, 'אימון אמיתי',
    'התחל אימון ליצור במגרש האימונים שבחצר שלך.',
    { kind: 'train', count: 1 },
    { gold: 800, xp: 500, items: [['aether_core', 1], ['charm_focus', 1]] },
    { after: ['n_ren_2'], level: 5 },
    { offer: ['יצור שרק נלחם — מתעייף. יצור שמתאמן — מתחזק.', 'שים אחד מהם במגרש האימונים בחצר שלך.'],
      busy: ['המגרש בחצר מחכה.'],
      done: ['ככה עושים את זה. קח ליבת אתר — ממנה בונים את השדרוגים הגדולים.'] }),

  // --- Sela, the North Gate ----------------------------------------------------
  q('n_sela_1', 'sela', 1, 'שומרת השער',
    'הבס 10 יצורים בכל אזור.',
    { kind: 'defeat', count: 10 },
    { gold: 400, xp: 250, items: [['potion_m', 3]] },
    { level: 3 },
    { offer: ['כל לילה עוד יצורים מגיעים עד השער. אני לבד כאן.', 'תבריח עשרה. זה יקנה לי שקט.'],
      busy: ['עוד לא עשרה.'],
      done: ['שקט. סוף סוף. קח — יותר תצטרך את זה מאשר אני.'] }),
  q('n_sela_2', 'sela', 2, 'הקניון בוער',
    'הבס 5 יצורים בקניון האש.',
    { kind: 'defeat', count: 5, zone: 'emberfall_canyon' },
    { gold: 900, xp: 700, items: [['sphere_great', 4], ['vest_hide', 1]] },
    { after: ['n_sela_1'], level: 8 },
    { offer: ['בקניון האש משהו מתעורר. היצורים שם יוצאים החוצה בלהקות.', 'לך לשם והבס חמישה. תחזור בשלום.'],
      busy: ['הקניון עוד בוער.'],
      done: ['חזרת. זה כבר הרבה. אפוד עור — הוא יחזיק מכה שאתה לא.'] }),
  q('n_sela_3', 'sela', 3, 'מתחת לעיר',
    'נקה מבוך אחד עד הסוף.',
    { kind: 'dungeon', count: 1 },
    { gold: 1500, xp: 1000, creature: { species: 'duskmaw', level: 15 } },
    { after: ['n_sela_2'], level: 10 },
    { offer: ['מתחת לעיר יש בורות ישנים. משהו חי שם עכשיו.', 'נקה מבוך אחד עד הסוף ואני אספר לך מה מצאתי בשער אתמול בלילה.'],
      busy: ['המבוכים עוד פתוחים.'],
      done: ['מצאתי אותו ליד השער, רועד בקור — גור של זאב צללים. נדיר.', 'הוא לא נותן לי להתקרב. אליך, אני חושבת, הוא יבוא.'] }),

  // --- Bex, the plaza -----------------------------------------------------------
  q('n_bex_1', 'bex', 1, 'החבר של בקס',
    'לכוד יצור אחד באחו הירוק.',
    { kind: 'capture', count: 1, zone: 'verdant_meadow' },
    { gold: 150, xp: 100, items: [['sphere_basic', 5]] },
    { level: 1 },
    { offer: ['אמא לא נותנת לי לצאת לאחו. אתה יכול לתפוס שם אחד? רק שאני אראה?'],
      busy: ['תפסת כבר? תפסת?'],
      done: ['וואו! הוא אמיתי! הנה, מצאתי את אלה ברחוב. אני לא צריך אותם.'] }),
  q('n_bex_2', 'bex', 2, 'האלבום של בקס',
    'לכוד 6 מינים שונים.',
    { kind: 'dex', count: 6 },
    { gold: 400, xp: 300, items: [['sphere_great', 3], ['ether', 2]] },
    { after: ['n_bex_1'] },
    { offer: ['אני מכין אלבום של כל היצורים בעולם! יש לי רק ציורים.', 'תביא שישה סוגים שונים ואני אצייר אותם מהחיים!'],
      busy: ['עוד לא שישה סוגים. יש עוד באחו, אני בטוח!'],
      done: ['שישה! האלבום שלי הכי טוב בעיר. קח — זה של אבא, אבל הוא לא ישים לב.'] }),
  q('n_bex_3', 'bex', 3, 'הכי חזק בעיר',
    'שדרג יצור ל־2 כוכבים.',
    { kind: 'star', star: 2 },
    { gold: 800, xp: 500, creature: { species: 'cirrowing', level: 12 } },
    { after: ['n_bex_2'], level: 5 },
    { offer: ['סלע אומרת שיצור אמיתי צריך כוכבים. תעשה לאחד שלך שני כוכבים?'],
      busy: ['עוד אין לו שני כוכבים…'],
      done: ['שני כוכבים! אני צריך להגיד לך סוד. יש לי ביצה. היא בקעה.', 'אני לא יכול לשמור אותה — אמא. תשמור עליה? היא עפה!'] }),

  // --- Elder Maro, the archive: the collector's road ----------------------------
  q('n_maro_1', 'maro', 1, 'יומן המסע',
    'לכוד 10 מינים שונים.',
    { kind: 'dex', count: 10 },
    { gold: 800, xp: 600, items: [['sphere_great', 3], ['crystal_lumen', 2]] },
    { level: 5 },
    { offer: ['כל יצור שנפל דרך הקרע רשום אצלי ביומן — בשם, לא במראה. אף אחד לא ראה את כולם.', 'עשרה מינים שונים. זו ההתחלה של יומן אמיתי.'],
      busy: ['היומן מחכה לעשרה.'],
      done: ['עשרה. אתה כבר רואה את מה שאני רק קורא עליו.'] }),
  q('n_maro_2', 'maro', 2, 'חצי מהיומן',
    'לכוד 18 מינים שונים.',
    { kind: 'dex', count: 18 },
    { gold: 3000, xp: 1500, items: [['sphere_ultra', 3], ['aether_core', 1]] },
    { after: ['n_maro_1'] },
    { offer: ['שמונה עשרה. חצי ממה שכתוב כאן.', 'בשביל זה תצטרך לראות את הרמות, את המפרץ ואת הרכס.'],
      busy: ['היומן לא מתמלא לבד.'],
      done: ['חצי יומן. לא האמנתי שאראה את זה.'] }),
  q('n_maro_3', 'maro', 3, 'הזוהר שמעבר לקרע',
    'לכוד 25 מינים שונים.',
    { kind: 'dex', count: 25 },
    { gold: 8000, xp: 4000, creature: { species: 'aurorix', level: 35 } },
    { after: ['n_maro_2'] },
    { offer: ['בדף האחרון ביומן יש יצור אחד שאף מאמן לא לכד. הוא לא נופל — הוא בוחר.', 'עשרים וחמישה מינים. אם תגיע לשם, אני חושב שהוא יבחר בך.'],
      busy: ['עשרים וחמישה. הדרך ארוכה.'],
      done: ['הזוהר… הוא ירד מהקרע הבוקר ולא עזב את הארכיון.', 'הוא מחכה לך. לך.'] }),
].map((x) => [x.id, x]));

/** Who gives what, in chain order. */
export const QUESTS_BY_GIVER = {};
for (const x of Object.values(NPC_QUESTS)) (QUESTS_BY_GIVER[x.giver] ||= []).push(x);
for (const list of Object.values(QUESTS_BY_GIVER)) list.sort((a, b) => a.step - b.step);

const inv = (doc, item) => doc?.inventory?.[item] || 0;
const seenSpecies = (doc) => Object.values(doc?.dex || {}).filter((r) => r?.caught > 0).length;

/** For goals measured from what the player has, not from events: how far along. */
export function heldProgress(doc, quest) {
  const g = quest.goal;
  if (g.kind === 'level') return doc?.level || 1;
  if (g.kind === 'dex') return seenSpecies(doc);
  if (g.kind === 'deliver') return inv(doc, g.item);
  if (g.kind === 'star') {
    const best = Math.max(0, ...Object.values(doc?.creatures || {}).map((c) => c?.star || 1),
      ...(doc?.team || []).map((c) => (typeof c === 'object' ? c?.star || 1 : 0)));
    return best >= g.star ? (g.count || 1) : 0;
  }
  return null;
}

/** locked · available · active · ready · claimed */
export function questState(doc, quest) {
  const done = doc?.quests?.done || [];
  if (done.includes(quest.id)) return 'claimed';
  const act = doc?.quests?.active?.[quest.id];
  if (act) {
    const held = heldProgress(doc, quest);
    if (held != null) return held >= (quest.goal.count || 1) ? 'ready' : 'active';
    return act.done ? 'ready' : 'active';
  }
  const r = quest.req || {};
  if ((doc?.level || 1) < (r.level || 1)) return 'locked';
  if ((r.after || []).some((id) => !done.includes(id))) return 'locked';
  return 'available';
}

/** What an NPC has for this player: something to hand in beats something new. */
export function giverView(doc, giver) {
  const list = QUESTS_BY_GIVER[giver] || [];
  const by = (s) => list.find((x) => questState(doc, x) === s) || null;
  return { ready: by('ready'), active: by('active'), offer: by('available') };
}

/** The mark over an NPC's head: ? to hand in, ! for new, … while working. */
export function giverMark(doc, giver) {
  const v = giverView(doc, giver);
  return v.ready ? '?' : v.offer ? '!' : v.active ? '…' : '';
}
