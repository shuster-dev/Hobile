// What a trainer can wear that is not their kind's: a hat, and a dye for the
// kind's main cloth. Bought with gold at the tailor (or earned on the season's
// track, `pass`), owned for good, worn or taken off at will. None of it does
// anything in a fight — it is how you look, nothing more.
//
// Pure: the server sells and checks by it (server/game/cosmetics.js), the
// figure is built by it (client/gfx/people.js wearHat/dyeDesign), the shop
// panel lists it.

/** Hats. `shape` is how it is built (people.js HAT_SHAPES); `color` its cloth. */
export const HATS = {
  cap_red: { he: 'מצחייה אדומה', shape: 'cap', color: 0xdc4436, price: 1200 },
  cap_blue: { he: 'מצחייה כחולה', shape: 'cap', color: 0x2f6ad8, price: 1200 },
  bandana: { he: 'בנדנה', shape: 'bandana', color: 0x2a9a6a, price: 900 },
  beanie: { he: 'כובע גרב', shape: 'beanie', color: 0xe8b23a, price: 1500 },
  flowers: { he: 'זר פרחים', shape: 'flowers', color: 0x5bc76a, price: 2400 },
  cowboy: { he: 'כובע בוקרים', shape: 'cowboy', color: 0x8a5a2e, price: 3200 },
  catears: { he: 'אוזני חתול', shape: 'catears', color: 0x3a3036, price: 3000 },
  wizard: { he: 'כובע מכשף', shape: 'wizard', color: 0x6a3ac8, price: 4200 },
  tophat: { he: 'מגבעת', shape: 'tophat', color: 0x23232c, price: 5500 },
  crown: { he: 'כתר', shape: 'crown', color: 0xf2c14e, price: 25000 },
  // from the season's track only (shared/pass.js)
  halo: { he: 'הילה', shape: 'halo', color: 0xffe07a, pass: true },
  horns: { he: 'קרני אש', shape: 'horns', color: 0x2a1a1a, pass: true },
  riftcrown: { he: 'כתר הקרע', shape: 'crown', color: 0x2fe6d0, pass: true },
};

/** Dyes for the kind's main cloth. */
export const DYES = {
  crimson: { he: 'ארגמן', color: 0xb8283c, price: 700 },
  ocean: { he: 'אוקיינוס', color: 0x2a62c8, price: 700 },
  forest: { he: 'יער', color: 0x2e7a3a, price: 700 },
  sunflower: { he: 'חמנייה', color: 0xe8b23a, price: 900 },
  violet: { he: 'סגול', color: 0x7a4ad8, price: 900 },
  rose: { he: 'ורוד', color: 0xe86a9a, price: 900 },
  teal: { he: 'טורקיז', color: 0x1aa898, price: 900 },
  snow: { he: 'שלג', color: 0xe8ecf2, price: 1400 },
  night: { he: 'לילה', color: 0x262a3a, price: 1400 },
  // from the season's track only
  gold: { he: 'זהב', color: 0xd8a830, pass: true },
  rift: { he: 'אור הקרע', color: 0x2fc8b8, pass: true },
};

export const SLOTS = { hat: HATS, dye: DYES };

/** A cosmetic by id: { id, slot, ...def }, or null. */
export function cosmeticById(id) {
  for (const [slot, table] of Object.entries(SLOTS)) if (Object.prototype.hasOwnProperty.call(table, id)) return { id, slot, ...table[id] };
  return null;
}

/** The player's wardrobe, made whole. */
export function wardrobeOf(doc) {
  const w = doc && typeof doc.cosmetics === 'object' && doc.cosmetics ? doc.cosmetics : {};
  const owned = Array.isArray(w.owned) ? w.owned.filter((id) => cosmeticById(id)) : [];
  const worn = (slot) => (owned.includes(w[slot]) && cosmeticById(w[slot])?.slot === slot ? w[slot] : null);
  return { owned, hat: worn('hat'), dye: worn('dye') };
}

/** How the player looks, with what they wear: the appearance others are sent. */
export function wornLook(doc) {
  const w = wardrobeOf(doc);
  return { ...(doc?.appearance || {}), hat: w.hat, dye: w.dye };
}

export const HAT_IDS = Object.keys(HATS);
export const DYE_IDS = Object.keys(DYES);
