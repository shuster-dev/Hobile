import { Room } from '@colyseus/core';
import { BattleState, syncCombatants } from '../state.js';
import { PartyBattle } from '../game/party-battle.js';
import { normalizeDoc } from '../game/combat.js';
import { verifyToken } from '../auth.js';
import * as Social from '../social.js';
import * as Guilds from '../guilds.js';
import * as Arena from '../arena.js';

const PVP_WAIT_MS = 12_000;   // everyone invited to a duel has this long to arrive

/**
 * A fight, with however many players are in it.
 *
 *   pve   a wild, made for the player who engaged it (`ownerId`). Party
 *         members it was offered to (social.js offerCoop) are added to
 *         `allowed` — the same Set the world room holds — and may join while
 *         it lasts.
 *   pvp   `sides` {a: [ids], b: [ids]}: a duel or a two-on-two. It waits for
 *         everyone, counts down, and goes.
 *
 * The fight itself is PartyBattle (game/party-battle.js); this room mirrors it
 * into schema state, routes each client's messages to their own seat, and
 * writes each player's document back.
 */
export class BattleRoom extends Room {
  // Instance onAuth, not the static one: this client sends its token in the
  // join options (see client/net.js), not as an Authorization header.
  onAuth(client, options = {}) {
    const claims = verifyToken(options.token);
    if (!claims) throw new Error('unauthorized');
    // only the people this fight is for
    if (this.battle?.resolved) throw new Error('fight_over');
    if (!this.invited(claims.sub)) throw new Error('not_invited');
    return claims;
  }

  invited(id) {
    if (this.mode === 'pvp') return this.sides.a.includes(id) || this.sides.b.includes(id);
    return !this.allowed || this.allowed.has(id);
  }

  onCreate(options = {}) {
    this.store = options.store;
    this.opts = options;
    this.mode = options.mode === 'pvp' ? 'pvp' : 'pve';
    this.sides = options.sides || { a: [], b: [] };
    // shared by reference with the world room that made it, which adds to it
    this.allowed = options.allowed instanceof Set ? options.allowed : (options.ownerId ? new Set([options.ownerId]) : null);
    this.maxClients = 4;
    this.autoDispose = true;
    this.docs = new Map();          // playerId -> doc
    this.idBySession = new Map();
    this.setState(new BattleState());
    this.state.mode = this.mode;
    this.state.phase = 'waiting';
    this.state.zone = options.zoneId || '';
    this.battle = new PartyBattle({
      mode: this.mode,
      zoneId: options.zoneId,
      wild: options.wild,
      ranked: !!options.ranked,
      rate: Arena.rate,
      broadcast: (event, data) => this.broadcast(event, data),
      // Straight through to the world room that started this fight.
      onEnd: (taken) => {
        Social.endCoop(this.roomId);
        try { this.opts.onEnd?.(taken); } catch (e) { console.error('[battle] onEnd', e); }
      },
    });
    this.battle.onSync = () => {
      const sim = this.battle.sim;
      this.state.phase = this.battle.phase;
      this.state.captureTarget = sim.pendingThrow?.target || sim.pendingThrow?.targetId || '';
      this.state.captureUntil = sim.pendingThrow?.until || 0;
      this.state.captureChance = sim.pendingThrow?.chance || 0;
      syncCombatants(this.state, sim);
    };
    this.onMessage('*', (client, type, payload) => {
      const id = this.idBySession.get(client.sessionId);
      if (!id) return;
      try { this.battle.handle(id, String(type), payload || {}); }
      catch (err) { console.error('[battle]', type, err); client.send('error', { code: 'server_error' }); }
    });
    if (this.mode === 'pvp') this._wait = setTimeout(() => this.startPvp(true), PVP_WAIT_MS);
  }

  async onJoin(client, options = {}, auth) {
    const doc = await this.store.getDoc(auth?.sub);
    if (!doc) { client.send('error', { code: 'no_character' }); return client.leave(4000); }
    normalizeDoc(doc);
    this.docs.set(doc.id, doc);
    this.idBySession.set(client.sessionId, doc.id);
    const side = this.mode === 'pvp' ? (this.sides.b.includes(doc.id) ? 'b' : 'a') : 'a';
    // guild buffs in the field; a ranked fight is fought even (shared/endgame.js)
    this.battle.addPlayer(doc, side, (event, data) => client.send(event, data), { guildBonus: this.opts.ranked ? null : Guilds.buffsFor(doc) });
    Social.attach(doc, `battle:${this.roomId}`, { send: (e, d) => client.send(e, d), where: 'battle', zone: this.opts.zoneId || '' });
    if (this.mode === 'pve') this.battle.start();
    else this.startPvp(false);
  }

  /** A duel goes when everyone is here — or, after the wait, with whoever
   *  came, as long as both sides have someone. */
  startPvp(timeUp) {
    if (this.battle.started || this.battle.resolved) return;
    const here = new Set(this.docs.keys());
    const all = [...this.sides.a, ...this.sides.b];
    if (all.every((id) => here.has(id))) return this.battle.start();
    if (!timeUp) return;
    const a = this.sides.a.some((id) => here.has(id)), b = this.sides.b.some((id) => here.has(id));
    if (a && b) return this.battle.start();
    this.broadcast('battleEnd', { outcome: 'cancelled', won: false, xp: 0, gold: 0, items: [], events: [], questsDone: [], pvp: true });
    this.battle.resolved = true;
    this.disconnect();
  }

  async onLeave(client) {
    const id = this.idBySession.get(client.sessionId);
    this.idBySession.delete(client.sessionId);
    if (!id) return;
    this.battle.leave(id, 'gone');
    Social.detach(id, `battle:${this.roomId}`);
    const doc = this.docs.get(id);
    if (doc) await this.store.saveDoc(doc).catch(() => {});
  }

  async onDispose() {
    // `stop()` is the guarded exit: whatever has not resolved lets the wild
    // go. Nobody ever came (a phone that locked between the wild catching
    // them and the fight opening) ends the same way, so the wild it was made
    // for does not stay taken.
    clearTimeout(this._wait);
    this.battle.stop();
    for (const doc of this.docs.values()) await this.store.saveDoc(doc).catch(() => {});
  }
}
