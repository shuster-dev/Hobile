import { heldProgress, questState } from '../../shared/story.js';
import { ACTIONS, AVATAR, BUILDINGS, DAILY_QUEST_IDS, HOME_ZONE, ITEMS, MAIN_QUEST_IDS, MOVES, PROGRESSION, QUESTS, RECIPES, SPECIES, STARS, captureChance, skillsFor, starRank, statsFor, typeMultiplier } from '../../shared/gamedata.js';

var combatantSeq = 0,
  combatantId = () => `c${++combatantSeq}`,
  SWITCH_COOLDOWN_MS = 6e3,
  RALLY_ATK_BONUS = 0.15,
  RALLY_DURATION_MS = 4e3,
  num = (i, e = 0) => Number.isFinite(i) ? i : e;

function ownerKey(i) {
  return i.ownerSession || i.ownerId || `side:${i.side}`;
}

var Combatant = class {
    constructor(e) {
      this.id = combatantId(), this.side = e.side, this.kind = e.kind === "player" ? "creature" : e.kind, this.ownerId = e.ownerId || null, this.ownerSession = e.ownerSession || null, this.name = e.name, this.creature = e.creature || null, this.slot = Number.isFinite(e.slot) ? Math.max(-1, Math.min(5, Math.trunc(e.slot))) : this.kind === "trainer" ? -1 : 0, this.benched = !!e.benched, this.frozenUntil = 0, this.fought = !this.benched;
      let t = e.gearBonus || {},
        n = e.guildBonus || {};
      if (this.kind === "trainer") this.species = "", this.level = Math.max(1, Math.min(PROGRESSION.maxLevel, Math.round(num(e.level, 1)))), this.types = [], this.skills = [], this.stats = {
        hp: PROGRESSION.trainerHp(this.level) + Math.max(0, num(t.hp)),
        atk: 10 + this.level * 2 + num(t.atk),
        def: 10 + this.level * 2 + num(t.def),
        spa: 10 + this.level * 2 + num(t.spa),
        spd: 10 + this.level * 2 + num(t.spd),
        spe: 10 + this.level + num(t.spe)
      }, this.maxHp = this.stats.hp, this.hp = Math.max(0, Math.min(this.maxHp, Math.round(num(e.hp, this.maxHp))));else {
        let s = e.creature;
        this.species = s.species, this.level = s.level;
        let r = statsFor(this.species, this.level, num(s.iv, 0.5), Math.max(1, num(s.star, 1)));
        this.stats = {
          hp: Math.floor((r.hp + num(t.hp)) * (1 + num(n.hp))),
          atk: Math.floor((r.atk + num(t.atk)) * (1 + num(n.atk))),
          def: Math.floor((r.def + num(t.def)) * (1 + num(n.def))),
          spa: Math.floor((r.spa + num(t.spa)) * (1 + num(n.spa))),
          spd: Math.floor((r.spd + num(t.spd)) * (1 + num(n.spd))),
          spe: Math.floor((r.spe + num(t.spe)) * (1 + num(n.spe)))
        }, this.kind === "boss" && (this.stats.hp = Math.floor(this.stats.hp * num(e.hpScale, 6))), this.maxHp = this.stats.hp, this.hp = this.kind === "creature" ? Math.max(0, Math.min(this.maxHp, num(s.hp, this.maxHp))) : this.maxHp, this.types = SPECIES[this.species].types;
        let o = Array.isArray(s.skills) && s.skills.length ? s.skills : SPECIES[this.species].learn.map(([, a]) => a);
        this.skills = o.filter(a => typeof a == "string" && Object.prototype.hasOwnProperty.call(MOVES, a)).slice(0, 4);
      }
      this.stamina = PROGRESSION.staminaMax, this.cooldowns = {}, this.effects = [], this.aiDelay = this.kind === "boss" ? 900 : 1400, this.aiNext = Date.now() + this.aiDelay, this.damageDealt = 0;
    }
    get alive() {
      return this.hp > 0;
    }
    get onField() {
      return this.alive && !this.benched;
    }
    frozen(e) {
      return e < this.frozenUntil;
    }
    modifier(e) {
      let t = 0;
      for (let n of this.effects) n.kind === e && (t += n.value);
      return t;
    }
    addEffect(e, t, n, s) {
      this.effects.push({
        kind: e,
        value: t,
        until: s + n
      });
    }
    tickEffects(e) {
      let t = [];
      return this.effects = this.effects.filter(n => n.until > e ? !0 : (t.push(n.kind), !1)), t;
    }
    isStunned(e) {
      return this.effects.some(t => t.kind === "stun" && t.until > e);
    }
    toJSON() {
      return {
        id: this.id,
        side: this.side,
        kind: this.kind,
        name: this.name,
        species: this.species,
        level: this.level,
        hp: this.hp,
        maxHp: this.maxHp,
        stamina: Math.round(this.stamina),
        skills: this.skills,
        effects: this.effects.map(e => ({
          kind: e.kind,
          until: e.until
        })),
        ownerId: this.ownerId,
        benched: this.benched,
        slot: this.slot,
        frozenUntil: this.frozenUntil
      };
    }
  },
  WEATHER_BOOST = 1.2,
  Combat = class {
    constructor(e = {}) {
      this.mode = e.mode || "pve", this.onEvent = e.onEvent || (() => {}), this.rand = typeof e.rand == "function" ? e.rand : Math.random, this.weather = e.weather || null, this.combatants = new Map(), this.startedAt = Date.now(), this.finished = !1, this.result = null, this.contribution = new Map(), this.pendingThrow = null, this.pendingSwitch = new Map(), this.switchReady = new Map();
    }
    add(e) {
      return this.combatants.set(e.id, e), e;
    }
    all() {
      return [...this.combatants.values()];
    }
    sideAlive(e) {
      let t = new Map();
      for (let n of this.combatants.values()) {
        if (n.side !== e) continue;
        let s = ownerKey(n);
        t.has(s) || t.set(s, []), t.get(s).push(n);
      }
      for (let n of t.values()) {
        let s = n.find(r => r.kind === "trainer");
        if (s ? s.alive : n.some(r => r.alive)) return !0;
      }
      return !1;
    }
    teamOf(e) {
      let t = ownerKey(e);
      return this.all().filter(n => ownerKey(n) === t);
    }
    targetsOn(e) {
      let t = this.all().filter(r => r.side === e && r.onField),
        n = t.filter(r => r.kind !== "trainer");
      return n.length ? n : this.all().some(r => r.side === e && r.kind !== "trainer" && r.alive) ? [] : t.filter(r => r.kind === "trainer");
    }
    enemiesOf(e) {
      return this.targetsOn(e.side === "a" ? "b" : "a");
    }
    alliesOf(e) {
      return this.all().filter(t => t.side === e.side && t.onField);
    }
    activeOf(e) {
      return this.teamOf(e).find(t => t.kind !== "trainer" && t.onField) || null;
    }
    emit(e) {
      this.onEvent({
        t: Date.now(),
        ...e
      });
    }
    computeDamage(e, t, n, s) {
      let r = n.kind === "physical",
        o = r ? e.stats.atk : e.stats.spa,
        a = r ? t.stats.def : t.stats.spd,
        l = 1 + e.modifier("atkUp") - e.modifier("atkDown"),
        c = 1 + t.modifier("defUp") - t.modifier("defDown"),
        h = Math.min(0.85, t.modifier("shield")),
        d = n.type && e.types.includes(n.type) ? 1.5 : 1,
        u = n.type ? typeMultiplier(n.type, t.types) : 1,
        // `this.rand` exists so a fight can be replayed; the damage roll —
        // the one place it matters most — was calling Math.random directly, so
        // seeding a Combat changed everything about it except the numbers.
        f = this.rand() < 0.0625 ? 1.6 : 1,
        p = 0.85 + this.rand() * 0.3,
        // The sky is worth something. Rain behind a water move, a storm behind
        // a volt one — fixed at the start of the battle rather than sampled per
        // hit, so a spell turning over mid-fight cannot change what a move is
        // doing halfway through it.
        m = n.type && this.weather?.boost === n.type ? WEATHER_BOOST : 1,
        x = (2 * e.level / 5 + 2) * n.power * (o * l / Math.max(1, a * c)) / 50 + 2,
        g = Math.floor(x * d * u * f * p * m * (1 - h));
      return g = Math.max(1, g), {
        dmg: g,
        eff: u,
        crit: f > 1,
        weather: m > 1
      };
    }
    applyHit(e, t, n, s, r, o = {}) {
      let {
        dmg: a,
        eff: l,
        crit: c
      } = this.computeDamage(e, t, n, r);
      return t.hp = Math.max(0, t.hp - a), e.damageDealt += a, e.ownerId && this.contribution.set(e.ownerId, (this.contribution.get(e.ownerId) || 0) + a), this.emit({
        kind: "hit",
        actor: e.id,
        target: t.id,
        skill: s,
        dmg: a,
        eff: l,
        crit: c,
        hp: t.hp,
        ...(o.trainer ? {
          trainer: !0
        } : {})
      }), t.kind === "trainer" && this.emit({
        kind: "trainerHit",
        target: t.id,
        dmg: a,
        hp: t.hp
      }), a;
    }
    applyRiders(e, t, n, s, r) {
      let o = n.effect;
      if (o && (o.burn && Math.random() < 0.85 && t.addEffect("burn", o.burn, o.dur, r), o.poison && Math.random() < 0.85 && t.addEffect("poison", o.poison, o.dur, r), o.slow && t.addEffect("slow", o.slow, o.dur, r), o.stun && Math.random() < o.stun && (t.addEffect("stun", 1, o.dur, r), this.emit({
        kind: "status",
        target: t.id,
        status: "stun"
      })), o.defDown && t.addEffect("defDown", o.defDown, o.dur, r), o.lifesteal)) {
        let a = Math.floor(s * o.lifesteal);
        e.hp = Math.min(e.maxHp, e.hp + a), this.emit({
          kind: "heal",
          target: e.id,
          amount: a,
          hp: e.hp
        });
      }
    }
    applySelfBuffs(e, t, n) {
      let s = t.effect;
      if (!s) return;
      let r = s.party ? this.alliesOf(e) : [e];
      for (let o of r) {
        if (s.shield && o.addEffect("shield", s.shield, s.dur, n), s.atkUp && o.addEffect("atkUp", s.atkUp, s.dur, n), s.defUp && o.addEffect("defUp", s.defUp, s.dur, n), s.hasteUp && o.addEffect("hasteUp", s.hasteUp, s.dur, n), s.heal) {
          let a = Math.floor(o.maxHp * s.heal);
          o.hp = Math.min(o.maxHp, o.hp + a), this.emit({
            kind: "heal",
            target: o.id,
            amount: a,
            hp: o.hp
          });
        }
        this.emit({
          kind: "buff",
          target: o.id,
          skill: t.id
        });
      }
    }
    useSkill(e, t, n = null) {
      if (this.finished) return {
        ok: !1,
        reason: "finished"
      };
      let s = this.combatants.get(typeof e == "string" ? e : ""),
        r = Object.prototype.hasOwnProperty.call(MOVES, t) ? MOVES[t] : null;
      if (!s || !s.alive) return {
        ok: !1,
        reason: "dead"
      };
      if (!r) return {
        ok: !1,
        reason: "unknown_skill"
      };
      if (!s.skills.includes(t)) return {
        ok: !1,
        reason: "not_learned"
      };
      if (s.benched) return {
        ok: !1,
        reason: "benched"
      };
      let o = Date.now();
      if (s.frozen(o)) return {
        ok: !1,
        reason: "frozen"
      };
      if (s.isStunned(o)) return {
        ok: !1,
        reason: "stunned"
      };
      if ((s.cooldowns[t] || 0) > o) return {
        ok: !1,
        reason: "cooldown"
      };
      if (s.stamina < r.cost) return {
        ok: !1,
        reason: "stamina"
      };
      let a = Math.min(0.4, s.modifier("hasteUp"));
      if (s.cooldowns[t] = o + r.cd * (1 - a), s.stamina -= r.cost, r.kind === "status") return this.applySelfBuffs(s, r, o), this.emit({
        kind: "skill",
        actor: s.id,
        skill: t,
        status: !0
      }), {
        ok: !0
      };
      let l = this.enemiesOf(s),
        c;
      if (r.aoe) c = l;else {
        let h = typeof n == "string" && n ? this.combatants.get(n) : null;
        c = h && l.includes(h) ? [h] : l.slice(0, 1);
      }
      if (!c.length) return {
        ok: !1,
        reason: "no_target"
      };
      for (let h of c) {
        if (Math.random() > r.acc) {
          this.emit({
            kind: "miss",
            actor: s.id,
            target: h.id,
            skill: t
          });
          continue;
        }
        let d = this.applyHit(s, h, r, t, o);
        this.applyRiders(s, h, r, d, o), h.alive || this.emit({
          kind: "faint",
          target: h.id
        });
      }
      return this.checkEnd(), {
        ok: !0
      };
    }
    trainerAction(e, t, n = {}) {
      if (this.finished) return {
        ok: !1,
        reason: "finished"
      };
      let s = this.combatants.get(typeof e == "string" ? e : ""),
        r = Object.prototype.hasOwnProperty.call(ACTIONS, t) ? ACTIONS[t] : null;
      if (!s || !r) return {
        ok: !1,
        reason: "unknown_action"
      };
      if (!s.alive) return {
        ok: !1,
        reason: "dead"
      };
      let o = Date.now();
      if (s.frozen(o)) return {
        ok: !1,
        reason: "frozen"
      };
      let a = `trainer:${t}`;
      if ((s.cooldowns[a] || 0) > o) return {
        ok: !1,
        reason: "cooldown"
      };
      if (r.capture) {
        let h = this.attemptCapture(s, n);
        return h.ok && (s.cooldowns[a] = o + r.cd), h;
      }
      if (s.cooldowns[a] = o + r.cd, r.heal) {
        let h = this.activeOf(s) || s,
          d = Math.floor(h.maxHp * r.heal);
        return h.hp = Math.min(h.maxHp, h.hp + d), this.emit({
          kind: "heal",
          target: h.id,
          amount: d,
          hp: h.hp,
          source: "trainer"
        }), {
          ok: !0,
          target: h.id
        };
      }
      if (r.effect) {
        for (let h of this.alliesOf(s)) r.effect.atkUp && h.addEffect("atkUp", r.effect.atkUp, r.effect.dur, o);
        return this.emit({
          kind: "buff",
          target: s.id,
          skill: t
        }), {
          ok: !0
        };
      }
      if (r.flee) return this.mode === "pvp" || this.mode === "boss" ? {
        ok: !1,
        reason: "cannot_flee"
      } : Math.random() < PROGRESSION.fleeChance ? (this.finish({
        outcome: "fled"
      }), {
        ok: !0,
        fled: !0
      }) : (this.emit({
        kind: "fleeFail",
        actor: s.id
      }), {
        ok: !0,
        fled: !1
      });
      let l = this.enemiesOf(s)[0];
      if (!l) return {
        ok: !1,
        reason: "no_target"
      };
      let c = {
        kind: r.kind,
        power: r.power,
        type: null,
        acc: 1
      };
      return this.applyHit(s, l, c, "strike", o, {
        trainer: !0
      }), l.alive || this.emit({
        kind: "faint",
        target: l.id
      }), this.checkEnd(), {
        ok: !0
      };
    }
    attemptCapture(e, t = {}) {
      if (this.mode === "pvp") return {
        ok: !1,
        reason: "cannot_capture_players"
      };
      if (this.pendingThrow) return {
        ok: !1,
        reason: "capture_busy"
      };
      let n = this.enemiesOf(e)[0];
      if (!n) return {
        ok: !1,
        reason: "no_target"
      };
      if (n.kind === "boss") return {
        ok: !1,
        reason: "cannot_capture_boss"
      };
      if (n.kind !== "wild") return {
        ok: !1,
        reason: "cannot_capture_players"
      };
      let s = typeof t.sphere == "string" && Object.prototype.hasOwnProperty.call(ITEMS, t.sphere) && ITEMS[t.sphere].kind === "sphere" ? t.sphere : "sphere_basic",
        r = Date.now(),
        o = captureChance(n, s),
        a = r + PROGRESSION.captureWindowMs;
      for (let l of this.combatants.values()) l.frozenUntil = Math.max(l.frozenUntil, a);
      for (let l of this.pendingSwitch.values()) l.at = Math.max(l.at, a);
      return this.pendingThrow = {
        targetId: n.id,
        chance: o,
        until: a,
        sphere: s,
        by: e.id
      }, this.emit({
        kind: "captureStart",
        target: n.id,
        chance: Math.round(o * 100),
        until: a,
        sphere: s,
        actor: e.id
      }), {
        ok: !0,
        pending: !0,
        chance: o,
        until: a
      };
    }
    resolveCapture(e) {
      let t = this.pendingThrow;
      if (!t || e < t.until) return;
      this.pendingThrow = null;
      let n = this.combatants.get(t.targetId),
        s = this.rand() < t.chance,
        r = starRank(t.chance, s);
      if (this.emit({
        kind: "capture",
        target: t.targetId,
        success: s,
        shakes: r,
        chance: Math.round(t.chance * 100),
        sphere: t.sphere
      }), s) {
        n && (n.hp = 0), this.finish({
          outcome: "captured",
          captured: {
            id: t.targetId,
            species: n?.species,
            level: n?.level
          }
        });
        return;
      }
      for (let o of this.combatants.values()) o.frozenUntil = 0;
      n?.alive && n.addEffect("atkUp", RALLY_ATK_BONUS, RALLY_DURATION_MS, e);
    }
    sendOut(e, t = null) {
      let n = t ? this.combatants.get(t) : null;
      n && (n.benched = !0), e.benched = !1, e.fought = !0, e.aiNext = Date.now() + e.aiDelay;
      let s = this.teamOf(e).find(r => r.kind === "trainer");
      s && s !== e && !s.benched && (s.benched = !0), this.emit({
        kind: "switch",
        side: e.side,
        out: t || null,
        in: e.id
      });
    }
    switchTo(e) {
      if (this.finished) return {
        ok: !1,
        reason: "finished"
      };
      let t = this.combatants.get(typeof e == "string" ? e : "");
      if (!t || t.kind === "trainer" || !t.creature) return {
        ok: !1,
        reason: "no_target"
      };
      if (!t.alive) return {
        ok: !1,
        reason: "fainted"
      };
      if (!t.benched) return {
        ok: !1,
        reason: "already_active"
      };
      let n = Date.now();
      if (this.pendingThrow || t.frozen(n)) return {
        ok: !1,
        reason: "frozen"
      };
      let s = this.teamOf(t),
        r = s.find(a => a.kind !== "trainer" && a.onField) || null;
      if (!r && s.some(a => a.kind !== "trainer" && !a.benched && !a.alive)) return {
        ok: !1,
        reason: "switch_forced"
      };
      let o = ownerKey(t);
      return (this.switchReady.get(o) || 0) > n ? {
        ok: !1,
        reason: "cooldown"
      } : (this.switchReady.set(o, n + SWITCH_COOLDOWN_MS), this.pendingSwitch.delete(o), this.sendOut(t, r?.id || null), {
        ok: !0,
        in: t.id,
        out: r?.id || null
      });
    }
    resolveSwitches(e) {
      for (let t of this.combatants.values()) {
        if (t.kind !== "trainer" || !t.alive) continue;
        let n = ownerKey(t),
          s = this.teamOf(t),
          r = this.pendingSwitch.get(n);
        if (s.some(a => a.kind !== "trainer" && a.onField)) {
          r && this.pendingSwitch.delete(n);
          continue;
        }
        let o = s.filter(a => a.kind !== "trainer" && a.alive && a.benched).sort((a, l) => a.slot - l.slot);
        if (!(!o.length && !t.benched)) {
          if (!r) {
            let a = s.find(l => l.kind !== "trainer" && !l.benched && !l.alive);
            this.pendingSwitch.set(n, {
              at: e + PROGRESSION.switchDelayMs,
              out: a?.id || null
            });
            continue;
          }
          if (!(e < r.at)) if (this.pendingSwitch.delete(n), o.length) this.sendOut(o[0], r.out);else {
            let a = r.out ? this.combatants.get(r.out) : null;
            a && (a.benched = !0), t.benched = !1, t.fought = !0, this.emit({
              kind: "switch",
              side: t.side,
              out: r.out || null,
              in: t.id,
              trainer: !0
            });
          }
        }
      }
    }
    update(e) {
      if (this.finished) return;
      let t = Date.now();
      if (this.resolveCapture(t), !this.finished) {
        for (let n of this.combatants.values()) if (n.alive && (n.tickEffects(t), !n.frozen(t) && (n.stamina = Math.min(PROGRESSION.staminaMax, n.stamina + PROGRESSION.staminaRegenPerSec * e / 1e3), !n.benched))) {
          for (let s of n.effects) {
            if (s.kind !== "burn" && s.kind !== "poison") continue;
            let r = Math.max(1, Math.floor(n.maxHp * s.value * (e / 1e3) * 0.5));
            n.hp = Math.max(0, n.hp - r), n.alive || this.emit({
              kind: "faint",
              target: n.id
            });
          }
          (n.kind === "wild" || n.kind === "boss") && this.runAI(n, t);
        }
        this.resolveSwitches(t), this.checkEnd();
      }
    }
    runAI(e, t) {
      if (!e.onField || e.frozen(t) || e.isStunned(t) || t < e.aiNext) return;
      let n = this.enemiesOf(e);
      if (!n.length) return;
      let s = n[Math.floor(Math.random() * n.length)],
        r = e.skills.map(c => MOVES[c]).filter(c => c && (e.cooldowns[c.id] || 0) <= t && e.stamina >= c.cost);
      if (!r.length) {
        e.aiNext = t + 500;
        return;
      }
      let o = r[0],
        a = -1;
      for (let c of r) {
        let h = c.type ? typeMultiplier(c.type, s.types) : 1,
          d = (c.power || 30) * h * (c.kind === "status" ? 0.4 : 1) * (0.85 + Math.random() * 0.3);
        d > a && (a = d, o = c);
      }
      this.useSkill(e.id, o.id, s.id);
      let l = e.kind === "boss" ? 800 : 1300;
      e.aiNext = t + l + Math.random() * 700;
    }
    checkEnd() {
      if (this.finished) return;
      let e = this.sideAlive("a"),
        t = this.sideAlive("b");
      e && t || this.finish({
        outcome: e ? "a" : t ? "b" : "draw"
      });
    }
    finish(e) {
      this.finished || (this.finished = !0, this.pendingThrow = null, this.pendingSwitch.clear(), this.result = {
        ...e,
        contribution: Object.fromEntries(this.contribution)
      }, this.emit({
        kind: "end",
        ...this.result
      }));
    }
    snapshot() {
      return {
        mode: this.mode,
        finished: this.finished,
        combatants: this.all().map(e => e.toJSON())
      };
    }
  };

