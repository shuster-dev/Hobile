import { Room } from '@colyseus/core';
import { BattleState, syncCombatants } from '../state.js';
import { DungeonSim } from '../game/base.js';
import { normalizeDoc } from '../game/combat.js';
import { DUNGEONS } from '../../shared/gamedata.js';
import { verifyToken } from '../auth.js';

/** A dungeon run. Same shape as BattleRoom; a party of up to four shares it. */
export class DungeonRoom extends Room {
  // Instance onAuth, not the static one: this client sends its token in the
  // join options (see client/net.js), not as an Authorization header.
  onAuth(client, options = {}) {
    const claims = verifyToken(options.token);
    if (!claims) throw new Error('unauthorized');
    return claims;
  }

  onCreate(options = {}) {
    this.store = options.store;
    this.def = DUNGEONS[options.def?.id] || options.def;
    this.maxClients = 4;
    this.autoDispose = true;
    this.setState(new BattleState());
    this.state.mode = 'dungeon';
    this.state.phase = 'waiting';
    this.state.dungeon = this.def?.id || '';
    this.state.floors = this.def?.floors || 1;
    this.onMessage('*', (client, type, payload) => {
      if (!this.sim) return;
      try { this.sim.handle(String(type), payload || {}); }
      catch (err) { console.error('[dungeon]', type, err); client.send('error', { code: 'server_error' }); }
    });
  }

  async onJoin(client, options = {}, auth) {
    const doc = await this.store.getDoc(auth?.sub);
    if (!doc) { client.send('error', { code: 'no_character' }); return client.leave(4000); }
    normalizeDoc(doc);
    this.doc = doc;
    const net = {
      doc, guilds: [], pendingRooms: new Map(),
      emit: (event, data) => this.broadcast(event, data),
      save: () => { this.dirty = true; },
    };
    this.sim = new DungeonSim(net, { def: this.def, allies: [] });
    const sync = this.sim.sync.bind(this.sim);
    this.sim.sync = () => {
      sync();
      this.state.phase = this.sim.state.phase;
      this.state.floor = this.sim.state.floor || 1;
      syncCombatants(this.state, this.sim.sim);
    };
    this.sim.start();
  }

  async onLeave() {
    this.sim?.stop();
    if (this.doc) await this.store.saveDoc(this.doc).catch(() => {});
  }

  async onDispose() {
    this.sim?.stop();
    if (this.doc) await this.store.saveDoc(this.doc).catch(() => {});
  }
}
