// What the tailor sells (shared/cosmetics.js), as things a model wears
// (heroes.js): hats, glasses, and what goes on the back or round the neck.
//
// Each is a few simple shapes in the game's cel shading with an ink outline,
// built in the frame of what it sits on and fixed to that bone:
//   head  — origin at the top of the head, y up, +z the way the face looks,
//           one unit half the head's width; the head is `hy` high and `hz`
//           deep (in those units, either side of its middle);
//   back  — origin at the top of the body (the base of the neck), the middle
//           of its depth; one unit half the body's width; `hz` its half-depth,
//           `hy` its height.
import {
  BackSide, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial,
  MeshToonMaterial, Shape, SphereGeometry, TorusGeometry, BoxGeometry, CapsuleGeometry,
} from 'three';
import { QUALITY, STYLE, toonGradient } from './core.js';

const mats = new Map();
function toon(c, glow = 0) {
  const key = `${c}|${glow}`;
  let m = mats.get(key);
  if (!m) {
    m = new MeshToonMaterial({ color: c, gradientMap: toonGradient(STYLE.bands) });
    if (glow) { m.emissive = new Color(c); m.emissiveIntensity = glow; }
    mats.set(key, m);
  }
  return m;
}
const inks = new Map();
/** An ink line round a shape: its back faces, pushed out along the normal. */
function ink(t) {
  const key = t.toFixed(4);
  let m = inks.get(key);
  if (!m) {
    m = new MeshBasicMaterial({ color: STYLE.outlineColor, side: BackSide, transparent: true, opacity: STYLE.outlineOpacity, depthWrite: false });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normal * ${t.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => `wardrobe-ink-${key}`;
    inks.set(key, m);
  }
  return m;
}

const shade = (c, k) => { const x = new Color(c); x.r *= k; x.g *= k; x.b *= k; return x.getHex(); };

/** A part: geometry, colour, where, turned, squashed. */
function part(g, geo, c, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], o = {}) {
  const m = new Mesh(geo, toon(c, o.glow || 0));
  m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
  m.castShadow = true;
  if (g.userData.ol && !o.noInk) {
    const line = new Mesh(geo, ink(g.userData.ol / Math.max(1e-3, Math.min(...s.map(Math.abs)))));
    line.userData.noOutline = true;
    m.add(line);
  }
  m.userData.noOutline = true;
  g.add(m);
  return m;
}

const dome = (r = 1, seg = 22) => new SphereGeometry(r, seg, Math.round(seg / 2), 0, Math.PI * 2, 0, Math.PI / 2);
const disc = (r, h, seg = 28, start = 0, len = Math.PI * 2) => new CylinderGeometry(r, r, h, seg, 1, false, start, len);
function star(R, r, n = 5) {
  const s = new Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2, k = i % 2 ? r : R;
    i ? s.lineTo(Math.cos(a) * k, Math.sin(a) * k) : s.moveTo(Math.cos(a) * k, Math.sin(a) * k);
  }
  return s;
}

const start = (d) => { const g = new Group(); g.userData.ol = QUALITY.tier === 'low' ? 0 : d.ol || 0; g.name = 'worn'; return g; };

