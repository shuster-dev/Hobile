/**
 * The second wave, sculpted (shared/species-more.js has their numbers).
 *
 * Seventy creatures could not each be carved by hand the way the first fifty
 * were, and should not all look alike either. So each is a body plan with its
 * own proportions (figurine-designs.js: quad, blob, biped, serpent, bird) and
 * a few pieces from a kit — horns, flames, leaves, fins, crystals, gears,
 * wings, a halo — placed by anchors every plan can answer: the head, the
 * crown, the brow, a line down the back, the shoulders, the tail. What makes
 * one a mole and another a fox is in the proportions; what makes it fire or
 * frost is in the kit.
 */
import {
  FIGURINES, S, E, C, paint, mir, horn, tube, plate, crystal, flame, ball, ring,
  leafShape, boltShape, finShape, heartShape, flameRing, spineSpikes,
  quad, blob, biped, serpent, bird, featherWing, batWing, bugWing, gearShape, crescent,
  make, add3, lerp3, norm3, FIRE,
} from './figurine-designs.js';

// -- anchors -------------------------------------------------------------------
/** Where things go on a body built by one of the plans. */
function anchors(q, kind) {
  const A = q.at;
  if (kind === 'quad') {
    const head = { bone: 'head', c: [0, A.hy, A.hz], r: A.hr };
    return {
      kind, head,
      crown: [0, A.hy + A.hr * 0.9, A.hz - A.hr * 0.1],
      brow: [0, A.hy + A.hr * 0.55, A.hz + A.hr * 0.72],
      snout: [0, A.hy - A.hr * 0.3, A.hz + A.hr * 1.05],
      back: { bone: 'body', from: [0, A.y + A.Hb * 0.95, A.zF * 0.75], to: [0, A.y + A.Hb * 0.85, A.zB * 1.05] },
      shoulder: { bone: 'chest', p: [A.st * 0.8, A.y + A.Hb * 0.85, A.zF * 0.45] },
      tail: A.tailTip ? { bone: A.tailBone, p: A.tailTip } : null,
      body: { bone: 'body', c: [0, A.y, 0], r: [A.W, A.Hb, A.L / 2] },
      neck: { bone: 'chest', p: [0, A.y + A.Hb * 0.9, A.zF + 0.04] },
    };
  }
  if (kind === 'biped') {
    const head = { bone: 'head', c: [0, A.hy, 0.02], r: A.hr };
    return {
      kind, head,
      crown: [0, A.hy + A.hr * 0.92, 0],
      brow: [0, A.hy + A.hr * 0.5, A.hr * 0.82],
      snout: [0, A.hy - A.hr * 0.25, A.hr * 0.95],
      back: { bone: 'chest', from: [0, A.by + A.br * 0.7, -A.br * 0.75], to: [0, A.by - A.br * 0.2, -A.br * 0.95] },
      shoulder: { bone: 'chest', p: [A.br * 0.6, A.by + A.br * 0.75, -A.br * 0.45] },
      tail: null,
      body: { bone: 'body', c: [0, A.by, 0], r: [A.br, A.br, A.br] },
      neck: { bone: 'chest', p: [0, A.by + A.br * 0.95, 0] },
      hand: A.hand,
    };
  }
  if (kind === 'blob') {
    const head = { bone: 'head', c: [0, A.y, 0], r: A.R };
    return {
      kind, head,
      crown: [0, A.y + A.R * 0.9, -A.R * 0.05],
      brow: [0, A.y + A.R * 0.55, A.R * 0.78],
      snout: [0, A.y - A.R * 0.1, A.R * 0.98],
      back: { bone: 'body', from: [0, A.y + A.R * 0.85, -A.R * 0.25], to: [0, A.y + A.R * 0.35, -A.R * 0.92] },
      shoulder: { bone: 'body', p: [A.R * 0.62, A.y + A.R * 0.45, -A.R * 0.4] },
      tail: null,
      body: { bone: 'body', c: [0, A.y, 0], r: [A.R, A.R, A.R] },
      neck: { bone: 'body', p: [0, A.y + A.R * 0.5, 0] },
    };
  }
  if (kind === 'bird') {
    const head = { bone: 'head', c: [0, A.hy, A.hz], r: A.hr };
    return {
      kind, head,
      crown: [0, A.hy + A.hr * 0.9, A.hz - A.hr * 0.1],
      brow: [0, A.hy + A.hr * 0.5, A.hz + A.hr * 0.8],
      snout: [0, A.hy - A.hr * 0.1, A.hz + A.hr],
      back: { bone: 'body', from: [0, A.by + A.br * 0.85, A.br * 0.05], to: [0, A.by + A.br * 0.55, -A.br * 0.8] },
      shoulder: { bone: 'body', p: [A.br * 0.7, A.by + A.br * 0.45, 0] },
      tail: { bone: 'tail', p: [0, A.by + A.br * 0.2, -A.br * 1.5] },
      body: { bone: 'body', c: [0, A.by, 0], r: [A.br, A.br, A.br] },
      neck: { bone: 'body', p: [0, A.by + A.br * 0.75, A.br * 0.35] },
    };
  }
  // serpent
  const P = A.pts, n = A.n, hp = A.hp;
  const head = { bone: 'head', c: hp, r: A.hr };
  const seg = (t) => 'seg' + Math.max(1, Math.min(n, Math.round(t * (n - 1)) + 1));
  return {
    kind, head, seg,
    crown: [hp[0], hp[1] + A.hr * 0.9, hp[2] - A.hr * 0.1],
    brow: [hp[0], hp[1] + A.hr * 0.5, hp[2] + A.hr * 0.8],
    snout: [hp[0], hp[1] - A.hr * 0.2, hp[2] + A.hr * 1.15],
    back: { bone: seg, pts: P, r0: A.r0 },
    shoulder: { bone: 'seg2', p: [P[1][0] + A.r0 * 0.8, P[1][1] + A.r0 * 0.4, P[1][2]] },
    tail: { bone: 'seg' + n, p: P[n] },
    body: { bone: 'seg2', c: P[1], r: [A.r0, A.r0, A.r0] },
    neck: { bone: 'seg1', p: P[0] },
  };
}

/** Points down the back: `n` of them, with the bone each belongs to and
 *  the way up there. */
function backPoints(A, n, from = 0.08, to = 0.92) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? (from + to) / 2 : from + (to - from) * i / (n - 1);
    if (A.kind === 'serpent') {
      const P = A.back.pts, k = Math.min(P.length - 2, Math.floor(t * (P.length - 1))), u = t * (P.length - 1) - k;
      const p = lerp3(P[k], P[k + 1], u), T = norm3([P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1], P[k + 1][2] - P[k][2]]);
      const up = norm3([0, Math.abs(T[2]) + 0.2, -T[1] * Math.sign(T[2] || 1)]);
      const r = A.back.r0 * (1 - t * 0.65);
      out.push({ bone: A.back.bone(t), p: add3(p, up.map((v) => v * r * 0.85)), up, t, r });
    } else {
      out.push({ bone: A.back.bone, p: lerp3(A.back.from, A.back.to, t), up: [0, 1, -0.2], t, r: 0.1 });
    }
  }
  return out;
}

const darker = (c, k = 0.6) => [16, 8, 0].reduce((s, sh) => s + (Math.round(((c >> sh) & 255) * k) << sh), 0);
const lighter = (c, k = 0.5) => [16, 8, 0].reduce((s, sh) => { const v = (c >> sh) & 255; return s + (Math.round(v + (255 - v) * k) << sh); }, 0);

