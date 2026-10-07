/**
 * The people: player characters sculpted the way the creatures are.
 *
 * Seven kinds of adventurer — rogue, pirate, fire keeper, catcher, ranger, mage
 * and explorer — each a vinyl figure from the figurine engine: a soft body of
 * blended shapes with the clothes moulded and painted into it, the hard kit
 * (brims, blades, a bow, a staff, spheres) as geometry bound to the bone that
 * carries it, eyes the shader draws and blinks. What makes each one is its
 * silhouette, readable from the camera's height at a glance, not a palette:
 * a player picks a kind, one of two looks and a skin tone, and that is all.
 *
 * Proportions are a stylised adult's, a little over three heads tall — the
 * creatures are the cute ones. Coordinates as in figurine-designs.js: y up,
 * facing +z, x is the figure's left (the viewer's right), `mir` makes the
 * other side and swaps an L bone for its R.
 */
import { Color, Euler, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { BOX, CONE, ELLIPSOID, PAINT, SPHERE, TORUS, CARVE, instance, setFigurineLod } from './figurine.js';
import { AVATAR } from '../../shared/gamedata.js';
import { DYES, HATS } from '../../shared/cosmetics.js';

// -- the vocabulary (as in figurine-designs.js) ---------------------------------
const S = (bone, c, p, r, k = 0.03, o) => ({ t: SPHERE, bone, c, p, r, k, ...o });
const E = (bone, c, p, r, k = 0.03, o) => ({ t: ELLIPSOID, bone, c, p, r, k, ...o });
const C = (bone, c, a, b, r1, r2, k = 0.03, o) => ({ t: CONE, bone, c, a, b, r1, r2, k, ...o });
const Bx = (bone, c, p, h, round, k = 0.03, o) => ({ t: BOX, bone, c, p, h, round, k, ...o });
const Tr = (bone, c, p, R, r, k = 0.02, o) => ({ t: TORUS, bone, c, p, R, r, k, ...o });
const paint = (c, part, soft = 0.006, o) => ({ ...part, op: PAINT, c, soft, ...o });
const carve = (part, k = 0.01, c) => ({ ...part, op: CARVE, k, ...(c != null ? { c } : {}) });
const mir = (x) => ({ ...x, mirror: true });
/** Headwear a kind is drawn with: taken off when a hat from the tailor is worn. */
const hw = (x) => ({ ...x, hw: true });

const tube = (bone, c, a, b, r, o) => ({ kind: 'tube', bone, c, a, b, r, ...o });
const horn = (bone, c, a, b, r, o) => ({ kind: 'horn', bone, c, a, b, r, ...o });
const plate = (bone, c, shape, depth, place, o) => ({ kind: 'plate', bone, c, shape, depth, place, ...o });
const crystal = (bone, c, a, dir, len, r, o) => ({ kind: 'crystal', bone, c, a, dir, len, r, ...o });
const flame = (bone, a, dir, len, r, o) => ({ kind: 'flame', bone, a, dir, len, r, glow: 1, ...o });
const ball = (bone, c, p, r, o) => ({ kind: 'ball', bone, c, p, r, ...o });
const ring = (bone, c, p, R, r, rot, o) => ({ kind: 'ring', bone, c, p, R, r, rot, ...o });

const hex = (c) => new Color(c).getHex();
const shade = (c, k) => { const x = new Color(c); x.multiplyScalar(k); return x.getHex(); };
const mixC = (a, b, t) => new Color(a).lerp(new Color(b), t).getHex();
/** Euler angles (XYZ, as a part's `rot` wants) for a yaw about y after a tilt about x. */
const yawTilt = (yaw, tilt, roll = 0) => {
  const e = new Euler().setFromRotationMatrix(new Matrix4().makeRotationY(yaw).multiply(new Matrix4().makeRotationX(tilt)).multiply(new Matrix4().makeRotationZ(roll)), 'XYZ');
  return [e.x, e.y, e.z];
};
/** A plate lying flat (its outline in x/z), at `o`, tipped forward by `tilt`. */
const flat = (o, tilt = 0) => ({ o, x: [1, 0, 0], y: [0, Math.sin(tilt), Math.cos(tilt)], z: [0, Math.cos(tilt), -Math.sin(tilt)] });

// -- outlines for plates ----------------------------------------------------------
/** A blade: a long point, `l` along +x, `w` wide at the base, bellied by `curve`. */
const bladeShape = (l, w, curve = 0) => {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([t * l, w * 0.5 * (1 - t * t * 0.85) + curve * Math.sin(Math.PI * t) * l]); }
  pts.push([l * 1.04, curve * 0.2 * l]);
  for (let i = 10; i >= 0; i--) { const t = i / 10; pts.push([t * l, -w * 0.5 * (1 - Math.pow(t, 1.6)) + curve * Math.sin(Math.PI * t) * l * 0.6]); }
  return pts;
};
/** A rounded rectangle, centred. */
const rectShape = (w, h, r = 0.2) => {
  const pts = [], rr = Math.min(w, h) * r;
  const corner = (cx, cy, a0) => { for (let i = 0; i <= 3; i++) { const a = a0 + i / 3 * Math.PI / 2; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } };
  corner(w / 2 - rr, h / 2 - rr, 0); corner(-w / 2 + rr, h / 2 - rr, Math.PI / 2);
  corner(-w / 2 + rr, -h / 2 + rr, Math.PI); corner(w / 2 - rr, -h / 2 + rr, Math.PI * 1.5);
  return pts;
};
/** An ellipse, centred; `from`/`to` (radians) for part of one, closed back through the middle. */
const ellipseShape = (rx, ry, from = 0, to = Math.PI * 2, n = 36) => {
  const pts = [];
  const whole = to - from >= Math.PI * 2 - 1e-6;
  for (let i = 0; i <= n; i++) { const a = from + (to - from) * i / n; if (whole && i === n) break; pts.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
  return pts;
};
/** A cape, hanging from its top edge: wide at the hem. */
const capeShape = (top, hem, len) => [[-top / 2, 0], [top / 2, 0], [hem / 2, -len * 0.9], [hem * 0.25, -len], [0, -len * 0.96], [-hem * 0.25, -len], [-hem / 2, -len * 0.9]];
/** A five-pointed star. */
const starShape = (R, r) => Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; return [Math.cos(a) * q, Math.sin(a) * q]; });
/** A feather. */
const featherShape = (l, w) => {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([t * l, Math.sin(Math.PI * Math.pow(t, 0.8)) * w]); }
  for (let i = 9; i >= 1; i--) { const t = i / 10; pts.push([t * l, -Math.sin(Math.PI * Math.pow(t, 0.8)) * w * 0.55]); }
  return pts;
};

// -- the palettes you can pick -----------------------------------------------------
/**
 * Skin tones, light to deep. Warmer than they look on a swatch: a figure is lit
 * by the ground under it, and a meadow's green bounce turns a neutral tone
 * grey. The player picks one; every other colour is the kind's.
 */
export const SKINS = AVATAR.skins;

// -- the body -----------------------------------------------------------------------
const Y = { head: 0.85, neck: 0.705, chest: 0.575, waist: 0.478, hip: 0.418, knee: 0.215, ankle: 0.075 };

/**
 * The figure every kind is dressed on. `o` gives what it wears — shirt,
 * sleeves, forearms, gloves, trousers, boots — and switches for the cuts that
 * change a silhouette. Clothes are shapes blended into one body; where one
 * colour meets another the edge is painted, so it stays crisp while the form
 * under it stays smooth. Returns bones, parts, details, eyes, and anchors.
 */
