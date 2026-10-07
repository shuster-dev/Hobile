// A dungeon run, for one player or a party of up to four — and the endless
// tower, which is the same thing with no last floor.
//
// Every player brings their whole team and their trainer, as in any fight
// (party-battle.js); floor after floor of the dungeon's creatures stand
// against them, more and tougher the more of them there are, and the last
// floor is its keeper. Between floors the party catches its breath. What was
// beaten is shared: everyone who finishes takes home the run's experience and
// gold, and their own roll of its treasure.
//
// The online DungeonRoom and the single-player build (base.js DungeonSim) both
// drive this, so the two play the same dungeon.
import { wornLook } from '../../shared/cosmetics.js';
import {
  Combat, Combatant, activeCreature, creaturePower, creatureScore, giveItem, grantXp, grantXpTo, healTeam,
  makeCreature, publicProfile, sumStats, swapToUid, syncQuests, takeItem, teamCreatures,
} from './combat.js';
import { ITEMS, PROGRESSION, SPECIES } from '../../shared/gamedata.js';
import { PARTY_SCALE, TIER_IDS, TOWER, tierOf, towerBoss, towerElement, towerLevel, towerPool, weekly } from '../../shared/endgame.js';
import { eventMul } from '../../shared/events.js';
import { earn } from './economy.js';
import { FIELD } from './field.js';

export const DUNGEON = {
  tickMs: 100,
  firstFloorMs: 1600,
  betweenMs: 2200,
  healBetween: 0.22,     // of max health, to everyone still standing
  failShare: 0.35,       // of the haul a party that falls takes home
};

export class PartyDungeon {
  constructor({ def, tier = 'normal', onEnd = null, broadcast = null } = {}) {
    this.def = def;
    this.endless = !!def?.endless;
    this.tier = tierOf(this.endless ? 'normal' : tier);
    this.onEnd = onEnd || (() => {});
    this.broadcast = broadcast || (() => {});
    this.onSync = null;
    this.parts = new Map();
    this.phase = 'waiting';
    this.floor = 0;
    this.cleared = 0;
    this.started = false;
    this.resolved = false;
    this._ended = false;
    this.loot = { xp: 0, gold: 0 };
    this.chests = [];
    this.sim = new Combat({ mode: 'dungeon', onEvent: (e) => this.onSimEvent(e) });
  }

  get floors() { return this.endless ? 0 : this.def.floors; }

  /** A player steps in: their team, and their trainer behind it. */
  addPlayer(doc, emit, { guildBonus = null } = {}) {
    const was = this.parts.get(doc.id);
    if (was && !was.left) { was.emit = emit; return was; }
    const gear = sumStats(doc);
    const team = teamCreatures(doc);
    const lead = team.find((c) => c.hp > 0) || team[0] || null;
    const roster = [];
    team.forEach((creature, i) => {
      const c = this.sim.add(new Combatant({
        side: 'a', kind: 'creature', name: SPECIES[creature.species]?.name || creature.species,
        creature, ownerId: doc.id, slot: i, benched: creature !== lead, gearBonus: gear, guildBonus,
      }));
      roster.push({ id: c.id, uid: creature.uid });
    });
    const anchor = this.sim.combatants.get(roster.find((x) => x.uid === lead?.uid)?.id) || null;
    const trainer = this.sim.add(new Combatant({
      side: 'a', kind: 'trainer', name: doc.name, ownerId: doc.id, level: doc.level, benched: !!anchor, gearBonus: gear,
    }));
    const part = { id: doc.id, doc, emit, roster, anchor, trainer, left: false };
    this.parts.set(doc.id, part);
    this.sync();
    if (this.started) {
      emit('dungeonInit', this.initPayload(part));
      this.broadcast('allyJoined', { id: doc.id, name: doc.name, side: 'a', players: this.players() });
    }
    return part;
  }

  live() { return [...this.parts.values()].filter((p) => !p.left); }

  you(part) {
    return (part.anchor && this.sim.combatants.has(part.anchor.id) && this.sim.activeOf(part.anchor)) || part.anchor || part.trainer;
  }

  players() {
    return this.live().map((p) => ({ id: p.id, name: p.doc.name, level: p.doc.level, side: 'a', appearance: wornLook(p.doc) }));
  }

  info() {
    const d = this.def;
    return { id: d.id, name: d.name, he: d.he, floors: this.floors, element: this.endless ? towerElement(Math.max(1, this.floor)) : d.element, endless: this.endless, tier: this.tier.id };
  }

  initPayload(part) {
    return {
      dungeon: this.info(),
      you: this.you(part).id,
      team: part.roster,
      trainer: part.trainer?.id || null,
      players: this.players(),
      floor: this.floor,
      inventory: part.doc.inventory,
      profile: publicProfile(part.doc),
    };
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.sync();
    this._init = setTimeout(() => { for (const p of this.live()) p.emit('dungeonInit', this.initPayload(p)); }, 80);
    this.timer = setInterval(() => {
      if (this.phase === 'active') { this.sim.update(DUNGEON.tickMs); this.sync(); }
    }, DUNGEON.tickMs);
    this._next = setTimeout(() => this.nextFloor(), DUNGEON.firstFloorMs);
  }

