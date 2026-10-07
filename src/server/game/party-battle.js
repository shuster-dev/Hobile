// A fight with more than one player in it — and, online, every fight.
//
//   pve   one or more players against a wild. It starts with whoever engaged
//         it; party members nearby can join while it lasts (social.js offers
//         it to them), and the wild stands up to the extra hands.
//   pvp   players against players: one against one, or two against two. Both
//         sides fight at full health and nobody's team is hurt by it after;
//         the winners get a little gold and experience, the losers lose nothing.
//
// The rules of a fight are Combat's (combat.js), which has always grouped
// combatants by owner — a side can hold several trainers and their teams. What
// this adds is the people: each player's own active creature to act through,
// their own sphere and potions, what each takes home, and someone leaving
// halfway. The single-player build keeps BattleSim (base.js); the reward rules
// here follow its `resolve` line by line, so the two settle a wild the same way.
import {
  Combat, Combatant, activeCreature, addCreature, creatureCard, creaturePower, creatureScore, dexRecord,
  duplicateReward, giveItem, grantItems, grantXp, grantXpTo, healTeam, makeCreature, publicProfile,
  statsOf, sumStats, swapToUid, syncQuests, takeItem, teamCreatures,
} from './combat.js';
import { DROPS, ITEMS, SPECIES, WILD_TIERS, ZONES } from '../../shared/gamedata.js';
import { weatherAt } from '../../shared/weather.js';
import { FIELD } from './field.js';

export const PARTY_BATTLE = {
  tickMs: 100,
  joinScale: 0.7,      // the wild's health grows this much for each extra player
  pvpCountdownMs: 3000,
};

export class PartyBattle {
  constructor({ mode = 'pve', zoneId, wild = null, onEnd = null, broadcast = null } = {}) {
    this.mode = mode === 'pvp' ? 'pvp' : 'pve';
    this.zoneId = zoneId;
    this.onEnd = onEnd || (() => {});
    this.broadcast = broadcast || (() => {});
    this.onSync = null;
    this.parts = new Map();
    this.phase = 'waiting';
    this.started = false;
    this.resolved = false;
    this._ended = false;
    this.weather = weatherAt(ZONES[zoneId], Date.now());
    this.sim = new Combat({ mode: this.mode, weather: this.weather, onEvent: (e) => this.onSimEvent(e) });
    this.foe = null;
    if (this.mode === 'pve' && wild) {
      const tier = WILD_TIERS[zoneId] || {};
      this.foe = this.sim.add(new Combatant({
        side: 'b', kind: 'wild', name: SPECIES[wild.species]?.name || wild.species,
        creature: makeCreature(wild.species, wild.level), scale: tier.scale, ai: tier.ai,
      }));
      this.foeBaseHp = this.foe.maxHp;
    }
  }

  /** A player steps in: their team, and their trainer behind it. */
  addPlayer(doc, side, emit) {
    const was = this.parts.get(doc.id);
    if (was && !was.left) { was.emit = emit; return was; }
    const gear = sumStats(doc);
    // A duel is fought at full health and leaves the team as it was: it fights
    // with copies, so nothing it does is written back.
    const team = teamCreatures(doc).map((c) => (this.mode === 'pvp' ? { ...c, hp: statsOf(c).hp } : c));
    const lead = team.find((c) => c.hp > 0) || team[0] || null;
    const roster = [];
    team.forEach((creature, i) => {
      const c = this.sim.add(new Combatant({
        side, kind: 'creature', name: SPECIES[creature.species]?.name || creature.species,
        creature, ownerId: doc.id, slot: i, benched: creature !== lead, gearBonus: gear,
      }));
      roster.push({ id: c.id, uid: creature.uid });
    });
    const anchor = this.sim.combatants.get(roster.find((x) => x.uid === lead?.uid)?.id) || null;
    const trainer = this.sim.add(new Combatant({
      side, kind: 'trainer', name: doc.name, ownerId: doc.id, level: doc.level, benched: !!anchor, gearBonus: gear,
    }));
    const part = { id: doc.id, doc, side, emit, roster, anchor, trainer, left: false, capture: null };
    this.parts.set(doc.id, part);
    this.scaleFoe();
    this.sync();
    if (this.started) {
      // joining a fight already going: the screen opens straight onto it
      emit('battleInit', this.initPayload(part));
      emit('battleStart', { at: Date.now(), joined: true });
      this.broadcast('allyJoined', { id: doc.id, name: doc.name, side, players: this.players() });
    }
    return part;
  }

