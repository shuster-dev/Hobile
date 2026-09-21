import { Room } from '@colyseus/core';
import { WorldState, PlayerState, WildState, BossContributor } from '../state.js';
import { handleWorldMessage } from '../game/world-messages.js';
import { hpRatio } from '../game/player.js';
import {
  HOME_ZONE, ZONES, SPECIES, WORLD_BOSSES, PROGRESSION,
  randomLevel, statsFor, weightedPick,
} from '../../shared/gamedata.js';
import { propsFor, resolveCollision } from '../../shared/props.js';
import {
  activeCreature, normalizeDoc, publicProfile, syncQuests, uid, grantXp, giveItem,
} from '../game/combat.js';
import { verifyToken } from '../auth.js';

const TICK_MS = 50;
const SAVE_EVERY_MS = 20_000;
const WILD_TARGET = 14;
const MAX_MOVE_PER_PACKET = 2.2;   // metres; the client sends ~20/s

export class WorldRoom extends Room {
  // Instance onAuth, not the static one: this client sends its token in the
  // join options (see client/net.js), not as an Authorization header.
  onAuth(client, options = {}) {
    const claims = verifyToken(options.token);
    if (!claims) throw new Error('unauthorized');
    return claims;
  }

  onCreate(options = {}) {
    this.store = options.store || this.presence?.store;
    this.zoneId = ZONES[options.zone] ? options.zone : HOME_ZONE;
    this.zone = ZONES[this.zoneId];
    this.colliders = propsFor(this.zone).colliders;
    this.setState(new WorldState());
    this.state.zone = this.zoneId;
    this.maxClients = Number(process.env.MAX_PLAYERS_PER_ZONE || 60);

    this.wildDocs = new Map();
    this.bossContribution = new Map();
    this.bossDef = WORLD_BOSSES.find((b) => b.zone === this.zoneId) || null;
    this.ctxBySession = new Map();
    this.docsBySession = new Map();

    for (let i = 0; i < WILD_TARGET; i++) this.spawnWild();
    this.scheduleBoss();

    // Every world message goes through the shared protocol module. Registering
    // a wildcard keeps this list from drifting away from world-messages.js.
    this.onMessage('*', (client, type, payload) => {
      const ctx = this.ctxBySession.get(client.sessionId);
      if (!ctx) return;
      try {
        handleWorldMessage(ctx, String(type), payload || {});
      } catch (err) {
        console.error('[world]', type, err);
        client.send('error', { code: 'server_error' });
      }
    });

    this.setSimulationInterval(() => this.tick(), TICK_MS);
    this.lastSave = Date.now();
  }

  async onJoin(client, options = {}, auth) {
    const userId = auth?.sub;
    const doc = await this.store.getDoc(userId);
    if (!doc) { client.send('error', { code: 'no_character' }); client.leave(4000); return; }
    normalizeDoc(doc);
    syncQuests(doc, this.zoneId);
    doc.zone = this.zoneId;

    const spawn = this.spawnPoint(options.fromZone);
    const p = new PlayerState();
    Object.assign(p, {
      id: doc.id, name: doc.name, level: doc.level,
      x: spawn.x, y: 0, z: spawn.z, rot: 0, moving: false, status: 'idle',
      guildTag: '', partyId: '',
      petSpecies: activeCreature(doc)?.species || '', hpRatio: hpRatio(doc),
      body: doc.appearance.body, skin: doc.appearance.skin,
      hair: doc.appearance.hair, outfit: doc.appearance.outfit,
    });
    this.state.players.set(client.sessionId, p);
    this.docsBySession.set(client.sessionId, doc);
    this.ctxBySession.set(client.sessionId, this.makeContext(client, doc));
    this.broadcast('chat', {
      ch: 'system', t: Date.now(), text: `${doc.name} הגיע ל${this.zone.he}.`,
    }, { except: client });
  }

  async onLeave(client, consented) {
    const doc = this.docsBySession.get(client.sessionId);
    if (doc) await this.store.saveDoc(doc).catch(() => {});
    this.state.players.delete(client.sessionId);
    this.docsBySession.delete(client.sessionId);
    this.ctxBySession.delete(client.sessionId);
  }

  async onDispose() {
    for (const doc of this.docsBySession.values()) await this.store.saveDoc(doc).catch(() => {});
  }

