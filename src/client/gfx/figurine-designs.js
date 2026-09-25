/**
 * The creatures, sculpted.
 *
 * Each design is a small sculpture in its own units (roughly a metre from nose
 * to tail for a starter; the engine scales it to the species' size): the soft
 * body as blended shapes, paint laid over it, the hard parts as geometry, a
 * pair of eyes, and the bones it bends at. All of them are this game's own —
 * a cub with an ember in its brow, a snail with a garden on its back — built
 * to read at a glance from the camera's height and to stand up to a close
 * look in battle.
 *
 * Coordinates: y up, the creature faces +z, x is its left. `mir` makes the
 * other side (and swaps an L bone for its R).
 */
import { BOX, CONE, ELLIPSOID, PAINT, CARVE, SPHERE, TORUS } from './figurine.js';

// -- the vocabulary ----------------------------------------------------------
const S = (bone, c, p, r, k = 0.05, o) => ({ t: SPHERE, bone, c, p, r, k, ...o });
const E = (bone, c, p, r, k = 0.05, o) => ({ t: ELLIPSOID, bone, c, p, r, k, ...o });
const C = (bone, c, a, b, r1, r2, k = 0.05, o) => ({ t: CONE, bone, c, a, b, r1, r2, k, ...o });
const Bx = (bone, c, p, h, round, k = 0.05, o) => ({ t: BOX, bone, c, p, h, round, k, ...o });
const Tr = (bone, c, p, R, r, k = 0.03, o) => ({ t: TORUS, bone, c, p, R, r, k, ...o });
const paint = (c, part, soft = 0.025, o) => ({ ...part, op: PAINT, c, soft, ...o });
const carve = (part, k = 0.02, c) => ({ ...part, op: CARVE, k, ...(c != null ? { c } : {}) });
const mir = (x) => ({ ...x, mirror: true });

const horn = (bone, c, a, b, r, o) => ({ kind: 'horn', bone, c, a, b, r, ...o });
const tube = (bone, c, a, b, r, o) => ({ kind: 'tube', bone, c, a, b, r, ...o });
const plate = (bone, c, shape, depth, place, o) => ({ kind: 'plate', bone, c, shape, depth, place, ...o });
const crystal = (bone, c, a, dir, len, r, o) => ({ kind: 'crystal', bone, c, a, dir, len, r, ...o });
const flame = (bone, a, dir, len, r, o) => ({ kind: 'flame', bone, a, dir, len, r, glow: 1, ...o });
const ball = (bone, c, p, r, o) => ({ kind: 'ball', bone, c, p, r, ...o });
const ring = (bone, c, p, R, r, rot, o) => ({ kind: 'ring', bone, c, p, R, r, rot, ...o });

// -- a few outlines ------------------------------------------------------------
/** A leaf, pointed at both ends, `l` long and `w` wide, along +x. */
const leafShape = (l, w) => {
  const pts = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([t * l, Math.sin(Math.PI * t) * w * (1 - t * 0.25)]); }
  for (let i = 11; i >= 1; i--) { const t = i / 12; pts.push([t * l, -Math.sin(Math.PI * t) * w * (1 - t * 0.25)]); }
  return pts;
};
/** A zigzag bolt, `h` tall. */
const boltShape = (h, w) => [[0, 0], [w * 0.55, h * 0.42], [w * 0.2, h * 0.42], [w * 0.75, h], [w * 0.05, h * 0.52], [w * 0.42, h * 0.52], [-w * 0.1, 0.02 * h]];
/** A fin: a swept triangle with a curved trailing edge. */
const finShape = (l, h) => [[0, 0], [l * 0.35, h], [l * 0.62, h * 0.82], [l * 0.8, h * 0.45], [l, 0]];

/** Flames fanned round a centre: a mane, a crown, a ruff. */
const flameRing = (bone, c, n, R, len, r, o = {}) => Array.from({ length: n }, (_, i) => {
  const a = (o.from ?? 0) + (o.span ?? Math.PI * 2) * (o.span ? i / Math.max(1, n - 1) : i / n);
  const dir = [Math.cos(a) * (o.out ?? 1), o.up ?? 0.9, Math.sin(a) * (o.out ?? 1) + (o.back ?? 0)];
  const p = [c[0] + Math.cos(a) * R, c[1], c[2] + Math.sin(a) * R];
  return flame(bone, p, dir, len * (0.85 + ((i * 7) % 5) * 0.06), r, { c: o.c ?? 0xFFC23A, c1: o.c1 ?? 0xFF4A12, glow: o.glow ?? 0.75 });
});

/**
 * Flames round a neck: a ring about the neck's own axis, over the top and
 * down the sides, each tongue leaning back and out — a mane.
 */
const collar = (bone, centre, axis, R, n, len, r, o = {}) => {
  const ax = axis.map((v) => v / Math.hypot(...axis));
  const X = [1, 0, 0];
  const Y = [ax[1] * X[2] - ax[2] * X[1], ax[2] * X[0] - ax[0] * X[2], ax[0] * X[1] - ax[1] * X[0]];
  const from = o.from ?? -0.15, to = o.to ?? 1.15;
  return Array.from({ length: n }, (_, i) => {
    const th = Math.PI * (from + (to - from) * (i / Math.max(1, n - 1)));
    const rad = [Math.cos(th) * X[0] + Math.sin(th) * Y[0], Math.cos(th) * X[1] + Math.sin(th) * Y[1], Math.cos(th) * X[2] + Math.sin(th) * Y[2]];
    const p = [centre[0] + rad[0] * R, centre[1] + rad[1] * R, centre[2] + rad[2] * R];
    const dir = [rad[0] + ax[0] * 0.5, rad[1] + ax[1] * 0.5 + 0.35, rad[2] + ax[2] * 0.5 - (o.back ?? 0.5)];
    const s = 0.8 + 0.2 * Math.sin(Math.PI * i / Math.max(1, n - 1));
    return flame(bone, p, dir, len * s, r * s, { ...FIRE, ...o.fire, side: [0, 0, -1] });
  });
};

/** Spikes down a line, big in the middle. */
const spineSpikes = (bone, c, from, to, n, len, r, o = {}) => Array.from({ length: n }, (_, i) => {
  const t = n === 1 ? 0.5 : i / (n - 1);
  const p = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
  const s = 0.65 + 0.35 * Math.sin(Math.PI * t);
  const b = typeof bone === 'function' ? bone(t) : bone;
  return o.crystal
    ? crystal(b, c, p, o.dir ?? [0, 1, -0.35], len * s, r * s, { c1: o.c1, glow: o.glow })
    : horn(b, c, p, [p[0] + (o.dir?.[0] ?? 0) * len * s, p[1] + (o.dir?.[1] ?? 1) * len * s, p[2] + (o.dir?.[2] ?? -0.35) * len * s], r * s, { c1: o.c1, bend: o.bend });
});

// -- body plans ----------------------------------------------------------------
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * A four-legged body from its proportions: a barrel with a chest and a rump,
 * a big round head (the proportion that makes a figure cute), a muzzle,
 * ears, four short legs with paws, a tail, and the pale belly and face that
 * most of these animals have. Returns what a design needs, plus anchors for
 * placing its own details.
 */
function quad(o) {
  const a = o.a, b = o.b ?? a, pawC = o.paw ?? b, bellyC = o.belly ?? b;
  const L = o.len ?? 0.62, W = o.wide ?? 0.24, Hb = o.deep ?? 0.22, y = o.y ?? 0.4;
  const hr = o.head ?? 0.32;
  const zF = L * 0.3, zB = -L * 0.3;
  const hz = o.hz ?? (zF + hr * 0.42), hy = o.hy ?? (y + Hb + hr * 0.5);
  const legR = o.legR ?? 0.08, st = o.stance ?? W * 0.55, pawR = o.pawR ?? legR * 1.05;
  const k = o.k ?? 0.06;
  const bones = {
    root: [0, 0, 0], body: [0, y, 0, 'root'], chest: [0, y + 0.02, zF * 0.6, 'body'],
    head: [0, y + Hb * 0.85, hz - hr * 0.62, 'chest'],
    legFL: [st, y - Hb * 0.15, zF, 'chest'], legFR: [-st, y - Hb * 0.15, zF, 'chest'],
    legBL: [st, y - Hb * 0.15, zB, 'body'], legBR: [-st, y - Hb * 0.15, zB, 'body'],
  };
  const parts = [
    E('body', a, [0, y, 0], [W, Hb, L / 2], k),
    S('chest', a, [0, y + Hb * 0.12, zF * 0.72], Hb * 0.96, k * 1.3),
    S('body', a, [0, y + Hb * 0.02, zB * 0.8], Hb * 0.93, k * 1.2),
  ];
  if (o.neck) parts.push(C('head', a, [0, y + Hb * 0.5, zF * 0.9], [0, hy - hr * 0.45, hz - hr * 0.35], Hb * 0.62, hr * 0.5, k * 1.4));
  parts.push(
    S('head', a, [0, hy, hz], hr, k * 1.1),
    mir(E('head', o.cheek ?? a, [hr * 0.5, hy - hr * 0.3, hz + hr * 0.28], [hr * 0.47, hr * 0.38, hr * 0.42], k)),
  );
  const muz = o.muzzle ?? {};
  const mz = [0, hy - hr * (muz.drop ?? 0.32), hz + hr * (muz.out ?? 0.74)];
  if (muz !== false) parts.push(E('head', muz.c ?? bellyC, mz, [hr * (muz.w ?? 0.38), hr * (muz.h ?? 0.27), hr * (muz.l ?? 0.34)], 0.05));
  // legs
  const legTop = y - Hb * 0.1, ground = pawR * 0.85;
  parts.push(
    mir(C('legFL', a, [st, legTop, zF], [st * 1.04, ground, zF + 0.02], legR, legR * 0.92, 0.05)),
    mir(E('legFL', pawC, [st * 1.04, pawR * 0.7, zF + legR * 0.7], [pawR, pawR * 0.72, pawR * 1.2], 0.04)),
    mir(E('legBL', a, [st * 1.05, y - Hb * 0.05, zB], [W * 0.5, Hb * 0.68, Hb * 0.68], k)),
    mir(C('legBL', a, [st * 1.05, y - Hb * 0.3, zB], [st * 1.05, ground, zB + 0.03], legR * 0.96, legR * 0.9, 0.05)),
    mir(E('legBL', pawC, [st * 1.05, pawR * 0.7, zB + legR * 0.75], [pawR, pawR * 0.72, pawR * 1.2], 0.04)),
  );
  // paint: belly and face
  if (o.bellyPaint !== false) parts.push(paint(bellyC, E('body', 0, [0, y - Hb * 0.42, zF * 0.3], [W * 0.68, Hb * 0.6, L * 0.44]), 0.04));
  if (o.mask !== false) parts.push(paint(o.maskC ?? bellyC, E('head', 0, [0, hy - hr * 0.42, hz + hr * 0.45], [hr * 0.64, hr * 0.42, hr * 0.52]), 0.045));
  if (o.blush !== false) parts.push(mir(paint(o.blushC ?? 0xFF9C8A, E('head', 0, [hr * 0.64, hy - hr * 0.26, hz + hr * 0.6], [hr * 0.16, hr * 0.11, hr * 0.12]), 0.02)));
  // ears
  const details = [];
  const ear = o.ear;
  if (ear) {
    const base = [hr * (ear.x ?? 0.5), hy + hr * (ear.y ?? 0.72), hz - hr * (ear.back ?? 0.12)];
    const tip = [base[0] + hr * (ear.spread ?? 0.35), base[1] + hr * (ear.len ?? 0.75), base[2] - hr * (ear.tilt ?? 0.18)];
    bones.earL = [base[0], base[1], base[2], 'head']; bones.earR = [-base[0], base[1], base[2], 'head'];
    parts.push(mir(C('earL', ear.c ?? a, base, tip, hr * (ear.r ?? 0.34), hr * (ear.tip ?? 0.13), 0.04)));
    if (ear.inner !== false) parts.push(mir(paint(ear.inner ?? 0xB8322A, E('earL', 0, add3(lerp3(base, tip, 0.45), [0, 0, hr * 0.13]), [hr * 0.15, hr * 0.28, hr * 0.12]), 0.02)));
    if (ear.tipC) parts.push(mir(paint(ear.tipC, S('earL', 0, tip, hr * 0.22), 0.03)));
    var earTip = tip;
  }
  // tail
  const tl = o.tail;
  let tailTip = null;
  if (tl) {
    const n = tl.segs ?? 2;
    const t0 = [0, y + Hb * 0.25, -L * 0.48];
    const pts = [t0];
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      pts.push([0, t0[1] + (tl.rise ?? 0.3) * Math.sin(f * Math.PI * 0.5), t0[2] - (tl.len ?? 0.28) * Math.sin(f * Math.PI * 0.62) - (tl.hook ?? 0) * f * f]);
    }
    const names = ['tail', 'tail2', 'tail3', 'tail4'];
    for (let i = 0; i < n; i++) {
      bones[names[i]] = [...pts[i], i === 0 ? 'body' : names[i - 1]];
      const r0 = (tl.r ?? 0.07) * (1 - i * (tl.taper ?? 0.18)), r1 = (tl.r ?? 0.07) * (1 - (i + 1) * (tl.taper ?? 0.18));
      parts.push(C(names[i], tl.c ?? a, pts[i], pts[i + 1], r0, Math.max(0.012, tl.tipR && i === n - 1 ? tl.tipR : r1), 0.05));
    }
    bones[names[n]] = [...pts[n], names[n - 1]];
    tailTip = pts[n];
    if (tl.tipC) parts.push(paint(tl.tipC, S(names[n - 1], 0, pts[n], (tl.r ?? 0.07) * 1.3), 0.03));
  }
  if (o.nose !== false) details.push(ball('head', o.noseC ?? 0x3A1C14, [0, mz[1] + hr * 0.12, mz[2] + hr * (muz.l ?? 0.34) * 0.92], hr * 0.105, { sy: 0.78 }));
  const eyes = { at: [hr * (o.eyeX ?? 0.42), hy + hr * (o.eyeY ?? 0.1), hz + hr * 0.75], r: hr * (o.eye ?? 0.27), iris: o.iris ?? 0x3A2014, tall: o.eyeTall ?? 1.18 };
  return {
    size: o.size, plan: 'quad', lid: a, bones, parts, details, eyes,
    at: { y, Hb, L, W, hr, hy, hz, zF, zB, st, tailTip, earTip: typeof earTip !== 'undefined' ? earTip : null, tailBone: tl ? ['tail', 'tail2', 'tail3', 'tail4'][tl.segs ?? 2] : null, crown: [0, hy + hr, hz], brow: [0, hy + hr * 0.62, hz + hr * 0.62] },
  };
}

