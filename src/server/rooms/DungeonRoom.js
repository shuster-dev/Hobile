import { Room } from '@colyseus/core';
import { BattleState, syncCombatants } from '../state.js';
import { PartyDungeon } from '../game/party-dungeon.js';
import { normalizeDoc } from '../game/combat.js';
import { DUNGEONS } from '../../shared/gamedata.js';
import { TOWER } from '../../shared/endgame.js';
import { verifyToken } from '../auth.js';
import * as Social from '../social.js';
import * as Guilds from '../guilds.js';

const LOBBY_MS = 12_000;   // a party member who said yes has this long to arrive before the first floor

/**
 * A dungeon run (or a climb of the tower) for whoever it was opened for: the
 * player who went in, and the party members who said yes (`allowed`, shared
 * by reference with the world room and social.js). The run itself is
 * PartyDungeon (game/party-dungeon.js); this room mirrors it into schema
 * state, routes each client to their own seat, and writes each document back.
 */
export class DungeonRoom extends Room {
  // Instance onAuth, not the static one: this client sends its token in the
  // join options (see client/net.js), not as an Authorization header.
  onAuth(client, options = {}) {
    const claims = verifyToken(options.token);
    if (!claims) throw new Error('unauthorized');
    if (this.run?.resolved) throw new Error('fight_over');
    if (this.allowed && !this.allowed.has(claims.sub)) throw new Error('not_invited');
    return claims;
  }

  onCreate(options = {}) {
    this.store = options.store;
    this.opts = options;
    this.def = options.def?.id === TOWER.id ? TOWER : DUNGEONS[options.def?.id] || options.def;
    this.allowed = options.allowed instanceof Set ? options.allowed : (options.ownerId ? new Set([options.ownerId]) : null);
    this.maxClients = this.def?.partyMax || 4;
    this.autoDispose = true;
    this.docs = new Map();
    this.idBySession = new Map();
    this.setState(new BattleState());
    this.state.mode = 'dungeon';
    this.state.phase = 'waiting';
    this.state.dungeon = this.def?.id || '';
    this.state.floors = this.def?.endless ? 0 : this.def?.floors || 1;
    this.run = new PartyDungeon({
      def: this.def, tier: options.tier,
      broadcast: (event, data) => this.broadcast(event, data),
      onEnd: () => { Social.endCoop(this.roomId); this.saveAll(); },
    });
    this.run.onSync = () => {
      this.state.phase = this.run.phase;
      this.state.floor = this.run.floor || 1;
      syncCombatants(this.state, this.run.sim);
    };
    this.onMessage('*', (client, type, payload) => {
      const id = this.idBySession.get(client.sessionId);
      if (!id) return;
      try { this.run.handle(id, String(type), payload || {}); }
      catch (err) { console.error('[dungeon]', type, err); client.send('error', { code: 'server_error' }); }
    });
  }

  async onJoin(client, options = {}, auth) {
    const doc = await this.store.getDoc(auth?.sub);
    if (!doc) { client.send('error', { code: 'no_character' }); return client.leave(4000); }
    normalizeDoc(doc);
    this.docs.set(doc.id, doc);
    this.idBySession.set(client.sessionId, doc.id);
    this.run.addPlayer(doc, (event, data) => client.send(event, data), { guildBonus: Guilds.buffsFor(doc) });
    Social.attach(doc, `dungeon:${this.roomId}`, { send: (e, d) => client.send(e, d), where: 'dungeon', zone: this.def?.id || '' });
    // The one who opened it goes in at once if nobody else was asked; with a
    // party asked along, the first floor waits a little for them.
    if (this.run.started) return;
    const asked = this.opts.asked || 0;
    if (!asked || this.docs.size > asked) this.run.start();
    else if (!this._lobby) {
      this.broadcast('dungeonLobby', { until: Date.now() + LOBBY_MS });
      this._lobby = setTimeout(() => this.run.start(), LOBBY_MS);
    }
  }

  async onLeave(client) {
    const id = this.idBySession.get(client.sessionId);
    this.idBySession.delete(client.sessionId);
    if (!id) return;
    this.run.leave(id, 'gone');
    Social.detach(id, `dungeon:${this.roomId}`);
    const doc = this.docs.get(id);
    if (doc) await this.store.saveDoc(doc).catch(() => {});
  }

  saveAll() {
    for (const doc of this.docs.values()) this.store.saveDoc(doc).catch(() => {});
  }

  async onDispose() {
    clearTimeout(this._lobby);
    this.run.stop();
    for (const doc of this.docs.values()) await this.store.saveDoc(doc).catch(() => {});
  }
}
