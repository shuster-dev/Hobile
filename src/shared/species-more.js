// The second wave of creatures: seventy more, seven to an element, so the
// collection runs past a hundred and twenty and every element — the wind and
// the metal especially, which had two apiece — has lines of its own to follow.
// And thirty moves, three more to an element, so they do not all fight alike.
//
// Pure data, merged into SPECIES and MOVES by shared/gamedata.js (which this
// file must not import). The figurines are client/gfx/figurine-designs-more.js;
// where each one lives is in the zones' spawn rows.

// ---------------------------------------------------------------- moves
export const MORE_MOVES = {
  flarepounce: { name: 'Flare Pounce', he: 'זינוק להבה', type: 'ember', kind: 'physical', power: 58, acc: 0.95, cd: 2800, cost: 10, effect: { burn: 0.08, dur: 4000 } },
  heatwave: { name: 'Heat Wave', he: 'גל חום', type: 'ember', kind: 'special', power: 76, acc: 0.9, cd: 6500, cost: 18, aoe: true },
  kindle: { name: 'Kindle', he: 'הצתה', type: 'ember', kind: 'status', power: 0, acc: 1, cd: 11000, cost: 9, effect: { atkUp: 0.3, hasteUp: 0.15, dur: 7000 } },
  aquajet: { name: 'Aqua Jet', he: 'סילון', type: 'aqua', kind: 'physical', power: 50, acc: 1, cd: 2000, cost: 8 },
  riptide: { name: 'Riptide', he: 'זרם סוחף', type: 'aqua', kind: 'special', power: 80, acc: 0.9, cd: 6800, cost: 19, effect: { slow: 0.35, dur: 4000 } },
  mistveil: { name: 'Mist Veil', he: 'מעטה ערפל', type: 'aqua', kind: 'status', power: 0, acc: 1, cd: 12000, cost: 10, effect: { shield: 0.4, heal: 0.12, dur: 5000 } },
  seedvolley: { name: 'Seed Volley', he: 'מטח זרעים', type: 'verdant', kind: 'special', power: 52, acc: 0.95, cd: 2600, cost: 9 },
  rootsnare: { name: 'Root Snare', he: 'מלכודת שורשים', type: 'verdant', kind: 'physical', power: 64, acc: 0.92, cd: 4600, cost: 14, effect: { slow: 0.4, dur: 4000 } },
  photosynth: { name: 'Photosynth', he: 'פוטוסינתזה', type: 'verdant', kind: 'status', power: 0, acc: 1, cd: 10000, cost: 12, effect: { heal: 0.3, dur: 1000 } },
  staticfield: { name: 'Static Field', he: 'שדה סטטי', type: 'volt', kind: 'special', power: 54, acc: 0.95, cd: 3000, cost: 11, effect: { stun: 0.22, dur: 1100 } },
  voltcharge: { name: 'Volt Charge', he: 'טעינה', type: 'volt', kind: 'status', power: 0, acc: 1, cd: 11000, cost: 9, effect: { atkUp: 0.45, dur: 6000 } },
  railgun: { name: 'Railgun', he: 'תותח מסילה', type: 'volt', kind: 'special', power: 108, acc: 0.8, cd: 12000, cost: 28 },
  mudshot: { name: 'Mud Shot', he: 'יריית בוץ', type: 'terra', kind: 'special', power: 48, acc: 1, cd: 2200, cost: 8, effect: { slow: 0.2, dur: 3000 } },
  landslide: { name: 'Landslide', he: 'מפולת', type: 'terra', kind: 'physical', power: 94, acc: 0.85, cd: 9800, cost: 25, aoe: true },
  sandcloak: { name: 'Sand Cloak', he: 'גלימת חול', type: 'terra', kind: 'status', power: 0, acc: 1, cd: 12000, cost: 10, effect: { shield: 0.45, dur: 6000 } },
  aerodive: { name: 'Aero Dive', he: 'צלילה', type: 'gale', kind: 'physical', power: 74, acc: 0.92, cd: 4400, cost: 15 },
  squall: { name: 'Squall', he: 'סערת משבים', type: 'gale', kind: 'special', power: 60, acc: 0.95, cd: 5200, cost: 15, aoe: true },
  featherguard: { name: 'Feather Guard', he: 'מגן נוצות', type: 'gale', kind: 'status', power: 0, acc: 1, cd: 11000, cost: 9, effect: { defUp: 0.4, hasteUp: 0.15, dur: 8000 } },
  hailstorm: { name: 'Hailstorm', he: 'סופת ברד', type: 'frost', kind: 'special', power: 74, acc: 0.9, cd: 7000, cost: 18, aoe: true, effect: { slow: 0.25, dur: 3500 } },
  frostfang: { name: 'Frost Fang', he: 'ניב קרח', type: 'frost', kind: 'physical', power: 56, acc: 0.95, cd: 2700, cost: 10, effect: { slow: 0.3, dur: 3000 } },
  snowcloak: { name: 'Snow Cloak', he: 'גלימת שלג', type: 'frost', kind: 'status', power: 0, acc: 1, cd: 12000, cost: 10, effect: { shield: 0.35, defUp: 0.25, dur: 7000 } },
  hexbite: { name: 'Hex Bite', he: 'נשיכת כישוף', type: 'umbra', kind: 'physical', power: 58, acc: 0.95, cd: 2800, cost: 10, effect: { poison: 0.08, dur: 6000 } },
  shadestep: { name: 'Shade Step', he: 'צעד צל', type: 'umbra', kind: 'status', power: 0, acc: 1, cd: 11000, cost: 8, effect: { hasteUp: 0.4, dur: 7000 } },
  nightmare: { name: 'Nightmare', he: 'סיוט', type: 'umbra', kind: 'special', power: 82, acc: 0.88, cd: 7600, cost: 20, effect: { lifesteal: 0.25, defDown: 0.2, dur: 5000 } },
  prismbeam: { name: 'Prism Beam', he: 'קרן פריזמה', type: 'lumen', kind: 'special', power: 62, acc: 0.95, cd: 3600, cost: 13 },
  dazzle: { name: 'Dazzle', he: 'סנוור', type: 'lumen', kind: 'special', power: 36, acc: 1, cd: 5000, cost: 10, effect: { stun: 0.4, dur: 1200 } },
  radiance: { name: 'Radiance', he: 'זוהר', type: 'lumen', kind: 'status', power: 0, acc: 1, cd: 13000, cost: 14, effect: { atkUp: 0.2, defUp: 0.2, dur: 8000, party: true } },
  steelslam: { name: 'Steel Slam', he: 'הטחת פלדה', type: 'metal', kind: 'physical', power: 60, acc: 0.95, cd: 3000, cost: 11 },
  magnetpulse: { name: 'Magnet Pulse', he: 'פולס מגנטי', type: 'metal', kind: 'special', power: 70, acc: 0.92, cd: 5200, cost: 16, effect: { stun: 0.15, dur: 1000 } },
  overclock: { name: 'Overclock', he: 'האצת יתר', type: 'metal', kind: 'status', power: 0, acc: 1, cd: 12000, cost: 10, effect: { hasteUp: 0.3, atkUp: 0.2, dur: 7000 } },
};
for (const [id, m] of Object.entries(MORE_MOVES)) m.id = id;

