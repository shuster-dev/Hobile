// The field zones, laid out by hand. Compiled by worldplan.js; the landmarks
// (camp, portals, dungeon gates) are in gamedata.js and these plans are drawn
// around them. Every zone is 240m across, its edge at 117m from the middle.
//
// Feature vocabulary (all coordinates in metres, x east, z north):
//   water      { kind: 'water' | 'lava' | 'ice' | 'swamp', level }
//   relief     how much the open ground rolls
//   hills      { x, z, r, h }
//   plateaus   { x, z, rx, rz, h, edge, rot, ramps: [{ a, w, len }] } — a
//              mesa, a terrace, a canyon wall; `a` is the direction of a ramp
//              (atan2(dz, dx)), `w` its half-width in radians
//   rivers     { pts, w, bank, depth }      lakes { x, z, rx, rz, rot, depth }
//   sea        { z0, amp, freq, beach, bay } isles { x, z, r, h }
//   chasms     { pts, w }                    roads { pts, w }
//   forests    { x, z, r, density }          grass { x, z, r } — tall grass,
//              where most of the wild ones live
//   structures { kind, x, z, rot, ... }     bridges by `at` (or a, b)
//   tone       how the ground is coloured: { mesaTop, moss, snow, shore }

const PI = Math.PI;

export const PLANS = {
  // ------------------------------------------------------------- the meadow
  // A river across the middle with two bridges; a farm village up the west
  // side, its mill turning; a pond in the east; a watchtower on the hill in
  // the south-west woods.
  verdant_meadow: {
    water: { kind: 'water', level: -0.7 },
    relief: 1.5,
    hills: [{ x: -72, z: -62, r: 22, h: 6 }, { x: 60, z: -72, r: 26, h: 3.2 }, { x: -20, z: -84, r: 30, h: 3.8 }, { x: 96, z: 30, r: 22, h: 3 }, { x: 40, z: 96, r: 22, h: 2.4 }],
    rivers: [{ pts: [[-128, 8], [-90, 14], [-58, 22], [-30, 8], [-5, -2], [25, -10], [55, -6], [85, -20], [128, -32]], w: 9, bank: 5 }],
    lakes: [{ x: 60, z: 52, rx: 13, rz: 10, rot: 0.3 }],
    roads: [
      { pts: [[0, 64], [8, 38], [22, 12], [28, -9], [40, -30], [58, -52], [74, -70]] },
      { pts: [[-6, 70], [-26, 62], [-44, 58]] },
      { pts: [[-46, 52], [-58, 38], [-61, 22], [-66, -10], [-70, -40], [-72, -54]], w: 2.6 },
      { pts: [[0, 80], [0, 100]] },
    ],
    forests: [{ x: -90, z: -24, r: 24 }, { x: 88, z: 40, r: 22 }, { x: 36, z: -92, r: 22 }, { x: -36, z: -92, r: 18, density: 0.8 }, { x: -90, z: 70, r: 14, density: 0.7 }],
    grass: [{ x: 22, z: 34, r: 18 }, { x: -26, z: -34, r: 22 }, { x: 60, z: -44, r: 18 }, { x: -8, z: -66, r: 16 }, { x: 76, z: 18, r: 14 }, { x: -24, z: 34, r: 14 }],
    structures: [
      { kind: 'bridge', at: [28, -9] },
      { kind: 'bridge', at: [-61, 22], arch: 0.8 },
      { kind: 'windmill', x: -78, z: 50, rot: 0.5 },
      { kind: 'barn', x: -58, z: 72, rot: 0.15, w: 10, d: 14, h: 6 },
      { kind: 'dwelling', x: -36, z: 46, rot: -0.4, w: 6.5, d: 6, h: 4 },
      { kind: 'dwelling', x: -64, z: 38, rot: 0.6, w: 6, d: 7, h: 4 },
      { kind: 'dwelling', x: -30, z: 74, rot: 2.6, w: 6, d: 6, h: 4 },
      { kind: 'field', x: -78, z: 72, rot: 0.6, w: 22, d: 12, crop: 'wheat' },
      { kind: 'field', x: -40, z: 90, rot: 0.1, w: 18, d: 11, crop: 'cabbage' },
      { kind: 'orchard', x: -16, z: 96, rot: 0, w: 18, d: 12 },
      { kind: 'haystack', x: -66, z: 84 }, { kind: 'haystack', x: -46, z: 80 },
      { kind: 'well', x: -48, z: 58 },
      { kind: 'fence', x: -58, z: 82, rot: 0, len: 14 }, { kind: 'fence', x: -66, z: 72, rot: PI / 2, len: 10 },
      { kind: 'cart', x: -26, z: 60, rot: 1.2 },
      { kind: 'watchtower', x: -72, z: -62, rot: 0.4 },
    ],
  },

  // ------------------------------------------------------- emberfall canyon
  // A canyon between two walls of rock, a lava river down it, basalt columns
  // standing in the floor, the smiths' village round the camp, and the
  // volcano the river comes from, smoking beyond the north wall.
  emberfall_canyon: {
    water: { kind: 'lava', level: -0.6 },
    relief: 1.3,
    plateaus: [
      { x: -152, z: 0, rx: 50, rz: 170, h: 15, edge: 3 },
      { x: 152, z: 0, rx: 48, rz: 170, h: 15, edge: 3 },
      { x: 56, z: -46, rx: 22, rz: 16, h: 6, edge: 2.4, ramps: [{ a: PI, w: 0.6, len: 14 }] },
    ],
    hills: [{ x: -60, z: -90, r: 22, h: 3 }, { x: 70, z: 90, r: 20, h: 3 }],
    rivers: [{ pts: [[72, 128], [50, 82], [26, 46], [8, 10], [-5, -30], [-22, -72], [-36, -128]], w: 8, bank: 4, depth: 1.2 }],
    roads: [
      { pts: [[-45, 48], [-25, 76], [0, 98]] },
      { pts: [[-38, 34], [-10, 6], [3, -12], [30, -40], [52, -56], [74, -70]] },
      { pts: [[-36, 44], [10, 56], [33, 58], [45, 62]] },
      { pts: [[-54, 44], [-68, 54], [-80, 60]], w: 2.6 },
    ],
    forests: [{ x: -76, z: -70, r: 20, density: 0.35 }, { x: 80, z: 20, r: 16, density: 0.3 }],
    grass: [{ x: -62, z: -38, r: 18 }, { x: 30, z: -84, r: 16 }, { x: -22, z: 4, r: 15 }, { x: 72, z: 2, r: 14 }, { x: -80, z: 10, r: 14 }],
    structures: [
      { kind: 'bridge', at: [3, -12] },
      { kind: 'bridge', at: [33, 58] },
      { kind: 'forge', x: -62, z: 56, rot: 0.5, w: 8, d: 7, h: 5 },
      { kind: 'stonehouse', x: -28, z: 60, rot: -0.6, w: 6, d: 6, h: 4 },
      { kind: 'stonehouse', x: -66, z: 26, rot: 1.4, w: 6, d: 7, h: 4 },
      { kind: 'anvil', x: -54, z: 52, rot: 0.4 },
      { kind: 'crates', x: -36, z: 24, rot: 0.3 },
      { kind: 'cart', x: -24, z: 40, rot: -0.8 },
      { kind: 'basalt', x: -24, z: -58, r: 4 }, { kind: 'basalt', x: -12, z: -88, r: 3 }, { kind: 'basalt', x: 62, z: 30, r: 5 },
      { kind: 'basalt', x: 72, z: -12, r: 3.5 }, { kind: 'basalt', x: -62, z: -18, r: 3 }, { kind: 'basalt', x: 20, z: 84, r: 3.5 },
      { kind: 'volcano', x: 40, z: 205 },
    ],
  },

  // --------------------------------------------------------- stonewake mesa
  // Desert under mesas: three you can climb by their ramps, buttes you
  // cannot, two stone arches, the miners' camp at the foot of the big mesa
  // with a rail out of its mine, and a little oasis.
  stonewake_mesa: {
    water: { kind: 'water', level: -0.8 },
    relief: 1.1,
    plateaus: [
      { x: -55, z: -36, rx: 34, rz: 28, h: 10, edge: 2.4, rot: 0.2, ramps: [{ a: 0, w: 0.45, len: 20 }] },
      { x: 60, z: -50, rx: 26, rz: 22, h: 8, edge: 2.4, ramps: [{ a: PI / 2, w: 0.5, len: 17 }] },
      { x: 72, z: 40, rx: 20, rz: 24, h: 7, edge: 2.2, ramps: [{ a: PI, w: 0.5, len: 15 }] },
      { x: -96, z: 22, rx: 9, rz: 8, h: 12, edge: 2 },
      { x: 10, z: -96, rx: 10, rz: 8, h: 11, edge: 2 },
      { x: -12, z: 84, rx: 7, rz: 7, h: 9, edge: 2 },
      { x: 104, z: -10, rx: 8, rz: 10, h: 10, edge: 2 },
    ],
    lakes: [{ x: 26, z: 14, rx: 9, rz: 7, rot: 0.4, depth: 1.2 }],
    roads: [
      { pts: [[-40, 52], [-20, 80], [0, 98]] },
      { pts: [[-34, 38], [0, 26], [36, 4], [20, -30], [24, -70], [40, -92]] },
      { pts: [[-30, 50], [10, 62], [44, 68]] },
      { pts: [[-46, 32], [-52, 10], [-54, -2]], w: 2.4 },
    ],
    forests: [{ x: 86, z: 86, r: 16, density: 0.45 }, { x: -90, z: 80, r: 14, density: 0.4 }],
    grass: [{ x: 34, z: 32, r: 16 }, { x: -12, z: -64, r: 18 }, { x: 92, z: 6, r: 12 }, { x: -92, z: -10, r: 14 }, { x: 10, z: 40, r: 12 }],
    structures: [
      { kind: 'arch', x: 4, z: -42, rot: 0.3, span: 10 },
      { kind: 'arch', x: -76, z: -72, rot: 1.0, span: 8 },
      { kind: 'mine', x: -52, z: -4, rot: 0.15 },
      { kind: 'rails', pts: [[-52, -1], [-52, 12], [-47, 28]] },
      { kind: 'cart', x: -51, z: 8, rot: 0.1, mine: true },
      { kind: 'tent', x: -28, z: 30, rot: -0.5 }, { kind: 'tent', x: -58, z: 32, rot: 0.6 }, { kind: 'tent', x: -22, z: 50, rot: 2.6 },
      { kind: 'crates', x: -36, z: 22, rot: 0.2 }, { kind: 'crates', x: -60, z: 18, rot: 1.1 },
    ],
    tone: { mesaTop: 0.55 },
  },

  // ----------------------------------------------------- stormreach heights
  // High ground split by a chasm: a stone bridge and a rope bridge across,
  // terraces stepping up in the north-east, wind turbines along the ridges,
  // crystals humming in the rock, and the airship moored at the camp's mast.
  stormreach_heights: {
    relief: 1.6,
    base: 1,
    plateaus: [
      { x: 60, z: 76, rx: 32, rz: 24, h: 5, edge: 2.2, ramps: [{ a: -PI / 2, w: 0.5, len: 12 }] },
      { x: 68, z: 84, rx: 16, rz: 12, h: 10, edge: 2.2, ramps: [{ a: -PI / 2, w: 0.5, len: 10 }] },
      { x: -76, z: 70, rx: 26, rz: 20, h: 6, edge: 2.2, ramps: [{ a: 0, w: 0.5, len: 13 }] },
      { x: -30, z: -78, rx: 30, rz: 18, h: 5, edge: 2.2, ramps: [{ a: PI / 2, w: 0.55, len: 12 }] },
    ],
    chasms: [{ pts: [[-128, -8], [-70, 2], [-30, -6], [10, -18], [50, -12], [90, -2], [128, -12]], w: 14 }],
    roads: [
      { pts: [[35, 48], [15, 80], [0, 98]] },
      { pts: [[30, 32], [2, 12], [-20, -6], [-45, -40], [-62, -56], [-76, -68]] },
      { pts: [[32, 36], [60, 20], [70, -4], [80, -30]], w: 2.6 },
      { pts: [[28, 44], [-10, 50], [-44, 52]] },
    ],
    forests: [{ x: 96, z: 30, r: 14, density: 0.45 }, { x: -100, z: -40, r: 14, density: 0.4 }],
    grass: [{ x: -20, z: 30, r: 18 }, { x: 82, z: -50, r: 18 }, { x: -52, z: -50, r: 14 }, { x: 4, z: -94, r: 12 }, { x: 100, z: 0, r: 10 }],
    structures: [
      { kind: 'bridge', at: [-20, -6], stone: true },
      { kind: 'bridge', at: [70, -4], rope: true, arch: 0.4, w: 3.2 },
      { kind: 'mast', x: 44, z: 50 },
      { kind: 'airship', x: 52, z: 54, rot: 0.6 },
      { kind: 'turbine', x: -86, z: 74, rot: 0.3 }, { kind: 'turbine', x: -70, z: 80, rot: 0.3 }, { kind: 'turbine', x: -64, z: 62, rot: 0.3 },
      { kind: 'turbine', x: -40, z: -80, rot: 1.2 }, { kind: 'turbine', x: -20, z: -84, rot: 1.2 }, { kind: 'turbine', x: 66, z: 86, rot: 0.8 },
      { kind: 'crystals', x: -60, z: 36, r: 3 }, { kind: 'crystals', x: 60, z: -60, r: 4 }, { kind: 'crystals', x: -86, z: -40, r: 3.5 },
      { kind: 'crystals', x: 18, z: 62, r: 2.5 }, { kind: 'crystals', x: 96, z: -70, r: 3 },
    ],
    tone: { mesaTop: 0.3 },
  },

  // ----------------------------------------------------------- tidal hollow
  // A bay. Beaches round it, a village on stilts at the west of the shore,
  // a pier with boats, islands joined by boardwalks, and the lighthouse on
  // the headland in the east.
  tidal_hollow: {
    water: { kind: 'water', level: -0.6 },
    relief: 1.4,
    sea: { z0: -36, amp: 10, freq: 0.035, beach: 10, bay: { x: 10, w: 40, d: 18 } },
    isles: [{ x: 4, z: -76, r: 15, h: 2.2 }, { x: -44, z: -88, r: 12, h: 2 }, { x: 60, z: -80, r: 10, h: 2.6 }],
    plateaus: [{ x: 90, z: -46, rx: 13, rz: 11, h: 6, edge: 2.4, ramps: [{ a: PI / 2, w: 0.6, len: 13 }] }],
    roads: [
      { pts: [[34, 16], [15, 60], [0, 98]] },
      { pts: [[26, 10], [-30, 40], [-78, 62]] },
      { pts: [[44, 12], [70, 36], [84, 52]] },
      { pts: [[40, 4], [80, -14], [90, -28]], w: 2.4 },
    ],
    forests: [{ x: -86, z: 50, r: 18, density: 0.6 }, { x: 76, z: 86, r: 16, density: 0.6 }, { x: -20, z: 90, r: 14, density: 0.5 }],
    grass: [{ x: -20, z: 60, r: 20 }, { x: 58, z: 70, r: 16 }, { x: -72, z: 18, r: 16 }, { x: 4, z: -76, r: 9 }],
    structures: [
      { kind: 'boardwalk', a: [4, -12], b: [4, -64] },
      { kind: 'boardwalk', a: [-8, -80], b: [-36, -88] },
      { kind: 'pier', a: [44, -12], b: [46, -50], w: 3.4 },
      { kind: 'boat', x: 51, z: -42, rot: 0.1 }, { kind: 'boat', x: 39, z: -46, rot: -0.2 }, { kind: 'boat', x: 24, z: -58, rot: 0.9 },
      { kind: 'stilthouse', x: -42, z: -42, rot: 0.2 }, { kind: 'stilthouse', x: -58, z: -48, rot: -0.1 }, { kind: 'stilthouse', x: -26, z: -36, rot: 0.4 },
      { kind: 'boardwalk', a: [-42, -24], b: [-42, -38] }, { kind: 'boardwalk', a: [-58, -28], b: [-58, -44] }, { kind: 'boardwalk', a: [-26, -20], b: [-26, -32] },
      { kind: 'lighthouse', x: 90, z: -48 },
      { kind: 'crates', x: 40, z: -4, rot: 0.3 },
    ],
    tone: { shore: 1 },
  },

  // -------------------------------------------------------- frostpeak ridge
  // A frozen lake in a bowl of ridges you can walk out onto, log cabins with
  // their chimneys going by the camp, pine woods, spires of ice.
  frostpeak_ridge: {
    water: { kind: 'ice', level: -0.5 },
    relief: 1.6,
    plateaus: [
      { x: 30, z: 128, rx: 80, rz: 34, h: 13, edge: 3 },
      { x: 130, z: 20, rx: 32, rz: 70, h: 11, edge: 3 },
      { x: -128, z: -20, rx: 30, rz: 50, h: 10, edge: 3 },
    ],
    hills: [{ x: -40, z: 60, r: 24, h: 4 }, { x: 50, z: -90, r: 22, h: 3 }],
    lakes: [{ x: 16, z: 6, rx: 46, rz: 32, rot: 0.3, depth: 1.4, bank: 5 }],
    roads: [
      { pts: [[-55, -38], [-72, 10], [-74, 70]] },
      { pts: [[-40, -52], [10, -62], [50, -70], [74, -70]] },
    ],
    forests: [{ x: -82, z: 40, r: 30 }, { x: 72, z: 66, r: 26 }, { x: 62, z: -66, r: 20, density: 0.7 }, { x: -20, z: 78, r: 18 }, { x: -96, z: -66, r: 16, density: 0.7 }],
    grass: [{ x: -40, z: 8, r: 16 }, { x: 52, z: -30, r: 14 }, { x: 20, z: 56, r: 14 }, { x: -6, z: -48, r: 14 }],
    structures: [
      { kind: 'cabin', x: -70, z: -34, rot: 0.6, w: 6, d: 7, h: 4 },
      { kind: 'cabin', x: -36, z: -64, rot: -0.4, w: 6, d: 6, h: 4 },
      { kind: 'cabin', x: -66, z: -62, rot: 0.9, w: 7, d: 6, h: 4 },
      { kind: 'cabin', x: -28, z: -30, rot: -1.1, w: 6, d: 6, h: 4 },
      { kind: 'crates', x: -44, z: -30, rot: 0.2, wood: true },
      { kind: 'spire', x: 76, z: -26, r: 3 }, { kind: 'spire', x: 56, z: -44, r: 2.4 }, { kind: 'spire', x: -70, z: -80, r: 2.6 }, { kind: 'spire', x: 2, z: -84, r: 3 },
      { kind: 'spire', x: 18, z: 4, r: 2.2 },
    ],
    tone: { snow: 0.65, snowFrom: -2 },
  },

  // ----------------------------------------------------------- umbral grove
  // A swamp under trees as tall as towers, mushrooms that light the way,
  // boardwalks over the black water, a temple in the east and a fortress in
  // ruins in the south-west, where the keep's gate is.
  umbral_grove: {
    water: { kind: 'swamp', level: -0.4 },
    relief: 1.4,
    lakes: [
      { x: -55, z: 16, rx: 20, rz: 14, depth: 0.9 }, { x: -12, z: -8, rx: 12, rz: 9, depth: 0.8 },
      { x: 38, z: 20, rx: 14, rz: 11, depth: 0.8 }, { x: 72, z: -36, rx: 16, rz: 12, depth: 0.9 },
    ],
    roads: [
      { pts: [[18, 66], [-30, 72], [-74, 70]] },
      { pts: [[20, 54], [6, 26], [6, -12], [-28, -40], [-56, -56]] },
      { pts: [[30, 58], [52, 50], [66, 44]], w: 2.6 },
    ],
    forests: [{ x: -60, z: 62, r: 34 }, { x: 60, z: -64, r: 30 }, { x: -84, z: -20, r: 24 }, { x: 22, z: -2, r: 30, density: 0.5 }, { x: -6, z: -96, r: 18 }],
    grass: [{ x: -4, z: 30, r: 16 }, { x: 50, z: -12, r: 14 }, { x: -30, z: -48, r: 14 }, { x: 80, z: 10, r: 12 }],
    structures: [
      { kind: 'boardwalk', a: [-78, 12], b: [-34, 20] },
      { kind: 'boardwalk', a: [24, 14], b: [52, 26] },
      { kind: 'gianttree', x: -30, z: 44, r: 2.8 }, { kind: 'gianttree', x: 62, z: 74, r: 2.6 }, { kind: 'gianttree', x: 88, z: 2, r: 2.6 },
      { kind: 'gianttree', x: -88, z: -24, r: 3 }, { kind: 'gianttree', x: 14, z: -72, r: 2.8 }, { kind: 'gianttree', x: -40, z: -96, r: 2.6 },
      { kind: 'mushroom', x: -10, z: 32, r: 1.6 }, { kind: 'mushroom', x: 46, z: -10, r: 1.3 }, { kind: 'mushroom', x: -72, z: 48, r: 1.8 },
      { kind: 'mushroom', x: 80, z: 30, r: 1.4 }, { kind: 'mushroom', x: -46, z: -34, r: 1.5 }, { kind: 'mushroom', x: 30, z: -58, r: 1.7 },
      { kind: 'mushroom', x: -2, z: 8, r: 1.1 }, { kind: 'mushroom', x: -64, z: -4, r: 1.2 },
      { kind: 'temple', x: 70, z: 40, rot: -2.2 },
      { kind: 'ruinwall', x: -62, z: -46, rot: 0, len: 22 }, { kind: 'ruinwall', x: -66, z: -78, rot: 0, len: 16 },
      { kind: 'ruinwall', x: -78, z: -60, rot: PI / 2, len: 24 }, { kind: 'ruinwall', x: -46, z: -68, rot: PI / 2, len: 12 },
      { kind: 'ruintower', x: -78, z: -46 }, { kind: 'ruintower', x: -46, z: -80 }, { kind: 'ruintower', x: -78, z: -78 },
      { kind: 'lanterns', pts: [[20, 54], [6, 26], [6, -12], [-28, -40]] },
    ],
    tone: { moss: 0.8 },
  },
};
