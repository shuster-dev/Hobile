// The whole journey, played by a bot: from the first word with Elder Maro to
// the League of Champions, through the real quest code and the real battles.
//
//   node tools/journey-bot.mjs            # the report, step by step
//   node tools/journey-bot.mjs --seed=7
//
// "The step does not move" is a bug a player finds an hour in, and every one
// so far (the partner who would not grow, the numbers that did not keep up)
// was found that way. This walks the same road on every run:
//
//   - each step of the journey is done the way the game does it: a talk
//     through speakTo, a fight through BattleSim (whose own resolve counts
//     the quest, pays the XP and the badge), a catch the way a battle's
//     capture records it, a world's errands opened on setting foot there;
//   - between fights the team is healed (a player at the clinic), and a
//     leader who wins sends the bot back to the wilds for a few more fights;
//   - dungeons, the world boss and the story fights are marked done by the
//     event their own code sends (they have their own tests).
//
// It fails when a step does not complete from what should complete it, when
// the next step does not open, or when a leader (or the league) cannot be
// beaten within a fair number of fights. tools/qa.mjs runs it too.
globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const R = new URL('../src/', import.meta.url).href;
const G = await import(R + 'shared/gamedata.js');
const C = await import(R + 'server/game/combat.js');
const L = await import(R + 'shared/leaders.js');
const LG = await import(R + 'shared/league.js');
const SAGA = await import(R + 'shared/saga.js');
const SV = await import(R + 'server/game/saga.js');
const W = await import(R + 'server/game/world-messages.js');
const N = await import(R + 'shared/npcs.js');
const B = await import(R + 'server/game/base.js');
const { controlled } = await import('./balance.mjs');
const { QUESTS, MAIN_QUEST_IDS, ZONES, SPECIES, HOME_ZONE, typeMultiplier } = G;

const SHARP = { react: 700, pick: 'best' };
/** How many fights in a world before its leader must have fallen. */
export const LEADER_BUDGET = 160;

/** The bot's pick: the strongest ready move against what is out now. */
function choose(me, foe, now) {
  let best = null, score = -1;
  for (const id of me.skills || []) {
    const m = G.MOVES[id];
    if (!m || (me.cooldowns[m.id] || 0) > now || me.stamina < m.cost) continue;
    const v = m.kind === 'status' ? 10 : (m.power || 30) * (m.type ? typeMultiplier(m.type, foe.types) : 1) * (m.type && me.types.includes(m.type) ? 1.5 : 1) * (m.acc || 1);
    if (v > score) { score = v; best = m; }
  }
  return best;
}

const POTIONS = ['potion_l', 'potion_m', 'potion_s'];
/** One fight through the real BattleSim, on the fake clock. The bot drinks
 *  from its own bag (one potion every few seconds, when the one out is under
 *  a third), as a player in a hard fight does. */
function fight(doc, zoneId, wild, clock, maxMs) {
  const net = { doc, guilds: [], emit: () => {}, save: () => {}, pendingRooms: new Map() };
  const b = new B.BattleSim(net, { zoneId, wild });
  b.state.phase = 'active';
  const t0 = clock.now;
  let next = clock.now + 600, drank = 0, potions = 0;
  while (!b.sim.finished && clock.now - t0 < maxMs) {
    clock.now += 100;
    b.sim.update(100);
    if (b.sim.finished || clock.now < next) continue;
    const you = b.you, pot = POTIONS.find((id) => (doc.inventory?.[id] || 0) > 0);
    if (pot && you.hp < you.maxHp / 3 && clock.now - drank > 3500) {
      b.handle('trainer', { action: 'potion', item: pot }); drank = clock.now; potions++; next = clock.now + 900; continue;
    }
    const m = choose(you, b.foe, clock.now);
    if (m) { b.handle('skill', { skill: m.id }); next = clock.now + SHARP.react; } else next = clock.now + 200;
  }
  const outcome = b.sim.result?.outcome || 'timeout';
  return { won: outcome === 'a', lost: outcome === 'b', ms: clock.now - t0, potions };
}

/** The step of the journey that is open now. */
const current = (doc) => Object.keys(doc.quests.active).find((k) => QUESTS[k]?.chain === 'main' && !doc.quests.active[k].claimed) || null;

/** How well a species does against a team: its elements against theirs, and theirs against it. */
function edge(species, team) {
  const me = SPECIES[species]?.types || [];
  let s = 0;
  for (const { species: f } of team) {
    const them = SPECIES[f]?.types || [];
    s += Math.max(...me.map((t) => typeMultiplier(t, them))) - Math.max(...them.map((t) => typeMultiplier(t, me))) * 0.6;
  }
  return s;
}