// The moves of each element, weakest first, for learnsets.
const MOVE_LINE = {
  ember: ['emberjab', 'flarepounce', 'cinderburst', 'kindle', 'heatwave', 'magmawave'],
  aqua: ['bubblelash', 'aquajet', 'tidecrash', 'mistveil', 'riptide', 'maelstrom'],
  verdant: ['vinewhip', 'seedvolley', 'leechbloom', 'photosynth', 'rootsnare', 'thornstorm'],
  volt: ['sparkbite', 'staticfield', 'arcbolt', 'voltcharge', 'thunderdome', 'railgun'],
  terra: ['rockfling', 'mudshot', 'quakestep', 'sandcloak', 'bulwark', 'landslide'],
  gale: ['gustcut', 'cyclonelift', 'featherguard', 'aerodive', 'squall', 'tailwind'],
  frost: ['frostnip', 'frostfang', 'icelance', 'snowcloak', 'hailstorm', 'glacierfall'],
  umbra: ['shadowclaw', 'hexbite', 'duskbind', 'shadestep', 'nightmare', 'voidpulse'],
  lumen: ['glintray', 'dazzle', 'prismbeam', 'mendinglight', 'radiance', 'solarlance'],
  metal: ['ironfang', 'steelslam', 'gearcrush', 'overclock', 'magnetpulse', 'alloyaegis'],
};

