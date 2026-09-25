// Colyseus room state.
//
// schema v3 does not create collections for you: every MapSchema/ArraySchema
// field must be assigned an instance in the constructor, or the first write
// throws. That cost an afternoon once; the constructors below are the fix.
import { Schema, MapSchema, ArraySchema, defineTypes } from '@colyseus/schema';

export class PlayerState extends Schema {}
defineTypes(PlayerState, {
  id: 'string', name: 'string', level: 'number',
  x: 'number', y: 'number', z: 'number', rot: 'number',
  moving: 'boolean', status: 'string',
  guildTag: 'string', partyId: 'string',
  petSpecies: 'string', hpRatio: 'number',
  body: 'string', skin: 'string', hair: 'string', outfit: 'string',
});

// `alert` is what shows over its head — '!' it has seen someone and is coming,
// '?' it lost them, '~' it is running away — and `target` is the player id it
// is coming for, so that player's screen can say so. (server/game/field.js)
export class WildState extends Schema {}
defineTypes(WildState, {
  id: 'string', species: 'string', level: 'number',
  x: 'number', z: 'number', rot: 'number', engagedBy: 'string',
  alert: 'string', target: 'string',
});

export class BossContributor extends Schema {}
defineTypes(BossContributor, { id: 'string', name: 'string', damage: 'number' });

export class BossState extends Schema {
  constructor() {
    super();
    this.top = new ArraySchema();
  }
}
defineTypes(BossState, {
  active: 'boolean', species: 'string', level: 'number',
  x: 'number', z: 'number', hp: 'number', maxHp: 'number',
  endsAt: 'number', nextSpawnAt: 'number',
  top: [BossContributor],
});

export class WorldState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.wilds = new MapSchema();
    this.boss = new BossState();
  }
}
defineTypes(WorldState, {
  zone: 'string', serverTime: 'number',
  players: { map: PlayerState }, wilds: { map: WildState }, boss: BossState,
});

export class EffectState extends Schema {}
defineTypes(EffectState, { kind: 'string', until: 'number' });

export class CombatantState extends Schema {
  constructor() {
    super();
    this.skills = new ArraySchema();
    this.effects = new ArraySchema();
  }
}
defineTypes(CombatantState, {
  id: 'string', side: 'string', kind: 'string', name: 'string',
  species: 'string', level: 'number', hp: 'number', maxHp: 'number',
  stamina: 'number', ownerId: 'string',
  benched: 'boolean', slot: 'number', frozenUntil: 'number',
  skills: ['string'], effects: [EffectState],
});

export class BattleState extends Schema {
  constructor() {
    super();
    this.combatants = new MapSchema();
  }
}
defineTypes(BattleState, {
  phase: 'string', mode: 'string', zone: 'string',
  captureTarget: 'string', captureUntil: 'number', captureChance: 'number',
  floor: 'number', floors: 'number', dungeon: 'string',
  combatants: { map: CombatantState },
});

/**
 * Mirror the pure simulation's combatants into schema state.
 *
 * The plain-object version in server/game/base.js is what the single-player
 * build uses; this one does the same job against MapSchema, reusing existing
 * CombatantState instances so Colyseus sends field deltas instead of
 * re-encoding every combatant each tick.
 */
export function syncCombatants(state, sim) {
  const seen = new Set();
  for (const c of sim.combatants.values()) {
    seen.add(c.id);
    let s = state.combatants.get(c.id);
    if (!s) { s = new CombatantState(); state.combatants.set(c.id, s); }
    s.id = c.id;
    s.side = c.side;
    s.kind = c.kind === 'ally' ? 'player' : c.kind;
    s.name = c.name;
    s.species = c.species || '';
    s.level = c.level;
    s.hp = Math.max(0, Math.round(c.hp));
    s.maxHp = c.maxHp;
    s.stamina = Math.round(c.stamina);
    s.ownerId = c.ownerId || '';
    s.benched = !!c.benched;
    s.slot = Number.isFinite(c.slot) ? c.slot : 0;
    s.frozenUntil = c.frozenUntil || 0;
    // ArraySchema#splice cannot insert more than it deletes, so these are
    // cleared and refilled rather than spliced in place.
    if (s.skills.length !== c.skills.length || s.skills.some((v, i) => v !== c.skills[i])) {
      s.skills.clear();
      for (const skill of c.skills) s.skills.push(skill);
    }
    s.effects.clear();
    for (const e of c.effects) {
      const es = new EffectState();
      es.kind = e.kind; es.until = e.until;
      s.effects.push(es);
    }
  }
  for (const id of [...state.combatants.keys()]) if (!seen.has(id)) state.combatants.delete(id);
}
