// A fight in the open: no battle screen. The circles round the action button
// are the lead's moves when a wild is in reach (client ui.js syncCluster);
// each press hits it where it stands, and it turns and hits back, until one
// of them is down. A wild that is beaten here pays exactly as one beaten in a
// battle (base.js resolve): experience, gold, its element's drops, a piece
// toward a saddle, the quests that count it. Catching still takes a battle —
// the action button starts one, as it always has.
//
// The trainer can fight too, with what is in their hand (shared/arms.js): a
// sword, a hammer, a bow, a staff. That is how one with no creature yet
// brings down their first, before a battle to catch it. The wild hits back
// at whoever hit it last — the creature, or the trainer — and once neither
// is standing the fight is lost.
//
// A fierce wild that runs a trainer down (field.js) starts one of these too,
// instead of pulling them into a battle.
//
// A wild in a fight is in `mode: 'fight'` on its doc, its prey the session it
// is on; its health is on the shared state (`hp`, `maxHp`) so everyone in the
// zone sees the bar go down. Walk away, go inside, or let it be for a while
// and it gives up and is whole again.
import { MOVES, SPECIES, DROPS, statsFor, typeMultiplier, skillsFor } from '../../shared/gamedata.js';
import { stepWithin } from '../../shared/worldplan.js';
import { eventMul } from '../../shared/events.js';
import { activeCreature, creaturePower, creatureScore, giveItem, grantItems, grantXp, grantXpTo, healTeam, publicProfile, syncQuests } from './combat.js';
import { hpRatio } from './player.js';
import { earn, spend } from './economy.js';
import { huntMaterial } from './saddles.js';
import { fieldLoot } from '../../shared/market.js';
import { armOf, trainerStats } from '../../shared/arms.js';
import { PROGRESSION } from '../../shared/gamedata.js';
import { sumStats, trainerMaxHp } from './combat.js';
import { claimMilestones } from './milestones.js';

export const FIGHT = {
  reach: 8,          // metres: a move reaches this far
  cdMs: 850,         // between two moves of yours
  wildHitMs: 1700,   // between two of its
  closeR: 1.9,       // it comes this close to hit
  leaveR: 14,        // you are this far off: it gives up
  speed: 3.6,        // m/s, closing in
  giveUpMs: 15_000,  // nobody hits it for this long: it gives up
  restMs: 20_000,    // and leaves everyone alone this long after
  blackoutGold: 0.02,
  trainerRegen: 0.03,      // of their health a second, out of a fight
  trainerRegenAfter: 6,    // seconds after the last hit before it starts
};

const wildStats = (w) => statsFor(w.species, w.level);

/** A move's damage, the way a battle counts it, near enough: level, power,
 *  attack over defence, the same-element bonus, the type chart. */
export function fieldDamage(att, attStats, move, def, defStats, rnd = Math.random) {
  const hits = move && move.kind !== 'status' && move.power > 0;
  const power = hits ? move.power : 30, special = hits && move.kind === 'special';
  const a = special ? attStats.spa : attStats.atk, dd = Math.max(1, special ? defStats.spd : defStats.def);
  const type = hits ? move.type : null;
  const stab = type && SPECIES[att.species]?.types?.includes(type) ? 1.2 : 1;
  const eff = type ? typeMultiplier(type, SPECIES[def.species]?.types || []) : 1;
  const base = (2 * att.level / 5 + 2) * power * (a / dd) / 50 + 2;
  return { dmg: Math.max(1, Math.floor(base * stab * eff * (0.85 + rnd() * 0.3))), eff };
}

function ensureHp(w, d) {
  if (!d.maxHp) { d.maxHp = wildStats(w).hp; d.hp = d.maxHp; }
  w.maxHp = d.maxHp; w.hp = d.hp;
}