/** A learnset from the elements and where in a line the creature stands:
 *  `from` is the level it is met at (or evolves at). */
function learnFor(types, from = 1, seed = 0) {
  const [t0, t1] = types;
  const a = MOVE_LINE[t0], b = t1 ? MOVE_LINE[t1] : null;
  const pick = (arr, i) => arr[(i + seed) % arr.length];
  const L = [];
  if (from <= 5) L.push([1, 'tackle']);
  L.push([1, a[0]]);
  if (b) L.push([from <= 5 ? 6 : 1, b[0]]);
  const at = (x) => Math.max(from <= 5 ? x : Math.min(x, from), 1);
  L.push([at(8), a[1]], [at(13), seed % 2 ? 'focus' : 'guard'], [at(17), a[2]]);
  if (b) L.push([at(22), b[1 + (seed % 2)]]);
  L.push([at(25), a[3]], [Math.max(from + 4, 30), a[4]], [Math.max(from + 10, 38), a[5]]);
  if (b) L.push([Math.max(from + 14, 44), pick(b.slice(3), 0)]);
  const seen = new Set();
  return L.filter(([, m]) => !seen.has(m) && seen.add(m)).sort((x, y) => x[0] - y[0]);
}

// ---------------------------------------------------------------- stats
const BUDGET = { common: 312, evolved: 452, final: 530, rare: 476, legendary: 596 };
const ROLES = {
  phys:  { hp: 1, atk: 1.35, def: 0.95, spa: 0.75, spd: 0.85, spe: 1.1 },
  spec:  { hp: 0.95, atk: 0.75, def: 0.85, spa: 1.4, spd: 1.05, spe: 1.0 },
  tank:  { hp: 1.3, atk: 0.95, def: 1.35, spa: 0.75, spd: 1.1, spe: 0.55 },
  fast:  { hp: 0.85, atk: 1.1, def: 0.8, spa: 1.0, spd: 0.85, spe: 1.4 },
  even:  { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 },
};
function statsFor(rarity, role, seed) {
  const w = ROLES[role] || ROLES.even, sum = Object.values(w).reduce((s, v) => s + v, 0), B = BUDGET[rarity] || 312;
  const out = {};
  let k = 0;
  for (const [stat, v] of Object.entries(w)) {
    const wobble = 1 + (((seed * 7 + k * 13) % 9) - 4) * 0.012;
    out[stat] = Math.round(B * v / sum * wobble);
    k++;
  }
  return out;
}

