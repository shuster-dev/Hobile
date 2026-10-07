import { Combat, Combatant, settleHp, fieldCreature, inherit, acceptQuest, activateZoneQuests, swapToUid, teamCreatures, dexRecord, duplicateReward, dexView, DAY_MS, SAVE_KEY, TICK_MS, WILD_COUNT, activeCreature, addCreature, baseView, cancelTraining, claimQuest, collectGarden, collectTraining, createPlayerDoc, creatureCard, creaturePower, creatureScore, equipGear, giveItem, grantItems, grantXp, grantXpTo, healTeam, loadSave, makeCreature, normalizeDoc, publicProfile, startCraft, startTraining, sumStats, syncQuests, takeItem, uid, upgradeBuilding, writeSave } from './combat.js';
import { DROPS, DUNGEONS, GUILD, HOME_ZONE, ITEMS, MOVES, PROGRESSION, SPECIES, WILD_TIERS, WORLD_BOSSES, ZONES, randomLevel, statsFor, weightedPick } from '../../shared/gamedata.js';
import { NPCS, npcAt, npcLines } from '../../shared/npcs.js';
import { hpRatio, guildBuffs } from './player.js';
import { engageWild, handleWorldMessage, restoreRide, speakTo, visitCheck } from './world-messages.js';
import { propsFor, resolveCollision } from '../../shared/props.js';
import { fieldPoint, wildTarget } from '../../shared/worldplan.js';
import { populate, tickWilds } from './wilds.js';
import { FIELD, fieldHint, keepSpot, savedSpot, tickField } from './field.js';
import { weatherAt } from '../../shared/weather.js';
import { earn, spend } from './economy.js';
import { PartyDungeon } from './party-dungeon.js';
import { eventMul } from '../../shared/events.js';
import { storyWin } from './saga.js';
import { huntMaterial } from './saddles.js';
import { wardrobeOf } from '../../shared/cosmetics.js';

