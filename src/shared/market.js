// The counters: what each one sells, what it pays for what you bring back,
// and what a wild beaten in the open (server/game/field-fight.js) leaves
// behind now and then.
//
// Pure: the server prices and rolls by it, the shop panel lists by it.
import { ITEMS } from './gamedata.js';

/** A counter pays this much of what a thing costs. */
export const SELL_RATE = 0.4;

/** What a counter pays for one, or 0 when nobody buys it. */
export function sellPrice(it) {
  if (!it) return 0;
  const base = it.price || it.value || (it.kind === 'material' ? (it.tier === 'crystal' ? 100 : it.tier === 'shard' ? 16 : 12) : 0);
  return base ? Math.max(1, Math.floor(base * SELL_RATE)) : 0;
}

/**
 * Which counter sells what: the clinic potions, spheres and revives (it is
 * the camp's shop), the smith what a trainer wears, the town's market all
 * of it, materials too.
 */
export const COUNTERS = {
  clinic: { he: 'מרפאה וחנות', kinds: ['sphere', 'heal', 'revive', 'stamina', 'trainerHeal'] },
  smith: { he: 'הנפח', kinds: ['gear'] },
  shop: { he: 'השוק', kinds: ['sphere', 'heal', 'revive', 'stamina', 'trainerHeal', 'gear', 'material'] },
};

/** The items a counter sells, cheapest first within each kind. */
export function catalog(counter = 'shop') {
  const c = COUNTERS[counter] || COUNTERS.shop;
  return Object.values(ITEMS).filter((it) => it.price > 0 && c.kinds.includes(it.kind))
    .sort((a, b) => c.kinds.indexOf(a.kind) - c.kinds.indexOf(b.kind) || a.price - b.price);
}

/**
 * Per wild beaten in the open. A zone keeps a few dozen out at a time, so
 * over a round of one: a potion every six or so, a sphere every eight, a
 * revive now and then, and a piece of gear about one in seventy — one in
 * four of those a kind no counter sells. Better ones as the trainer grows.
 */
export const FIELD_LOOT = { potion: 0.16, sphere: 0.12, revive: 0.02, gear: 0.014, rareShare: 0.25 };

export function fieldLoot(level = 1, rnd = Math.random) {
  const out = [];
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  if (rnd() < FIELD_LOOT.potion) out.push(level < 20 ? 'potion_s' : level < 40 ? 'potion_m' : rnd() < 0.5 ? 'potion_l' : 'potion_m');
  if (rnd() < FIELD_LOOT.sphere) out.push(level < 15 ? 'sphere_basic' : level < 35 ? (rnd() < 0.7 ? 'sphere_basic' : 'sphere_great') : rnd() < 0.25 ? 'sphere_ultra' : 'sphere_great');
  if (rnd() < FIELD_LOOT.revive) out.push('revive');
  if (rnd() < FIELD_LOOT.gear) {
    const rare = Object.values(ITEMS).filter((it) => it.kind === 'gear' && it.rare).map((it) => it.id);
    const sold = Object.values(ITEMS).filter((it) => it.kind === 'gear' && it.price).map((it) => it.id);
    out.push(rnd() < FIELD_LOOT.rareShare && rare.length ? pick(rare) : pick(sold));
  }
  return out.filter((id) => ITEMS[id]);
}