function body(o) {
  const skin = hex(o.skin), hair = hex(o.hair ?? 0x3a2418), long = o.look === 'b';
  const sh = long ? 0.121 : 0.132;                   // shoulder joint, half-width
  const shirt = o.shirt, sleeve = o.sleeve ?? shirt, fore = o.fore ?? sleeve, hand = o.glove ?? skin;
  const pants = o.pants, boots = o.boots;
  const hy = Y.head;
  const elbow = [sh + 0.032, 0.498, 0.004], wrist = [sh + 0.05, 0.378, 0.014], palm = [sh + 0.056, 0.338, 0.02];
  const hipX = long ? 0.058 : 0.062;
  const bones = {
    root: [0, 0, 0],
    body: [0, 0.43, 0, 'root'],
    chest: [0, 0.56, 0, 'body'],
    head: [0, Y.neck, 0.006, 'chest'],
    armL: [sh, 0.642, 0, 'chest'], foreL: [...elbow, 'armL'],
    armR: [-sh, 0.642, 0, 'chest'], foreR: [-elbow[0], elbow[1], elbow[2], 'armR'],
    legL: [hipX, 0.41, 0, 'body'], shinL: [hipX + 0.004, Y.knee, 0.01, 'legL'],
    legR: [-hipX, 0.41, 0, 'body'], shinR: [-hipX - 0.004, Y.knee, 0.01, 'legR'],
  };
  const skinGlow = { glow: 0.1 };
  const parts = [
    // the head: a skull, cheeks, a chin, a small nose, ears
    E('head', skin, [0, hy, 0.004], [0.14, 0.152, 0.142], 0, skinGlow),
    E('head', skin, [0, hy - 0.058, 0.034], [0.103, 0.075, 0.1], 0.045, skinGlow),
    E('head', skin, [0, hy - 0.108, 0.072], [0.044, 0.03, 0.036], 0.035, skinGlow),
    E('head', skin, [0, hy - 0.032, 0.14], [0.015, 0.016, 0.013], 0.014, skinGlow),
    mir(E('head', skin, [0.137, hy - 0.014, -0.006], [0.02, 0.034, 0.021], 0.012, skinGlow)),
    C('chest', skin, [0, 0.655, 0], [0, 0.745, 0.006], 0.04, 0.038, 0.03, skinGlow),
    // the torso: a chest that is broader than the waist, a seat
    E('chest', shirt, [0, Y.chest + 0.008, 0.002], [sh + (long ? 0.002 : 0.012), 0.088, 0.078], 0.045),
    E('body', o.waist ?? shirt, [0, Y.waist, 0], [long ? 0.088 : 0.094, 0.064, 0.07], 0.05),
    E('body', pants, [0, Y.hip, 0], [long ? 0.108 : 0.104, 0.05, 0.076], 0.035),
    // arms: a round shoulder, a sleeve, a forearm, a hand big enough to hold things
    mir(S('armL', sleeve, [sh, 0.636, 0], long ? 0.043 : 0.048, 0.03)),
    mir(C('armL', sleeve, [sh, 0.636, 0], elbow, long ? 0.035 : 0.039, long ? 0.03 : 0.033, 0.02)),
    mir(C('foreL', fore, elbow, wrist, long ? 0.031 : 0.033, long ? 0.025 : 0.027, 0.02)),
    mir(E('foreL', hand, palm, [0.034, 0.042, 0.032], 0.018, hand === skin ? skinGlow : undefined)),
    // legs: a thigh, a shin, a boot with some weight to it
    mir(C('legL', pants, [hipX, 0.425, 0], [hipX + 0.004, Y.knee, 0.01], long ? 0.05 : 0.053, 0.041, 0.03)),
    mir(C('shinL', boots, [hipX + 0.004, Y.knee, 0.01], [hipX + 0.006, Y.ankle, 0], 0.04, 0.035, 0.02)),
    mir(E('shinL', boots, [hipX + 0.006, 0.038, 0.034], [0.043, 0.038, 0.076], 0.03)),
    // the edges between one cloth and the next, painted crisp
    paint(pants, Bx('body', 0, [0, 0.3725, 0], [0.2, 0.0725, 0.2], 0), 0.004),
    mir(paint(boots, Bx('shinL', 0, [hipX + 0.005, (o.bootTop ?? 0.2) - 0.15, 0.01], [0.07, 0.15, 0.1], 0), 0.004)),
  ];
  // the face, painted: a mouth, a little colour in the cheeks (not under a beard or a mask)
  if (o.face !== false) parts.push(
    paint(o.lips ?? mixC(skin, 0x6a1e22, long ? 0.55 : 0.45), E('head', 0, [0, hy - 0.078, 0.138], [0.034, 0.0075, 0.03]), 0.004),
    paint(mixC(skin, 0x5a2a1a, 0.18), E('head', 0, [0, hy - 0.05, 0.14], [0.02, 0.008, 0.02]), 0.008),
    mir(paint(mixC(skin, 0xff6f5e, 0.08 + 0.16 * new Color(skin).getHSL({}).l), E('head', 0, [0.078, hy - 0.042, 0.116], [0.028, 0.017, 0.022]), 0.018)),
  );
  if (o.fore && o.fore !== sleeve) {
    const top = elbow[1] - (o.cuff ?? 0.012), bot = wrist[1] - 0.06;
    parts.push(mir(paint(o.fore, Bx('foreL', 0, [wrist[0], (top + bot) / 2, 0.01], [0.06, (top - bot) / 2, 0.06], 0), 0.004)));
  }
  if (hand !== skin) parts.push(mir(paint(hand, E('foreL', 0, [palm[0], palm[1] - 0.02, palm[2]], [0.06, 0.05, 0.06]), 0.004)));
  if (o.belt) parts.push(Bx('body', o.belt, [0, Y.waist - 0.012, 0], [long ? 0.092 : 0.098, 0.014, 0.075], 0.012, 0.012));
  // hair: volume over the crown and the back, a fringe swept to one side; the
  // second look adds length down the back and past the ears
  if (o.hairCut !== false) {
    parts.push(
      E('head', hair, [0, hy + 0.05, -0.022], [0.153, 0.138, 0.157], 0.014),
      E('head', hair, [0.03, hy + 0.1, 0.1], [0.085, 0.04, 0.05], 0.022, { rot: [0.55, 0, -0.3] }),
      E('head', hair, [-0.06, hy + 0.088, 0.098], [0.058, 0.036, 0.045], 0.022, { rot: [0.5, 0, 0.5] }),
      // sideburns: a tapered lock at each temple, not a pad over the cheek
      mir(C('head', hair, [0.128, hy + 0.062, 0.03], [0.132, hy - 0.008, 0.05], 0.03, 0.011, 0.01)),
    );
    if (long) parts.push(
      E('head', hair, [0, hy - 0.07, -0.088], [0.14, 0.165, 0.08], 0.03),
      mir(C('head', hair, [0.12, hy + 0.02, 0.035], [0.118, hy - 0.17, 0.005], 0.036, 0.026, 0.02)),
    );
  }
  const brow = o.brow ?? shade(hair, 0.62);
  const details = [
    ...[1, -1].map((s) => tube('head', brow, [s * 0.026, hy + 0.049, 0.135], [s * 0.09, hy + 0.055, 0.118], 0.008, { bend: [0, 0.009, 0.004], taper: 0.5, sides: 6, rings: 6 })),
  ];
  if (long) details.push(...[1, -1].map((s) => tube('head', 0x1c1216, [s * 0.082, hy + 0.03, 0.124], [s * 0.106, hy + 0.04, 0.104], 0.0055, { taper: 0.35, sides: 5, rings: 4 })));
  const eyes = { at: [0.053, hy + 0.004, 0.138], r: 0.036, iris: o.iris ?? 0x4a3322, tall: 1.24, sink: 0.24, splay: 0.08, depth: 0.5 };
  return {
    bones, parts, details, eyes, skin, hair, o,
    at: { hy, sh, elbow, wrist, palm, hipX },
  };
}

/**
 * Everything on the head — the head itself, its hair, a hat, a brim, the eyes —
 * scaled about the neck. The kinds are drawn at one head size; the figure
 * wears a smaller one, which is what keeps it an adult and not a toddler.
 */
const HEAD_K = 0.9;
function shrinkHead(d, f = HEAD_K) {
  const py = Y.neck, pz = 0.006;
  const pt = (v) => v && [v[0] * f, py + (v[1] - py) * f, pz + (v[2] - pz) * f];
  const vec = (v) => v && v.map((x) => x * f);
  for (const q of d.parts) {
    if (q.bone !== 'head') continue;
    if (q.p) q.p = pt(q.p);
    if (q.a) q.a = pt(q.a);
    if (q.b) q.b = pt(q.b);
    if (typeof q.r === 'number') q.r *= f; else if (q.r) q.r = vec(q.r);
    if (q.h) q.h = vec(q.h);
    for (const k of ['round', 'R', 'r1', 'r2', 'k', 'soft']) if (typeof q[k] === 'number') q[k] *= f;
  }
  for (const q of d.details) {
    if (q.bone !== 'head') continue;
    for (const k of ['a', 'b', 'p']) if (q[k]) q[k] = pt(q[k]);
    if (q.bend) q.bend = vec(q.bend);
    for (const k of ['r', 'R', 'len', 'depth']) if (typeof q[k] === 'number') q[k] *= f;
    if (q.shape) q.shape = q.shape.map(([x, y]) => [x * f, y * f]);
    if (q.place) q.place = { ...q.place, o: pt(q.place.o) };
  }
  d.eyes = { ...d.eyes, at: pt(d.eyes.at), r: d.eyes.r * f };
  return d;
}

/**
 * The tailor's hats (shared/cosmetics.js), each built over the head at its
 * height `hy` in its colour `c`: parts blend into the head and hair like a
 * kind's own cap does; brims, gems and petals are details.
 */