// ---------------------------------------------------------------- species
// [id, Name, he, types, rarity, role, shape, a, b, eyes, evolve?]
const ROWS = [
  // ember
  ['kindlepup', 'Kindlepup', 'קינדלפאפ', ['ember'], 'common', 'phys', 'quad', 0xF0783A, 0xFFE2B8, 0x3A1A0A, { into: 'blazehound', level: 20 }],
  ['blazehound', 'Blazehound', 'בלייזהאונד', ['ember'], 'evolved', 'phys', 'quad', 0xD9481E, 0xFFD39A, 0xFFC43A],
  ['cindermoth', 'Cindermoth', 'סינדרמות׳', ['ember', 'gale'], 'common', 'spec', 'insect', 0x8A5A48, 0xFFB45A, 0xFFE07A, { into: 'pyrewing', level: 22 }],
  ['pyrewing', 'Pyrewing', 'פיירווינג', ['ember', 'gale'], 'evolved', 'fast', 'avian', 0xE8502A, 0xFFD27A, 0x2A1008],
  ['magmole', 'Magmole', 'מגמול', ['ember', 'terra'], 'common', 'tank', 'quad', 0x6A4A40, 0xFF8A3A, 0x1A0A06, { into: 'calderox', level: 26 }],
  ['calderox', 'Calderox', 'קלדרוקס', ['ember', 'terra'], 'evolved', 'tank', 'quad', 0x4E3C36, 0xFF6A1F, 0xFFB43A],
  ['ignivar', 'Ignivar', 'איגניבר', ['ember', 'lumen'], 'legendary', 'spec', 'avian', 0xFFC43A, 0xE8301A, 0xFFF2C0],
  // aqua
  ['ripplet', 'Ripplet', 'ריפלט', ['aqua'], 'common', 'spec', 'blob', 0x5EC8F2, 0xD8F4FF, 0x123A5F, { into: 'torrentoad', level: 18 }],
  ['torrentoad', 'Torrentoad', 'טורנטוד', ['aqua', 'terra'], 'evolved', 'tank', 'quad', 0x2E8FB8, 0xBDEAD0, 0xFFD24A],
  ['koiren', 'Koiren', 'קוירן', ['aqua'], 'common', 'fast', 'serpent', 0xFF8A4A, 0xFFF2E6, 0x1A1A2A, { into: 'koimperor', level: 28 }],
  ['koimperor', 'Koimperor', 'קוימפרור', ['aqua', 'lumen'], 'evolved', 'spec', 'serpent', 0xFFB43A, 0xFFF6E0, 0x2A1A0A],
  ['bubbloon', 'Bubbloon', 'בבלון', ['aqua', 'gale'], 'common', 'spec', 'blob', 0x9ADCF8, 0xF0FAFF, 0x2A5A8A],
  ['coralisk', 'Coralisk', 'קורליסק', ['aqua', 'terra'], 'rare', 'tank', 'quad', 0xFF7A8A, 0xFFE2E0, 0x2A0A1A],
  ['abyssquid', 'Abyssquid', 'אביסקוויד', ['aqua', 'umbra'], 'rare', 'spec', 'blob', 0x2A2A6A, 0x6A5AC8, 0xC8F0FF],
  // verdant
  ['acornet', 'Acornet', 'אקורנט', ['verdant'], 'common', 'tank', 'blob', 0xB0783A, 0xF2D9A8, 0x2A1A0A, { into: 'oakling', level: 16 }],
  ['oakling', 'Oakling', 'אוקלינג', ['verdant'], 'evolved', 'tank', 'golem', 0x8A6A44, 0x7FCF6A, 0x2A1A0A, { into: 'grovenard', level: 34 }],
  ['grovenard', 'Grovenard', 'גרובנרד', ['verdant', 'terra'], 'final', 'tank', 'quad', 0x6A5236, 0x5BC76A, 0xFFD24A],
  ['petalfly', 'Petalfly', 'פטלפליי', ['verdant', 'gale'], 'common', 'fast', 'avian', 0xFF9CC8, 0xFFF0F6, 0x2A1A2A],
  ['mushlet', 'Mushlet', 'מאשלט', ['verdant', 'umbra'], 'common', 'spec', 'blob', 0x4A5ACF, 0xFFF0E0, 0x2A1A1A, { into: 'sporeking', level: 24 }],
  ['sporeking', 'Sporeking', 'ספורקינג', ['verdant', 'umbra'], 'evolved', 'spec', 'sprite', 0x2E3A9A, 0xE8E4F0, 0xFFD24A],
  ['lianake', 'Lianake', 'ליאנייק', ['verdant'], 'common', 'phys', 'serpent', 0x4FA858, 0xD8F2B0, 0x2A1A0A],
  // volt
  ['voltail', 'Voltail', 'וולטייל', ['volt'], 'common', 'fast', 'quad', 0x2EB8B0, 0xE8FFF8, 0x123A3A, { into: 'joltusk', level: 20 }],
  ['joltusk', 'Joltusk', 'ג׳ולטסק', ['volt'], 'evolved', 'phys', 'quad', 0x3A4458, 0x2EB8B0, 0x9AE8FF],
  ['fluxbug', 'Fluxbug', 'פלאקסבאג', ['volt', 'metal'], 'common', 'spec', 'insect', 0x5A6A8A, 0xFFE05A, 0xBDF4FF],
  ['stormkite', 'Stormkite', 'סטורמקייט', ['volt', 'gale'], 'common', 'fast', 'avian', 0x4A5AB8, 0xFFE05A, 0xFFF2A0, { into: 'tempestral', level: 28 }],
  ['tempestral', 'Tempestral', 'טמפסטרל', ['volt', 'gale'], 'evolved', 'fast', 'avian', 0x2E3A8A, 0xFFD23D, 0xFFF2A0],
  ['coilwyrm', 'Coilwyrm', 'קוילוורם', ['volt'], 'rare', 'spec', 'serpent', 0x3A4AA8, 0xFFE05A, 0xFFF6C0],
  ['plasmite', 'Plasmite', 'פלזמייט', ['volt', 'lumen'], 'common', 'spec', 'blob', 0xB88AFF, 0xF2E6FF, 0x3A1A6A],
  // terra
  ['dustmole', 'Dustmole', 'דאסטמול', ['terra'], 'common', 'phys', 'quad', 0xA8845E, 0xE8D2B0, 0x1A0A06, { into: 'tunnelord', level: 22 }],
  ['tunnelord', 'Tunnelord', 'טאנלורד', ['terra', 'metal'], 'evolved', 'phys', 'quad', 0x8A6A4A, 0xB8B8C0, 0xFFC43A],
  ['clayling', 'Clayling', 'קליילינג', ['terra'], 'common', 'tank', 'golem', 0xC87A5A, 0xF2C8A8, 0x2A1A0A, { into: 'terracolos', level: 26 }],
  ['terracolos', 'Terracolos', 'טרקולוס', ['terra'], 'evolved', 'tank', 'golem', 0xA85A3A, 0xE8B08A, 0xFFD24A],
  ['sandviper', 'Sandviper', 'סנדוויפר', ['terra'], 'common', 'fast', 'serpent', 0xE0C080, 0xFFF0D0, 0x2A1A0A],
  ['geodon', 'Geodon', 'ג׳יאודון', ['terra', 'metal'], 'rare', 'tank', 'quad', 0x7A7068, 0xB89AFF, 0xE8D8FF],
  ['amberix', 'Amberix', 'אמבריקס', ['terra', 'lumen'], 'rare', 'spec', 'quad', 0xE8A040, 0xFFE8A8, 0x3A1A06],
  // gale
  ['puffwing', 'Puffwing', 'פאפווינג', ['gale'], 'common', 'fast', 'avian', 0xBDE8F0, 0xFFFFFF, 0x1A2A3A, { into: 'galeon', level: 18 }],
  ['galeon', 'Galeon', 'גיילאון', ['gale'], 'evolved', 'fast', 'avian', 0x7AC8E0, 0xF2FAFF, 0x1A2A3A, { into: 'skyrender', level: 36 }],
  ['skyrender', 'Skyrender', 'סקייירנדר', ['gale', 'volt'], 'final', 'fast', 'avian', 0x3A8AC8, 0xE8F6FF, 0xFFE05A],
  ['dandefluff', 'Dandefluff', 'דנדפלאף', ['gale', 'verdant'], 'common', 'spec', 'blob', 0xFFF6C0, 0xFFFFFF, 0x3A3A1A],
  ['whirlweasel', 'Whirlweasel', 'וירלוויזל', ['gale'], 'common', 'phys', 'quad', 0xD8C8B0, 0xFFF8EE, 0x2A1A0A, { into: 'cyclonix', level: 24 }],
  ['cyclonix', 'Cyclonix', 'סייקלוניקס', ['gale'], 'evolved', 'phys', 'quad', 0x9AB8C8, 0xF2FAFF, 0x1A3A4A],
  ['cloudray', 'Cloudray', 'קלאודריי', ['gale', 'aqua'], 'rare', 'spec', 'serpent', 0xD8EEFF, 0xFFFFFF, 0x2A4A6A],
  // frost
  ['snowpip', 'Snowpip', 'סנופיפ', ['frost'], 'common', 'fast', 'avian', 0xF2F8FF, 0xBDE4FF, 0x1A2A3A],
  ['frostkit', 'Frostkit', 'פרוסטקיט', ['frost'], 'common', 'spec', 'quad', 0xD8F0FF, 0xFFFFFF, 0x2A5A8A, { into: 'glacivix', level: 24 }],
  ['glacivix', 'Glacivix', 'גלסיביקס', ['frost', 'lumen'], 'evolved', 'spec', 'quad', 0xB8E2FF, 0xFFFFFF, 0x6AA8FF],
  ['yetling', 'Yetling', 'יטלינג', ['frost'], 'common', 'phys', 'golem', 0xF2F6FF, 0x9AC8E8, 0x2A3A5A, { into: 'yetimaul', level: 30 }],
  ['yetimaul', 'Yetimaul', 'יטימול', ['frost', 'terra'], 'evolved', 'phys', 'golem', 0xE8F0FF, 0x7AA8D8, 0x3AC8FF],
  ['rimeserpent', 'Rimeserpent', 'ריימסרפנט', ['frost', 'aqua'], 'rare', 'spec', 'serpent', 0xA8DCFF, 0xF2FAFF, 0x2A5AAA],
  ['flurrimp', 'Flurrimp', 'פלארימפ', ['frost'], 'common', 'spec', 'blob', 0xFFFFFF, 0xC8E8FF, 0x2A4A8A],
  // umbra
  ['shadepup', 'Shadepup', 'שיידפאפ', ['umbra'], 'common', 'phys', 'quad', 0x4A3A6A, 0x8A7AB8, 0xFFD24A, { into: 'nightfang', level: 22 }],
  ['nightfang', 'Nightfang', 'נייטפאנג', ['umbra'], 'evolved', 'phys', 'quad', 0x2A2242, 0x6A4AA8, 0xFF5A8A],
  ['wisplet', 'Wisplet', 'ויספלט', ['umbra', 'lumen'], 'common', 'spec', 'blob', 0xC8B8FF, 0xF2EEFF, 0x3A2A6A, { into: 'phantomire', level: 28 }],
  ['phantomire', 'Phantomire', 'פנטומייר', ['umbra', 'lumen'], 'evolved', 'spec', 'sprite', 0x6A5AC8, 0xE8E0FF, 0xBDF4FF],
  ['gloomwing', 'Gloomwing', 'גלומווינג', ['umbra', 'gale'], 'common', 'fast', 'avian', 0x3A2A4A, 0x8A6AA8, 0xFF5A5A],
  ['creepvine', 'Creepvine', 'קריפוויין', ['umbra', 'verdant'], 'rare', 'phys', 'serpent', 0x3A4A2A, 0x9A5AC8, 0xE8FF5A],
  ['eclipsar', 'Eclipsar', 'אקליפסר', ['umbra', 'lumen'], 'legendary', 'even', 'quad', 0x1A1A2E, 0xFFE58A, 0xFFF2C0],
  // lumen
  ['lumibug', 'Lumibug', 'לומיבאג', ['lumen'], 'common', 'spec', 'insect', 0x4A6A3A, 0xFFF27A, 0x1A2A0A, { into: 'lanternix', level: 20 }],
  ['lanternix', 'Lanternix', 'לנטרניקס', ['lumen', 'gale'], 'evolved', 'spec', 'avian', 0x3A4A6A, 0xFFE07A, 0xFFF6C0],
  ['prismpup', 'Prismpup', 'פריזמפאפ', ['lumen', 'frost'], 'common', 'fast', 'quad', 0xF2EEFF, 0xC8E8FF, 0x6A4AC8, { into: 'prismane', level: 26 }],
  ['prismane', 'Prismane', 'פריזמיין', ['lumen', 'frost'], 'evolved', 'spec', 'quad', 0xE8E2FF, 0xFFFFFF, 0x9A6AFF],
  ['sunbloom', 'Sunbloom', 'סאנבלום', ['lumen', 'verdant'], 'common', 'spec', 'blob', 0xFFD23D, 0xFFF6C0, 0x3A2A0A],
  ['halowyrm', 'Halowyrm', 'הלווורם', ['lumen'], 'rare', 'spec', 'serpent', 0xFFF6E0, 0xFFE07A, 0x6AA8FF],
  ['astrafox', 'Astrafox', 'אסטרפוקס', ['lumen', 'umbra'], 'rare', 'fast', 'quad', 0x2A3A7A, 0xFFF2A0, 0xFFF6C0],
  // metal
  ['rivetling', 'Rivetling', 'ריבטלינג', ['metal'], 'common', 'tank', 'golem', 0xA8B0BC, 0xE8ECF2, 0x5ADCFF, { into: 'steamhulk', level: 24 }],
  ['steamhulk', 'Steamhulk', 'סטימהאלק', ['metal', 'ember'], 'evolved', 'tank', 'golem', 0x8A7A6A, 0xD8A84A, 0xFF8A3A],
  ['magnetick', 'Magnetick', 'מגנטיק', ['metal', 'volt'], 'common', 'spec', 'blob', 0xB8C0CC, 0xFF5A5A, 0x2A3A4A],
  ['chromeram', 'Chromeram', 'כרומרם', ['metal'], 'common', 'phys', 'quad', 0xC8D0DA, 0xF2F4F8, 0x2A3A4A, { into: 'titanox', level: 30 }],
  ['titanox', 'Titanox', 'טיטנוקס', ['metal', 'terra'], 'evolved', 'tank', 'quad', 0x7A8494, 0xD8DEE6, 0xFFB43A],
  ['scythewing', 'Scythewing', 'סייתווינג', ['metal', 'gale'], 'rare', 'phys', 'avian', 0x9AA4B4, 0xE8F0FF, 0xFF5A5A],
  ['clockwyrm', 'Clockwyrm', 'קלוקוורם', ['metal'], 'rare', 'tank', 'serpent', 0xC8A050, 0xF2E0B0, 0x2A1A0A],
];

