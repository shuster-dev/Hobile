// The leaders on the server (shared/leaders.js has who they are): the fight
// a leader's ring holds for a player standing in it, and what winning pays.
import { LEADERS, LEADER_FOE, LEADER_REACH, badgesOf, leaderSpot } from '../../shared/leaders.js';
import { LEAGUE, LEAGUE_REACH, LEAGUE_TEAM, leagueOpen } from '../../shared/league.js';
import { ZONES } from '../../shared/gamedata.js';
import { Combatant, giveItem, makeCreature, syncQuests } from './combat.js';
import { SPECIES } from '../../shared/gamedata.js';
import { earn } from './economy.js';

/** The fight in this zone's ring, for one standing at `at`, or why not. */
export function leaderFoe(doc, zoneId, at) {
  const l = LEADERS[zoneId], spot = l && leaderSpot(zoneId);
  if (!l || !spot) return { error: 'not_here' };
  if (!at || Math.hypot(at.x - spot.x, at.z - spot.z) > LEADER_REACH + 2) return { error: 'too_far' };
  const [species, level] = l.team[0];
  return {
    foe: {
      species, level, leader: zoneId, hpScale: LEADER_FOE.hpScale, scale: LEADER_FOE.scale,
      team: l.team.map(([sp, lv]) => ({ species: sp, level: lv })),
    },
  };
}

/** Where the league is held: at the Wall of Champions. */
export function leagueSpot() {
  const w = ZONES[LEAGUE.zone]?.landmarks?.find((l) => l.kind === 'champions');
  return w ? { x: w.x, z: w.z } : null;
}

/** The league's whole line-up, for one at the wall with seven badges. */
export function leagueFoe(doc, zoneId, at) {
  const spot = zoneId === LEAGUE.zone && leagueSpot();
  if (!spot) return { error: 'not_here' };
  if (!at || Math.hypot(at.x - spot.x, at.z - spot.z) > LEAGUE_REACH + 2) return { error: 'too_far' };
  if (!leagueOpen(doc)) return { error: 'league_locked' };
  const [first] = LEAGUE_TEAM;
  return {
    foe: {
      species: first.species, level: first.level, leader: LEAGUE.id, hpScale: LEAGUE.hpScale, scale: LEAGUE.scale,
      team: LEAGUE_TEAM.map(({ species, level }) => ({ species, level })),
    },
  };
}

/** The league beaten: the title and the wall (once), and the journey's step. */
function leagueWin(doc) {
  const first = !doc.league?.at;
  const out = { zone: LEAGUE.id, league: true, first, gold: 0, items: [], questsDone: [] };
  if (first) {
    doc.league = { at: Date.now(), level: doc.level || 1 };
    // up on the wall: the champion's frame is the same one the collection earns
    doc.champion ? (doc.champion.league = doc.league.at) : (doc.champion = { at: doc.league.at, level: doc.level || 1, league: doc.league.at });
    out.gold = earn(doc, LEAGUE.gold, 'quest');
    for (const [id, n] of LEAGUE.items) giveItem(doc, id, n), out.items.push(...Array(n).fill(id));
  }
  out.questsDone = syncQuests(doc, { kind: 'league', target: LEAGUE.id });
  return out;
}

/** Beaten: the badge (once), its gold and its things, and the journey's step.
 *  The league comes through here too (its crew is a leader's crew). */
export function leaderWin(doc, zoneId) {
  if (zoneId === LEAGUE.id) return leagueWin(doc);
  const l = LEADERS[zoneId];
  if (!l) return null;
  const first = !badgesOf(doc).includes(l.badge.id);
  const out = { zone: zoneId, badge: l.badge, first, gold: 0, items: [], questsDone: [] };
  if (first) {
    (doc.badges ||= []).push(l.badge.id);
    out.gold = earn(doc, l.gold, 'quest');
    for (const [id, n] of l.items) giveItem(doc, id, n), out.items.push(...Array(n).fill(id));
  }
  out.questsDone = syncQuests(doc, { kind: 'badge', target: zoneId, zone: zoneId });
  return out;
}

/**
 * A leader's team in a battle (base.js BattleSim, party-battle.js): all of
 * them on side b as bosses (no sphere takes one), the first out, the rest
 * waiting; the battle's `foe` is whichever is out now, so everything that
 * aims at "the foe" aims at the one standing there.
 */
export function addLeaderCrew(host, foe) {
  const crew = foe.team.map((m, i) => host.sim.add(new Combatant({
    side: 'b', kind: 'boss', name: SPECIES[m.species]?.name || m.species,
    creature: makeCreature(m.species, m.level), hpScale: foe.hpScale, scale: foe.scale,
    slot: i, benched: i > 0, leader: foe.leader, ownerId: `leader:${foe.leader}`,
  })));
  Object.defineProperty(host, 'foe', {
    get: () => crew.find((c) => c.onField) || crew.find((c) => c.alive) || crew[crew.length - 1],
    set() {}, configurable: true,
  });
  return crew;
}