const HAT_SHAPES = {
  cap: (hy, c) => ({
    parts: [E('head', c, [0, hy + 0.084, -0.016], [0.16, 0.128, 0.164], 0.012), paint(0xf4f3ee, E('head', 0, [0, hy + 0.13, 0.13], [0.05, 0.04, 0.05]), 0.006)],
    details: [plate('head', c, ellipseShape(0.11, 0.108, 0, Math.PI), 0.018, flat([0, hy + 0.07, 0.1], -0.34), { c1: shade(c, 0.75) }), ball('head', shade(c, 0.8), [0, hy + 0.214, -0.016], 0.014)],
  }),
  bandana: (hy, c) => ({
    parts: [E('head', c, [0, hy + 0.066, -0.014], [0.162, 0.13, 0.166], 0.012), E('head', c, [0, hy + 0.03, -0.172], [0.034, 0.03, 0.028], 0.012)],
    details: [plate('head', c, [[0, 0], [0.03, -0.01], [0.04, -0.09], [0.012, -0.11], [-0.006, -0.08]], 0.008, { o: [0.0, hy + 0.03, -0.17], x: [1, 0, 0.1], y: [0, 1, 0], z: [0, 0, -1] }, { c1: shade(c, 0.75) }),
      ...[0, 1, 2].map((i) => ball('head', 0xffffff, [-0.08 + i * 0.08, hy + 0.15 - Math.abs(i - 1) * 0.015, 0.12 - Math.abs(i - 1) * 0.025], 0.011, { sy: 0.5 }))],
  }),
  beanie: (hy, c) => ({
    parts: [E('head', c, [0, hy + 0.088, -0.012], [0.16, 0.13, 0.164], 0.012), Tr('head', shade(c, 0.8), [0, hy + 0.035, -0.012], 0.152, 0.026, 0.012, { rot: [-0.08, 0, 0] }),
      S('head', 0xf4f3ee, [0, hy + 0.23, -0.02], 0.045, 0.01)],
  }),
  flowers: (hy, c) => ({
    parts: [Tr('head', c, [0, hy + 0.095, -0.012], 0.15, 0.014, 0.01, { rot: [-0.12, 0, 0] })],
    details: Array.from({ length: 7 }, (_, i) => {
      const a = (i - 3) * 0.45, p = [Math.sin(a) * 0.152, hy + 0.095 + Math.cos(a) * 0.018, -0.012 + Math.cos(a) * 0.152];
      const col = [0xff8ab4, 0xffffff, 0xffd23d, 0xc89aff][i % 4];
      return [ball('head', col, p, 0.026, { sy: 0.55 }), ball('head', 0xffc43a, [p[0], p[1] + 0.008, p[2] + 0.004], 0.01)];
    }).flat(),
  }),
  cowboy: (hy, c) => ({
    parts: [E('head', c, [0, hy + 0.13, -0.012], [0.128, 0.09, 0.13], 0.014), carve(E('head', 0, [0, hy + 0.21, -0.012], [0.03, 0.03, 0.09]), 0.01),
      paint(shade(c, 0.55), Bx('head', 0, [0, hy + 0.095, -0.012], [0.2, 0.014, 0.2], 0), 0.004)],
    details: [plate('head', c, ellipseShape(0.29, 0.27), 0.012, flat([0, hy + 0.078, -0.012], -0.06), { c1: shade(c, 0.8) })],
  }),
  catears: (hy, c) => ({
    parts: [...[1, -1].flatMap((sx) => [C('head', c, [sx * 0.085, hy + 0.11, -0.02], [sx * 0.125, hy + 0.27, -0.035], 0.055, 0.008, 0.02),
      paint(0xff9ab8, C('head', 0, [sx * 0.088, hy + 0.13, 0.0], [sx * 0.118, hy + 0.24, -0.005], 0.03, 0.006), 0.006)])],
  }),
  wizard: (hy, c) => ({
    parts: [C('head', c, [0, hy + 0.09, -0.012], [0.012, hy + 0.32, -0.05], 0.14, 0.05, 0.03), C('head', c, [0.012, hy + 0.32, -0.05], [0.08, hy + 0.38, -0.11], 0.05, 0.013, 0.025),
      paint(0xe8c05a, Bx('head', 0, [0, hy + 0.125, -0.012], [0.2, 0.014, 0.2], 0), 0.004)],
    details: [plate('head', shade(c, 0.75), ellipseShape(0.27, 0.25), 0.012, flat([0, hy + 0.092, -0.012], -0.08), { c1: shade(c, 0.6) }),
      plate('head', 0xfbe38c, starShape(0.03, 0.013), 0.006, { o: [-0.05, hy + 0.21, 0.09], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, { glow: 0.5 })],
  }),
  tophat: (hy, c) => ({
    parts: [C('head', c, [0, hy + 0.09, -0.012], [0, hy + 0.34, -0.012], 0.118, 0.128, 0.012), paint(0xb8283c, Bx('head', 0, [0, hy + 0.135, -0.012], [0.2, 0.022, 0.2], 0), 0.004)],
    details: [plate('head', c, ellipseShape(0.2, 0.19), 0.012, flat([0, hy + 0.094, -0.012], -0.04), { c1: shade(c, 1.4) })],
  }),
  crown: (hy, c) => ({
    parts: [Tr('head', c, [0, hy + 0.135, -0.012], 0.13, 0.022, 0.012, { rot: [-0.08, 0, 0] })],
    details: Array.from({ length: 6 }, (_, i) => {
      const a = i / 6 * Math.PI * 2, p = [Math.sin(a) * 0.13, hy + 0.15 + Math.cos(a) * 0.01, -0.012 + Math.cos(a) * 0.13];
      return [crystal('head', c, p, [Math.sin(a) * 0.15, 1, Math.cos(a) * 0.15], 0.075, 0.024, { c1: mixC(c, 0xffffff, 0.45), glow: 0.25 }),
        ball('head', [0xe8303a, 0x2f6ad8, 0x3ac85a][i % 3], [p[0] * 1.08, p[1] - 0.004, -0.012 + (p[2] + 0.012) * 1.08], 0.012, { glow: 0.3 })];
    }).flat(),
  }),
  halo: (hy, c) => ({ details: [ring('head', c, [0, hy + 0.27, -0.03], 0.11, 0.012, [-0.25, 0, 0], { glow: 1 })] }),
  horns: (hy, c) => ({
    details: [1, -1].map((sx) => horn('head', c, [sx * 0.1, hy + 0.11, 0.03], [sx * 0.19, hy + 0.27, -0.05], 0.03, { bend: [sx * 0.02, 0.04, 0.03], c1: 0xff6a2a })),
  }),
};

/**
 * A dye (shared/cosmetics.js) on a kind's main cloth: every colour of the
 * same hue and saturation as one of the kind's `main` colours — the cloth and
 * its shades, a lining, a brim — takes the dye's hue, keeping how much lighter
 * or darker it was. Skin, hair and trim are other hues and stay as they were.
 */
function dyeDesign(d, main, dye) {
  const D = new Color(dye).getHSL({}), M = main.map((m) => new Color(m).getHSL({})), x = new Color();
  const map = (c) => {
    if (typeof c !== 'number' || !c) return c;
    const h = x.set(c).getHSL({});
    for (const m of M) {
      const dh = Math.min(Math.abs(h.h - m.h), 1 - Math.abs(h.h - m.h));
      if (dh < 0.012 && Math.abs(h.s - m.s) < 0.16) {
        const l = Math.min(0.95, Math.max(0.04, h.l * (D.l / Math.max(0.04, m.l))));
        const sat = Math.min(1, D.s * Math.min(1.5, Math.max(0.5, h.s / Math.max(0.02, m.s))));
        return x.setHSL(D.h, sat, l).getHex();
      }
    }
    return c;
  };
  for (const q of [...d.parts, ...d.details]) { q.c = map(q.c); if (q.c1 != null) q.c1 = map(q.c1); }
  return d;
}

/** A design from the body and what a kind adds to it. */
function dress(b, extra = {}) {
  // a hat from the tailor (shared/cosmetics.js): the kind's own headwear off, this one on
  const hat = b.o?.hat && HATS[b.o.hat];
  if (hat && HAT_SHAPES[hat.shape]) {
    const worn = HAT_SHAPES[hat.shape](Y.head, hat.color);
    extra = {
      ...extra,
      parts: [...(extra.parts || []).filter((q) => !q.hw), ...(worn.parts || [])],
      details: [...(extra.details || []).filter((q) => !q.hw), ...(worn.details || [])],
    };
  }
  return shrinkHead({
    plan: 'person', animate: animatePerson, lid: mixC(b.skin, 0x000000, 0.12), eyeStyle: 1, spec: 0.16, rim: 0.18, rough: 0.46,
    cells: 64, cellsLo: 28, cellsClose: 120, ink: 0.55, reach: 0.028, outline: 0.006, ao: 0.8,
    size: 1.42, fitH: 1.0,
    ...extra,
    bones: { ...b.bones, ...(extra.bones || {}) },
    parts: [...b.parts, ...(extra.parts || [])],
    details: [...b.details, ...(extra.details || [])],
    eyes: b.eyes,
  }, extra.headK ?? HEAD_K);
}

// -- the kinds ------------------------------------------------------------------------
/**
 * Each kind: its name, a line that says who it is, hair and eye colours by
 * look, and how it is dressed. `pose` is the move it shows off with in the
 * character creator.
 */
export const KINDS = {
  rogue: {
    he: 'שודד', en: 'Rogue', accent: '#b07cff', line: 'זריז, שקט, ותמיד צעד אחד לפני כולם.', pose: 'flourish',
    hair: ['#2c2226', '#6b3a2a'], iris: 0x7a5aa8, main: [0x55506e, 0x46425a],
    build(o) {
      const cloak = 0x55506e, lining = 0x2a2838, leather = 0x6b4630, scarf = 0xb8283c, dark = 0x2a2834, steel = 0xd4dbe6;
      const b = body({ ...o, shirt: 0x46425a, sleeve: 0x46425a, fore: leather, glove: dark, pants: 0x4a4658, boots: dark, belt: 0x5a3a28, bootTop: 0.24 });
      const { hy, sh, palm } = b.at;
      const face = b.parts.filter((p) => p.bone === 'head' && p.c === b.skin);
      return dress(b, {
        parts: [
          // the hood, up: a cowl over the head with its face cut out, a point
          // at the back, and a mask over the nose and mouth
          hw(E('head', cloak, [0, hy + 0.028, -0.012], [0.172, 0.176, 0.172], 0.02)),
          hw(C('head', cloak, [0, hy + 0.1, -0.06], [0, hy + 0.02, -0.24], 0.07, 0.012, 0.05)),
          hw(carve(E('head', 0, [0, hy - 0.02, 0.19], [0.132, 0.15, 0.1]), 0.02, lining)),
          hw(Tr('head', shade(cloak, 1.12), [0, hy - 0.02, 0.118], 0.122, 0.016, 0.012, { rot: [Math.PI / 2 - 0.12, 0, 0] })),
          ...face.map((p) => ({ ...p, k: Math.max(0.012, p.k * 0.6) })),
          ...(o.look === 'b' ? [
            mir(C('head', b.hair, [0.1, hy + 0.06, 0.1], [0.11, hy - 0.08, 0.1], 0.024, 0.018, 0.015)),
          ] : [
            E('head', b.hair, [0.02, hy + 0.1, 0.1], [0.08, 0.035, 0.04], 0.02, { rot: [0.5, 0, -0.3] }),
          ]),
          // the cowl falls onto the shoulders as a short cape
          E('chest', cloak, [0, 0.655, -0.02], [0.16, 0.055, 0.12], 0.04),
          // a scarf knotted at the throat, its tail over the shoulder
          Tr('chest', scarf, [0, 0.672, 0.014], 0.06, 0.02, 0.018, { rot: [Math.PI / 2 - 0.15, 0, 0] }),
          // a leather vest with a strap across it, a pouch at each hip, bracers
          paint(leather, Bx('chest', 0, [0, 0.57, 0], [sh - 0.03, 0.1, 0.12], 0.01), 0.004),
          paint(0x2a2230, Bx('chest', 0, [0, 0.56, 0.1], [0.004, 0.09, 0.02], 0.002), 0.002),
          mir(E('body', leather, [0.1, Y.waist - 0.022, 0.03], [0.03, 0.036, 0.028], 0.012)),
        ],
        details: [
          // the scarf's tail, and two daggers: one in hand, point forward, one at the back
          plate('chest', scarf, [[0, 0], [0.03, -0.01], [0.04, -0.13], [0.012, -0.16], [-0.006, -0.12]], 0.008, { o: [0.05, 0.665, 0.06], x: [1, 0, 0.2], y: [0, 1, 0], z: [0, 0, 1] }, { c1: shade(scarf, 0.75) }),
          plate('foreR', steel, bladeShape(0.14, 0.026), 0.006, { o: [-palm[0], palm[1] - 0.005, palm[2] + 0.02], x: [0, -0.2, 1], y: [0, 1, 0.2], z: [1, 0, 0] }, { c1: 0xffffff }),
          tube('foreR', 0x3a2418, [-palm[0], palm[1] - 0.006, palm[2] - 0.035], [-palm[0], palm[1] - 0.005, palm[2] + 0.022], 0.009, { sides: 6 }),
          ring('foreR', 0xc9a24a, [-palm[0], palm[1] - 0.005, palm[2] + 0.024], 0.02, 0.005, [0, 0, 0]),
          plate('chest', steel, bladeShape(0.12, 0.022), 0.005, { o: [0.05, 0.5, -0.105], x: [-0.5, 1, 0], y: [1, 0.5, 0], z: [0, 0, -1] }, { c1: 0xffffff }),
          tube('chest', 0x3a2418, [0.075, 0.46, -0.1], [0.05, 0.5, -0.105], 0.009, { sides: 6 }),
          ball('body', 0xd4b25a, [0, Y.waist - 0.012, 0.078], 0.013, { sy: 0.7 }),
        ],
      });
    },
  },

  pirate: {
    he: 'פיראט', en: 'Pirate', accent: '#2fb6d0', line: 'הים הוא הבית, והאוצר תמיד מעבר לגל הבא.', pose: 'draw',
    hair: ['#3a2418', '#5a2a1a'], iris: 0x2f6a8a, main: [0x8e1f2e],
    build(o) {
      const coat = 0x8e1f2e, trim = 0xe0b84e, shirt = 0xf3ead8, black = 0x221c20, sash = 0xc9302c;
      const b = body({ ...o, shirt: coat, sleeve: coat, fore: coat, pants: 0x3f2e24, boots: black, bootTop: 0.28, waist: shirt, face: o.look === 'b' });
      const { hy, sh, palm } = b.at;
      // the three walls of the tricorn, each turned up and out
      const wall = (a, len) => E('head', black, [Math.cos(a) * 0.15, hy + 0.13, -0.012 + Math.sin(a) * 0.15], [len, 0.052, 0.022], 0.02, { rot: yawTilt(-(a + Math.PI / 2), 0.35) });
      return dress(b, {
        bones: { coatB: [0, 0.47, -0.04, 'body'] },
        parts: [
          // the coat: open over the shirt, lapels turned back, skirts behind and at the sides
          E('chest', coat, [0, 0.592, -0.042], [0.132, 0.092, 0.058], 0.03),
          paint(shirt, Bx('chest', 0, [0, 0.598, 0.08], [0.042, 0.1, 0.04], 0.012, 0, { rot: [0, 0, 0] }), 0.004),
          mir(paint(trim, Bx('chest', 0, [0.046, 0.6, 0.08], [0.006, 0.1, 0.04], 0, 0, { rot: [0, 0, -0.12] }), 0.003)),
          Bx('coatB', coat, [0, 0.35, -0.07], [0.105, 0.12, 0.016], 0.012, 0.02),
          mir(Bx('coatB', coat, [0.1, 0.35, -0.01], [0.016, 0.12, 0.055], 0.012, 0.02, { rot: [0, 0, 0.12] })),
          paint(trim, Bx('coatB', 0, [0, 0.235, -0.03], [0.2, 0.01, 0.2], 0), 0.004),
          // a red sash, big cuffs
          Bx('body', sash, [0, Y.waist - 0.004, 0], [0.098, 0.022, 0.076], 0.014, 0.012),
          mir(C('foreL', coat, [b.at.elbow[0] + 0.01, 0.45, 0.01], [b.at.wrist[0] + 0.004, 0.4, 0.014], 0.043, 0.039, 0.01)),
          mir(paint(trim, Bx('foreL', 0, [b.at.wrist[0], 0.442, 0.012], [0.06, 0.006, 0.06], 0), 0.003)),
          // tall boots with a folded top
          mir(Tr('shinL', black, [b.at.hipX + 0.004, 0.275, 0.009], 0.046, 0.014, 0.012, { rot: [Math.PI / 2, 0, 0] })),
          // stubble
          ...(o.look === 'b' ? [] : [paint(mixC(o.skin, 0x3a2418, 0.3), E('head', 0, [0, hy - 0.09, 0.07], [0.105, 0.052, 0.095]), 0.02)]),
          // the hat: a bandana under a tricorn
          ...[
            E('head', sash, [0, hy + 0.058, -0.012], [0.15, 0.1, 0.152], 0.012),
            E('head', black, [0, hy + 0.118, -0.012], [0.128, 0.066, 0.126], 0.02),
            E('head', black, [0, hy + 0.096, -0.012], [0.19, 0.022, 0.19], 0.02),
            wall(Math.PI / 6, 0.14), wall(Math.PI * 5 / 6, 0.14), wall(Math.PI * 1.5, 0.15),
            paint(trim, Tr('head', 0, [0, hy + 0.2, -0.012], 0.2, 0.045), 0.006),
          ].map(hw),
        ],
        details: [
          // brass buttons, a gold earring, an eye patch, a cutlass
          ...[0, 1, 2].flatMap((i) => [1, -1].map((s) => ball('chest', trim, [s * 0.074, 0.635 - i * 0.042, 0.078], 0.009))),
          ring('head', trim, [-0.143, hy - 0.052, 0.0], 0.013, 0.0035, [0, 0, Math.PI / 2]),
          plate('head', black, ellipseShape(0.028, 0.022), 0.008, { o: [0.058, hy + 0.008, 0.155], x: [0.96, 0, -0.28], y: [0, 1, 0], z: [0.28, 0, 0.96] }),
          tube('head', black, [0.03, hy + 0.035, 0.148], [0.14, hy + 0.07, 0.02], 0.004, { bend: [0.03, 0.03, 0.06], sides: 5 }),
          plate('foreR', 0xdce3ee, bladeShape(0.22, 0.036, 0.07), 0.006, { o: [-palm[0], palm[1] - 0.004, palm[2] + 0.03], x: [0, -0.15, 1], y: [0, 1, 0.15], z: [1, 0, 0] }, { c1: 0xffffff }),
          ring('foreR', trim, [-palm[0], palm[1] - 0.004, palm[2] + 0.026], 0.026, 0.006, [Math.PI / 2, 0, 0]),
          tube('foreR', 0x3a2418, [-palm[0], palm[1] - 0.004, palm[2] - 0.028], [-palm[0], palm[1] - 0.004, palm[2] + 0.026], 0.011, { sides: 6 }),
        ],
      });
    },
  },

  fire: {
    he: 'שומר האש', en: 'Fire Keeper', accent: '#ff7a36', line: 'נושא להבה שלא כבתה מאות שנים.', pose: 'ignite',
    hair: ['#c2381a', '#e0601e'], iris: 0xf0a030, main: [0x7d1e1e],
    build(o) {
      const tunic = 0x7d1e1e, ember = 0xff7a1f, gold = 0xe6b44c, dark = 0x2e1f1f, ash = 0x4a3a3a;
      const b = body({ ...o, shirt: tunic, sleeve: tunic, fore: dark, glove: dark, pants: ash, boots: dark, belt: gold, hairCut: o.look === 'b' });
      const { hy, sh, palm, elbow, wrist } = b.at;
      return dress(b, {
        glowK: 1.8,
        parts: [
          // a tunic to the knee, split at the sides, with a burning hem
          C('body', tunic, [0, Y.waist, 0], [0, 0.26, 0], 0.1, 0.128, 0.035),
          mir(carve(Bx('body', 0, [0.13, 0.27, 0], [0.02, 0.07, 0.2], 0.01), 0.01, ash)),
          paint(ember, Bx('body', 0, [0, 0.25, 0], [0.3, 0.018, 0.3], 0), 0.012, { glow: 0.9 }),
          paint(gold, Bx('body', 0, [0, 0.28, 0], [0.3, 0.006, 0.3], 0), 0.003),
          // pauldrons trimmed in gold, a high collar
          mir(E('armL', tunic, [sh + 0.012, 0.648, 0], [0.06, 0.04, 0.058], 0.02)),
          mir(paint(gold, Bx('armL', 0, [sh + 0.012, 0.628, 0], [0.08, 0.006, 0.08], 0), 0.003)),
          Tr('chest', gold, [0, 0.676, -0.004], 0.052, 0.017, 0.015, { rot: [Math.PI / 2 - 0.2, 0, 0] }),
          // the ember at the heart, and lines of fire along the gauntlets
          paint(0xffc53a, S('chest', 0, [0, 0.598, 0.083], 0.021), 0.01, { glow: 1 }),
          mir(paint(ember, C('foreL', 0, [elbow[0], elbow[1] - 0.03, elbow[2] + 0.03], [wrist[0], wrist[1] + 0.02, wrist[2] + 0.03], 0.008, 0.008), 0.004, { glow: 1 })),
          // the first look's hair is fire; this is the scalp it burns from
          ...(o.look === 'b' ? [] : [E('head', o.hair, [0, hy + 0.045, -0.03], [0.146, 0.128, 0.148], 0.014)]),
        ],
        details: [
          ...(o.look === 'b'
            // a circlet of small flames over long red hair
            ? [-2, -1, 0, 1, 2].map((i) => hw(flame('head', [i * 0.045, hy + 0.15 - Math.abs(i) * 0.012, 0.04 - Math.abs(i) * 0.03], [i * 0.2, 1, -0.15], 0.075 - Math.abs(i) * 0.01, 0.02, { glow: 0.9, c: 0xffd35a, c1: 0xff5a14 })))
            // a crest of flame from brow to nape
            : [
              ...[-3, -2, -1, 0, 1, 2, 3].map((i) => hw(flame('head', [i * 0.038, hy + 0.125 - i * i * 0.004, 0.07 - Math.abs(i) * 0.032], [i * 0.2, 1, -0.55], 0.22 - Math.abs(i) * 0.02, 0.042, { glow: 0.9, c: 0xffd35a, c1: 0xff4a12, lean: 0.45, side: [0, 0, -1] }))),
              ...[-1, 0, 1].map((i) => hw(flame('head', [i * 0.06, hy + 0.08, -0.1], [i * 0.25, 0.7, -1], 0.17, 0.04, { glow: 0.85, c: 0xffc03a, c1: 0xff4a12, side: [0, -1, 0] }))),
            ]),
          // fire in the left palm
          flame('foreL', [palm[0] + 0.004, palm[1] - 0.01, palm[2] + 0.04], [0.1, 1, 0.3], 0.1, 0.034, { glow: 1, c: 0xffe27a, c1: 0xff5a14 }),
          ball('foreL', 0xfff0b8, [palm[0] + 0.004, palm[1] - 0.012, palm[2] + 0.04], 0.018, { glow: 1 }),
        ],
      });
    },
  },

  catcher: {
    he: 'לוכד', en: 'Catcher', accent: '#ff5467', line: 'כל יצור הוא חבר שעוד לא פגשת.', pose: 'throw',
    hair: ['#2a1c14', '#7a4a22'], iris: 0x3a7a4a, main: [0x238f8c],
    build(o) {
      const jacket = 0x238f8c, white = 0xf4f3ee, cap = 0xdc4436, pants = 0x2e3d5e, shoe = 0x3a3434;
      const b = body({ ...o, shirt: jacket, sleeve: jacket, fore: jacket, pants, boots: shoe, belt: 0x2a2a2a, bootTop: 0.1, waist: white });
      const { hy, sh, palm, wrist } = b.at;
      const sphere = (bone, p, r = 0.022) => [
        ball(bone, 0xe8403a, p, r),
        ball(bone, 0xf4f4f4, [p[0], p[1] - r * 0.02, p[2]], r * 0.985, { sy: 0.5 }),
        ring(bone, 0x222222, p, r * 1.01, r * 0.1, [0, 0, 0]),
        ball(bone, 0xffffff, [p[0], p[1], p[2] + r * 0.95], r * 0.28),
      ];
      return dress(b, {
        bones: { pack: [0, 0.58, -0.09, 'chest'] },
        parts: [
          // an open jacket, collar turned up, over a white tee
          E('chest', jacket, [0, 0.592, -0.044], [0.135, 0.094, 0.058], 0.03),
          paint(white, Bx('chest', 0, [0, 0.59, 0.08], [0.038, 0.1, 0.04], 0.012), 0.004),
          mir(E('chest', jacket, [0.064, 0.672, -0.012], [0.052, 0.032, 0.062], 0.02, { rot: [0, 0, -0.4] })),
          mir(paint(white, Bx('foreL', 0, [wrist[0], wrist[1] + 0.018, wrist[2]], [0.05, 0.008, 0.05], 0), 0.003)),
          // fingerless gloves; trainers with white soles
          mir(paint(0x2a2a2a, E('foreL', 0, [palm[0], palm[1] + 0.014, palm[2]], [0.04, 0.02, 0.04]), 0.004)),
          mir(paint(white, Bx('shinL', 0, [b.at.hipX + 0.006, 0.008, 0.03], [0.06, 0.012, 0.1], 0), 0.004)),
          // a backpack on two straps
          Bx('pack', 0xe6ad3c, [0, 0.572, -0.13], [0.086, 0.092, 0.042], 0.03, 0.01, { rigid: true }),
          Bx('pack', 0xc68a28, [0, 0.52, -0.172], [0.07, 0.036, 0.018], 0.02, 0.01, { rigid: true }),
          mir(paint(0x6a4a24, Bx('chest', 0, [0.068, 0.6, 0.075], [0.012, 0.08, 0.03], 0.004, 0, { rot: [0, 0, -0.08] }), 0.002)),
          // the cap
          hw(E('head', cap, [0, hy + 0.074, -0.012], [0.152, 0.098, 0.156], 0.012)),
          hw(paint(white, E('head', 0, [0, hy + 0.11, 0.12], [0.056, 0.046, 0.05]), 0.006)),
        ],
        details: [
          // the peak, the badge on the cap, spheres on the belt and one in hand
          hw(plate('head', cap, ellipseShape(0.108, 0.105, 0, Math.PI), 0.018, flat([0, hy + 0.068, 0.095], -0.34), { c1: shade(cap, 0.75) })),
          hw(ball('head', 0x238f8c, [0, hy + 0.11, 0.165], 0.016, { sy: 0.45 })),
          ...sphere('body', [0.072, Y.waist - 0.01, 0.076]),
          ...sphere('body', [-0.072, Y.waist - 0.01, 0.076]),
          ...sphere('body', [0.108, Y.waist - 0.01, 0.02]),
          ...sphere('foreR', [-palm[0], palm[1] - 0.012, palm[2] + 0.03], 0.03),
        ],
      });
    },
  },

  ranger: {
    he: 'סייר', en: 'Ranger', accent: '#62cf6c', line: 'שומר השבילים. רואה הכל, נשמע רק כשצריך.', pose: 'aim',
    hair: ['#5a3a1e', '#b0702c'], iris: 0x3f7a3a, main: [0x3f6b3c, 0x2d5334],
    build(o) {
      const green = 0x3f6b3c, cloak = 0x2d5334, leather = 0x7c5433, cream = 0xe8dcc0, dark = 0x3a2a1c, gold = 0xc9a24a;
      const b = body({ ...o, shirt: green, sleeve: green, fore: leather, glove: 0x5a3a24, pants: 0x564433, boots: dark, belt: dark, bootTop: 0.26, waist: leather });
      const { hy, sh, palm } = b.at;
      return dress(b, {
        bones: { cape: [0, 0.665, -0.07, 'chest'] },
        parts: [
          // a hooded cloak, hood down in folds round the neck
          E('chest', cloak, [0, 0.66, -0.028], [0.155, 0.058, 0.115], 0.03),
          E('head', cloak, [0, hy - 0.07, -0.105], [0.13, 0.1, 0.068], 0.03),
          mir(E('chest', cloak, [0.125, 0.628, -0.02], [0.05, 0.05, 0.08], 0.03)),
          // the jerkin laced up the front over a green shirt
          paint(leather, Bx('chest', 0, [0, 0.565, 0], [sh - 0.028, 0.092, 0.12], 0.01), 0.004),
          paint(dark, Bx('chest', 0, [0, 0.575, 0.086], [0.004, 0.07, 0.02], 0.002), 0.002),
          ...[0, 1, 2, 3].map((i) => paint(cream, Bx('chest', 0, [0, 0.62 - i * 0.03, 0.088], [0.016, 0.003, 0.02], 0.001), 0.002)),
          // a quiver across the back
          C('chest', leather, [0.07, 0.48, -0.1], [-0.05, 0.71, -0.112], 0.034, 0.03, 0.01, { rigid: true }),
        ],
        details: [
          // the cloak's fall, arrows in the quiver, the bow, a leaf clasp
          plate('cape', cloak, capeShape(0.23, 0.36, 0.42), 0.014, { o: [0, 0.665, -0.095], x: [1, 0, 0], y: [0, 1, -0.1], z: [0, 0.1, 1] }, { c1: shade(cloak, 0.78) }),
          ...[0, 1, 2].map((i) => tube('chest', 0xd8c8a0, [-0.04 - i * 0.012, 0.7, -0.112], [-0.07 - i * 0.012, 0.77, -0.118], 0.005, { sides: 5 })),
          ...[0, 1, 2].map((i) => plate('chest', 0xf0ebe0, featherShape(0.042, 0.012), 0.003, { o: [-0.07 - i * 0.012, 0.76, -0.118], x: [-0.4, 1, 0], y: [1, 0.4, 0], z: [0, 0, 1] })),
          tube('foreL', leather, [palm[0] + 0.004, 0.64, palm[2]], [palm[0] + 0.004, 0.08, palm[2]], 0.009, { bend: [0, 0, 0.14], sides: 7, taper: 0.7 }),
          tube('foreL', 0xf2ece0, [palm[0] + 0.004, 0.635, palm[2] + 0.002], [palm[0] + 0.004, 0.085, palm[2] + 0.002], 0.0022, { sides: 4 }),
          plate('chest', gold, featherShape(0.045, 0.017), 0.004, { o: [0.024, 0.676, 0.084], x: [-1, 0.25, 0], y: [0, 1, 0], z: [0, 0, 1] }),
        ],
      });
    },
  },

  mage: {
    he: 'קוסם', en: 'Mage', accent: '#5b9dff', line: 'לומד את השפה הישנה שהעולם נכתב בה.', pose: 'cast',
    hair: ['#dcd4c8', '#2e2350'], iris: 0x4a6ad8, main: [0x2f3d92, 0x1f2764],
    build(o) {
      const robe = 0x2f3d92, deep = 0x1f2764, gold = 0xe8c05a, star = 0xfbe38c;
      const b = body({ ...o, shirt: robe, sleeve: robe, fore: robe, pants: deep, boots: 0x2a2030, bootTop: 0.1, belt: gold, face: o.look === 'b' });
      const { hy, sh, palm, elbow, wrist } = b.at;
      return dress(b, {
        glowK: 2,
        bones: { robe: [0, 0.3, 0, 'body'] },
        parts: [
          // the robe to the ankle, flaring, trimmed at the hem and down the front
          C('body', robe, [0, Y.waist, 0], [0, 0.3, 0], 0.098, 0.13, 0.04),
          C('robe', robe, [0, 0.3, 0], [0, 0.085, 0], 0.13, 0.168, 0.03),
          carve(Bx('robe', 0, [0, -0.02, 0], [0.3, 0.085, 0.3], 0), 0.012, deep),
          ...b.parts.filter((q) => q.bone === 'shinL' && q.op !== PAINT),
          paint(gold, Bx('robe', 0, [0, 0.095, 0], [0.3, 0.014, 0.3], 0), 0.004),
          paint(gold, Bx('body', 0, [0, 0.3, 0.14], [0.012, 0.25, 0.05], 0), 0.003),
          mir(paint(gold, Bx('chest', 0, [0.03, 0.61, 0.08], [0.008, 0.075, 0.03], 0, 0, { rot: [0, 0, -0.18] }), 0.003)),
          // bell sleeves
          mir(C('foreL', robe, [elbow[0] + 0.004, 0.47, 0.008], [wrist[0] + 0.012, 0.39, 0.022], 0.038, 0.054, 0.02)),
          mir(paint(gold, Bx('foreL', 0, [wrist[0] + 0.012, 0.395, 0.022], [0.07, 0.008, 0.07], 0), 0.003)),
          // the hat's crown, bending over at the tip, with a gold band
          hw(C('head', robe, [0, hy + 0.09, -0.012], [0.012, hy + 0.3, -0.05], 0.14, 0.05, 0.03)),
          hw(C('head', robe, [0.012, hy + 0.3, -0.05], [0.075, hy + 0.36, -0.105], 0.05, 0.013, 0.025)),
          hw(paint(gold, Bx('head', 0, [0, hy + 0.125, -0.012], [0.2, 0.014, 0.2], 0), 0.004)),
          // a beard for the first look
          ...(o.look === 'b' ? [] : [
            E('head', o.hair, [0, hy - 0.092, 0.098], [0.088, 0.078, 0.06], 0.014),
            C('head', o.hair, [0, hy - 0.12, 0.112], [0, hy - 0.23, 0.12], 0.056, 0.014, 0.02),
            mir(E('head', o.hair, [0.045, hy - 0.062, 0.13], [0.04, 0.012, 0.018], 0.012, { rot: [0, 0, -0.3] })),
          ]),
        ],
        details: [
          // the brim; a staff with a crystal held in a claw of wood; a star on the hat
          hw(plate('head', deep, ellipseShape(0.27, 0.25), 0.012, flat([0, hy + 0.092, -0.012], -0.08), { c1: shade(deep, 0.8) })),
          tube('foreR', 0x6a4a2a, [-palm[0], 0.1, palm[2] + 0.004], [-palm[0], 0.8, palm[2] + 0.004], 0.011, { bend: [-0.02, 0, 0.01], sides: 7, taper: 0.85 }),
          ...[0, 1, 2].map((i) => horn('foreR', 0x6a4a2a, [-palm[0], 0.79, palm[2] + 0.004], [-palm[0] + Math.cos(i * 2.1) * 0.036, 0.86, palm[2] + 0.004 + Math.sin(i * 2.1) * 0.036], 0.008, { bend: [0, 0.01, 0] })),
          crystal('foreR', 0x7ae0ff, [-palm[0], 0.805, palm[2] + 0.004], [0, 1, 0], 0.085, 0.021, { c1: 0xe8faff, glow: 0.9 }),
          ball('foreR', 0xbef2ff, [-palm[0], 0.835, palm[2] + 0.004], 0.03, { glow: 0.55 }),
          hw(plate('head', star, starShape(0.032, 0.014), 0.006, { o: [0.052, hy + 0.2, 0.09], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, { glow: 0.5 })),
        ],
      });
    },
  },

  explorer: {
    he: 'חוקר', en: 'Explorer', accent: '#e9b24a', line: 'מפה ריקה היא הזמנה. הוא ממלא אותה.', pose: 'look',
    hair: ['#6a4428', '#c8923e'], iris: 0x5a7a3a, main: [0xd2bb8c],
    build(o) {
      const khaki = 0xd2bb8c, olive = 0x6c7046, leather = 0x7a4f2e, brass = 0xc9a24a, helmet = 0xeadcb4, scarf = 0xcf5430;
      const b = body({ ...o, shirt: khaki, sleeve: khaki, fore: o.skin, pants: olive, boots: leather, belt: leather, bootTop: 0.2, cuff: 0.004 });
      const { hy, sh, palm, elbow } = b.at;
      return dress(b, {
        parts: [
          // sleeves rolled to the elbow, a knotted neckerchief, breast pockets
          mir(Tr('armL', shade(khaki, 0.9), [elbow[0] - 0.002, elbow[1] + 0.014, elbow[2]], 0.035, 0.012, 0.012, { rot: [Math.PI / 2, 0, 0.15] })),
          Tr('chest', scarf, [0, 0.672, 0.012], 0.05, 0.016, 0.015, { rot: [Math.PI / 2 - 0.2, 0, 0] }),
          E('chest', scarf, [0.018, 0.646, 0.074], [0.024, 0.03, 0.013], 0.01),
          mir(paint(shade(khaki, 0.84), Bx('chest', 0, [0.056, 0.6, 0.083], [0.026, 0.022, 0.01], 0.005), 0.003)),
          // a knife sheath and a pouch on the belt; socks over the boots
          Bx('body', leather, [-0.12, 0.43, 0.02], [0.028, 0.046, 0.05], 0.012, 0.012, { rigid: true }),
          mir(Tr('shinL', 0xeee6d6, [b.at.hipX + 0.005, 0.2, 0.008], 0.041, 0.012, 0.012, { rot: [Math.PI / 2, 0, 0] })),
          // the pith helmet
          hw(E('head', helmet, [0, hy + 0.082, -0.012], [0.158, 0.114, 0.162], 0.012)),
          hw(paint(0x8a6a3a, Bx('head', 0, [0, hy + 0.085, -0.012], [0.2, 0.012, 0.2], 0), 0.003)),
        ],
        details: [
          // the brim, the satchel strap, a magnifying glass, a compass
          hw(plate('head', helmet, ellipseShape(0.22, 0.23), 0.012, flat([0, hy + 0.064, -0.012], -0.06), { c1: shade(helmet, 0.86) })),
          tube('chest', leather, [0.1, 0.672, 0.03], [-0.118, 0.46, 0.05], 0.007, { bend: [0, 0, 0.065], sides: 5 }),
          ring('foreL', brass, [palm[0] + 0.012, palm[1] - 0.012, palm[2] + 0.055], 0.03, 0.0065, [0.3, 0, 0]),
          plate('foreL', 0xbfe6ff, ellipseShape(0.027, 0.027), 0.003, { o: [palm[0] + 0.012, palm[1] - 0.012, palm[2] + 0.055], x: [1, 0, 0], y: [0, 0.95, 0.3], z: [0, -0.3, 0.95] }, { glow: 0.15 }),
          tube('foreL', leather, [palm[0] + 0.012, palm[1] - 0.042, palm[2] + 0.046], [palm[0], palm[1] - 0.004, palm[2]], 0.007, { sides: 5 }),
          ball('body', brass, [0.102, 0.455, 0.066], 0.02, { sy: 0.4 }),
        ],
      });
    },
  },
};

export const KIND_IDS = Object.keys(KINDS);

/** Everything a stored appearance can say, made whole: a kind, a look, a skin. */
export function personLook(a = {}) {
  const kind = KINDS[a.kind] ? a.kind : kindFromLegacy(a);
  const look = a.look === 'b' ? 'b' : a.look === 'a' ? 'a' : a.body === 'slim' ? 'b' : 'a';
  const skin = SKINS.includes(a.skin) ? a.skin : nearestSkin(a.skin);
  return { kind, look, skin, hair: a.hairC || null, scale: a.scale || 1, hat: HATS[a.hat] ? a.hat : null, dye: DYES[a.dye] ? a.dye : null };
}

/** A character made before there were kinds: dressed as the one closest to its outfit. */
export function kindFromLegacy(a = {}) {
  return AVATAR.legacyKind[a.outfit] || 'explorer';
}

function nearestSkin(c) {
  if (!c) return SKINS[1];
  const x = new Color(c);
  let best = SKINS[1], d = 1e9;
  for (const s of SKINS) {
    const y = new Color(s), e = (x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2;
    if (e < d) { d = e; best = s; }
  }
  return best;
}

const DESIGNS = new Map();
/** The design for a look, made once. */
export function personDesign(look) {
  const L = personLook(look);
  const key = `person:${L.kind}:${L.look}:${L.skin}:${L.hair || ''}:${L.hat || ''}:${L.dye || ''}`;
  let d = DESIGNS.get(key);
  if (!d) {
    const K = KINDS[L.kind];
    d = K.build({ skin: L.skin, look: L.look, hair: L.hair || K.hair[L.look === 'b' ? 1 : 0], iris: K.iris, hat: L.hat });
    L.dye && K.main && dyeDesign(d, K.main, DYES[L.dye].color);
    d.key = key;
    DESIGNS.set(key, d);
  }
  return d;
}

/**
 * A person, ready to stand anywhere: a group carrying the figurine, with the
 * record the animator drives as `userData.model`, and the arms a sphere is
 * thrown with as `userData.rig` (the battle's throw reads it).
 */
export function buildPerson(appearance = {}, { hi = false, outline = true } = {}) {
  const L = personLook(appearance);
  const d = personDesign(L);
  const made = instance(d.key, d, { outline, hi });
  const g = new Group();
  g.add(made.holder);
  const m = made.model;
  m.act = null;
  m.kind = L.kind;
  if (L.scale !== 1) made.holder.scale.setScalar(L.scale);
  g.userData.model = m;
  g.userData.rig = { arms: [m.bones.armR, m.bones.armL], person: true };
  g.userData.height = m.height * L.scale;
  g.userData.kind = L.kind;
  return g;
}

// -- the animator ------------------------------------------------------------------------
const _q = new Quaternion(), _ax = new Vector3();
function rot(b, x, y, z) {
  if (!b) return;
  if (x) b.quaternion.multiply(_q.setFromAxisAngle(_ax.set(1, 0, 0), x));
  if (y) b.quaternion.multiply(_q.setFromAxisAngle(_ax.set(0, 1, 0), y));
  if (z) b.quaternion.multiply(_q.setFromAxisAngle(_ax.set(0, 0, 1), z));
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** In, hold, out: how much of a one-off move is on at `u` (0..1). */
const envelope = (u, inn = 0.22, out = 0.3) => Math.min(sstep(0, inn, u), 1 - sstep(1 - out, 1, u));

/**
 * Walk, run and stand like a person: legs that swing from the hip and bend at
 * the knee on the way through, arms that counter-swing and bend at the elbow
 * (more when running), hips that roll and a chest that turns against them, a
 * head that stays level and looks about when there is nothing to do. On top
 * of the loop, a one-off move (`personAct`) — each kind's show-off, an attack,
 * a flinch — eases in and out. Signature as animateFigurine's.
 */
function animatePerson(group, m, timeMs, moving, speed = 1) {
  const dt = m.last == null ? 0.016 : Math.min(0.1, Math.max(0, (timeMs - m.last) * 0.001));
  m.last = timeMs;
  const t = timeMs * 0.001 + m.phase;
  const B = m.bones, R = m.rest;
  for (const n in B) {
    const b = B[n], r = R[n];
    b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s);
  }
  const H = m.height || 1.4;
  // Riding (world.js setMount): sitting astride, knees out, hands forward on
  // the reins, rocking a little with the creature under them.
  if (group.userData.riding) {
    const t = timeMs * 0.001 + m.phase, mv = group.userData.ridingMoving ? 1 : 0;
    rot(B.legL, -1.35, 0, 0.5); rot(B.legR, -1.35, 0, -0.5);
    rot(B.shinL, 1.3, 0, 0); rot(B.shinR, 1.3, 0, 0);
    rot(B.armL, -0.7 + Math.sin(t * 9) * 0.05 * mv, 0, 0.2); rot(B.armR, -0.7 - Math.sin(t * 9) * 0.05 * mv, 0, -0.2);
    rot(B.foreL, -0.55, 0, 0); rot(B.foreR, -0.55, 0, 0);
    if (B.body) rot(B.body, 0.08 + 0.06 * mv + Math.sin(t * 9) * 0.03 * mv, 0, Math.sin(t * 0.8) * 0.02);
    if (B.head) rot(B.head, -0.06 * mv, Math.sin(t * 0.37) * 0.25 * (1 - mv), 0);
    if (B.cape) rot(B.cape, 0.3 + 0.4 * mv + Math.sin(t * 8) * 0.05 * mv, 0, 0);
    group.position.y = group.userData.baseY || 0;
    m.u.uBlink.value = 0;
    m.u.uTime.value = t;
    return true;
  }
  const gs = group.userData.groundSpeed;
  const run = gs != null ? gs > 2.1 * H : speed > 1.6;
  m.blend += Math.max(-1, Math.min(1, (moving ? 1 : 0) - m.blend)) * Math.min(1, dt * 7);
  m.runK = (m.runK || 0) + ((run && moving ? 1 : 0) - (m.runK || 0)) * Math.min(1, dt * 5);
  const k = m.blend, idle = 1 - k, rk = m.runK * k;
  // a stride (two steps) is about a body-height walking, and more running
  const pace = (run ? 10 : 6.6) * speed;
  const rate = gs != null && moving ? Math.min(pace * 2, Math.max(pace * 0.6, Math.PI * 2 * gs / ((run ? 1.5 : 1.05) * H))) : pace;
  m.gait += dt * rate;
  const p = m.gait, sp = Math.sin(p), cp = Math.cos(p);

  // legs: a swing from the hip, a knee that folds on the way through
  const thigh = (0.42 + 0.3 * m.runK) * k, knee = (0.55 + 0.75 * m.runK) * k;
  rot(B.legL, -sp * thigh, 0, 0);
  rot(B.legR, sp * thigh, 0, 0);
  rot(B.shinL, Math.pow(Math.max(0, Math.cos(p + 0.35)), 1.4) * knee + 0.04 * k, 0, 0);
  rot(B.shinR, Math.pow(Math.max(0, -Math.cos(p + 0.35)), 1.4) * knee + 0.04 * k, 0, 0);
  // the hips: up on each passing leg, rolling, leaning into a run
  if (B.body) {
    B.body.position.y += (0.5 + 0.5 * Math.cos(2 * p)) * H * (0.012 + 0.012 * m.runK) * k - H * 0.012 * rk;
    rot(B.body, 0.1 * rk + Math.sin(t * 0.5) * 0.01 * idle, sp * 0.1 * k, sp * 0.035 * k + Math.sin(t * 0.45) * 0.018 * idle);
  }
  // the chest turns against the hips, and breathes
  if (B.chest) {
    const br = Math.sin(t * 1.8);
    B.chest.scale.set(1 + br * 0.008, 1 + br * 0.012, 1 + br * 0.008);
    rot(B.chest, 0.04 * rk + br * 0.012 * idle, -sp * 0.16 * k, -sp * 0.02 * k);
  }
  // arms: counter-swing; elbows bend, more when running
  const swing = (0.38 + 0.35 * m.runK) * k;
  rot(B.armL, sp * swing + Math.sin(t * 1.3) * 0.03 * idle, 0, 0.09 + 0.05 * rk);
  rot(B.armR, -sp * swing + Math.sin(t * 1.3 + 1) * 0.03 * idle, 0, -0.09 - 0.05 * rk);
  rot(B.foreL, -(0.14 + 0.2 * k + 1.1 * rk) - Math.max(0, -sp) * 0.25 * k, 0, 0);
  rot(B.foreR, -(0.14 + 0.2 * k + 1.1 * rk) - Math.max(0, sp) * 0.25 * k, 0, 0);
  // the head stays level over it all and looks about when standing
  if (B.head) {
    const look = Math.sin(t * 0.37) * 0.3 + Math.sin(t * 1.07) * 0.08;
    rot(B.head, -0.03 * rk + Math.sin(t * 0.53) * 0.05 * idle, look * idle * 0.7 + sp * 0.08 * k, Math.sin(t * 0.31) * 0.04 * idle);
  }
  // cloth that trails
  if (B.cape) rot(B.cape, 0.12 + 0.25 * k + 0.35 * rk + Math.sin(t * 7 + 1) * 0.04 * k, 0, Math.sin(t * 1.3) * 0.03);
  if (B.coatB) rot(B.coatB, 0.05 + 0.2 * rk + Math.sin(p * 2) * 0.05 * k, 0, 0);
  if (B.pack) rot(B.pack, Math.abs(sp) * 0.06 * k, 0, 0);

  // a one-off move on top
  const A = m.act;
  if (A) {
    A.t += dt;
    const u = A.t / A.dur;
    if (u >= 1) m.act = null;
    else moves[A.name]?.(B, u, envelope(u), group, m);
  }

  group.position.y = group.userData.baseY || 0;
  // blink: a quick close and open every few seconds, now and then twice
  m.blinkAt -= dt;
  let bl = 0;
  if (m.blinkAt < 0) {
    const s = -m.blinkAt;
    bl = s < 0.07 ? s / 0.07 : s < 0.16 ? 1 - (s - 0.07) / 0.09 : 0;
    if (s > 0.16) m.blinkAt = Math.random() < 0.2 ? 0.12 : 2.4 + Math.random() * 3.5;
  }
  m.u.uBlink.value = bl;
  m.u.uTime.value = t;
  return true;
}

/**
 * The one-off moves. Each is handed the bones, how far through it is (u) and
 * how much of it is on (w, eased in and out), and adds to the pose the loop
 * made. Rotations: x forward (negative lifts an arm to the front), z out.
 */
const moves = {
  // the rogue flips the dagger up, turns on a heel
  flourish(B, u, w) {
    const spin = Math.sin(u * Math.PI * 2);
    rot(B.armR, -1.35 * w, 0.2 * w, -0.35 * w);
    rot(B.foreR, -0.9 * w + spin * 0.3 * w, spin * 0.8 * w, 0);
    rot(B.armL, 0.25 * w, 0, 0.35 * w);
    rot(B.body, 0, 0.45 * w * Math.sin(u * Math.PI), 0);
    rot(B.head, 0.1 * w, -0.25 * w, 0);
  },
  // the pirate draws and points the cutlass, other hand on the hip
  draw(B, u, w) {
    rot(B.armR, -1.55 * w, -0.25 * w, -0.25 * w);
    rot(B.foreR, -0.15 * w, 0, 0);
    rot(B.armL, 0.2 * w, 0, 0.55 * w);
    rot(B.foreL, -1.3 * w, 0, 0);
    rot(B.chest, 0, 0.25 * w, 0);
    rot(B.head, 0, -0.2 * w, 0);
    rot(B.legR, -0.2 * w, 0, 0);
  },
  // the fire keeper lifts the flame in the open hand and looks into it
  ignite(B, u, w) {
    rot(B.armL, -1.75 * w, 0, 0.25 * w);
    rot(B.foreL, -0.55 * w, 0, 0);
    rot(B.head, -0.3 * w, 0.2 * w, 0);
    rot(B.chest, -0.08 * w, 0.2 * w, 0);
    rot(B.armR, 0.15 * w, 0, -0.3 * w);
    if (B.foreL) B.foreL.scale.setScalar(1 + 0.25 * w * (0.8 + 0.2 * Math.sin(u * 30)));
  },
  // the catcher winds up and throws the sphere
  throw(B, u, w) {
    const back = sstep(0, 0.35, u), fwd = sstep(0.35, 0.6, u);
    rot(B.armR, (1.3 * back - 3.0 * fwd) * w, 0, -0.2 * w);
    rot(B.foreR, (-0.9 * back + 0.7 * fwd) * w, 0, 0);
    rot(B.chest, 0, (0.45 * back - 0.6 * fwd) * w, 0);
    rot(B.armL, -0.9 * w * (1 - fwd * 0.6), 0, 0.2 * w);
    rot(B.legL, -0.35 * fwd * w, 0, 0);
    rot(B.body, 0.1 * fwd * w, 0, 0);
  },
  // the ranger raises the bow and draws
  aim(B, u, w) {
    rot(B.chest, 0, -0.55 * w, 0);
    rot(B.head, 0, 0.55 * w, 0);
    rot(B.armL, -1.5 * w, 0.35 * w, 0.1 * w);
    rot(B.foreL, -0.1 * w, 0, 0);
    rot(B.armR, -1.35 * w, -0.5 * w, -0.25 * w);
    rot(B.foreR, -1.9 * w * (0.7 + 0.3 * sstep(0.2, 0.6, u)), 0, 0);
  },
  // the mage raises the staff and holds out the other hand
  cast(B, u, w) {
    const pulse = Math.sin(u * Math.PI * 6) * 0.04;
    rot(B.armR, -2.3 * w, 0, -0.2 * w);
    rot(B.foreR, 0.2 * w, 0, 0);
    rot(B.armL, -1.25 * w, 0.2 * w, 0.2 * w);
    rot(B.foreL, (-0.25 + pulse) * w, 0, 0);
    rot(B.chest, -0.1 * w, 0, 0);
    rot(B.head, -0.2 * w, 0, 0);
  },
  // the explorer holds the glass up to one eye
  look(B, u, w) {
    rot(B.armL, -1.35 * w, 0.35 * w, 0);
    rot(B.foreL, -1.45 * w, 0.3 * w, 0);
    rot(B.chest, 0.12 * w, 0.2 * w, 0);
    rot(B.head, 0.08 * w, -0.15 * w, 0.12 * w);
    rot(B.armR, 0.1 * w, 0, -0.35 * w);
    rot(B.foreR, -1.4 * w, 0, 0);
  },
  // a strike with the right hand, for a fight
  attack(B, u, w) {
    const back = sstep(0, 0.3, u), fwd = sstep(0.3, 0.5, u);
    rot(B.armR, (0.8 * back - 2.2 * fwd) * w, 0, -0.25 * w);
    rot(B.chest, 0, (0.4 * back - 0.5 * fwd) * w, 0);
    rot(B.body, 0.12 * fwd * w, 0, 0);
  },
  // a flinch
  hit(B, u, w) {
    rot(B.chest, -0.35 * w, 0, 0.1 * w);
    rot(B.head, -0.3 * w, 0, 0);
    rot(B.armL, -0.4 * w, 0, 0.4 * w);
    rot(B.armR, -0.4 * w, 0, -0.4 * w);
  },
  // arms up: a win
  cheer(B, u, w) {
    const bob = Math.abs(Math.sin(u * Math.PI * 3));
    rot(B.armL, -2.6 * w, 0, 0.35 * w);
    rot(B.armR, -2.6 * w, 0, -0.35 * w);
    rot(B.foreL, -0.3 * w, 0, 0);
    rot(B.foreR, -0.3 * w, 0, 0);
    if (B.body) B.body.position.y += bob * 0.04 * w;
  },
};

/** Play a one-off move — a kind's show-off pose, an attack, a hit — then back to the loop. */
export function personAct(group, name, dur = 1.3) {
  const m = group?.userData?.model;
  if (!m || m.def?.plan !== 'person') return false;
  m.act = { name, t: 0, dur };
  return true;
}

export { setFigurineLod };