/** A wing outline, `l` long: feathers along the trailing edge. */
const featherWing = (l, h, n = 4) => {
  const pts = [[0, 0], [l * 0.25, h * 0.55], [l * 0.6, h * 0.62], [l, h * 0.35]];
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = l * (1 - t * 0.92), y = -h * 0.12 - Math.sin(Math.PI * t) * h * 0.22;
    pts.push([x + l * 0.04, y + h * 0.1], [x - l * 0.08, y - h * 0.05]);
  }
  return pts.slice(0, -1).concat([[0, -h * 0.2]]);
};
/** A bat's wing: three fingers and the skin scalloped between them. */
const batWing = (l, h) => [[0, 0.1 * h], [l * 0.35, h * 0.62], [l * 0.7, h * 0.72], [l, h * 0.5], [l * 0.8, h * 0.05], [l * 0.66, -h * 0.28], [l * 0.45, -h * 0.02], [l * 0.3, -h * 0.4], [l * 0.16, -h * 0.08], [0, -h * 0.2]];
/** An insect's wing: a long rounded blade. */
const bugWing = (l, h) => { const pts = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI * 2; pts.push([l * 0.5 + Math.cos(a) * l * 0.5, Math.sin(a) * h * (0.5 + 0.18 * Math.cos(a))]); } return pts; };

/**
 * A round creature whose body is its head — a drop of water, a snowball —
 * with little feet and flippers.
 */
function blob(o) {
  const a = o.a, b = o.b ?? a, R = o.r ?? 0.4;
  const y = o.y ?? R * 0.95;
  const bones = { root: [0, 0, 0], body: [0, y * 0.7, 0, 'root'], head: [0, y, 0.02, 'body'], legL: [R * 0.42, R * 0.3, 0.05, 'body'], legR: [-R * 0.42, R * 0.3, 0.05, 'body'] };
  const parts = [
    E('body', a, [0, y, 0], [R * (o.wide ?? 1.02), R * (o.tall ?? 0.94), R * (o.deep ?? 0.94)], 0.05),
  ];
  if (o.feet !== false) parts.push(mir(E('legL', o.footC ?? b, [R * 0.42, Math.max(R * 0.12, y - R * 0.84), R * 0.16], [R * 0.24, R * 0.14, R * 0.3], 0.07)));
  if (o.belly !== false) parts.push(paint(o.belly ?? b, E('body', 0, [0, y - R * 0.25, R * 0.45], [R * 0.66, R * 0.62, R * 0.5]), 0.05));
  if (o.blush !== false) parts.push(mir(paint(o.blushC ?? 0xFF9CB0, E('head', 0, [R * 0.55, y - R * 0.05, R * 0.8], [R * 0.13, R * 0.09, R * 0.1]), 0.02)));
  if (o.fins) {
    bones.finL = [R * 0.9, y - R * 0.1, 0.02, 'body']; bones.finR = [-R * 0.9, y - R * 0.1, 0.02, 'body'];
    parts.push(mir(E('finL', o.finC ?? a, [R * 1.02, y - R * 0.2, R * 0.05], [R * 0.3, R * 0.14, R * 0.2], 0.08, { rot: [0, 0, -0.6] })));
  }
  const eyes = { at: [R * (o.eyeX ?? 0.36), y + R * (o.eyeY ?? 0.12), R * 0.92], r: R * (o.eye ?? 0.22), iris: o.iris ?? 0x123456, tall: o.eyeTall ?? 1.2 };
  return { size: o.size, plan: 'biped', lid: a, bones, parts, details: [], eyes, at: { y, R, top: [0, y + R * (o.tall ?? 0.94), 0] } };
}

/**
 * A standing chibi: a pear of a body, a head as wide as it, short legs and
 * little arms. Sprites, imps, robots and golems start here.
 */
function biped(o) {
  const a = o.a, b = o.b ?? a, bodyC = o.bodyC ?? a;
  const hr = o.head ?? 0.3, br = o.body ?? 0.24, leg = o.leg ?? 0.16;
  const by = leg + br * 0.9, hy = o.hy ?? (by + br * 0.85 + hr * 0.85);
  const k = o.k ?? 0.06;
  const bones = {
    root: [0, 0, 0], body: [0, by, 0, 'root'], chest: [0, by + br * 0.5, 0, 'body'], head: [0, hy - hr * 0.7, 0, 'chest'],
    legL: [br * 0.45, leg + 0.02, 0, 'body'], legR: [-br * 0.45, leg + 0.02, 0, 'body'],
    armL: [br * 0.95, by + br * 0.45, 0, 'chest'], armR: [-br * 0.95, by + br * 0.45, 0, 'chest'],
  };
  const parts = [
    E('body', bodyC, [0, by, 0], [br * (o.wide ?? 1), br * (o.tall ?? 1.05), br * (o.deep ?? 0.92)], k),
    S('head', a, [0, hy, o.hz ?? 0.02], hr, k * (o.neckK ?? 1.2)),
  ];
  if (o.legs !== false) parts.push(
    mir(C('legL', o.legC ?? bodyC, [br * 0.45, leg + 0.05, 0], [br * 0.5, (o.footR ?? leg * 0.45) * 0.9, 0.02], o.legR ?? br * 0.3, (o.legR ?? br * 0.3) * 0.9, 0.05)),
    mir(E('legL', o.footC ?? b, [br * 0.5, (o.footR ?? leg * 0.45) * 0.7, br * 0.12], [o.footR ?? leg * 0.45, (o.footR ?? leg * 0.45) * 0.7, (o.footR ?? leg * 0.45) * 1.3], 0.04)),
  );
  const armLen = o.arm ?? br * 1.0, armR = o.armR ?? br * 0.22;
  if (o.arms !== false) parts.push(
    mir(C('armL', o.armC ?? bodyC, [br * 0.85, by + br * 0.45, 0], [br * 0.85 + armLen * 0.55, by + br * 0.45 - armLen * 0.75, br * 0.1], armR, armR * 1.05, 0.05)),
    mir(S('armL', o.handC ?? o.armC ?? bodyC, [br * 0.85 + armLen * 0.6, by + br * 0.45 - armLen * 0.82, br * 0.12], armR * (o.hand ?? 1.25), 0.04)),
  );
  if (o.belly) parts.push(paint(o.belly, E('body', 0, [0, by - br * 0.1, br * 0.55], [br * 0.66, br * 0.78, br * 0.5]), 0.04));
  if (o.blush !== false) parts.push(mir(paint(o.blushC ?? 0xFF9CB0, E('head', 0, [hr * 0.6, hy - hr * 0.22, hr * 0.72], [hr * 0.15, hr * 0.1, hr * 0.12]), 0.02)));
  const eyes = { at: [hr * (o.eyeX ?? 0.38), hy + hr * (o.eyeY ?? 0.05), hr * 0.9], r: hr * (o.eye ?? 0.26), iris: o.iris ?? 0x223344, tall: o.eyeTall ?? 1.2 };
  return {
    size: o.size, plan: 'biped', lid: a, bones, parts, details: [], eyes,
    at: { by, br, hr, hy, leg, crown: [0, hy + hr, 0.02], back: [0, by + br * 0.4, -br * 0.9], hand: [br * 0.85 + armLen * 0.6, by + br * 0.45 - armLen * 0.82, br * 0.12] },
  };
}

/**
 * A serpent: a head on a neck that becomes a body, curving in an S along
 * the ground (or through the water), thinning to the tail. The spine is a
 * chain of bones the animator sends a wave down.
 */
function serpent(o) {
  const a = o.a, n = o.segs ?? 7, hr = o.head ?? 0.22;
  const L = o.len ?? 1.4, r0 = o.r ?? 0.16;
  const swim = o.pose !== 'ground';
  const bones = { root: [0, 0, 0] };
  let pts = [];
  if (o.path) {
    // a hand-drawn spine, resampled evenly: Catmull-Rom through the points
    const P = o.path, m = P.length - 1;
    const cr = (t) => {
      const f = Math.min(m - 1e-6, t * m), i = Math.floor(f), u = f - i;
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(m, i + 2)];
      return [0, 1, 2].map((c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u * u + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u * u * u));
    };
    for (let i = 0; i <= n; i++) pts.push(cr(i / n));
  }
  for (let i = 0; i <= n && !o.path; i++) {
    const t = i / n;
    let x, y, z;
    if (swim) {
      // a swimmer's S, in the vertical plane: head high, body dipping, tail up
      x = Math.sin(t * Math.PI * 1.1) * L * (o.sway ?? 0.1);
      y = r0 + (o.lift ?? 0.5) * (0.75 + 0.35 * Math.cos(t * Math.PI * (o.wave ?? 1.6))) * (1 - t * 0.35);
      z = L * 0.4 - t * L * 0.95;
    } else {
      // up from the head, down to the ground, then along it in a curve
      x = Math.sin(t * Math.PI * (o.wave ?? 1.3)) * L * (o.sway ?? 0.14);
      y = r0 * 0.9 + Math.max(0, (o.lift ?? 0.45) * (1 - t * 2.2)) + (o.rise ?? 0) * t * t;
      z = L * 0.35 - t * L;
    }
    pts.push([x, y, z]);
  }
  const parts = [];
  for (let i = 0; i < n; i++) {
    const name = 'seg' + (i + 1);
    bones[name] = [...pts[i], i === 0 ? 'root' : 'seg' + i];
    const rad = (j) => {
      if (!o.radii) return r0 * (1 - (j / n) * (o.taper ?? 0.72));
      const f = j / n * (o.radii.length - 1), k = Math.min(o.radii.length - 2, Math.floor(f));
      return o.radii[k] + (o.radii[k + 1] - o.radii[k]) * (f - k);
    };
    parts.push(C(name, a, pts[i], pts[i + 1], rad(i), rad(i + 1), 0.08));
  }
  if (o.belly) for (let i = 0; i < n; i++) {
    const rA = o.radii ? o.radii[Math.min(o.radii.length - 1, Math.round(i / n * (o.radii.length - 1)))] : r0 * (1 - (i / n) * (o.taper ?? 0.72));
    // the belly is on the inside of the curve's front: perpendicular to the
    // spine, toward the ground when it runs level and forward when it rises
    const T = [pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1], pts[i + 1][2] - pts[i][2]], tl = Math.hypot(...T) || 1;
    const bn = [0, T[2] / tl, -T[1] / tl];
    const off = [0, bn[1] * rA * 0.75, bn[2] * rA * 0.75];
    parts.push(paint(o.belly, C('seg' + (i + 1), 0, add3(pts[i], off), add3(pts[i + 1], off), rA * 0.62, rA * 0.55, 0), 0.03));
  }
  const hp = [pts[0][0], pts[0][1] + hr * 0.55, pts[0][2] + hr * 0.5];
  bones.head = [pts[0][0], pts[0][1] + hr * 0.2, pts[0][2], 'seg1'];
  parts.push(S('head', a, hp, hr, 0.08), E('head', o.snoutC ?? a, [hp[0], hp[1] - hr * 0.25, hp[2] + hr * 0.7], [hr * 0.62, hr * 0.45, hr * 0.62], 0.06));
  if (o.belly) parts.push(paint(o.belly, E('head', 0, [hp[0], hp[1] - hr * 0.5, hp[2] + hr * 0.55], [hr * 0.6, hr * 0.3, hr * 0.7]), 0.04));
  const eyes = { at: [hp[0] + hr * (o.eyeX ?? 0.42), hp[1] + hr * (o.eyeY ?? 0.18), hp[2] + hr * 0.62], r: hr * (o.eye ?? 0.28), iris: o.iris ?? 0x223344, tall: o.eyeTall ?? 1.15 };
  return { size: o.size, plan: 'serpent', lid: a, bones, parts, details: [], eyes, floats: swim, cells: 66, cellsLo: 30, at: { pts, hp, hr, r0, n, tail: pts[n] } };
}

/** A point on a plate: `u` along its x, `v` along its y, `lift` off its face. */
const onPlate = (pl, u, v, lift = 0) => {
  const nx = (w) => { const l = Math.hypot(...w); return w.map((c) => c / l); };
  const X = nx(pl.x), Y = nx(pl.y), Z = nx(pl.z || [0, 0, 1]);
  return [0, 1, 2].map((i) => pl.o[i] + X[i] * u + Y[i] * v + Z[i] * lift);
};

/** A bird: a round body, a head, a beak, wings on bones, a fan of tail and
 *  two thin legs. */