/** It turns on `key` (a session), whoever hit it or whoever it ran down. */
export function startFight(w, d, key, targetId, now) {
  ensureHp(w, d);
  d.mode = 'fight'; d.prey = key; d.until = 0;
  d.fightUntil = now + FIGHT.giveUpMs;
  d.nextHit = Math.max(d.nextHit || 0, now + 600);
  w.alert = '⚔'; w.target = targetId || '';
}

/** It gives up: whole again, back to wandering, and leaves people be a while. */
export function endFight(w, d, now) {
  d.mode = ''; d.prey = ''; d.until = 0;
  d.hp = d.maxHp || 0;
  w.alert = ''; w.target = ''; w.hp = 0;
  d.restUntil = Math.max(d.restUntil || 0, now + FIGHT.restMs);
  d.next = 0;
}

/** A move of the lead at a wild (the `wildAttack` message). */
export function wildAttack(ctx, wildId, skill, now = Date.now()) {
  const doc = ctx.doc, me = ctx.self?.();
  const w = ctx.state.wilds.get(wildId), d = ctx.wildDocs.get(wildId);
  if (!w || !d || w.engagedBy) return ctx.net.emit('error', { code: 'wild_gone' }), null;
  if (!me || Math.hypot(w.x - me.x, w.z - me.z) > FIGHT.reach) return ctx.net.emit('error', { code: 'too_far' }), null;
  if (ctx.ride) return ctx.net.emit('error', { code: 'dismount_first' }), null;
  if (now < (ctx._fieldCd || 0)) return null;
  const a = activeCreature(doc);
  if (!a || a.hp <= 0) return ctx.net.emit('error', { code: 'no_healthy_creature' }), null;
  ctx._fieldCd = now + FIGHT.cdMs;

  const move = a.skills?.includes(skill) && MOVES[skill] ? MOVES[skill] : MOVES[a.skills?.[0]] || null;
  ensureHp(w, d);
  const { dmg, eff } = fieldDamage(a, statsFor(a.species, a.level, a.iv, a.star || 1, a.nature), move, w, wildStats(w));
  d.hp = Math.max(0, d.hp - dmg); w.hp = d.hp;
  if (d.mode !== 'fight') {
    startFight(w, d, ctx.fieldKey, doc.id, now);
    // the one on you: nothing else starts on you while it is (field.js)
    ctx.chasedBy ||= wildId;
  } else d.fightUntil = now + FIGHT.giveUpMs;
  d.by = 'lead'; d.leadHit = true;
  ctx.net.emit('fieldHit', { wildId, dmg, eff, hp: d.hp, maxHp: d.maxHp, skill: move?.id || null, uid: a.uid });
  if (d.hp <= 0) return fieldWin(ctx, wildId, w, d);
  return { dmg, hp: d.hp };
}

/** A trainer gets their breath back out of a fight: a few percent a second
 *  since they were last hit (FIGHT.trainerRegen), counted when it matters. */
export function restTrainer(doc, now = Date.now()) {
  const max = trainerMaxHp(doc);
  if (doc.trainerHp == null || doc.trainerHp >= max) return;
  const since = Math.max(0, now - (doc.trainerHitAt || 0)) / 1000 - FIGHT.trainerRegenAfter;
  if (since <= 0) return;
  doc.trainerHp = Math.min(max, Math.floor(doc.trainerHp + max * FIGHT.trainerRegen * since));
  doc.trainerHitAt = now - FIGHT.trainerRegenAfter * 1000;
}

/** The trainer's own stats in the open: level, gear and what is worn. */
export function trainerFieldStats(doc) {
  return trainerStats(doc.level || 1, sumStats(doc), PROGRESSION.trainerHp(doc.level || 1));
}

