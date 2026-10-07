import { Room } from '@colyseus/core';
import { WorldState, PlayerState, WildState, BossContributor } from '../state.js';
import { engageWild, handleWorldMessage, speakTo, visitCheck } from '../game/world-messages.js';
import { hpRatio } from '../game/player.js';
import {
  HOME_ZONE, ZONES, SPECIES, WORLD_BOSSES, PROGRESSION,
  randomLevel, statsFor, weightedPick,
} from '../../shared/gamedata.js';
import { propsFor, resolveCollision } from '../../shared/props.js';
import { fieldPoint, wildTarget } from '../../shared/worldplan.js';
import { tickWilds, populate } from '../game/wilds.js';
import {
  activeCreature, activateZoneQuests, normalizeDoc, publicProfile, syncQuests, uid, grantXp, giveItem, DAY_MS,
} from '../game/combat.js';
import { FIELD, fieldHint, keepSpot, savedSpot, tickField } from '../game/field.js';
import { GM_LIMITS } from '../game/gm.js';
import { isAdmin } from '../admin.js';
import { verifyToken } from '../auth.js';
import * as Social from '../social.js';

const TICK_MS = 50;
const SAVE_EVERY_MS = 20_000;
const WILD_TARGET = 14;
const MAX_MOVE_PER_PACKET = 2.2;   // metres; the client sends ~20/s
const SUMMON_LIFE_MS = 5 * 60_000; // a GM's summoned wild goes home after this
const COOP_REACH = 60;             // metres: how near a party member must be to be called into a fight

// Every zone room in this process. One server holds them all, so "everyone
// online" for the GM tools is a walk over this set, not a service.
const WORLDS = new Set();