function creaturePower(i, e) {
  let t = i && Object.prototype.hasOwnProperty.call(SPECIES, i.species) ? SPECIES[i.species] : null;
  if (!t) return 0;
  let n = t.base,
    s = n.hp + n.atk + n.def + n.spa + n.spd + n.spe,
    r = i.kind === "boss" ? 6 : 1,
    o = Math.max(0.35, Math.min(2.2, i.level / Math.max(1, e)));
  return Math.floor(s * i.level / 34 * o * r);
}

function creatureScore(i) {
  if (!i || !Object.prototype.hasOwnProperty.call(SPECIES, i.species)) return 0;
  let e = i.kind === "boss" ? 25 : 1;
  return Math.floor((14 + i.level * 7) * e * (0.8 + Math.random() * 0.4));
}

function uid() {
  let i = globalThis.crypto;
  return i?.randomUUID ? i.randomUUID() : "x".repeat(1).concat(Math.random().toString(36).slice(2), Date.now().toString(36));
}

function makeCreature(i, e, t = {}) {
  let n = t.iv ?? Math.round((0.3 + Math.random() * 0.7) * 100) / 100,
    s = statsFor(i, e, n);
  return {
    uid: uid(),
    species: i,
    nickname: t.nickname || null,
    level: e,
    xp: 0,
    iv: n,
    star: 1,
    hp: s.hp,
    maxHp: s.hp,
    stamina: PROGRESSION.staminaMax,
    skills: skillsFor(i, e),
    caughtAt: Date.now(),
    shiny: t.shiny ?? Math.random() < 0.004
  };
}