/** The trainer hits a wild with what is in their hand (the `armStrike` message). */
export function armStrike(ctx, wildId, now = Date.now()) {
  const doc = ctx.doc, me = ctx.self?.();
  const w = ctx.state.wilds.get(wildId), d = ctx.wildDocs.get(wildId);
  if (!w || !d || w.engagedBy) return ctx.net.emit('error', { code: 'wild_gone' }), null;
  if (d.mode === 'fight' && d.prey !== ctx.fieldKey) return ctx.net.emit('error', { code: 'wild_gone' }), null;
  const arm = armOf(doc);
  if (!me || Math.hypot(w.x - me.x, w.z - me.z) > arm.reach + 0.6) return ctx.net.emit('error', { code: 'too_far', reach: arm.reach }), null;
  if (ctx.ride) return ctx.net.emit('error', { code: 'dismount_first' }), null;
  if (now < (ctx._armCd || 0)) return null;
  restTrainer(doc, now);
  if ((doc.trainerHp ?? 1) <= 0) return ctx.net.emit('error', { code: 'trainer_down' }), null;
  ctx._armCd = now + arm.cdMs;
  ensureHp(w, d);
  const { dmg, eff } = fieldDamage({ species: null, level: doc.level || 1 }, trainerFieldStats(doc), { power: arm.power, kind: arm.kind, type: null }, w, wildStats(w));
  d.hp = Math.max(0, d.hp - dmg); w.hp = d.hp;
  if (d.mode !== 'fight') {
    startFight(w, d, ctx.fieldKey, doc.id, now);
    ctx.chasedBy ||= wildId;
  } else d.fightUntil = now + FIGHT.giveUpMs;
  d.by = 'arm'; d.armHit = true;
  ctx.net.emit('fieldHit', { wildId, dmg, eff, hp: d.hp, maxHp: d.maxHp, arm: arm.id, item: arm.item, trainer: true });
  if (d.hp <= 0) return fieldWin(ctx, wildId, w, d);
  return { dmg, hp: d.hp };
}

/** Down: paid as a battle won is (base.js resolve), and gone from the field. */
function fieldWin(ctx, wildId, w, d = {}) {
  const doc = ctx.doc, foe = { species: w.species, level: w.level };
  // the lead learns from it only if it was in it
  const lead = d.leadHit || !d.armHit ? activeCreature(doc) : null;
  const o = { wildId, species: w.species, won: true, xp: 0, gold: 0, items: [], events: [], questsDone: [] };
  const xp = Math.round(creaturePower(foe, doc.level) * eventMul('xp')), gold = Math.round(creatureScore(foe) * eventMul('gold'));
  earn(doc, gold, 'battle');
  o.xp = xp; o.gold = gold;
  lead && o.events.push(...grantXpTo(lead, xp, doc));
  // a trainer who fought it alone learns all of it
  o.events.push(...grantXp(doc, Math.floor(xp * (lead && lead.hp > 0 ? 0.6 : 1))));
  const stats = (doc.stats ||= {});
  stats.battlesWon = (stats.battlesWon || 0) + 1;
  stats.fieldKills = (stats.fieldKills || 0) + 1;
  if (d.by === 'arm') stats.armKills = (stats.armKills || 0) + 1;
  o.questsDone = syncQuests(doc, { kind: 'defeat', zone: ctx.zoneId, species: w.species, elements: SPECIES[w.species]?.types || [] });
  const el = SPECIES[w.species]?.types?.[0] || 'metal';
  for (const it of grantItems(doc, DROPS.roll(el, doc.level, 'wild'))) o.items.push(it.id);
  // and now and then a potion, a sphere, or something to wear (shared/market.js)
  for (const id of fieldLoot(doc.level || 1)) { giveItem(doc, id, 1); o.items.push(id); }
  o.mat = huntMaterial(doc, w.species);
  if (ctx.chasedBy === wildId) ctx.chasedBy = null;
  ctx.state.wilds.delete(wildId); ctx.wildDocs.delete(wildId);
  const me = ctx.self?.();
  me && (me.hpRatio = hpRatio(doc));
  o.milestones = claimMilestones(doc);
  ctx.net.save();
  o.profile = publicProfile(doc);
  ctx.net.emit('fieldWin', o);
  return o;
}

