// What the planned zones have built in them, kind by kind (zoneplans.js says
// where). Each builder draws one structure in its own frame — x across, y up
// from the ground it stands on, z the way it faces — into `k` (solid, cel-
// shaded) and `g` (lit from inside: windows after dark, embers, crystals). A
// part that moves (sails, blades, an airship) is drawn into its own kit with
// `part(name, pivot)`; smoke gets an emitter with `smoke(x, y, z)`. The
// footprints that stop a walker are in shared/worldplan.js, beside the plan.
import { Kit } from './zonekit.js';

const WOOD = 0x9A6A44, WOOD_D = 0x6E4A30, WOOD_L = 0xC49A6C, PLANK = 0xB08458;
const STONE = 0xC2B8A8, STONE_D = 0x8E8578, SLATE = 0x5E6470, IRON = 0x4C505A;
const WHITE = 0xF2ECE0, RED = 0xB84A3A, THATCH = 0xD9B464, LIT = 0xFFC870, DARK = 0x2A2622;
const PI = Math.PI;

/** Windows: a dark pane by day, lit at night (`g` carries the light). */
function windows(k, g, list, w = 0.7, h = 0.8) {
  for (const [x, y, z, ry = 0] of list) {
    k.box(w + 0.16, h + 0.16, 0.08, { x, y, z, ry }, WOOD_D);
    g.box(w, h, 0.06, { x: x + Math.sin(ry) * 0.04, y, z: z + Math.cos(ry) * 0.04, ry }, LIT);
  }
}

/** A house: walls, a door, windows, a gabled roof and maybe a chimney. */
function house(k, g, { w, d, h, wall, roof, trim = WOOD_D, chimney = null, smoke, door = true }) {
  k.box(w + 0.3, 0.3, d + 0.3, { y: 0.15 }, STONE_D);
  k.box(w, h, d, { y: h / 2 + 0.2 }, wall);
  for (const sx of [1, -1]) for (const sz of [1, -1]) k.box(0.22, h, 0.22, { x: sx * w / 2, y: h / 2 + 0.2, z: sz * d / 2 }, trim);
  const ridge = h + 0.2 + w * 0.42;
  k.gableEnds(w, d, h + 0.2, ridge, {}, wall);
  k.gable(w, d, h + 0.2, ridge, {}, roof);
  if (door) k.box(1.1, 1.9, 0.1, { y: 1.15, z: d / 2 + 0.03 }, WOOD_D);
  windows(k, g, [[-w / 4 - 0.3, h * 0.6 + 0.2, d / 2 + 0.02], [w / 4 + 0.3, h * 0.6 + 0.2, d / 2 + 0.02], [w / 2 + 0.02, h * 0.6 + 0.2, 0, PI / 2], [-w / 2 - 0.02, h * 0.6 + 0.2, 0, -PI / 2]]);
  if (chimney) {
    k.box(0.8, 2.2, 0.8, { x: chimney[0], y: ridge - 0.3, z: chimney[1] }, STONE_D);
    smoke?.(chimney[0], ridge + 0.9, chimney[1]);
  }
}

/** Planks along a deck, following its height; posts and rails if asked. */
function deck(kw, s, { plank = PLANK, post = WOOD_D, rails = true, piles = 0, gap = 0, railH = 1.05, sag = 0 }) {
  const c = Math.cos(s.rot), sn = Math.sin(s.rot), L = s.len, n = Math.max(2, Math.ceil(L / 1.1));
  const at = (lx, lz) => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
  const yAt = (lz) => { const [x, z] = at(0, lz); return s.deck.yAt(x, z) - sag * Math.sin(PI * (lz / L + 0.5)); };
  for (let i = 0; i < n; i++) {
    const lz = -L / 2 + (i + 0.5) * L / n, y0 = yAt(lz - L / n / 2), y1 = yAt(lz + L / n / 2);
    const [x, z] = at(0, lz);
    kw.box(s.w, 0.16, L / n - gap, { x, y: (y0 + y1) / 2 - 0.08, z, ry: s.rot, rx: -Math.atan2(y1 - y0, L / n) }, i % 3 ? plank : WOOD_L);
  }
  const posts = Math.max(2, Math.round(L / 2.2));
  for (let i = 0; i <= posts; i++) {
    const lz = -L / 2 + i * L / posts;
    for (const sx of [1, -1]) {
      const [x, z] = at(sx * (s.w / 2 + 0.08), lz), y = yAt(lz);
      if (rails) kw.box(0.16, railH, 0.16, { x, y: y + railH / 2, z, ry: s.rot }, post);
      if (piles && i % piles === 0) kw.cyl(0.16, 0.18, 3.2, { x, y: y - 1.7, z }, WOOD_D, 6);
    }
    if (rails && i < posts) for (const sx of [1, -1]) {
      const a = at(sx * (s.w / 2 + 0.08), lz), b = at(sx * (s.w / 2 + 0.08), lz + L / posts), ya = yAt(lz), yb = yAt(lz + L / posts);
      kw.box(0.1, 0.1, L / posts + 0.1, { x: (a[0] + b[0]) / 2, y: (ya + yb) / 2 + railH, z: (a[1] + b[1]) / 2, ry: s.rot, rx: -Math.atan2(yb - ya, L / posts) }, post);
    }
  }
}

