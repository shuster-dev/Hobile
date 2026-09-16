import { Combat, Combatant, DAY_MS, SAVE_KEY, TICK_MS, WILD_COUNT, activeCreature, addCreature, baseView, cancelTraining, claimQuest, collectGarden, collectTraining, createPlayerDoc, creatureCard, creaturePower, creatureScore, equipGear, giveItem, grantItems, grantXp, grantXpTo, healTeam, loadSave, makeCreature, normalizeDoc, publicProfile, startCraft, startTraining, sumStats, syncQuests, takeItem, uid, upgradeBuilding, writeSave } from './combat.js';
import { DROPS, DUNGEONS, GUILD, HOME_ZONE, ITEMS, MOVES, PROGRESSION, SPECIES, WORLD_BOSSES, ZONES, randomLevel, statsFor, weightedPick } from '../../shared/gamedata.js';
import { NPCS, npcAt, npcLines } from '../../shared/npcs.js';
import { propsFor, resolveCollision } from '../../shared/props.js';

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
      return this.doc ? (normalizeDoc(this.doc), {
        hasCharacter: !0,
        profile: publicProfile(this.doc)
      }) : {
        hasCharacter: !1
      };
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
      }), this.net.emit("guild", this.guildView()), this.net.emit("party", this.partyView()), this.net.emit("friends", this.friendList()), this.net.emit("chat", {
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
        if (!this.zone.landmarks.some(r => r.r && Math.hypot(r.x - n, r.z - s) < r.r + 4) && !this.colliders.some(r => Math.hypot(r.x - n, r.z - s) < r.r + 1.2)) return {
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
      let n = Object.prototype.hasOwnProperty.call(NPCS, t) ? NPCS[t] : null;
      if (!n) {
        this.net.emit("error", {
          code: "no_such_npc"
        });
        return;
      }
      let s = this.state.players.get("me"),
        r = npcAt(t, this.dayPhase());
      if (s && Math.hypot(s.x - r.x, s.z - r.z) > 5.5) {
        this.net.emit("error", {
          code: "too_far"
        });
        return;
      }
      let o = this.dayPhase(),
        a = {
          hasStarter: (e.creatures || []).length > 0,
          captures: e.stats?.captures || 0,
          battlesWon: e.stats?.battlesWon || 0,
          level: e.level || 1,
          guildId: e.guildId || null,
          night: o < 0.15 || o > 0.78,
          quests: {
            active: Object.keys(e.quests?.active || {}),
            done: Object.entries(e.quests?.active || {}).filter(([, h]) => h.done).map(([h]) => h)
          }
        },
        l = npcLines(t, a),
        c = syncQuests(e, {
          kind: "talk",
          target: t
        });
      this.net.save(), this.net.emit("dialogue", {
        npcId: t,
        id: t,
        name: n.name,
        he: n.he,
        questsDone: c,
        lines: (l?.lines || ["…"]).map((h, d) => ({
          he: h,
          en: l?.en?.[d] || ""
        }))
      });
      for (let h of c) this.net.emit("questDone", {
        id: h
      });
      this.net.emit("profile", publicProfile(e));
    }
    checkVisits(e, t) {
      let n = this._visited || (this._visited = new Set());
      for (let s of this.zone.landmarks) {
        if (!s.r || n.has(s.kind) || Math.hypot(s.x - t.x, s.z - t.z) > s.r) continue;
        n.add(s.kind);
        let r = syncQuests(e, {
          kind: "visit",
          target: s.kind,
          zone: this.zoneId
        });
        if (r.length) {
          this.net.save();
          for (let o of r) this.net.emit("questDone", {
            id: o
          });
          this.net.emit("profile", publicProfile(e));
        }
      }
    }
    handle(e, t = {}) {
      let n = this.doc,
        s = this.state.players.get("me"),
        r = Date.now();
      switch (e) {
        case "ready":
        case "refresh":
          this.welcome();
          break;
        case "move":
          if (Number.isFinite(t.x) && Number.isFinite(t.z)) {
            let o = resolveCollision(this.colliders, t.x, t.z, 0.42);
            s.x = o.x, s.z = o.z, s.rot = Number.isFinite(t.rot) ? t.rot : s.rot, s.moving = !!t.moving, this.checkVisits(n, s);
          }
          break;
        case "chat":
          {
            let o = {
              ch: t.ch || "zone",
              from: n.name,
              fromId: n.id,
              text: String(t.text || "").slice(0, 240),
              t: r
            };
            this.net.emit("chat", o);
            break;
          }
        case "engage":
          {
            let o = this.state.wilds.get(t.wildId);
            if (!o || o.engagedBy) {
              this.net.emit("error", {
                code: "wild_gone"
              });
              return;
            }
            if (Math.hypot(o.x - s.x, o.z - s.z) > 8) {
              this.net.emit("error", {
                code: "too_far"
              });
              return;
            }
            let a = activeCreature(n);
            if (!a || a.hp <= 0) {
              this.net.emit("error", {
                code: "no_healthy_creature"
              });
              return;
            }
            o.engagedBy = n.id;
            let l = new BattleSim(this.net, {
              zoneId: this.zoneId,
              wild: {
                species: o.species,
                level: o.level
              },
              onEnd: c => {
                c ? (this.state.wilds.delete(t.wildId), this.wildDocs.delete(t.wildId)) : o.engagedBy = "";
              }
            });
            this.net.pendingRooms.set(l.roomId, l), this.net.emit("goto", {
              roomId: l.roomId,
              kind: "battle"
            });
            break;
          }
        case "duel":
          {
            this.net.emit("error", {
              code: "pvp_offline"
            });
            break;
          }
        case "bossAttack":
          {
            let o = this.state.boss;
            if (!o.active) return;
            if (Math.hypot(o.x - s.x, o.z - s.z) > 16) {
              this.net.emit("error", {
                code: "too_far"
              });
              return;
            }
            if (r < (this._bossCd || 0)) return;
            this._bossCd = r + 900;
            let a = activeCreature(n);
            if (!a) return;
            let l = statsFor(a.species, a.level, a.iv),
              c = MOVES[t.skill] || MOVES[a.skills[0]],
              h = c?.kind === "special" ? l.spa : l.atk,
              d = Math.max(1, Math.floor(((2 * a.level / 5 + 2) * (c?.power || 34) * (h / 120) / 50 + 2) * (0.85 + Math.random() * 0.3)));
            if (o.hp = Math.max(0, o.hp - d), this.bossContribution.set(n.name, (this.bossContribution.get(n.name) || 0) + d), this.refreshBossBoard(), this.net.emit("bossHit", {
              by: n.name,
              dmg: d,
              hp: o.hp,
              skill: t.skill
            }), Math.random() < 0.25) {
              let u = Math.max(1, Math.floor(a.maxHp * (0.05 + Math.random() * 0.07)));
              a.hp = Math.max(0, a.hp - u), s.hpRatio = hpRatio(n), this.net.save(), this.net.emit("bossCounter", {
                dmg: u,
                hp: a.hp,
                maxHp: a.maxHp
              });
            }
            break;
          }
        case "travel":
          {
            let o = ZONES[t.zone];
            if (!o) return;
            if (n.level < o.levels[0] - 2) {
              this.net.emit("error", {
                code: "level_too_low"
              });
              return;
            }
            n.zone = t.zone, this.net.save(), this.net.emit("goto", {
              kind: "world",
              zone: t.zone,
              fromZone: this.zoneId
            });
            break;
          }
        case "dungeonEnter":
          {
            let o = DUNGEONS[t.dungeonId];
            if (!o) return;
            if (n.level < o.minLevel) {
              this.net.emit("error", {
                code: "level_too_low",
                need: o.minLevel
              });
              return;
            }
            let a = new DungeonSim(this.net, {
              def: o,
              allies: []
            });
            this.net.pendingRooms.set(a.roomId, a), this.net.emit("goto", {
              roomId: a.roomId,
              kind: "dungeon"
            });
            break;
          }
        case "interact":
          {
            let o = this.zone.landmarks.find(a => a.id === t.target || a.kind === t.target);
            if (!o) return;
            o.kind === "npc" ? this.speak(n, o.id || o.npc) : (o.kind === "plaza" || o.kind === "town" || o.kind === "camp") && (healTeam(n, 1), s.hpRatio = hpRatio(n), this.net.save(), this.net.emit("healed", {}), this.net.emit("profile", publicProfile(n)));
            break;
          }
        case "talk":
          {
            this.speak(n, typeof t?.npcId == "string" ? t.npcId : "");
            break;
          }
        case "baseOpen":
          {
            let o = collectGarden(n);
            this.net.save(), this.net.emit("base", {
              ...baseView(n),
              ...(o ? {
                fiber: o
              } : {})
            }), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "baseBuild":
        case "baseTrain":
        case "baseCollect":
        case "baseCancel":
        case "baseCraft":
          {
            let o = {
              baseBuild: () => upgradeBuilding(n, t.id),
              baseTrain: () => startTraining(n, t.uid),
              baseCollect: () => collectTraining(n, t.slotId),
              baseCancel: () => cancelTraining(n, t.slotId),
              baseCraft: () => startCraft(n, t.recipe)
            }[e]();
            if (!o.ok) {
              this.net.emit("error", {
                code: o.reason
              });
              return;
            }
            let a = e === "baseCraft" ? syncQuests(n, {
              kind: "craft"
            }) : e === "baseCollect" && o.star ? syncQuests(n, {
              kind: "star",
              star: o.star
            }) : [];
            this.net.save();
            for (let c of a) this.net.emit("questDone", {
              id: c
            });
            let l = e === "baseCollect" ? {
              starUp: o
            } : e === "baseBuild" ? {
              built: o
            } : e === "baseTrain" ? {
              started: o.slot
            } : e === "baseCraft" ? {
              craft: o.job
            } : {};
            this.net.emit("base", {
              ...baseView(n),
              ...l
            }), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "card":
          {
            let o = creatureCard(n, t.uid);
            o && this.net.emit("card", o);
            break;
          }
        case "shopBuy":
          {
            let o = ITEMS[t.itemId],
              a = Math.max(1, Math.min(99, Number(t.qty) || 1));
            if (!o?.price) return;
            if (n.gold < o.price * a) {
              this.net.emit("error", {
                code: "not_enough_gold"
              });
              return;
            }
            n.gold -= o.price * a, giveItem(n, o.id, a), this.net.save(), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "useItem":
          {
            let o = ITEMS[t.itemId];
            if (!o) return;
            let a = n.creatures[t.uid] || activeCreature(n);
            if (o.kind === "heal" && a && a.hp > 0 && takeItem(n, o.id)) a.hp = Math.min(a.maxHp, a.hp + o.amount);else if (o.kind === "revive" && a && a.hp <= 0 && takeItem(n, o.id)) a.hp = Math.floor(a.maxHp * o.ratio);else if (o.kind === "gear") {
              if (!equipGear(n, o.id)) {
                this.net.emit("error", {
                  code: "cannot_equip"
                });
                return;
              }
            } else {
              this.net.emit("error", {
                code: "cannot_use"
              });
              return;
            }
            s.hpRatio = hpRatio(n), this.net.save(), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "setTeam":
          {
            let o = (t.team || []).filter(l => n.creatures[l]).slice(0, 6);
            if (!o.length) return;
            let a = new Set([...n.team, ...n.box]);
            n.team = o, n.box = [...a].filter(l => !o.includes(l)), s.petSpecies = activeCreature(n)?.species || "", s.hpRatio = hpRatio(n), this.net.save(), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "questClaim":
          {
            let o = claimQuest(n, t.questId);
            if (!o) {
              this.net.emit("error", {
                code: "cannot_claim"
              });
              return;
            }
            this.net.save(), this.net.emit("questClaimed", {
              questId: t.questId,
              reward: o.reward
            }), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "partyInvite":
        case "partyAccept":
        case "friendAdd":
          this.net.emit("error", {
            code: "solo_mode"
          });
          break;
        case "partyLeave":
          this.net.emit("party", null);
          break;
        case "friendRespond":
        case "friendRemove":
          this.net.emit("friends", this.friendList());
          break;
        case "guildList":
          this.net.emit("guildList", this.net.guilds.map(o => ({
            id: o.id,
            name: o.name,
            tag: o.tag,
            members: 1,
            buffLevel: o.buffLevel,
            territories: o.territories
          })));
          break;
        case "guildCreate":
          {
            if (n.gold < GUILD.createCost) {
              this.net.emit("error", {
                code: "not_enough_gold"
              });
              return;
            }
            n.gold -= GUILD.createCost;
            let o = {
              id: "g" + uid().slice(0, 6),
              name: t.name || "Guild",
              tag: (t.tag || t.name || "GLD").slice(0, 4).toUpperCase(),
              masterId: n.id,
              buffLevel: 1,
              contribution: 0,
              myContribution: 0,
              house: [],
              territories: [],
              warScore: 0,
              log: [{
                t: Date.now(),
                text: `${n.name} founded the guild`
              }]
            };
            this.net.guilds.unshift(o), n.guildId = o.id, s.guildTag = o.tag, this.net.save(), this.net.emit("guild", this.guildView()), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "guildJoin":
          {
            let o = this.net.guilds.find(a => a.id === t.guildId);
            if (!o) return;
            n.guildId = o.id, s.guildTag = o.tag, this.net.save(), this.net.emit("guild", this.guildView()), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "guildLeave":
          n.guildId = null, s.guildTag = "", this.net.save(), this.net.emit("guild", null), this.net.emit("profile", publicProfile(n));
          break;
        case "guildContribute":
          {
            let o = this.net.guilds.find(l => l.id === n.guildId),
              a = Math.max(1, Number(t.gold) || 0);
            if (!o || n.gold < a) {
              this.net.emit("error", {
                code: "not_enough_gold"
              });
              return;
            }
            n.gold -= a, o.contribution += a, o.myContribution = (o.myContribution || 0) + a;
            for (let l of GUILD.buffs) l.level > o.buffLevel && o.contribution >= l.cost && (o.buffLevel = l.level);
            this.net.save(), this.net.emit("guild", this.guildView()), this.net.emit("profile", publicProfile(n));
            break;
          }
        case "guildUpgrade":
          {
            let o = this.net.guilds.find(l => l.id === n.guildId),
              a = GUILD.houseUpgrades.find(l => l.id === t.upgradeId);
            if (!o || !a || o.house.includes(a.id)) return;
            if (o.contribution < a.cost) {
              this.net.emit("error", {
                code: "not_enough_contribution"
              });
              return;
            }
            o.contribution -= a.cost, o.house.push(a.id), this.net.emit("guild", this.guildView());
            break;
          }
        default:
          break;
      }
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
      }, this.sim = new Combat({
        mode: "pve",
        onEvent: a => this.onSimEvent(a)
      });
      let r = e.doc,
        o = activeCreature(r);
      this.you = this.sim.add(new Combatant({
        side: "a",
        kind: "player",
        name: r.name,
        creature: o,
        ownerId: r.id,
        gearBonus: sumStats(r)
      })), this.foe = this.sim.add(new Combatant({
        side: "b",
        kind: "wild",
        name: SPECIES[n.species].name,
        creature: makeCreature(n.species, n.level)
      }));
    }
    start() {
      this.sync(), setTimeout(() => {
        this.net.emit("battleInit", {
          mode: "pve",
          you: this.you.id,
          inventory: this.net.doc.inventory,
          profile: publicProfile(this.net.doc)
        }), this.state.phase = "active", this.net.emit("battleStart", {
          at: Date.now()
        });
      }, 80), this.timer = setInterval(() => {
        this.state.phase === "active" && (this.sim.update(100), this.sync());
      }, 100);
    }
    stop() {
      clearInterval(this.timer);
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
          addCreature(t, c), t.stats.captures += 1, o.captured = c, o.questsDone.push(...syncQuests(t, {
            kind: "capture"
          }));
        }
      } else if (e.outcome !== "fled") {
        t.stats.deaths += 1;
        let a = Math.floor(t.gold * 0.02);
        t.gold = Math.max(0, t.gold - a), o.gold = -a, o.blackout = !0, healTeam(t, 1);
      }
      this.net.save(), o.profile = publicProfile(t), this.onEnd(s || r), this.net.emit("battleEnd", o);
    }
    handle(e, t = {}) {
      if (e === "ready") {
        this.net.emit("battleInit", {
          mode: "pve",
          you: this.you.id,
          inventory: this.net.doc.inventory,
          profile: publicProfile(this.net.doc)
        });
        return;
      }
      if (this.state.phase !== "active") return;
      let n = this.net.doc;
      if (e === "skill") {
        let s = this.sim.useSkill(this.you.id, t.skill, this.foe.id);
        s.ok || this.net.emit("actionRejected", {
          reason: s.reason,
          skill: t.skill
        }), this.sync();
      } else if (e === "trainer") {
        if (t.action === "sphere") {
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
    skills: n.skills.slice(),
    effects: n.effects.map(s => ({
      kind: s.kind,
      until: s.until
    }))
  });
  for (let n of [...i.combatants.keys()]) t.has(n) || i.combatants.delete(n);
}

function hpRatio(i) {
  let e = activeCreature(i);
  return e ? e.hp / Math.max(1, e.maxHp) : 1;
}

function guildBuffs(i) {
  let e = {};
  for (let t of GUILD.buffs) if (!(t.level > i.buffLevel)) for (let [n, s] of Object.entries(t.bonus)) e[n] = (e[n] || 0) + s;
  return e;
}


export {BattleSim, DungeonSim, LocalStore, StoreBase, WorldSim, guildBuffs, hpRatio, syncBattleState};