// -- the kit -------------------------------------------------------------------
const KIT = {
  /** Two horns from the crown, out and back. */
  horns(A, { c = 0x5A4A3A, c1, len = 0.8, spread = 0.55, back = 0.5, up = 1, r = 0.16, bend } = {}) {
    const h = A.head, b = [h.r * 0.36, h.c[1] + h.r * 0.72, h.c[2] - h.r * 0.05];
    return { details: [1, -1].map((sx) => horn('head', c, [sx * b[0], b[1], b[2]], [sx * (b[0] + h.r * spread), b[1] + h.r * len * up, b[2] - h.r * back], h.r * r, { c1: c1 ?? lighter(c, 0.4), bend: bend ?? [0, 0.04, 0.02] })) };
  },
  /** One horn from the brow. */
  horn1(A, { c = 0xFFF2C0, c1 = 0xFFFFFF, len = 0.9, r = 0.13, glow = 0 } = {}) {
    const h = A.head, b = A.brow;
    return { details: [horn('head', c, b, [b[0], b[1] + h.r * len * 0.75, b[2] + h.r * len * 0.55], h.r * r, { c1, glow })] };
  },
  /** A short pair from the muzzle, pointing up. */
  tusks(A, { c = 0xFFF6E0, len = 0.35 } = {}) {
    const h = A.head, s = A.snout;
    return { details: [1, -1].map((sx) => horn('head', c, [sx * h.r * 0.28, s[1] - h.r * 0.12, s[2] - h.r * 0.12], [sx * h.r * 0.4, s[1] + h.r * len, s[2] + h.r * 0.05], h.r * 0.08)) };
  },
  /** Flames standing up from the crown. */
  flameCrown(A, { n = 5, len = 0.55, fire = FIRE } = {}) {
    const h = A.head;
    return { details: flameRing('head', A.crown, n, h.r * 0.28, h.r * len, h.r * 0.14, { up: 1.4, out: 0.35, c: fire.c, c1: fire.c1, glow: fire.glow ?? 0.75 }) };
  },
  /** A flame where the tail ends. */
  flameTail(A, { len = 0.3, r = 0.09, fire = FIRE } = {}) {
    if (!A.tail) return {};
    return { details: [flame(A.tail.bone, A.tail.p, [0, 1, -0.45], len, r, { ...fire })] };
  },
  /** Tongues of fire down the back. */
  flameBack(A, { n = 4, len = 0.22, r = 0.06, fire = FIRE } = {}) {
    return { details: backPoints(A, n, 0.12, 0.78).map((b, i) => flame(b.bone, b.p, [0, 1, -0.4], len * (1 - b.t * 0.35), r, { ...fire, glow: 0.7 })) };
  },
  /** Glowing spots down the back (embers, sparks, runes). */
  glowSpots(A, { c = 0xFFD24A, n = 5, r = 0.035, glow = 0.85 } = {}) {
    return { parts: backPoints(A, n, 0.1, 0.9).map((b, i) => paint(c, S(b.bone, 0, add3(b.p, [(i % 2 ? 1 : -1) * 0.05, -0.02, 0]), r * (A.kind === 'serpent' ? b.r / 0.1 : 1)), 0.012, { glow })) };
  },
  /** Leaves fanned on the crown. */
  leafCrown(A, { c = 0x4FA858, c1 = 0xA8EE8A, n = 3, len = 0.9, w = 0.2 } = {}) {
    const h = A.head;
    return {
      details: Array.from({ length: n }, (_, i) => {
        const a = (i - (n - 1) / 2) * 0.55;
        const dir = norm3([Math.sin(a), 1.4, -0.35]), side = norm3([Math.cos(a), -Math.sin(a) * 0.3, 0]);
        return plate('head', c, leafShape(h.r * len, h.r * w), h.r * 0.04, { o: A.crown, x: dir, y: side, z: norm3([0, 0.3, 1]) }, { c1, curl: 0.02 });
      }),
    };
  },
  /** Leaves along the back, lying back like a mane. */
  leafBack(A, { c = 0x3F9A4A, c1 = 0x9AEA80, n = 5, len = 0.32, w = 0.09 } = {}) {
    return {
      details: backPoints(A, n, 0.05, 0.85).flatMap((b, i) => [1, -1].map((sx) => plate(b.bone, c, leafShape(len * (1 - b.t * 0.3), w), 0.012,
        { o: b.p, x: norm3([sx * 0.55, 0.7, -0.6]), y: norm3([0, 0.45, 0.9]), z: [sx, 0, 0] }, { c1, curl: sx * 0.02 }))),
    };
  },
  /** Petals in a ring on the crown and a bud in the middle. */
  flower(A, { c = 0xFF8AC8, c1 = 0xFFE0F0, n = 6, size = 0.55, centre = 0xFFD23D } = {}) {
    const h = A.head, o = add3(A.crown, [0, h.r * 0.05, 0]);
    return {
      details: [
        ...Array.from({ length: n }, (_, i) => {
          const a = i / n * Math.PI * 2;
          const d = norm3([Math.cos(a), 0.45, Math.sin(a)]);
          return plate('head', c, heartShape(h.r * size), h.r * 0.035, { o, x: d, y: norm3([-Math.sin(a), 0, Math.cos(a)]), z: norm3([-Math.cos(a) * 0.45, 1, -Math.sin(a) * 0.45]) }, { c1 });
        }),
        ball('head', centre, add3(o, [0, h.r * 0.06, 0]), h.r * 0.2, { glow: 0.3 }),
      ],
    };
  },
  /** A mushroom's cap over the head, with spots. */
  cap(A, { c = 0xC84A4A, spot = 0xFFF2E0, w = 1.35, h = 0.55, n = 6 } = {}) {
    const H = A.head, top = add3(A.crown, [0, -H.r * 0.15, 0]);
    return {
      parts: [
        E('head', c, top, [H.r * w, H.r * h, H.r * w], 0.06),
        ...Array.from({ length: n }, (_, i) => {
          const a = i / n * Math.PI * 2 + 0.4, rr = H.r * w * (i % 2 ? 0.55 : 0.8);
          return paint(spot, S('head', 0, add3(top, [Math.cos(a) * rr, H.r * h * (i % 2 ? 0.85 : 0.55), Math.sin(a) * rr]), H.r * 0.16), 0.015);
        }),
      ],
    };
  },
  /** A bolt at the tail's end (or two over the ears). */
  bolt(A, { c = 0xFFE05A, c1 = 0xFFF6C0, size = 0.32, at = 'tail' } = {}) {
    if (at === 'tail' && A.tail) return { details: [plate(A.tail.bone, c, boltShape(size, size * 0.6), size * 0.08, { o: A.tail.p, x: [1, 0, 0], y: [0, 1, 0.1], z: [0, 0, 1] }, { c1 })] };
    const h = A.head;
    return { details: [1, -1].map((sx) => plate('head', c, boltShape(h.r * 1.1, h.r * 0.7), h.r * 0.06, { o: add3(A.crown, [sx * h.r * 0.45, -h.r * 0.1, 0]), x: [sx, 0, 0], y: norm3([sx * 0.4, 1, -0.2]), z: norm3([0, 0.2, 1]) }, { c1 })) };
  },
  /** Little glowing orbs drifting about the head. */
  orbs(A, { c = 0xFFF27A, n = 3, r = 0.1, glow = 1 } = {}) {
    const h = A.head;
    return { details: Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2 + 0.7; return ball('head', c, add3(h.c, [Math.cos(a) * h.r * 1.35, h.r * (0.6 + (i % 2) * 0.3), Math.sin(a) * h.r * 1.1 - h.r * 0.2]), h.r * r * 1.4, { glow }); }) };
  },
  /** A fin down the back. */
  finBack(A, { c = 0x3D8AFF, c1 = 0xBDEAFF, len = 0.8, h = 0.28 } = {}) {
    const B = backPoints(A, 2, 0.15, 0.7), o = B[0].p, to = B[1].p;
    const x = norm3([to[0] - o[0], to[1] - o[1], to[2] - o[2]]), L = Math.hypot(to[0] - o[0], to[1] - o[1], to[2] - o[2]) * 1.4;
    return { details: [plate(B[0].bone, c, finShape(L * len / 0.8, L * h * 1.6), 0.018, { o, x, y: [0, 1, 0], z: [1, 0, 0] }, { c1 })] };
  },
  /** Fins at the sides, swept back. */
  finSides(A, { c = 0x3D8AFF, c1 = 0xBDEAFF, size = 0.3 } = {}) {
    const s = A.shoulder;
    return { details: [1, -1].map((sx) => plate(s.bone, c, finShape(size, size * 0.6), size * 0.06, { o: [sx * s.p[0], s.p[1] - 0.04, s.p[2]], x: norm3([sx * 0.7, -0.2, -0.8]), y: [0, 1, 0], z: [sx * 0.6, 0, 0.8].map((v) => v) }, { c1 })) };
  },
  /** A shell on the back. */
  shell(A, { c = 0xC8A06A, c1 = 0xF2D8A8, r = 0.32, rings = 3 } = {}) {
    const B = backPoints(A, 1, 0.4, 0.4)[0];
    const o = add3(B.p, [0, r * 0.15, 0]);
    return {
      parts: [E(B.bone, c, o, [r * 1.05, r * 0.72, r * 1.15], 0.05)],
      details: Array.from({ length: rings }, (_, i) => ring(B.bone, c1, add3(o, [0, r * (0.25 + i * 0.16), 0]), r * (0.88 - i * 0.26), r * 0.05, [0, 0, 0])),
    };
  },
  /** Crystals down the back. */
  crystals(A, { c = 0xA86AE8, c1 = 0xF2E0FF, n = 5, len = 0.32, r = 0.07, glow = 0.45 } = {}) {
    return { details: backPoints(A, n, 0.08, 0.85).map((b, i) => crystal(b.bone, i % 2 ? c : lighter(c, 0.2), b.p, norm3([(i % 2 ? 0.3 : -0.3), 1, -0.3]), len * (1.05 - b.t * 0.5), r * (1 - b.t * 0.35), { c1, glow })) };
  },
  /** A cluster of crystals on the crown. */
  crystalCrown(A, { c = 0x9AD8FF, c1 = 0xFFFFFF, n = 3, len = 0.7, glow = 0.5 } = {}) {
    const h = A.head;
    return { details: Array.from({ length: n }, (_, i) => { const a = (i - (n - 1) / 2) * 0.5; return crystal('head', c, add3(A.crown, [Math.sin(a) * h.r * 0.3, 0, 0]), norm3([Math.sin(a) * 0.8, 1, -0.2]), h.r * len * (i === (n - 1) / 2 ? 1.2 : 0.85), h.r * 0.14, { c1, glow }); }) };
  },
  /** A gear standing on the back, and rivets. */
  gear(A, { c = 0xC8A050, c1 = 0xF2E0B0, R = 0.22, rivet = 0x5A5A6A } = {}) {
    const B = backPoints(A, 1, 0.35, 0.35)[0];
    return {
      details: [
        plate(B.bone, c, gearShape(R, 9), R * 0.18, { o: add3(B.p, [0, R * 0.75, 0]), x: [0, 0, 1], y: [0, 1, 0], z: [1, 0, 0] }, { c1, holes: [Array.from({ length: 10 }, (_, i) => [Math.cos(-i / 10 * Math.PI * 2) * R * 0.3, Math.sin(-i / 10 * Math.PI * 2) * R * 0.3])] }),
        ...backPoints(A, 3, 0.6, 0.95).map((b) => ball(b.bone, rivet, b.p, 0.035)),
      ],
    };
  },
  /** Two feelers with lights on the ends. */
  antennae(A, { c = 0x3A3A3A, tip = 0xFFF27A, len = 0.9, glow = 0.9 } = {}) {
    const h = A.head;
    return {
      details: [1, -1].flatMap((sx) => {
        const a = add3(A.crown, [sx * h.r * 0.25, -h.r * 0.05, h.r * 0.1]), b = add3(a, [sx * h.r * 0.35, h.r * len, h.r * 0.3]);
        return [tube('head', c, a, b, h.r * 0.045, { taper: 0.6, bend: [sx * 0.02, 0.03, 0.05] }), ball('head', tip, b, h.r * 0.13, { glow })];
      }),
    };
  },
  /** Wings at the shoulders: feathered, a bat's, or an insect's. */
  wings(A, { style = 'feather', c = 0xFFFFFF, c1, l = 0.6, h = 0.35, raise = 0.6, glow = 0 } = {}) {
    const s = A.shoulder, shape = style === 'bat' ? batWing(l, h) : style === 'bug' ? bugWing(l, h) : featherWing(l, h);
    return {
      details: [1, -1].flatMap((sx) => {
        const place = { o: [sx * s.p[0], s.p[1], s.p[2]], x: norm3([sx * 0.85, raise, -0.25]), y: norm3([0, 0.15, 1]), z: norm3([0, 1, -0.15]) };
        const out = [plate(s.bone, c, shape, h * 0.06, place, { c1: c1 ?? lighter(c, 0.4) })];
        if (style === 'bug') out.push(plate(s.bone, c, bugWing(l * 0.75, h * 0.7), h * 0.05, { ...place, o: add3(place.o, [0, -h * 0.15, -h * 0.25]), x: norm3([sx * 0.9, raise * 0.4, -0.55]) }, { c1: c1 ?? lighter(c, 0.4) }));
        return out.map((d) => ({ ...d, glow }));
      }),
    };
  },
  /** A ruff of spikes round the neck. */
  mane(A, { c = 0x3A2A1A, c1, n = 7, len = 0.35, r = 0.06 } = {}) {
    const p = A.neck.p, R = (A.body.r[0] || 0.2) * 1.05;
    return {
      details: Array.from({ length: n }, (_, i) => {
        const th = Math.PI * (-0.1 + 1.2 * i / (n - 1));
        const d = [Math.cos(th), Math.sin(th) * 0.9 + 0.3, -0.55];
        const a = add3(p, [Math.cos(th) * R, Math.sin(th) * R * 0.8, 0]);
        return horn(A.neck.bone, c, a, add3(a, norm3(d).map((v) => v * len)), r, { c1: c1 ?? lighter(c, 0.35) });
      }),
    };
  },
  /** Spikes down the spine. */
  spikes(A, { c = 0x5A4A3A, c1, n = 5, len = 0.22, r = 0.05, crystal: cr = false, glow = 0 } = {}) {
    const B = backPoints(A, n, 0.05, 0.9);
    return { details: B.map((b, i) => cr ? crystal(b.bone, c, b.p, norm3([0, 1, -0.35]), len * (0.7 + Math.sin(Math.PI * b.t) * 0.5), r, { c1, glow }) : horn(b.bone, c, b.p, add3(b.p, norm3([0, 1, -0.4]).map((v) => v * len * (0.7 + Math.sin(Math.PI * b.t) * 0.5))), r, { c1: c1 ?? lighter(c, 0.4) })) };
  },
  /** A halo over the head. */
  halo(A, { c = 0xFFE07A, R = 0.55, r = 0.06, tilt = -0.25, glow = 1 } = {}) {
    const h = A.head;
    return { details: [{ ...ring('head', c, add3(A.crown, [0, h.r * 0.35, -h.r * 0.15]), h.r * R, h.r * r, [tilt, 0, 0]), glow }] };
  },
  /** Dark smoke rising off the back: shadow flames. */
  wisps(A, { n = 3, len = 0.3, c = 0x6A4AA8, c1 = 0x1A1030, glow = 0.5 } = {}) {
    const out = backPoints(A, n, 0.2, 0.85).map((b) => flame(b.bone, b.p, [0, 1, -0.6], len, 0.07, { c, c1, glow }));
    if (A.tail) out.push(flame(A.tail.bone, A.tail.p, [0, 1, -0.5], len * 1.1, 0.08, { c, c1, glow }));
    return { details: out };
  },
  /** A crescent on the brow. */
  crescentMark(A, { c = 0xFFE58A, size = 0.35, glow = 0.6 } = {}) {
    const h = A.head;
    return { details: [{ ...plate('head', c, crescent(h.r * size), h.r * 0.05, { o: add3(A.brow, [0, 0, h.r * 0.05]), x: [1, 0, 0], y: [0, 1, 0], z: norm3([0, 0.3, 1]) }), glow }] };
  },
  /** Stripes across the body. */
  stripes(A, { c = 0x2A1A0A, n = 4, w = 0.035 } = {}) {
    const b = A.body;
    if (A.kind === 'serpent') return { parts: backPoints(A, n, 0.15, 0.85).map((x) => paint(c, S(x.bone, 0, x.p, x.r * 0.9), 0.01)) };
    return { parts: Array.from({ length: n }, (_, i) => { const z = b.c[2] + b.r[2] * (0.55 - 1.1 * i / Math.max(1, n - 1)); return paint(c, E(b.bone, 0, [0, b.c[1] + b.r[1] * 0.35, z], [b.r[0] * 1.06, b.r[1] * 0.75, w]), 0.012); }) };
  },
  /** Spots over the body. */
  spots(A, { c = 0xFFFFFF, n = 6, r = 0.05 } = {}) {
    const b = A.body;
    return { parts: Array.from({ length: n }, (_, i) => { const a = i * 2.39, h = ((i * 37) % 10) / 10 - 0.3; return paint(c, S(b.bone, 0, [b.c[0] + Math.cos(a) * b.r[0] * 0.95, b.c[1] + b.r[1] * (0.2 + h * 0.6), b.c[2] + Math.sin(a) * b.r[2] * 0.75], r), 0.012); }) };
  },
  /** Fluffy puffs about the body: a cloud, a fleece, snow. */
  puffs(A, { c = 0xFFFFFF, n = 6, r = 0.6 } = {}) {
    const b = A.body, R = Math.min(b.r[0], b.r[1]) * r;
    return { parts: Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return S(b.bone, c, [b.c[0] + Math.cos(a) * b.r[0] * 0.75, b.c[1] + b.r[1] * (0.35 + (i % 2) * 0.25), b.c[2] + Math.sin(a) * b.r[2] * 0.7], R, 0.07); }) };
  },
  /** Tentacles hanging from under a round body. */
  tentacles(A, { c = 0x6A5AC8, n = 5, len = 0.5, glow = 0 } = {}) {
    const b = A.body, y0 = b.c[1] - b.r[1] * 0.55;
    return {
      details: Array.from({ length: n }, (_, i) => {
        const a = i / n * Math.PI * 2 + 0.3, x = Math.cos(a) * b.r[0] * 0.55, z = Math.sin(a) * b.r[2] * 0.55;
        const p0 = [x, y0, z], p1 = [x * 1.6, Math.max(0.04, y0 - len * b.r[1]), z * 1.6 - b.r[2] * 0.2];
        return { ...tube(b.bone, c, p0, p1, b.r[0] * 0.14, { taper: 0.35, bend: [x * 0.4, 0.05, -0.08] }), glow };
      }),
    };
  },
  /** A lure on a stalk over the head (an angler's lamp, a lantern). */
  lantern(A, { c = 0x3A3A3A, light = 0xFFF27A, len = 1.1, glow = 1 } = {}) {
    const h = A.head, a = add3(A.crown, [0, -h.r * 0.05, -h.r * 0.1]), b = add3(a, [0, h.r * len * 0.75, h.r * len * 0.65]);
    return { details: [tube('head', c, a, b, h.r * 0.05, { taper: 0.7, bend: [0, 0.1, 0.02] }), ball('head', light, add3(b, [0, -h.r * 0.12, h.r * 0.05]), h.r * 0.2, { glow })] };
  },
  /** A band across the eyes: a visor, a mask. */
  visor(A, { c = 0x2A3A4A, glow = 0 } = {}) {
    const h = A.head;
    return { parts: [paint(c, E('head', 0, add3(h.c, [0, h.r * 0.08, h.r * 0.55]), [h.r * 1.0, h.r * 0.22, h.r * 0.55]), 0.015, { glow })] };
  },
  /** A chimney on the back, with a glow in it. */
  chimney(A, { c = 0x4A4A52, glow = 0xFF8A3A } = {}) {
    const B = backPoints(A, 1, 0.3, 0.3)[0], top = add3(B.p, [0, 0.32, -0.05]);
    return { details: [tube(B.bone, c, B.p, top, 0.075, { taper: 1.15, sides: 8 }), ring(B.bone, darker(c, 0.7), top, 0.085, 0.02, [0, 0, 0]), ball(B.bone, glow, add3(top, [0, -0.02, 0]), 0.055, { glow: 1 })] };
  },
  /** Two magnets for arms (red and silver). */
  magnets(A, { size = 0.3 } = {}) {
    const s = A.shoulder;
    return {
      details: [1, -1].flatMap((sx) => {
        const o = [sx * (s.p[0] + 0.05), s.p[1] - 0.05, s.p[2] + 0.18];
        return [
          tube(s.bone, 0xD8DEE6, o, add3(o, [sx * size * 0.6, -size * 0.2, 0]), size * 0.12, { c1: 0xFF4A4A }),
          ring(s.bone, 0xFF4A4A, add3(o, [sx * size * 0.75, -size * 0.25, 0]), size * 0.22, size * 0.07, [Math.PI / 2, 0, 0]),
        ];
      }),
    };
  },
  /** A clock face on the brow. */
  clock(A, { c = 0xF2E0B0, hand = 0x2A1A0A } = {}) {
    const h = A.head, o = add3(A.brow, [0, -h.r * 0.05, h.r * 0.02]);
    return {
      details: [
        ring('head', 0xC8A050, o, h.r * 0.32, h.r * 0.05, [Math.PI / 2 - 0.3, 0, 0]),
        ball('head', c, o, h.r * 0.28, { sy: 0.3 }),
        horn('head', hand, add3(o, [0, 0, h.r * 0.09]), add3(o, [0, h.r * 0.22, h.r * 0.1]), h.r * 0.03),
        horn('head', hand, add3(o, [0, 0, h.r * 0.09]), add3(o, [h.r * 0.15, -h.r * 0.05, h.r * 0.1]), h.r * 0.03),
      ],
    };
  },
  /** A tuft of fluff on the crown. */
  tuft(A, { c = 0xFFFFFF, n = 3, len = 0.45 } = {}) {
    const h = A.head;
    return { details: Array.from({ length: n }, (_, i) => { const a = (i - (n - 1) / 2) * 0.45; return horn('head', c, A.crown, add3(A.crown, [Math.sin(a) * h.r * 0.4, h.r * len, -h.r * 0.25]), h.r * 0.1, { bend: [0, 0.02, -0.03] }); }) };
  },
  /** Seeds on stalks all round: a dandelion clock. */
  seeds(A, { c = 0xFFFFFF, n = 14, len = 0.55 } = {}) {
    const h = A.head;
    return { details: Array.from({ length: n }, (_, i) => { const u = (i + 0.5) / n * 2 - 1, r = Math.sqrt(1 - u * u), a = i * 2.4; const d = [Math.cos(a) * r, Math.abs(u) * 0.8 + 0.2, Math.sin(a) * r]; return tube('head', c, h.c, add3(h.c, d.map((v) => v * h.r * (1 + len))), h.r * 0.03, { taper: 0.4, c1: 0xFFF3C0 }); }) };
  },
  /** Big ears (a fox's, a bat's): plates up off the crown. */
  ears(A, { c = 0x3A2A1A, c1, len = 0.9, w = 0.45, style = 'leaf' } = {}) {
    const h = A.head;
    return {
      details: [1, -1].map((sx) => plate('head', c, style === 'bat' ? batWing(h.r * len, h.r * w) : leafShape(h.r * len, h.r * w), h.r * 0.05,
        { o: add3(A.crown, [sx * h.r * 0.42, -h.r * 0.2, 0]), x: norm3([sx * 0.45, 1, -0.15]), y: norm3([0, 0.1, 1]), z: [sx, 0, 0] }, { c1: c1 ?? lighter(c, 0.5) })),
    };
  },
  /** A stinger or spear at the tail's end. */
  tailBlade(A, { c = 0xD8DEE6, c1 = 0xFFFFFF, len = 0.3 } = {}) {
    if (!A.tail) return {};
    const t = A.tail.p;
    return { details: [crystal(A.tail.bone, c, t, [0, 0.35, -1], len, len * 0.22, { c1 })] };
  },
};