/** Who evolves into whom: the level each is first met at. */
const FROM = {};
for (const r of ROWS) if (r[10]) FROM[r[10].into] = r[10].level;

const SCALE = { common: 0.8, evolved: 1, final: 1.15, rare: 1.05, legendary: 1.3 };

export const MORE_SPECIES = {};
ROWS.forEach((r, i) => {
  const [id, name, he, types, rarity, role, shape, a, b, eyes, evolve] = r;
  MORE_SPECIES[id] = {
    id, name, he, types, rarity,
    base: statsFor(rarity, role, i),
    learn: learnFor(types, FROM[id] || (rarity === 'rare' ? 14 : rarity === 'legendary' ? 30 : 1), i),
    ...(evolve ? { evolve: { ...evolve } } : {}),
    model: { shape, a, b, scale: SCALE[rarity] || 1, eyes },
    wave: 2,
  };
});

/** How the new ones behave in the field (shared/temper.js). */
export const MORE_TEMPER = {
  blazehound: 'fierce', calderox: 'fierce', joltusk: 'fierce', tunnelord: 'fierce', nightfang: 'fierce', yetimaul: 'fierce',
  titanox: 'fierce', terracolos: 'fierce', cyclonix: 'fierce', shadepup: 'nocturnal', gloomwing: 'nocturnal',
  coralisk: 'shy', abyssquid: 'shy', coilwyrm: 'shy', geodon: 'shy', amberix: 'shy', cloudray: 'shy', rimeserpent: 'shy',
  creepvine: 'shy', halowyrm: 'shy', astrafox: 'shy', scythewing: 'shy', clockwyrm: 'shy',
};

