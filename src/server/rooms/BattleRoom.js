import { Room } from '@colyseus/core';
import { BattleState, syncCombatants } from '../state.js';
import { BattleSim } from '../game/base.js';
import { normalizeDoc } from '../game/combat.js';
import { verifyToken } from '../auth.js';

/**
 * One wild encounter, one player.
 *
 * The fight itself is BattleSim — the same object the single-player build
 * runs — driven through a small adapter that looks like the offline store.
 * The room's only extra job is mirroring the simulation into schema state and
 * writing the player document back when the fight ends.
 */
export class BattleRoom extends Room {
  // Instance onAuth, not the static one: this client sends its token in the
  // join options (see client/net.js), not as an Authorization header.
  onAuth(client, options = {}) {
    const claims = verifyToken(options.token);
    if (!claims) throw new Error('unauthorized');
    return claims;
  }

  onCreate(options = {}) {
    this.store = options.store;
    this.opts = options;
    this.maxClients = 1;
    this.autoDispose = true;
    this.setState(new BattleState());
    this.state.mode = 'pve';
    this.state.phase = 'waiting';
    this.state.zone = options.zoneId || '';
    this.onMessage('*', (client, type, payload) => {
      if (!this.sim) return;
      try { this.sim.handle(String(type), payload || {}); }
      catch (err) { console.error('[battle]', type, err); client.send('error', { code: 'server_error' }); }
    });
  }

  async onJoin(client, options = {}, auth) {
    const doc = await this.store.getDoc(auth?.sub);
    if (!doc) { client.send('error', { code: 'no_character' }); return client.leave(4000); }
    normalizeDoc(doc);
    this.doc = doc;
    this.client = client;

    const net = {
      doc,
      guilds: [],
      pendingRooms: new Map(),
      emit: (event, data) => client.send(event, data),
      save: () => { this.dirty = true; },
    };
    this.sim = new BattleSim(net, {
      zoneId: this.opts.zoneId,
      wild: this.opts.wild,
      // Straight through to the world room that started this fight.
      onEnd: (captured) => { try { this.opts.onEnd?.(captured); } catch (e) { console.error('[battle] onEnd', e); } },
    });
    // BattleSim mirrors into a plain-object state; mirror that same simulation
    // into schema so the client's room.state reads identically online.
    const sync = this.sim.sync.bind(this.sim);
    this.sim.sync = () => {
      sync();
      this.state.phase = this.sim.state.phase;
      this.state.captureTarget = this.sim.sim.pendingThrow?.target || '';
      this.state.captureUntil = this.sim.sim.pendingThrow?.until || 0;
      this.state.captureChance = this.sim.sim.pendingThrow?.chance || 0;
      syncCombatants(this.state, this.sim.sim);
    };
    this.sim.start();
  }

  // `stop()` is the guarded exit: it calls the simulation's `finish(false)` if
  // nothing else has, so walking out of a fight releases the creature instead
  // of leaving it locked.
  async onLeave() {
    this.sim?.stop();
    if (this.doc) await this.store.saveDoc(this.doc).catch(() => {});
  }

  async onDispose() {
    this.sim?.stop();
    if (this.doc) await this.store.saveDoc(this.doc).catch(() => {});
  }
}