// -- the designs ---------------------------------------------------------------
const PLANS = { quad, blob, biped, bird, serpent };
/** A body from its plan and proportions, and the kit pieces on it. */
function design(kind, o, kit = [], extra = {}) {
  const base = PLANS[kind](o);
  const A = anchors(base, kind);
  let d = make(base, extra);
  for (const [name, opts] of kit) {
    const piece = KIT[name](A, opts || {});
    d = make(d, piece);
  }
  return d;
}

const EMBER = FIRE, DARK = { c: 0x9A6AFF, c1: 0x1A1030, glow: 0.55 }, BLUEFIRE = { c: 0xBDF4FF, c1: 0x3A8AFF, glow: 0.8 }, GOLDFIRE = { c: 0xFFF2A0, c1: 0xFFB43A, glow: 0.9 };

export const MORE_FIGURINES = {
  // ------------------------------------------------------------------ ember
  // A puppy with a coal for a heart: a flame at the tail, ember freckles.
  kindlepup: design('quad', { size: 1.3, a: 0xF0783A, b: 0xFFE2B8, paw: 0x6A3A20, len: 0.55, wide: 0.22, deep: 0.2, y: 0.32, head: 0.34, legR: 0.07,
    ear: { len: 0.55, r: 0.3, spread: 0.45, tilt: 0.1, x: 0.55, inner: 0xB8322A }, tail: { len: 0.22, rise: 0.3, r: 0.06, segs: 2 }, iris: 0x3A1A0A },
  [['flameTail', { len: 0.28, r: 0.08 }], ['glowSpots', { c: 0xFFC43A, n: 4 }]]),
  // Grown into a hound of the canyon: a mane of fire, a long flaming tail.
  blazehound: design('quad', { size: 2.6, a: 0xD9481E, b: 0xFFD39A, paw: 0x3A1A0A, len: 0.92, wide: 0.22, deep: 0.21, y: 0.55, head: 0.26, neck: true, legR: 0.08,
    ear: { len: 0.7, r: 0.3, spread: 0.3, tilt: 0.3, x: 0.5, c: 0x7A2A10, inner: 0xFF8A3A }, muzzle: { w: 0.4, h: 0.28, l: 0.5 }, tail: { len: 0.6, rise: 0.25, r: 0.08, segs: 3, taper: 0.25 }, iris: 0xFFC43A, blush: false },
  [['flameCrown', { n: 5, len: 0.6 }], ['flameBack', { n: 3, len: 0.25 }], ['flameTail', { len: 0.4, r: 0.1 }], ['stripes', { c: 0x7A2A10, n: 3 }]]),
  // A moth that drinks heat: ash-grey fur, wings with burning eyes on them.
  cindermoth: design('biped', { size: 1.2, a: 0x8A5A48, b: 0xFFB45A, bodyC: 0x6A4A3A, head: 0.3, body: 0.24, leg: 0.12, arm: 0.16, iris: 0xFFE07A, eye: 0.3, belly: 0xFFB45A },
  [['wings', { style: 'bug', c: 0xFF8A3A, c1: 0xFFE07A, l: 0.55, h: 0.3, raise: 0.9, glow: 0.2 }], ['antennae', { c: 0x4A2A1A, tip: 0xFFB43A }], ['tuft', { c: 0xFFE0C0 }]]),
  // Its wings caught: a firebird with a trailing tail of flame.
  pyrewing: design('bird', { size: 2.3, a: 0xE8502A, b: 0xFFD27A, body: 0.3, head: 0.24, flies: true, wingC: 0xFF6A2A, wingC1: 0xFFD27A, beakC: 0xFFC43A, legC: 0x3A1A0A, iris: 0x2A1008, tailN: 5, tailL: 0.5, tailC: 0xFF8A3A, tailC1: 0xFFE07A, belly: 0xFFD27A },
  [['flameCrown', { n: 3, len: 0.7 }], ['flameTail', { len: 0.45, r: 0.12 }]]),
  // A mole of the lava fields: a stone snout, magma in the cracks of its back.
  magmole: design('quad', { size: 1.4, a: 0x6A4A40, b: 0xFF8A3A, paw: 0xFFB45A, len: 0.6, wide: 0.3, deep: 0.25, y: 0.28, head: 0.27, legR: 0.08, stance: 0.24,
    muzzle: { w: 0.3, h: 0.24, l: 0.6, out: 0.8, c: 0x4A3430 }, noseC: 0xFF5A2A, tail: { len: 0.06, rise: 0.04, r: 0.05, segs: 1 }, iris: 0x1A0A06, eye: 0.17, blush: false },
  [['glowSpots', { c: 0xFF6A1F, n: 6, r: 0.045 }], ['spikes', { c: 0x3A2A24, n: 4, len: 0.14, r: 0.04 }]]),
  // A volcano on legs: a crater on its back that smokes and glows.
  calderox: design('quad', { size: 3.2, a: 0x4E3C36, b: 0xFF6A1F, paw: 0x2A1E1A, len: 1.0, wide: 0.38, deep: 0.33, y: 0.58, head: 0.27, neck: true, legR: 0.14, stance: 0.28,
    muzzle: { w: 0.55, h: 0.36, l: 0.46, c: 0x3A2E2A }, tail: { len: 0.4, rise: 0.08, r: 0.12, segs: 2 }, iris: 0xFFB43A, blush: false, mask: false },
  [['horns', { c: 0x2A1E1A, c1: 0xFF8A3A, len: 0.7, spread: 0.6 }], ['chimney', { c: 0x3A2E2A, glow: 0xFF6A1F }], ['glowSpots', { c: 0xFF6A1F, n: 5 }], ['tusks', { c: 0xFFE0B0 }]]),
  // The sun's own bird: gold and fire, a halo of light. Seen in the ash, once.
  ignivar: design('bird', { size: 3.6, a: 0xFFC43A, b: 0xFFF2C0, body: 0.32, head: 0.24, flies: true, wingC: 0xE8301A, wingC1: 0xFFE07A, wing: 0.75, wingH: 0.42, beakC: 0xFFD23D, legC: 0x6A2A10, iris: 0xFFF2C0, tailN: 7, tailL: 0.7, tailC: 0xFF8A3A, tailC1: 0xFFF2A0, belly: 0xFFE58A, blush: false },
  [['flameCrown', { n: 5, len: 0.9, fire: GOLDFIRE }], ['halo', { c: 0xFFE07A }], ['flameTail', { len: 0.6, r: 0.14, fire: GOLDFIRE }]], { lookK: 0.6 }),

  // ------------------------------------------------------------------- aqua
  ripplet: design('blob', { size: 1.0, a: 0x5EC8F2, b: 0xD8F4FF, r: 0.42, iris: 0x123A5F, fins: true, eye: 0.24 }, [['tuft', { c: 0x9ADCF8, n: 1, len: 0.5 }], ['spots', { c: 0xBDEAFF, n: 4, r: 0.06 }]]),
  // A toad that carries a pond: mossy and wide, water pouring down its back.
  torrentoad: design('quad', { size: 2.2, a: 0x2E8FB8, b: 0xBDEAD0, paw: 0x1E6A8A, len: 0.62, wide: 0.42, deep: 0.3, y: 0.34, head: 0.33, legR: 0.12, stance: 0.36,
    muzzle: { w: 0.7, h: 0.28, l: 0.3, drop: 0.3 }, nose: false, iris: 0xFFD24A, eye: 0.26, eyeY: 0.45, blush: false },
  [['spots', { c: 0x1E6A8A, n: 7, r: 0.06 }], ['shell', { c: 0x4FA858, c1: 0x9AEA80, r: 0.3, rings: 2 }], ['finSides', { size: 0.26 }]]),
  // A koi with a long veil of a tail.
  koiren: design('serpent', { size: 1.4, a: 0xFF8A4A, len: 1.1, r: 0.15, head: 0.2, segs: 6, belly: 0xFFF2E6, iris: 0x1A1A2A, lift: 0.35, taper: 0.6 },
  [['spots', { c: 0xFFFFFF, n: 4, r: 0.07 }], ['finSides', { c: 0xFFB47A, c1: 0xFFF2E6, size: 0.22 }], ['finBack', { c: 0xFF8A4A, c1: 0xFFE0C8 }]]),
  // The koi that leapt the falls: a golden dragon-fish with a pearl.
  koimperor: design('serpent', { size: 3.2, a: 0xFFB43A, len: 1.8, r: 0.18, head: 0.24, segs: 8, belly: 0xFFF6E0, iris: 0x2A1A0A, lift: 0.6, taper: 0.62 },
  [['horns', { c: 0xFFE07A, c1: 0xFFFFFF, len: 0.9, spread: 0.3, back: 0.8 }], ['finBack', { c: 0xFF8A2A, c1: 0xFFE07A, h: 0.35 }], ['finSides', { c: 0xFFD27A, c1: 0xFFFFFF, size: 0.32 }], ['orbs', { c: 0xF2FAFF, n: 1, r: 0.18 }]], { lookK: 0.6 }),
  // A bubble with a face that floats on the breeze.
  bubbloon: design('blob', { size: 1.0, a: 0x9ADCF8, b: 0xF0FAFF, r: 0.45, iris: 0x2A5A8A, feet: false, eye: 0.2, tall: 1.0 },
  [['orbs', { c: 0xD8F4FF, n: 4, r: 0.1, glow: 0.3 }], ['tuft', { c: 0xBDEAFF, n: 2, len: 0.35 }]], { floats: true }),
  // A lizard grown over with coral, branches of it down its back.
  coralisk: design('quad', { size: 2.0, a: 0xFF7A8A, b: 0xFFE2E0, paw: 0xC84A5A, len: 0.82, wide: 0.24, deep: 0.17, y: 0.26, head: 0.24, legR: 0.07, stance: 0.24,
    muzzle: { w: 0.5, h: 0.28, l: 0.4 }, tail: { len: 0.6, rise: 0.05, r: 0.1, segs: 3, taper: 0.26 }, iris: 0x2A0A1A, nose: false, blushC: 0xFFB0C0 },
  [['crystals', { c: 0xFF5A7A, c1: 0xFFE0E8, n: 6, len: 0.3, r: 0.05, glow: 0.15 }], ['spots', { c: 0xFFF0F0, n: 6 }]]),
  // Ink-dark, with lights along its arms: what lives under the tide.
  abyssquid: design('blob', { size: 1.5, a: 0x3A3A8A, b: 0x7A6AD8, r: 0.38, iris: 0x2AB8E8, feet: false, tall: 1.25, y: 0.55, eye: 0.26, blush: false },
  [['tentacles', { c: 0x3A3A8A, n: 6, len: 0.9, glow: 0.1 }], ['glowSpots', { c: 0x9AF0FF, n: 4, r: 0.03 }], ['finSides', { c: 0x4A4AA8, c1: 0x9A8AFF, size: 0.24 }]]),

  // ---------------------------------------------------------------- verdant
  acornet: design('blob', { size: 0.9, a: 0xB0783A, b: 0xF2D9A8, r: 0.4, iris: 0x2A1A0A, eye: 0.22, tall: 1.05 },
  [['cap', { c: 0x7A5230, spot: 0x9A6A40, w: 1.1, h: 0.42, n: 0 }], ['tuft', { c: 0x6A4A28, n: 1, len: 0.4 }], ['leafCrown', { n: 1, len: 0.8 }]]),
  // A sapling on two legs, with a crown of new leaves.
  oakling: design('biped', { size: 1.6, a: 0x8A6A44, b: 0x6A5236, bodyC: 0x7A5A3A, head: 0.3, body: 0.26, leg: 0.16, arm: 0.28, armR: 0.07, iris: 0x2A1A0A, belly: 0xB08A5E, blush: false },
  [['leafCrown', { n: 5, len: 1.0, w: 0.25 }], ['stripes', { c: 0x5A4228, n: 3 }], ['leafBack', { n: 2, len: 0.22 }]]),
  // The old tree that walks: a stag of oak, with a canopy for antlers.
  grovenard: design('quad', { size: 3.6, a: 0x6A5236, b: 0xA88A5E, paw: 0x3A2A1A, len: 1.05, wide: 0.32, deep: 0.3, y: 0.68, head: 0.25, neck: true, legR: 0.11, stance: 0.26,
    muzzle: { w: 0.45, h: 0.3, l: 0.5, c: 0x8A6A44 }, tail: { len: 0.12, rise: 0.12, r: 0.07, segs: 1 }, iris: 0xFFD24A, blush: false, ear: { len: 0.4, r: 0.22, spread: 0.9, tilt: 0.05, y: 0.35, x: 0.7, c: 0x5BC76A, inner: false } },
  [['horns', { c: 0x5A4228, c1: 0x8A6A44, len: 1.4, spread: 0.9, back: 0.35, r: 0.13 }], ['leafCrown', { n: 5, len: 1.4, w: 0.3 }], ['leafBack', { n: 5, len: 0.36, w: 0.1 }], ['flower', { c: 0xFFF2A0, n: 5, size: 0.35, centre: 0xFF8A3A }]], { lookK: 0.6 }),
  // Petals for wings: a little bird that is half a flower.
  petalfly: design('bird', { size: 1.0, a: 0xFF9CC8, b: 0xFFF0F6, body: 0.26, head: 0.24, flies: true, wingC: 0xFF8AC8, wingC1: 0xFFF0F6, wingShape: (l, h) => heartShape(l * 0.85), beakC: 0xFFD23D, legC: 0x4FA858, iris: 0x2A1A2A, tailN: 3, tailC: 0x5BC76A, tailC1: 0xA8EE8A },
  [['flower', { c: 0xFFB0D8, n: 5, size: 0.5 }]]),
  mushlet: design('blob', { size: 0.95, a: 0xFFF0E0, b: 0xFFF6EE, r: 0.36, iris: 0x2A1A1A, eye: 0.22, tall: 1.1 },
  [['cap', { c: 0x4A5ACF, spot: 0x9AF0FF, w: 1.5, h: 0.6, n: 5 }], ['glowSpots', { c: 0x9AF0FF, n: 1, r: 0.05 }]]),
  // The mushroom king of the grove: a towering cap, a cloak of spores.
  sporeking: design('biped', { size: 1.9, a: 0xE8E4F0, b: 0x2E3A9A, bodyC: 0x3A2A6A, head: 0.27, body: 0.28, leg: 0.14, arm: 0.26, iris: 0xFFD24A, belly: 0xFFE8D8, blush: false },
  [['cap', { c: 0x2E3A9A, spot: 0x9AF0FF, w: 1.9, h: 0.75, n: 8 }], ['orbs', { c: 0x9AF0FF, n: 4, r: 0.08, glow: 0.8 }], ['spots', { c: 0x9AF0FF, n: 4 }]]),
  // A vine that learned to slither, a flower for a head-crest.
  lianake: design('serpent', { size: 1.6, a: 0x4FA858, len: 1.3, r: 0.12, head: 0.19, segs: 7, belly: 0xD8F2B0, iris: 0x2A1A0A, pose: 'ground', lift: 0.45 },
  [['leafBack', { n: 4, len: 0.2, w: 0.06 }], ['flower', { c: 0xFF6A8A, n: 5, size: 0.45 }]]),

  // ------------------------------------------------------------------- volt
  // A squirrel of the storm-fields: teal fur, a bushy tail that crackles
  // along its length, and a coil on its head that hums before it strikes.
  voltail: design('quad', { size: 1.2, a: 0x2EB8B0, b: 0xE8FFF8, paw: 0x1E6A66, len: 0.5, wide: 0.21, deep: 0.2, y: 0.3, head: 0.32, legR: 0.06,
    ear: { len: 0.4, r: 0.32, spread: 0.6, tilt: 0.05, x: 0.58, inner: 0xFFE05A }, tail: { len: 0.4, rise: 0.55, r: 0.14, segs: 3, taper: 0.05, hook: 0.15 }, iris: 0x123A3A, cheek: 0x5ADCD0 },
  [['antennae', { c: 0x1E6A66, tip: 0xFFE05A, len: 0.7, glow: 1 }], ['glowSpots', { c: 0xFFE05A, n: 4, r: 0.03, glow: 1 }]]),
  // A boar of the storm: tusks that crackle, a crest of lightning.
  joltusk: design('quad', { size: 2.5, a: 0x3A4458, b: 0x2EB8B0, paw: 0x1A1E2A, len: 0.85, wide: 0.3, deep: 0.28, y: 0.5, head: 0.3, legR: 0.1, stance: 0.26,
    muzzle: { w: 0.5, h: 0.34, l: 0.46, c: 0x5A6478 }, noseC: 0x1A1A24, tail: { len: 0.2, rise: 0.2, r: 0.05, segs: 2 }, iris: 0x9AE8FF, blush: false, ear: { len: 0.45, r: 0.28, spread: 0.8, tilt: 0.1, x: 0.6, inner: 0x2EB8B0 } },
  [['tusks', { c: 0xBDF4FF, len: 0.5 }], ['spikes', { c: 0xFFE05A, c1: 0xFFFFFF, n: 5, len: 0.24, r: 0.05, crystal: true, glow: 0.6 }], ['bolt', { at: 'tail', size: 0.3 }]]),
  // A beetle with a coil for a back and sparks for eyes.
  fluxbug: design('blob', { size: 1.0, a: 0x5A6A8A, b: 0xFFE05A, r: 0.36, iris: 0x1A6A8A, eye: 0.22, tall: 0.85, wide: 1.15 },
  [['shell', { c: 0x4A5A7A, c1: 0xFFE05A, r: 0.3, rings: 3 }], ['antennae', { c: 0x2A3A5A, tip: 0x9AF0FF }], ['wings', { style: 'bug', c: 0xBDF4FF, c1: 0xFFFFFF, l: 0.35, h: 0.2, raise: 0.4, glow: 0.3 }]]),
  stormkite: design('bird', { size: 1.4, a: 0x4A5AB8, b: 0xFFE05A, body: 0.26, head: 0.22, flies: true, wingC: 0x3A4AA8, wingC1: 0xFFE05A, beakC: 0xFFE05A, legC: 0x2A2A4A, iris: 0xFFF2A0, tailN: 3, tailC: 0xFFE05A, belly: 0xD8E0FF },
  [['bolt', { at: 'head' }]]),
  // The storm-bird grown: wings that carry the thunderhead.
  tempestral: design('bird', { size: 3.0, a: 0x2E3A8A, b: 0xFFD23D, body: 0.32, head: 0.24, flies: true, wing: 0.8, wingH: 0.42, wingC: 0x1E2A6A, wingC1: 0xFFE05A, beakC: 0xFFD23D, legC: 0x1A1A3A, iris: 0xFFF2A0, tailN: 5, tailL: 0.55, tailC: 0xFFD23D, tailC1: 0xFFF6C0, belly: 0xC8D0FF, blush: false },
  [['bolt', { at: 'head' }], ['tuft', { c: 0xFFE05A, n: 3, len: 0.6 }], ['orbs', { c: 0xFFF27A, n: 2, r: 0.08 }]], { lookK: 0.6 }),
  // A serpent wound like a coil, sparks running down its rings.
  coilwyrm: design('serpent', { size: 2.4, a: 0x3A4AA8, len: 1.6, r: 0.15, head: 0.21, segs: 8, belly: 0xFFE05A, iris: 0xFFF6C0, pose: 'ground', lift: 0.55, wave: 1.8, sway: 0.2 },
  [['stripes', { c: 0xFFE05A, n: 5 }], ['bolt', { at: 'head' }], ['tailBlade', { c: 0xFFE05A, c1: 0xFFFFFF, len: 0.28 }]], { eyeStyle: 2 }),
  plasmite: design('blob', { size: 0.95, a: 0xB88AFF, b: 0xF2E6FF, r: 0.4, iris: 0x3A1A6A, feet: false, eye: 0.24 },
  [['orbs', { c: 0xF2E6FF, n: 4, r: 0.1, glow: 1 }], ['crystalCrown', { c: 0xD8C0FF, n: 1, len: 0.6, glow: 0.8 }]], { floats: true, eyeStyle: 2, eyeGlow: 0.2 }),

  // ------------------------------------------------------------------ terra
  dustmole: design('quad', { size: 1.25, a: 0xA8845E, b: 0xE8D2B0, paw: 0xFFC8A8, len: 0.56, wide: 0.28, deep: 0.24, y: 0.27, head: 0.28, legR: 0.08, stance: 0.24,
    muzzle: { w: 0.28, h: 0.22, l: 0.55, out: 0.82, c: 0xFFC8A8 }, noseC: 0xFF7A8A, tail: { len: 0.05, rise: 0.04, r: 0.04, segs: 1 }, iris: 0x1A0A06, eye: 0.15 },
  [['tusks', { c: 0xFFFFFF, len: 0.2 }], ['spots', { c: 0x8A6A4A, n: 4 }]]),
  // The mole grown into a digger of the deep: iron claws and a drill for a nose.
  tunnelord: design('quad', { size: 2.6, a: 0x8A6A4A, b: 0xB8B8C0, paw: 0x6A6A74, len: 0.88, wide: 0.36, deep: 0.3, y: 0.42, head: 0.28, legR: 0.12, stance: 0.3,
    muzzle: { w: 0.3, h: 0.26, l: 0.6, out: 0.8, c: 0x6A6A74 }, nose: false, tail: { len: 0.1, rise: 0.05, r: 0.06, segs: 1 }, iris: 0xFFC43A, eye: 0.16, blush: false },
  [['horn1', { c: 0x8A8A94, c1: 0xE8ECF2, len: 0.75, r: 0.2 }], ['spikes', { c: 0x6A6A74, c1: 0xD8DEE6, n: 5, len: 0.18, r: 0.05 }], ['glowSpots', { c: 0xFFC43A, n: 3, glow: 0.4 }]]),
  // A little figure of wet clay, still with the potter's thumbprints.
  clayling: design('biped', { size: 1.2, a: 0xC87A5A, b: 0xF2C8A8, bodyC: 0xC87A5A, head: 0.3, body: 0.28, leg: 0.12, arm: 0.2, armR: 0.09, iris: 0x2A1A0A, belly: 0xF2C8A8, blush: false },
  [['spots', { c: 0xA85A3A, n: 5, r: 0.05 }], ['tuft', { c: 0x8A4A2A, n: 2, len: 0.3 }]]),
  // Fired in the kiln of the mesa: a terracotta giant with a glaze of gold.
  terracolos: design('biped', { size: 2.8, a: 0xA85A3A, b: 0xE8B08A, bodyC: 0xA85A3A, head: 0.26, body: 0.36, leg: 0.2, arm: 0.42, armR: 0.13, hand: 1.35, iris: 0xFFD24A, belly: 0xE8B08A, blush: false, wide: 1.15 },
  [['stripes', { c: 0xFFD24A, n: 3 }], ['crystalCrown', { c: 0xE8A040, c1: 0xFFE8A8, n: 3, len: 0.5, glow: 0.2 }], ['spikes', { c: 0x8A4A2A, n: 3, len: 0.2 }]], { lookK: 0.6, eyeStyle: 2 }),
  sandviper: design('serpent', { size: 1.5, a: 0xE0C080, len: 1.3, r: 0.12, head: 0.18, segs: 7, belly: 0xFFF0D0, iris: 0x2A1A0A, pose: 'ground', lift: 0.35, sway: 0.18 },
  [['stripes', { c: 0xA88040, n: 5 }], ['horns', { c: 0xA88040, len: 0.35, spread: 0.3, back: 0.4, r: 0.12 }]]),
  // A rhino with a geode for a horn and amethyst down its back.
  geodon: design('quad', { size: 2.6, a: 0x7A7068, b: 0xB89AFF, paw: 0x4A423C, len: 0.95, wide: 0.36, deep: 0.32, y: 0.48, head: 0.28, legR: 0.13, stance: 0.28,
    muzzle: { w: 0.5, h: 0.34, l: 0.5, c: 0x8A8078 }, tail: { len: 0.15, rise: 0.08, r: 0.05, segs: 1 }, iris: 0xE8D8FF, blush: false, ear: { len: 0.3, r: 0.22, spread: 0.6, tilt: 0.1, y: 0.4, x: 0.6, inner: 0xB89AFF } },
  [['horn1', { c: 0xA86AE8, c1: 0xF2E0FF, len: 0.9, r: 0.16, glow: 0.4 }], ['crystals', { c: 0xA86AE8, c1: 0xF2E0FF, n: 5, len: 0.3 }]]),
  // A fox kept in amber: honey-gold, with old light caught in its tail.
  amberix: design('quad', { size: 1.8, a: 0xE8A040, b: 0xFFE8A8, paw: 0x6A3A10, len: 0.72, wide: 0.2, deep: 0.19, y: 0.42, head: 0.28, legR: 0.06,
    ear: { len: 0.9, r: 0.3, spread: 0.4, tilt: 0.2, x: 0.5, inner: 0xFFE8A8, tipC: 0x6A3A10 }, tail: { len: 0.6, rise: 0.35, r: 0.12, segs: 3, taper: 0.15, tipC: 0xFFF2C0 }, iris: 0x3A1A06 },
  [['crystalCrown', { c: 0xFFB43A, c1: 0xFFF2C0, n: 1, len: 0.55, glow: 0.6 }], ['orbs', { c: 0xFFE07A, n: 2, r: 0.07 }]]),

  // ------------------------------------------------------------------- gale
  puffwing: design('bird', { size: 0.95, a: 0xBDE8F0, b: 0xFFFFFF, body: 0.3, head: 0.25, wingC: 0xFFFFFF, wingC1: 0xBDE8F0, beakC: 0xFFB23A, legC: 0xFFA03A, iris: 0x1A2A3A, tailN: 3, belly: 0xFFFFFF },
  [['tuft', { c: 0xFFFFFF, n: 3 }], ['puffs', { c: 0xFFFFFF, n: 5, r: 0.5 }]]),
  galeon: design('bird', { size: 1.9, a: 0x7AC8E0, b: 0xF2FAFF, body: 0.3, head: 0.23, flies: true, wingC: 0x5AB8D8, wingC1: 0xF2FAFF, beakC: 0xFFC43A, legC: 0x3A5A6A, iris: 0x1A2A3A, tailN: 5, tailL: 0.45, tailC: 0x5AB8D8, tailC1: 0xF2FAFF, belly: 0xF2FAFF },
  [['tuft', { c: 0x5AB8D8, n: 3, len: 0.55 }]]),
  // The great sky bird: wings like sails, a crest of storm.
  skyrender: design('bird', { size: 3.6, a: 0x3A8AC8, b: 0xE8F6FF, body: 0.33, head: 0.24, flies: true, wing: 0.9, wingH: 0.46, wingC: 0x2A7AB8, wingC1: 0xFFFFFF, beakC: 0xFFE05A, legC: 0x2A3A4A, iris: 0xFFE05A, tailN: 7, tailL: 0.6, tailC: 0x2A7AB8, tailC1: 0xE8F6FF, belly: 0xE8F6FF, blush: false },
  [['tuft', { c: 0xFFE05A, n: 3, len: 0.7 }], ['bolt', { at: 'head' }]], { lookK: 0.6 }),
  dandefluff: design('blob', { size: 1.0, a: 0xFFF6C0, b: 0xFFFFFF, r: 0.3, iris: 0x3A3A1A, feet: false, eye: 0.24, y: 0.55 },
  [['seeds', { n: 16, len: 0.75 }], ['leafCrown', { c: 0x5BC76A, n: 2, len: 0.7 }]], { floats: true }),
  // A weasel that spins: its long body whirls into a little tornado.
  whirlweasel: design('quad', { size: 1.4, a: 0xD8C8B0, b: 0xFFF8EE, paw: 0x8A7A64, len: 0.78, wide: 0.17, deep: 0.16, y: 0.25, head: 0.24, legR: 0.05,
    ear: { len: 0.35, r: 0.3, spread: 0.55, tilt: 0.05, x: 0.6, inner: 0xFFB0B8 }, tail: { len: 0.55, rise: 0.4, r: 0.08, segs: 3, taper: 0.1, hook: 0.1 }, iris: 0x2A1A0A },
  [['tuft', { c: 0x9AD8E8, n: 2, len: 0.4 }], ['wisps', { n: 1, len: 0.25, c: 0xE8F8FF, c1: 0x9AD8E8, glow: 0.2 }]]),
  cyclonix: design('quad', { size: 2.3, a: 0x9AB8C8, b: 0xF2FAFF, paw: 0x4A6A7A, len: 1.0, wide: 0.2, deep: 0.19, y: 0.4, head: 0.24, neck: true, legR: 0.06,
    ear: { len: 0.55, r: 0.28, spread: 0.6, tilt: 0.15, x: 0.55, inner: 0xFFB0B8 }, tail: { len: 0.85, rise: 0.45, r: 0.1, segs: 4, taper: 0.12, hook: 0.2 }, iris: 0x1A3A4A, blush: false },
  [['wings', { style: 'feather', c: 0xE8F8FF, c1: 0x9AD8E8, l: 0.45, h: 0.25, raise: 0.5 }], ['mane', { c: 0xE8F8FF, n: 7, len: 0.28 }], ['tailBlade', { c: 0xE8F8FF, c1: 0xFFFFFF, len: 0.3 }]]),
  // A manta of the clouds, gliding where the rain is.
  cloudray: design('serpent', { size: 2.6, a: 0xD8EEFF, len: 1.0, r: 0.2, head: 0.24, segs: 5, belly: 0xFFFFFF, iris: 0x2A4A6A, lift: 0.75, taper: 0.85, wave: 1.2 },
  [['wings', { style: 'feather', c: 0xFFFFFF, c1: 0xBDE4FF, l: 0.8, h: 0.4, raise: 0.05 }], ['puffs', { c: 0xFFFFFF, n: 4, r: 0.8 }]], { floats: true }),

  // ------------------------------------------------------------------ frost
  snowpip: design('bird', { size: 0.85, a: 0xF2F8FF, b: 0xBDE4FF, body: 0.3, head: 0.26, wingC: 0xBDE4FF, wingC1: 0xFFFFFF, beakC: 0xFF8A3A, legC: 0xFF8A3A, iris: 0x1A2A3A, tailN: 3, belly: 0xFFFFFF },
  [['crystalCrown', { c: 0xBDE4FF, n: 1, len: 0.5 }], ['puffs', { c: 0xFFFFFF, n: 4, r: 0.45 }]]),
  frostkit: design('quad', { size: 1.25, a: 0xD8F0FF, b: 0xFFFFFF, paw: 0x9AC8E8, len: 0.52, wide: 0.21, deep: 0.2, y: 0.32, head: 0.33, legR: 0.06,
    ear: { len: 0.8, r: 0.32, spread: 0.45, tilt: 0.15, x: 0.5, inner: 0x9AC8E8 }, tail: { len: 0.35, rise: 0.35, r: 0.11, segs: 2, taper: 0.05, tipC: 0xFFFFFF }, iris: 0x2A5A8A },
  [['crystalCrown', { c: 0x9AD8FF, n: 3, len: 0.45 }], ['puffs', { c: 0xFFFFFF, n: 4, r: 0.4 }]]),
  // The fox of the aurora: nine-pointed crystal crest, a tail of frozen light.
  glacivix: design('quad', { size: 2.4, a: 0xB8E2FF, b: 0xFFFFFF, paw: 0x6AA8D8, len: 0.85, wide: 0.21, deep: 0.2, y: 0.5, head: 0.27, neck: true, legR: 0.07,
    ear: { len: 0.95, r: 0.3, spread: 0.4, tilt: 0.25, x: 0.5, inner: 0x6AA8FF }, tail: { len: 0.75, rise: 0.4, r: 0.13, segs: 3, taper: 0.1 }, iris: 0x6AA8FF, blush: false },
  [['crystals', { c: 0x9AD8FF, c1: 0xFFFFFF, n: 5, len: 0.3, glow: 0.5 }], ['crystalCrown', { c: 0xBDE4FF, n: 3, len: 0.7, glow: 0.6 }], ['halo', { c: 0x9AF0FF, R: 0.5 }]], { lookK: 0.6 }),
  yetling: design('biped', { size: 1.3, a: 0xF2F6FF, b: 0x9AC8E8, bodyC: 0xF2F6FF, head: 0.3, body: 0.3, leg: 0.12, arm: 0.24, armR: 0.09, iris: 0x2A3A5A, belly: 0xDDEEFF, blushC: 0x9AC8FF },
  [['puffs', { c: 0xFFFFFF, n: 6, r: 0.5 }], ['horns', { c: 0x9AC8E8, c1: 0xFFFFFF, len: 0.4, spread: 0.4, back: 0.2, r: 0.12 }]]),
  // The yeti grown: a mountain of white fur with fists of ice.
  yetimaul: design('biped', { size: 3.0, a: 0xE8F0FF, b: 0x7AA8D8, bodyC: 0xE8F0FF, head: 0.26, body: 0.4, leg: 0.2, arm: 0.48, armR: 0.14, hand: 1.45, handC: 0x9AD8FF, iris: 0x3AC8FF, belly: 0xC8DCF2, blush: false, wide: 1.1 },
  [['puffs', { c: 0xFFFFFF, n: 7, r: 0.5 }], ['horns', { c: 0x7AA8D8, c1: 0xFFFFFF, len: 0.6, spread: 0.6, back: 0.3, r: 0.14 }], ['crystals', { c: 0x9AD8FF, n: 3, len: 0.3 }]], { lookK: 0.6, eyeStyle: 2 }),
  rimeserpent: design('serpent', { size: 2.6, a: 0xA8DCFF, len: 1.7, r: 0.16, head: 0.22, segs: 8, belly: 0xF2FAFF, iris: 0x2A5AAA, lift: 0.55 },
  [['spikes', { c: 0xBDE4FF, c1: 0xFFFFFF, n: 6, len: 0.22, r: 0.05, crystal: true, glow: 0.4 }], ['horns', { c: 0xFFFFFF, len: 0.6, spread: 0.3, back: 0.7, r: 0.12 }]], { eyeStyle: 2 }),
  flurrimp: design('blob', { size: 0.9, a: 0xFFFFFF, b: 0xC8E8FF, r: 0.4, iris: 0x2A4A8A, eye: 0.23, tall: 1.0 },
  [['puffs', { c: 0xFFFFFF, n: 5, r: 0.45 }], ['crystalCrown', { c: 0xBDE4FF, n: 3, len: 0.35 }]]),

  // ------------------------------------------------------------------ umbra
  shadepup: design('quad', { size: 1.25, a: 0x4A3A6A, b: 0x8A7AB8, paw: 0x2A2242, len: 0.54, wide: 0.21, deep: 0.2, y: 0.32, head: 0.33, legR: 0.07,
    ear: { len: 0.7, r: 0.32, spread: 0.45, tilt: 0.2, x: 0.5, inner: 0xFF5A8A }, tail: { len: 0.25, rise: 0.25, r: 0.07, segs: 2 }, iris: 0xC88A1A, maskC: 0x8A7AB8 },
  [['wisps', { n: 1, len: 0.22 }], ['crescentMark', { c: 0xFFE58A, size: 0.3 }]]),
  nightfang: design('quad', { size: 2.6, a: 0x2A2242, b: 0x6A4AA8, paw: 0x1A1430, len: 0.95, wide: 0.24, deep: 0.23, y: 0.55, head: 0.27, neck: true, legR: 0.09,
    ear: { len: 0.85, r: 0.3, spread: 0.35, tilt: 0.3, x: 0.5, c: 0x1A1430, inner: 0xFF5A8A }, muzzle: { w: 0.42, h: 0.3, l: 0.5, c: 0x4A3A6A }, tail: { len: 0.7, rise: 0.2, r: 0.1, segs: 3, taper: 0.22 }, iris: 0xFF5A8A, blush: false, mask: false },
  [['wisps', { n: 3, len: 0.3, ...DARK }], ['mane', { c: 0x1A1430, c1: 0x6A4AA8, n: 7, len: 0.32 }], ['tusks', { c: 0xFFFFFF, len: 0.25 }]], { eyeStyle: 2, eyeGlow: 0.35, lookK: 0.6 }),
  wisplet: design('blob', { size: 0.95, a: 0xC8B8FF, b: 0xF2EEFF, r: 0.38, iris: 0x3A2A6A, feet: false, eye: 0.24, tall: 1.15, y: 0.5 },
  [['wisps', { n: 1, len: 0.35, c: 0xE8E0FF, c1: 0x9A8AFF, glow: 0.6 }], ['orbs', { c: 0xE8E0FF, n: 2, r: 0.07 }]], { floats: true }),
  // A lantern ghost: a cloak of night with a light where its heart would be.
  phantomire: design('biped', { size: 2.2, a: 0x6A5AC8, b: 0xE8E0FF, bodyC: 0x3A2A6A, head: 0.27, body: 0.3, leg: 0.06, legs: false, arm: 0.34, armR: 0.07, iris: 0xBDF4FF, belly: 0x6A5AC8, blush: false, tall: 1.4 },
  [['lantern', { c: 0x2A1A4A, light: 0xBDF4FF, len: 1.1 }], ['wisps', { n: 3, len: 0.35, ...DARK }], ['halo', { c: 0xBDF4FF, R: 0.45, glow: 0.8 }]], { floats: true, eyeStyle: 2, eyeGlow: 0.4 }),
  gloomwing: design('bird', { size: 1.4, a: 0x3A2A4A, b: 0x8A6AA8, body: 0.28, head: 0.24, flies: true, wingShape: batWing, wingC: 0x2A1A3A, wingC1: 0x8A6AA8, beakC: 0x2A1A3A, legC: 0x2A1A3A, iris: 0xFF5A5A, tailN: 1, belly: 0x6A4A8A, blush: false },
  [['ears', { c: 0x3A2A4A, c1: 0x8A6AA8, len: 0.8, w: 0.4 }]], { eyeStyle: 2, eyeGlow: 0.2 }),
  creepvine: design('serpent', { size: 2.2, a: 0x3A4A2A, len: 1.7, r: 0.13, head: 0.2, segs: 8, belly: 0x6A5A3A, iris: 0xE8FF5A, pose: 'ground', lift: 0.6, sway: 0.2 },
  [['leafBack', { c: 0x2A3A1A, c1: 0x9A5AC8, n: 5, len: 0.22, w: 0.07 }], ['flower', { c: 0x9A5AC8, c1: 0x2A1A3A, n: 6, size: 0.55, centre: 0xE8FF5A }]], { eyeStyle: 2, eyeGlow: 0.3 }),
  // The eclipse that walks: a black lion with a corona for a mane.
  eclipsar: design('quad', { size: 3.6, a: 0x1A1A2E, b: 0x2A2A44, paw: 0x0E0E1A, len: 1.05, wide: 0.3, deep: 0.29, y: 0.66, head: 0.29, neck: true, legR: 0.12, stance: 0.27,
    muzzle: { w: 0.48, h: 0.32, l: 0.46, c: 0x2A2A44 }, tail: { len: 0.7, rise: 0.25, r: 0.08, segs: 3, taper: 0.15 }, iris: 0xFFF2C0, blush: false, mask: false, bellyPaint: false,
    ear: { len: 0.4, r: 0.28, spread: 0.7, tilt: 0.1, x: 0.6, inner: 0xFFE58A } },
  [['mane', { c: 0xFFE58A, c1: 0xFFF6D0, n: 11, len: 0.42, r: 0.06 }], ['halo', { c: 0xFFE07A, R: 0.85, r: 0.07, tilt: -0.6 }], ['crescentMark', { c: 0xFFE58A, size: 0.4 }], ['flameTail', { len: 0.4, fire: GOLDFIRE }]], { lookK: 0.6, eyeStyle: 2, eyeGlow: 0.4 }),

  // ------------------------------------------------------------------ lumen
  lumibug: design('blob', { size: 0.85, a: 0x4A6A3A, b: 0xFFF27A, r: 0.34, iris: 0x1A2A0A, eye: 0.24, tall: 0.9 },
  [['wings', { style: 'bug', c: 0xF2FFE0, c1: 0xFFFFFF, l: 0.32, h: 0.18, raise: 0.6, glow: 0.2 }], ['antennae', { c: 0x2A3A1A, tip: 0xFFF27A }], ['glowSpots', { c: 0xFFF27A, n: 2, r: 0.07, glow: 1 }]]),
  lanternix: design('bird', { size: 2.0, a: 0x3A4A6A, b: 0xFFE07A, body: 0.3, head: 0.24, flies: true, wingC: 0x2A3A5A, wingC1: 0xFFE07A, beakC: 0xFFE07A, legC: 0x1A2A3A, iris: 0xFFF6C0, tailN: 3, tailC: 0xFFE07A, belly: 0xFFF2C0, blush: false },
  [['lantern', { c: 0x1A2A3A, light: 0xFFF27A }], ['glowSpots', { c: 0xFFF27A, n: 3, glow: 1 }]], { eyeStyle: 2 }),
  prismpup: design('quad', { size: 1.2, a: 0xF2EEFF, b: 0xC8E8FF, paw: 0x9A8AE8, len: 0.5, wide: 0.2, deep: 0.19, y: 0.31, head: 0.34, legR: 0.06,
    ear: { len: 0.6, r: 0.3, spread: 0.5, tilt: 0.15, x: 0.5, inner: 0xC8B0FF }, tail: { len: 0.25, rise: 0.35, r: 0.06, segs: 2 }, iris: 0x6A4AC8 },
  [['crystalCrown', { c: 0xE0D0FF, c1: 0xFFFFFF, n: 1, len: 0.55, glow: 0.7 }], ['tailBlade', { c: 0xC8B0FF, c1: 0xFFFFFF, len: 0.2 }]]),
  prismane: design('quad', { size: 2.4, a: 0xE8E2FF, b: 0xFFFFFF, paw: 0x8A6AE8, len: 0.86, wide: 0.22, deep: 0.21, y: 0.52, head: 0.27, neck: true, legR: 0.07,
    ear: { len: 0.75, r: 0.3, spread: 0.4, tilt: 0.25, x: 0.5, inner: 0xC8B0FF }, tail: { len: 0.6, rise: 0.3, r: 0.08, segs: 3, taper: 0.2 }, iris: 0x9A6AFF, blush: false },
  [['mane', { c: 0xD8C8FF, c1: 0xFFFFFF, n: 9, len: 0.36 }], ['crystals', { c: 0xC8B0FF, c1: 0xFFFFFF, n: 4, len: 0.28, glow: 0.6 }], ['horn1', { c: 0xE0D0FF, c1: 0xFFFFFF, len: 0.8, glow: 0.6 }]], { lookK: 0.6 }),
  sunbloom: design('blob', { size: 1.05, a: 0x8AD86A, b: 0xFFF6C0, r: 0.36, iris: 0x3A2A0A, eye: 0.22 },
  [['flower', { c: 0xFFD23D, c1: 0xFFF6C0, n: 8, size: 0.75, centre: 0x8A5A2A }], ['leafCrown', { c: 0x5BC76A, n: 2, len: 0.6 }]]),
  halowyrm: design('serpent', { size: 2.6, a: 0xFFF6E0, len: 1.6, r: 0.15, head: 0.21, segs: 8, belly: 0xFFE07A, iris: 0x6AA8FF, lift: 0.6 },
  [['halo', { c: 0xFFE07A, R: 0.7 }], ['wings', { style: 'feather', c: 0xFFFFFF, c1: 0xFFE07A, l: 0.5, h: 0.28, raise: 0.5 }], ['glowSpots', { c: 0xFFE07A, n: 5, glow: 1 }]], { eyeStyle: 2, floats: true }),
  astrafox: design('quad', { size: 1.9, a: 0x2A3A7A, b: 0x4A5AA8, paw: 0x1A2250, len: 0.74, wide: 0.2, deep: 0.19, y: 0.42, head: 0.28, legR: 0.06,
    ear: { len: 0.95, r: 0.3, spread: 0.4, tilt: 0.2, x: 0.5, inner: 0xFFF2A0 }, tail: { len: 0.7, rise: 0.4, r: 0.12, segs: 3, taper: 0.1, tipC: 0xFFF2A0 }, iris: 0xC8A01A, blush: false },
  [['glowSpots', { c: 0xFFF2A0, n: 6, r: 0.025, glow: 1 }], ['crescentMark', { c: 0xFFF2A0, size: 0.32 }], ['orbs', { c: 0xFFF6C0, n: 3, r: 0.05 }]]),

  // ------------------------------------------------------------------ metal
  rivetling: design('biped', { size: 1.1, a: 0xA8B0BC, b: 0xE8ECF2, bodyC: 0x8A94A4, head: 0.29, body: 0.25, leg: 0.13, arm: 0.2, armR: 0.07, iris: 0x5ADCFF, belly: 0xD8DEE6, blush: false },
  [['visor', { c: 0x2A3A4A }], ['antennae', { c: 0x5A6474, tip: 0x5ADCFF, len: 0.6 }], ['spots', { c: 0x5A6474, n: 4, r: 0.04 }]], { eyeStyle: 2, eyeGlow: 0.3 }),
  steamhulk: design('biped', { size: 2.6, a: 0x8A7A6A, b: 0xD8A84A, bodyC: 0x6A5E52, head: 0.24, body: 0.4, leg: 0.18, arm: 0.44, armR: 0.13, hand: 1.4, iris: 0xFF8A3A, belly: 0xD8A84A, blush: false, wide: 1.15 },
  [['chimney', { c: 0x4A3E36, glow: 0xFF8A3A }], ['gear', { c: 0xD8A84A, c1: 0xF2D890, R: 0.2 }], ['visor', { c: 0x2A1E16, glow: 0 }]], { lookK: 0.6, eyeStyle: 2, eyeGlow: 0.4 }),
  magnetick: design('blob', { size: 0.95, a: 0xB8C0CC, b: 0xFF5A5A, r: 0.36, iris: 0x2A3A4A, eye: 0.22, feet: false },
  [['magnets', { size: 0.32 }], ['antennae', { c: 0x8A94A4, tip: 0xFF5A5A, len: 0.5, glow: 0.3 }]], { floats: true }),
  chromeram: design('quad', { size: 1.4, a: 0xC8D0DA, b: 0xF2F4F8, paw: 0x5A6474, len: 0.58, wide: 0.25, deep: 0.24, y: 0.36, head: 0.3, legR: 0.07,
    muzzle: { w: 0.38, h: 0.28, l: 0.36, c: 0xA8B0BC }, noseC: 0x2A3A4A, tail: { len: 0.08, rise: 0.12, r: 0.06, segs: 1 }, iris: 0x2A3A4A,
    ear: { len: 0.35, r: 0.24, spread: 0.85, tilt: 0.05, y: 0.4, x: 0.62, inner: 0x8A94A4 } },
  [['horns', { c: 0x8A94A4, c1: 0xF2F4F8, len: 0.55, spread: 0.7, back: 0.5, r: 0.15 }], ['spots', { c: 0x8A94A4, n: 3 }]]),
  titanox: design('quad', { size: 3.2, a: 0x7A8494, b: 0xD8DEE6, paw: 0x3A4250, len: 1.0, wide: 0.38, deep: 0.33, y: 0.6, head: 0.26, neck: true, legR: 0.14, stance: 0.29,
    muzzle: { w: 0.5, h: 0.36, l: 0.46, c: 0x5A6474 }, tail: { len: 0.25, rise: 0.1, r: 0.08, segs: 2 }, iris: 0xFFB43A, blush: false, mask: false },
  [['horns', { c: 0x3A4250, c1: 0xFFB43A, len: 0.9, spread: 0.9, back: 0.3, r: 0.17 }], ['spikes', { c: 0x5A6474, c1: 0xD8DEE6, n: 5, len: 0.2, r: 0.07 }], ['gear', { c: 0xFFB43A, c1: 0xFFE0A0, R: 0.18 }]], { lookK: 0.6 }),
  scythewing: design('bird', { size: 2.0, a: 0x9AA4B4, b: 0xE8F0FF, body: 0.28, head: 0.22, flies: true, wing: 0.7, wingH: 0.36, wingC: 0xC8D0DA, wingC1: 0xFFFFFF, beakC: 0x5A6474, beakC1: 0x2A3A4A, hook: 0.2, legC: 0x3A4250, iris: 0xFF5A5A, tailN: 3, tailC: 0x8A94A4, blush: false },
  [['tailBlade', { c: 0xD8DEE6, len: 0.35 }], ['horn1', { c: 0xD8DEE6, c1: 0xFFFFFF, len: 0.55, r: 0.1 }]], { eyeStyle: 2, eyeGlow: 0.2 }),
  clockwyrm: design('serpent', { size: 2.4, a: 0xC8A050, len: 1.6, r: 0.16, head: 0.22, segs: 8, belly: 0xF2E0B0, iris: 0x2A1A0A, pose: 'ground', lift: 0.5 },
  [['gear', { c: 0xC8A050, c1: 0xF2E0B0, R: 0.2 }], ['clock', {}], ['stripes', { c: 0x8A6A2A, n: 5 }]], { lookK: 0.6 }),

  // ------------------------------------------------------------------ the rift (shared/saga.js)
  // The rift's guardian: a long body of night with the rift's own light in
  // its seams — teal crystals down its back, a coral crown, a broken halo.
  tehomon: design('quad', { size: 2.7, a: 0x2A2058, b: 0x3E3488, paw: 0x15102E, len: 1.1, wide: 0.3, deep: 0.29, y: 0.66, head: 0.27, neck: true, legR: 0.12, stance: 0.27,
    muzzle: { w: 0.44, h: 0.3, l: 0.7, c: 0x3E3488 }, noseC: 0x2FE6D0, tail: { len: 0.95, rise: 0.18, r: 0.1, segs: 4, taper: 0.12, tipC: 0x2FE6D0 }, iris: 0xFF7A59, blush: false, mask: false, bellyPaint: false,
    ear: { len: 0.4, r: 0.2, spread: 0.85, tilt: 0.05, x: 0.6, c: 0x15102E, inner: 0x2FE6D0 } },
  [['wings', { style: 'bat', c: 0x2A2058, c1: 0x2FE6D0, l: 1.35, h: 0.72, raise: 0.75, glow: 0.35 }], ['spikes', { c: 0x2FE6D0, c1: 0xC8FFF8, n: 6, len: 0.42, r: 0.07, crystal: true, glow: 0.8 }],
    ['mane', { c: 0x15102E, c1: 0x2FE6D0, n: 9, len: 0.4, r: 0.07 }], ['horns', { c: 0x15102E, c1: 0xFF7A59, len: 1.25, spread: 0.6, back: 0.75, r: 0.18 }],
    ['halo', { c: 0xFF7A59, R: 0.85, r: 0.05, tilt: -0.8 }], ['glowSpots', { c: 0x2FE6D0, n: 6, glow: 1 }], ['tusks', { c: 0xC8FFF8, len: 0.22 }]],
  { eyeStyle: 2, eyeGlow: 0.55, lookK: 0.6, eye: 0.16 }),
  // What stayed behind when the rift closed: a small one of the same night,
  // a crystal for a horn, the rift's light in its cheeks.
  riftling: design('quad', { size: 1.15, a: 0x3A2E78, b: 0x7FF3FF, paw: 0x1E1840, len: 0.5, wide: 0.21, deep: 0.2, y: 0.31, head: 0.36, legR: 0.065,
    ear: { len: 0.55, r: 0.3, spread: 0.55, tilt: 0.15, x: 0.5, inner: 0x2FE6D0 }, tail: { len: 0.3, rise: 0.4, r: 0.07, segs: 2, tipC: 0x2FE6D0 }, iris: 0xFF7A59, cheek: 0x2FE6D0 },
  [['horn1', { c: 0x2FE6D0, c1: 0xFFFFFF, len: 0.6, glow: 0.7 }], ['wings', { style: 'bat', c: 0x3A2E78, c1: 0x7FF3FF, l: 0.32, h: 0.2, raise: 0.9, glow: 0.3 }],
    ['glowSpots', { c: 0x2FE6D0, n: 3, r: 0.04, glow: 1 }], ['crescentMark', { c: 0xFFD6C8, size: 0.28 }]]),
};

Object.assign(FIGURINES, MORE_FIGURINES);
export { FIGURINES };