function onlinePlayers() {
  const out = [];
  for (const room of WORLDS) {
    for (const doc of room.docsBySession.values()) {
      out.push({ id: doc.id, name: doc.name, level: doc.level, zone: room.zoneId });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** A live handle on someone online: their document, their avatar, a way to
 *  tell their screen. Their document is the same object their session holds
 *  (the store keeps one per player), so a change here is a change there. */
function reachPlayer(id) {
  for (const room of WORLDS) {
    for (const [sessionId, doc] of room.docsBySession) {
      if (doc.id !== id) continue;
      const client = room.clients.find((c) => c.sessionId === sessionId);
      if (!client) continue;
      return {
        doc,
        zoneId: room.zoneId,
        self: () => room.state.players.get(sessionId),
        send: (event, data) => client.send(event, data),
        save: () => { room.dirty = true; },
      };
    }
  }
  return null;
}

function broadcastAll(msg) {
  let reached = 0;
  for (const room of WORLDS) {
    room.broadcast('chat', msg);
    room.broadcast('gmAnnounce', { from: msg.from, text: msg.text });
    reached += room.clients.length;
  }
  return reached;
}

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
    Social.useStore(this.store);
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

    // the wilds: who comes out where, in what numbers (game/wilds.js)
    this.wilds = {
      zone: this.zone, colliders: this.colliders, state: this.state, wildDocs: this.wildDocs,
      target: wildTarget(this.zone, WILD_TARGET),
      spawn: (species, level, at) => this.spawnWild(species, level, at),
    };
    populate(this.wilds);
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

    // What field.js needs to know about this room.
    this.field = {
      zone: this.zone,
      colliders: this.colliders,
      state: this.state,
      wildDocs: this.wildDocs,
      players: () => this.fieldPlayers(),
      player: (key) => this.fieldPlayer(key),
      engage: (entry, wildId) => engageWild(entry.ctx, wildId, { ambush: true }),
    };

    this.setSimulationInterval(() => this.tick(), TICK_MS);
    this.lastSave = Date.now();
    WORLDS.add(this);
  }

  fieldPlayer(key) {
    const p = this.state.players.get(key), doc = this.docsBySession.get(key), ctx = this.ctxBySession.get(key);
    return p && doc && ctx ? { key, p, doc, ctx } : null;
  }
  *fieldPlayers() {
    for (const key of this.state.players.keys()) {
      const e = this.fieldPlayer(key);
      if (e) yield e;
    }
  }

  async onJoin(client, options = {}, auth) {
    const userId = auth?.sub;
    const doc = await this.store.getDoc(userId);
    if (!doc) { client.send('error', { code: 'no_character' }); client.leave(4000); return; }
    const user = await this.store.findUserById(userId).catch(() => null);
    normalizeDoc(doc);
    activateZoneQuests(doc, this.zoneId);
    doc.zone = this.zoneId;

    // Back from a fight, a dungeon or a dropped connection: where you were.
    // From another zone: its camp.
    const spawn = savedSpot(doc, this.zoneId, this.zone, this.colliders, options.fromZone)
      || this.spawnPoint(options.fromZone);
    keepSpot(doc, this.zoneId, spawn);
    const p = new PlayerState();
    Object.assign(p, {
      id: doc.id, name: doc.name, level: doc.level,
      x: spawn.x, y: 0, z: spawn.z, rot: 0, moving: false, status: 'idle',
      guildTag: '', partyId: '',
      petSpecies: activeCreature(doc)?.species || '', petStar: activeCreature(doc)?.star || 1, hpRatio: hpRatio(doc),
      body: doc.appearance.body, skin: doc.appearance.skin,
      hair: doc.appearance.hair, outfit: doc.appearance.outfit,
      kind: doc.appearance.kind, look: doc.appearance.look,
    });
    this.state.players.set(client.sessionId, p);
    this.docsBySession.set(client.sessionId, doc);
    this.ctxBySession.set(client.sessionId, this.makeContext(client, doc, user));
    // online: friends see you here, your party sees where you are
    Social.attach(doc, `world:${this.roomId}:${client.sessionId}`, {
      send: (e, d) => client.send(e, d), where: 'world', zone: this.zoneId,
      setParty: (pid) => { const st = this.state.players.get(client.sessionId); st && (st.partyId = pid || ''); },
      pos: () => this.state.players.get(client.sessionId),
    });
    this.broadcast('chat', {
      ch: 'system', t: Date.now(), text: `${doc.name} הגיע ל${this.zone.he}.`,
    }, { except: client });
  }

  async onLeave(client, consented) {
    const doc = this.docsBySession.get(client.sessionId);
    doc && Social.detach(doc.id, `world:${this.roomId}:${client.sessionId}`);
    if (doc) await this.store.saveDoc(doc).catch(() => {});
    this.state.players.delete(client.sessionId);
    this.docsBySession.delete(client.sessionId);
    this.ctxBySession.delete(client.sessionId);
  }

  async onDispose() {
    WORLDS.delete(this);
    for (const doc of this.docsBySession.values()) await this.store.saveDoc(doc).catch(() => {});
  }

  /** The surface world-messages.js is written against, bound to one client. */
  makeContext(client, doc, user = null) {
    const room = this, seen = new Set(), admin = isAdmin(user);
    const ctx = {
      doc,
      zone: this.zone,
      zoneId: this.zoneId,
      colliders: this.colliders,
      state: this.state,
      wildDocs: this.wildDocs,
      bossContribution: this.bossContribution,
      _bossCd: 0,
      // Nothing in the field starts on someone who has just arrived, and the
      // half-minute after a fight carries over from the battle that set it.
      calmUntil: Math.max(doc.calmUntil || 0, Date.now() + FIELD.joinCalmMs),
      lastStepAt: 0,
      admin,
      gm: admin ? {
        online: () => onlinePlayers(),
        reach: (id) => reachPlayer(id),
        broadcast: (msg) => broadcastAll(msg),
        summon: (species, level) => room.summon(client, species, level),
        audit: (entry) => room.audit(doc, user, entry),
        recent: (n) => room.store.adminLog ? room.store.adminLog(n) : [],
      } : null,
      net: {
        emit: (event, data) => client.send(event, data),
        save: () => { room.dirty = true; },
      },
      self: () => room.state.players.get(client.sessionId),
      // the social layer is the online server's (social.js); the
      // single-player build has nobody to be friends with
      online: true,
      roomChat: (msg, ok) => {
        for (const c of room.clients) {
          const other = room.docsBySession.get(c.sessionId);
          if (!other || ok(other.id)) c.send('chat', msg);
        }
      },
      startPvp: (plan) => room.startPvp(plan),
      report: (row) => room.store.logAdmin?.(row)?.catch?.(() => {}),
      chat: (msg) => {
        if (msg.ch === 'zone' || !msg.ch) return room.broadcast('chat', msg);
        if (msg.ch === 'guild') return room.broadcastToGuild(doc.guildId, msg);
        client.send('chat', msg);
      },
      welcome: () => room.welcome(client, doc),
      speak: (d, npcId) => room.speak(client, d, npcId),
      guildView: () => room.guildView(doc),
      partyView: () => Social.partyView(Social.partyOf(doc.id)),
      friendList: () => Social.friendsView(doc),
      refreshBossBoard: () => room.refreshBossBoard(),
      checkVisits: (d, pos) => visitCheck(ctx, d, pos, seen),
      startBattle: (opts) => room.startBattle(client, doc, opts),
      startDungeon: (opts) => room.startDungeon(client, doc, opts),
    };
    return ctx;
  }

  welcome(client, doc) {
    client.send('profile', publicProfile(doc));
    client.send('zone', {
      id: this.zoneId, name: this.zone.name, he: this.zone.he,
      ground: this.zone.ground, accent: this.zone.accent, sky: this.zone.sky,
      size: this.zone.size, landmarks: this.zone.landmarks, levels: this.zone.levels,
    });
    client.send('guild', this.guildView(doc));
    client.send('party', Social.partyView(Social.partyOf(doc.id)));
    client.send('friends', Social.friendsView(doc));
    if (this.ctxBySession.get(client.sessionId)?.admin) client.send('gm', { kind: 'hello', limits: GM_LIMITS });
    const hint = fieldHint(doc, this.zone);
    if (hint) { client.send('chat', { ch: 'system', t: Date.now(), text: hint }); this.dirty = true; }
    const others = Math.max(0, this.state.players.size - 1);
    client.send('chat', {
      ch: 'system', t: Date.now(),
      text: others
        ? `${this.zone.he} · ${others} שחקנים נוספים כאן עכשיו.`
        : `${this.zone.he} · אתה הראשון כאן. שחקנים אחרים יופיעו כשיתחברו.`,
    });
  }

  speak(client, doc, npcId) {
    const ctx = this.ctxBySession.get(client.sessionId);
    if (ctx) speakTo(ctx, doc, npcId, (Date.now() % DAY_MS / DAY_MS + 1) % 1);
  }

  guildView(doc) { return { id: doc.guildId || '', members: [], buffLevel: 0, bonuses: {} }; }

  broadcastToGuild(guildId, msg) {
    if (!guildId) return;
    for (const c of this.clients) {
      if (this.docsBySession.get(c.sessionId)?.guildId === guildId) c.send('chat', msg);
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
    // a planned zone knows its own ground (worldplan.js); the town does not
    const planned = !this.zone.urban && fieldPoint(this.zone, this.colliders);
    if (planned) return planned;
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

  spawnWild(species = weightedPick(this.zone.spawns), level = randomLevel(this.zoneId), at = this.randomFieldPoint()) {
    const id = 'w' + uid().slice(0, 8);
    const { x, z } = at;
    const w = new WildState();
    Object.assign(w, { id, species, level, x, z, rot: Math.random() * 6.28, engagedBy: '', alert: '', target: '' });
    this.state.wilds.set(id, w);
    this.wildDocs.set(id, { species, level, target: { x, z }, next: 0, mode: '', restUntil: 0 });
    return id;
  }

  /** A GM calls a wild to their side. It is an ordinary wild from then on —
   *  catchable, and fierce if its species is — and it goes home after a while
   *  if nobody takes it on, so summons cannot pile up in a zone. */
  summon(client, species, level) {
    let alive = 0;
    for (const d of this.wildDocs.values()) if (d.summonedUntil) alive++;
    if (alive >= GM_LIMITS.summons) return null;
    const p = this.state.players.get(client.sessionId);
    if (!p) return null;
    const a = Math.random() * Math.PI * 2;
    const at = resolveCollision(this.colliders, p.x + Math.cos(a) * 3.5, p.z + Math.sin(a) * 3.5, 0.5);
    const id = this.spawnWild(species, level, at);
    Object.assign(this.wildDocs.get(id), { summonedUntil: Date.now() + SUMMON_LIFE_MS, home: { x: at.x, z: at.z }, roam: 4 });
    return id;
  }

  /** Every GM action, in the server log and in the store. */
  audit(doc, user, entry) {
    const row = {
      at: Date.now(),
      gm: { id: doc.id, name: doc.name, username: user?.username || '' },
      zone: this.zoneId,
      ...entry,
    };
    console.log('[gm]', JSON.stringify(row));
    this.store.logAdmin?.(row)?.catch?.((e) => console.warn('[gm] log write failed', e?.message));
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
    let reservation;
    // who may come into this fight: you, and any party member you call in
    const allowed = new Set([doc.id]);
    try {
      reservation = await matchMaker.createRoom('battle', {
        store: this.store, zoneId: this.zoneId, wild: opts.wild, ownerId: doc.id, allowed,
        onEnd: opts.onEnd,
      });
    } catch (err) {
      // A room that could not be made must not keep the wild, or the player.
      console.error('[world] battle room', err);
      try { opts.onEnd?.(false); } catch {}
      const ctx = this.ctxBySession.get(client.sessionId);
      if (ctx) ctx.battlePending = 0;
      client.send('error', { code: 'server_error' });
      return;
    }
    client.send('goto', { roomId: reservation.roomId, kind: 'battle', wildId: opts.wildId, ambush: !!opts.ambush });
    // party members close by may join in
    const me = this.state.players.get(client.sessionId);
    Social.offerCoop({
      roomId: reservation.roomId, doc, zone: this.zoneId, wild: opts.wild, allowed,
      near: (id) => {
        const p = Social.worldSink(id)?.pos?.();
        return !!p && !!me && Math.hypot(p.x - me.x, p.z - me.z) <= COOP_REACH;
      },
    });
  }

  /** A duel or a two-on-two that everyone has said yes to: one room for it,
   *  and everyone in it sent there. */
  async startPvp({ sides }) {
    const { matchMaker } = await import('@colyseus/core');
    let reservation;
    try {
      reservation = await matchMaker.createRoom('battle', { store: this.store, zoneId: this.zoneId, mode: 'pvp', sides });
    } catch (err) {
      console.error('[world] duel room', err);
      for (const id of [...sides.a, ...sides.b]) Social.sendTo(id, 'error', { code: 'server_error' });
      return;
    }
    for (const id of [...sides.a, ...sides.b]) {
      Social.worldSink(id)?.send('goto', { roomId: reservation.roomId, kind: 'battle', duel: true, pair: sides.a.length > 1 });
    }
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

    // the wilds come out, amble where they came out, and keep their hours; a
    // wild with a mood (coming for someone, running, looking around for who
    // it lost) is moved by the field instead. A summoned one wanders round
    // where it was called and goes home after a while.
    tickWilds(this.wilds, now, TICK_MS);

    // who notices whom
    tickField(this.field, now, TICK_MS);

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