  stop() {
    clearInterval(this.timer); clearTimeout(this._next); clearTimeout(this._init);
    this.finish();
  }

  finish() {
    if (this._ended) return;
    this._ended = true;
    clearInterval(this.timer); clearTimeout(this._next);
    for (const p of this.parts.values()) p.doc && (p.doc.calmUntil = Date.now() + FIELD.battleCalmMs);
    this.onEnd();
  }

  sync() { this.onSync?.(); }

  /** The level the party fights at: what its creatures on the field are. */
  partyLevel() {
    const a = this.sim.all().filter((c) => c.side === 'a' && c.kind !== 'trainer');
    const on = a.filter((c) => !c.benched);
    const list = on.length ? on : a;
    return Math.max(1, Math.round(list.reduce((s, c) => s + c.level, 0) / Math.max(1, list.length)));
  }

  isBossFloor(f = this.floor) {
    return this.endless ? f % TOWER.bossEvery === 0 : f >= this.def.floors;
  }

  nextFloor() {
    if (this.resolved || this._ended) return;
    this.floor += 1;
    for (const c of [...this.sim.combatants.values()]) if (c.side === 'b') this.sim.combatants.delete(c.id);
    const boss = this.isBossFloor();
    const n = this.live().length;
    const pl = this.partyLevel();
    const level = this.endless
      ? towerLevel(this.floor, pl) + (boss ? 2 : 0)
      : Math.max(this.def.minLevel, pl + (boss ? 2 : 0)) + this.tier.lvl;
    const count = boss ? 1 : Math.min(3, 1 + Math.floor(this.floor / 2)) + (n >= PARTY_SCALE.extraFoeFrom ? 1 : 0);
    const hpMul = this.tier.hp * (1 + PARTY_SCALE.hpPerPlayer * Math.max(0, n - 1));
    const pool = this.endless ? towerPool(this.floor) : this.def.trash;
    for (let k = 0; k < count; k++) {
      const sp = boss ? (this.endless ? towerBoss(this.floor) : this.def.boss) : pool[Math.floor(Math.random() * pool.length)];
      const c = this.sim.add(new Combatant({
        side: 'b', kind: boss ? 'boss' : 'wild', name: SPECIES[sp]?.name || sp,
        creature: makeCreature(sp, Math.min(PROGRESSION.maxLevel, level)), hpScale: boss ? 2.4 * hpMul : 1,
      }));
      if (!boss && hpMul !== 1) c.maxHp = c.hp = Math.round(c.maxHp * hpMul);
    }
    this.phase = 'active';
    this.sim.finished = false;
    this.sync();
    this.broadcast('floor', { floor: this.floor, of: this.floors, boss, level, element: this.endless ? towerElement(this.floor) : this.def.element, endless: this.endless });
  }

  onSimEvent(e) {
    this.broadcast('battleEvent', e);
    if (e.kind !== 'end') return;
    if (e.outcome === 'a') this.floorCleared();
    else this.complete(false, e.outcome === 'fled');
  }

  floorCleared() {
    const pl = this.partyLevel();
    for (const c of this.sim.combatants.values()) {
      if (c.side !== 'b') continue;
      this.loot.xp += creaturePower(c, pl);
      this.loot.gold += creatureScore(c);
    }
    this.cleared = this.floor;
    for (const c of this.sim.combatants.values()) {
      if (c.side !== 'a' || !c.alive) continue;
      c.hp = Math.min(c.maxHp, c.hp + Math.floor(c.maxHp * DUNGEON.healBetween));
      c.stamina = PROGRESSION.staminaMax;
    }
    if (this.endless && this.floor % TOWER.bossEvery === 0) {
      const chest = TOWER.chest(this.floor);
      this.chests.push(chest);
      this.broadcast('towerChest', { floor: this.floor, chest });
    }
    this.phase = 'waiting';
    this.sync();
    if (!this.endless && this.floor >= this.def.floors) return this.complete(true);
    this.broadcast('floorCleared', { floor: this.floor, next: this.floor + 1, loot: { ...this.loot } });
    this._next = setTimeout(() => this.nextFloor(), DUNGEON.betweenMs);
  }

  /** The run is over for everyone still in it. */
  complete(success, fled = false) {
    if (this.resolved) return;
    this.resolved = true;
    this.phase = 'over';
    clearInterval(this.timer); clearTimeout(this._next);
    for (const part of this.live()) part.emit('dungeonEnd', this.settle(part, success, fled));
    this.sync();
    this.finish();
  }