// -- hats ------------------------------------------------------------------------------
// the crown of a hat sits over the head's top: `y0` down from the top, how far
// a brim comes out in front
const HATS = {
  cap(g, c, d) {
    part(g, dome(1.08), c, [0, -0.32, -0.04], [0, 0, 0], [1, 0.7, d.hz * 1.02]);
    part(g, disc(0.95, 0.06, 24, -Math.PI / 2, Math.PI), shade(c, 0.8), [0, -0.3, d.hz * 0.55], [0.12, 0, 0], [1, 1, 0.95]);
    part(g, new SphereGeometry(0.1, 10, 6), shade(c, 0.85), [0, 0.42, -0.04]);
  },
  // a trainer's cap: a white front panel with the sphere's mark on it
  trainer(g, c, d) {
    part(g, dome(1.08), c, [0, -0.32, -0.04], [0, 0, 0], [1, 0.7, d.hz * 1.02]);
    part(g, new SphereGeometry(1.1, 20, 10, Math.PI * 0.18, Math.PI * 0.64, 0, Math.PI / 2), 0xf4f3ee, [0, -0.32, -0.02], [0, 0, 0], [1, 0.72, d.hz * 1.03]);
    part(g, disc(0.95, 0.06, 24, -Math.PI / 2, Math.PI), c, [0, -0.3, d.hz * 0.55], [0.12, 0, 0], [1, 1, 0.95]);
    const mark = part(g, disc(0.2, 0.05, 18), 0x2fb27a, [0, 0.0, d.hz * 0.95], [Math.PI / 2 - 0.55, 0, 0]);
    mark.scale.set(1, 1, 1);
    part(g, new SphereGeometry(0.1, 10, 6), c, [0, 0.42, -0.04]);
  },
  bandana(g, c, d) {
    part(g, dome(1.06), c, [0, -0.42, -0.02], [0, 0, 0], [1, 0.66, d.hz * 1.03]);
    part(g, new SphereGeometry(0.2, 10, 8), shade(c, 0.85), [0, -0.5, -d.hz * 1.04], [0, 0, 0], [1, 0.8, 0.7]);
    for (const sx of [-1, 1]) part(g, new ConeGeometry(0.14, 0.55, 8), shade(c, 0.85), [sx * 0.16, -0.78, -d.hz * 1.06], [0.25, 0, sx * 0.35]);
  },
  beanie(g, c, d) {
    part(g, dome(1.07), c, [0, -0.38, -0.02], [0, 0, 0], [1, 0.95, d.hz * 1.03]);
    part(g, new TorusGeometry(1.03, 0.14, 8, 28), shade(c, 0.78), [0, -0.38, -0.02], [Math.PI / 2, 0, 0], [1, d.hz, 1]);
    part(g, new SphereGeometry(0.24, 12, 8), 0xf4f3ee, [0, 0.66, -0.06]);
  },
  // a beanie like a sphere: red over a black band, a white button in front
  sphere(g, c, d) {
    part(g, dome(1.07), c, [0, -0.38, -0.02], [0, 0, 0], [1, 0.95, d.hz * 1.03]);
    part(g, new TorusGeometry(1.04, 0.12, 8, 28), 0x23232c, [0, -0.38, -0.02], [Math.PI / 2, 0, 0], [1, d.hz, 1]);
    part(g, disc(0.24, 0.1, 18), 0xf4f3ee, [0, -0.38, d.hz * 1.1], [Math.PI / 2, 0, 0]);
    part(g, disc(0.13, 0.12, 14), 0x23232c, [0, -0.38, d.hz * 1.12], [Math.PI / 2, 0, 0], [1, 1, 1], { noInk: true });
  },
  flowers(g, c, d) {
    part(g, new TorusGeometry(1.02, 0.06, 6, 30), c, [0, -0.28, 0], [Math.PI / 2 - 0.12, 0, 0], [1, d.hz, 1]);
    const cols = [0xff8ab4, 0xffffff, 0xffd23d, 0xc89aff];
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.36;
      const p = [Math.sin(a) * 1.04, -0.28 + Math.cos(a) * 0.12, Math.cos(a) * d.hz * 1.04];
      part(g, new SphereGeometry(0.17, 10, 6), cols[i % 4], p, [0, 0, 0], [1, 0.55, 1]);
      part(g, new SphereGeometry(0.07, 8, 5), 0xffc43a, [p[0], p[1] + 0.05, p[2] + 0.03], [0, 0, 0], [1, 1, 1], { noInk: true });
    }
  },
  cowboy(g, c, d) {
    part(g, new CylinderGeometry(0.72, 0.86, 0.75, 20), c, [0, 0.12, 0], [0, 0, 0], [1, 1, d.hz]);
    part(g, new SphereGeometry(0.3, 10, 6), shade(c, 0.9), [0, 0.5, 0], [0, 0, 0], [1.6, 0.4, 0.8]);
    part(g, new CylinderGeometry(0.88, 0.88, 0.14, 20), shade(c, 0.55), [0, -0.12, 0], [0, 0, 0], [1, 1, d.hz]);
    part(g, disc(1.75, 0.06, 32), c, [0, -0.22, 0], [0, 0, 0], [1, 1, 0.9 * d.hz]);
  },
  catears(g, c) {
    for (const sx of [-1, 1]) {
      part(g, new ConeGeometry(0.34, 0.75, 4), c, [sx * 0.6, 0.15, -0.05], [0, Math.PI / 4, sx * -0.35], [1, 1, 0.55]);
      part(g, new ConeGeometry(0.2, 0.48, 4), 0xff9ab8, [sx * 0.6, 0.1, 0.06], [0, Math.PI / 4, sx * -0.35], [1, 1, 0.3], { noInk: true });
    }
  },
  wizard(g, c, d) {
    part(g, disc(1.75, 0.07, 32), shade(c, 0.75), [0, -0.2, 0], [-0.08, 0, 0], [1, 1, 0.92 * d.hz]);
    part(g, new ConeGeometry(0.95, 1.7, 20), c, [0, 0.66, -0.05], [-0.12, 0, 0]);
    part(g, new ConeGeometry(0.34, 0.85, 12), c, [0.18, 1.7, -0.42], [-0.9, 0, -0.3]);
    part(g, new CylinderGeometry(0.93, 0.98, 0.16, 20), 0xe8c05a, [0, -0.08, -0.01], [-0.12, 0, 0]);
    part(g, new ExtrudeGeometry(star(0.24, 0.1), { depth: 0.05, bevelEnabled: false }), 0xfbe38c, [-0.3, 0.5, 0.74], [-0.3, 0, 0], [1, 1, 1], { glow: 0.4 });
  },
  tophat(g, c, d) {
    part(g, new CylinderGeometry(0.76, 0.8, 1.35, 22), c, [0, 0.42, 0], [-0.05, 0, 0], [1, 1, d.hz]);
    part(g, new CylinderGeometry(0.81, 0.82, 0.2, 22), 0xb8283c, [0, -0.12, 0], [-0.05, 0, 0], [1, 1, d.hz]);
    part(g, disc(1.22, 0.06, 28), c, [0, -0.24, 0], [-0.05, 0, 0], [1, 1, 0.92 * d.hz]);
  },
  crown(g, c, d) {
    part(g, new CylinderGeometry(0.82, 0.8, 0.32, 24, 1, true), c, [0, -0.02, 0], [0, 0, 0], [1, 1, d.hz]);
    const gems = [0xe8303a, 0x2f6ad8, 0x3ac85a];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2, x = Math.sin(a) * 0.82, z = Math.cos(a) * 0.82 * d.hz;
      part(g, new ConeGeometry(0.17, 0.42, 4), c, [x, 0.33, z], [0, -a, 0]);
      part(g, new SphereGeometry(0.09, 8, 6), gems[i % 3], [x * 1.04, -0.02, z * 1.04], [0, 0, 0], [1, 1, 1], { glow: 0.3, noInk: true });
    }
  },
  halo(g, c) {
    part(g, new TorusGeometry(0.75, 0.08, 8, 32), c, [0, 0.55, -0.1], [Math.PI / 2 - 0.25, 0, 0], [1, 1, 1], { glow: 1, noInk: true });
  },
  horns(g, c) {
    for (const sx of [-1, 1]) {
      part(g, new ConeGeometry(0.22, 0.6, 10), c, [sx * 0.62, -0.05, 0.2], [0.1, 0, sx * -0.7]);
      part(g, new ConeGeometry(0.11, 0.42, 8), 0xff6a2a, [sx * 0.95, 0.32, 0.1], [-0.4, 0, sx * -0.2], [1, 1, 1], { glow: 0.5 });
    }
  },
  // headphones: a band over the top, a cup on each ear
  headphones(g, c, d) {
    part(g, new TorusGeometry(1.12, 0.09, 8, 24, Math.PI), shade(c, 0.6), [0, -0.62, -0.05]);
    for (const sx of [-1, 1]) {
      part(g, disc(0.42, 0.26, 18), c, [sx * 1.12, -0.7, -0.05], [0, 0, Math.PI / 2]);
      part(g, disc(0.3, 0.06, 16), 0x23232c, [sx * 1.27, -0.7, -0.05], [0, 0, Math.PI / 2], [1, 1, 1], { noInk: true });
    }
  },
  straw(g, c, d) {
    part(g, new CylinderGeometry(0.78, 0.9, 0.5, 20), c, [0, 0.02, 0], [0, 0, 0], [1, 1, d.hz]);
    part(g, dome(0.78, 20), c, [0, 0.27, 0], [0, 0, 0], [1, 0.4, d.hz]);
    part(g, new CylinderGeometry(0.91, 0.91, 0.16, 20), 0xd83a3a, [0, -0.12, 0], [0, 0, 0], [1, 1, d.hz]);
    part(g, disc(1.85, 0.05, 32), shade(c, 0.95), [0, -0.22, 0], [0, 0, 0], [1, 1, 0.92 * d.hz]);
  },
};