var StoreBase = class {
    constructor() {
      this.handlers = new Map();
    }
    on(e, t) {
      return this.handlers.has(e) || this.handlers.set(e, new Set()), this.handlers.get(e).add(t), () => this.handlers.get(e)?.delete(t);
    }
    emit(e, t) {
      for (let n of this.handlers.get(e) || []) try {
        n(t);
      } catch (s) {
        console.error("[offline]", e, s);
      }
      for (let n of this.handlers.get("*") || []) try {
        n(e, t);
      } catch {}
    }
  },
  LocalStore = class extends StoreBase {
    constructor() {
      super(), this.token = "offline", this.offline = !0, this.doc = loadSave(), this.room = null, this.pendingRooms = new Map(), this.guilds = [];
    }
    hasSession() {
      return !0;
    }
    logout() {
      try {
        localStorage.removeItem(SAVE_KEY);
      } catch {}
      this.doc = null;
    }
    async me() {
      // `local` tells the UI there is no account to claim here: the offline
      // build has no server to hold one, and its save lives in this browser.
      return this.doc ? (normalizeDoc(this.doc), {
        hasCharacter: !0,
        local: !0,
        profile: publicProfile(this.doc)
      }) : {
        hasCharacter: !1,
        local: !0
      };
    }
    async claim() {
      throw Object.assign(new Error("offline"), {
        code: "offline"
      });
    }
    async guest() {
      return {
        token: "offline",
        hasCharacter: !!this.doc
      };
    }
    async register() {
      return this.guest();
    }
    async login() {
      return this.guest();
    }
    async createCharacter({
      name: e,
      starter: t,
      appearance: n
    }) {
      return this.doc = createPlayerDoc("demo-player", (e || "Trainer").slice(0, 16), n || {}, t || "sproutle"), normalizeDoc(this.doc), writeSave(this.doc), {
        profile: publicProfile(this.doc)
      };
    }
    async leaderboard() {
      return this.doc ? [{
        rank: 1,
        id: this.doc.id,
        name: this.doc.name,
        level: this.doc.level,
        gold: this.doc.gold,
        stats: this.doc.stats,
        online: !0
      }] : [];
    }
    async guilds() {
      return this.guilds;
    }
    async joinWorld(e = HOME_ZONE, from = null) {
      await this.leaveRoom();
      let t = new WorldSim(this, e, from);
      return this.room = t, t.start(), t;
    }
    async joinRoomById(e) {
      await this.leaveRoom();
      let t = this.pendingRooms.get(e);
      if (!t) throw new Error("room_gone");
      return this.pendingRooms.delete(e), this.room = t, t.start(), t;
    }
    async leaveRoom() {
      let e = this.room;
      this.room = null, e?.stop();
    }
    send(e, t) {
      this.room?.handle(e, t);
    }
    save() {
      this.doc && writeSave(this.doc);
    }
  },
  WorldSim = class {
    constructor(e, t, from = null) {
      this.net = e, this.fromZone = from, this.zoneId = ZONES[t] ? t : HOME_ZONE, this.zone = ZONES[this.zoneId], this.roomId = "local-world", this.sessionId = "me", this.state = {
        zone: this.zoneId,
        serverTime: Date.now(),
        players: new Map(),
        wilds: new Map(),
        boss: {
          active: !1,
          species: "",
          level: 0,
          x: 0,
          z: 0,
          hp: 0,
          maxHp: 0,
          endsAt: 0,
          nextSpawnAt: 0,
          top: []
        }
      }, this.wildDocs = new Map(), this.colliders = propsFor(this.zone).colliders, this.bossDef = WORLD_BOSSES.find(n => n.zone === this.zoneId) || WORLD_BOSSES[0], this.bossContribution = new Map();
      // The same field rules the online room runs (server/game/field.js),
      // with this simulation as the one player's context.
      // the wilds: who comes out where, in what numbers (game/wilds.js)
      this.wilds = {
        zone: this.zone,
        colliders: this.colliders,
        state: this.state,
        wildDocs: this.wildDocs,
        target: wildTarget(this.zone, WILD_COUNT),
        spawn: (species, level, at) => this.spawnWild(species, level, at)
      };
      this.field = {
        zone: this.zone,
        colliders: this.colliders,
        state: this.state,
        wildDocs: this.wildDocs,
        players: () => {
          let me = this.field.player("me");
          return me ? [me] : [];
        },
        player: key => {
          let p = key === "me" && this.self();
          return p ? { key: "me", p, doc: this.doc, ctx: this } : null;
        },
        engage: (entry, wildId) => engageWild(this, wildId, { ambush: !0 })
      };
    }
    get doc() {
      return this.net.doc;
    }
    start() {
      let e = this.doc,
        // Back from a fight or a dungeon: where you were. From another zone:
        // its camp. (Every arrival used to be the camp.)
        t = savedSpot(e, this.zoneId, this.zone, this.colliders, this.fromZone) || this.spawnPoint();
      keepSpot(e, this.zoneId, t), this.calmUntil = Math.max(e.calmUntil || 0, Date.now() + FIELD.joinCalmMs), this.lastStepAt = 0;
      activateZoneQuests(e, this.zoneId);
      this.state.players.set("me", {
        id: e.id,
        name: e.name,
        level: e.level,
        x: t.x,
        y: 0,
        z: t.z,
        rot: 0,
        moving: !1,
        status: "idle",
        guildTag: e.guildId && this.net.guilds.find(n => n.id === e.guildId)?.tag || "",
        partyId: this.party ? this.party.id : "",
        petSpecies: activeCreature(e)?.species || "",
        petStar: activeCreature(e)?.star || 1,
        hpRatio: hpRatio(e),
        body: e.appearance.body,
        skin: e.appearance.skin,
        hair: e.appearance.hair,
        outfit: e.appearance.outfit,
        kind: e.appearance.kind,
        look: e.appearance.look,
        hat: wardrobeOf(e).hat || "",
        dye: wardrobeOf(e).dye || "",
        mount: "",
        mountKind: "",
        mountStar: 1
      });
      // back on whatever was carrying them (shared/riding.js)
      restoreRide(this, this.state.players.get("me"), e);
      populate(this.wilds);
      this.scheduleBoss(), this.timer = setInterval(() => this.tick(), TICK_MS), setTimeout(() => this.welcome(), 60);
    }
    stop() {
      clearInterval(this.timer);
    }
    welcome() {
      let e = this.doc;
      // welcome() is called both by start() and by the client's "ready", and
      // "refresh" calls it again. Everything here is idempotent except the chat
      // line, which was arriving three and four times over.
      let firstTime = !this._welcomed;
      this._welcomed = !0;
      e.zone = this.zoneId, this.net.emit("profile", publicProfile(e)), this.net.emit("zone", {
        id: this.zoneId,
        name: this.zone.name,
        he: this.zone.he,
        ground: this.zone.ground,
        accent: this.zone.accent,
        sky: this.zone.sky,
        size: this.zone.size,
        landmarks: this.zone.landmarks,
        levels: this.zone.levels
      }), this.net.emit("guild", this.guildView()), this.net.emit("party", this.partyView()), this.net.emit("friends", this.friendList()), firstTime && this.net.emit("chat", {
        ch: "system",
        t: Date.now(),
        text: `${this.zone.he} · מצב אימון לשחקן יחיד — אין כאן שחקנים אחרים. בגרסה המלאה עם שרת, כל מי שסביבך הוא שחקן אמיתי.`
      });
      let hint = fieldHint(e, this.zone);
      hint && (this.net.emit("chat", { ch: "system", t: Date.now(), text: hint }), this.net.save());
    }
    spawnPoint() {
      let e = this.zone.landmarks.find(t => t.kind === "town" || t.kind === "camp") || {
        x: 0,
        z: 0,
        r: 8
      };
      for (let t = 0; t < 12; t++) {
        let n = Math.random() * Math.PI * 2,
          s = (e.r || 8) * (0.15 + Math.random() * 0.32),
          r = resolveCollision(this.colliders, e.x + Math.cos(n) * s, e.z + Math.sin(n) * s, 0.72);
        if (Math.hypot(r.x - e.x, r.z - e.z) < (e.r || 8)) return r;
      }
      return {
        x: e.x,
        z: e.z
      };
    }
    randomFieldPoint() {
      // a planned zone knows its own ground (worldplan.js); the town does not
      let planned = !this.zone.urban && fieldPoint(this.zone, this.colliders);
      if (planned) return planned;
      let e = this.zone.size / 2 - 8;
      for (let t = 0; t < 24; t++) {
        let n = (Math.random() * 2 - 1) * e,
          s = (Math.random() * 2 - 1) * e;
        // `r.r` is undefined on a box collider and NaN loses every comparison,
        // so buildings and benches were invisible here — same hole as the one
        // in WorldRoom.randomFieldPoint, and the two have to agree.
        if (!this.zone.landmarks.some(r => r.r && Math.hypot(r.x - n, r.z - s) < r.r + 4) && !this.colliders.some(r => Math.hypot(r.x - n, r.z - s) < (r.r ?? Math.max(r.hw, r.hd)) + 1.2)) return {
          x: n,
          z: s
        };
      }
      return {
        x: e * 0.6,
        z: e * 0.6
      };
    }
    spawnWild(species, level, at) {
      let e = "w" + uid().slice(0, 8),
        t = species || weightedPick(this.zone.spawns),
        n = level || randomLevel(this.zoneId),
        {
          x: s,
          z: r
        } = at || this.randomFieldPoint();
      this.state.wilds.set(e, {
        id: e,
        species: t,
        level: n,
        x: s,
        z: r,
        rot: Math.random() * 6.28,
        engagedBy: "",
        alert: "",
        target: ""
      }), this.wildDocs.set(e, {
        species: t,
        level: n,
        target: {
          x: s,
          z: r
        },
        next: 0,
        mode: "",
        restUntil: 0
      });
      return e;
    }
    scheduleBoss() {
      this.state.boss.nextSpawnAt = Date.now() + 75e3, this.state.boss.species = this.bossDef.species, this.state.boss.level = this.bossDef.level, this.state.boss.x = this.bossDef.x, this.state.boss.z = this.bossDef.z;
    }
    tick() {
      let e = Date.now(),
        t = TICK_MS;
      this.state.serverTime = e;
      // the wilds come out, amble, keep their hours (game/wilds.js); a wild
      // with a mood is moved by the field instead
      tickWilds(this.wilds, e, t);
      tickField(this.field, e, t), this.tickBoss(e);
    }
    tickBoss(e) {
      let t = this.state.boss;
      if (!t.active && t.nextSpawnAt && e >= t.nextSpawnAt) {
        let n = statsFor(this.bossDef.species, this.bossDef.level, 0.6);
        t.active = !0, t.hp = n.hp * 10, t.maxHp = t.hp, t.endsAt = e + 5 * 6e4, t.top = [], this.bossContribution = new Map(), this.net.emit("bossSpawn", {
          species: t.species,
          level: t.level,
          x: t.x,
          z: t.z,
          name: SPECIES[t.species].name,
          he: SPECIES[t.species].he,
          endsAt: t.endsAt
        });
      }
      t.active && (e >= t.endsAt || t.hp <= 0) && this.endBoss(t.hp <= 0);
    }
    refreshBossBoard() {
      this.state.boss.top = [...this.bossContribution.entries()].sort((e, t) => t[1] - e[1]).slice(0, 5).map(([e, t]) => ({
        id: e,
        name: e,
        damage: t
      }));
    }
    endBoss(e) {
      let t = this.state.boss;
      t.active = !1;
      let n = this.bossContribution.get(this.doc.name) || 0,
        s = [...this.bossContribution.entries()].sort((o, a) => a[1] - o[1]),
        r = Math.max(1, s.findIndex(([o]) => o === this.doc.name) + 1);
      if (n > 0) {
        let o = n / Math.max(1, t.maxHp),
          a = Math.floor((e ? 4e3 : 1200) * (0.25 + o)),
          l = Math.floor((e ? 2400 : 700) * (0.25 + o));
        earn(this.doc, a, "boss"), grantXp(this.doc, l), giveItem(this.doc, r === 1 ? "sphere_ultra" : "sphere_great", r === 1 ? 3 : 1), this.doc.stats.bossHits += 1, syncQuests(this.doc, {
          kind: "boss"
        }), this.net.save(), this.net.emit("bossReward", {
          rank: r,
          damage: n,
          gold: a,
          xp: l,
          defeated: e
        }), this.net.emit("profile", publicProfile(this.doc));
      }
      this.net.emit("bossEnd", {
        defeated: e,
        leaderboard: s.slice(0, 10)
      }), this.state.boss.nextSpawnAt = Date.now() + 9e4;
    }
    guildView() {
      let e = this.doc;
      if (!e.guildId) return null;
      let t = this.net.guilds.find(n => n.id === e.guildId);
      return t ? {
        ...t,
        masterId: t.masterId || "npc",
        bonuses: guildBuffs(t),
        members: [{
          id: e.id,
          name: e.name,
          level: e.level,
          rank: "master",
          contribution: t.myContribution || 0,
          online: !0
        }],
        log: t.log || []
      } : null;
    }
    partyView() {
      return null;
    }
    friendList() {
      return {
        friends: [],
        pending: []
      };
    }
    dayPhase() {
      return (Date.now() % DAY_MS / DAY_MS + 1) % 1;
    }
    speak(e, t) {
      speakTo(this, e, t, this.dayPhase());
    }
    checkVisits(e, t) {
      visitCheck(this, e, t, this._visited || (this._visited = new Set()));
    }
    handle(e, t = {}) {
      return handleWorldMessage(this, e, t);
    }
    // --- the context handleWorldMessage runs against -------------------------
    self() {
      return this.state.players.get(this.sessionId);
    }
    chat(msg) {
      this.net.emit("chat", msg);
    }
    startBattle(opts) {
      let sim = new BattleSim(this.net, opts);
      this.net.pendingRooms.set(sim.roomId, sim);
      this.net.emit("goto", { roomId: sim.roomId, kind: "battle", wildId: opts.wildId, ambush: !!opts.ambush });
      return sim.roomId;
    }
    startDungeon(opts) {
      let sim = new DungeonSim(this.net, opts);
      this.net.pendingRooms.set(sim.roomId, sim);
      this.net.emit("goto", { roomId: sim.roomId, kind: "dungeon" });
      return sim.roomId;
    }
  },
  BattleSim = class {
    constructor(e, {
      zoneId: t,
      wild: n,
      onEnd: s
    }) {
      this.net = e, this.zoneId = t, this.onEnd = s || (() => {}), this.roomId = "battle-" + uid().slice(0, 6), this.sessionId = "me", this.state = {
        mode: "pve",
        phase: "waiting",
        finished: !1,
        outcome: "",
        combatants: new Map()
      },
      // The sky at the moment the fight starts, held for its duration. Same
      // function the client draws from, so the rain the player can see is the
      // rain that is buffing the water move.
      this.weather = weatherAt(ZONES[this.zoneId], Date.now()), this.sim = new Combat({
        mode: "pve",
        weather: this.weather,
        onEvent: a => this.onSimEvent(a)
      });
      let r = e.doc;
      // docs/battle-v2.md: the TEAM fights and the trainer stands behind it.
      // Only the one active creature used to be added, so there was never a
      // bench to switch to and never a trainer for `enemiesOf` to expose once
      // the team went down — both headline features of v0.7 were inert.
      let gear = sumStats(r),
        team = teamCreatures(r),
        lead = team.find(c => c.hp > 0) || team[0] || null;
      this.roster = [];
      team.forEach((creature, i) => {
        let c = this.sim.add(new Combatant({
          side: "a",
          kind: "creature",
          name: SPECIES[creature.species]?.name || creature.species,
          creature,
          ownerId: r.id,
          slot: i,
          benched: creature !== lead,
          gearBonus: gear
        }));
        this.roster.push({ id: c.id, uid: creature.uid });
      });
      this.anchor = this.sim.combatants.get(this.roster.find(x => x.uid === lead?.uid)?.id) || null;
      this.trainer = this.sim.add(new Combatant({
        side: "a",
        kind: "trainer",
        name: r.name,
        ownerId: r.id,
        level: r.level,
        benched: !!this.anchor,
        gearBonus: gear
      }));
      // How hard it fights depends on where it lives (WILD_TIERS). A story
      // foe (shared/saga.js) is a boss of its level: no sphere takes it.
      let tier = WILD_TIERS[t] || {};
      this.story = n.story || null;
      this.foe = this.sim.add(new Combatant(this.story ? {
        side: "b",
        kind: "boss",
        name: SPECIES[n.species].name,
        creature: makeCreature(n.species, n.level),
        hpScale: n.hpScale,
        scale: n.scale
      } : {
        side: "b",
        kind: "wild",
        name: SPECIES[n.species].name,
        creature: makeCreature(n.species, n.level, { shinyMul: eventMul("shiny") }),
        scale: tier.scale,
        ai: tier.ai
      }));
    }
    /**
     * The combatant the player is currently controlling.
     *
     * This used to be captured once at construction. After a switch the cached
     * reference pointed at the creature that had just left the field, so every
     * skill button acted on it — the "resolved - timed out" class of bug.
     */
    get you() {
      return (this.anchor && this.sim.activeOf(this.anchor)) || this.anchor || this.trainer;
    }
    /**
     * One payload, two senders. `start()` sent the full thing and the "ready"
     * handler sent a shorter one missing `team`, `trainer` and `weather` — and
     * the client assigns all three unconditionally, so the second init wiped
     * the bench out of the switch UI and the weather out of the banner. It is
     * the same drift that made battle-v2 inert in v0.9, so the two senders now
     * cannot disagree.
     */
    initPayload() {
      return {
        mode: "pve",
        you: this.you.id,
        team: this.roster,
        trainer: this.trainer?.id || null,
        weather: this.weather && {
          id: this.weather.id,
          he: this.weather.he,
          boost: this.weather.boost
        },
        inventory: this.net.doc.inventory,
        profile: publicProfile(this.net.doc)
      };
    }
    start() {
      this.sync(), setTimeout(() => {
        this.net.emit("battleInit", this.initPayload()), this.state.phase = "active", this.net.emit("battleStart", {
          at: Date.now()
        });
      }, 80), this.timer = setInterval(() => {
        this.state.phase === "active" && (this.sim.update(100), this.sync());
      }, 100);
    }
    stop() {
      // A fight that is torn down without resolving still has to let go of the
      // creature it locked. `engage` sets `engagedBy` and only `onEnd` clears
      // it, so a player who walked away mid-battle left a wild frozen in place
      // and un-engageable for the life of the zone.
      clearInterval(this.timer), this.finish(!1);
    }
    /** Called exactly once, whatever ends the battle. */
    finish(e) {
      // Whatever ended it, the field leaves you alone for a while after.
      this._ended || (this._ended = !0, this.net.doc && (this.net.doc.calmUntil = Date.now() + FIELD.battleCalmMs), this.onEnd(e));
    }
    sync() {
      syncBattleState(this.state, this.sim);
    }
    onSimEvent(e) {
      this.net.emit("battleEvent", e), e.kind === "end" && this.resolve(e);
    }
    resolve(e) {
      if (this.resolved) return;
      this.resolved = !0, this.state.phase = "over";
      let t = this.net.doc;
      settleHp(this.sim, this.you, t);
      let n = fieldCreature(t, this.you),
        s = e.outcome === "a",
        r = e.outcome === "captured",
        o = {
          outcome: e.outcome,
          won: s,
          xp: 0,
          gold: 0,
          items: [],
          events: [],
          questsDone: []
        };
      if (s || r) {
        // the season pays its share (shared/events.js)
        let a = Math.round(creaturePower(this.foe, t.level) * eventMul("xp")),
          l = Math.round(creatureScore(this.foe) * eventMul("gold"));
        if (earn(t, l, r ? "capture" : "battle"), o.xp = a, o.gold = l, n && o.events.push(...grantXpTo(n, a, t)), o.events.push(...grantXp(t, Math.floor(a * 0.6))), s) {
          let foeSp = [...this.sim.combatants.values()].find(d => d.side === "b")?.creature?.species;
          t.stats.battlesWon += 1, o.questsDone = syncQuests(t, {
            kind: "defeat",
            zone: this.zoneId,
            species: foeSp,
            elements: SPECIES[foeSp]?.types || []
          });
          // an anchor broken, or the rift's guardian down (server/game/saga.js)
          this.story && (o.story = this.story, o.questsDone.push(...storyWin(t, this.story)));
          let c = [...this.sim.combatants.values()].find(d => d.side === "b"),
            h = SPECIES[c?.creature?.species]?.types?.[0] || "metal";
          for (let d of grantItems(t, DROPS.roll(h, t.level, "wild"))) o.items.push(d.id);
          Math.random() < 0.2 && (giveItem(t, "potion_s", 1), o.items.push("potion_s"));
          // a piece toward a saddle for its family (game/saddles.js)
          o.mat = huntMaterial(t, foeSp);
        }
        if (r && this.pendingCapture) {
          let c = makeCreature(this.pendingCapture.species, this.pendingCapture.level, this.pendingCapture.traits);
          addCreature(t, c), t.stats.captures += 1, o.captured = c, o.mat = huntMaterial(t, c.species);
          // The first of a species opens its card; the rest refine into the
          // materials a star upgrade costs.
          let dex = dexRecord(t, c.species, c);
          o.newSpecies = dex.isNew;
          o.dexCount = dex.caught;
          o.card = creatureCard(t, c.uid);
          if (!dex.isNew) o.duplicate = duplicateReward(t, c.species);
          o.questsDone.push(...syncQuests(t, {
            kind: "capture",
            zone: this.zoneId,
            species: c.species,
            elements: SPECIES[c.species]?.types || []
          }));
        }
      } else if (e.outcome !== "fled") {
        t.stats.deaths += 1;
        let a = Math.floor(t.gold * 0.02);
        // A blackout is the one fight you do not walk away from where it was:
        // you wake at the camp, as the genre always has.
        o.gold = -spend(t, a, "blackout"), o.blackout = !0, healTeam(t, 1), t.pos = null;
      }
      this.net.save(), o.profile = publicProfile(t), this.finish(s || r), this.net.emit("battleEnd", o);
    }
    handle(e, t = {}) {
      if (e === "ready") {
        this.net.emit("battleInit", this.initPayload());
        return;
      }
      if (this.state.phase !== "active") return;
      let n = this.net.doc;
      if (e === "swap") {
        // Manual switching: the client sends a creature uid, Combat wants a
        // combatant id. Without this the UI's swap button did nothing at all —
        // switches only ever happened automatically, on a faint.
        let s = swapToUid(this.sim, this.you, t.uid);
        s.ok || this.net.emit("actionRejected", {
          reason: s.reason,
          uid: t.uid,
          wait: s.wait
        }), this.sync();
        return;
      }
      if (e === "skill") {
        let s = this.sim.useSkill(this.you.id, t.skill, this.foe.id);
        s.ok || this.net.emit("actionRejected", {
          reason: s.reason,
          skill: t.skill,
          wait: s.wait
        }), this.sync();
      } else if (e === "trainer") {
        if (t.action === "sphere") {
          // The home dock has said `capturable: false` since the zone data was
          // written and nothing read it: the capture path checks the mode, the
          // target kind and the boss flag, and never the zone. A dungeon
          // refuses a sphere outright; the starter town, which exists to be a
          // tutorial rather than a hunting ground, did not. Refuse before
          // taking the sphere, not after giving it back.
          if (ZONES[this.zoneId]?.capturable === !1) {
            this.net.emit("actionRejected", {
              reason: "no_capture_here"
            });
            return;
          }
          let s = ITEMS[t.sphere] ? t.sphere : "sphere_basic";
          if (!takeItem(n, s, 1)) {
            this.net.emit("actionRejected", {
              reason: "no_sphere"
            });
            return;
          }
          let r = this.sim.trainerAction(this.you.id, "sphere", {
            sphere: s
          });
          r.ok ? this.pendingCapture = {
            species: this.foe.species,
            level: this.foe.level,
            traits: inherit(this.foe.creature)
          } : (giveItem(n, s, 1), this.net.emit("actionRejected", {
            reason: r.reason
          })), this.net.emit("inventory", n.inventory);
        } else if (t.action === "potion") {
          let s = ITEMS[t.item]?.kind === "heal" ? t.item : "potion_s";
          if (!takeItem(n, s, 1)) {
            this.net.emit("actionRejected", {
              reason: "no_item"
            });
            return;
          }
          this.you.hp = Math.min(this.you.maxHp, this.you.hp + ITEMS[s].amount), this.sim.emit({
            kind: "heal",
            target: this.you.id,
            amount: ITEMS[s].amount,
            hp: this.you.hp,
            source: "item"
          }), this.net.emit("inventory", n.inventory);
        } else {
          let s = this.sim.trainerAction(this.you.id, t.action);
          s.ok || this.net.emit("actionRejected", {
            reason: s.reason
          });
        }
        this.sync();
      }
    }
  },
  // The single-player dungeon: the same run the online room drives
  // (game/party-dungeon.js), with one player in it.
  DungeonSim = class {
    constructor(e, {
      def: t,
      tier: tr = "normal"
    }) {
      this.net = e, this.def = t, this.roomId = "dungeon-" + uid().slice(0, 6), this.sessionId = "me", this.state = {
        mode: "dungeon",
        phase: "waiting",
        finished: !1,
        outcome: "",
        dungeonId: t.id,
        floor: 0,
        floors: t.floors || 0,
        combatants: new Map()
      };
      this.run = new PartyDungeon({
        def: t,
        tier: tr,
        broadcast: (n, s) => this.net.emit(n, s),
        onEnd: () => this.net.save()
      });
      this.run.onSync = () => {
        this.state.phase = this.run.phase, this.state.floor = this.run.floor, syncBattleState(this.state, this.run.sim);
      };
      let s = e.doc;
      this.run.addPlayer(s, (n, r) => this.net.emit(n, r)), this.sim = this.run.sim;
    }
    get you() {
      let p = this.run.parts.get(this.net.doc.id);
      return p ? this.run.you(p) : null;
    }
    start() {
      this.run.start();
    }
    stop() {
      this.run.stop();
    }
    sync() {
      this.run.sync();
    }
    handle(e, t = {}) {
      this.run.handle(this.net.doc.id, e, t);
    }
  };