/**
 * Where they live: rows added to each zone's spawns, [species, weight, how].
 * Rares come out in their hour; the grown forms of a line are scarcer, in
 * zones a little above where the young are.
 */
export const MORE_SPAWNS = {
  aetherport: [['rivetling', 12], ['magnetick', 8], ['puffwing', 10]],
  verdant_meadow: [['acornet', 14, { at: 'grass' }], ['petalfly', 10, { at: 'grass' }], ['ripplet', 10, { at: 'water' }], ['dandefluff', 8, { at: 'grass', when: 'day' }],
    ['lianake', 8, { at: 'grass' }], ['puffwing', 10], ['lumibug', 6, { when: 'night' }], ['sunbloom', 5, { at: 'grass', when: 'day' }]],
  emberfall_canyon: [['kindlepup', 14], ['magmole', 12, { at: 'lava' }], ['cindermoth', 10], ['dustmole', 8], ['blazehound', 3], ['ignivar', 0.5, { when: 'ash' }]],
  stonewake_mesa: [['dustmole', 14], ['clayling', 12, { at: 'cliff' }], ['sandviper', 10], ['chromeram', 10, { at: 'cliff' }], ['whirlweasel', 8],
    ['geodon', 3, { at: 'cliff' }], ['amberix', 3, { at: 'cliff', when: 'day' }], ['tunnelord', 3], ['rivetling', 8], ['oakling', 3]],
  tidal_hollow: [['koiren', 14, { at: 'water' }], ['bubbloon', 10, { at: 'shore' }], ['ripplet', 10, { at: 'water' }], ['coralisk', 3, { at: 'shore' }],
    ['abyssquid', 3, { at: 'water', when: 'night' }], ['torrentoad', 4, { at: 'shore' }], ['cloudray', 3, { when: 'rain' }], ['halowyrm', 2, { at: 'water', when: 'day' }]],
  stormreach_heights: [['voltail', 14], ['stormkite', 12, { at: 'cliff' }], ['fluxbug', 10], ['plasmite', 8], ['whirlweasel', 8], ['galeon', 4, { at: 'cliff' }],
    ['coilwyrm', 3, { when: 'storm' }], ['scythewing', 2, { at: 'cliff' }], ['joltusk', 3], ['magnetick', 6]],
  frostpeak_ridge: [['snowpip', 14], ['frostkit', 12, { at: 'ice' }], ['yetling', 10, { at: 'ice' }], ['flurrimp', 10, { when: 'snow' }], ['prismpup', 6, { at: 'ice' }],
    ['rimeserpent', 3, { at: 'ice', when: 'fog' }], ['glacivix', 3, { at: 'ice' }], ['cyclonix', 3]],
  umbral_grove: [['shadepup', 14], ['wisplet', 12], ['mushlet', 12, { at: 'forest' }], ['gloomwing', 10, { when: 'night' }], ['creepvine', 3, { at: 'forest' }],
    ['astrafox', 2, { when: 'night' }], ['nightfang', 4], ['sporeking', 3, { at: 'forest' }], ['phantomire', 3, { when: 'night' }], ['eclipsar', 0.5, { when: 'night' }],
    ['clockwyrm', 2], ['steamhulk', 3], ['titanox', 2], ['prismane', 2], ['grovenard', 2, { at: 'forest' }], ['lanternix', 3, { when: 'night' }],
    ['yetimaul', 2], ['koimperor', 1], ['tempestral', 2], ['skyrender', 1], ['calderox', 2], ['pyrewing', 2], ['terracolos', 2]],
};