  /** The surface world-messages.js is written against, bound to one client. */
  makeContext(client, doc) {
    const room = this;
    return {
      doc,
      zone: this.zone,
      zoneId: this.zoneId,
      colliders: this.colliders,
      state: this.state,
      wildDocs: this.wildDocs,
      bossContribution: this.bossContribution,
      _bossCd: 0,
      net: {
        emit: (event, data) => client.send(event, data),
        save: () => { room.dirty = true; },
      },
      self: () => room.state.players.get(client.sessionId),
      chat: (msg) => {
        if (msg.ch === 'zone' || !msg.ch) return room.broadcast('chat', msg);
        if (msg.ch === 'guild') return room.broadcastToGuild(doc.guildId, msg);
        if (msg.ch === 'party') return room.broadcastToParty(doc.partyId, msg);
        client.send('chat', msg);
      },
      welcome: () => room.welcome(client, doc),
      speak: (d, npcId) => room.speak(client, d, npcId),
      guildView: () => room.guildView(doc),
      partyView: () => room.partyView(doc),
      friendList: () => room.friendList(doc),
      refreshBossBoard: () => room.refreshBossBoard(),
      checkVisits: () => {},
      startBattle: (opts) => room.startBattle(client, doc, opts),
      startDungeon: (opts) => room.startDungeon(client, doc, opts),
    };
  }

  welcome(client, doc) {
    client.send('profile', publicProfile(doc));
    client.send('zone', {
      id: this.zoneId, name: this.zone.name, he: this.zone.he,
      ground: this.zone.ground, accent: this.zone.accent, sky: this.zone.sky,
      size: this.zone.size, landmarks: this.zone.landmarks, levels: this.zone.levels,
    });
    client.send('guild', this.guildView(doc));
    client.send('party', this.partyView(doc));
    client.send('friends', this.friendList(doc));
    const others = Math.max(0, this.state.players.size - 1);
    client.send('chat', {
      ch: 'system', t: Date.now(),
      text: others
        ? `${this.zone.he} · ${others} שחקנים נוספים כאן עכשיו.`
        : `${this.zone.he} · אתה הראשון כאן. שחקנים אחרים יופיעו כשיתחברו.`,
    });
  }

  speak(client, doc, npcId) {
    client.send('dialogue', { npc: npcId, lines: [] });
  }

  guildView(doc) { return { id: doc.guildId || '', members: [], buffLevel: 0, bonuses: {} }; }
  partyView(doc) { return { id: doc.partyId || '', members: [] }; }
  friendList(doc) {
    const online = new Set([...this.state.players.values()].map((p) => p.id));
    return (doc.friends || []).map((id) => ({ id, online: online.has(id) }));
  }

  broadcastToGuild(guildId, msg) {
    if (!guildId) return;
    for (const c of this.clients) {
      if (this.docsBySession.get(c.sessionId)?.guildId === guildId) c.send('chat', msg);
    }
  }
  broadcastToParty(partyId, msg) {
    if (!partyId) return;
    for (const c of this.clients) {
      if (this.docsBySession.get(c.sessionId)?.partyId === partyId) c.send('chat', msg);
    }
  }