// -- glasses ---------------------------------------------------------------------------
// at the eyes: a little under the middle of the head, just proud of the face
const eyes = (d) => ({ y: -d.hy * 1.12, z: d.hz * 1.02 });
const FACES = {
  round(g, c, d) {
    const { y, z } = eyes(d);
    for (const sx of [-1, 1]) {
      part(g, new TorusGeometry(0.24, 0.035, 6, 20), c, [sx * 0.36, y, z]);
      part(g, disc(0.22, 0.01, 18), 0xd8f0ff, [sx * 0.36, y, z - 0.005], [Math.PI / 2, 0, 0], [1, 1, 1], { noInk: true }).material.transparent = false;
      part(g, new CylinderGeometry(0.03, 0.03, d.hz * 1.9, 6), c, [sx * 0.62, y + 0.04, 0], [Math.PI / 2, 0, 0], [1, 1, 1], { noInk: true });
    }
    part(g, new CylinderGeometry(0.03, 0.03, 0.26, 6), c, [0, y + 0.06, z], [0, 0, Math.PI / 2], [1, 1, 1], { noInk: true });
  },
  shades(g, c, d) {
    const { y, z } = eyes(d);
    for (const sx of [-1, 1]) {
      part(g, new BoxGeometry(0.5, 0.3, 0.06), c, [sx * 0.34, y, z], [0, sx * -0.08, 0]);
      part(g, new CylinderGeometry(0.03, 0.03, d.hz * 1.9, 6), 0x23232c, [sx * 0.62, y + 0.06, 0], [Math.PI / 2, 0, 0], [1, 1, 1], { noInk: true });
    }
    part(g, new BoxGeometry(0.28, 0.06, 0.05), 0x23232c, [0, y + 0.08, z]);
  },
  star(g, c, d) {
    const { y, z } = eyes(d);
    for (const sx of [-1, 1]) {
      part(g, new ExtrudeGeometry(star(0.33, 0.16), { depth: 0.05, bevelEnabled: false }), c, [sx * 0.37, y, z - 0.02], [0, 0, sx * 0.15]);
      part(g, new CylinderGeometry(0.03, 0.03, d.hz * 1.9, 6), c, [sx * 0.66, y + 0.04, 0], [Math.PI / 2, 0, 0], [1, 1, 1], { noInk: true });
    }
  },
  // a racer's goggles, pushed up on the forehead
  goggles(g, c, d) {
    const y = -d.hy * 0.62;
    part(g, new TorusGeometry(1.03, 0.08, 6, 30), 0x3a3036, [0, y, 0], [Math.PI / 2, 0, 0], [1, d.hz, 1]);
    for (const sx of [-1, 1]) {
      part(g, disc(0.27, 0.16, 18), c, [sx * 0.33, y + 0.03, d.hz * 1.05], [Math.PI / 2 - 0.3, 0, 0]);
      part(g, disc(0.2, 0.05, 16), 0x9fe8ff, [sx * 0.33, y + 0.05, d.hz * 1.13], [Math.PI / 2 - 0.3, 0, 0], [1, 1, 1], { noInk: true, glow: 0.25 });
    }
  },
};