/** It hits back: at whoever hit it last — the lead, or the trainer — and at
 *  the other when that one is down. Nobody standing: the fight is lost. */
function counter(world, entry, wildId, w, d, now) {
  const { ctx, doc } = entry;
  const a = activeCreature(doc);
  const leadUp = !!a && a.hp > 0, maxT = trainerMaxHp(doc);
  if (doc.trainerHp == null) doc.trainerHp = maxT;
  restTrainer(doc, now);
  const meUp = doc.trainerHp > 0;
  const atMe = meUp && (d.by === 'arm' || !leadUp);
  if (!atMe && !leadUp) {
    // nobody left standing: as a blackout, without the walk back to camp
    const lost = spend(doc, Math.floor((doc.gold || 0) * FIGHT.blackoutGold), 'blackout');
    healTeam(doc, 1);
    entry.p && (entry.p.hpRatio = hpRatio(doc));
    ctx.net.save();
    ctx.net.emit('fieldLost', { wildId, gold: -lost, profile: publicProfile(doc) });
    if (ctx.chasedBy === wildId) ctx.chasedBy = null;
    endFight(w, d, now);
    return;
  }
  const moves = skillsFor(w.species, w.level).map((m) => MOVES[m]).filter((m) => m && m.kind !== 'status' && m.power > 0);
  const move = moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
  if (atMe) {
    const { dmg, eff } = fieldDamage(w, wildStats(w), move, { species: null, level: doc.level || 1 }, trainerFieldStats(doc));
    doc.trainerHp = Math.max(0, doc.trainerHp - dmg); doc.trainerHitAt = now;
    ctx.net.save();
    const down = doc.trainerHp <= 0;
    ctx.net.emit('fieldCounter', { wildId, dmg, eff, trainer: true, hp: doc.trainerHp, maxHp: maxT, fainted: down, skill: move?.id || null, profile: publicProfile(doc) });
    // down, with a creature still standing: it is the one fighting now
    if (down) d.by = 'lead';
    return;
  }
  const { dmg, eff } = fieldDamage(w, wildStats(w), move, a, statsFor(a.species, a.level, a.iv, a.star || 1, a.nature));
  a.hp = Math.max(0, a.hp - dmg);
  entry.p && (entry.p.hpRatio = hpRatio(doc));
  ctx.net.save();
  const fainted = a.hp <= 0;
  if (fainted) d.by = 'arm';
  ctx.net.emit('fieldCounter', { wildId, dmg, eff, uid: a.uid, hp: a.hp, maxHp: a.maxHp, fainted, skill: move?.id || null, ...(fainted ? { profile: publicProfile(doc) } : {}) });
}

/** One tick of a wild in a fight (field.js tickField). */
export function tickFight(world, id, w, d, now, dt) {
  const entry = world.player(d.prey);
  const p = entry?.p;
  const off = !p || entry.ctx?.inside || entry.ctx?.away || entry.ctx?.ride;
  const dist = p ? Math.hypot(p.x - w.x, p.z - w.z) : Infinity;
  if (off || dist > FIGHT.leaveR || now > (d.fightUntil || 0)) {
    if (entry?.ctx?.chasedBy === id) entry.ctx.chasedBy = null;
    endFight(w, d, now);
    return;
  }
  const dx = p.x - w.x, dz = p.z - w.z;
  w.rot = Math.atan2(dx, dz);
  if (dist > FIGHT.closeR) {
    const k = Math.min(dist - FIGHT.closeR, FIGHT.speed * dt) / dist;
    const q = stepWithin(world.zone, world.colliders, w.x, w.z, w.x + dx * k, w.z + dz * k, 0.5);
    w.x = q.x; w.z = q.z;
  }
  if (now >= (d.nextHit || 0) && dist <= FIGHT.closeR + 0.8) {
    d.nextHit = now + FIGHT.wildHitMs;
    counter(world, entry, id, w, d, now);
  }
}