  spawnPoint(fromZone) {
    const anchor = this.zone.landmarks.find((l) => l.kind === 'town' || l.kind === 'camp')
      || { x: 0, z: 0, r: 8 };
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (anchor.r || 8) * (0.15 + Math.random() * 0.32);
      const p = resolveCollision(this.colliders, anchor.x + Math.cos(a) * r, anchor.z + Math.sin(a) * r, 0.72);
      if (Math.hypot(p.x - anchor.x, p.z - anchor.z) < (anchor.r || 8)) return p;
    }
    return { x: anchor.x, z: anchor.z };
  }

  randomFieldPoint() {
    const half = this.zone.size / 2 - 8;
    for (let i = 0; i < 24; i++) {
      const x = (Math.random() * 2 - 1) * half;
      const z = (Math.random() * 2 - 1) * half;
      const onLandmark = this.zone.landmarks.some((l) => l.r && Math.hypot(l.x - x, l.z - z) < l.r + 4);
      // `c.r` is undefined on a box collider, and `undefined + 1.2` is NaN,
      // which every comparison answers false to — so buildings, gatehouses and
      // benches were invisible here and a wild could be spawned inside one.
      const inProp = this.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r ?? Math.max(c.hw, c.hd)) + 1.2);
      if (!onLandmark && !inProp) return { x, z };
    }
    return { x: half * 0.6, z: half * 0.6 };
  }

  spawnWild() {
    const id = 'w' + uid().slice(0, 8);
    const species = weightedPick(this.zone.spawns);
    const level = randomLevel(this.zoneId);
    const { x, z } = this.randomFieldPoint();
    const w = new WildState();
    Object.assign(w, { id, species, level, x, z, rot: Math.random() * 6.28, engagedBy: '' });
    this.state.wilds.set(id, w);
    this.wildDocs.set(id, { species, level, target: { x, z }, next: 0 });
  }

  scheduleBoss() {
    if (!this.bossDef) return;
    this.state.boss.nextSpawnAt = Date.now() + this.bossDef.everyMinutes * 60_000;
  }

  startBoss() {
    const def = this.bossDef;
    const stats = statsFor(def.species, def.level, 1, 3);
    const b = this.state.boss;
    b.active = true; b.species = def.species; b.level = def.level;
    b.x = def.x; b.z = def.z;
    b.maxHp = Math.round(stats.hp * 24); b.hp = b.maxHp;
    b.endsAt = Date.now() + def.windowMinutes * 60_000;
    this.bossContribution.clear();
    this.refreshBossBoard();
    this.broadcast('bossSpawn', {
      species: def.species, level: def.level, x: def.x, z: def.z,
      name: SPECIES[def.species]?.he || def.species, endsAt: b.endsAt,
    });
  }

  refreshBossBoard() {
    const rows = [...this.bossContribution.entries()]
      .sort((a, b) => b[1].damage - a[1].damage).slice(0, 5);
    this.state.boss.top.clear();
    for (const [id, v] of rows) {
      const c = new BossContributor();
      c.id = id; c.name = v.name; c.damage = Math.round(v.damage);
      this.state.boss.top.push(c);
    }
  }

  endBoss(defeated) {
    const b = this.state.boss;
    b.active = false;
    this.scheduleBoss();
    const board = [...this.bossContribution.entries()].sort((a, x) => x[1].damage - a[1].damage);
    for (const c of this.clients) {
      const doc = this.docsBySession.get(c.sessionId);
      if (!doc) continue;
      const rank = board.findIndex(([id]) => id === doc.id);
      if (rank < 0) continue;
      const share = board[rank][1].damage / Math.max(1, b.maxHp);
      const xp = Math.round(PROGRESSION.xpToLevel(this.bossDef.level) * 0.25 * share);
      if (defeated && xp > 0) { grantXp(doc, xp); giveItem(doc, 'aether_core', 1 + (rank === 0 ? 2 : 0)); }
      c.send('bossReward', { defeated, rank: rank + 1, xp, share });
      c.send('profile', publicProfile(doc));
    }
    this.broadcast('bossEnd', { defeated });
    this.bossContribution.clear();
    this.refreshBossBoard();
  }

  async startBattle(client, doc, opts) {
    const { matchMaker } = await import('@colyseus/core');
    // `onEnd` releases the wild — or removes it, if it was caught. It used to
    // be filed in a `pendingBattleEnd` map that nothing ever read, so online
    // every fight permanently bricked one creature: still standing, no longer
    // wandering, and impossible to engage for the life of the zone. Room
    // options are passed by reference (the store already relies on that), so
    // the callback can simply go with it.
    const reservation = await matchMaker.createRoom('battle', {
      store: this.store, zoneId: this.zoneId, wild: opts.wild, ownerId: doc.id,
      onEnd: opts.onEnd,
    });
    client.send('goto', { roomId: reservation.roomId, kind: 'battle', wildId: opts.wildId });
  }

  async startDungeon(client, doc, opts) {
    const { matchMaker } = await import('@colyseus/core');
    const reservation = await matchMaker.createRoom('dungeon', {
      store: this.store, def: opts.def, ownerId: doc.id,
    });
    client.send('goto', { roomId: reservation.roomId, kind: 'dungeon' });
  }

  tick() {
    const now = Date.now();
    this.state.serverTime = now;

    // wild wander
    for (const [id, w] of this.state.wilds) {
      const d = this.wildDocs.get(id);
      if (!d || w.engagedBy) continue;
      if (now >= d.next) {
        const t = this.randomFieldPoint();
        d.target = t;
        d.next = now + 4000 + Math.random() * 6000;
      }
      const dx = d.target.x - w.x, dz = d.target.z - w.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.4) {
        const step = Math.min(dist, 1.6 * (TICK_MS / 1000));
        const p = resolveCollision(this.colliders, w.x + (dx / dist) * step, w.z + (dz / dist) * step, 0.5);
        w.x = p.x; w.z = p.z; w.rot = Math.atan2(dx, dz);
      }
    }
    while (this.state.wilds.size < WILD_TARGET) this.spawnWild();

    // boss window
    const b = this.state.boss;
    if (this.bossDef) {
      if (!b.active && b.nextSpawnAt && now >= b.nextSpawnAt && this.clients.length) this.startBoss();
      else if (b.active && (now >= b.endsAt || b.hp <= 0)) this.endBoss(b.hp <= 0);
    }

    if (now - this.lastSave > SAVE_EVERY_MS) {
      this.lastSave = now;
      for (const doc of this.docsBySession.values()) this.store.saveDoc(doc).catch(() => {});
    }
  }
}