  /** More players against one wild: it gets tougher, not easier. */
  scaleFoe() {
    if (!this.foe) return;
    const n = [...this.parts.values()].filter((p) => !p.left).length;
    const want = Math.round(this.foeBaseHp * (1 + PARTY_BATTLE.joinScale * Math.max(0, n - 1)));
    if (want === this.foe.maxHp) return;
    const ratio = this.foe.hp / Math.max(1, this.foe.maxHp);
    this.foe.maxHp = want;
    this.foe.hp = Math.max(this.foe.hp > 0 ? 1 : 0, Math.round(want * ratio));
  }

  /** The combatant a player acts through: their creature on the field, or
   *  their trainer once the team is down. */
  you(part) {
    return (part.anchor && this.sim.combatants.has(part.anchor.id) && this.sim.activeOf(part.anchor)) || part.anchor || part.trainer;
  }

  players() {
    return [...this.parts.values()].filter((p) => !p.left).map((p) => ({
      id: p.id, name: p.doc.name, level: p.doc.level, side: p.side, appearance: p.doc.appearance,
    }));
  }

  initPayload(part) {
    return {
      mode: this.mode,
      duel: this.mode === 'pvp',
      side: part.side,
      you: this.you(part).id,
      team: part.roster,
      trainer: part.trainer?.id || null,
      players: this.players(),
      weather: this.weather && { id: this.weather.id, he: this.weather.he, boost: this.weather.boost },
      inventory: part.doc.inventory,
      profile: publicProfile(part.doc),
    };
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.sync();
    const go = () => {
      if (this.resolved) return;
      for (const p of this.parts.values()) if (!p.left) p.emit('battleInit', this.initPayload(p));
      this.phase = 'active';
      this.broadcast('battleStart', { at: Date.now() });
    };
    if (this.mode === 'pvp') {
      // everyone sees the other side before anything moves
      for (const p of this.parts.values()) if (!p.left) p.emit('battleInit', this.initPayload(p));
      this.phase = 'countdown';
      this.broadcast('battleCountdown', { until: Date.now() + PARTY_BATTLE.pvpCountdownMs, players: this.players() });
      this._go = setTimeout(go, PARTY_BATTLE.pvpCountdownMs);
    } else this._go = setTimeout(go, 80);
    this.timer = setInterval(() => {
      if (this.phase === 'active') { this.sim.update(PARTY_BATTLE.tickMs); this.sync(); }
    }, PARTY_BATTLE.tickMs);
  }

  stop() {
    clearInterval(this.timer); clearTimeout(this._go);
    this.finish(false);
  }

  /** Once, whatever ends it: the wild is let go (or taken), the field calms. */
  finish(taken) {
    if (this._ended) return;
    this._ended = true;
    for (const p of this.parts.values()) p.doc && (p.doc.calmUntil = Date.now() + FIELD.battleCalmMs);
    this.onEnd(taken);
  }

  sync() { this.onSync?.(); }

  onSimEvent(e) {
    this.broadcast('battleEvent', e);
    if (e.kind === 'end') this.resolve(e);
  }

