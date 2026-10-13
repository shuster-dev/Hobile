import { heldProgress, questState } from '../../shared/story.js';
import { ABILITIES, NATURES, rollAbility, rollNature } from '../../shared/traits.js';
import { earn, spend } from './economy.js';
import { loginView } from './daily.js';
import { JOBS, WORK, bestJob, workRate, workerSlots } from '../../shared/farmwork.js';
import { wardrobeOf, wornLook, wornBonus } from '../../shared/cosmetics.js';
import { LEADERS, LEADER_ORDER, badgeBonus } from '../../shared/leaders.js';
import { passView } from '../../shared/pass.js';
import { arenaView, weekly } from '../../shared/endgame.js';
import { mountKind } from '../../shared/riding.js';
import { familyOf } from '../../shared/saddles.js';
import { AILMENTS, BAD, BOSS_DISABLE, DOT_CHANCE, STATUS, disabledBy, immuneTo, isBad, matchesVs, moveStatus } from '../../shared/status.js';
import { questGold, ECONOMY, ACTIONS, avatarLook, BUILDINGS, DAILY_QUEST_IDS, HOME_ZONE, ITEMS, MAIN_QUEST_IDS, MOVES, PROGRESSION, QUESTS, RECIPES, SPECIES, STARS, captureChance, learnedMoves, skillsFor, starRank, statsFor, typeMultiplier } from '../../shared/gamedata.js';

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
        this.star = Math.max(1, Math.min(5, num(s.star, 1)));
        let r = statsFor(this.species, this.level, num(s.iv, 0.5), this.star, s.nature);
        this.nature = s.nature || null, this.ability = s.ability || null;
        this.stats = {
          hp: Math.floor((r.hp + num(t.hp)) * (1 + num(n.hp))),
          atk: Math.floor((r.atk + num(t.atk)) * (1 + num(n.atk))),
          def: Math.floor((r.def + num(t.def)) * (1 + num(n.def))),
          spa: Math.floor((r.spa + num(t.spa)) * (1 + num(n.spa))),
          spd: Math.floor((r.spd + num(t.spd)) * (1 + num(n.spd))),
          spe: Math.floor((r.spe + num(t.spe)) * (1 + num(n.spe)))
        }, this.kind === "boss" && (this.stats.hp = Math.floor(this.stats.hp * num(e.hpScale, 6))), this.kind !== "creature" && num(e.scale, 1) !== 1 && scaleStats(this.stats, num(e.scale, 1)), this.maxHp = this.stats.hp, this.hp = this.kind === "creature" ? Math.max(0, Math.min(this.maxHp, num(s.hp, this.maxHp))) : this.maxHp, this.types = SPECIES[this.species].types;
        let o = Array.isArray(s.skills) && s.skills.length ? s.skills : SPECIES[this.species].learn.map(([, a]) => a);
        this.skills = o.filter(a => typeof a == "string" && Object.prototype.hasOwnProperty.call(MOVES, a)).slice(0, 4);
      }
      // what a trainer fights with (shared/arms.js): their Strike is it
      this.arm = this.kind === "trainer" && e.arm ? e.arm : null;
      // one of a leader's team (shared/leaders.js): the next comes out when it falls
      this.leader = e.leader || null;
      // guild house and buffs that are not stats (server/guilds.js)
      this.stamMul = 1 + Math.max(0, num(n.stam)), this.cdr = Math.min(0.3, Math.max(0, num(n.cdr)));
      this.ai = AI_TIERS[e.ai] || AI_TIERS.standard;
      this.stamina = PROGRESSION.staminaMax, this.cooldowns = {}, this.effects = [], this.aiDelay = this.kind === "boss" ? 900 : this.ai.first, this.aiNext = Date.now() + this.aiDelay, this.damageDealt = 0;
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
    /** Dizzy, asleep or frozen (shared/status.js): it cannot act. */
    isStunned(e) {
      return !!disabledBy(this.effects, e);
    }
    /** Which of the three is stopping it, or null. */
    disabled(e) {
      return disabledBy(this.effects, e);
    }
    toJSON() {
      return {
        id: this.id,
        side: this.side,
        kind: this.kind,
        name: this.name,
        species: this.species,
        level: this.level,
        star: this.star || 1,
        ability: this.ability || "",
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
  // How a wild fights, by the tier of the zone it lives in (WILD_TIERS in
  // shared/gamedata.js). A novice tries whatever is ready and takes its time;
  // a veteran reads the matchup and presses. Bosses keep their own pace.
  // Tuned with tools/balance.mjs.
  AI_TIERS = {
    novice: { first: 2100, gap: 1900, jitter: 900, pick: "any" },
    standard: { first: 1400, gap: 1300, jitter: 700, pick: "best" },
    veteran: { first: 1100, gap: 1000, jitter: 450, pick: "best" }
  },
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
        f = this.rand() < (e.ability === "keen_eye" ? ABILITIES.keen_eye.crit : 0.0625) ? 1.6 : 1,
        p = 0.85 + this.rand() * 0.3,
        // abilities (shared/traits.js) that change the number itself
        sg = e.ability === "surge" && n.type && e.types.includes(n.type) && e.hp < e.maxHp * ABILITIES.surge.at ? ABILITIES.surge.mul : 1,
        th = t.ability === "thick_hide" && u > 1 ? ABILITIES.thick_hide.mul : 1,
        // The sky is worth something. Rain behind a water move, a storm behind
        // a volt one — fixed at the start of the battle rather than sampled per
        // hit, so a spell turning over mid-fight cannot change what a move is
        // doing halfway through it.
        m = n.type && this.weather?.boost === n.type ? WEATHER_BOOST : 1,
        // a move that feeds on what is already there (shared/moves-status.js):
        // a hex on the poisoned, a shatter on the frozen
        vx = n.effect?.vs && matchesVs(n.effect.vs, t.effects, s ?? Date.now()) ? n.effect.vsMul || 2 : 1,
        x = (2 * e.level / 5 + 2) * n.power * (o * l / Math.max(1, a * c)) / 50 + 2,
        g = Math.floor(x * d * u * f * p * m * sg * th * vx * (1 - h));
      return g = Math.max(1, g), {
        dmg: g,
        eff: u,
        crit: f > 1,
        weather: m > 1,
        surge: sg > 1,
        hide: th < 1,
        vs: vx > 1
      };
    }
    /** An ability doing something: the client puts its name over the creature. */
    abilityFired(c, ability) {
      this.emit({
        kind: "ability",
        target: c.id,
        ability
      });
    }
    applyHit(e, t, n, s, r, o = {}) {
      let {
        dmg: a,
        eff: l,
        crit: c,
        surge: sg,
        hide: th,
        vs: vx
      } = this.computeDamage(e, t, n, r);
      // once a fight is enough to say it: every hit would be noise
      sg && !e.surgeShown && (e.surgeShown = !0, this.abilityFired(e, "surge"));
      th && !t.hideShown && (t.hideShown = !0, this.abilityFired(t, "thick_hide"));
      if (t.ability === "guard" && (t.guardLeft ?? ABILITIES.guard.hits) > 0) {
        t.guardLeft = (t.guardLeft ?? ABILITIES.guard.hits) - 1, a = Math.max(1, Math.floor(a * ABILITIES.guard.mul)), this.abilityFired(t, "guard");
      }
      if (t.ability === "sturdy" && !t.sturdyUsed && t.hp > 1 && t.hp >= t.maxHp * ABILITIES.sturdy.from && a >= t.hp) {
        t.sturdyUsed = !0, a = t.hp - 1, this.abilityFired(t, "sturdy");
      }
      return t.hp = Math.max(0, t.hp - a), this.afterHit(e, t, n, a, r), e.damageDealt += a, e.ownerId && this.contribution.set(e.ownerId, (this.contribution.get(e.ownerId) || 0) + a), this.emit({
        kind: "hit",
        actor: e.id,
        target: t.id,
        skill: s,
        dmg: a,
        eff: l,
        crit: c,
        hp: t.hp,
        ...(vx ? {
          vs: !0
        } : {}),
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
    /** Abilities that answer a hit once it has landed. */
    afterHit(e, t, n, a, r) {
      if (!(a > 0) || e === t) return;
      let contact = n.kind === "physical", A = ABILITIES;
      if (contact && e.alive && e.kind !== "trainer") {
        t.ability === "flame_body" && this.rand() < A.flame_body.chance && this.inflict(e, "burn", 0.06, 3e3, r) && this.abilityFired(t, "flame_body");
        t.ability === "static" && this.rand() < A.static.chance && this.inflict(e, "stun", 1, A.static.dur, r) && this.abilityFired(t, "static");
      }
      if (t.alive) {
        contact && e.ability === "poison_touch" && this.rand() < A.poison_touch.chance && this.inflict(t, "poison", A.poison_touch.value, A.poison_touch.dur, r) && this.abilityFired(e, "poison_touch");
        e.ability === "frostbite" && this.rand() < A.frostbite.chance && this.inflict(t, "slow", A.frostbite.value, A.frostbite.dur, r) && this.abilityFired(e, "frostbite");
      }
      if (e.ability === "vampiric" && e.alive && e.hp < e.maxHp) {
        let h = Math.max(1, Math.floor(a * A.vampiric.share));
        e.hp = Math.min(e.maxHp, e.hp + h), this.emit({
          kind: "heal",
          target: e.id,
          amount: h,
          hp: e.hp,
          ability: "vampiric"
        });
      }
    }
    /** Abilities that act as a creature comes onto the field. */
    onEnter(c, now) {
      let A = ABILITIES;
      if (c.ability === "intimidate") {
        let foes = this.enemiesOf(c).filter(f => f.kind !== "trainer");
        for (let f of foes) f.addEffect("atkDown", A.intimidate.value, A.intimidate.dur, now);
        foes.length && this.abilityFired(c, "intimidate");
      } else if (c.ability === "radiant") {
        let any = !1;
        for (let f of this.alliesOf(c)) {
          if (f.kind === "trainer" || f.hp >= f.maxHp) continue;
          let h = Math.max(1, Math.floor(f.maxHp * A.radiant.heal));
          f.hp = Math.min(f.maxHp, f.hp + h), any = !0, this.emit({
            kind: "heal",
            target: f.id,
            amount: h,
            hp: f.hp
          });
        }
        this.abilityFired(c, "radiant");
      }
    }
    /**
     * Leave a status on a creature (shared/status.js), by the rules a player
     * can learn once: its element may shrug it off, one of each (a second
     * burn renews the first), a creature just woken or thawed cannot be
     * stopped again for a moment, a boss is stopped for less than half as
     * long, and a trainer is never stopped at all. True if it took.
     */
    inflict(t, kind, value, dur, now) {
      if (!t?.alive) return !1;
      let S = STATUS[kind];
      if (!S || !AILMENTS.includes(kind)) return t.addEffect(kind, value, dur, now), !0;
      if (S.disable && t.kind === "trainer") return !1;
      if (immuneTo(t.types, kind)) return this.emit({
        kind: "immune",
        target: t.id,
        status: kind
      }), !1;
      if (S.disable) {
        if (now < (t.resistUntil || 0)) return this.emit({
          kind: "resist",
          target: t.id,
          status: kind
        }), !1;
        t.kind === "boss" && (dur = Math.max(400, Math.round(dur * BOSS_DISABLE)));
        t.resistUntil = now + dur + (S.resist || 0) * (t.kind === "boss" ? 2 : 1);
      }
      let had = t.effects.find(x => x.kind === kind && x.until > now);
      return had ? (had.until = Math.max(had.until, now + dur), had.value = Math.max(had.value, value)) : (t.addEffect(kind, value, dur, now), this.emit({
        kind: "status",
        target: t.id,
        status: kind,
        until: now + dur
      })), !0;
    }
    /** Take statuses off (a potion, a cleansing move, a sleeper woken by a
     *  hit, ice broken by fire). Stopped early still counts as stopped: the
     *  moment it cannot be stopped again starts now. */
    cure(t, kinds, now, why) {
      let gone = [];
      t.effects = t.effects.filter(x => kinds.includes(x.kind) ? (gone.includes(x.kind) || gone.push(x.kind), !1) : !0);
      for (let k of gone) STATUS[k]?.disable && (t.resistUntil = now + (STATUS[k].resist || 0) * (t.kind === "boss" ? 2 : 1));
      return gone.length && this.emit({
        kind: "cured",
        target: t.id,
        statuses: gone,
        why
      }), gone.length;
    }
    /** A hit has landed: a sleeper may wake (an alarm always wakes it), and
     *  fire — or a shatter — breaks the ice. */
    afterLanded(e, t, n, r) {
      if (!t.alive) return;
      let stop = t.disabled(r);
      stop === "sleep" && (n.effect?.wake || this.rand() < STATUS.sleep.wake) ? this.cure(t, ["sleep"], r, "wake") : stop === "freeze" && (n.type === STATUS.freeze.thaw || n.effect?.thaw) && this.cure(t, ["freeze"], r, "thaw");
    }
    applyRiders(e, t, n, s, r) {
      let o = n.effect;
      if (!o) return;
      if (t.alive) {
        o.burn && (o.sure || this.rand() < DOT_CHANCE) && this.inflict(t, "burn", o.burn, o.dur, r);
        o.poison && (o.sure || this.rand() < DOT_CHANCE) && this.inflict(t, "poison", o.poison, o.dur, r);
        o.slow && this.inflict(t, "slow", o.slow, o.dur, r);
        o.stun && this.rand() < o.stun && this.inflict(t, "stun", 1, o.dur, r);
        o.sleep && this.rand() < o.sleep && this.inflict(t, "sleep", 1, o.dur, r);
        o.freeze && this.rand() < o.freeze && this.inflict(t, "freeze", 1, o.dur, r);
        o.defDown && t.addEffect("defDown", o.defDown, o.dur, r);
      }
      if (o.lifesteal && s > 0) {
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
        if (s.cleanse && this.cure(o, BAD, n, "cleanse"), s.shield && o.addEffect("shield", s.shield, s.dur, n), s.atkUp && o.addEffect("atkUp", s.atkUp, s.dur, n), s.defUp && o.addEffect("defUp", s.defUp, s.dur, n), s.hasteUp && o.addEffect("hasteUp", s.hasteUp, s.dur, n), s.heal) {
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
      let stop = s.disabled(o);
      if (stop) return {
        ok: !1,
        reason: stop === "sleep" ? "asleep" : stop === "freeze" ? "frozen_solid" : "stunned"
      };
      if ((s.cooldowns[t] || 0) > o) return {
        ok: !1,
        reason: "cooldown",
        wait: s.cooldowns[t] - o
      };
      if (s.stamina < r.cost) return {
        ok: !1,
        reason: "stamina"
      };
      let a = Math.min(0.4, s.modifier("hasteUp"));
      if (s.cooldowns[t] = o + r.cd * (1 - a) * (s.ability === "swift" ? ABILITIES.swift.mul : 1) * (1 - (s.cdr || 0)), s.stamina -= r.cost, r.kind === "status" && !r.foe) return this.applySelfBuffs(s, r, o), this.emit({
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
        let veil = h.ability === "shadow_veil" && this.rand() < ABILITIES.shadow_veil.chance;
        if (Math.random() > r.acc || veil) {
          this.emit({
            kind: "miss",
            actor: s.id,
            target: h.id,
            skill: t
          }), veil && this.abilityFired(h, "shadow_veil");
          continue;
        }
        // a powder or a song: aimed at them, no damage, only what it leaves
        if (r.foe) {
          this.emit({
            kind: "cast",
            actor: s.id,
            target: h.id,
            skill: t
          }), this.applyRiders(s, h, r, 0, o);
          continue;
        }
        let d = this.applyHit(s, h, r, t, o);
        this.afterLanded(s, h, r, o), this.applyRiders(s, h, r, d, o), h.alive || this.emit({
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
        }), r.cure && this.cure(h, BAD, o, "potion"), {
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
      // the Strike is the weapon in their hand: its power, and a staff's is magic
      let c = {
        kind: t === "strike" && s.arm ? s.arm.kind : r.kind,
        power: t === "strike" && s.arm ? Math.max(r.power, s.arm.power) : r.power,
        type: null,
        acc: 1
      };
      return this.applyHit(s, l, c, "strike", o, {
        trainer: !0
      }), this.afterLanded(s, l, c, o), l.alive || this.emit({
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
      n && (n.benched = !0, n.entered = !1), e.benched = !1, e.entered = !1, e.fought = !0, e.aiNext = Date.now() + e.aiDelay;
      let s = this.teamOf(e).find(r => r.kind === "trainer"),
        // a switch you chose: how long until the next (the chips count it down)
        wait = Math.max(0, (this.switchReady.get(ownerKey(e)) || 0) - Date.now());
      s && s !== e && !s.benched && (s.benched = !0), this.emit({
        kind: "switch",
        side: e.side,
        out: t || null,
        in: e.id,
        ...(wait ? { wait } : {})
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
        reason: "cooldown",
        wait: this.switchReady.get(o) - n
      } : (this.switchReady.set(o, n + SWITCH_COOLDOWN_MS), this.pendingSwitch.delete(o), this.sendOut(t, r?.id || null), {
        ok: !0,
        in: t.id,
        out: r?.id || null
      });
    }
    resolveSwitches(e) {
      // a leader's team has no trainer to send the next one out: it comes by itself
      let crew = this.all().filter(c => c.leader);
      if (crew.length && !crew.some(c => c.onField)) {
        let next = crew.filter(c => c.alive && c.benched).sort((a, b) => a.slot - b.slot)[0];
        if (next) {
          if (!this._leaderNextAt) this._leaderNextAt = e + 1400;
          else if (e >= this._leaderNextAt) this._leaderNextAt = 0, this.sendOut(next, crew.find(c => !c.benched && !c.alive)?.id || null);
        }
      }
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
        for (let n of this.combatants.values()) if (n.alive && (n.tickEffects(t), !n.frozen(t) && (n.stamina = Math.min(PROGRESSION.staminaMax, n.stamina + PROGRESSION.staminaRegenPerSec * e / 1e3 * (n.ability === "focus" ? ABILITIES.focus.mul : 1) * (n.stamMul || 1) * (1 - Math.min(0.6, n.modifier("slow")))), !n.benched))) {
          n.entered || (n.entered = !0, n.kind !== "trainer" && this.onEnter(n, t));
          if (n.ability === "regen" && n.hp < n.maxHp) {
            n.regenAcc = (n.regenAcc || 0) + n.maxHp * ABILITIES.regen.perSec * e / 1e3;
            let step = Math.max(1, Math.floor(n.maxHp * 0.03));
            if (n.regenAcc >= step) {
              let h = Math.floor(n.regenAcc);
              n.regenAcc -= h, n.hp = Math.min(n.maxHp, n.hp + h), this.emit({
                kind: "heal",
                target: n.id,
                amount: h,
                hp: n.hp,
                ability: "regen"
              });
            }
          }
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
        a = -1,
        tier = e.kind === "boss" ? null : e.ai;
      if (tier?.pick === "any") o = r[Math.floor(Math.random() * r.length)];
      else for (let c of r) {
        let h = c.type ? typeMultiplier(c.type, s.types) : 1,
          d = (c.power || 30) * h * (c.kind === "status" ? 0.4 : 1) * (0.85 + Math.random() * 0.3);
        // the status moves (shared/moves-status.js) are worth what they would
        // do now: nothing on a target that already has it, cannot take it or
        // was just woken; a lot when it is free to land — and a wash when
        // something is eating at it
        if (c.foe) {
          let st = moveStatus(c);
          d = !st || s.effects.some(x => x.kind === st && x.until > t) || immuneTo(s.types, st) || STATUS[st]?.disable && t < (s.resistUntil || 0) ? 0 : 54 * (0.85 + Math.random() * 0.3);
        } else if (c.effect?.cleanse && e.effects.some(x => isBad(x.kind) && x.until > t)) d = 75;
        else c.effect?.vs && matchesVs(c.effect.vs, s.effects, t) && (d *= c.effect.vsMul || 2);
        d > a && (a = d, o = c);
      }
      this.useSkill(e.id, o.id, s.id);
      let l = tier ? tier.gap : 800;
      e.aiNext = t + l + Math.random() * (tier ? tier.jitter : 700);
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

/** A wild's stats in a zone that fights softer or harder than its level. */
function scaleStats(stats, s) {
  for (const k of ["hp", "atk", "def", "spa", "spd"]) stats[k] = Math.max(1, Math.round(stats[k] * s));
}

function creaturePower(i, e) {
  let t = i && Object.prototype.hasOwnProperty.call(SPECIES, i.species) ? SPECIES[i.species] : null;
  if (!t) return 0;
  let n = t.base,
    s = n.hp + n.atk + n.def + n.spa + n.spd + n.spe,
    r = i.kind === "boss" ? 6 : 1,
    o = Math.max(0.35, Math.min(2.2, i.level / Math.max(1, e)));
  return Math.floor(s * i.level / 34 * o * r * ECONOMY.xpMul);
}

function creatureScore(i) {
  if (!i || !Object.prototype.hasOwnProperty.call(SPECIES, i.species)) return 0;
  let e = i.kind === "boss" ? 25 : 1;
  return Math.floor((ECONOMY.winGold[0] + i.level * ECONOMY.winGold[1]) * e * (0.85 + Math.random() * 0.3));
}

function uid() {
  let i = globalThis.crypto;
  return i?.randomUUID ? i.randomUUID() : "x".repeat(1).concat(Math.random().toString(36).slice(2), Date.now().toString(36));
}

function makeCreature(i, e, t = {}) {
  let n = t.iv ?? Math.round((0.3 + Math.random() * 0.7) * 100) / 100,
    nature = NATURES[t.nature] ? t.nature : rollNature(),
    ability = ABILITIES[t.ability] ? t.ability : rollAbility(SPECIES[i]?.types),
    s = statsFor(i, e, n, 1, nature);
  return {
    uid: uid(),
    species: i,
    nickname: t.nickname || null,
    level: e,
    // At the start of its level, not at zero: XP is counted from level 1, so a
    // level-5 creature made with 0 had to earn levels 1 to 5 again before its
    // first level-up — eleven wins for a starter instead of four, forty for a
    // level-20 catch instead of five.
    xp: e > 1 ? PROGRESSION.xpToLevel(e) : 0,
    iv: n,
    star: 1,
    hp: s.hp,
    maxHp: s.hp,
    stamina: PROGRESSION.staminaMax,
    skills: skillsFor(i, e),
    caughtAt: Date.now(),
    nature,
    ability,
    shiny: t.shiny ?? Math.random() < 0.004 * (t.shinyMul || 1)
  };
}

/** What a caught wild keeps of itself: the creature in the sphere is the one
 *  that was fought, not a fresh roll of the same species. */
function inherit(c) {
  return c ? { iv: c.iv, nature: c.nature, ability: c.ability, shiny: !!c.shiny } : {};
}

function statsOf(i) {
  return statsFor(i.species, i.level, i.iv, i.star || 1, i.nature);
}

// `n` the starter, or "none": a trainer who sets out with nobody, a wooden
// sword in hand, and brings down and catches their first themselves.
function createPlayerDoc(i, e, t = {}, n = "sproutle") {
  let s = n === "none" || !n ? null : makeCreature(n, 5);
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
    appearance: avatarLook(t || {}),
    team: s ? [s.uid] : [],
    box: [],
    creatures: s ? {
      [s.uid]: s
    } : {},
    inventory: {
      sphere_basic: 10,
      potion_s: 5
    },
    gear: {
      weapon: s ? null : "sword_wood",
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

/**
 * What each of a player's creatures has left goes home with it — each its
 * own, by uid. It used to be written onto "the lead": switch your strongest
 * in, win, and the one at the front of the team came home with the strong
 * one's health (423 of 86). A fight's health can run past the card's (gear
 * adds to it), so what comes home is capped at the card's.
 */
function settleHp(sim, owner, doc) {
  if (!sim || !owner || !doc?.creatures) return;
  const key = ownerKey(owner);
  for (const c of sim.combatants.values()) {
    // the trainer goes home as hurt as they came out (field-fight.js counts it too)
    if (c.kind === "trainer" && c.side === owner.side && ownerKey(c) === key && !c.benched) doc.trainerHp = Math.max(0, Math.round(c.hp));
    if (c.kind !== "creature" || c.side !== owner.side || ownerKey(c) !== key) continue;
    const cr = doc.creatures[c.creature?.uid];
    if (!cr) continue;
    cr.hp = Math.max(0, Math.min(cr.maxHp || c.maxHp, Math.round(c.hp)));
  }
}

/** The creature that finished the fight (it earns the fight's XP), or the lead. */
function fieldCreature(doc, you) {
  const c = you?.kind === "creature" ? creatureOf(doc, you.creature?.uid) : null;
  return c && c.hp > 0 ? c : activeCreature(doc);
}

function teamCreatures(i) {
  return (i.team || []).map(e => creatureOf(i, e)).filter(Boolean);
}

function addCreature(i, e) {
  return i.creatures[e.uid] = e, i.team.length < 6 ? i.team.push(e.uid) : i.box.push(e.uid), e;
}

function healTeam(i, e = 1) {
  for (let n of teamCreatures(i)) {
    // one in a clinic's care gets better there, and is collected (shared/clinic.js)
    if (n.ward) continue;
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

// `doc`, when given, is the owner: an evolution fills in the new species in
// their collection, as owning one does.
/**
 * A win's experience: all of it to the one who fought it, and a share to the
 * rest of the team — the whole of it to one five levels or more behind the
 * fighter, so a new catch catches up. Only the one on the field used to learn
 * anything, so a team was one strong creature and five that a leader's
 * second creature swept away (tools/journey-bot.mjs found it).
 */
function teamXp(doc, lead, xp) {
  let ev = [], top = lead?.level || 0;
  lead && ev.push(...grantXpTo(lead, xp, doc));
  for (let c of teamCreatures(doc)) c && c.uid !== lead?.uid && ev.push(...grantXpTo(c, Math.round(xp * (c.level <= top - 5 ? 1 : PROGRESSION.teamXpShare)), doc));
  return ev;
}

function grantXpTo(i, e, doc = null) {
  let t = [];
  for (i.xp += e; i.level < PROGRESSION.maxLevel && i.xp >= PROGRESSION.xpToLevel(i.level + 1);) {
    let was = statsFor(i.species, i.level, i.iv, i.star || 1, i.nature);
    i.level += 1;
    let n = statsFor(i.species, i.level, i.iv, i.star || 1, i.nature),
      s = n.hp - i.maxHp;
    i.maxHp = n.hp, i.hp = Math.min(n.hp, i.hp + Math.max(0, s));
    // what it learns at this level; whether it goes straight into the four
    // depends on whether its trainer has chosen them (creatureCard / setMoves)
    let r = new Set(learnedMoves(i.species, i.level - 1));
    i.skills = skillsFor(i.species, i.level, i.picked);
    for (let a of learnedMoves(i.species, i.level)) r.has(a) || t.push({
      kind: "skill",
      skill: a,
      equipped: i.skills.includes(a)
    });
    // what the level gave it: health, strength, the rest (the client says so)
    t.push({
      kind: "level",
      level: i.level,
      uid: i.uid,
      gain: Object.fromEntries(["hp", "atk", "def", "spa", "spd", "spe"].map(k => [k, Math.max(0, (n[k] || 0) - (was[k] || 0))]))
    });
    // "your partner grows" (shared/journey.js)
    doc && syncQuests(doc, { kind: "grow" });
    let o = SPECIES[i.species].evolve;
    if (o && i.level >= o.level) {
      let a = i.species;
      i.species = o.into;
      let l = statsFor(i.species, i.level, i.iv, i.star || 1, i.nature);
      let seen = doc ? dexRecord(doc, i.species, i) : null;
      i.maxHp = l.hp, i.hp = l.hp, i.skills = skillsFor(i.species, i.level, i.picked), t.push({
        kind: "evolve",
        from: a,
        into: i.species,
        uid: i.uid,
        level: i.level,
        star: i.star || 1,
        shiny: !!i.shiny,
        newSpecies: !!seen?.isNew
      });
    }
  }
  // a move is learnt once, and said as it ended up: in the four or waiting on
  // the card (an evolution part-way can do either to it)
  let known = new Set(learnedMoves(i.species, i.level)), said = new Set();
  return t.filter(x => x.kind !== "skill" || known.has(x.skill) && !said.has(x.skill) && said.add(x.skill)).map(x => x.kind === "skill" ? { ...x, equipped: i.skills.includes(x.skill) } : x);
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
    let n = i.gear?.[t];
    if (!(!n || !ITEMS[n]?.bonus)) for (let [s, r] of Object.entries(ITEMS[n].bonus)) e[s] = (e[s] || 0) + r;
  }
  // and what is worn from the tailor's (shared/cosmetics.js)
  for (let [s, r] of Object.entries(wornBonus(i))) e[s] = (e[s] || 0) + r;
  // and every leader's badge held (shared/leaders.js)
  for (let [s, r] of Object.entries(badgeBonus(i))) e[s] = (e[s] || 0) + r;
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

/**
 * One of each (Meir, 12.10): a trainer keeps one creature of every line. A
 * second of a line they already have — caught, given by a quest, found in a
 * box from before — does not join; it leaves what it is worth instead: shards
 * of its element (and a crystal now and then) for the star upgrades, fiber and
 * scrap for the base, a core from the rare ones, experience for the one the
 * trainer has, and its shine if it had one.
 */
function duplicateReward(doc, species) {
  const sp = SPECIES[species];
  if (!sp) return {};
  const element = sp.types[0];
  const tier = DUPLICATE_TIER[sp.rarity] ?? 1;
  const caught = dexRow(doc, species).caught;
  const out = {};
  const put = (id, n) => n > 0 && giveItem(doc, id, n) && (out[id] = (out[id] || 0) + n);
  put(`shard_${element}`, 2 + tier);
  // Every third refines into a crystal, and anything above evolved always
  // does — otherwise the rare species you can barely catch twice would pay
  // the same as the one underfoot in the starting zone.
  put(`crystal_${element}`, (caught % 3 === 0 ? 1 : 0) + (tier >= 3 ? 1 : 0));
  put("fiber", 2 + tier);
  put("scrap_iron", 1 + tier);
  put("aether_core", tier >= 4 || caught % 6 === 0 ? 1 : 0);
  return out;
}

/** The creature of this line the trainer already has (wherever it is), or null. */
function familyOwned(doc, species) {
  const f = familyOf(species);
  for (const c of Object.values(doc?.creatures || {})) if (c && SPECIES[c.species] && familyOf(c.species) === f) return c;
  return null;
}

/**
 * A creature coming to the trainer. New to them: it joins (the team, or the
 * box). One of a line they already have: the one they have takes what the new
 * one brings — experience, its shine — and the trainer the materials
 * (duplicateReward). Returns what happened, for the result screen.
 */
function takeIn(doc, c) {
  const had = c && familyOwned(doc, c.species);
  if (!had) return addCreature(doc, c), { joined: !0, creature: c };
  const items = duplicateReward(doc, c.species),
    xp = Math.max(1, creaturePower(c, had.level)),
    events = grantXpTo(had, xp, doc),
    shiny = !!c.shiny && !had.shiny;
  shiny && (had.shiny = !0);
  return { joined: !1, creature: had, items, xp, events, shiny };
}

/**
 * Trainers who caught the same line more than once before there was one of
 * each: the furthest along of them stays (in a pod first — its upgrade is
 * paid for — then by stars, then by experience), takes the others' shine,
 * saddle and the most experience any of them had, and stands where the first
 * of them stood in the team. The others become what a duplicate is worth.
 * Idempotent: with nothing to merge it changes nothing.
 */
function mergeDuplicates(doc) {
  const groups = new Map();
  for (const c of Object.values(doc.creatures || {})) {
    if (!c || !SPECIES[c.species]) continue;
    const f = familyOf(c.species);
    groups.has(f) || groups.set(f, []), groups.get(f).push(c);
  }
  const merged = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const pod = new Set((doc.base?.training || []).map((t) => t.uid)),
      rank = (c) => (pod.has(c.uid) ? 1e12 : 0) + (c.star || 1) * 1e9 + (c.xp || 0) + (c.shiny ? 0.5 : 0);
    list.sort((a, b) => rank(b) - rank(a));
    const keep = list[0];
    for (const c of list.slice(1)) {
      (c.xp || 0) > (keep.xp || 0) && grantXpTo(keep, c.xp - (keep.xp || 0), doc);
      c.shiny && (keep.shiny = !0), c.saddle && (keep.saddle = !0), !keep.nickname && c.nickname && (keep.nickname = c.nickname);
      isWorker(doc, c.uid) && unassignWorker(doc, c.uid);
      const team = doc.team || (doc.team = []), ti = team.indexOf(c.uid);
      if (ti >= 0) {
        if (team.includes(keep.uid) || pod.has(keep.uid)) team.splice(ti, 1);
        else isWorker(doc, keep.uid) && unassignWorker(doc, keep.uid), team[ti] = keep.uid, doc.box = (doc.box || []).filter((u) => u !== keep.uid);
      }
      doc.box = (doc.box || []).filter((u) => u !== c.uid);
      doc.base && (doc.base.training = (doc.base.training || []).filter((t) => t.uid !== c.uid));
      doc.riding === c.uid && (doc.riding = keep.saddle && mountKind(keep.species, keep.star || 1) ? keep.uid : null);
      delete doc.creatures[c.uid];
      merged.push({ species: c.species, level: c.level, into: keep.uid, intoSpecies: keep.species, items: duplicateReward(doc, c.species) });
    }
  }
  // a team is never left empty
  if (doc.team && !doc.team.length) {
    const k = (doc.box || []).findIndex((u) => !isWorker(doc, u));
    k >= 0 && doc.team.push(doc.box.splice(k, 1)[0]);
  }
  merged.length && (doc.merged = { at: Date.now(), list: merged });
  return merged;
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
  // The main story grew (shared/saga.js): one who finished what there was
  // picks it up again at the next step.
  // The journey was laid out again (shared/journey.js): steps it no longer
  // has leave the list, one who is further along is not sent back to the
  // steps that were put in before where they are, and whatever is done but
  // was never collected is paid now.
  for (let k of Object.keys(i.quests.active)) QUESTS[k]?.chain === "retired" && delete i.quests.active[k];
  let far = Math.max(-1, ...i.quests.done.map(k => MAIN_QUEST_IDS.indexOf(k)), ...Object.keys(i.quests.active).map(k => MAIN_QUEST_IDS.indexOf(k)));
  for (let n = 0; n < far; n++) i.quests.done.includes(MAIN_QUEST_IDS[n]) || (i.quests.done.push(MAIN_QUEST_IDS[n]), delete i.quests.active[MAIN_QUEST_IDS[n]]);
  if (!MAIN_QUEST_IDS.some(k => i.quests.active[k])) {
    let next = MAIN_QUEST_IDS.find(k => !i.quests.done.includes(k));
    next && (i.quests.active[next] = { progress: 0 });
  }
  autoClaim(i, Object.keys(i.quests.active).filter(k => i.quests.active[k]?.done));
  syncQuests(i, { kind: "look" });
  // the leaders came after some had gone past them: theirs is the badge
  for (let l of Object.values(LEADERS)) i.quests.done.includes(`q_l_${l.zone}`) && !(i.badges ||= []).includes(l.badge.id) && i.badges.push(l.badge.id);
  // ...and one who had already been further than a leader before there were
  // any (in a later world now, or with errands done or open there) has that
  // leader's badge and every one before it: the gate behind them is not shut
  {
    let been = (z) => i.zone === z || i.quests.done.some(id => QUESTS[id]?.goal?.zone === z) || Object.keys(i.quests.active).some(id => QUESTS[id]?.chain === "zone" && QUESTS[id].goal?.zone === z),
      far = LEADER_ORDER.reduce((m, z, j) => been(z) ? j : m, -1);
    for (let j = 0; j < far; j++) { let b = LEADERS[LEADER_ORDER[j]].badge.id; (i.badges ||= []).includes(b) || i.badges.push(b); }
  }
  // Training used to leave a creature in the team. Now it is at the farm:
  // move any that are in a pod out of the team and the box — keeping one
  // in the team to walk with you — and put back any that belong nowhere.
  if (i.creatures && i.base?.training?.length) {
    i.team ||= [], i.box ||= [];
    for (const t of i.base.training) {
      if (t.from !== undefined) continue;
      const k = i.team.indexOf(t.uid), b = i.box.indexOf(t.uid);
      if (k >= 0 && i.team.length > 1) i.team.splice(k, 1), t.from = "team", t.pos = k;
      else if (b >= 0) i.box.splice(b, 1), t.from = "box", t.pos = b;
      else if (k < 0) t.from = "box", t.pos = 0;
    }
    // However one got there, a creature in a pod is at the farm — not also
    // in the team, walking beside you (it was seen doing both). The last one
    // able to fight stays, as startTraining allows.
    const away = new Set(i.base.training.map(t => t.uid));
    const box = i.box.filter(u => !away.has(u)), team = i.team.filter(u => !away.has(u));
    if (!team.length) {
      const k = box.findIndex(u => creatureOf(i, u) && !isWorker(i, u));
      k >= 0 && team.push(box.splice(k, 1)[0]);
    }
    team.length && (i.team = team), i.box = box;
  }
  // each creature once: in the team, or else in the box
  if (i.team) i.team = [...new Set(i.team)];
  if (i.box) i.box = [...new Set(i.box)].filter(u => !(i.team || []).includes(u));
  if (i.creatures && i.team) {
    const placed = new Set([...(i.team || []), ...(i.box || []), ...((i.base?.training || []).map(t => t.uid))]);
    for (const u of Object.keys(i.creatures)) placed.has(u) || (i.box ||= []).push(u);
  }
  // One of each (12.10): a line caught more than once is folded into one.
  i.creatures && mergeDuplicates(i);
  // Creatures from before natures and abilities get theirs now — from their
  // uid, so the same creature is the same on every server and every load.
  for (const c of Object.values(i.creatures || {})) {
    if (!c) continue;
    NATURES[c.nature] || (c.nature = rollNature(null, c.uid));
    ABILITIES[c.ability] || (c.ability = rollAbility(SPECIES[c.species]?.types, null, c.uid));
    // health that came home onto the wrong creature (settleHp) back inside its card
    c.maxHp > 0 && c.hp > c.maxHp && (c.hp = c.maxHp);
    c.hp < 0 && (c.hp = 0);
  }
  // The first ten minutes' guide (shared/tutorial.js): a new player gets it;
  // someone who was already well on their way when it arrived does not.
  if (!i.tutorial || typeof i.tutorial !== "object") {
    i.tutorial = (i.level || 1) >= 3 || (i.quests?.done || []).length >= 2 ? { steps: [], done: !0, legacy: !0 } : { steps: [] };
  }
  // Riding came before saddles: whoever was up on a creature when saddles
  // arrived keeps a saddle on that one, rather than finding it gone.
  if (!i.saddlesSince) {
    i.saddlesSince = Date.now();
    const rc = i.riding && i.creatures?.[i.riding];
    rc && mountKind(rc.species, rc.star || 1) && (rc.saddle = true);
  }
  // Characters from before there were kinds get the one nearest their outfit.
  i.appearance = avatarLook(i.appearance || {});
  // Creatures made before that fix are still short of their own level. Give
  // each what its level already implies, keep what it earned on top, and stop
  // one point short of the next level, so a level-up still happens in a fight
  // and says so, rather than silently here.
  for (const c of Object.values(i.creatures || {})) {
    if (!c || !(c.level > 1)) continue;
    const base = PROGRESSION.xpToLevel(c.level), xp = Number(c.xp) || 0;
    if (xp < base) c.xp = Math.min(base + Math.max(0, xp), PROGRESSION.xpToLevel(c.level + 1) - 1);
  }
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
  // held goals of the journey (shared/journey.js): the whole collection, and
  // a partner a level up from where it was when the step opened — however
  // it got there (a battle, a win in the open with your weapon, training)
  for (let [s, r] of Object.entries(i.quests.active)) {
    let o = QUESTS[s];
    if (o?.chain !== "main" || r.done) continue;
    if (o.goal?.kind === "dex") r.progress = dexCount(i), r.progress >= (o.goal.count || 1) && (r.done = !0, t.push(s));
    // the league may have been beaten before this step came round
    else if (o.goal?.kind === "league") i.league?.at && (r.progress = 1, r.done = !0, t.push(s));
    // ...and so may a world's errands, or its leader: a player who got there
    // first is not left waiting on a claim or a badge that already happened
    else if (o.goal?.kind === "claim") i.quests.done.includes(o.goal.target) && (r.progress = 1, r.done = !0, t.push(s));
    else if (o.goal?.kind === "badge") (i.badges || []).includes(LEADERS[o.goal.target]?.badge.id) && (r.progress = 1, r.done = !0, t.push(s));
    else if (o.goal?.kind === "grow") {
      let top = teamTop(i);
      r.base ??= top;
      top > r.base && (r.progress = 1, r.done = !0, t.push(s));
    }
  }
  // The journey does not wait in a panel: a step of the story or of a
  // world's errands that is done is paid and the next one opened, now.
  autoClaim(i, t);
  return t;
}

const teamTop = (i) => Math.max(0, ...teamCreatures(i).map((c) => c.level || 1));
const dexCount = (i) => Object.entries(i.dex || {}).filter(([k, r]) => r?.caught > 0 && SPECIES[k] && SPECIES[k].rarity !== "boss").length;

/** Pay what is done of the story and the worlds' errands, and say so. */
function autoClaim(i, ids) {
  for (let id of ids) {
    let q = QUESTS[id];
    if (!q || (q.chain !== "main" && q.chain !== "zone")) continue;
    let live = i.quests.active[id];
    if (!live?.done || live.claimed) continue;
    let r = claimQuest(i, id);
    if (!r) continue;
    // the whole collection: up on the Wall of Champions, for good
    // (a league champion already has a frame: it says the collection too)
    id === "q_main_dex" && (i.champion ? (i.champion.dex = Date.now()) : (i.champion = { at: Date.now(), level: i.level || 1, dex: Date.now() }));
    let next = q.chain === "main" ? MAIN_QUEST_IDS[MAIN_QUEST_IDS.indexOf(id) + 1] || null : null;
    // what the client shows once: done, what it paid, and what is next
    let news = (i.quests.news ||= []);
    news.push({ id, at: Date.now(), next, reward: q.reward ? { gold: questGold(q, i.level), items: q.reward.items || [], xp: q.reward.xp || 0 } : null, creature: r.creature?.species || null });
    news.length > 6 && news.splice(0, news.length - 6);
    // the step just opened may already be done (a held goal: the errands or
    // the leader got to first): judge it now, not at the next fight
    q.chain === "main" && next && syncQuests(i, { kind: "open" });
  }
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
  delete i.quests.active[t.id], i.quests.done.includes(t.id) || i.quests.done.push(t.id), earn(i, t.reward.gold || 0, "quest");
  for (let [o, a] of t.reward.items || []) giveItem(i, o, a);
  let r = grantXp(i, t.reward.xp || 0),
    c = null;
  if (t.reward.creature && SPECIES[t.reward.creature.species]) {
    c = makeCreature(t.reward.creature.species, t.reward.creature.level || 5), dexRecord(i, c.species, c);
    let got = takeIn(i, c);
    got.joined || (r.push(...got.events), c = null);
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
  s.claimed = !0, earn(i, questGold(t, i.level), "quest");
  for (let [o, a] of t.reward.items || []) giveItem(i, o, a);
  let r = grantXp(i, t.reward.xp || 0),
    gift = null;
  // a story step may end with someone joining you (shared/saga.js)
  if (t.reward.creature && SPECIES[t.reward.creature.species]) {
    let c = makeCreature(t.reward.creature.species, t.reward.creature.level || 5);
    dexRecord(i, c.species, c);
    let got = takeIn(i, c);
    got.joined ? gift = creatureCard(i, c.uid) : r.push(...got.events);
  }
  if (t.chain === "main") {
    delete i.quests.active[e], i.quests.done.includes(e) || i.quests.done.push(e);
    let o = MAIN_QUEST_IDS.indexOf(e),
      a = MAIN_QUEST_IDS[o + 1];
    a && (i.quests.active[a] = {
      progress: 0,
      ...(QUESTS[a]?.goal?.kind === "grow" ? { base: teamTop(i) } : {})
    });
  }
  // A zone's chain moves on the same way: hunt, then catch, then the prize.
  t.chain === "zone" && (delete i.quests.active[e], i.quests.done.includes(e) || i.quests.done.push(e), activateZoneQuests(i, t.goal.zone));
  // a world's step of the journey is its errands done (shared/journey.js)
  t.chain === "zone" && syncQuests(i, { kind: "claim", target: e, zone: t.goal.zone });
  return {
    reward: t.reward,
    events: r,
    creature: gift
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
    // with what they wear from the tailor (shared/cosmetics.js)
    appearance: wornLook(i),
    wardrobe: wardrobeOf(i),
    trainerHp: i.trainerHp ?? trainerMaxHp(i),
    trainerMaxHp: trainerMaxHp(i),
    team: teamCreatures(i),
    box: (i.box || []).map(e => {
      let c = creatureOf(i, e), w = i.base?.workers?.find(x => x.uid === e);
      return c && (w ? { ...c, job: w.job } : c);
    }).filter(Boolean),
    // in a pod at the farm: not in the team or the box until they come back
    away: (i.base?.training || []).map(e => {
      let t = creatureOf(i, e.uid);
      return t && { ...t, training: { star: e.star, readyAt: e.readyAt } };
    }).filter(Boolean),
    inventory: i.inventory,
    gear: i.gear,
    friends: i.friends,
    friendRequests: i.friendRequests,
    guildId: i.guildId,
    quests: i.quests,
    dex: i.dex,
    stats: i.stats,
    unlockedZones: i.unlockedZones,
    settings: i.settings,
    login: loginView(i),
    // endgame (shared/endgame.js): ranked season, this week's numbers, bests
    arena: arenaView(i),
    weekly: { ...weekly(i) },
    records: i.records || {},
    milestones: Array.isArray(i.milestones) ? i.milestones : [],
    champion: i.champion || null,
    league: i.league || null,
    badges: Array.isArray(i.badges) ? i.badges : [],
    // the end of the story (shared/saga.js): scenes watched, anchors broken
    story: { seen: [...(i.story?.seen || [])], anchors: [...(i.story?.anchors || [])] },
    // the season's track (shared/pass.js)
    pass: passView(i),
    // pieces toward saddles, by family (shared/saddles.js)
    mats: { ...(i.mats || {}) },
    // the last time duplicates were folded together (mergeDuplicates)
    merged: i.merged || null,
    // the first ten minutes' guide (shared/tutorial.js)
    tutorial: { steps: [...(i.tutorial?.steps || [])], done: !!i.tutorial?.done, skipped: !!i.tutorial?.skipped }
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
  // workers are in the box: one that left it (traded, in the team, in a pod) stops
  if (!Array.isArray(e.workers)) e.workers = [];
  if (e.workers.length) {
    let seen = new Set();
    e.workers = e.workers.filter(w => w && JOBS[w.job] && i.creatures?.[w.uid] && (i.box || []).includes(w.uid) && !seen.has(w.uid) && seen.add(w.uid));
  }
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

function payCost(i, e, sink = "building") {
  if (!canAfford(i, e)) return !1;
  spend(i, e.gold || 0, sink);
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
    // the guild forge takes some off the gold (server/guilds.js)
    gold: Math.round(r.gold * (1 - (i.guildPerks?.train || 0))),
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
  // It goes to the farm for the whole of it: out of the team, so it cannot be
  // sent into a fight from a pod. The last one able to fight stays, unless
  // there is one in the box to take its place.
  let team = i.team || (i.team = []), box = i.box || (i.box = []),
    from = team.includes(e) ? "team" : box.includes(e) ? "box" : "",
    pos = from === "team" ? team.indexOf(e) : box.indexOf(e);
  if (from === "team" && !team.some(a => a !== e && creatureOf(i, a)) && !box.some(a => creatureOf(i, a))) return {
    ok: !1,
    reason: "last_fighter"
  };
  if (!payCost(i, {
    gold: r.gold,
    items: r.items
  }, "training")) return {
    ok: !1,
    reason: "cannot_afford"
  };
  // off its job and into a pod: what it made so far is paid
  isWorker(i, e) && unassignWorker(i, e, t);
  let o = {
    id: uid().slice(0, 8),
    uid: e,
    star: r.next,
    startedAt: t,
    readyAt: t + r.ms,
    from,
    pos
  };
  if (from === "team") {
    team.splice(pos, 1);
    // (and any second copy of it: one creature, one place)
    for (let k; (k = team.indexOf(e)) >= 0;) team.splice(k, 1);
    // someone has to walk beside you: the first in the box steps up (one
    // that is not at work if there is one; a worker leaves its job, paid)
    if (!team.length && box.length) {
      let k = Math.max(0, box.findIndex(a => !isWorker(i, a)));
      isWorker(i, box[k]) && unassignWorker(i, box[k], t);
      team.push(box.splice(k, 1)[0]);
    }
  } else if (from === "box") box.splice(pos, 1);
  return n.training.push(o), {
    ok: !0,
    slot: o
  };
}

/** Back from the farm: to its old place in the team if there is room. */
function returnFromFarm(i, slot) {
  let e = slot.uid;
  if (!creatureOf(i, e)) return;
  let team = i.team || (i.team = []), box = i.box || (i.box = []);
  if (team.includes(e) || box.includes(e)) return;
  if (slot.from !== "box" && team.length < 6) team.splice(Math.min(slot.pos ?? team.length, team.length), 0, e);
  else box.push(e);
}

/** In a pod at the farm right now. */
function atFarm(i, e) {
  return !!i?.base?.training?.some(t => t.uid === e);
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
  if (n.training.splice(s, 1), returnFromFarm(i, r), !o) return {
    ok: !1,
    reason: "no_creature"
  };
  let was = o.star || 1;
  o.star = Math.min(STARS.max, r.star);
  let a = o.maxHp || 0,
    l = statsFor(o.species, o.level, o.iv, o.star, o.nature);
  return o.maxHp = l.hp, o.hp = Math.min(l.hp, (o.hp || 0) + Math.max(0, l.hp - a)), {
    ok: !0,
    uid: o.uid,
    star: o.star,
    was,
    slotId: r.id,
    species: o.species
  };
}

function cancelTraining(i, e) {
  let t = baseOf(i),
    n = t.training.findIndex(s => s.id === e);
  return n < 0 ? {
    ok: !1,
    reason: "no_slot"
  } : (returnFromFarm(i, t.training.splice(n, 1)[0]), {
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
    mins: Math.round(n.mins / ((buildingEffect(i, e)?.speed || 1) * workBoost(i, "forge")))
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
  }, "craft")) return {
    ok: !1,
    reason: "cannot_afford"
  };
  let o = (buildingEffect(i, n.at)?.speed || 1) * workBoost(i, "forge"),
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
  return Math.floor(n * t.perHour * workBoost(i, "garden"));
}

function collectGarden(i, e = Date.now()) {
  let t = gardenYield(i, e);
  return baseOf(i).gardenAt = e, t > 0 && giveItem(i, "fiber", t), t;
}

/* ---- Work at the farm (shared/farmwork.js) ----
 * A creature from the box put to a job keeps doing it while you are away:
 * base.workers = [{uid, job, since, carry}]. What it turned out since `since`
 * (up to WORK.capHours) waits to be collected; the part of an item not yet
 * whole is carried to the next time, so a slow trickle is never lost. */
function workersOf(i) {
  return baseOf(i).workers;
}

function isWorker(i, e) {
  return !!i?.base?.workers?.some(w => w.uid === e);
}

/** The garden's yield and the forge's speed, with their workers. */
function workBoost(i, job) {
  let n = (i?.base?.workers || []).filter(w => w.job === job).length;
  return job === "garden" ? 1 + WORK.gardenBoost * n : job === "forge" ? 1 + WORK.forgeBoost * n : 1;
}

function workerYield(i, w, e = Date.now()) {
  let c = creatureOf(i, w.uid);
  if (!c) return { hours: 0, out: {} };
  let h = Math.min(WORK.capHours, Math.max(0, (e - (w.since ?? e)) / HOUR_MS)),
    rate = workRate(w.job, c, SPECIES[c.species]?.types || []),
    out = {};
  for (let [k, v] of Object.entries(rate)) out[k] = v * h + (w.carry?.[k] || 0);
  return { hours: h, out, rate };
}

/** What a worker made goes into `got`; it starts over from `e`. */
function settleWorker(i, w, e, got) {
  let { out } = workerYield(i, w, e);
  w.carry = {};
  for (let [k, v] of Object.entries(out)) {
    let n = Math.floor(v + 1e-9);
    n > 0 && (got[k] = (got[k] || 0) + n);
    let r = v - n;
    r > 1e-3 && (w.carry[k] = Math.round(r * 1e3) / 1e3);
  }
  w.since = e;
}

function payWork(i, got) {
  for (let [k, n] of Object.entries(got)) k === "gold" ? earn(i, n, "farm") : giveItem(i, k, n);
  return got;
}

function assignWorker(i, e, job, t = Date.now()) {
  let b = baseOf(i),
    c = creatureOf(i, e);
  if (!c) return { ok: !1, reason: "no_creature" };
  if (!(i.box || []).includes(e)) return { ok: !1, reason: "not_in_box" };
  job = JOBS[job] ? job : bestJob(SPECIES[c.species]?.types || []);
  let w = b.workers.find(x => x.uid === e);
  if (w) {
    // a new job: what it did at the old one is paid first
    let got = {};
    return settleWorker(i, w, t, got), w.job = job, w.carry = {}, { ok: !0, worker: w, got: payWork(i, got) };
  }
  if (b.workers.length >= workerSlots(b.buildings)) return { ok: !1, reason: "no_work_slot" };
  w = { uid: e, job, since: t, carry: {} };
  return b.workers.push(w), { ok: !0, worker: w, got: {} };
}

function unassignWorker(i, e, t = Date.now()) {
  let b = baseOf(i),
    n = b.workers.findIndex(x => x.uid === e);
  if (n < 0) return { ok: !1, reason: "not_working" };
  let got = {};
  return settleWorker(i, b.workers[n], t, got), b.workers.splice(n, 1), { ok: !0, got: payWork(i, got) };
}

function collectWork(i, e = Date.now()) {
  let got = {};
  for (let w of baseOf(i).workers) settleWorker(i, w, e, got);
  return { ok: !0, got: payWork(i, got) };
}

function workView(i, e = Date.now()) {
  let b = baseOf(i);
  return {
    slots: workerSlots(b.buildings),
    capHours: WORK.capHours,
    garden: workBoost(i, "garden"),
    forge: workBoost(i, "forge"),
    workers: b.workers.map(w => {
      let c = creatureOf(i, w.uid),
        y = workerYield(i, w, e),
        ready = {};
      for (let [k, v] of Object.entries(y.out)) {
        let n = Math.floor(v + 1e-9);
        n > 0 && (ready[k] = n);
      }
      return {
        uid: w.uid,
        job: w.job,
        species: c?.species,
        level: c?.level,
        star: c?.star || 1,
        shiny: !!c?.shiny,
        name: c?.nickname || null,
        hours: Math.round(y.hours * 10) / 10,
        full: y.hours >= WORK.capHours,
        perHour: Object.fromEntries(Object.entries(y.rate || {}).map(([k, v]) => [k, Math.round(v * 10) / 10])),
        ready
      };
    })
  };
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
        fromStar: a?.star || 1,
        shiny: !!a?.shiny,
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
      perHour: Math.round((buildingEffect(i, "garden")?.perHour || 0) * workBoost(i, "garden") * 10) / 10
    },
    work: workView(i, e),
    recipes: {
      refinery: recipesAt(i, "refinery"),
      workshop: recipesAt(i, "workshop")
    },
    collected: t
  };
}

/** A trainer chooses the four moves a creature fights with (from its card).
 *  An empty list hands the choice back to the creature: its newest four. */
function setMoves(doc, uid, skills) {
  let c = creatureOf(doc, uid);
  if (!c) return { ok: !1, reason: "no_creature" };
  if (!Array.isArray(skills) || skills.length > 4) return { ok: !1, reason: "bad_moves" };
  let known = learnedMoves(c.species, c.level),
    pick = [...new Set(skills.filter(m => typeof m == "string"))];
  if (pick.length !== skills.length || pick.some(m => !known.includes(m))) return { ok: !1, reason: "bad_moves" };
  pick.length ? c.picked = pick : delete c.picked;
  c.skills = skillsFor(c.species, c.level, c.picked);
  return { ok: !0, skills: c.skills };
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
    // how far into this level, and the next move it will learn (ui.panelCard)
    xp: t.xp || 0,
    nextMove: (SPECIES[t.species]?.learn || []).filter(([lv]) => lv > t.level).sort((a, b) => a[0] - b[0]).map(([lv, sk]) => ({ level: lv, skill: sk }))[0] || null,
    star: t.star || 1,
    iv: t.iv,
    hp: t.hp,
    maxHp: t.maxHp,
    skills: t.skills,
    // every move it knows, for choosing its four (setMoves)
    learned: learnedMoves(t.species, t.level),
    picked: Array.isArray(t.picked) && t.picked.length > 0,
    types: n?.types || [],
    stats: statsFor(t.species, t.level, t.iv, t.star || 1, t.nature),
    nature: t.nature || null,
    ability: t.ability || null,
    shiny: !!t.shiny,
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
function swapToUid(sim, you, uid, recruit = null) {
  if (!sim || !you) return { ok: false, reason: "no_battle" };
  if (typeof uid !== "string" || !uid) return { ok: false, reason: "no_target" };
  const mine = ownerKey(you);
  for (const c of sim.combatants.values()) {
    if (c.side !== you.side || c.kind === "trainer") continue;
    if (ownerKey(c) !== mine) continue;
    // a creature called in from the box mid-fight is known to the client by
    // its combatant id until the next profile, so either will do
    if (c.creature?.uid !== uid && c.id !== uid) continue;
    return sim.switchTo(c.id);
  }
  // Not in the fight: one from the box, called in (recruitFromBox).
  const c = recruit?.(uid);
  if (!c) return { ok: false, reason: "no_target" };
  const r = sim.switchTo(c.id);
  // it could not come out after all (a capture in the air, a forced switch):
  // it waits on the bench with the others, ready for the next try
  return r;
}

/**
 * Any creature of yours can fight, not only the six in the team: one from
 * the box is added to your side of the fight on the bench, then switched in
 * like any other. Not one at the farm (training or at work) or one that is
 * down, and never in a duel (that fights with copies of the team).
 * Its HP and XP are written back by uid like the team's (settleHp,
 * fieldCreature).
 */
function recruitFromBox(sim, doc, you, uid, { roster = null, gearBonus = null, guildBonus = null } = {}) {
  if (!sim || !doc || !you || typeof uid !== "string") return null;
  const cr = Object.prototype.hasOwnProperty.call(doc.creatures || {}, uid) ? doc.creatures[uid] : null;
  if (!cr || !SPECIES[cr.species] || !(cr.hp > 0)) return null;
  if (!(doc.box || []).includes(uid) || atFarm(doc, uid) || isWorker(doc, uid)) return null;
  for (const c of sim.combatants.values()) if (c.creature?.uid === uid) return null;
  const c = sim.add(new Combatant({
    side: you.side, kind: "creature", name: SPECIES[cr.species]?.name || cr.species,
    creature: cr, ownerId: you.ownerId || doc.id, ownerSession: you.ownerSession || null,
    slot: 5, benched: true, gearBonus: gearBonus || sumStats(doc), guildBonus,
  }));
  roster?.push({ id: c.id, uid });
  return c;
}

export { teamXp, WEATHER_BOOST, familyOwned, mergeDuplicates, setMoves, settleHp, takeIn, fieldCreature, inherit, assignWorker, unassignWorker, collectWork, workersOf, isWorker, workBoost, workView, atFarm, returnFromFarm, acceptQuest, activateZoneQuests, swapToUid, recruitFromBox, dexRow, dexRecord, duplicateReward, dexView, Combat, Combatant, DAY_MS, HOUR_MS, RALLY_ATK_BONUS, RALLY_DURATION_MS, SAVE_KEY, SWITCH_COOLDOWN_MS, TICK_MS, WILD_COUNT, activeCreature, addCreature, baseOf, baseView, buildingEffect, buildingLevel, buildingNext, canAfford, cancelTraining, claimQuest, collectCrafts, collectGarden, collectTraining, combatantId, combatantSeq, craftsAt, createPlayerDoc, creatureCard, creatureOf, creaturePower, creatureScore, dayStamp, emptyBase, ensureQuests, equipGear, freeTrainingSlots, gardenYield, giveItem, grantItems, grantXp, grantXpTo, healTeam, loadSave, makeCreature, normalizeDoc, num, ownerKey, payCost, publicProfile, recipesAt, startCraft, startTraining, statsOf, sumStats, syncQuests, takeItem, teamCreatures, trainerMaxHp, uid, upgradeBuilding, upgradeCostOf, writeSave };