function statsOf(i) {
  return statsFor(i.species, i.level, i.iv, i.star || 1);
}

function createPlayerDoc(i, e, t = {}, n = "sproutle") {
  let s = makeCreature(n, 5);
  return {
    id: i,
    name: e,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    level: 1,
    xp: 0,
    gold: 500,
    trainerHp: PROGRESSION.trainerHp(1),
    zone: HOME_ZONE,
    x: 0,
    y: 0,
    z: 4,
    appearance: {
      body: t.body ?? AVATAR.bodies[0],
      skin: t.skin ?? AVATAR.skins[0],
      hair: t.hair ?? AVATAR.hair[0],
      outfit: t.outfit ?? AVATAR.outfits[0].id
    },
    team: [s.uid],
    box: [],
    creatures: {
      [s.uid]: s
    },
    inventory: {
      sphere_basic: 10,
      potion_s: 5
    },
    gear: {
      weapon: null,
      armor: null,
      trinket: null
    },
    friends: [],
    friendRequests: [],
    guildId: null,
    party: null,
    quests: {
      active: {
        [MAIN_QUEST_IDS[0]]: {
          progress: 0
        }
      },
      done: [],
      dailies: {},
      dailyStamp: dayStamp()
    },
    stats: {
      battlesWon: 0,
      captures: 0,
      dungeonsCleared: 0,
      bossHits: 0,
      deaths: 0,
      playSeconds: 0
    },
    unlockedZones: [HOME_ZONE],
    base: null,
    settings: {
      lang: "he",
      sfx: !0,
      music: !0,
      view: "third"
    }
  };
}