  /** Someone walks out — runs, forfeits, or drops. The rest fight on. */
  leave(id, why = 'fled') {
    const part = this.parts.get(id);
    if (!part || part.left || this.resolved) return;
    const you = this.you(part);
    // what their creature has left goes home with it (as a run does in BattleSim)
    if (this.mode === 'pve') { const n = activeCreature(part.doc); n && you?.creature && (n.hp = Math.max(0, Math.round(you.hp))); }
    part.left = true;
    if (this.sim.pendingThrow && this.sim.combatants.get(this.sim.pendingThrow.by)?.ownerId === id) {
      this.sim.pendingThrow = null;
      for (const c of this.sim.combatants.values()) c.frozenUntil = 0;
    }
    for (const [cid, c] of [...this.sim.combatants]) if (c.ownerId === id) this.sim.combatants.delete(cid);
    this.sim.pendingSwitch.delete(id); this.sim.switchReady.delete(id);
    if (why === 'fled' || why === 'forfeit') {
      part.doc.calmUntil = Date.now() + FIELD.battleCalmMs;
      part.emit('battleEnd', { outcome: 'fled', won: false, xp: 0, gold: 0, items: [], events: [], questsDone: [], forfeit: why === 'forfeit', profile: publicProfile(part.doc) });
    }
    this.broadcast('allyLeft', { id, name: part.doc.name, side: part.side, players: this.players() });
    this.scaleFoe();
    const left = [...this.parts.values()].filter((p) => !p.left);
    if (this.mode === 'pve' && !left.length) { this.resolved = true; this.phase = 'over'; this.sim.finished = true; this.finish(false); return; }
    this.sim.checkEnd();
    this.sync();
  }

  handle(id, type, t = {}) {
    const part = this.parts.get(id);
    if (!part || part.left) return;
    if (type === 'ready') { part.emit('battleInit', this.initPayload(part)); return; }
    if (this.phase !== 'active') return;
    const doc = part.doc, you = this.you(part);
    if (type === 'swap') {
      const r = swapToUid(this.sim, you, t.uid);
      r.ok || part.emit('actionRejected', { reason: r.reason, uid: t.uid });
      this.sync();
      return;
    }
    if (type === 'skill') {
      const target = typeof t.target === 'string' ? t.target : null;
      const r = this.sim.useSkill(you.id, t.skill, target);
      r.ok || part.emit('actionRejected', { reason: r.reason, skill: t.skill });
      this.sync();
      return;
    }
    if (type !== 'trainer') return;
    if (t.action === 'sphere') {
      if (this.mode === 'pvp') return part.emit('actionRejected', { reason: 'cannot_capture_players' });
      if (ZONES[this.zoneId]?.capturable === false) return part.emit('actionRejected', { reason: 'no_capture_here' });
      const sphere = ITEMS[t.sphere] ? t.sphere : 'sphere_basic';
      if (!takeItem(doc, sphere, 1)) return part.emit('actionRejected', { reason: 'no_sphere' });
      const r = this.sim.trainerAction(you.id, 'sphere', { sphere });
      if (r.ok) { part.capture = { species: this.foe.species, level: this.foe.level }; this.captureBy = id; }
      else { giveItem(doc, sphere, 1); part.emit('actionRejected', { reason: r.reason }); }
      part.emit('inventory', doc.inventory);
    } else if (t.action === 'potion') {
      const item = ITEMS[t.item]?.kind === 'heal' ? t.item : 'potion_s';
      if (!takeItem(doc, item, 1)) return part.emit('actionRejected', { reason: 'no_item' });
      you.hp = Math.min(you.maxHp, you.hp + ITEMS[item].amount);
      this.sim.emit({ kind: 'heal', target: you.id, amount: ITEMS[item].amount, hp: you.hp, source: 'item' });
      part.emit('inventory', doc.inventory);
    } else if (t.action === 'flee') {
      const others = [...this.parts.values()].some((p) => !p.left && p !== part && p.side === part.side);
      if (this.mode === 'pvp') this.leave(id, 'forfeit');
      else if (others) this.leave(id, 'fled');
      else {
        const r = this.sim.trainerAction(you.id, 'flee');
        r.ok || part.emit('actionRejected', { reason: r.reason });
      }
    } else {
      const r = this.sim.trainerAction(you.id, t.action);
      r.ok || part.emit('actionRejected', { reason: r.reason });
    }
    this.sync();
  }

