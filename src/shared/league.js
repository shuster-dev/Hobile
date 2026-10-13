// The League of Champions: after the seventh badge, four of the strongest
// trainers there are, one after another, in one fight — no clinic between
// them, only what is in your bag. Beat all four and your portrait goes up on
// the Wall of Champions in the plaza (doc.champion), beside those who caught
// every kind there is.
//
// It is held at the wall itself (the plaza of Aetherport). A rematch is
// allowed and pays as a battle does; the title and the prize only once.
//
// Pure: the server starts and pays it (server/game/leaders.js), the client
// offers it at the wall and calls out each trainer as they step up.
import { LEADER_ORDER, LEADERS, badgesOf } from './leaders.js';

export const LEAGUE = {
  id: 'league',
  zone: 'aetherport',
  he: 'ליגת האלופים',
  /** How much harder a league creature is than a wild of its level. */
  hpScale: 1.15, scale: 1.06,
  gold: 30000,
  items: [['sphere_ultra', 5], ['revive_full', 3], ['potion_l', 5]],
  members: [
    { id: 'saar', he: 'סער', title: 'אדון הגלים', icon: '🌊',
      team: [['cloudray', 44], ['maelstride', 45]],
      greet: 'הגעת עד לכאן עם שבעה תגים. יפה. עכשיו תראה מה זה ים פתוח.' },
    { id: 'lehava', he: 'להבה', title: 'לוחמת האש והברק', icon: '🔥',
      team: [['stormstag', 46], ['vulcanth', 47]],
      greet: 'סער היה רק החימום. אצלי בוערים.' },
    { id: 'eitan', he: 'איתן', title: 'שומר האדמה והפלדה', icon: '🪨',
      team: [['clockwyrm', 47], ['geodon', 48]],
      greet: 'שניים נפלו. אני לא נופל.' },
    { id: 'champion', he: 'אורה', title: 'האלופה', icon: '👑',
      team: [['aurorix', 48], ['eclipsar', 49], ['ignivar', 50]],
      greet: 'שלושה ניצחת. אני האחרונה — ואני לא מתכוונת לפנות לך את הקיר.' },
  ],
  lines: {
    locked: 'הליגה פתוחה רק למי שמחזיק בכל שבעת התגים.',
    win: 'ניצחת את כולנו. התמונה שלך עולה לקיר — אלוף אמיתי.',
    lose: 'הליגה לא סולחת. תתאמן, תתמלא בשיקויים, ותחזור.',
  },
};

/** The whole line-up as one team, in the order they step up. */
export const LEAGUE_TEAM = LEAGUE.members.flatMap((m) => m.team.map(([species, level]) => ({ species, level, member: m.id })));

/** Who the n-th creature of the league belongs to. */
export const leagueMemberAt = (i) => LEAGUE.members.find((m) => m.id === LEAGUE_TEAM[i]?.member) || null;

/** May this trainer go up against the league? All seven badges. */
export function leagueOpen(doc) {
  const have = badgesOf(doc);
  return LEADER_ORDER.every((z) => have.includes(LEADERS[z].badge.id));
}

/** How far from the wall a trainer may stand and still be at it. */
export const LEAGUE_REACH = 8;