function dayStamp(i = new Date()) {
  return `${i.getUTCFullYear()}-${i.getUTCMonth() + 1}-${i.getUTCDate()}`;
}

function creatureOf(i, e) {
  return typeof e != "string" || !i?.creatures ? null : Object.prototype.hasOwnProperty.call(i.creatures, e) ? i.creatures[e] : null;
}

function activeCreature(i) {
  for (let e of i.team || []) {
    let t = creatureOf(i, e);
    if (t && t.hp > 0) return t;
  }
  return creatureOf(i, i.team?.[0]);
}

function teamCreatures(i) {
  return (i.team || []).map(e => creatureOf(i, e)).filter(Boolean);
}

function addCreature(i, e) {
  return i.creatures[e.uid] = e, i.team.length < 6 ? i.team.push(e.uid) : i.box.push(e.uid), e;
}

function healTeam(i, e = 1) {
  for (let n of teamCreatures(i)) {
    let s = statsOf(n);
    n.maxHp = s.hp, n.hp = Math.min(s.hp, Math.floor(n.hp + s.hp * e)), n.stamina = PROGRESSION.staminaMax;
  }
  let t = trainerMaxHp(i);
  i.trainerHp = Math.min(t, Math.floor((i.trainerHp ?? t) + t * e));
}