function syncBattleState(i, e) {
  let t = new Set();
  for (let n of e.combatants.values()) t.add(n.id), i.combatants.set(n.id, {
    id: n.id,
    side: n.side,
    kind: n.kind === "ally" ? "player" : n.kind,
    name: n.name,
    species: n.species,
    level: n.level,
    hp: Math.max(0, Math.round(n.hp)),
    maxHp: n.maxHp,
    stamina: Math.round(n.stamina),
    ownerId: n.ownerId || "",
    star: n.star || 1,
    // The v0.7 team-battle fields. Combatant has carried these since the model
    // changed from "the player fights" to "the team fights", but they were
    // never copied into the synced state — so the client read benched=false and
    // slot=undefined for everyone, the bench was invisible, liveTeam's sort by
    // slot was meaningless, and a frozen combatant looked idle.
    benched: !!n.benched,
    slot: Number.isFinite(n.slot) ? n.slot : 0,
    frozenUntil: n.frozenUntil || 0,
    skills: n.skills.slice(),
    effects: n.effects.map(s => ({
      kind: s.kind,
      until: s.until
    }))
  });
  for (let n of [...i.combatants.keys()]) t.has(n) || i.combatants.delete(n);
}



export {BattleSim, DungeonSim, LocalStore, StoreBase, WorldSim, syncBattleState};