function bird(o) {
  const a = o.a, b = o.b ?? a, br = o.body ?? 0.3, hr = o.head ?? 0.24;
  const by = o.y ?? (0.18 + br), hy = by + br * 0.75 + hr * 0.55, hz = br * 0.3;
  const bones = {
    root: [0, 0, 0], body: [0, by, 0, 'root'], head: [0, hy - hr * 0.6, hz * 0.8, 'body'],
    wingL: [br * 0.8, by + br * 0.35, 0.0, 'body'], wingR: [-br * 0.8, by + br * 0.35, 0.0, 'body'],
    legL: [br * 0.35, by - br * 0.6, 0.02, 'body'], legR: [-br * 0.35, by - br * 0.6, 0.02, 'body'],
    tail: [0, by + br * 0.05, -br * 0.85, 'body'],
  };
  const parts = [
    E('body', a, [0, by, 0], [br * 0.95, br * 0.92, br * 1.05], 0.05),
    S('head', a, [0, hy, hz], hr, 0.09),
  ];
  if (o.belly) parts.push(paint(o.belly, E('body', 0, [0, by - br * 0.2, br * 0.55], [br * 0.66, br * 0.7, br * 0.5]), 0.05));
  if (o.face) parts.push(paint(o.face, E('head', 0, [0, hy - hr * 0.1, hz + hr * 0.7], [hr * 0.7, hr * 0.62, hr * 0.4]), 0.04));
  if (o.blush !== false) parts.push(mir(paint(o.blushC ?? 0xFF9CB0, E('head', 0, [hr * 0.62, hy - hr * 0.28, hz + hr * 0.62], [hr * 0.15, hr * 0.1, hr * 0.12]), 0.02)));
  const details = [];
  // beak
  const bk = [0, hy - hr * 0.12, hz + hr * 0.92];
  details.push(horn('head', o.beakC ?? 0xFFB23A, bk, [0, bk[1] - hr * (o.hook ?? 0.1), bk[2] + hr * (o.beak ?? 0.42)], hr * 0.22, { c1: o.beakC1 ?? 0xE0801A, sides: 8, rings: 5 }));
  // legs
  if (o.legs !== false) for (const s of [1, -1]) {
    const hip = [s * br * 0.35, by - br * 0.7, 0.04], foot = [s * br * 0.38, 0.05, 0.08];
    details.push(tube(s > 0 ? 'legL' : 'legR', o.legC ?? 0xFFA03A, hip, foot, br * 0.07, { taper: 0.8 }));
    for (const dx of [-0.35, 0, 0.35]) details.push(horn(s > 0 ? 'legL' : 'legR', o.legC ?? 0xFFA03A, foot, [foot[0] + dx * br * 0.3, 0.02, foot[2] + br * 0.28], br * 0.05));
  }
  // wings: raised in a V on anything that flies, folded along the flank on
  // anything that perches, each with a layer of coverts over the flight
  // feathers
  const wl = o.wing ?? br * 1.6, wh = o.wingH ?? br * 0.9;
  for (const s of [1, -1]) {
    const bone = s > 0 ? 'wingL' : 'wingR';
    const place = o.flies
      ? { o: [s * br * 0.62, by + br * 0.38, br * 0.12], x: [s * 0.86, 0.5, -0.12], y: [0, 0.12, 1], z: [0, 1, -0.12] }
      : { o: [s * br * 0.8, by + br * 0.42, br * 0.3], x: [s * 0.22, -0.42, -1], y: [0, 1, -0.4], z: [s, 0.1, 0] };
    const shape = (o.wingShape ?? featherWing);
    details.push(plate(bone, o.wingC ?? a, shape(wl, wh), wh * 0.07, place, { c1: o.wingC1 ?? b, rampX: 1 }));
    if (!o.wingShape) {
      const cov = { ...place, o: add3(place.o, place.z.map((v) => v * wh * 0.08)) };
      details.push(plate(bone, o.covertC ?? o.wingC ?? a, shape(wl * 0.55, wh * 0.72), wh * 0.06, cov, { c1: o.covertC1 ?? o.wingC ?? a, rampX: 1 }));
    }
  }
  // tail fan
  const tn = o.tailN ?? 3;
  for (let i = 0; i < tn; i++) {
    const f = tn === 1 ? 0 : i / (tn - 1) - 0.5;
    details.push(plate('tail', o.tailC ?? a, leafShape(o.tailL ?? br * 1.1, br * 0.2), br * 0.05,
      { o: [f * br * 0.3, by + br * 0.1, -br * 0.8], x: [f * 0.8, 0.35, -1], y: [1, 0, f * 0.5], z: [0, 1, 0] }, { c1: o.tailC1 ?? b, rampX: 1 }));
  }
  const eyes = { at: [hr * (o.eyeX ?? 0.4), hy + hr * (o.eyeY ?? 0.12), hz + hr * 0.82], r: hr * (o.eye ?? 0.27), iris: o.iris ?? 0x222222, tall: o.eyeTall ?? 1.18 };
  return { size: o.size, plan: 'biped', flies: o.flies, lid: a, bones, parts, details, eyes, at: { by, br, hr, hy, hz, crown: [0, hy + hr, hz] } };
}

/** A gear: `n` teeth round radius `R`, with a hole. */
const gearShape = (R, n = 8) => {
  const pts = [];
  for (let i = 0; i < n * 4; i++) {
    const a = i / (n * 4) * Math.PI * 2, r = (i % 4 === 1 || i % 4 === 2) ? R : R * 0.78;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
};
const circle = (r, n = 14) => Array.from({ length: n }, (_, i) => [Math.cos(-i / n * Math.PI * 2) * r, Math.sin(-i / n * Math.PI * 2) * r]);
/** A crescent moon, `r` across. */
const crescent = (r) => {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + i / 16 * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 15; i >= 1; i--) { const a = -Math.PI / 2 + i / 16 * Math.PI; pts.push([Math.cos(a) * r * 0.55 + r * 0.1, Math.sin(a) * r * 0.82]); }
  return pts;
};
/** Along a serpent: the spine point at segment `i` (0..n), its tangent and
 *  the direction of its back. */
const spineAt = (q, i) => {
  const P = q.at.pts, j = Math.min(P.length - 2, i);
  const T = [P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1], P[j + 1][2] - P[j][2]], l = Math.hypot(...T) || 1;
  const t = T.map((v) => v / l);
  return { p: P[Math.min(P.length - 1, i)], t, back: [0, -t[2], t[1]] };
};

/** Merge a body plan with a design's own additions. */
const make = (base, extra = {}) => ({
  ...base, ...extra,
  bones: { ...base.bones, ...(extra.bones || {}) },
  parts: [...base.parts, ...(extra.parts || [])],
  details: [...base.details, ...(extra.details || [])],
  eyes: { ...base.eyes, ...(extra.eyes || {}) },
});

const FIRE = { c: 0xFFC43A, c1: 0xE0300A, glow: 0.3 };

const cub = quad({
  size: 1.6, a: 0xF26A2C, b: 0xFFE3BC, len: 0.56, wide: 0.23, deep: 0.21, y: 0.36, head: 0.34, legR: 0.08,
  ear: { len: 0.78, r: 0.36, spread: 0.3, tilt: 0.22 }, tail: { len: 0.2, rise: 0.3, r: 0.07, segs: 2 }, iris: 0x4A2414,
});
const lynx = quad({
  size: 3.0, a: 0xFF6B2E, b: 0xFFE0B0, paw: 0xFFBB4C, len: 0.92, wide: 0.21, deep: 0.2, y: 0.56, head: 0.27, neck: true,
  legR: 0.07, ear: { len: 0.92, r: 0.3, spread: 0.26, tilt: 0.12, inner: 0x7A2A14 }, tail: { len: 0.5, rise: 0.46, r: 0.064, segs: 3, taper: 0.12 },
  iris: 0xFFA41C, eye: 0.25, cheek: 0xFFBB4C, blush: false,
});
const vulc = quad({
  size: 3.1, a: 0xD93A1E, b: 0xFFD9A8, paw: 0x4A2418, len: 1.0, wide: 0.4, deep: 0.34, y: 0.56, head: 0.33, legR: 0.15, stance: 0.27,
  neck: true, muzzle: { w: 0.55, h: 0.36, l: 0.46 }, tail: { len: 0.56, rise: 0.14, r: 0.14, segs: 3, taper: 0.22 }, iris: 0xFFC43A, eye: 0.21, blush: false,
});