function trainerMaxHp(i) {
  let e = sumStats(i) || {};
  return PROGRESSION.trainerHp(i?.level || 1) + Math.max(0, Math.floor(e.hp || 0));
}

function grantXpTo(i, e) {
  let t = [];
  for (i.xp += e; i.level < PROGRESSION.maxLevel && i.xp >= PROGRESSION.xpToLevel(i.level + 1);) {
    i.level += 1;
    let n = statsFor(i.species, i.level, i.iv, i.star || 1),
      s = n.hp - i.maxHp;
    i.maxHp = n.hp, i.hp = Math.min(n.hp, i.hp + Math.max(0, s));
    let r = new Set(i.skills);
    i.skills = skillsFor(i.species, i.level);
    for (let a of i.skills) r.has(a) || t.push({
      kind: "skill",
      skill: a
    });
    t.push({
      kind: "level",
      level: i.level
    });
    let o = SPECIES[i.species].evolve;
    if (o && i.level >= o.level) {
      let a = i.species;
      i.species = o.into;
      let l = statsFor(i.species, i.level, i.iv, i.star || 1);
      i.maxHp = l.hp, i.hp = l.hp, i.skills = skillsFor(i.species, i.level), t.push({
        kind: "evolve",
        from: a,
        into: i.species
      });
    }
  }
  return t;
}

function grantXp(i, e) {
  let t = [];
  for (i.xp += e; i.level < PROGRESSION.maxLevel && i.xp >= PROGRESSION.xpToLevel(i.level + 1);) i.level += 1, t.push({
    kind: "playerLevel",
    level: i.level
  });
  return t;
}

function giveItem(i, e, t = 1) {
  return ITEMS[e] ? (i.inventory[e] = (i.inventory[e] || 0) + t, !0) : !1;
}

function takeItem(i, e, t = 1) {
  return (i.inventory[e] || 0) < t ? !1 : (i.inventory[e] -= t, i.inventory[e] <= 0 && delete i.inventory[e], !0);
}

function equipGear(i, e) {
  let t = ITEMS[e];
  if (!t || t.kind !== "gear" || !takeItem(i, e, 1)) return !1;
  let n = i.gear[t.slot];
  return n && giveItem(i, n, 1), i.gear[t.slot] = e, !0;
}

function sumStats(i) {
  let e = {
    hp: 0,
    atk: 0,
    def: 0,
    spa: 0,
    spd: 0,
    spe: 0
  };
  for (let t of ["weapon", "armor", "trinket"]) {
    let n = i.gear[t];
    if (!(!n || !ITEMS[n]?.bonus)) for (let [s, r] of Object.entries(ITEMS[n].bonus)) e[s] = (e[s] || 0) + r;
  }
  return e;
}

function ensureQuests(i) {
  let e = i.quests || (i.quests = {});
  return (!e.active || typeof e.active != "object") && (e.active = {}), (!e.dailies || typeof e.dailies != "object") && (e.dailies = {}), Array.isArray(e.done) || (e.done = []), e;
}

/**
 * The dex: one row per species the player has ever caught.
 *
 * It is what makes a second Cindcub mean something. The first of a species
 * opens its card; every one after that is a duplicate, and duplicates refine
 * into the crystals a star upgrade actually costs — so a species you keep
 * running into becomes the one you can afford to promote.
 */
function dexRow(doc, species) {
  const dex = doc.dex || (doc.dex = {});
  return dex[species] || (dex[species] = { caught: 0, first: 0, best: 1 });
}

function dexRecord(doc, species, creature) {
  const row = dexRow(doc, species);
  const isNew = row.caught === 0;
  row.caught += 1;
  if (isNew) row.first = Date.now();
  if (creature?.star > (row.best || 1)) row.best = creature.star;
  return { isNew, caught: row.caught };
}

const DUPLICATE_TIER = { common: 1, starter: 1, evolved: 2, final: 3, rare: 3, legendary: 5, boss: 4 };

/** What a duplicate capture pays out, in the materials star upgrades consume. */
function duplicateReward(doc, species) {
  const sp = SPECIES[species];
  if (!sp) return {};
  const element = sp.types[0];
  const tier = DUPLICATE_TIER[sp.rarity] ?? 1;
  const out = {};
  const shards = 2 + tier;
  if (giveItem(doc, `shard_${element}`, shards)) out[`shard_${element}`] = shards;
  // Every third duplicate refines into a crystal, and anything above evolved
  // always does — otherwise the rare species you can barely catch twice would
  // pay the same as the one underfoot in the starting zone.
  const crystals = (dexRow(doc, species).caught % 3 === 0 ? 1 : 0) + (tier >= 3 ? 1 : 0);
  if (crystals && giveItem(doc, `crystal_${element}`, crystals)) out[`crystal_${element}`] = crystals;
  return out;
}