  resolve(e) {
    if (this.resolved) return;
    this.resolved = true;
    this.phase = 'over';
    clearInterval(this.timer);
    for (const part of this.parts.values()) {
      if (part.left) continue;
      part.emit('battleEnd', this.mode === 'pvp' ? this.settlePvp(part, e) : this.settleWild(part, e));
    }
    this.sync();
    // a wild that was beaten or caught is gone from the field (as in BattleSim)
    this.finish(this.mode === 'pve' && (e.outcome === 'a' || e.outcome === 'captured'));
  }

  /** What one player takes home from a wild — BattleSim.resolve, per player. */
  settleWild(part, e) {
    const t = part.doc, n = activeCreature(t), you = this.you(part);
    const won = e.outcome === 'a', captured = e.outcome === 'captured';
    const mine = captured && this.captureBy === part.id && part.capture;
    const o = { outcome: captured && !mine ? 'a' : e.outcome, won: won || (captured && !mine), xp: 0, gold: 0, items: [], events: [], questsDone: [], coop: [...this.parts.values()].filter((p) => !p.left).length > 1 };
    if (n && you?.creature) n.hp = Math.max(0, Math.round(you.hp));
    if (won || captured) {
      const a = creaturePower(this.foe, t.level), l = creatureScore(this.foe);
      t.gold += l; o.xp = a; o.gold = l;
      n && o.events.push(...grantXpTo(n, a));
      o.events.push(...grantXp(t, Math.floor(a * 0.6)));
      if (won || (captured && !mine)) {
        const sp = this.foe?.creature?.species;
        t.stats.battlesWon += 1;
        o.questsDone = syncQuests(t, { kind: 'defeat', zone: this.zoneId, species: sp, elements: SPECIES[sp]?.types || [] });
        const el = SPECIES[sp]?.types?.[0] || 'metal';
        for (const d of grantItems(t, DROPS.roll(el, t.level, 'wild'))) o.items.push(d.id);
        if (Math.random() < 0.2) { giveItem(t, 'potion_s', 1); o.items.push('potion_s'); }
      }
      if (mine) {
        const c = makeCreature(part.capture.species, part.capture.level);
        addCreature(t, c); t.stats.captures += 1; o.captured = c;
        const dex = dexRecord(t, c.species, c);
        o.newSpecies = dex.isNew; o.dexCount = dex.caught; o.card = creatureCard(t, c.uid);
        if (!dex.isNew) o.duplicate = duplicateReward(t, c.species);
        o.questsDone.push(...syncQuests(t, { kind: 'capture', zone: this.zoneId, species: c.species, elements: SPECIES[c.species]?.types || [] }));
      }
    } else if (e.outcome !== 'fled') {
      t.stats.deaths += 1;
      const lost = Math.floor(t.gold * 0.02);
      t.gold = Math.max(0, t.gold - lost); o.gold = -lost; o.blackout = true; healTeam(t, 1); t.pos = null;
    }
    o.profile = publicProfile(t);
    return o;
  }

  /** A duel: a little for the winners, nothing taken from anyone. */
  settlePvp(part, e) {
    const t = part.doc;
    const won = e.outcome === part.side, draw = e.outcome === 'draw';
    const foes = [...this.parts.values()].filter((p) => p.side !== part.side);
    const lvl = foes.length ? foes.reduce((s, p) => s + (p.doc.level || 1), 0) / foes.length : 1;
    const o = { outcome: won ? 'a' : draw ? 'draw' : 'b', won, pvp: true, xp: 0, gold: 0, items: [], events: [], questsDone: [] };
    t.stats.pvpWins = t.stats.pvpWins || 0; t.stats.pvpLosses = t.stats.pvpLosses || 0;
    if (won) {
      o.gold = Math.round(30 + 5 * lvl); o.xp = Math.round(20 + 4 * lvl);
      t.gold += o.gold;
      o.events.push(...grantXp(t, o.xp));
      t.stats.pvpWins += 1;
    } else if (!draw) t.stats.pvpLosses += 1;
    o.profile = publicProfile(t);
    return o;
  }
}