export const FIGURINES = {
  // ------------------------------------------------------------------ ember
  // A cub with an ember set in its brow and a tail that is already alight.
  cindcub: make(cub, {
    details: [
      crystal('head', 0xFFD24A, add3(cub.at.brow, [0, 0.04, -0.02]), [0, 1, 0.45], 0.15, 0.05, { c1: 0xFF7A1F, glow: 0.6 }),
      flame(cub.at.tailBone, cub.at.tailTip, [0, 1, -0.3], 0.36, 0.13, FIRE),
      flame(cub.at.tailBone, add3(cub.at.tailTip, [0.03, -0.01, 0]), [0.45, 1, -0.1], 0.22, 0.075, FIRE),
      flame(cub.at.tailBone, add3(cub.at.tailTip, [-0.03, -0.01, 0]), [-0.45, 1, -0.1], 0.22, 0.075, FIRE),
    ],
  }),

  // Grown long and quick: tufts of flame on the ears, a burning ruff.
  pyrelynx: make(lynx, {
    parts: [
      ...[-0.26, -0.02, 0.22].map((z) => paint(0x9A2E14, E('body', 0, [0, lynx.at.y + lynx.at.Hb * 0.95, z], [0.19, 0.03, 0.045]), 0.02)),
    ],
    details: [
      mir(crystal('head', 0xFFD24A, add3(lynx.at.brow, [0.07, 0.03, -0.04]), [0.3, 1, 0.3], 0.13, 0.04, { c1: 0xFF7A1F, glow: 0.6 })),
      mir(flame('earL', lynx.at.earTip, [0.3, 1, -0.2], 0.17, 0.055, FIRE)),
      mir(horn('head', 0xFFBB4C, [0.2, lynx.at.hy - 0.09, lynx.at.hz + 0.0], [0.3, lynx.at.hy - 0.2, lynx.at.hz - 0.1], 0.05, { c1: 0xFFE0B0 })),
      mir(horn('head', 0xFFBB4C, [0.2, lynx.at.hy - 0.15, lynx.at.hz + 0.02], [0.28, lynx.at.hy - 0.27, lynx.at.hz - 0.05], 0.04, { c1: 0xFFE0B0 })),
      ...collar('chest', [0, lynx.at.y + lynx.at.Hb * 1.35, lynx.at.zF + 0.1], [0, 0.75, 0.66], 0.15, 9, 0.3, 0.085),
      flame(lynx.at.tailBone, lynx.at.tailTip, [0, 1, -0.4], 0.38, 0.12, FIRE),
      flame(lynx.at.tailBone, lynx.at.tailTip, [0.5, 1, -0.3], 0.24, 0.07, FIRE),
      flame(lynx.at.tailBone, lynx.at.tailTip, [-0.5, 1, -0.3], 0.24, 0.07, FIRE),
    ],
  }),

  // The cat has become a mountain: basalt plates on its back with fire in
  // the seams, three obsidian horns, a mane that burns.
  vulcanth: make(vulc, {
    lookK: 0.6,
    parts: [
      ...[[0.34, 0.16, 0.2], [0.12, 0.2, 0.26], [-0.1, 0.2, 0.26], [-0.32, 0.16, 0.2]].map(([z, w, h]) => E('body', 0x4A2418, [0, vulc.at.y + vulc.at.Hb * 0.92 + h * 0.2, z], [w, h * 0.55, 0.11], 0.025, { rot: [0.25, 0, 0] })),
      ...[[0.3, 0.2], [0.02, 0.24], [-0.24, 0.2]].flatMap(([z, x]) => [1, -1].map((sx) => E('body', 0x4A2418, [sx * x, vulc.at.y + vulc.at.Hb * 0.72, z], [0.1, 0.09, 0.1], 0.03, { rot: [0.2, 0, sx * 0.6] }))),
      mir(Bx('chest', 0x4A2418, [0.34, vulc.at.y + vulc.at.Hb * 0.7, vulc.at.zF * 0.8], [0.12, 0.16, 0.18], 0.08, 0.03, { rot: [0, 0, 0.55] })),
      ...[0.23, 0.01, -0.21].map((z) => paint(0xFF7A1A, E('body', 0, [0, vulc.at.y + vulc.at.Hb * 1.02, z], [0.26, 0.2, 0.018]), 0.012, { glow: 1 })),
    ],
    details: [
      horn('head', 0x2A1812, add3(vulc.at.brow, [0, -0.1, 0.12]), add3(vulc.at.brow, [0, 0.2, 0.26]), 0.075, { c1: 0xFF9A3C, bend: [0, 0.03, 0.05] }),
      mir(horn('head', 0x2A1812, [0.2, vulc.at.hy + 0.2, vulc.at.hz - 0.06], [0.46, vulc.at.hy + 0.56, vulc.at.hz - 0.44], 0.09, { c1: 0xFF9A3C, bend: [0.1, 0.12, 0.08] })),
      ...collar('chest', [0, vulc.at.y + vulc.at.Hb * 1.2, vulc.at.zF + 0.16], [0, 0.7, 0.72], 0.26, 11, 0.42, 0.12),
      ...spineSpikes((t) => (t < 0.5 ? 'tail' : 'tail2'), 0x2A1812, [0, vulc.at.y + vulc.at.Hb * 0.62, -0.54], [0, vulc.at.y + 0.18, -0.92], 3, 0.2, 0.06, { c1: 0xFF9A3C }),
      flame(vulc.at.tailBone, vulc.at.tailTip, [0, 1, -0.5], 0.48, 0.16, FIRE),
      flame(vulc.at.tailBone, vulc.at.tailTip, [0.5, 1, -0.4], 0.3, 0.09, FIRE),
      flame(vulc.at.tailBone, vulc.at.tailTip, [-0.5, 1, -0.4], 0.3, 0.09, FIRE),
      ...[1, -1].flatMap((sx) => [-0.05, 0.05].map((dx) => horn(sx > 0 ? 'legFL' : 'legFR', 0xF6E6D0, [sx * vulc.at.st * 1.04 + dx, 0.07, vulc.at.zF + 0.2], [sx * vulc.at.st * 1.04 + dx * 1.2, 0.03, vulc.at.zF + 0.28], 0.028))),
    ],
  }),

  // ------------------------------------------------------------------ aqua
  // A drop of water that decided to have a face: gill-fins like fronds, a
  // curl on top where the drop broke off, a little tail fin.
  puddlet: make(blob({ size: 1.1, a: 0x4FB8FF, b: 0xC9ECFF, r: 0.4, iris: 0x12305F, fins: true, eye: 0.23 }), {
    bones: { tail: [0, 0.34, -0.36, 'body'] },
    parts: [
      C('head', 0x4FB8FF, [0, 0.66, -0.02], [0, 0.9, -0.14], 0.14, 0.035, 0.1),
      paint(0x9ADCFF, E('body', 0, [-0.16, 0.56, 0.2], [0.12, 0.09, 0.08]), 0.04),
    ],
    details: [
      ...[[0.3, 0.2], [0.42, 0.05], [0.36, -0.12]].flatMap(([y, tilt]) => [1, -1].map((sx) => plate('head', 0x7FD4FF, leafShape(0.2, 0.05), 0.018,
        { o: [sx * 0.33, 0.38 + y * 0.5, 0.02], x: [sx * 0.9, tilt + 0.35, -0.3], y: [0, 1, 0.1], z: [0, 0, 1] }, { c1: 0xD8F4FF, rampX: 1 }))),
      plate('tail', 0x4FB8FF, finShape(0.26, 0.2), 0.03, { o: [0, 0.3, -0.34], x: [0, 0.2, -1], y: [0, 1, 0.1], z: [1, 0, 0] }, { c1: 0xC9ECFF }),
    ],
  }),

  // Longer and quicker: an eel that swims through the air, with a sail of
  // a fin down its back.
  tidefin: (() => {
    const q = serpent({
      size: 2.4, a: 0x2F8FE0, belly: 0xA8E2FF, segs: 8, head: 0.24, iris: 0x0E2F55, eye: 0.3, r: 0.17,
      path: [[0, 0.95, 0.35], [0, 0.76, 0.22], [0, 0.55, 0.06], [0, 0.42, -0.2], [0, 0.46, -0.48], [0, 0.62, -0.68], [0, 0.84, -0.74]],
      radii: [0.17, 0.18, 0.17, 0.15, 0.12, 0.085, 0.05],
    });
    const fin = (i, l, h) => { const f = spineAt(q, i); return plate('seg' + Math.max(1, i), 0x57B8FF, finShape(l, h), 0.024, { o: add3(f.p, f.back.map((v) => v * 0.12)), x: f.t.map((v) => -v), y: f.back, z: [1, 0, 0] }, { c1: 0xD4F0FF }); };
    const end = spineAt(q, 8);
    return make(q, {
      hover: 0.12,
      details: [
        fin(2, 0.3, 0.2), fin(4, 0.28, 0.17),
        plate('seg8', 0x57B8FF, finShape(0.36, 0.3), 0.026, { o: q.at.tail, x: [0, 0.6, -0.8], y: [0, 0.8, 0.6], z: [1, 0, 0] }, { c1: 0xD4F0FF }),
        ...[1, -1].map((sx) => plate('head', 0x7FD4FF, leafShape(0.24, 0.07), 0.02,
          { o: [sx * q.at.hr * 0.85, q.at.hp[1] - 0.02, q.at.hp[2] - 0.06], x: [sx, 0.3, -0.6], y: [0, 1, 0], z: [0, 0, 1] }, { c1: 0xD8F4FF, rampX: 1 })),
        ...[1, -1].map((sx) => plate('seg2', 0x57B8FF, leafShape(0.2, 0.08), 0.02,
          { o: add3(spineAt(q, 2).p, [sx * 0.15, 0, 0.02]), x: [sx, -0.4, 0.2], y: [0, 0.3, 1], z: [0, 1, 0] }, { c1: 0xD8F4FF, rampX: 1 })),
      ],
    });
  })(),

  // The tide stood up and grew wings: a sea dragon with a spiral horn, fins
  // for wings and a crest of foam.
  maelstride: (() => {
    const q = serpent({
      size: 3.0, a: 0x1F6FC0, belly: 0xB8F4EA, segs: 9, head: 0.28, iris: 0x7FE8FF, eye: 0.26, r: 0.22,
      path: [[0, 1.25, 0.45], [0, 1.04, 0.3], [0.04, 0.76, 0.15], [0.06, 0.52, -0.1], [0.04, 0.42, -0.45], [-0.04, 0.5, -0.8], [-0.07, 0.72, -1.0], [-0.05, 0.96, -1.06]],
      radii: [0.21, 0.23, 0.22, 0.2, 0.17, 0.13, 0.09, 0.05],
    });
    const w = spineAt(q, 2);
    return make(q, {
      hover: 0.1, eyeStyle: 1,
      bones: { wingL: [0.18, w.p[1], w.p[2], 'seg2'], wingR: [-0.18, w.p[1], w.p[2], 'seg2'] },
      details: [
        horn('head', 0xF2FFFF, [q.at.hp[0], q.at.hp[1] + q.at.hr * 0.75, q.at.hp[2] + 0.02], [q.at.hp[0], q.at.hp[1] + q.at.hr * 2.1, q.at.hp[2] - 0.16], 0.07, { c1: 0x7FE3FF, bend: [0, 0.06, 0.1] }),
        ...[1, -1].map((sx) => tube('head', 0xB8F4EA, [q.at.hp[0] + sx * 0.12, q.at.hp[1] - 0.1, q.at.hp[2] + 0.22], [q.at.hp[0] + sx * 0.5, q.at.hp[1] - 0.34, q.at.hp[2] - 0.04], 0.022, { taper: 0.2, bend: [sx * 0.06, -0.12, 0.12] })),
        ...[1, -1].map((sx) => plate(sx > 0 ? 'wingL' : 'wingR', 0x3F8FE0, batWing(0.78, 0.46), 0.03,
          { o: [sx * 0.18, w.p[1] + 0.05, w.p[2] - 0.04], x: [sx, 0.35, -0.35], y: [0, 0.45, 1], z: [0, 1, -0.3] }, { c1: 0xB8F4EA, rampX: 1 })),
        ...[3, 4, 5, 6, 7].map((i) => { const f = spineAt(q, i); return crystal('seg' + i, 0xF2FFFF, add3(f.p, f.back.map((v) => v * 0.14)), add3(f.back, f.t.map((v) => -v * 0.6)), 0.24 - i * 0.02, 0.055, { c1: 0x9FE8FF }); }),
        plate('seg9', 0x3F8FE0, finShape(0.44, 0.36), 0.03, { o: q.at.tail, x: [0, 0.6, -0.8], y: [0, 0.8, 0.6], z: [1, 0, 0] }, { c1: 0xB8F4EA }),
      ],
    });
  })(),

  // --------------------------------------------------------------- verdant
  // A seed that sprouted a face: two leaves on its crown and leaf-hands.
  sproutle: (() => {
    const q = biped({ size: 1.0, a: 0x76D384, bodyC: 0x8FDE8C, b: 0x2F7A45, head: 0.32, body: 0.22, leg: 0.1, belly: 0xE4F7CF, iris: 0x1C3A1E, arm: 0.18, armR: 0.055 });
    const c = q.at.crown;
    return make(q, {
      bones: { crest: [0, c[1] - 0.02, c[2], 'head'] },
      details: [
        tube('crest', 0x3F9A4E, [0, c[1] - 0.04, c[2]], [0, c[1] + 0.12, c[2] - 0.02], 0.025, { taper: 0.7 }),
        ...[1, -1].map((sx) => plate('crest', 0x5BC76A, leafShape(0.3, 0.1), 0.02,
          { o: [0, c[1] + 0.11, c[2] - 0.02], x: [sx, 0.55, 0.1], y: [0, 0.2, 1], z: [0, 1, -0.2] }, { c1: 0xA8EE8A, curl: 0.05, rampX: 1 })),
        ball('crest', 0xFF9CC8, [0, c[1] + 0.13, c[2] - 0.02], 0.028),
        ...[1, -1].map((sx) => plate(sx > 0 ? 'armL' : 'armR', 0x5BC76A, leafShape(0.14, 0.05), 0.015,
          { o: [sx * q.at.hand[0], q.at.hand[1], q.at.hand[2]], x: [sx * 0.6, -0.6, 0.3], y: [0, 0.3, 1], z: [1, 0, 0] }, { c1: 0xA8EE8A, rampX: 1 })),
      ],
    });
  })(),

  // Taller, prickly and proud of it: a hood of leaves, thorns on its
  // shoulders, and a flower that only it has.
  thornkin: (() => {
    const q = biped({ size: 1.8, a: 0x49B862, bodyC: 0x3FA356, b: 0x1F5C34, head: 0.3, body: 0.26, leg: 0.18, belly: 0xCDEFB0, iris: 0xE0C33A, eye: 0.24, arm: 0.3, armR: 0.06, eyeTall: 1.05 });
    const c = q.at.crown;
    const leaves = Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI * (0.15 + 0.7 * i / 6);
      return plate('head', i % 2 ? 0x2F8A45 : 0x3FA356, leafShape(0.34, 0.11), 0.02,
        { o: [Math.cos(a) * 0.24, c[1] - 0.14 + Math.sin(a) * 0.06, -0.05 - Math.sin(a) * 0.1], x: [Math.cos(a), 0.6 + Math.sin(a) * 0.4, -0.5], y: [0, 0.3, 1], z: [Math.sin(a), 0, Math.cos(a)] }, { c1: 0x8FDE7A, curl: -0.04, rampX: 1 });
    });
    return make(q, {
      details: [
        ...leaves,
        ...[1, -1].flatMap((sx) => [0, 1].map((j) => horn('chest', 0xE8E0B0, [sx * (0.2 + j * 0.06), q.at.by + 0.2 - j * 0.07, -0.02], [sx * (0.34 + j * 0.06), q.at.by + 0.32 - j * 0.05, -0.08], 0.04, { c1: 0xFFFFFF }))),
        ...[0, 1, 2, 3, 4].map((i) => plate('head', 0xFF7FA8, leafShape(0.08, 0.035), 0.012,
          { o: [0.14, c[1] - 0.02, 0.1], x: [Math.cos(i * 1.256), 0.3, Math.sin(i * 1.256)], y: [0, 1, 0], z: [-Math.sin(i * 1.256), 0, Math.cos(i * 1.256)] }, { c1: 0xFFC0D6, rampX: 1 })),
        ball('head', 0xFFE070, [0.14, c[1] - 0.01, 0.1], 0.025),
      ],
    });
  })(),

  // The forest's moth: wings like great leaves with lanterns in them, a
  // collar of cream fur and feathery antennae.
  verdammoth: (() => {
    const by = 0.62;
    const fore = (sx) => ({ o: [sx * 0.2, by + 0.12, 0.05], x: [sx * 0.9, 0.42, -0.2], y: [0, 0.2, 1], z: [0, 1, -0.2] });
    const hind = (sx) => ({ o: [sx * 0.18, by - 0.08, -0.12], x: [sx * 0.85, -0.2, -0.5], y: [0, 0.3, 1], z: [0, 1, 0.1] });
    const wingSet = (sx) => {
      const w = sx > 0 ? 'wingL' : 'wingR', F = fore(sx), H = hind(sx);
      return [
        plate(w, 0x3FA457, bugWing(1.05, 0.62), 0.035, F, { c1: 0xA8E27A, rampX: 1 }),
        plate(w, 0x2F8A45, bugWing(0.7, 0.44), 0.03, H, { c1: 0x8FD06A, rampX: 1 }),
        ball(w, 0xFFF3A8, onPlate(F, 0.62, 0.05, 0.03), 0.11, { sy: 0.25, glow: 0.8 }),
        ball(w, 0x2F6A3A, onPlate(F, 0.62, 0.05, 0.035), 0.05, { sy: 0.25 }),
        ball(w, 0xFFF3A8, onPlate(H, 0.42, 0.0, 0.03), 0.07, { sy: 0.25, glow: 0.8 }),
      ];
    };
    return {
      size: 3.9, plan: 'biped', flies: true, hover: 0.08, lid: 0x3FA457,
      bones: {
        root: [0, 0, 0], body: [0, by, 0, 'root'], head: [0, by + 0.28, 0.22, 'body'],
        wingL: [0.18, by + 0.08, 0.0, 'body'], wingR: [-0.18, by + 0.08, 0.0, 'body'],
        antL: [0.08, by + 0.62, 0.3, 'head'], antR: [-0.08, by + 0.62, 0.3, 'head'],
        legL: [0.1, by - 0.2, 0.05, 'body'], legR: [-0.1, by - 0.2, 0.05, 'body'],
      },
      parts: [
        E('body', 0x3FA457, [0, by, 0.02], [0.22, 0.24, 0.24], 0.06),
        E('body', 0x3FA457, [0, by - 0.16, -0.32], [0.17, 0.16, 0.3], 0.1),
        ...[0, 1, 2].map((i) => paint(0x2F7A40, E('body', 0, [0, by - 0.16, -0.22 - i * 0.12], [0.2, 0.19, 0.022]), 0.015)),
        E('body', 0xFFF3A8, [0, by + 0.16, 0.06], [0.27, 0.13, 0.22], 0.08),
        S('head', 0x3FA457, [0, by + 0.38, 0.24], 0.22, 0.08),
        mir(paint(0xFF9CB0, E('head', 0, [0.14, by + 0.32, 0.4], [0.035, 0.025, 0.03]), 0.015)),
      ],
      details: [
        ...wingSet(1), ...wingSet(-1),
        ...[1, -1].map((sx) => plate(sx > 0 ? 'antL' : 'antR', 0xFFF3A8, leafShape(0.36, 0.09), 0.015,
          { o: [sx * 0.07, by + 0.56, 0.3], x: [sx * 0.45, 1, 0.25], y: [0, -0.25, 1], z: [1, 0, 0] }, { c1: 0xFFE070, curl: sx * 0.03, rampX: 1 })),
        ...[1, -1].flatMap((sx) => [0.1, -0.05, -0.18].map((z) => tube(sx > 0 ? 'legL' : 'legR', 0x2F6A3A, [sx * 0.1, by - 0.15, z], [sx * 0.2, by - 0.42, z + 0.04], 0.022, { taper: 0.6 }))),
      ],
      eyes: { at: [0.1, by + 0.42, 0.44], r: 0.08, iris: 0x1C1C2A, tall: 1.2 },
    };
  })(),

  // ------------------------------------------------------------ commons
  // A snail with a garden on its back: moss, a toadstool, a flower.
  mossnail: {
    size: 0.7, plan: 'biped', lid: 0x9ADFA0,
    bones: { root: [0, 0, 0], body: [0, 0.14, 0, 'root'], head: [0, 0.2, 0.28, 'body'], antL: [0.06, 0.4, 0.34, 'head'], antR: [-0.06, 0.4, 0.34, 'head'], crest: [0, 0.5, -0.05, 'body'] },
    parts: [
      E('body', 0x9ADFA0, [0, 0.12, 0.02], [0.17, 0.12, 0.42], 0.05),
      S('head', 0x9ADFA0, [0, 0.26, 0.3], 0.16, 0.08),
      ...Array.from({ length: 9 }, (_, i) => {
        const t = i / 8, a = t * Math.PI * 2.2, r = 0.22 * Math.pow(0.8, i);
        return S('crest', i % 2 ? 0xC98A52 : 0xB57744, [0, 0.36 + Math.sin(a) * 0.14 * (1 - t * 0.7), -0.06 - Math.cos(a) * 0.14 * (1 - t * 0.7)], r, 0.06, { rigid: true });
      }),
      paint(0x5FB85A, E('crest', 0, [0, 0.58, -0.04], [0.24, 0.1, 0.24]), 0.05),
      paint(0xE4F7D8, E('body', 0, [0, 0.03, 0.05], [0.16, 0.05, 0.4]), 0.03),
    ],
    details: [
      ...[1, -1].map((sx) => tube(sx > 0 ? 'antL' : 'antR', 0x9ADFA0, [sx * 0.06, 0.36, 0.32], [sx * 0.1, 0.5, 0.36], 0.018, { taper: 0.7 })),
      ...[1, -1].map((sx) => ball(sx > 0 ? 'antL' : 'antR', 0xC8F5CC, [sx * 0.1, 0.51, 0.36], 0.03)),
      tube('crest', 0xF6EEDC, [0.06, 0.56, -0.02], [0.07, 0.64, -0.02], 0.022),
      ball('crest', 0xE8453C, [0.07, 0.655, -0.02], 0.055, { sy: 0.55 }),
      ...[[0.05, 0.02], [-0.02, 0.05]].map(([dx, dz]) => ball('crest', 0xFFFFFF, [0.07 + dx, 0.675, -0.02 + dz], 0.012)),
      ...[0, 1, 2, 3, 4].map((i) => plate('crest', 0xFFE070, leafShape(0.05, 0.02), 0.01,
        { o: [-0.08, 0.6, 0.02], x: [Math.cos(i * 1.256), 0.2, Math.sin(i * 1.256)], y: [0, 1, 0], z: [-Math.sin(i * 1.256), 0, Math.cos(i * 1.256)] }, { c1: 0xFFF6C0, rampX: 1 })),
    ],
    eyes: { at: [0.07, 0.3, 0.44], r: 0.05, iris: 0x1C3A2A, tall: 1.2 },
  },

  // ------------------------------------------------------------------ volt
  // A ferret-kit made of static: a big curled brush of a tail with a spark
  // caught in its tip, and blue sparks where its whiskers should be.
  sparkit: (() => {
    const q = quad({ size: 1.2, a: 0xFFE27A, b: 0xFFF8E0, paw: 0xFFF8E0, len: 0.6, wide: 0.2, deep: 0.19, y: 0.32, head: 0.3, legR: 0.066,
      ear: { len: 0.6, r: 0.4, spread: 0.3, tilt: 0.18, inner: 0x3FA8FF, tipC: 0x3FA8FF }, tail: { len: 0.26, rise: 0.46, r: 0.1, segs: 3, taper: 0.05, hook: 0.16 },
      iris: 0x1E3A6A, blush: false });
    const tt = q.at.tailTip;
    return make(q, {
      parts: [
        paint(0xFFF8E0, S(q.at.tailBone, 0, tt, 0.16), 0.05),
        mir(paint(0x5FC8FF, E('head', 0, [q.at.hr * 0.68, q.at.hy - q.at.hr * 0.3, q.at.hz + q.at.hr * 0.55], [0.045, 0.035, 0.035]), 0.012, { glow: 0.8 })),
        paint(0x3FA8FF, E('body', 0, [0, q.at.y + q.at.Hb * 0.92, -0.04], [0.06, 0.05, 0.24]), 0.02, { glow: 0.35 }),
      ],
      details: [
        ball(q.at.tailBone, 0x6FD0FF, add3(tt, [0, 0.06, -0.04]), 0.075, { glow: 0.9 }),
        ...[0, 1, 2].map((i) => crystal('head', 0x3FA8FF, add3(q.at.crown, [0, -0.03, 0.02 - i * 0.07]), [0, 1, -0.5 - i * 0.3], 0.12 - i * 0.02, 0.03, { c1: 0x9FE0FF, glow: 0.5 })),
      ],
    });
  })(),

  // The kit grown into a strider: a mane of blue lightning shards, navy
  // stripes, and the spark in its tail grown into a storm-ball.
  voltmane: (() => {
    const q = quad({ size: 2.4, a: 0xFFD65C, b: 0xFFF3CC, paw: 0x2E3F7A, len: 0.86, wide: 0.25, deep: 0.24, y: 0.5, head: 0.29, legR: 0.085, neck: true,
      ear: { len: 0.62, r: 0.36, spread: 0.36, tilt: 0.18, inner: 0x3FA8FF, tipC: 0x2E3F7A }, tail: { len: 0.36, rise: 0.44, r: 0.1, segs: 3, taper: 0.1, hook: 0.1 },
      iris: 0x1E3A6A, eye: 0.24, blush: false });
    const tt = q.at.tailTip;
    const mane = Array.from({ length: 11 }, (_, i) => {
      const th = Math.PI * (-0.1 + 1.2 * i / 10);
      const c = [0, q.at.y + q.at.Hb * 1.3, q.at.zF + 0.08];
      const rad = [Math.cos(th), Math.sin(th) * 0.8, -Math.sin(th) * 0.5];
      return crystal('chest', i % 2 ? 0x3FA8FF : 0x2F7FE8, add3(c, rad.map((v) => v * 0.14)), add3(rad, [0, 0.4, -0.4]), 0.28 + (i % 3) * 0.05, 0.05, { c1: 0x9FE0FF, glow: 0.45 });
    });
    return make(q, {
      parts: [
        ...[-0.22, 0.02, 0.24].map((z) => paint(0x2E3F7A, E('body', 0, [0, q.at.y + q.at.Hb * 0.92, z], [0.25, 0.035, 0.035], 0, { rot: [0, 0.35, 0] }), 0.015)),
        paint(0xFFF3CC, S(q.at.tailBone, 0, tt, 0.18), 0.05),
        mir(paint(0x5FC8FF, E('head', 0, [q.at.hr * 0.68, q.at.hy - q.at.hr * 0.3, q.at.hz + q.at.hr * 0.55], [0.045, 0.035, 0.035]), 0.012, { glow: 0.8 })),
      ],
      details: [
        ...mane,
        ball(q.at.tailBone, 0x6FD0FF, add3(tt, [0, 0.08, -0.05]), 0.11, { glow: 0.9 }),
        ...[0, 1, 2, 3].map((i) => crystal(q.at.tailBone, 0x3FA8FF, add3(tt, [0, 0.08, -0.05]), [Math.cos(i * 1.57), 0.6, Math.sin(i * 1.57)], 0.18, 0.03, { c1: 0x9FE0FF, glow: 0.5 })),
      ],
    });
  })(),

  // ----------------------------------------------------------------- terra
  // A pebble that walks: stubby legs, stubby arms and amber crystals growing
  // out of its back.
  pebblin: (() => {
    const q = blob({ size: 1.2, a: 0xB08A5E, b: 0xD9C2A0, r: 0.42, iris: 0x2A1A10, eye: 0.2, belly: 0xD9C2A0, footC: 0x8A6A48, wide: 1.05, tall: 0.9 });
    return make(q, {
      bones: { armL: [0.4, 0.4, 0.05, 'body'], armR: [-0.4, 0.4, 0.05, 'body'] },
      parts: [
        mir(C('armL', 0xB08A5E, [0.38, 0.4, 0.06], [0.52, 0.22, 0.12], 0.08, 0.09, 0.05)),
        ...[[0.2, 0.62, -0.1], [-0.25, 0.5, 0.2], [0.05, 0.3, -0.35]].map(([x, y, z]) => paint(0x8A6A48, S('body', 0, [x, y, z], 0.1), 0.04)),
      ],
      details: [
        crystal('body', 0xFFB84A, [0.05, 0.72, -0.12], [0.2, 1, -0.4], 0.26, 0.07, { c1: 0xFFE9A0, glow: 0.35 }),
        crystal('body', 0xFFA03A, [-0.14, 0.66, -0.2], [-0.5, 1, -0.5], 0.2, 0.06, { c1: 0xFFE9A0, glow: 0.35 }),
        crystal('body', 0xFFC860, [0.2, 0.6, -0.26], [0.6, 0.8, -0.6], 0.16, 0.05, { c1: 0xFFE9A0, glow: 0.35 }),
      ],
    });
  })(),

  // The pebble grew into a boulder and bound itself in iron: fists like
  // millstones, iron horns.
  boulderon: (() => {
    const q = biped({ size: 2.5, a: 0x9A7A55, bodyC: 0x8B6B45, b: 0x6E5238, head: 0.26, body: 0.42, leg: 0.16, arm: 0.62, armR: 0.13, hand: 1.45,
      belly: 0xC9B08A, iris: 0xFFB84A, eye: 0.24, eyeTall: 1.0, blush: false, hy: 1.08, wide: 1.1 });
    return make(q, {
      lookK: 0.5,
      parts: [
        mir(Tr('armL', 0xB9C4D0, [0.48, q.at.by + 0.06, 0.04], 0.13, 0.035, 0.02, { rot: [0.1, 0, -0.6] })),
        Tr('body', 0xB9C4D0, [0, q.at.by - 0.12, 0], 0.4, 0.04, 0.03),
        mir(E('chest', 0x7A5E40, [0.34, q.at.by + 0.36, -0.02], [0.2, 0.16, 0.2], 0.05)),
      ],
      details: [
        mir(horn('head', 0xB9C4D0, [0.14, q.at.hy + 0.14, 0.02], [0.3, q.at.hy + 0.36, -0.08], 0.06, { c1: 0xE8F0F8, bend: [0.06, 0.04, 0] })),
        ...[[0.36, 0.1], [0.3, -0.1]].flatMap(([x, z]) => [1, -1].map((sx) => crystal(sx > 0 ? 'armL' : 'armR', 0xC9A070, [sx * x, q.at.by + 0.48, z], [sx * 0.4, 1, -0.2], 0.2, 0.06, { c1: 0xEADBC0 }))),
      ],
    });
  })(),

  // ------------------------------------------------------------------ gale
  // A puff of a bird, round as a dandelion clock, with a curl of wind for a
  // crest.
  zephyrb: (() => {
    const q = bird({ size: 1.5, a: 0xD4F5EE, b: 0x7FC8BD, body: 0.32, head: 0.27, belly: 0xFFFFFF, iris: 0x1E2A36, wingC: 0x9FDCD0, wingC1: 0x5FB8AA, tailC: 0x9FDCD0 });
    const c = q.at.crown;
    return make(q, {
      parts: [E('head', 0xD4F5EE, [0, q.at.by + q.at.br * 0.55, 0.02], [q.at.br * 0.9, q.at.br * 0.6, q.at.br * 0.85], 0.1)],
      details: [
        tube('head', 0x7FC8BD, [0, c[1] - 0.03, c[2] + 0.02], [0, c[1] + 0.18, c[2] - 0.12], 0.035, { taper: 0.75, bend: [0, 0.12, 0.12] }),
        tube('head', 0x7FC8BD, [0, c[1] - 0.03, c[2] - 0.02], [0.08, c[1] + 0.12, c[2] - 0.16], 0.025, { taper: 0.75, bend: [0.03, 0.08, 0.1] }),
      ],
    });
  })(),

  // Grown into the high cloud: wide wings, a train of long plumes and a
  // crown of gold.
  cirrowing: (() => {
    const q = bird({ size: 3.2, a: 0xF2FCFA, b: 0xFFE89A, body: 0.3, head: 0.22, belly: 0xFFFFFF, iris: 0x3A7AA8, eye: 0.3, wing: 0.95, wingH: 0.5, wingC: 0xF2FCFA, wingC1: 0xC9EFF6,
      tailN: 3, tailL: 0.75, tailC: 0xF2FCFA, tailC1: 0xFFE89A, beakC: 0xFFD66B, legC: 0xFFD66B, flies: true });
    const c = q.at.crown;
    return make(q, {
      hover: 0.12,
      parts: [
        ...[[0.26, 0.1, 0.12], [-0.26, 0.1, 0.12], [0.2, -0.05, -0.22], [-0.2, -0.05, -0.22]].map(([x, y, z]) => S('body', 0xFFFFFF, [x, q.at.by + y, z], 0.13, 0.08)),
      ],
      details: [
        ...[-0.4, 0, 0.4].map((dx) => plate('head', 0xFFE89A, leafShape(0.26, 0.05), 0.014,
          { o: [dx * 0.1, c[1] - 0.04, c[2] - 0.02], x: [dx, 1, -0.5], y: [0, 0.5, 1], z: [1, 0, 0] }, { c1: 0xFFF8D8, curl: 0.03, rampX: 1 })),
      ],
    });
  })(),

  // ----------------------------------------------------------------- frost
  // A snowball with a scarf and a crown of ice.
  frostnib: (() => {
    const q = blob({ size: 1.0, a: 0xBFE6FF, b: 0xFFFFFF, r: 0.4, iris: 0x12305F, belly: 0xFFFFFF, footC: 0x6FB6E8, fins: true, finC: 0x9FD2F5, eyeY: 0.2 });
    return make(q, {
      parts: [
        Tr('body', 0x5AA8E8, [0, 0.26, 0.0], 0.36, 0.055, 0.03, { rot: [0.12, 0, 0] }),
        C('body', 0x5AA8E8, [0.16, 0.24, 0.3], [0.2, 0.08, 0.37], 0.055, 0.05, 0.03),
      ],
      details: [
        horn('head', 0xFFB23A, [0, 0.43, 0.38], [0, 0.4, 0.48], 0.035, { c1: 0xE0801A }),
        crystal('head', 0xDFF6FF, [0, 0.74, -0.02], [0, 1, -0.1], 0.2, 0.06, { c1: 0x8FDBFF, glow: 0.35 }),
        crystal('head', 0xDFF6FF, [0.1, 0.72, -0.02], [0.6, 1, -0.1], 0.14, 0.045, { c1: 0x8FDBFF, glow: 0.35 }),
        crystal('head', 0xDFF6FF, [-0.1, 0.72, -0.02], [-0.6, 1, -0.1], 0.14, 0.045, { c1: 0x8FDBFF, glow: 0.35 }),
      ],
    });
  })(),

  // An ice lizard in iron: a ridge of crystal down its back and two horns.
  glacilisk: (() => {
    const q = quad({ size: 2.7, a: 0x9FD9F5, b: 0xEAF7FF, paw: 0xC7D3DE, len: 1.05, wide: 0.23, deep: 0.19, y: 0.3, head: 0.27, legR: 0.07, stance: 0.24,
      muzzle: { w: 0.5, h: 0.3, l: 0.5, out: 0.72 }, tail: { len: 0.7, rise: 0.05, r: 0.12, segs: 3, taper: 0.28, hook: 0.1 }, iris: 0x2A5A9A, eye: 0.24, blush: false, nose: false });
    return make(q, {
      details: [
        ...spineSpikes((t) => (t < 0.6 ? 'body' : 'tail'), 0xDFF6FF, [0, q.at.y + q.at.Hb * 0.8, q.at.zF], [0, q.at.y + 0.02, -0.72], 7, 0.2, 0.06, { crystal: true, c1: 0x8FDBFF, glow: 0.25, dir: [0, 1, -0.3] }),
        mir(horn('head', 0xC7D3DE, [0.12, q.at.hy + q.at.hr * 0.6, q.at.hz - 0.06], [0.2, q.at.hy + q.at.hr * 1.3, q.at.hz - 0.38], 0.05, { c1: 0xF2F8FF, bend: [0.02, 0.06, 0.02] })),
      ],
    });
  })(),

  // ----------------------------------------------------------------- umbra
  // A bat with a mouse's ears and two little fangs, eyes that light up.
  umbrat: (() => {
    const q = blob({ size: 1.2, a: 0x6D4BB5, b: 0xC7B3F0, r: 0.34, y: 0.5, iris: 0xFF8A5C, belly: 0xC7B3F0, footC: 0x4A3585, eye: 0.24, eyeY: 0.14 });
    return make(q, {
      flies: true, hover: 0.18, eyeStyle: 2, eyeGlow: 0.2,
      bones: { earL: [0.14, 0.72, 0.0, 'head'], earR: [-0.14, 0.72, 0.0, 'head'], wingL: [0.3, 0.55, -0.02, 'body'], wingR: [-0.3, 0.55, -0.02, 'body'], tail: [0, 0.4, -0.3, 'body'], tail2: [0, 0.34, -0.52, 'tail'] },
      parts: [
        mir(C('earL', 0x6D4BB5, [0.14, 0.72, 0.0], [0.3, 1.0, -0.04], 0.13, 0.06, 0.04)),
        mir(paint(0xFF9CC8, E('earL', 0, [0.22, 0.86, 0.06], [0.06, 0.1, 0.04]), 0.02)),
        C('tail', 0x4A3585, [0, 0.42, -0.28], [0, 0.34, -0.52], 0.035, 0.02, 0.03),
      ],
      details: [
        ...[1, -1].map((sx) => plate(sx > 0 ? 'wingL' : 'wingR', 0x3A2A63, batWing(0.5, 0.36), 0.025,
          { o: [sx * 0.3, 0.56, -0.04], x: [sx, 0.35, -0.3], y: [0, 0.3, 1], z: [0, 1, -0.3] }, { c1: 0x8A6AD0, rampX: 1 })),
        ...[1, -1].map((sx) => horn('head', 0xFFFFFF, [sx * 0.05, 0.42, 0.32], [sx * 0.055, 0.36, 0.33], 0.022)),
        horn('tail2', 0x4A3585, [0, 0.34, -0.52], [0, 0.4, -0.64], 0.05, { sides: 4 }),
      ],
    });
  })(),

  // The night itself on wings: an owl with horned tufts, a crescent moon on
  // its breast and eyes like lamps.
  nocturnix: (() => {
    const q = bird({ size: 2.8, a: 0x4C3F86, b: 0x2A2350, body: 0.34, head: 0.31, belly: 0x8E7FD0, face: 0xB8AEE8, iris: 0xFFB82E, eye: 0.3, beak: 0.2, hook: 0.2, beakC: 0x2A2350, beakC1: 0x1A1A2B,
      wingC: 0x2A2350, wingC1: 0x6F5FC0, wing: 0.66, wingH: 0.42, tailN: 3, tailC: 0x2A2350, tailC1: 0x6F5FC0, legC: 0xC9B070, blush: false });
    const c = q.at.crown;
    return make(q, {
      eyeStyle: 1,
      details: [
        ...[1, -1].map((sx) => plate('head', 0x4C3F86, leafShape(0.3, 0.07), 0.02,
          { o: [sx * 0.18, c[1] - 0.08, c[2] - 0.02], x: [sx * 0.55, 1, -0.2], y: [0, 0.2, 1], z: [1, 0, 0] }, { c1: 0x8E7FD0, curl: sx * 0.03, rampX: 1 })),
        plate('body', 0xFFE070, crescent(0.12), 0.02, { o: [0, q.at.by + 0.02, q.at.br * 0.92], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, { c1: 0xFFF6C0 }),
      ],
    });
  })(),

  // ----------------------------------------------------------------- lumen
  // A spark of daylight that learned to float: a star on its brow, wings
  // like dandelion seeds, a halo it has not quite grown into.
  glimmer: (() => {
    const q = blob({ size: 0.9, a: 0xFFF3A8, b: 0xFFFFFF, r: 0.34, y: 0.5, iris: 0x7A4A10, belly: 0xFFFFFF, footC: 0xFFD35C, eye: 0.24, feet: false });
    return make(q, {
      floats: true, hover: 0.22, lively: 1.4,
      bones: { wingL: [0.26, 0.62, -0.1, 'body'], wingR: [-0.26, 0.62, -0.1, 'body'], orb: [0, 1.04, 0, 'body'] },
      parts: [
        paint(0xFFF8D0, E('body', 0, [0, 0.5, 0], [0.36, 0.34, 0.34]), 0.1, { glow: 0.35, alpha: 1 }),
      ],
      details: [
        ...[0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return crystal('head', 0xFFD35C, [Math.sin(a) * 0.04, 0.84 + Math.cos(a) * 0.04, 0.1], [Math.sin(a), Math.cos(a), 0.15], 0.11, 0.035, { c1: 0xFFFFFF, glow: 0.7 }); }),
        ...[1, -1].map((sx) => plate(sx > 0 ? 'wingL' : 'wingR', 0xFFFFFF, bugWing(0.3, 0.16), 0.012,
          { o: [sx * 0.24, 0.64, -0.12], x: [sx, 0.5, -0.4], y: [0, 0.4, 1], z: [0, 1, -0.4] }, { c1: 0xFFF3A8, rampX: 1 })),
        ring('orb', 0xFFE070, [0, 1.04, 0], 0.16, 0.022, [0.25, 0, 0], { glow: 0.9 }),
      ],
    });
  })(),

  // The spark become a sun: a crown of rays, a gown that trails into light,
  // wings of gold.
  solaraith: (() => {
    const hy = 1.12;
    return {
      size: 1.6, plan: 'biped', floats: true, hover: 0.16, lid: 0xFFE89A,
      bones: {
        root: [0, 0, 0], body: [0, 0.55, 0, 'root'], chest: [0, 0.8, 0, 'body'], head: [0, hy - 0.2, 0.02, 'chest'],
        armL: [0.2, 0.86, 0, 'chest'], armR: [-0.2, 0.86, 0, 'chest'], wingL: [0.14, 0.86, -0.16, 'chest'], wingR: [-0.14, 0.86, -0.16, 'chest'], crest: [0, hy, -0.12, 'head'],
      },
      parts: [
        C('body', 0xFFE89A, [0, 0.82, 0], [0, 0.22, 0], 0.17, 0.3, 0.08),
        Tr('body', 0xFFB24A, [0, 0.2, 0], 0.26, 0.05, 0.05),
        S('head', 0xFFF1C0, [0, hy, 0.02], 0.25, 0.08),
        mir(C('armL', 0xFFE89A, [0.18, 0.86, 0], [0.34, 0.66, 0.1], 0.055, 0.05, 0.05)),
        mir(S('armL', 0xFFF1C0, [0.36, 0.63, 0.12], 0.06, 0.03)),
        paint(0xFF9F3C, C('body', 0, [0, 0.5, 0], [0, 0.14, 0], 0.22, 0.34, 0), 0.05, { glow: 0.5 }),
        mir(paint(0xFF9CB0, E('head', 0, [0.15, hy - 0.06, 0.2], [0.035, 0.025, 0.03]), 0.012)),
      ],
      details: [
        ...Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (0.05 + 0.9 * i / 10); return crystal('crest', i % 2 ? 0xFFB24A : 0xFFE070, [Math.cos(a) * 0.2, hy + Math.sin(a) * 0.2, -0.14], [Math.cos(a), Math.sin(a), -0.1], 0.2 + (i % 2) * 0.06, 0.035, { c1: 0xFFF6D0, glow: 0.8 }); }),
        ...[1, -1].map((sx) => plate(sx > 0 ? 'wingL' : 'wingR', 0xFFD66B, featherWing(0.5, 0.3), 0.025,
          { o: [sx * 0.12, 0.88, -0.16], x: [sx, 0.55, -0.35], y: [0, 0.4, 1], z: [0, 1, -0.4] }, { c1: 0xFFF6D0, rampX: 1 })),
      ],
      eyes: { at: [0.1, hy + 0.03, 0.24], r: 0.07, iris: 0xFF7A1F, tall: 1.2 },
    };
  })(),

  // ----------------------------------------------------------------- metal
  // A little robot that runs on its own gear: a visor for a face, an aerial
  // with a light on the end.
  coglet: (() => {
    const hy = 0.72;
    return {
      size: 1.1, plan: 'biped', lid: 0x2A3440, eyeStyle: 2, rough: 0.3, metal: 0.25,
      bones: {
        root: [0, 0, 0], body: [0, 0.3, 0, 'root'], chest: [0, 0.4, 0, 'body'], head: [0, 0.52, 0, 'chest'],
        legL: [0.1, 0.16, 0, 'body'], legR: [-0.1, 0.16, 0, 'body'], armL: [0.2, 0.4, 0, 'chest'], armR: [-0.2, 0.4, 0, 'chest'],
        antL: [0.0, hy + 0.2, 0, 'head'], crest: [0, 0.34, -0.2, 'body'],
      },
      parts: [
        Bx('body', 0xC5CED8, [0, 0.33, 0], [0.18, 0.17, 0.15], 0.07, 0.03),
        Bx('head', 0xC5CED8, [0, hy, 0.02], [0.24, 0.2, 0.2], 0.1, 0.06),
        Bx('head', 0x2A3440, [0, hy - 0.01, 0.17], [0.19, 0.11, 0.06], 0.05, 0.01),
        mir(C('legL', 0x6F7B8A, [0.1, 0.18, 0], [0.1, 0.06, 0.02], 0.045, 0.045, 0.03)),
        mir(Bx('legL', 0x6F7B8A, [0.1, 0.035, 0.05], [0.06, 0.035, 0.09], 0.03, 0.02)),
        mir(C('armL', 0x6F7B8A, [0.2, 0.42, 0], [0.28, 0.26, 0.06], 0.035, 0.035, 0.03)),
        mir(S('armL', 0xC5CED8, [0.29, 0.23, 0.07], 0.055, 0.02)),
        paint(0x57D8FF, S('body', 0, [0, 0.36, 0.16], 0.045), 0.012, { glow: 1 }),
        mir(Tr('head', 0x6F7B8A, [0.25, hy, 0.02], 0.06, 0.02, 0.01, { rot: [0, 0, 1.5708] })),
      ],
      details: [
        tube('antL', 0x6F7B8A, [0, hy + 0.18, 0], [0.03, hy + 0.36, -0.03], 0.015, { taper: 0.8 }),
        ball('antL', 0xFF6A5C, [0.03, hy + 0.38, -0.03], 0.035, { glow: 0.9 }),
        plate('crest', 0x9AA6B8, gearShape(0.16, 8), 0.04, { o: [0, 0.38, -0.2], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, { c1: 0xD8E0E8, bevel: 0.01 }),
        ball('crest', 0x6F7B8A, [0, 0.38, -0.22], 0.04),
      ],
      eyes: { at: [0.1, hy + 0.01, 0.26], r: 0.05, iris: 0x57D8FF, tall: 0.8, depth: 0.3, sink: 0.1 },
    };
  })(),

  // An empty suit of armour that something moved into: a visor full of
  // violet light, gears for shoulders and a wisp where its legs should be.
  ferrogeist: (() => {
    const hy = 1.2;
    return {
      size: 2.5, plan: 'biped', floats: true, hover: 0.12, lid: 0x3A2F56, eyeStyle: 2, eyeGlow: 0.3, rough: 0.32, metal: 0.3,
      bones: {
        root: [0, 0, 0], body: [0, 0.62, 0, 'root'], chest: [0, 0.82, 0, 'body'], head: [0, hy - 0.16, 0, 'chest'],
        armL: [0.34, 0.92, 0, 'chest'], armR: [-0.34, 0.92, 0, 'chest'], tail: [0, 0.5, 0, 'body'], tail2: [0, 0.3, -0.06, 'tail'], tail3: [0, 0.12, -0.16, 'tail2'],
      },
      parts: [
        Bx('chest', 0x8D9AA8, [0, 0.84, 0], [0.26, 0.22, 0.18], 0.1, 0.05),
        E('body', 0x8D9AA8, [0, 0.6, 0], [0.2, 0.12, 0.15], 0.06),
        S('head', 0x8D9AA8, [0, hy, 0.02], 0.2, 0.06),
        Bx('head', 0x1E1830, [0, hy - 0.01, 0.16], [0.13, 0.045, 0.05], 0.03, 0.01),
        mir(S('armL', 0x6F7B8A, [0.34, 0.98, 0], 0.13, 0.04)),
        mir(C('armL', 0x8D9AA8, [0.36, 0.9, 0.02], [0.44, 0.62, 0.1], 0.07, 0.065, 0.04)),
        mir(Bx('armL', 0x6F7B8A, [0.45, 0.56, 0.11], [0.07, 0.07, 0.07], 0.03, 0.03)),
        C('tail', 0x6A4FB0, [0, 0.52, 0], [0, 0.3, -0.06], 0.15, 0.1, 0.08, { glow: 0.4 }),
        C('tail2', 0x8A6AD8, [0, 0.3, -0.06], [0, 0.12, -0.18], 0.1, 0.03, 0.06, { glow: 0.6 }),
        paint(0xB18CFF, S('chest', 0, [0, 0.86, 0.19], 0.06), 0.015, { glow: 1 }),
      ],
      details: [
        ...[1, -1].flatMap((sx) => [0, 1, 2].map((i) => horn(sx > 0 ? 'armL' : 'armR', 0xC5CED8, [sx * (0.3 + i * 0.05), 1.07, -0.06 + i * 0.05], [sx * (0.36 + i * 0.07), 1.24, -0.08 + i * 0.05], 0.03))),
        ...[1, -1].map((sx) => plate(sx > 0 ? 'armL' : 'armR', 0x6F7B8A, gearShape(0.1, 8), 0.03, { o: [sx * 0.47, 0.98, 0], x: [0, 0, 1], y: [0, 1, 0], z: [sx, 0, 0] }, { c1: 0xB9C4D0, bevel: 0.008 })),
        horn('head', 0x6F7B8A, [0, hy + 0.18, -0.02], [0, hy + 0.34, -0.1], 0.04, { c1: 0xB18CFF }),
      ],
      eyes: { at: [0.07, hy - 0.01, 0.2], r: 0.045, iris: 0xC79CFF, tall: 0.55, depth: 0.25, sink: 0.05, splay: 0.05 },
    };
  })(),

  // ------------------------------------------------------------ commons
  // A firefly whose lamp is an ember.
  emberfly: (() => {
    const by = 0.5;
    return {
      size: 1.1, plan: 'biped', flies: true, hover: 0.2, lid: 0xFF9A4C, lively: 1.3,
      bones: {
        root: [0, 0, 0], body: [0, by, 0, 'root'], head: [0, by + 0.14, 0.2, 'body'], tail: [0, by - 0.04, -0.14, 'body'],
        wingL: [0.1, by + 0.12, 0, 'body'], wingR: [-0.1, by + 0.12, 0, 'body'], antL: [0.06, by + 0.4, 0.28, 'head'], antR: [-0.06, by + 0.4, 0.28, 'head'],
      },
      parts: [
        E('body', 0xFF9A4C, [0, by + 0.02, 0.02], [0.13, 0.12, 0.13], 0.05),
        S('head', 0xFF9A4C, [0, by + 0.2, 0.2], 0.17, 0.07),
        E('tail', 0xFFD24A, [0, by - 0.08, -0.22], [0.15, 0.14, 0.2], 0.06, { glow: 0.9 }),
        ...[0, 1].map((i) => paint(0xC8541C, E('tail', 0, [0, by - 0.06, -0.12 - i * 0.08], [0.16, 0.15, 0.02]), 0.012)),
        mir(paint(0xFF9CB0, E('head', 0, [0.1, by + 0.15, 0.33], [0.03, 0.02, 0.025]), 0.01)),
        paint(0xFFE3A8, E('head', 0, [0, by + 0.13, 0.3], [0.1, 0.07, 0.07]), 0.03),
      ],
      details: [
        ...[1, -1].flatMap((sx) => [
          plate(sx > 0 ? 'wingL' : 'wingR', 0xFFF6E6, bugWing(0.36, 0.16), 0.01, { o: [sx * 0.08, by + 0.13, 0.02], x: [sx, 0.45, -0.5], y: [0, 0.2, 1], z: [0, 1, -0.2] }, { c1: 0xFFE3A8, rampX: 1 }),
          plate(sx > 0 ? 'wingL' : 'wingR', 0xFFF6E6, bugWing(0.28, 0.12), 0.01, { o: [sx * 0.08, by + 0.1, -0.03], x: [sx, 0.15, -0.8], y: [0, 0.2, 1], z: [0, 1, -0.2] }, { c1: 0xFFE3A8, rampX: 1 }),
          tube(sx > 0 ? 'antL' : 'antR', 0x8A3A14, [sx * 0.05, by + 0.33, 0.28], [sx * 0.12, by + 0.48, 0.34], 0.012, { taper: 0.8, bend: [0, 0.03, 0.03] }),
          ball(sx > 0 ? 'antL' : 'antR', 0xFFD24A, [sx * 0.12, by + 0.49, 0.34], 0.03, { glow: 0.9 }),
        ]),
      ],
      eyes: { at: [0.08, by + 0.24, 0.34], r: 0.06, iris: 0x4A1E0A, tall: 1.2 },
    };
  })(),

  // --------------------------------------------------------------- rare
  // A wyrm from the edge of evening: a maw made for swallowing light, ice
  // down its back and a crown of three horns.
  duskmaw: (() => {
    const q = serpent({
      size: 2.8, a: 0x3B2A63, belly: 0x8F7FD0, segs: 8, head: 0.28, iris: 0x8FDBFF, eye: 0.22, r: 0.2, snoutC: 0x3B2A63,
      path: [[0, 1.05, 0.4], [0, 0.82, 0.24], [0, 0.56, 0.04], [0, 0.4, -0.22], [0.04, 0.34, -0.55], [0.1, 0.4, -0.86], [0.06, 0.58, -1.05]],
      radii: [0.2, 0.21, 0.2, 0.18, 0.15, 0.1, 0.05],
    });
    const H = q.at.hp, r = q.at.hr;
    return make(q, {
      eyeStyle: 2, eyeGlow: 0.25, pose: 'ground',
      parts: [E('head', 0x2A1E4A, [H[0], H[1] - r * 0.55, H[2] + r * 0.45], [r * 0.7, r * 0.32, r * 0.72], 0.05), paint(0x1A0F2E, E('head', 0, [H[0], H[1] - r * 0.32, H[2] + r * 0.95], [r * 0.5, r * 0.06, r * 0.2]), 0.015)],
      details: [
        horn('head', 0x1E1433, [H[0], H[1] + r * 0.8, H[2]], [H[0], H[1] + r * 1.8, H[2] - r * 0.4], 0.06, { c1: 0x8FDBFF }),
        ...[1, -1].map((sx) => horn('head', 0x1E1433, [H[0] + sx * r * 0.55, H[1] + r * 0.6, H[2] - r * 0.1], [H[0] + sx * r * 1.1, H[1] + r * 1.4, H[2] - r * 0.6], 0.05, { c1: 0x8FDBFF, bend: [sx * 0.05, 0.05, 0] })),
        ...[1, -1].flatMap((sx) => [-0.25, 0.25].map((dx) => horn('head', 0xF2F8FF, [H[0] + dx * r, H[1] - r * 0.36, H[2] + r * 0.98], [H[0] + dx * r, H[1] - r * 0.56, H[2] + r * 1.0], 0.022))).slice(0, 2),
        ...[2, 3, 4, 5, 6].map((i) => { const f = spineAt(q, i); return crystal('seg' + i, 0xBFEFFF, add3(f.p, f.back.map((v) => v * 0.15)), add3(f.back, f.t.map((v) => -v * 0.4)), 0.26 - i * 0.02, 0.055, { c1: 0x8FDBFF, glow: 0.4 }); }),
      ],
    });
  })(),

  // ----------------------------------------------------------- legendary
  // The aurora given wings: antlers of light, a train of plumes that shifts
  // from green to rose.
  aurorix: (() => {
    const q = bird({ size: 5.0, a: 0xEAF9FF, b: 0xA8FFE6, body: 0.32, head: 0.22, belly: 0xFFFFFF, iris: 0x2A7AB0, eye: 0.3, beakC: 0xBFEFFF, beakC1: 0x8FD8F0, legC: 0xBFEFFF,
      wing: 1.05, wingH: 0.56, wingC: 0xA8FFE6, wingC1: 0xFF9FE0, tailN: 5, tailL: 1.0, tailC: 0xA8FFE6, tailC1: 0xFF9FE0, flies: true, blush: false });
    const c = q.at.crown;
    const antler = (sx) => {
      const b0 = [sx * 0.1, c[1] - 0.04, c[2] - 0.02], tip = [sx * 0.34, c[1] + 0.42, c[2] - 0.14];
      return [
        horn('head', 0xDFF6FF, b0, tip, 0.035, { c1: 0xA8FFE6, bend: [sx * 0.04, 0.02, 0.04] }),
        horn('head', 0xDFF6FF, lerp3(b0, tip, 0.45), [sx * 0.34, c[1] + 0.18, c[2] + 0.12], 0.022, { c1: 0xA8FFE6 }),
        horn('head', 0xDFF6FF, lerp3(b0, tip, 0.7), [sx * 0.18, c[1] + 0.4, c[2] + 0.06], 0.018, { c1: 0xA8FFE6 }),
      ];
    };
    return make(q, {
      hover: 0.12, glowK: 1.2,
      parts: [paint(0xDFFFF6, E('body', 0, [0, q.at.by, 0], [0.34, 0.34, 0.36]), 0.1, { glow: 0.25 })],
      details: [...antler(1), ...antler(-1)],
    });
  })(),

  // ----------------------------------------------------------------- bosses
  // A tyrant of cooled lava: basalt hide split with fire, horns like
  // obsidian, a tail it drags like a landslide.
  magmadon: (() => {
    const lava = { glow: 1 };
    return {
      size: 7.7, plan: 'biped', lid: 0x3A2418, eyeStyle: 2, eyeGlow: 0.3, lookK: 0.5,
      bones: {
        root: [0, 0, 0], body: [0, 0.62, -0.05, 'root'], chest: [0, 0.8, 0.12, 'body'], head: [0, 1.0, 0.3, 'chest'], jaw: [0, 1.0, 0.44, 'head'],
        legL: [0.22, 0.52, -0.08, 'body'], legR: [-0.22, 0.52, -0.08, 'body'], armL: [0.24, 0.82, 0.3, 'chest'], armR: [-0.24, 0.82, 0.3, 'chest'],
        tail: [0, 0.62, -0.42, 'body'], tail2: [0, 0.5, -0.78, 'tail'], tail3: [0, 0.44, -1.06, 'tail2'],
      },
      parts: [
        E('body', 0x3A2418, [0, 0.64, -0.06], [0.36, 0.34, 0.44], 0.08),
        S('chest', 0x3A2418, [0, 0.82, 0.16], 0.31, 0.1),
        S('head', 0x3A2418, [0, 1.2, 0.42], 0.3, 0.1),
        E('head', 0x3A2418, [0, 1.1, 0.68], [0.21, 0.15, 0.22], 0.06),
        E('jaw', 0x2A1810, [0, 0.96, 0.6], [0.19, 0.08, 0.21], 0.04),
        mir(E('legL', 0x3A2418, [0.23, 0.48, -0.08], [0.17, 0.23, 0.21], 0.07)),
        mir(C('legL', 0x3A2418, [0.24, 0.36, -0.06], [0.25, 0.1, 0.0], 0.13, 0.12, 0.05)),
        mir(E('legL', 0x2A1810, [0.25, 0.06, 0.06], [0.14, 0.07, 0.17], 0.03)),
        mir(C('armL', 0x3A2418, [0.24, 0.82, 0.3], [0.3, 0.66, 0.46], 0.07, 0.06, 0.05)),
        C('tail', 0x3A2418, [0, 0.66, -0.42], [0, 0.52, -0.8], 0.24, 0.16, 0.07),
        C('tail2', 0x3A2418, [0, 0.52, -0.8], [0, 0.44, -1.08], 0.16, 0.08, 0.05),
        paint(0xB8431E, E('body', 0, [0, 0.6, 0.18], [0.24, 0.3, 0.2]), 0.06),
        paint(0xFF6A1F, E('body', 0, [0.16, 0.7, 0.05], [0.02, 0.2, 0.2], 0, { rot: [0, 0.4, 0.3] }), 0.012, lava),
        paint(0xFF6A1F, E('body', 0, [-0.2, 0.6, -0.12], [0.02, 0.18, 0.22], 0, { rot: [0, -0.3, -0.2] }), 0.012, lava),
        paint(0xFF6A1F, E('tail', 0, [0.1, 0.62, -0.58], [0.02, 0.12, 0.18], 0, { rot: [0.2, 0.3, 0] }), 0.012, lava),
        paint(0xFF6A1F, E('head', 0, [0.14, 1.32, 0.36], [0.02, 0.1, 0.14], 0, { rot: [0.3, 0.2, 0.4] }), 0.012, lava),
        paint(0xFF7A2A, E('jaw', 0, [0, 1.02, 0.62], [0.16, 0.02, 0.17]), 0.015, lava),
      ],
      details: [
        horn('head', 0x1A100A, [0, 1.2, 0.84], [0, 1.44, 0.98], 0.07, { c1: 0xFF9A3C, bend: [0, 0.03, 0.05] }),
        ...[1, -1].map((sx) => horn('head', 0x1A100A, [sx * 0.2, 1.4, 0.4], [sx * 0.42, 1.72, 0.12], 0.08, { c1: 0xFF9A3C, bend: [sx * 0.08, 0.12, 0.06] })),
        ...spineSpikes((t) => (t < 0.4 ? 'body' : t < 0.75 ? 'tail' : 'tail2'), 0x1A100A, [0, 0.98, 0.1], [0, 0.56, -0.98], 8, 0.24, 0.07, { c1: 0xFF7A2A, dir: [0, 1, -0.3] }),
        ...[-0.12, -0.04, 0.04, 0.12].map((x) => horn('head', 0xFFF1D8, [x, 1.02, 0.84], [x, 0.97, 0.86], 0.022)),
        ...[1, -1].flatMap((sx) => [-0.07, 0.0, 0.07].map((dx) => horn(sx > 0 ? 'legL' : 'legR', 0xFFF1D8, [sx * 0.25 + dx, 0.06, 0.2], [sx * 0.25 + dx * 1.3, 0.02, 0.28], 0.025))),
      ],
      eyes: { at: [0.13, 1.28, 0.64], r: 0.055, iris: 0xFFD24A, tall: 0.8, splay: 0.3 },
    };
  })(),

  // The deep's own serpent: thorns of old ice, a fin like a sail, whiskers
  // that trail currents.
  leviathorn: (() => {
    const q = serpent({
      size: 8.0, a: 0x1C5F9E, belly: 0xA8E6FF, segs: 9, head: 0.3, iris: 0x0E2F55, eye: 0.24, r: 0.24,
      path: [[0, 1.2, 0.5], [0, 0.98, 0.34], [0.05, 0.7, 0.16], [0.08, 0.46, -0.12], [0.05, 0.36, -0.5], [-0.05, 0.42, -0.86], [-0.08, 0.64, -1.08], [-0.05, 0.9, -1.16]],
      radii: [0.23, 0.25, 0.24, 0.22, 0.19, 0.14, 0.09, 0.05],
    });
    const H = q.at.hp, r = q.at.hr;
    return make(q, {
      hover: 0.06, eyeStyle: 1,
      details: [
        ...[1, -1].map((sx) => plate('head', 0x2F8FE0, finShape(0.34, 0.22), 0.03, { o: [H[0] + sx * r * 0.8, H[1] + 0.02, H[2] - 0.06], x: [sx * 0.5, 0.3, -0.9], y: [0, 1, 0], z: [1, 0, 0] }, { c1: 0xA8E6FF })),
        ...[1, -1].map((sx) => tube('head', 0xA8E6FF, [H[0] + sx * 0.14, H[1] - 0.1, H[2] + 0.24], [H[0] + sx * 0.56, H[1] - 0.4, H[2] - 0.08], 0.024, { taper: 0.2, bend: [sx * 0.06, -0.12, 0.14] })),
        crystal('head', 0xDFF6FF, [H[0], H[1] + r * 0.8, H[2]], [0, 1, -0.5], 0.36, 0.07, { c1: 0x8FDBFF, glow: 0.3 }),
        ...[2, 3, 4, 5, 6, 7].map((i) => { const f = spineAt(q, i); return crystal('seg' + i, 0xDFF6FF, add3(f.p, f.back.map((v) => v * 0.17)), add3(f.back, f.t.map((v) => -v * 0.5)), 0.32 - i * 0.025, 0.065, { c1: 0x8FDBFF, glow: 0.3 }); }),
        ...[1, -1].map((sx) => plate('seg2', 0x2F8FE0, leafShape(0.36, 0.12), 0.03, { o: add3(spineAt(q, 2).p, [sx * 0.2, 0, 0.02]), x: [sx, -0.35, 0.2], y: [0, 0.3, 1], z: [0, 1, 0] }, { c1: 0xA8E6FF, rampX: 1 })),
        plate('seg9', 0x2F8FE0, finShape(0.5, 0.42), 0.035, { o: q.at.tail, x: [0, 0.6, -0.8], y: [0, 0.8, 0.6], z: [1, 0, 0] }, { c1: 0xA8E6FF }),
      ],
    });
  })(),

  // The warden of nothing: a knight of black iron with the void burning in
  // its chest, a gear for a halo and a crown of three horns.
  nullwarden: (() => {
    const q = biped({ size: 9.3, a: 0x2E2545, bodyC: 0x2E2545, b: 0x9AA6B8, head: 0.24, body: 0.4, leg: 0.22, arm: 0.56, armR: 0.11, hand: 1.35, legR: 0.12,
      iris: 0xD08CFF, eye: 0.3, eyeTall: 0.6, blush: false, hy: 1.12, wide: 1.05 });
    const c = q.at.crown;
    return make(q, {
      eyeStyle: 2, eyeGlow: 0.4, lookK: 0.4, rough: 0.35, metal: 0.3,
      parts: [
        mir(S('chest', 0x3A3056, [0.38, q.at.by + 0.34, 0], 0.17, 0.04)),
        Tr('body', 0x9AA6B8, [0, q.at.by - 0.18, 0], 0.37, 0.035, 0.03),
        Bx('head', 0x1A1428, [0, q.at.hy - 0.01, 0.2], [0.14, 0.05, 0.05], 0.03, 0.01),
        paint(0x9AA6B8, E('body', 0, [0, q.at.by + 0.1, 0.36], [0.28, 0.3, 0.1]), 0.02, { alpha: 0.35 }),
      ],
      details: [
        ball('chest', 0xB06CFF, [0, q.at.by + 0.16, 0.38], 0.1, { glow: 1 }),
        ring('chest', 0x9AA6B8, [0, q.at.by + 0.16, 0.37], 0.12, 0.022, [1.5708, 0, 0]),
        plate('head', 0x4A3F6A, gearShape(0.36, 12), 0.04, { o: [0, c[1] - 0.1, -0.26], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }, { c1: 0xB06CFF, bevel: 0.012 }),
        horn('head', 0x9AA6B8, [0, c[1] - 0.02, 0.02], [0, c[1] + 0.26, -0.04], 0.05, { c1: 0xE8E0FF }),
        ...[1, -1].map((sx) => horn('head', 0x9AA6B8, [sx * 0.13, c[1] - 0.06, 0.02], [sx * 0.3, c[1] + 0.18, -0.06], 0.045, { c1: 0xE8E0FF, bend: [sx * 0.04, 0.04, 0] })),
        ...[1, -1].flatMap((sx) => [0, 1, 2].map((i) => horn(sx > 0 ? 'armL' : 'armR', 0x9AA6B8, [sx * (0.36 + i * 0.06), q.at.by + 0.48, -0.08 + i * 0.07], [sx * (0.44 + i * 0.08), q.at.by + 0.7, -0.1 + i * 0.07], 0.04))),
      ],
      eyes: { at: [0.08, q.at.hy - 0.01, 0.22], r: 0.05, tall: 0.55, depth: 0.25, sink: 0.05, splay: 0.08 },
    });
  })(),

  // The oldest tree in the world stood up: a crown of leaves with flowers in
  // it, a beard of moss, arms of branch and feet of root.
  rootfather: (() => {
    const q = biped({ size: 7.8, a: 0x6B4A2A, bodyC: 0x6B4A2A, b: 0x4A3220, head: 0.28, body: 0.36, leg: 0.2, arm: 0.6, armR: 0.085, hand: 1.2, legR: 0.12,
      iris: 0xFFC43A, eye: 0.26, eyeTall: 0.9, blush: false, tall: 1.3, hy: 1.12, neckK: 1.6 });
    const c = q.at.crown;
    const canopy = [[0, 0.16, -0.02, 0.3], [0.24, 0.06, 0.02, 0.22], [-0.24, 0.06, 0.02, 0.22], [0.12, 0.2, -0.2, 0.22], [-0.14, 0.2, -0.18, 0.22], [0, 0.3, 0.1, 0.18]];
    return make(q, {
      eyeStyle: 2, eyeGlow: 0.25, lookK: 0.5,
      parts: [
        ...canopy.map(([x, y, z, r], i) => S('head', i % 2 ? 0x4F9A55 : 0x3F7A45, [x, c[1] + y, z], r, 0.08)),
        paint(0x6FB85A, E('head', 0, [0, q.at.hy - 0.2, 0.2], [0.2, 0.14, 0.12]), 0.04),
        paint(0x4A3220, E('body', 0, [0.12, q.at.by + 0.1, 0.3], [0.02, 0.25, 0.1], 0, { rot: [0, 0, 0.2] }), 0.015),
        paint(0x4A3220, E('body', 0, [-0.1, q.at.by - 0.05, 0.32], [0.02, 0.22, 0.1], 0, { rot: [0, 0, -0.15] }), 0.015),
      ],
      details: [
        ...[0.1, 0, -0.1].map((x, i) => tube('head', 0x6FB85A, [x, q.at.hy - 0.2, 0.24], [x * 1.4, q.at.hy - 0.46 - i * 0.03, 0.26], 0.03, { taper: 0.5 })),
        ...[1, -1].flatMap((sx) => [-0.4, 0.1, 0.6].map((a) => horn(sx > 0 ? 'legL' : 'legR', 0x4A3220, [sx * 0.18, 0.08, 0.02], [sx * (0.22 + Math.cos(a) * 0.14), 0.02, Math.sin(a) * 0.2 + 0.08], 0.05))),
        ...[1, -1].flatMap((sx) => [0, 1, 2].map((i) => plate(sx > 0 ? 'armL' : 'armR', 0x4F9A55, leafShape(0.16, 0.06), 0.015,
          { o: [sx * q.at.hand[0], q.at.hand[1], q.at.hand[2]], x: [sx * Math.cos(i - 1), -0.5, Math.sin(i - 1)], y: [0, 0.3, 1], z: [1, 0, 0] }, { c1: 0x9FE07A, rampX: 1 }))),
        ...[[0.2, 0.3, 0.18], [-0.26, 0.2, 0.16], [0.06, 0.44, 0.14]].map(([x, y, z]) => ball('head', 0xFF9CC8, [x, c[1] + y, z], 0.04)),
      ],
    });
  })(),

  // The storm's own bird: wings of gold that throw lightning, a crest of
  // thundercloud and a tail that trails bolts.
  stormcaller: (() => {
    const q = bird({ size: 12.4, a: 0x3F5FB8, b: 0xFFD23D, body: 0.32, head: 0.24, belly: 0x8FA8E8, iris: 0xFFF6B0, eye: 0.26, beakC: 0xFFD23D, beakC1: 0xFFB020, legC: 0xFFD23D,
      wing: 1.25, wingH: 0.6, wingC: 0xFFD23D, wingC1: 0x3F5FB8, tailN: 5, tailL: 0.9, tailC: 0xFFD23D, tailC1: 0x3F5FB8, flies: true, blush: false });
    const c = q.at.crown;
    return make(q, {
      eyeStyle: 2, eyeGlow: 0.3, hover: 0.1,
      parts: [
        ...[[0, 0.06, -0.02, 0.13], [0.12, 0.02, -0.08, 0.1], [-0.12, 0.02, -0.08, 0.1], [0, 0.1, -0.16, 0.1]].map(([x, y, z, r]) => S('head', 0xC9D3E8, [x, c[1] + y, c[2] + z], r, 0.06)),
      ],
      details: [
        ...[1, -1].map((sx) => plate(sx > 0 ? 'wingL' : 'wingR', 0xFFF6B0, boltShape(0.34, 0.2), 0.03,
          { o: [sx * 1.0, q.at.by + 0.25, -0.05], x: [sx * 0.3, -1, 0], y: [sx, 0.3, 0], z: [0, 0, 1] }, { c1: 0xFFFFFF, glow: 0.6 })),
        plate('tail', 0xFFF6B0, boltShape(0.4, 0.22), 0.03, { o: [0, q.at.by, -0.95], x: [0, -0.3, -1], y: [1, 0, 0], z: [0, 1, 0] }, { c1: 0xFFFFFF }),
      ],
    });
  })(),

  // A king of the hollow places: a cloak with nobody in it, a mask for a
  // face, a crown of three horns and hands that float free.
  hollowking: (() => {
    const hy = 1.18;
    return {
      size: 5.8, plan: 'biped', floats: true, hover: 0.1, lid: 0xEDE6FF, eyeStyle: 2, eyeGlow: 0.35, lookK: 0.6,
      bones: {
        root: [0, 0, 0], body: [0, 0.6, 0, 'root'], chest: [0, 0.86, 0, 'body'], head: [0, hy - 0.2, 0.02, 'chest'],
        armL: [0.34, 0.8, 0.1, 'chest'], armR: [-0.34, 0.8, 0.1, 'chest'], tail: [0, 0.3, -0.05, 'body'],
      },
      parts: [
        C('chest', 0x2A1B45, [0, 0.98, 0], [0, 0.5, 0], 0.2, 0.36, 0.08),
        C('tail', 0x2A1B45, [0, 0.5, 0], [0, 0.08, -0.08], 0.36, 0.44, 0.06),
        Tr('chest', 0x4A2F7A, [0, 0.98, 0], 0.22, 0.07, 0.05, { rot: [0.15, 0, 0] }),
        E('head', 0xEDE6FF, [0, hy, 0.06], [0.2, 0.24, 0.19], 0.06),
        mir(paint(0x140A24, E('head', 0, [0.075, hy + 0.02, 0.22], [0.06, 0.07, 0.05]), 0.012)),
        paint(0x9A5BFF, C('tail', 0, [0, 0.14, -0.06], [0, 0.04, -0.08], 0.46, 0.46, 0), 0.05, { glow: 0.9 }),
        paint(0x5A3A9A, C('chest', 0, [0, 0.8, 0.2], [0, 0.2, 0.36], 0.05, 0.08, 0), 0.02),
      ],
      details: [
        ...[1, -1].map((sx) => ball(sx > 0 ? 'armL' : 'armR', 0xEDE6FF, [sx * 0.42, 0.72, 0.16], 0.08)),
        ...[1, -1].map((sx) => ball(sx > 0 ? 'armL' : 'armR', 0x9A5BFF, [sx * 0.42, 0.72, 0.16], 0.11, { glow: 0.5, sy: 0.3 })),
        horn('head', 0xFFD66B, [0, hy + 0.2, 0.02], [0, hy + 0.5, -0.04], 0.05, { c1: 0xFFF1B0 }),
        ...[1, -1].map((sx) => horn('head', 0xFFD66B, [sx * 0.13, hy + 0.16, 0.0], [sx * 0.32, hy + 0.42, -0.08], 0.045, { c1: 0xFFF1B0, bend: [sx * 0.04, 0.04, 0] })),
        ring('head', 0xFFD66B, [0, hy + 0.17, 0.0], 0.16, 0.03, [0.1, 0, 0]),
        ball('chest', 0xFF5AF0, [0, 0.9, 0.2], 0.05, { glow: 1 }),
      ],
      eyes: { at: [0.075, hy + 0.02, 0.24], r: 0.04, iris: 0xFF7AF0, tall: 1.1, depth: 0.3, sink: 0.35, splay: 0.05 },
    };
  })(),
};

export const FIGURINE_IDS = Object.keys(FIGURINES);