export function playJourney({ seed = 1, eager = false, log = () => {} } = {}) {
  return controlled(seed, (clock) => {
    const doc = C.createPlayerDoc('bot', 'Bot', {}, 'none');
    C.normalizeDoc(doc);
    const problems = [], rows = [], seen = new Set();
    let fights = 0, zone = HOME_ZONE;
    const net = { emit: () => {}, save: () => {} };
    const lvl = () => C.teamCreatures(doc).map((c) => `${c.species}${c.level}`).join(' ');
    const top = () => Math.max(0, ...C.teamCreatures(doc).map((c) => c.level || 1));
    const heal = () => { C.healTeam(doc, 1); doc.trainerHp = C.trainerMaxHp ? C.trainerMaxHp(doc) : doc.trainerHp; };

    /** Setting foot in a world: its errands open, as WorldRoom does. */
    const enter = (z) => {
      if (zone === z && seen.has(z)) return;
      zone = z; doc.zone = z;
      C.activateZoneQuests(doc, z);
      if (!seen.has(z)) { seen.add(z); recruit(z); eager && ahead(z); }
    };
    /** The eager player: on first setting foot in a world, every errand
     *  there and its leader, before the journey has asked for either. */
    const ahead = (z) => {
      for (let k = 0; k < 80; k++) {
        const e = Object.keys(doc.quests.active).find((x) => QUESTS[x]?.chain === 'zone' && QUESTS[x].goal?.zone === z);
        if (!e) break;
        const zg = QUESTS[e].goal;
        zg.kind === 'capture' ? capture(z, zg.species || wild(z).species, ZONES[z].levels[0]) : battle(z, wild(z));
      }
      const ld = L.LEADERS[z];
      for (let k = 0; ld && k < 40 && !(doc.badges || []).includes(ld.badge.id); k++) {
        battle(z, { species: ld.team[0][0], level: ld.team[0][1], leader: z, team: ld.team.map(([species, level]) => ({ species, level })), hpScale: L.LEADER_FOE.hpScale, scale: L.LEADER_FOE.scale });
        for (let j = 0; j < 4; j++) battle(z, wild(z));
      }
      // ...and straight on through the gate the badge opens, long before the
      // journey says to go
      const nx = L.LEADER_ORDER[L.LEADER_ORDER.indexOf(z) + 1];
      if (nx && !seen.has(nx) && (doc.badges || []).includes(ld?.badge.id)) { const back = zone; enter(nx); zone = back; }
    };
    /** A catch, recorded the way a battle's capture is. */
    const capture = (z, species, level) => {
      const c = C.makeCreature(species, level);
      doc.stats.captures += 1;
      C.dexRecord(doc, c.species, c);
      C.takeIn(doc, c);
      C.syncQuests(doc, { kind: 'capture', zone: z, species: c.species, elements: SPECIES[c.species]?.types || [] });
    };
    /** What a thoughtful player catches on arriving: the local that does best
     *  against this world's leader, at the world's own level. */
    const recruit = (z) => {
      const ld = L.LEADERS[z], spawns = (ZONES[z]?.spawns || []).map(([s]) => s).filter((s) => SPECIES[s] && SPECIES[s].rarity !== 'boss');
      if (!ld || !spawns.length) return;
      const pick = spawns.sort((a, b) => edge(b, ld.team.map(([s]) => ({ species: s }))) - edge(a, ld.team.map(([s]) => ({ species: s }))))[0];
      capture(z, pick, ZONES[z].levels[1]);
    };
    const wild = (z) => {
      const sp = (ZONES[z]?.spawns || []).filter(([s]) => SPECIES[s] && SPECIES[s].rarity !== 'boss');
      const [species] = sp[Math.floor(Math.random() * sp.length)];
      const [lo, hi] = ZONES[z].levels;
      return { species, level: lo + Math.floor(Math.random() * (hi - lo + 1)) };
    };
    const battle = (z, foe) => { fights++; const r = fight(doc, z, foe, clock, 900_000); heal(); return r; };

    const steps = [];
    for (let guard = 0; guard < 80; guard++) {
      const id = current(doc);
      if (!id) break;
      const q = QUESTS[id], g = q.goal || {}, before = fights;
      let note = '';
      if (g.kind === 'talk') {
        const at = N.npcAt(g.target, 0.4);
        if (!at) { problems.push(`${id}: nobody called ${g.target} to talk to`); break; }
        enter(HOME_ZONE);
        W.speakTo({ net, self: () => ({ x: at.x, z: at.z }) }, doc, g.target, 0.4);
      } else if (g.kind === 'capture') {
        const z = g.zone || HOME_ZONE;
        enter(z);
        for (let k = 0; k < (g.count || 1); k++) capture(z, wild(z).species, 4);
      } else if (g.kind === 'grow') {
        for (let k = 0; k < 40 && !doc.quests.active[id]?.claimed && current(doc) === id; k++) battle(HOME_ZONE, wild(HOME_ZONE));
        note = `${fights - before} fights to grow`;
      } else if (g.kind === 'defeat') {
        enter(g.zone);
        for (let k = 0; k < 60 && current(doc) === id; k++) battle(g.zone, wild(g.zone));
      } else if (g.kind === 'claim') {
        enter(g.zone);
        for (let k = 0; k < 80 && current(doc) === id; k++) {
          const z = Object.keys(doc.quests.active).find((x) => QUESTS[x]?.chain === 'zone' && QUESTS[x].goal?.zone === g.zone);
          if (!z) { problems.push(`${id}: no errand of ${g.zone} open, and the step waits on one`); break; }
          const zg = QUESTS[z].goal;
          if (zg.kind === 'capture') capture(g.zone, zg.species || wild(g.zone).species, ZONES[g.zone].levels[0]);
          else battle(g.zone, wild(g.zone));
        }
      } else if (g.kind === 'badge') {
        enter(g.zone);
        const ld = L.LEADERS[g.zone];
        let tries = 0;
        while (current(doc) === id && fights - before < LEADER_BUDGET) {
          tries++;
          const r = battle(g.zone, { species: ld.team[0][0], level: ld.team[0][1], leader: g.zone, team: ld.team.map(([species, level]) => ({ species, level })), hpScale: L.LEADER_FOE.hpScale, scale: L.LEADER_FOE.scale });
          if (!r.won) for (let k = 0; k < 6; k++) battle(g.zone, wild(g.zone));
        }
        note = `${tries} tries, ${fights - before} fights`;
        if (current(doc) === id) problems.push(`${id}: ${ld.he} still standing after ${fights - before} fights (team ${lvl()})`);
      } else if (g.kind === 'league') {
        enter(HOME_ZONE);
        let tries = 0;
        while (current(doc) === id && fights - before < LEADER_BUDGET * 2) {
          tries++;
          const t = LG.LEAGUE_TEAM;
          const r = battle(HOME_ZONE, { species: t[0].species, level: t[0].level, leader: 'league', team: t.map(({ species, level }) => ({ species, level })), hpScale: LG.LEAGUE.hpScale, scale: LG.LEAGUE.scale });
          if (!r.won) for (let k = 0; k < 8; k++) battle('umbral_grove', wild('umbral_grove'));
        }
        note = `${tries} tries, ${fights - before} fights`;
        if (current(doc) === id) problems.push(`${id}: the league still unbeaten after ${fights - before} fights (team ${lvl()})`);
      } else if (g.kind === 'dungeon') {
        C.syncQuests(doc, { kind: 'dungeon', target: g.target }); note = 'dungeon: by its event';
      } else if (g.kind === 'boss') {
        // the world boss the way a player hits it: through the message the
        // client sends (world-messages.js bossAttack), online, where the step
        // once never closed
        const wb = G.WORLD_BOSSES[0], sent = [];
        const ctx = { doc, online: true, self: () => ({ x: wb.x, z: wb.z }), state: { boss: { active: true, x: wb.x, z: wb.z, hp: 1e6, maxHp: 1e6 } },
          bossContribution: new Map(), refreshBossBoard: () => {}, net: { emit: (k, v) => sent.push(k), save: () => {} } };
        W.handleWorldMessage(ctx, 'bossAttack', {});
        note = 'world boss: one hit';
      } else if (g.kind === 'anchor') {
        for (const a of SAGA.ANCHORS) SV.storyWin(doc, a.id);
      } else if (g.kind === 'story') {
        SV.storyWin(doc, g.target);
      } else if (g.kind === 'dex') {
        for (const s of Object.keys(SPECIES)) SPECIES[s].rarity !== 'boss' && C.dexRecord(doc, s, C.makeCreature(s, 5));
        C.syncQuests(doc, { kind: 'dex' });
      } else {
        problems.push(`${id}: the bot does not know how to do a "${g.kind}" step`);
        break;
      }
      const after = current(doc);
      if (after === id) { problems.push(`${id}: did not complete from its own goal (${JSON.stringify(g)})`); break; }
      // the next step opens; ones already done (a held goal got to first) are
      // paid and passed on the way, never skipped unpaid
      const i0 = MAIN_QUEST_IDS.indexOf(id), i1 = after ? MAIN_QUEST_IDS.indexOf(after) : MAIN_QUEST_IDS.length;
      if (i1 <= i0) problems.push(`${id}: the journey went back to ${after}`);
      for (const k of MAIN_QUEST_IDS.slice(i0 + 1, i1)) doc.quests.done.includes(k) || problems.push(`${id}: ${k} was skipped without being done`);
      const row = { id, he: q.he, fights: fights - before, top: top(), team: lvl(), note };
      steps.push(row); log(row);
    }
    if (current(doc)) problems.push(`stopped at ${current(doc)}`);
    if (!doc.league?.at) problems.push('the league was never won');
    if (!doc.champion?.league) problems.push('the league winner is not on the wall');
    return { problems, steps, fights, doc };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = Number(process.argv.find((a) => a.startsWith('--seed='))?.split('=')[1] || 1);
  const eager = process.argv.includes('--eager');
  const t0 = Date.now();
  const r = playJourney({ seed, eager, log: (s) => console.log(`${s.id.padEnd(26)} ${String(s.fights).padStart(4)} fights  top ${String(s.top).padStart(2)}  ${s.note.padEnd(22)} ${s.team}`) });
  console.log(`\n${r.fights} fights in all, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  if (r.problems.length) { console.log('\nPROBLEMS'); for (const p of r.problems) console.log('  ' + p); process.exit(1); }
  console.log('the whole journey, start to finish: ok');
}