/** Everything the dex panel needs, without shipping the whole species table. */
function dexView(doc) {
  const rows = [];
  for (const sp of Object.values(SPECIES)) {
    if (sp.rarity === "boss") continue;
    const row = doc.dex?.[sp.id];
    rows.push({
      id: sp.id,
      name: sp.name,
      he: sp.he,
      rarity: sp.rarity,
      types: sp.types,
      caught: row?.caught || 0,
      best: row?.best || 0,
    });
  }
  const seen = rows.filter((r) => r.caught > 0).length;
  return { rows, seen, total: rows.length };
}

function normalizeDoc(i) {
  ensureQuests(i);
  // Saves that predate the dex get one built from what they already hold, so
  // an existing player does not find their collection empty.
  if (!i.dex) {
    i.dex = {};
    for (const c of Object.values(i.creatures || {})) {
      const row = dexRow(i, c.species);
      row.caught += 1;
      row.first = row.first || (c.caughtAt || Date.now());
      if ((c.star || 1) > row.best) row.best = c.star || 1;
    }
  }
  let e = dayStamp();
  if (i.quests.dailyStamp === e && Object.keys(i.quests.dailies).length) return !1;
  i.quests.dailyStamp = e, i.quests.dailies = {};
  let t = [...DAILY_QUEST_IDS].sort(() => Math.random() - 0.5).slice(0, 3);
  for (let n of t) i.quests.dailies[n] = {
    progress: 0,
    done: !1
  };
  return !0;
}

function syncQuests(i, e) {
  ensureQuests(i);
  let t = [],
    n = (s, r) => {
      let o = Object.prototype.hasOwnProperty.call(QUESTS, s) ? QUESTS[s] : null;
      if (!o?.goal || !r || r.done) return;
      let a = o.goal;
      // Goals measured from what the player holds (level, dex, items, stars)
      // are judged by questState, not counted from events.
      if (o.chain === "npc" && heldProgress(i, o) != null) return;
      // A catch in a zone, of a species, of an element: every one of those
      // conditions has to hold. Capture events used to carry none of them, so
      // "catch two in the Meadow" and "catch a Sproutle" could never finish.
      if (a.species && a.species !== e.species) return;
      if (a.element && !(e.elements || []).includes(a.element)) return;
      if (a.kind === e.kind && !(a.zone && a.zone !== e.zone) && !(a.target && a.target !== e.target) && !(a.party && !e.party)) {
        if (a.star) {
          if (!(Number(e.star) >= a.star)) return;
          r.progress = a.count || 1, r.done = !0, t.push(s);
          return;
        }
        r.progress = (r.progress || 0) + 1, r.progress >= (a.count || 1) && (r.done = !0, t.push(s));
      }
    };
  for (let [s, r] of Object.entries(i.quests.active)) n(s, r);
  for (let [s, r] of Object.entries(i.quests.dailies)) n(s, r);
  return t;
}

/** Accept an errand from someone in town. */
function acceptQuest(i, e) {
  let t = typeof e == "string" && Object.prototype.hasOwnProperty.call(QUESTS, e) ? QUESTS[e] : null;
  if (!t || t.chain !== "npc" || questState(i, t) !== "available") return !1;
  return ensureQuests(i).active[e] = { progress: 0, at: Date.now() }, !0;
}

/** Hand in an errand: take what it asked for, give what it promised. */
function claimNpcQuest(i, t) {
  if (questState(i, t) !== "ready") return null;
  if (t.goal.kind === "deliver" && !takeItem(i, t.goal.item, t.goal.count || 1)) return null;
  delete i.quests.active[t.id], i.quests.done.includes(t.id) || i.quests.done.push(t.id), i.gold += t.reward.gold || 0;
  for (let [o, a] of t.reward.items || []) giveItem(i, o, a);
  let r = grantXp(i, t.reward.xp || 0),
    c = null;
  if (t.reward.creature && SPECIES[t.reward.creature.species]) {
    c = makeCreature(t.reward.creature.species, t.reward.creature.level || 5), addCreature(i, c), dexRecord(i, c.species, c);
  }
  return { reward: t.reward, events: r, creature: c ? creatureCard(i, c.uid) : null };
}

/** A zone's own errands open the first time you set foot there, one at a time. */
function activateZoneQuests(i, z) {
  ensureQuests(i);
  let ids = Object.keys(QUESTS).filter(k => QUESTS[k].chain === "zone" && QUESTS[k].goal?.zone === z).sort((a, b) => QUESTS[a].step - QUESTS[b].step);
  if (!ids.length || ids.some(k => i.quests.active[k])) return !1;
  let next = ids.find(k => !i.quests.done.includes(k));
  return next ? (i.quests.active[next] = { progress: 0 }, !0) : !1;
}

function claimQuest(i, e) {
  let t = typeof e == "string" && Object.prototype.hasOwnProperty.call(QUESTS, e) ? QUESTS[e] : null;
  if (!t) return null;
  ensureQuests(i);
  if (t.chain === "npc") return claimNpcQuest(i, t);
  let n = o => Object.prototype.hasOwnProperty.call(o, e) ? o[e] : null,
    s = n(i.quests.active) || n(i.quests.dailies);
  if (!s || !s.done || s.claimed) return null;
  s.claimed = !0, i.gold += t.reward.gold || 0;
  for (let [o, a] of t.reward.items || []) giveItem(i, o, a);
  let r = grantXp(i, t.reward.xp || 0);
  if (t.chain === "main") {
    delete i.quests.active[e], i.quests.done.includes(e) || i.quests.done.push(e);
    let o = MAIN_QUEST_IDS.indexOf(e),
      a = MAIN_QUEST_IDS[o + 1];
    a && (i.quests.active[a] = {
      progress: 0
    });
  }
  // A zone's chain moves on the same way: hunt, then catch, then the prize.
  t.chain === "zone" && (delete i.quests.active[e], i.quests.done.includes(e) || i.quests.done.push(e), activateZoneQuests(i, t.goal.zone));
  return {
    reward: t.reward,
    events: r
  };
}

function publicProfile(i) {
  return {
    id: i.id,
    name: i.name,
    level: i.level,
    xp: i.xp,
    nextXp: PROGRESSION.xpToLevel(i.level + 1),
    gold: i.gold,
    zone: i.zone,
    appearance: i.appearance,
    trainerHp: i.trainerHp ?? trainerMaxHp(i),
    trainerMaxHp: trainerMaxHp(i),
    team: teamCreatures(i),
    box: (i.box || []).map(e => creatureOf(i, e)).filter(Boolean),
    inventory: i.inventory,
    gear: i.gear,
    friends: i.friends,
    friendRequests: i.friendRequests,
    guildId: i.guildId,
    quests: i.quests,
    dex: i.dex,
    stats: i.stats,
    unlockedZones: i.unlockedZones,
    settings: i.settings
  };
}