  /**
   * What one player takes home. A dungeon finished pays in full; a party that
   * falls takes a third and wakes healed. The tower has no finish: however a
   * climb ends, it pays what it reached, and the floor is the record.
   */
  settle(part, success, fled = false) {
    const doc = part.doc;
    // every creature's health goes home with it
    for (const r of part.roster) {
      const c = this.sim.combatants.get(r.id), cr = doc.creatures?.[r.uid];
      if (c && cr) cr.hp = Math.max(0, Math.round(c.hp));
    }
    const full = success || this.endless;
    const mul = (full ? 1 : DUNGEON.failShare) * this.tier.reward;
    const xp = Math.floor(this.loot.xp * mul * eventMul('xp') * (1 + (doc.guildPerks?.xp || 0)));
    const gold = Math.floor(this.loot.gold * mul * eventMul('gold') * (1 + (doc.guildPerks?.gold || 0)));
    const o = { success, endless: this.endless, tier: this.tier.id, xp, gold: 0, items: [], events: [], questsDone: [], floors: this.endless ? this.cleared : this.floor, of: this.floors, players: this.live().length, profile: null };
    o.gold = earn(doc, gold, 'dungeon');
    const n = activeCreature(doc);
    n && o.events.push(...grantXpTo(n, xp, doc));
    o.events.push(...grantXp(doc, Math.floor(xp * 0.7)));
    const recs = (doc.records ||= {});
    const wk = weekly(doc);
    if (this.endless) {
      for (const ch of this.chests) {
        o.gold += earn(doc, ch.gold, 'dungeon');
        for (const [id, q] of Object.entries(ch.items)) if (ITEMS[id]) giveItem(doc, id, q), o.items.push(...Array(q).fill(id));
      }
      o.best = recs.towerBest = Math.max(recs.towerBest || 0, this.cleared);
      o.weekBest = wk.tower = Math.max(wk.tower || 0, this.cleared);
    } else if (success) {
      doc.stats.dungeonsCleared = (doc.stats.dungeonsCleared || 0) + 1;
      wk.dungeons = (wk.dungeons || 0) + 1;
      const k = TIER_IDS.indexOf(this.tier.id);
      (recs.dungeons ||= {})[this.def.id] = Math.max(recs.dungeons[this.def.id] ?? -1, k);
      const rolls = 1 + (Math.random() < 0.4 ? 1 : 0) + k;
      for (let h = 0; h < rolls; h++) {
        const id = this.def.rewards.items[Math.floor(Math.random() * this.def.rewards.items.length)];
        giveItem(doc, id, 1); o.items.push(id);
      }
      o.questsDone = syncQuests(doc, { kind: 'dungeon', target: this.def.id });
    }
    if (!full && !fled) healTeam(doc, 1);
    o.profile = publicProfile(doc);
    return o;
  }

  /** Someone walks out. Alone, it ends the run; in a party, the rest go on. */
  leave(id, why = 'fled') {
    const part = this.parts.get(id);
    if (!part || part.left || this.resolved) return;
    if (why === 'fled' && this.live().length > 1) {
      // they go home with their share of what is beaten so far: a run they
      // gave up on pays as a fall does, a climb pays in full
      part.emit('dungeonEnd', this.settle(part, false, true));
    }
    part.left = true;
    for (const [cid, c] of [...this.sim.combatants]) if (c.ownerId === id) this.sim.combatants.delete(cid);
    this.sim.pendingSwitch.delete(id); this.sim.switchReady.delete(id);
    this.broadcast('allyLeft', { id, name: part.doc.name, side: 'a', players: this.players() });
    if (!this.live().length) { this.resolved = true; this.phase = 'over'; this.finish(); return; }
    this.sim.checkEnd();
    this.sync();
  }

  handle(id, type, t = {}) {
    const part = this.parts.get(id);
    if (!part || part.left) return;
    if (type === 'ready') { part.emit('dungeonInit', this.initPayload(part)); return; }
    if (this.phase !== 'active') return;
    const doc = part.doc, you = this.you(part);
    if (type === 'swap') {
      const r = swapToUid(this.sim, you, t.uid);
      r.ok || part.emit('actionRejected', { reason: r.reason, uid: t.uid });
      return this.sync();
    }
    if (type === 'skill') {
      const r = this.sim.useSkill(you.id, t.skill, typeof t.target === 'string' ? t.target : null);
      r.ok || part.emit('actionRejected', { reason: r.reason, skill: t.skill });
      return this.sync();
    }
    if (type !== 'trainer') return;
    if (t.action === 'sphere') return part.emit('actionRejected', { reason: 'no_capture_in_dungeon' });
    if (t.action === 'potion') {
      const item = ITEMS[t.item]?.kind === 'heal' ? t.item : 'potion_s';
      if (!takeItem(doc, item, 1)) return part.emit('actionRejected', { reason: 'no_item' });
      you.hp = Math.min(you.maxHp, you.hp + ITEMS[item].amount);
      this.sim.emit({ kind: 'heal', target: you.id, amount: ITEMS[item].amount, hp: you.hp, source: 'item' });
      part.emit('inventory', doc.inventory);
    } else if (t.action === 'flee') {
      if (this.live().length > 1) this.leave(id, 'fled');
      else if (this.endless) this.complete(false, true);
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
}