// -- the back and the neck -------------------------------------------------------------
const BACKS = {
  backpack(g, c, d) {
    const z = -d.hz - 0.42;
    part(g, new CapsuleGeometry(0.55, 0.5, 6, 12), c, [0, -d.hy * 0.5, z], [0, 0, 0], [1.15, 1, 0.7]);
    part(g, new CapsuleGeometry(0.42, 0.2, 6, 12), shade(c, 0.82), [0, -d.hy * 0.42, z - 0.32], [0, 0, 0], [1.1, 0.8, 0.5]);
    part(g, new SphereGeometry(0.09, 8, 6), 0xe8c05a, [0, -d.hy * 0.32, z - 0.55], [0, 0, 0], [1, 1, 1], { noInk: true });
    part(g, new CylinderGeometry(0.3, 0.3, 1.2, 14), 0xb8875a, [0, -d.hy * 0.08, z - 0.05], [0, 0, Math.PI / 2]);
    for (const sx of [-1, 1]) part(g, new BoxGeometry(0.2, d.hy * 0.85, 0.08), shade(c, 0.6), [sx * 0.5, -d.hy * 0.38, d.hz + 0.02], [0.1, 0, 0], [1, 1, 1], { noInk: true });
  },
  // a sphere worn as a pack: red over white, a black band, the button
  sphere(g, c, d) {
    const z = -d.hz - 0.6, y = -d.hy * 0.45;
    part(g, new SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c, [0, y, z]);
    part(g, new SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0xf4f3ee, [0, y, z]);
    part(g, new TorusGeometry(0.7, 0.06, 6, 28), 0x23232c, [0, y, z], [Math.PI / 2, 0, 0], [1, 1, 1], { noInk: true });
    part(g, disc(0.2, 0.12, 16), 0xf4f3ee, [0, y, z - 0.68], [Math.PI / 2, 0, 0]);
    for (const sx of [-1, 1]) part(g, new BoxGeometry(0.18, d.hy * 0.85, 0.08), 0x3a3036, [sx * 0.5, -d.hy * 0.38, d.hz + 0.02], [0.1, 0, 0], [1, 1, 1], { noInk: true });
  },
  wings(g, c, d) {
    // spread up and out from between the shoulders, each three feathers deep
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const a = sx * (0.75 + i * 0.42), len = 1.15 - i * 0.2;
        part(g, new SphereGeometry(1, 14, 10), i % 2 ? shade(c, 0.9) : c,
          [sx * 0.3 + Math.sin(-a) * -len * 0.75, -d.hy * 0.3 + Math.cos(a) * len * 0.75, -d.hz - 0.3 - i * 0.04],
          [0.25, sx * 0.35, -a], [0.32, len, 0.09], { glow: 0.15 });
      }
    }
  },
  scarf(g, c, d) {
    part(g, new TorusGeometry(0.62, 0.22, 10, 24), c, [0, 0.02, 0], [Math.PI / 2, 0, 0], [1, d.hz * 1.15, 1.15]);
    part(g, new BoxGeometry(0.34, 0.85, 0.12), shade(c, 0.88), [0.3, -0.42, d.hz * 0.95], [0.15, 0, 0.12]);
    part(g, new BoxGeometry(0.34, 0.6, 0.12), c, [-0.1, -0.32, d.hz * 1.0], [0.2, 0, -0.18]);
  },
};

/** A hat from the tailor, in the head's frame, or null. */
export function buildHat(shape, color, d) {
  if (!HATS[shape]) return null;
  const g = start(d);
  HATS[shape](g, color, d);
  // a hood is rounder than a head: a hat sits down onto it
  if (d.hood) for (const c of g.children) c.position.y -= 0.12;
  return g;
}

/** Glasses (and the like), in the head's frame, or null. */
export function buildFace(shape, color, d) {
  if (!FACES[shape]) return null;
  const g = start(d);
  FACES[shape](g, color, d);
  return g;
}

/** What goes on the back or round the neck, in the body's frame, or null. */
export function buildBack(shape, color, d) {
  if (!BACKS[shape]) return null;
  const g = start(d);
  BACKS[shape](g, color, d);
  return g;
}

export const WEAR_SHAPES = { hat: Object.keys(HATS), face: Object.keys(FACES), back: Object.keys(BACKS) };