var HOUR_MS = 3600 * 1e3;

function emptyBase() {
  return {
    buildings: {
      pod: 1,
      refinery: 1,
      workshop: 1,
      garden: 1
    },
    training: [],
    crafts: [],
    gardenAt: Date.now()
  };
}

function baseOf(i) {
  var t;
  i.base || (i.base = emptyBase());
  let e = i.base;
  e.buildings || (e.buildings = {
    pod: 1,
    refinery: 1,
    workshop: 1,
    garden: 1
  });
  for (let n of Object.keys(BUILDINGS)) (t = e.buildings)[n] ?? (t[n] = 0);
  e.training || (e.training = []), e.crafts || (e.crafts = []), e.gardenAt || (e.gardenAt = Date.now());
  for (let n of Object.values(i.creatures || {})) n.star ?? (n.star = 1);
  return e;
}

function buildingLevel(i, e) {
  return baseOf(i).buildings[e] || 0;
}

function buildingEffect(i, e) {
  let t = buildingLevel(i, e);
  return t > 0 ? BUILDINGS[e].effect(t) : null;
}

function buildingNext(i, e) {
  let t = BUILDINGS[e];
  if (!t) return null;
  let n = buildingLevel(i, e);
  return n >= t.maxLevel ? null : t.cost(n);
}

function canAfford(i, e) {
  if (!e || (i.gold || 0) < (e.gold || 0)) return !1;
  for (let [t, n] of Object.entries(e.items || {})) if ((i.inventory[t] || 0) < n) return !1;
  return !0;
}

function payCost(i, e) {
  if (!canAfford(i, e)) return !1;
  i.gold -= e.gold || 0;
  for (let [t, n] of Object.entries(e.items || {})) takeItem(i, t, n);
  return !0;
}

function upgradeBuilding(i, e) {
  let t = buildingNext(i, e);
  if (!t) return {
    ok: !1,
    reason: "max_level"
  };
  if (!payCost(i, t)) return {
    ok: !1,
    reason: "cannot_afford"
  };
  let n = baseOf(i);
  return n.buildings[e] = (n.buildings[e] || 0) + 1, {
    ok: !0,
    id: e,
    level: n.buildings[e]
  };
}

function upgradeCostOf(i, e) {
  let t = creatureOf(i, e),
    n = t && SPECIES[t.species];
  if (!t || !n) return null;
  let s = t.star || 1;
  if (s >= STARS.max) return {
    maxed: !0
  };
  let r = STARS.cost(s),
    o = `crystal_${n.types[0]}`,
    a = buildingEffect(i, "pod")?.speed || 1;
  return {
    star: s,
    next: s + 1,
    items: {
      [o]: r.crystals,
      ...(r.cores ? {
        aether_core: r.cores
      } : {})
    },
    gold: r.gold,
    hours: Math.round(r.hours / a * 10) / 10,
    ms: Math.round(r.hours * HOUR_MS / a)
  };
}

function freeTrainingSlots(i) {
  let e = buildingEffect(i, "pod")?.slots || 0;
  return Math.max(0, e - baseOf(i).training.length);
}

function startTraining(i, e, t = Date.now()) {
  let n = baseOf(i);
  if (!creatureOf(i, e)) return {
    ok: !1,
    reason: "no_creature"
  };
  if (n.training.some(a => a.uid === e)) return {
    ok: !1,
    reason: "already_training"
  };
  if (freeTrainingSlots(i) <= 0) return {
    ok: !1,
    reason: "no_free_pod"
  };
  let r = upgradeCostOf(i, e);
  if (!r || r.maxed) return {
    ok: !1,
    reason: "max_star"
  };
  if (!payCost(i, {
    gold: r.gold,
    items: r.items
  })) return {
    ok: !1,
    reason: "cannot_afford"
  };
  let o = {
    id: uid().slice(0, 8),
    uid: e,
    star: r.next,
    startedAt: t,
    readyAt: t + r.ms
  };
  return n.training.push(o), {
    ok: !0,
    slot: o
  };
}

function collectTraining(i, e, t = Date.now()) {
  let n = baseOf(i),
    s = n.training.findIndex(c => c.id === e);
  if (s < 0) return {
    ok: !1,
    reason: "no_slot"
  };
  let r = n.training[s];
  if (t < r.readyAt) return {
    ok: !1,
    reason: "not_ready"
  };
  let o = creatureOf(i, r.uid);
  if (n.training.splice(s, 1), !o) return {
    ok: !1,
    reason: "no_creature"
  };
  o.star = Math.min(STARS.max, r.star);
  let a = o.maxHp || 0,
    l = statsFor(o.species, o.level, o.iv, o.star);
  return o.maxHp = l.hp, o.hp = Math.min(l.hp, (o.hp || 0) + Math.max(0, l.hp - a)), {
    ok: !0,
    uid: o.uid,
    star: o.star,
    species: o.species
  };
}

function cancelTraining(i, e) {
  let t = baseOf(i),
    n = t.training.findIndex(s => s.id === e);
  return n < 0 ? {
    ok: !1,
    reason: "no_slot"
  } : (t.training.splice(n, 1), {
    ok: !0
  });
}

function recipesAt(i, e) {
  let t = buildingLevel(i, e);
  return Object.values(RECIPES).filter(n => n.at === e && (n.tier || 1) <= Math.max(1, t)).map(n => ({
    ...n,
    affordable: canAfford(i, {
      gold: n.gold,
      items: n.inputs
    }),
    mins: Math.round(n.mins / (buildingEffect(i, e)?.speed || 1))
  }));
}

function craftsAt(i, e) {
  return baseOf(i).crafts.filter(t => RECIPES[t.recipe]?.at === e).length;
}

function startCraft(i, e, t = Date.now()) {
  let n = RECIPES[e];
  if (!n) return {
    ok: !1,
    reason: "no_recipe"
  };
  let s = buildingLevel(i, n.at);
  if (s <= 0) return {
    ok: !1,
    reason: "not_built"
  };
  if ((n.tier || 1) > s) return {
    ok: !1,
    reason: "building_too_low"
  };
  let r = buildingEffect(i, n.at)?.queue ?? buildingEffect(i, n.at)?.tier ?? 1;
  if (craftsAt(i, n.at) >= r) return {
    ok: !1,
    reason: "queue_full"
  };
  if (!payCost(i, {
    gold: n.gold,
    items: n.inputs
  })) return {
    ok: !1,
    reason: "cannot_afford"
  };
  let o = buildingEffect(i, n.at)?.speed || 1,
    a = Math.round(n.mins * 60 * 1e3 / o),
    l = {
      id: uid().slice(0, 8),
      recipe: e,
      startedAt: t,
      readyAt: t + a
    };
  return baseOf(i).crafts.push(l), {
    ok: !0,
    job: l
  };
}

