import { Combat, Combatant, swapToUid, teamCreatures, dexRecord, duplicateReward, dexView, DAY_MS, SAVE_KEY, TICK_MS, WILD_COUNT, activeCreature, addCreature, baseView, cancelTraining, claimQuest, collectGarden, collectTraining, createPlayerDoc, creatureCard, creaturePower, creatureScore, equipGear, giveItem, grantItems, grantXp, grantXpTo, healTeam, loadSave, makeCreature, normalizeDoc, publicProfile, startCraft, startTraining, sumStats, syncQuests, takeItem, uid, upgradeBuilding, writeSave } from './combat.js';
import { DROPS, DUNGEONS, GUILD, HOME_ZONE, ITEMS, MOVES, PROGRESSION, SPECIES, WORLD_BOSSES, ZONES, randomLevel, statsFor, weightedPick } from '../../shared/gamedata.js';
import { NPCS, npcAt, npcLines } from '../../shared/npcs.js';
import { hpRatio, guildBuffs } from './player.js';
import { handleWorldMessage, speakTo, visitCheck } from './world-messages.js';
import { propsFor, resolveCollision } from '../../shared/props.js';
import { weatherAt } from '../../shared/weather.js';

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
    async joinWorld(e = HOME_ZONE) {
      await this.leaveRoom();
      let t = new WorldSim(this, e);
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
    constructor(e, t) {
      this.net = e, this.zoneId = ZONES[t] ? t : HOME_ZONE, this.zone = ZONES[this.zoneId], this.roomId = "local-world", this.sessionId = "me", this.state = {
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
    }
    get doc() {
      return this.net.doc;
    }
    start() {
      let e = this.doc,
        t = this.spawnPoint();
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
        hpRatio: hpRatio(e),
        body: e.appearance.body,
        skin: e.appearance.skin,
        hair: e.appearance.hair,
        outfit: e.appearance.outfit
      });
      for (let n = 0; n < WILD_COUNT; n++) this.spawnWild();
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
    spawnWild() {
      let e = "w" + uid().slice(0, 8),
        t = weightedPick(this.zone.spawns),
        n = randomLevel(this.zoneId),
        {
          x: s,
          z: r
        } = this.randomFieldPoint();
      this.state.wilds.set(e, {
        id: e,
        species: t,
        level: n,
        x: s,
        z: r,
        rot: Math.random() * 6.28,
        engagedBy: ""
      }), this.wildDocs.set(e, {
        species: t,
        level: n,
        target: {
          x: s,
          z: r
        },
        next: 0
      });
    }
    scheduleBoss() {
      this.state.boss.nextSpawnAt = Date.now() + 75e3, this.state.boss.species = this.bossDef.species, this.state.boss.level = this.bossDef.level, this.state.boss.x = this.bossDef.x, this.state.boss.z = this.bossDef.z;
    }
    tick() {
      let e = Date.now(),
        t = TICK_MS;
      this.state.serverTime = e;
      for (let [n, s] of this.state.wilds) {
        if (s.engagedBy) continue;
        let r = this.wildDocs.get(n);
        if (e > r.next) {
          let c = this.randomFieldPoint();
          r.target = {
            x: s.x + (c.x - s.x) * 0.12,
            z: s.z + (c.z - s.z) * 0.12
          }, r.next = e + 2500 + Math.random() * 4e3;
        }
        let o = r.target.x - s.x,
          a = r.target.z - s.z,
          l = Math.hypot(o, a);
        if (l > 0.2) {
          let c = 1.6 * t / 1e3;
          s.x += o / l * c, s.z += a / l * c, s.rot = Math.atan2(o, a);
        }
      }
      this.state.wilds.size < WILD_COUNT && this.spawnWild(), this.tickBoss(e);
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
        this.doc.gold += a, grantXp(this.doc, l), giveItem(this.doc, r === 1 ? "sphere_ultra" : "sphere_great", r === 1 ? 3 : 1), this.doc.stats.bossHits += 1, syncQuests(this.doc, {
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
      this.net.emit("goto", { roomId: sim.roomId, kind: "battle" });
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
      this.foe = this.sim.add(new Combatant({
        side: "b",
        kind: "wild",
        name: SPECIES[n.species].name,
        creature: makeCreature(n.species, n.level)
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
      this._ended || (this._ended = !0, this.onEnd(e));
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
      let t = this.net.doc,
        n = activeCreature(t),
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
      if (n && (n.hp = Math.max(0, Math.round(this.you.hp))), s || r) {
        let a = creaturePower(this.foe, t.level),
          l = creatureScore(this.foe);
        if (t.gold += l, o.xp = a, o.gold = l, n && o.events.push(...grantXpTo(n, a)), o.events.push(...grantXp(t, Math.floor(a * 0.6))), s) {
          t.stats.battlesWon += 1, o.questsDone = syncQuests(t, {
            kind: "defeat",
            zone: this.zoneId
          });
          let c = [...this.sim.combatants.values()].find(d => d.side === "b"),
            h = SPECIES[c?.creature?.species]?.types?.[0] || "metal";
          for (let d of grantItems(t, DROPS.roll(h, t.level, "wild"))) o.items.push(d.id);
          Math.random() < 0.2 && (giveItem(t, "potion_s", 1), o.items.push("potion_s"));
        }
        if (r && this.pendingCapture) {
          let c = makeCreature(this.pendingCapture.species, this.pendingCapture.level);
          addCreature(t, c), t.stats.captures += 1, o.captured = c;
          // The first of a species opens its card; the rest refine into the
          // materials a star upgrade costs.
          let dex = dexRecord(t, c.species, c);
          o.newSpecies = dex.isNew;
          o.dexCount = dex.caught;
          o.card = creatureCard(t, c.uid);
          if (!dex.isNew) o.duplicate = duplicateReward(t, c.species);
          o.questsDone.push(...syncQuests(t, {
            kind: "capture"
          }));
        }
      } else if (e.outcome !== "fled") {
        t.stats.deaths += 1;
        let a = Math.floor(t.gold * 0.02);
        t.gold = Math.max(0, t.gold - a), o.gold = -a, o.blackout = !0, healTeam(t, 1);
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
          uid: t.uid
        }), this.sync();
        return;
      }
      if (e === "skill") {
        let s = this.sim.useSkill(this.you.id, t.skill, this.foe.id);
        s.ok || this.net.emit("actionRejected", {
          reason: s.reason,
          skill: t.skill
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
            level: this.foe.level
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
  DungeonSim = class {
    constructor(e, {
      def: t,
      allies: n
    }) {
      this.net = e, this.def = t, this.allies = n || [], this.roomId = "dungeon-" + uid().slice(0, 6), this.sessionId = "me", this.floor = 0, this.totalXp = 0, this.totalGold = 0, this.state = {
        mode: "dungeon",
        phase: "waiting",
        finished: !1,
        outcome: "",
        dungeonId: t.id,
        floor: 0,
        floors: t.floors,
        combatants: new Map()
      }, this.sim = new Combat({
        mode: "dungeon",
        onEvent: r => this.onSimEvent(r)
      });
      let s = e.doc;
      this.you = this.sim.add(new Combatant({
        side: "a",
        kind: "player",
        name: s.name,
        creature: activeCreature(s),
        ownerId: s.id,
        gearBonus: sumStats(s)
      }));
      for (let r of this.allies) {
        let o = r.petSpecies || t.trash[0];
        this.sim.add(new Combatant({
          side: "a",
          kind: "ally",
          name: r.name,
          creature: makeCreature(o, Math.max(1, this.you.level))
        }));
      }
    }
    start() {
      this.sync(), setTimeout(() => {
        this.net.emit("dungeonInit", {
          dungeon: {
            id: this.def.id,
            name: this.def.name,
            he: this.def.he,
            floors: this.def.floors,
            element: this.def.element
          },
          you: this.you.id,
          inventory: this.net.doc.inventory,
          profile: publicProfile(this.net.doc)
        });
      }, 80), this.timer = setInterval(() => {
        this.state.phase === "active" && (this.sim.update(100), this.sync());
      }, 100), setTimeout(() => this.nextFloor(), 1600);
    }
    stop() {
      clearInterval(this.timer);
    }
    sync() {
      syncBattleState(this.state, this.sim);
    }
    partyLevel() {
      let e = [...this.sim.combatants.values()].filter(t => t.side === "a").map(t => t.level);
      return Math.max(1, Math.round(e.reduce((t, n) => t + n, 0) / Math.max(1, e.length)));
    }
    nextFloor() {
      if (this.finished) return;
      this.floor += 1, this.state.floor = this.floor;
      for (let s of [...this.sim.combatants.values()]) s.side === "b" && (this.sim.combatants.delete(s.id), this.state.combatants.delete(s.id));
      let e = this.floor >= this.def.floors,
        t = Math.max(this.def.minLevel, this.partyLevel() + (e ? 2 : 0)),
        n = e ? 1 : Math.min(3, 1 + Math.floor(this.floor / 2));
      for (let s = 0; s < n; s++) {
        let r = e ? this.def.boss : this.def.trash[Math.floor(Math.random() * this.def.trash.length)];
        this.sim.add(new Combatant({
          side: "b",
          kind: e ? "boss" : "wild",
          name: SPECIES[r].name,
          creature: makeCreature(r, t),
          hpScale: e ? 2.4 : 1
        }));
      }
      this.state.phase = "active", this.sim.finished = !1, this.sync(), this.net.emit("floor", {
        floor: this.floor,
        of: this.def.floors,
        boss: e
      });
    }
    onSimEvent(e) {
      if (this.net.emit("battleEvent", e), e.kind === "end") if (e.outcome === "a") {
        for (let t of this.sim.combatants.values()) t.side === "b" && (this.totalXp += creaturePower(t, this.partyLevel()), this.totalGold += creatureScore(t));
        for (let t of this.sim.combatants.values()) t.side !== "a" || !t.alive || (t.hp = Math.min(t.maxHp, t.hp + Math.floor(t.maxHp * 0.22)), t.stamina = PROGRESSION.staminaMax);
        this.state.phase = "waiting", this.sync(), this.floor >= this.def.floors ? this.complete(!0) : (this.net.emit("floorCleared", {
          floor: this.floor
        }), setTimeout(() => this.nextFloor(), 2200));
      } else this.state.phase = "over", this.complete(!1);
    }
    complete(e) {
      if (this.finished) return;
      this.finished = !0, this.state.phase = "over";
      let t = this.net.doc,
        n = activeCreature(t);
      n && (n.hp = Math.max(1, Math.round(this.you.hp))), e || healTeam(t, 1);
      let s = Math.floor(this.totalXp * (e ? 1 : 0.35)),
        r = Math.floor(this.totalGold * (e ? 1 : 0.35));
      t.gold += r;
      let o = [];
      n && o.push(...grantXpTo(n, s)), o.push(...grantXp(t, Math.floor(s * 0.7)));
      let a = [],
        l = [];
      if (e) {
        t.stats.dungeonsCleared += 1;
        let c = 1 + (Math.random() < 0.4 ? 1 : 0);
        for (let h = 0; h < c; h++) {
          let d = this.def.rewards.items[Math.floor(Math.random() * this.def.rewards.items.length)];
          giveItem(t, d, 1), a.push(d);
        }
        l = syncQuests(t, {
          kind: "dungeon",
          target: this.def.id
        });
      }
      this.net.save(), this.net.emit("dungeonEnd", {
        success: e,
        xp: s,
        gold: r,
        items: a,
        events: o,
        questsDone: l,
        floors: this.floor,
        of: this.def.floors,
        profile: publicProfile(t)
      });
    }
    handle(e, t = {}) {
      if (e === "ready") {
        this.net.emit("dungeonInit", {
          dungeon: {
            id: this.def.id,
            name: this.def.name,
            he: this.def.he,
            floors: this.def.floors,
            element: this.def.element
          },
          you: this.you.id,
          inventory: this.net.doc.inventory,
          profile: publicProfile(this.net.doc)
        });
        return;
      }
      if (this.state.phase === "active") {
        if (e === "swap") {
          let n = swapToUid(this.sim, this.you, t.uid);
          n.ok || this.net.emit("actionRejected", {
            reason: n.reason,
            uid: t.uid
          });
          this.sync();
          return;
        }
        if (e === "skill") {
          let n = this.sim.useSkill(this.you.id, t.skill);
          n.ok || this.net.emit("actionRejected", {
            reason: n.reason,
            skill: t.skill
          }), this.sync();
        } else if (e === "trainer") {
          if (t.action === "sphere") {
            this.net.emit("actionRejected", {
              reason: "no_capture_in_dungeon"
            });
            return;
          }
          if (t.action === "potion") {
            let n = ITEMS[t.item]?.kind === "heal" ? t.item : "potion_s";
            if (!takeItem(this.net.doc, n, 1)) {
              this.net.emit("actionRejected", {
                reason: "no_item"
              });
              return;
            }
            this.you.hp = Math.min(this.you.maxHp, this.you.hp + ITEMS[n].amount), this.net.emit("inventory", this.net.doc.inventory);
          } else {
            let n = this.sim.trainerAction(this.you.id, t.action);
            n.ok || this.net.emit("actionRejected", {
              reason: n.reason
            });
          }
          this.sync();
        }
      }
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