export const BUILDERS = {
  // ------------------------------------------------------------- decks
  bridge(k, g, s, o) {
    const kw = o.world;
    if (s.stone || o.P.water?.kind === 'lava') {
      deck(kw, s, { plank: STONE, post: STONE_D, rails: false });
      const c = Math.cos(s.rot), sn = Math.sin(s.rot);
      for (let i = 0; i <= 8; i++) {
        const lz = -s.len / 2 + i * s.len / 8;
        for (const sx of [1, -1]) {
          const x = s.x + sx * (s.w / 2 + 0.25) * c + lz * sn, z = s.z - sx * (s.w / 2 + 0.25) * sn + lz * c, y = s.deck.yAt(x - sx * 0.3 * c, z + sx * 0.3 * sn);
          kw.box(0.5, 0.9, s.len / 8 + 0.05, { x, y: y + 0.4, z, ry: s.rot }, i % 2 ? STONE : STONE_D);
        }
      }
      // the arch under it
      const ym = s.deck.yAt(s.x, s.z);
      kw.box(s.w + 0.6, 0.9, s.len * 0.7, { x: s.x, y: ym - 0.55, z: s.z, ry: s.rot }, STONE_D);
      for (const t of [-0.32, 0.32]) {
        const x = s.x + t * s.len * sn, z = s.z + t * s.len * c;
        kw.box(s.w + 0.4, 6, 1.4, { x, y: ym - 3.6, z, ry: s.rot }, STONE_D);
      }
      return;
    }
    if (s.rope) { deck(kw, s, { gap: 0.25, post: WOOD_D, railH: 1.1, sag: 0.7 }); return; }
    deck(kw, s, { piles: 2 });
  },
  boardwalk(k, g, s, o) { deck(o.world, s, { rails: false, piles: 1, gap: 0.08 }); },
  pier(k, g, s, o) {
    deck(o.world, s, { piles: 1, railH: 0.9 });
    const c = Math.cos(s.rot), sn = Math.sin(s.rot), lz = s.len / 2 - 0.6;
    const x = s.x + lz * sn, z = s.z + lz * c, y = s.deck.yAt(x, z);
    o.world.cyl(0.08, 0.1, 3, { x: x + 1.4 * c, y: y + 1.5, z: z - 1.4 * sn }, IRON, 6);
    o.glow.ball(0.28, { x: x + 1.4 * c, y: y + 3.1, z: z - 1.4 * sn }, LIT, 8);
  },

  // ------------------------------------------------------------- farm
  windmill(k, g, s, o) {
    k.cyl(1.9, 2.7, 9, { y: 4.5 }, WHITE, 10);
    k.cyl(2.75, 2.9, 0.4, { y: 0.2 }, STONE_D, 10);
    k.cone(2.4, 3, { y: 10.4 }, RED, 10);
    k.box(1.2, 2.1, 0.2, { y: 1.05, z: 2.62 }, WOOD_D);
    windows(k, g, [[0, 5.5, 2.2], [0, 7.6, 1.95]], 0.6, 0.7);
    k.box(0.5, 0.5, 1.4, { y: 8.4, z: 2.2 }, WOOD_D);
    const sails = o.part('sails', { x: 0, y: 8.4, z: 2.95 }, 'spinZ', 0.7);
    for (let i = 0; i < 4; i++) {
      const a = i * PI / 2;
      sails.box(0.18, 5.6, 0.12, { x: Math.sin(a) * 2.9, y: Math.cos(a) * 2.9, rz: -a }, WOOD);
      sails.box(1.0, 4.6, 0.05, { x: Math.sin(a) * 3.1 + Math.cos(a) * 0.55, y: Math.cos(a) * 3.1 - Math.sin(a) * 0.55, z: -0.06, rz: -a }, WHITE);
    }
    sails.cyl(0.35, 0.35, 0.4, { rx: PI / 2 }, WOOD_D, 8);
  },
  barn(k, g, s) {
    const { w, d, h } = s;
    k.box(w + 0.3, 0.3, d + 0.3, { y: 0.15 }, STONE_D);
    k.box(w, h, d, { y: h / 2 + 0.2 }, RED);
    const ridge = h + 0.2 + w * 0.36;
    k.gableEnds(w, d, h + 0.2, ridge, {}, RED);
    k.gable(w, d, h + 0.2, ridge, {}, 0x5A4A44);
    k.box(4, 4, 0.12, { y: 2.2, z: d / 2 + 0.04 }, 0x8A3A2E);
    for (const sx of [1, -1]) k.box(0.18, 5.6, 0.14, { x: sx * 1, y: 2.2, z: d / 2 + 0.1, rz: sx * 0.78 }, WHITE);
    k.box(4.2, 0.2, 0.16, { y: 4.25, z: d / 2 + 0.1 }, WHITE);
    windows(k, g, [[0, h + 1.2, d / 2 + 0.05]], 1, 1);
    for (const sz of [1, -1]) for (const sx of [1, -1]) k.box(0.3, h, 0.3, { x: sx * w / 2, y: h / 2 + 0.2, z: sz * d / 2 }, WHITE);
  },
  dwelling(k, g, s, o) { house(k, g, { w: s.w, d: s.d, h: s.h, wall: o.pal.wall ?? WHITE, roof: THATCH, chimney: [s.w * 0.25, -s.d * 0.2], smoke: o.smoke }); },
  field(k, g, s) {
    k.box(s.w, 0.12, s.d, { y: 0.02 }, 0x7A5A3A);
    const wheat = s.crop !== 'cabbage';
    for (let r = -s.d / 2 + 0.7; r < s.d / 2 - 0.4; r += wheat ? 0.9 : 1.2) {
      k.box(s.w - 0.6, 0.12, 0.32, { y: 0.1, z: r }, 0x5E4430);
      for (let x = -s.w / 2 + 0.6; x < s.w / 2 - 0.4; x += wheat ? 0.55 : 1.0) {
        if (wheat) k.cone(0.22, 1.0 + ((x * 7 + r * 3) % 0.3), { x, y: 0.62, z: r }, (x + r) % 2 > 1 ? 0xE6C35A : 0xD8AE48, 5);
        else k.ball(0.32, { x, y: 0.32, z: r, sy: 0.8 }, (x * 3 + r) % 2 > 1 ? 0x6FBF5A : 0x8ED06A, 6);
      }
    }
  },
  orchard(k, g, s) {
    for (let x = -s.w / 2 + 2; x <= s.w / 2 - 1.5; x += 4.2) for (let z = -s.d / 2 + 2; z <= s.d / 2 - 1.5; z += 4.2) {
      k.cyl(0.16, 0.22, 1.6, { x, y: 0.8, z }, WOOD_D, 6);
      k.ball(1.25, { x, y: 2.3, z, sy: 0.85 }, 0x4E9A44, 7);
      for (let i = 0; i < 5; i++) { const a = i * 1.26 + x; k.ball(0.14, { x: x + Math.cos(a) * 1.05, y: 2.2 + (i % 2) * 0.4, z: z + Math.sin(a) * 1.05 }, i % 2 ? 0xE8503A : 0xF2A23A, 5); }
    }
  },
  haystack(k) { k.cyl(1.15, 1.25, 1.2, { y: 0.6 }, THATCH, 10); k.cone(1.2, 1.1, { y: 1.75 }, 0xE6C470, 10); },
  well(k) {
    k.cyl(1.05, 1.1, 0.9, { y: 0.45 }, STONE, 10);
    k.cyl(0.85, 0.85, 0.06, { y: 0.88 }, 0x2E4A6A, 10);
    for (const sx of [1, -1]) k.box(0.14, 2, 0.14, { x: sx * 0.9, y: 1.4 }, WOOD_D);
    k.gable(2.2, 1.6, 2.3, 2.9, {}, RED, 0.1);
    k.cyl(0.08, 0.08, 1.8, { y: 2.1, rz: PI / 2 }, WOOD, 6);
    k.cyl(0.2, 0.17, 0.3, { y: 1.4 }, WOOD, 8);
  },
  fence(k, g, s) {
    const L = s.len ?? 8, n = Math.max(2, Math.round(L / 2));
    for (let i = 0; i <= n; i++) k.box(0.14, 1.1, 0.14, { x: -L / 2 + i * L / n, y: 0.55 }, WOOD_D);
    for (const y of [0.45, 0.9]) k.box(L, 0.1, 0.08, { y }, WOOD);
  },
  cart(k, g, s) {
    if (s.mine) {
      k.box(1.2, 0.7, 1.7, { y: 0.75 }, IRON);
      k.box(1.0, 0.3, 1.5, { y: 1.05 }, 0x6A5A50);
      for (const sx of [1, -1]) for (const sz of [0.55, -0.55]) k.cyl(0.25, 0.25, 0.12, { x: sx * 0.62, y: 0.28, z: sz, rz: PI / 2 }, DARK, 8);
      return;
    }
    k.box(1.6, 0.25, 2.4, { y: 0.8 }, WOOD);
    for (const sx of [1, -1]) k.box(0.1, 0.45, 2.4, { x: sx * 0.8, y: 1.1 }, WOOD_D);
    for (const sx of [1, -1]) k.ring(0.55, 0.07, { x: sx * 0.95, y: 0.6, ry: PI / 2 }, WOOD_D, 12);
    for (const sx of [1, -1]) k.box(0.08, 0.08, 1.6, { x: sx * 0.5, y: 0.8, z: 1.9 }, WOOD_D);
    k.ball(0.45, { y: 1.2, z: -0.4, sy: 0.7 }, THATCH, 6);
  },
  watchtower(k, g) {
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.box(0.32, 8, 0.32, { x: sx * 1.7, y: 4, z: sz * 1.7, rx: sz * 0.05, rz: -sx * 0.05 }, WOOD_D);
    for (const y of [2.5, 5]) for (const r of [0, PI / 2]) k.box(3.6, 0.16, 0.16, { y, ry: r, z: 0 }, WOOD);
    k.box(4.4, 0.3, 4.4, { y: 8.1 }, WOOD);
    for (const [x, z, ry] of [[0, 2.15, 0], [0, -2.15, 0], [2.15, 0, PI / 2], [-2.15, 0, PI / 2]]) k.box(4.4, 0.9, 0.12, { x, y: 8.7, z, ry }, WOOD_D);
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.box(0.16, 2.4, 0.16, { x: sx * 2, y: 9.4, z: sz * 2 }, WOOD_D);
    k.cone(3.6, 2, { y: 11.4, ry: PI / 4 }, RED, 4);
    for (let i = 0; i < 8; i++) k.box(0.9, 0.08, 0.08, { y: 0.5 + i, z: 2.1 }, WOOD);
    g.ball(0.25, { y: 9.6 }, LIT, 8);
  },

  // ------------------------------------------------------------- canyon
  forge(k, g, s, o) {
    house(k, g, { w: s.w, d: s.d, h: s.h, wall: 0x9A8E84, roof: SLATE, trim: DARK, door: false });
    k.box(1.8, 6.5, 1.8, { x: -s.w / 2 + 1, y: 4.5, z: -s.d / 2 + 1 }, STONE_D);
    o.smoke(-s.w / 2 + 1, 8, -s.d / 2 + 1, 'dark');
    k.box(2.6, 2.4, 0.4, { y: 1.3, z: s.d / 2 + 0.15 }, STONE_D);
    o.lit.box(1.6, 1.3, 0.1, { y: 1.1, z: s.d / 2 + 0.36 }, 0xFF7A2A);
    k.box(3, 0.2, 2, { y: s.h + 0.3, z: s.d / 2 + 1.2 }, WOOD_D);
    for (const sx of [1, -1]) k.box(0.16, s.h, 0.16, { x: sx * 1.4, y: s.h / 2, z: s.d / 2 + 2.1 }, WOOD_D);
  },
  stonehouse(k, g, s, o) { house(k, g, { w: s.w, d: s.d, h: s.h, wall: 0xB0A496, roof: SLATE, trim: STONE_D, chimney: [-s.w * 0.25, s.d * 0.15], smoke: o.smoke }); },
  anvil(k) { k.box(0.5, 0.5, 0.4, { y: 0.25 }, DARK); k.box(1, 0.3, 0.45, { y: 0.6 }, IRON); k.cone(0.22, 0.5, { x: 0.7, y: 0.62, rz: -PI / 2 }, IRON, 6); },
  crates(k, g, s) {
    const c = s.wood ? WOOD_L : 0xC09A62;
    k.box(1.1, 1.1, 1.1, { x: -0.5, y: 0.55 }, c);
    k.box(1, 1, 1, { x: 0.65, y: 0.5, z: 0.2, ry: 0.3 }, WOOD);
    k.box(0.9, 0.9, 0.9, { x: -0.4, y: 1.55, z: 0.1, ry: 0.5 }, c);
    k.cyl(0.42, 0.42, 1.0, { x: 0.9, y: 0.5, z: -0.9 }, 0x8A5A38, 10);
  },
  basalt(k, g, s, o) {
    const r = s.r ?? 3, n = Math.round(r * 3.2);
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, d = Math.sqrt(i / n) * r, h = 1 + (1 - d / r) * r * 1.1 + (i * 37 % 10) / 10;
      k.cyl(0.5, 0.55, h, { x: Math.cos(a) * d, y: h / 2 - 0.2, z: Math.sin(a) * d }, i % 3 ? 0x4A4044 : 0x5E5258, 6);
      k.cyl(0.5, 0.5, 0.06, { x: Math.cos(a) * d, y: h - 0.17, z: Math.sin(a) * d }, 0x7A6E70, 6);
      if (i % 4 === 0) o.lit.cyl(0.04, 0.04, h * 0.7, { x: Math.cos(a) * d + 0.5, y: h * 0.35, z: Math.sin(a) * d }, 0xFF6A1F, 4);
    }
  },
  volcano(k, g, s, o) {
    k.cone(95, 70, { y: 25 }, 0x4A3A3A, 14);
    k.cone(60, 30, { y: 62, sy: 1 }, 0x5A4642, 14);
    o.lit.cyl(14, 16, 2, { y: 76.5 }, 0xFF6A1F, 14);
    for (let i = 0; i < 5; i++) { const a = i * 1.3; o.lit.box(1.6, 38, 1.2, { x: Math.cos(a) * 22, y: 58, z: Math.sin(a) * 22 - 12, rx: -0.5 * Math.sin(a), rz: 0.5 * Math.cos(a) }, 0xFF5A14); }
    o.smoke(0, 80, 0, 'volcano');
  },

  // ------------------------------------------------------------- mesa
  arch(k, g, s) {
    const span = s.span ?? 10, SAND = 0xC27A54, SAND2 = 0xD8956A;
    for (const sx of [1, -1]) for (let i = 0; i < 4; i++) k.rock(1.9 - i * 0.12, { x: sx * (span / 2 + 1.2) + (i % 2 ? 0.3 : -0.2), y: 1.2 + i * 2, sx: 1, sy: 1.15, sz: 1.2 }, i % 2 ? SAND : SAND2);
    for (let i = 0; i <= 9; i++) {
      const t = i / 9, x = (t - 0.5) * (span + 2.4), y = 8 + Math.sin(PI * t) * 1.6;
      k.rock(1.55, { x, y, sz: 1.3, ry: i }, i % 2 ? SAND : SAND2);
    }
  },
  mine(k, g, s) {
    k.box(6.8, 5.5, 2.6, { y: 2.5, z: -1.6 }, 0x8A6A54);
    k.box(4.2, 3.6, 0.2, { y: 1.8, z: -0.2 }, DARK);
    for (const sx of [1, -1]) k.box(0.45, 4, 0.45, { x: sx * 2.2, y: 2 }, WOOD_D);
    k.box(5.2, 0.5, 0.5, { y: 4.1 }, WOOD_D);
    k.box(1.6, 0.6, 0.12, { y: 4.8, z: 0.2 }, WOOD);
    g.ball(0.22, { x: 2.7, y: 3, z: 0.3 }, LIT, 8);
    for (let i = 0; i < 5; i++) k.rock(0.6 + (i % 3) * 0.3, { x: -3.6 + i * 1.8, y: 0.3, z: 0.9 + (i % 2) }, 0x9A7A64);
  },
  rails(k, g, s, o) {
    const kw = o.world, P = s.pts;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), n = Math.ceil(L / 0.8);
      for (let j = 0; j < n; j++) {
        const t = (j + 0.5) / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = o.P.height(x, z);
        kw.box(1.5, 0.12, 0.3, { x, y: y + 0.06, z, ry }, WOOD_D);
        for (const sx of [0.55, -0.55]) kw.box(0.08, 0.1, L / n + 0.02, { x: x + sx * Math.cos(ry), y: y + 0.17, z: z - sx * Math.sin(ry), ry }, IRON);
      }
    }
  },
  tent(k) {
    k.gable(3.4, 3.6, 0.1, 2.4, { x: 0 }, 0xE6D4B0, 0.08);
    k.gableEnds(3.4, 3.6, 0.1, 2.4, {}, 0xD8C49A);
    k.box(0.9, 1.4, 0.05, { y: 0.8, z: 1.82 }, 0x6A4A30);
    for (const sz of [1, -1]) k.box(0.1, 2.6, 0.1, { y: 1.3, z: sz * 1.9 }, WOOD_D);
  },

  // ------------------------------------------------------------- heights
  mast(k, g, s, o) {
    k.cyl(0.6, 1.1, 20, { y: 10 }, 0x8A8E98, 8);
    for (let y = 3; y < 19; y += 3) k.ring(0.95 - y * 0.02, 0.08, { y, rx: PI / 2 }, IRON, 12);
    k.cyl(2.4, 2.4, 0.3, { y: 15.5 }, WOOD, 12);
    k.box(0.4, 0.4, 4, { y: 17, z: 1.8 }, IRON);
    o.lit.ball(0.45, { y: 20.5 }, 0x8FE3FF, 10);
    k.cyl(1.6, 1.8, 0.6, { y: 0.3 }, STONE_D, 10);
  },
  airship(k, g, s, o) {
    const ship = o.part('airship', { x: 0, y: 17, z: 0 }, 'bob', 1);
    ship.ball(4.6, { sz: 2.1, sy: 0.95 }, 0xE6D8C0, 14);
    for (const r of [-0.9, 0, 0.9]) ship.ring(4.62, 0.08, { rz: 0, ry: PI / 2, z: r * 3.5, sx: 1, sy: 0.95 }, 0xB84A3A, 20);
    ship.box(2.4, 1.4, 5.2, { y: -5.6 }, WOOD);
    ship.box(2.6, 0.2, 5.6, { y: -4.85 }, WOOD_D);
    for (const sx of [1, -1]) for (const sz of [1.8, -1.8]) ship.box(0.06, 3.8, 0.06, { x: sx * 1.1, y: -3.4, z: sz }, DARK);
    for (const sx of [1, -1]) ship.box(0.1, 1.8, 2.4, { x: sx * 4.7, y: 0, z: -7.5 }, 0xB84A3A);
    ship.box(0.1, 2.2, 2.6, { y: 3.2, z: -8.4 }, 0xB84A3A);
    ship.cyl(0.25, 0.25, 0.9, { y: -5.6, z: -3, rx: PI / 2 }, IRON, 8);
    windows(ship, o.partGlow('airship'), [[1.22, -5.5, 0, PI / 2], [-1.22, -5.5, 0, -PI / 2]], 0.6, 0.5);
  },
  turbine(k, g, s, o) {
    k.cyl(0.45, 0.85, 16, { y: 8 }, 0xE8ECF0, 10);
    k.box(1.2, 1.2, 2.6, { y: 16.4, z: 0.2 }, 0xD8DDE4);
    k.cyl(1.4, 1.6, 0.6, { y: 0.3 }, STONE_D, 10);
    const rotor = o.part('rotor', { x: 0, y: 16.4, z: 1.6 }, 'spinZ', 1.6);
    rotor.cone(0.45, 0.9, { rx: PI / 2, z: 0.3 }, 0xF4F6F8, 8);
    for (let i = 0; i < 3; i++) { const a = i * 2 * PI / 3; rotor.box(0.5, 6.4, 0.12, { x: Math.sin(a) * 3.3, y: Math.cos(a) * 3.3, rz: -a }, 0xF4F6F8); }
    o.lit.ball(0.14, { y: 17.1, z: -1 }, 0xFF5A4A, 6);
  },
  crystals(k, g, s, o) {
    const r = s.r ?? 3, n = 7 + Math.round(r * 2), col = o.P.zone.element === 'volt' ? [0xFFE070, 0x8FE3FF] : [0xBFEFFF, 0xE8F8FF];
    for (let i = 0; i < n; i++) {
      const a = i * 2.39, d = Math.sqrt(i / n) * r * 0.8, h = (1 - d / r) * r * 1.7 + 0.8;
      const rx = (Math.sin(a) * d / r) * 0.5, rz = -(Math.cos(a) * d / r) * 0.5;
      (i % 3 ? k : o.lit).cone(0.35 + (h / 6) * 0.3, h, { x: Math.cos(a) * d, y: h / 2, z: Math.sin(a) * d, rx, rz }, col[i % 2], 6);
    }
    for (let i = 0; i < 4; i++) k.rock(0.8, { x: Math.cos(i * 1.7) * r * 0.9, y: 0.2, z: Math.sin(i * 1.7) * r * 0.9 }, 0x6A7480);
  },

  // ------------------------------------------------------------- coast
  stilthouse(k, g, s, o) {
    const y0 = Math.max(0, o.P.level - s.y + 1.6);
    for (const sx of [1, -1]) for (const sz of [1, -1]) k.cyl(0.18, 0.22, y0 + 2, { x: sx * 2.6, y: y0 / 2 - 0.8, z: sz * 2.4 }, WOOD_D, 6);
    k.box(6.4, 0.25, 6, { y: y0 }, PLANK);
    const kk = { box: (w, h, d, q, c) => k.box(w, h, d, { ...q, y: (q?.y ?? 0) + y0 }, c), gable: (w, d, a, b, q, c, t) => k.gable(w, d, a + y0, b + y0, q, c, t), gableEnds: (w, d, a, b, q, c) => k.gableEnds(w, d, a + y0, b + y0, q, c) };
    const gg = { box: (w, h, d, q, c) => g.box(w, h, d, { ...q, y: (q?.y ?? 0) + y0 }, c) };
    house(kk, gg, { w: 5, d: 4.6, h: 2.8, wall: 0xE8D8BC, roof: THATCH, trim: WOOD_D });
    k.box(0.06, 0.06, 2, { x: 3.2, y: y0 + 1.2, z: 0, rx: 0.3 }, 0x6A6A6A);
  },
  boat(k, g, s, o) {
    const y = o.P.level - s.y;
    k.box(2.1, 0.7, 5.2, { y: y + 0.2 }, s.i % 2 ? 0x3A6A9A : 0xB84A3A);
    k.box(1.7, 0.2, 4.6, { y: y + 0.5 }, PLANK);
    k.cone(1.05, 1.4, { y: y + 0.2, z: 3.2, rx: PI / 2, sy: 1, sx: 1, sz: 0.66 }, s.i % 2 ? 0x3A6A9A : 0xB84A3A, 4);
    k.cyl(0.07, 0.08, 4.5, { y: y + 2.6, z: 0.4 }, WOOD, 6);
    k.box(0.05, 2.8, 1.8, { y: y + 2.8, z: -0.4 }, WHITE);
  },
  lighthouse(k, g, s, o) {
    for (let i = 0; i < 6; i++) k.cyl(2.5 - (i + 1) * 0.16, 2.5 - i * 0.16, 2.5, { y: 1.25 + i * 2.5 }, i % 2 ? RED : WHITE, 12);
    k.cyl(2.4, 2.4, 0.3, { y: 15.1 }, DARK, 12);
    k.ring(2.3, 0.06, { y: 15.9, rx: PI / 2 }, DARK, 16);
    o.lit.cyl(1.2, 1.2, 1.6, { y: 16.1 }, 0xFFF0B0, 10);
    k.cone(1.7, 1.6, { y: 17.7 }, RED, 10);
    k.ball(0.2, { y: 18.6 }, DARK, 6);
    k.box(1.1, 2, 0.15, { y: 1, z: 2.42 }, WOOD_D);
    o.beacon(0, 16.1, 0);
  },

  // ------------------------------------------------------------- frost
  cabin(k, g, s, o) {
    const { w, d, h } = s;
    k.box(w + 0.3, 0.3, d + 0.3, { y: 0.15 }, STONE_D);
    for (let y = 0.45; y < h; y += 0.42) {
      k.cyl(0.21, 0.21, d + 0.6, { x: w / 2, y, rx: PI / 2 }, y % 0.84 > 0.4 ? 0x8A5A3A : 0x7A4E32, 6);
      k.cyl(0.21, 0.21, d + 0.6, { x: -w / 2, y, rx: PI / 2 }, y % 0.84 > 0.4 ? 0x8A5A3A : 0x7A4E32, 6);
      k.cyl(0.21, 0.21, w + 0.6, { z: d / 2, y: y + 0.21, rz: PI / 2 }, 0x7E5234, 6);
      k.cyl(0.21, 0.21, w + 0.6, { z: -d / 2, y: y + 0.21, rz: PI / 2 }, 0x7E5234, 6);
    }
    k.box(w - 0.2, h, d - 0.2, { y: h / 2 }, 0x6A4430);
    const ridge = h + w * 0.45;
    k.gableEnds(w, d, h, ridge, {}, 0x7A4E32);
    k.gable(w, d, h, ridge, {}, 0xF4F8FF, 0.32);
    k.box(1.1, 1.9, 0.12, { y: 1.05, z: d / 2 + 0.25 }, WOOD_D);
    windows(k, g, [[w / 4 + 0.4, h * 0.55, d / 2 + 0.24], [-w / 2 - 0.24, h * 0.55, 0, -PI / 2]], 0.7, 0.7);
    k.box(0.8, 2.6, 0.8, { x: -w * 0.28, y: ridge - 0.2, z: -d * 0.2 }, STONE_D);
    o.smoke(-w * 0.28, ridge + 1.2, -d * 0.2);
    k.box(1.6, 0.9, 0.9, { x: w / 2 + 0.9, y: 0.45, z: d / 4 }, 0x9A6A44);
  },
  spire(k, g, s, o) {
    const r = s.r ?? 2.5;
    k.cone(r, r * 4.2, { y: r * 2.1 }, 0xBFE4F8, 6);
    k.cone(r * 0.6, r * 2.6, { x: r * 0.8, y: r * 1.3, z: 0.3, rz: -0.25 }, 0xD8F0FF, 6);
    k.cone(r * 0.5, r * 2, { x: -r * 0.7, y: r, z: -0.4, rz: 0.3 }, 0xA8D8F2, 6);
    o.lit.cone(r * 0.25, r * 1.2, { y: r * 3.6 }, 0xEAF8FF, 6);
    k.rock(r * 0.7, { y: 0, sy: 0.5 }, 0xE8F0F8);
  },

  // ------------------------------------------------------------- grove
  gianttree(k, g, s, o) {
    const r = s.r ?? 2.6;
    k.cyl(r * 0.7, r, 24, { y: 12 }, 0x4A3A44, 10);
    for (let i = 0; i < 6; i++) { const a = i * 1.05; k.cone(r * 0.6, 4, { x: Math.cos(a) * r * 0.95, y: 1, z: Math.sin(a) * r * 0.95, rx: Math.sin(a) * 1.1, rz: -Math.cos(a) * 1.1 }, 0x3E3038, 6); }
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9, d = i ? r * 2.6 : 0;
      k.ball(r * (i ? 2.4 : 3.2), { x: Math.cos(a) * d, y: 27 + (i % 3) * 2, z: Math.sin(a) * d, sy: 0.7 }, i % 2 ? 0x3A3A6A : 0x2E4A54, 9);
    }
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.4; o.lit.ball(0.35, { x: Math.cos(a) * r * 1.02, y: 3 + i * 1.5, z: Math.sin(a) * r * 1.02 }, 0x7FF0E0, 6); }
  },
  mushroom(k, g, s, o) {
    const r = s.r ?? 1.2;
    k.cyl(r * 0.28, r * 0.38, r * 2.2, { y: r * 1.1 }, 0xE6DCEC, 8);
    k.ball(r * 1.3, { y: r * 2.3, sy: 0.55 }, 0x5A4A9A, 12);
    o.lit.cyl(r * 1.15, r * 1.15, 0.05, { y: r * 2.1 }, 0x6FF0E0, 12);
    for (let i = 0; i < 6; i++) { const a = i * 1.1; o.lit.ball(r * 0.16, { x: Math.cos(a) * r * 0.75, y: r * 2.55 + (i % 2) * 0.08, z: Math.sin(a) * r * 0.75 }, 0x8FF6EA, 6); }
    for (let i = 0; i < 3; i++) { const a = i * 2.2 + 0.5; k.cyl(r * 0.1, r * 0.13, r * 0.8, { x: Math.cos(a) * r * 1.4, y: r * 0.4, z: Math.sin(a) * r * 1.4 }, 0xE6DCEC, 6); o.lit.ball(r * 0.3, { x: Math.cos(a) * r * 1.4, y: r * 0.85, z: Math.sin(a) * r * 1.4, sy: 0.55 }, 0x8FF6EA, 8); }
  },
  temple(k, g, s, o) {
    const SA = 0x9A94A8, SB = 0x7A748A;
    for (let i = 0; i < 3; i++) k.box(15 - i * 2, 0.8, 13 - i * 2, { y: 0.4 + i * 0.8, z: -1 }, i % 2 ? SA : SB);
    for (let i = 0; i < 4; i++) k.box(5, 0.4, 0.9, { y: 0.2 + i * 0.4, z: 6.2 - i * 0.6 }, SA);
    for (const sx of [-4.2, -1.4, 1.4, 4.2]) for (const sz of [3, -5]) k.cyl(0.55, 0.65, 6, { x: sx, y: 5.4, z: sz }, 0xC8C2D4, 8);
    k.box(11, 0.8, 10, { y: 8.8, z: -1 }, SB);
    k.cone(7.6, 4, { y: 11.2, z: -1, ry: PI / 4, sz: 0.9 }, 0x4A3A7A, 4);
    k.box(4, 4.5, 0.6, { y: 4.6, z: -5.2 }, SB);
    o.lit.ring(0.9, 0.12, { y: 6, z: -4.85 }, 0xB18CFF, 16);
    o.lit.ball(0.4, { y: 6, z: -4.85 }, 0xE0C8FF, 8);
    for (const sx of [1, -1]) g.ball(0.3, { x: sx * 2.8, y: 3.6, z: 6.4 }, LIT, 8);
  },
  ruinwall(k, g, s) {
    const L = s.len ?? 10, n = Math.round(L / 1.6);
    for (let i = 0; i < n; i++) {
      const h = 1.2 + ((i * 53) % 7) / 7 * 3.2 * (i % 4 === 3 ? 0.3 : 1);
      k.box(L / n + 0.02, h, 1.4, { x: -L / 2 + (i + 0.5) * L / n, y: h / 2 }, i % 2 ? 0x8A8494 : 0x7A7486);
      if (i % 3 === 0) k.box(L / n * 0.7, 0.18, 1.2, { x: -L / 2 + (i + 0.5) * L / n, y: h + 0.05 }, 0x4A6A44);
    }
    for (let i = 0; i < 4; i++) k.rock(0.5 + (i % 2) * 0.3, { x: -L / 2 + i * L / 3, y: 0.2, z: 1.3 * (i % 2 ? 1 : -1) }, 0x8A8494);
  },
  ruintower(k, g) {
    k.cyl(3, 3.3, 7, { y: 3.5 }, 0x7A7486, 10);
    for (let i = 0; i < 6; i++) { const a = i * PI / 3; if (i % 2) k.box(1.4, 1.2, 0.8, { x: Math.cos(a) * 2.8, y: 7.4, z: Math.sin(a) * 2.8, ry: -a }, 0x8A8494); }
    k.box(1.2, 2, 0.4, { y: 1, z: 3.1 }, DARK);
    for (let i = 0; i < 5; i++) k.rock(0.6, { x: Math.cos(i * 1.4) * 4.4, y: 0.25, z: Math.sin(i * 1.4) * 4.4 }, 0x8A8494);
    k.box(2.6, 0.2, 2.6, { y: 7.05 }, 0x4A6A44);
  },
  lanterns(k, g, s, o) {
    const P = s.pts;
    let run = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az);
      for (let d = (12 - run) % 12; d < L; d += 12) {
        const t = d / L, nx = -(bz - az) / L, nz = (bx - ax) / L, x = ax + (bx - ax) * t + nx * 2.2, z = az + (bz - az) * t + nz * 2.2, y = o.P.height(x, z);
        o.world.cyl(0.07, 0.09, 2.4, { x, y: y + 1.2, z }, DARK, 6);
        o.world.box(0.6, 0.06, 0.06, { x: x + nx * 0.25, y: y + 2.35, z: z + nz * 0.25, ry: Math.atan2(nx, nz) + PI / 2 }, DARK);
        o.glow.ball(0.2, { x: x + nx * 0.5, y: y + 2.15, z: z + nz * 0.5 }, 0x8FF6EA, 8);
      }
      run = (run + L) % 12;
    }
  },
};

export const BUILT_KINDS = Object.keys(BUILDERS);