function collectCrafts(i, e = Date.now()) {
  let t = baseOf(i),
    n = [];
  return t.crafts = t.crafts.filter(s => {
    if (e < s.readyAt) return !0;
    let r = RECIPES[s.recipe];
    if (r) for (let [o, a] of Object.entries(r.output)) giveItem(i, o, a), n.push({
      id: o,
      n: a
    });
    return !1;
  }), n;
}

function gardenYield(i, e = Date.now()) {
  let t = buildingEffect(i, "garden");
  if (!t) return 0;
  let n = Math.min(t.capHours, (e - (baseOf(i).gardenAt || e)) / HOUR_MS);
  return Math.floor(n * t.perHour);
}

function collectGarden(i, e = Date.now()) {
  let t = gardenYield(i, e);
  return baseOf(i).gardenAt = e, t > 0 && giveItem(i, "fiber", t), t;
}

function baseView(i, e = Date.now()) {
  baseOf(i);
  let t = collectCrafts(i, e),
    n = Object.values(BUILDINGS).map(o => {
      let a = buildingLevel(i, o.id),
        l = buildingNext(i, o.id);
      return {
        id: o.id,
        name: o.name,
        he: o.he,
        icon: o.icon,
        desc: o.desc,
        descHe: o.descHe,
        level: a,
        maxLevel: o.maxLevel,
        effect: a > 0 ? o.effect(a) : null,
        next: l ? {
          ...l,
          affordable: canAfford(i, l)
        } : null
      };
    }),
    s = baseOf(i).training.map(o => {
      let a = creatureOf(i, o.uid);
      return {
        ...o,
        species: a?.species,
        level: a?.level,
        name: a?.nickname || null,
        remaining: Math.max(0, o.readyAt - e),
        ready: e >= o.readyAt
      };
    }),
    r = baseOf(i).crafts.map(o => ({
      ...o,
      recipeName: RECIPES[o.recipe]?.name,
      recipeHe: RECIPES[o.recipe]?.he,
      output: RECIPES[o.recipe]?.output,
      remaining: Math.max(0, o.readyAt - e)
    }));
  return {
    now: e,
    buildings: n,
    training: s,
    crafts: r,
    freeSlots: freeTrainingSlots(i),
    garden: {
      ready: gardenYield(i, e),
      perHour: buildingEffect(i, "garden")?.perHour || 0
    },
    recipes: {
      refinery: recipesAt(i, "refinery"),
      workshop: recipesAt(i, "workshop")
    },
    collected: t
  };
}

function creatureCard(i, e) {
  let t = creatureOf(i, e);
  if (!t) return null;
  let n = SPECIES[t.species],
    s = upgradeCostOf(i, e),
    r = s && !s.maxed ? Object.fromEntries(Object.entries(s.items).map(([o, a]) => [o, {
      need: a,
      have: i.inventory[o] || 0
    }])) : {};
  return {
    uid: t.uid,
    species: t.species,
    level: t.level,
    star: t.star || 1,
    iv: t.iv,
    hp: t.hp,
    maxHp: t.maxHp,
    skills: t.skills,
    types: n?.types || [],
    stats: statsFor(t.species, t.level, t.iv, t.star || 1),
    training: baseOf(i).training.find(o => o.uid === e) || null,
    next: s && !s.maxed ? {
      star: s.next,
      gold: s.gold,
      hours: s.hours,
      items: r,
      ready: Object.values(r).every(o => o.have >= o.need) && i.gold >= s.gold
    } : {
      maxed: !0
    }
  };
}

function grantItems(i, e) {
  let t = [];
  for (let [n, s] of Object.entries(e || {})) !ITEMS[n] || s <= 0 || (giveItem(i, n, s), t.push({
    id: n,
    n: s
  }));
  return t;
}

var DAY_MS = 720 * 1e3,
  SAVE_KEY = "hobile.demo.save",
  TICK_MS = 50,
  WILD_COUNT = 14;

function loadSave() {
  try {
    let i = localStorage.getItem(SAVE_KEY);
    return i ? JSON.parse(i) : null;
  } catch {
    return null;
  }
}

function writeSave(i) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(i));
  } catch {}
}

/**
 * Resolve a creature uid coming from the client to a combatant on the
 * requester's own side, then hand it to Combat.switchTo.
 *
 * The client speaks in creature uids (what the player sees in their team
 * panel); Combat speaks in combatant ids, which only exist for the duration of
 * one battle. Nothing bridged the two, so every manual switch was dropped.
 *
 * Ownership matters: without the ownerKey check a player could switch a
 * party member's creature in, or in PvP one of the opponent's.
 */
function swapToUid(sim, you, uid) {
  if (!sim || !you) return { ok: false, reason: "no_battle" };
  if (typeof uid !== "string" || !uid) return { ok: false, reason: "no_target" };
  const mine = ownerKey(you);
  for (const c of sim.combatants.values()) {
    if (c.side !== you.side || c.kind === "trainer") continue;
    if (ownerKey(c) !== mine) continue;
    if (c.creature?.uid !== uid) continue;
    return sim.switchTo(c.id);
  }
  return { ok: false, reason: "no_target" };
}

export { WEATHER_BOOST, acceptQuest, activateZoneQuests, swapToUid, dexRow, dexRecord, duplicateReward, dexView, Combat, Combatant, DAY_MS, HOUR_MS, RALLY_ATK_BONUS, RALLY_DURATION_MS, SAVE_KEY, SWITCH_COOLDOWN_MS, TICK_MS, WILD_COUNT, activeCreature, addCreature, baseOf, baseView, buildingEffect, buildingLevel, buildingNext, canAfford, cancelTraining, claimQuest, collectCrafts, collectGarden, collectTraining, combatantId, combatantSeq, craftsAt, createPlayerDoc, creatureCard, creatureOf, creaturePower, creatureScore, dayStamp, emptyBase, ensureQuests, equipGear, freeTrainingSlots, gardenYield, giveItem, grantItems, grantXp, grantXpTo, healTeam, loadSave, makeCreature, normalizeDoc, num, ownerKey, payCost, publicProfile, recipesAt, startCraft, startTraining, statsOf, sumStats, syncQuests, takeItem, teamCreatures, trainerMaxHp, uid, upgradeBuilding, upgradeCostOf, writeSave };
