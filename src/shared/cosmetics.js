// What a trainer can wear that is not their kind's: a hat, glasses, something
// on the back or round the neck, and a dye for the kind's main cloth. Bought with gold at the tailor (or earned on the season's
// track, `pass`), owned for good, worn or taken off at will. And, as in the
// old side-scrollers, what you wear is not only how you look: each hat,
// glasses and pack adds a little to the trainer and their team in a fight
// (`bonus`, summed with the gear by combat.js sumStats). Dyes are colour only.
// Some are not sold until a milestone is reached (`unlock`,
// shared/milestones.js), and some only given for one (`reward`).
//
// Pure: the server sells and checks by it (server/game/cosmetics.js), the
// figure is built by it (client/gfx/wardrobe3d.js on the models, people.js
// HAT_SHAPES/dyeDesign on the code-sculpted figure), the shop panel lists it.

/** Hats. `shape` is how it is built (wardrobe3d.js); `color` its cloth. */
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
  trainer_red: { he: 'כובע מאמן', shape: 'trainer', color: 0xdc4436, price: 1800 },
  trainer_blue: { he: 'כובע מאמן כחול', shape: 'trainer', color: 0x2f6ad8, price: 1800 },
  sphere_beanie: { he: 'כובע כדור לכידה', shape: 'sphere', color: 0xdc4436, price: 2600 },
  headphones: { he: 'אוזניות', shape: 'headphones', color: 0x2fb27a, price: 2200 },
  straw: { he: 'כובע קש', shape: 'straw', color: 0xe8c878, price: 1600 },
  // from the season's track only (shared/pass.js)
  halo: { he: 'הילה', shape: 'halo', color: 0xffe07a, pass: true },
  horns: { he: 'קרני אש', shape: 'horns', color: 0x2a1a1a, pass: true },
  riftcrown: { he: 'כתר הקרע', shape: 'crown', color: 0x2fe6d0, pass: true },
};

/** Glasses and the like. */
export const FACES = {
  glasses: { he: 'משקפיים עגולים', shape: 'round', color: 0x3a3036, price: 1100 },
  shades: { he: 'משקפי שמש', shape: 'shades', color: 0x1a1a22, price: 1600 },
  star_shades: { he: 'משקפי כוכב', shape: 'star', color: 0xff6aa8, price: 2400 },
  goggles: { he: 'משקפי מגן', shape: 'goggles', color: 0xc8843a, price: 2000 },
};

/** On the back, or round the neck. */
export const BACKS = {
  backpack: { he: 'תיק גב', shape: 'backpack', color: 0xe8b23a, price: 1800 },
  backpack_blue: { he: 'תיק גב כחול', shape: 'backpack', color: 0x2f6ad8, price: 1800 },
  sphere_pack: { he: 'תיק כדור לכידה', shape: 'sphere', color: 0xdc4436, price: 3200 },
  scarf: { he: 'צעיף', shape: 'scarf', color: 0xdc4436, price: 1200, keepsCape: true },
  wings: { he: 'כנפי מלאך', shape: 'wings', color: 0xf4f6ff, price: 9000 },
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

/** What each one adds in a fight. Small: a whole outfit is about one piece
 *  of the smith's gear. */
const BONUS = {
  cap_red: { atk: 2 }, cap_blue: { def: 2 }, bandana: { spe: 3 }, beanie: { hp: 10 },
  flowers: { spd: 3, hp: 6 }, cowboy: { atk: 4, spe: 2 }, catears: { spe: 5, atk: 2 },
  wizard: { spa: 6 }, tophat: { spd: 4, def: 3 }, crown: { atk: 6, def: 6, spa: 6, spd: 6, hp: 30 },
  trainer_red: { atk: 3 }, trainer_blue: { def: 3 }, sphere_beanie: { hp: 15 }, headphones: { spa: 3 },
  straw: { hp: 8, spe: 2 }, halo: { spd: 6, hp: 20 }, horns: { atk: 7 }, riftcrown: { atk: 5, spa: 7 },
  glasses: { spa: 3 }, shades: { spe: 3 }, star_shades: { spa: 4, spe: 2 }, goggles: { def: 4 },
  backpack: { hp: 12 }, backpack_blue: { def: 3, hp: 8 }, sphere_pack: { hp: 20 }, scarf: { spd: 3 },
  wings: { spe: 8, spd: 4, hp: 15 },
};
for (const t of [HATS, FACES, BACKS]) for (const [id, c] of Object.entries(t)) if (BONUS[id]) c.bonus = BONUS[id];
// reached, then sold (shared/milestones.js)
HATS.crown.unlock = 'level_25';
BACKS.wings.unlock = 'dungeon_mythic';
HATS.wizard.unlock = 'dungeon_normal';

export const SLOTS = { hat: HATS, face: FACES, back: BACKS, dye: DYES };

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
  return { owned, hat: worn('hat'), face: worn('face'), back: worn('back'), dye: worn('dye') };
}

/** How the player looks, with what they wear: the appearance others are sent. */
export function wornLook(doc) {
  const w = wardrobeOf(doc);
  return { ...(doc?.appearance || {}), hat: w.hat, face: w.face, back: w.back, dye: w.dye };
}

/** What the worn ones add, summed. */
export function wornBonus(doc) {
  const w = wardrobeOf(doc), out = {};
  for (const slot of ['hat', 'face', 'back']) {
    const b = w[slot] && SLOTS[slot][w[slot]]?.bonus;
    if (b) for (const [k, v] of Object.entries(b)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

export const HAT_IDS = Object.keys(HATS);
export const DYE_IDS = Object.keys(DYES);
export const FACE_IDS = Object.keys(FACES);
export const BACK_IDS = Object.keys(BACKS);
