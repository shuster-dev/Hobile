import { BufferGeometry, CatmullRomCurve3, DoubleSide, Float32BufferAttribute, Group, OctahedronGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { HALF_PI, MOODS, TAU, blobGeo, capsuleGeo, eyeParts, finProfile, mat, mergeByMaterial, profile, taperGeo, xf2 } from './core.js';
import { ELEMENTS } from '../../shared/gamedata.js';
import { mixHex } from '../../shared/props.js';

function palette(i) {
  return {
    white: mat(16251903, {
      roughness: 0.28,
      env: 1.2
    }),
    iris: mat(i, {
      roughness: 0.3,
      emissive: i,
      emissiveIntensity: 0.22
    }),
    pupil: mat(724244, {
      roughness: 0.2
    }),
    spec: mat(16251903, {
      roughness: 0.28,
      env: 1.2
    })
  };
}

function speciesPalette(i) {
  let e = i.model,
    n = (ELEMENTS[i.types[0]] || ELEMENTS.terra).color,
    s = mixHex(n, 16774354, 0.3);
  return {
    A: mat(e.a, {
      roughness: 0.6,
      env: 0.95
    }),
    B: mat(e.b, {
      roughness: 0.46,
      env: 1.05
    }),
    DARK: mat(mixHex(e.b, 790550, 0.7), {
      roughness: 0.8
    }),
    LIGHT: mat(mixHex(e.b, 16777215, 0.55), {
      roughness: 0.38,
      env: 1.2
    }),
    ACC: mat(n, {
      roughness: 0.34,
      emissive: n,
      emissiveIntensity: 0.5,
      env: 1.1
    }),
    HOT: mat(s, {
      roughness: 0.28,
      emissive: s,
      emissiveIntensity: 0.85
    }),
    MET: mat(mixHex(e.b, 11122372, 0.62), {
      roughness: 0.28,
      metalness: 0.8,
      env: 1.4
    }),
    eyes: palette(e.eyes ?? 1777450),
    accent: n,
    hot: s
  };
}

var UNIT_OCTA = new OctahedronGeometry(1, 0);

function podGeo(i, e, t, n = 4.6, s = 10) {
  return blobGeo(i, t, e, n, s);
}

function spikeGeo(i, e, t = 5, n = 0) {
  return taperGeo(6e-4, i, e, t, n);
}

function latheGeo(i, e, t = 20, n = 7, {
  squash: s = 1,
  caps: r = !0
} = {}) {
  let o = i.computeFrenetFrames(t, !1),
    a = [],
    l = [],
    c = new Vector3();
  for (let d = 0; d <= t; d++) {
    let u = d / t;
    i.getPointAt(u, c);
    let f = o.normals[d],
      p = o.binormals[d],
      x = e(u);
    for (let g = 0; g < n; g++) {
      let m = g / n * TAU,
        v = Math.cos(m) * x,
        E = Math.sin(m) * x * s;
      a.push(c.x + f.x * v + p.x * E, c.y + f.y * v + p.y * E, c.z + f.z * v + p.z * E);
    }
  }
  for (let d = 0; d < t; d++) for (let u = 0; u < n; u++) {
    let f = d * n + u,
      p = d * n + (u + 1) % n;
    l.push(f, f + n, p, p, f + n, p + n);
  }
  if (r) for (let d of [0, 1]) {
    let u = d ? t * n : 0;
    i.getPointAt(d, c);
    let f = a.length / 3;
    a.push(c.x, c.y, c.z);
    for (let p = 0; p < n; p++) {
      let x = u + p,
        g = u + (p + 1) % n;
      d ? l.push(x, g, f) : l.push(g, x, f);
    }
  }
  let h = new BufferGeometry();
  return h.setAttribute("position", new Float32BufferAttribute(a, 3)), h.setIndex(l), h.computeVertexNormals(), h;
}

function curve(i) {
  return new CatmullRomCurve3(i.map(e => new Vector3(e[0], e[1], e[2])));
}

function curveAt(i) {
  return e => {
    let t = Math.min(0.9999, Math.max(0, e)) * (i.length - 1),
      n = Math.floor(t);
    return i[n] + (i[Math.min(i.length - 1, n + 1)] - i[n]) * (t - n);
  };
}

function sweep(i, e, t = 0.5, n = 1, s = 1, r = 8, o = 6) {
  let a = curve([[0, 0, 0], [0, i * 0.4 * n, -i * 0.12 * s], [0, i * 0.78 * n, -i * (0.16 + t * 0.4) * s], [0, i * n, -i * (0.2 + t * 0.85) * s]]);
  return latheGeo(a, l => e * Math.pow(1 - l, 0.72) + 0.002, r, o);
}

function spines(i, {
  n: e = 2,
  len: t = 0.3,
  r: n = 0.055,
  y: s,
  z: r,
  spread: o = 0.11,
  bend: a = 0.5,
  rx: l = -0.3,
  mat: c
}) {
  let h = c || i.P.DARK;
  for (let d = 0; d < e; d++) {
    let u = e === 1 ? 0 : (d / (e - 1) - 0.5) * 2,
      f = t * (1 - Math.abs(u) * 0.28);
    i.add(xf2(sweep(f, n, a), {
      x: u * o,
      y: s,
      z: r,
      rx: l - Math.abs(u) * 0.12,
      rz: -u * 0.5
    }), h);
  }
}

function mane(i, {
  from: e = 0.06,
  to: t = 0.86,
  n = 6,
  len: s = 0.2,
  w: r = 0.09,
  mat: o,
  kind: a = "blade",
  taperTo: l = 0.35,
  lift: c = 0,
  rx: h = -0.4
}) {
  let d = o || i.P.B;
  for (let u = 0; u < n; u++) {
    let f = e + (t - e) * (n === 1 ? 0 : u / (n - 1)),
      p = i.spine(f),
      x = 1 - (1 - l) * (n === 1 ? 0 : u / (n - 1)),
      g = a === "blade" ? profile(s * x, r * x, 0.45, 7) : a === "shard" ? xf2(UNIT_OCTA, {
        sx: r * x * 0.8,
        sy: s * x * 0.7,
        sz: r * x * 0.5
      }) : spikeGeo(r * x * 0.7, s * x, 5);
    i.add(xf2(g, {
      x: p.x,
      y: p.y + p.r * 0.82 + c + (a === "blade" ? 0 : s * x * 0.4),
      z: p.z,
      rx: h + p.slope
    }), d);
  }
}

function flameFan(i, {
  from: e = 0.05,
  to: t = 0.9,
  n = 4,
  w: s = 0.2,
  h: r = 0.18,
  t: o = 0.05,
  mat: a,
  seam: l,
  jitter: c = 0.5
}) {
  let h = a || i.P.B;
  for (let d = 0; d < n; d++) {
    let u = n === 1 ? 0.5 : d / (n - 1),
      f = i.spine(e + (t - e) * u),
      p = 0.75 + 0.5 * Math.sin(u * Math.PI),
      x = (i.rnd() - 0.5) * c;
    i.add(xf2(podGeo(s * p, r * p, o, 5.2, 8), {
      x: f.x + x * 0.05,
      y: f.y + f.r * 0.72,
      z: f.z,
      rx: f.slope + x * 0.2,
      rz: x * 0.3
    }), h);
    for (let g of [-1, 1]) i.add(xf2(podGeo(r * p * 0.8, s * p * 0.75, o, 5.2, 8), {
      x: f.x + g * f.r * 0.82,
      y: f.y - f.r * 0.12,
      z: f.z,
      rz: g * (1.15 + x * 0.2),
      rx: f.slope
    }), h);
    l && i.add(xf2(podGeo(s * p * 0.62, 0.016, 0.012, 3, 5), {
      x: f.x,
      y: f.y + f.r * 0.8,
      z: f.z + 0.01,
      rx: f.slope
    }), l);
  }
}

function wingPair(i, {
  t: e = 0.35,
  len: t = 0.36,
  w: n = 0.2,
  rz: s = 1.1,
  rx: r = -0.2,
  ry: o = 0,
  mat: a,
  drop: l = 0
}) {
  let c = i.spine(e),
    h = a || i.P.ACC;
  for (let d of [-1, 1]) i.add(xf2(profile(t, n, 0.4, 9), {
    x: c.x + d * c.r * 0.9,
    y: c.y - l,
    z: c.z,
    rz: -d * s,
    rx: r,
    ry: d * o
  }), h);
}

function studs(i, e, {
  r: t = 0.06,
  mat: n,
  core: s
} = {}) {
  for (let r of e) i.add(xf2(new TorusGeometry(t, t * 0.34, 5, 8), {
    x: r[0],
    y: r[1],
    z: r[2],
    rx: r[3] ?? HALF_PI,
    ry: r[4] ?? 0
  }), n || i.P.DARK), i.add(xf2(new SphereGeometry(t * 0.72, 7, 5), {
    x: r[0],
    y: r[1],
    z: r[2]
  }), s || i.P.HOT);
}

function crest(i, {
  n: e = 5,
  from: t = 0.08,
  to: n = 0.88,
  mat: s,
  len: r = 0.13,
  w: o = 0.013
}) {
  let a = s || i.P.HOT;
  for (let l = 0; l < e; l++) {
    let c = t + (n - t) * (l / Math.max(1, e - 1)),
      h = i.spine(c),
      d = l % 2 ? 1 : -1,
      u = (i.rnd() - 0.5) * 1.2;
    i.add(xf2(podGeo(r * (0.6 + i.rnd() * 0.6), o, o, 3, 4), {
      x: h.x + d * h.r * 0.86,
      y: h.y - h.r * 0.2 + i.rnd() * h.r * 0.5,
      z: h.z,
      rz: d * 1.2 + u,
      ry: d * 0.6,
      rx: u
    }), a);
  }
}

function tuft(i, {
  x: e = 0,
  y: t,
  z: n,
  r: s = 0.03,
  n: r = 5,
  spread: o = 0.1,
  mat: a
}) {
  let l = a || i.P.ACC;
  for (let c = 0; c < r; c++) {
    let h = c / r * TAU + 0.7,
      d = 0.5 + i.rnd() * 0.7;
    i.add(xf2(new SphereGeometry(s * d, 6, 5), {
      x: e + Math.cos(h) * o * (0.6 + i.rnd() * 0.6),
      y: t + Math.sin(h) * o * 0.7,
      z: n + i.rnd() * 0.01
    }), l);
  }
}

function whiskers(i, {
  x: e = 0,
  y: t,
  z: n,
  len: s = 0.7,
  r = 0.035,
  sway: o = 0.25,
  drop: a = 0.2,
  mat: l,
  flip: c = 1
}) {
  let h = curve([[e, t, n], [e + o * 0.4 * c, t - a * 0.2, n - s * 0.3], [e - o * 0.6 * c, t - a * 0.55, n - s * 0.68], [e + o * 0.3 * c, t - a, n - s]]);
  i.add(latheGeo(h, d => r * (1 - d * 0.85) + 0.002, 10, 5), l || i.P.B);
}

function puff(i, {
  x: e = 0,
  y: t,
  z: n,
  r: s = 0.13,
  n: r = 5,
  spread: o = 0.22,
  mat: a,
  down: l = 0.1
}) {
  let c = a || i.P.DARK;
  for (let h = 0; h < r; h++) {
    let d = h / r * TAU + i.rnd(),
      u = 0.5 + i.rnd() * 0.8;
    i.add(xf2(new SphereGeometry(s * u, 7, 5), {
      x: e + Math.cos(d) * o * (0.4 + i.rnd()),
      y: t - l * i.rnd(),
      z: n + Math.sin(d) * o * (0.4 + i.rnd()),
      sy: 0.7
    }), c);
  }
}

function frills(i, {
  x: e = 0,
  y: t,
  z: n,
  n: s = 3,
  r = 0.05,
  spread: o = 0.14,
  mat: a,
  ry: l = 0
}) {
  let c = a || i.P.HOT;
  for (let h = 0; h < s; h++) {
    let d = h / s * TAU;
    i.add(xf2(podGeo(r * (0.5 + i.rnd() * 0.6), r * 0.22, 0.008, 3, 4), {
      x: e + Math.cos(d) * o,
      y: t + Math.sin(d) * o * 0.8,
      z: n,
      ry: l,
      rz: d
    }), c);
  }
}

function beads(i, e, {
  r: t = 0.018,
  mat: n
} = {}) {
  let s = n || i.P.DARK;
  for (let r of e) i.add(xf2(new SphereGeometry(t, 5, 4), {
    x: r[0],
    y: r[1],
    z: r[2]
  }), s);
}

function gear(i, {
  x: e = 0,
  y: t,
  z: n,
  r: s = 0.14,
  teeth: r = 8,
  ry: o = HALF_PI,
  mat: a,
  hub: l
}) {
  let c = a || i.P.MET;
  i.add(xf2(new TorusGeometry(s, s * 0.26, 5, 12), {
    x: e,
    y: t,
    z: n,
    ry: o
  }), c);
  for (let h = 0; h < r; h++) {
    let d = h / r * TAU;
    i.add(xf2(podGeo(s * 0.13, s * 0.13, s * 0.2, 5, 4), {
      x: e + (o ? 0 : Math.cos(d) * s * 1.12),
      y: t + Math.sin(d) * s * 1.12,
      z: n + (o ? Math.cos(d) * s * 1.12 : 0),
      ry: o,
      rz: d
    }), c);
  }
  l !== !1 && i.add(xf2(new SphereGeometry(s * 0.3, 6, 5), {
    x: e,
    y: t,
    z: n
  }), l || i.P.ACC);
}

function halo(i, {
  x: e = 0,
  y: t,
  z: n = 0,
  r: s = 0.3,
  t: r = 0.022,
  tilt: o = -0.18,
  mat: a
}) {
  i.add(xf2(new TorusGeometry(s, r, 5, 18), {
    x: e,
    y: t,
    z: n,
    rx: -HALF_PI + o
  }), a || i.P.HOT);
}

function finPair(i, {
  x: e = 0,
  y: t,
  z: n,
  n: s = 4,
  len: r = 0.18,
  r: o = 0.055,
  spread: a = 0.6,
  mat: l,
  lean: c = 0
}) {
  let h = l || i.P.LIGHT;
  for (let d = 0; d < s; d++) {
    let u = d / s * TAU + 0.4,
      f = 0.55 + i.rnd() * 0.7;
    i.add(xf2(UNIT_OCTA, {
      x: e + Math.cos(u) * o * 1.1,
      y: t + r * f * 0.45,
      z: n + Math.sin(u) * o * 1.1,
      rx: Math.sin(u) * a + c,
      rz: -Math.cos(u) * a,
      sx: o * f,
      sy: r * f,
      sz: o * f * 0.8
    }), h);
  }
}

function shellHalves(i, {
  x: e = 0,
  y: t,
  z: n,
  r: s = 0.24,
  n: r = 9,
  len: o = 0.34,
  thick: a = 0.075,
  rx: l = -0.5,
  arc: c = 2.5,
  mat: h,
  mat2: d,
  jitter: u = 0.22
}) {
  let f = h || i.P.HOT,
    p = d || i.P.ACC;
  for (let x = 0; x < r; x++) {
    let g = -c / 2 + (r === 1 ? c / 2 : x / (r - 1) * c),
      m = 0.62 + 0.38 * Math.cos(g * 0.72),
      v = 1 + (i.rnd() - 0.5) * u;
    i.add(xf2(spikeGeo(a * m, o * m * v, 5, 0.25), {
      x: e + Math.sin(g) * s,
      y: t + Math.cos(g) * s * 0.82,
      z: n,
      rz: g,
      rx: l - (1 - Math.abs(Math.cos(g))) * 0.25
    }), x % 2 ? f : p);
  }
}

function petals(i, {
  x: e = 0,
  y: t,
  z: n,
  n: s = 5,
  len: r = 0.3,
  w: o = 0.15,
  spread: a = 0.18,
  mat: l,
  droop: c = 0.9
}) {
  let h = l || i.P.B;
  for (let d = 0; d < s; d++) {
    let u = d / s * TAU + 0.35;
    i.add(xf2(profile(r * (0.75 + i.rnd() * 0.5), o, 0.5, 9), {
      x: e + Math.cos(u) * a,
      y: t,
      z: n + Math.sin(u) * a,
      rx: -c + Math.sin(u) * 0.5,
      ry: u,
      rz: Math.cos(u) * 0.6
    }), h);
  }
}

function maw(i, {
  y: e,
  z: t,
  w: n = 0.16,
  h: s = 0.1,
  open: r = 0.35,
  teeth: o = 6,
  mat: a,
  tooth: l
}) {
  let c = a || i.P.DARK,
    h = l || i.P.LIGHT;
  i.add(xf2(podGeo(n, s * 0.9, s * 0.5, 3.2, 8), {
    y: e - s * 0.9,
    z: t,
    rx: -r
  }), c);
  for (let d = 0; d < 2; d++) for (let u = 0; u < o; u++) {
    let f = o === 1 ? 0 : u / (o - 1) - 0.5,
      p = n * 0.9 * (1 - Math.abs(f) * 0.35);
    i.add(xf2(spikeGeo(s * 0.17, s * (0.5 - d * 0.1), 4), {
      x: f * n * 1.7,
      y: e - (d ? s * 1.5 : s * 0.15),
      z: t + p * 0.2 - Math.abs(f) * n * 0.5,
      rx: d ? r * 0.4 : Math.PI - r * 0.4
    }), h);
  }
}

function faceParts(i, {
  x: e = 0,
  y: t,
  z: n,
  eye: s = 0.055,
  sep: r = 0.1,
  mood: o = "curious",
  brow: a = !0,
  browMat: l,
  lidMat: c,
  tilt: h = 0
}) {
  let d = MOODS[o] || MOODS.curious,
    u = s * d.eye,
    f = i.segK ?? 1;
  if (i.add2(eyeParts(i.P.eyes, {
    x: e - r,
    y: t,
    z: n,
    r: u,
    look: -1,
    tilt: -h,
    seg: f
  })), i.add2(eyeParts(i.P.eyes, {
    x: e + r,
    y: t,
    z: n,
    r: u,
    look: 1,
    tilt: h,
    seg: f
  })), a) for (let p of [-1, 1]) i.add(xf2(podGeo(u * d.browW, u * 0.36, u * d.browT * 0.6, 3.4, 6), {
    x: e + p * r,
    y: t + u * (d.browY + 0.34),
    z: n - u * 0.16,
    rz: p * d.browRZ
  }), l || i.P.DARK);
  if (d.lid > 0) for (let p of [-1, 1]) i.add(xf2(podGeo(u * 1.02, u * 0.62, u * 0.3, 3, 6), {
    x: e + p * r,
    y: t + u * (0.72 - d.lid),
    z: n - u * 0.18,
    rx: 0.5,
    rz: p * d.browRZ * 0.5
  }), c || i.P.A);
}

var ELEMENT_KITS = {
  ember(i, e) {
    let t = Math.round(3 + i.tier * 1.6);
    if (crest(i, {
      n: Math.round(t * e) + 1,
      mat: i.P.HOT,
      len: 0.1 + i.tier * 0.03
    }), e > 0.6) {
      let n = i.spine(0.38);
      studs(i, [[-n.r * 0.92, n.y - n.r * 0.12, n.z, 0, HALF_PI], [n.r * 0.92, n.y - n.r * 0.12, n.z, 0, HALF_PI]], {
        r: 0.05 + i.tier * 0.016
      }), mane(i, {
        n: Math.round(3 + i.tier * 1.4),
        from: 0.05,
        to: 0.34 + i.tier * 0.18,
        len: 0.15 + i.tier * 0.09,
        w: 0.1,
        mat: i.P.HOT,
        rx: -0.7,
        taperTo: 0.4
      });
    }
    if (i.grand && e > 0.6) {
      let n = i.spine(0.32);
      for (let s of [-1, 1]) i.add(xf2(profile(0.2 + i.tier * 0.06, 0.1, 0.5, 6), {
        x: s * n.r * 1,
        y: n.y + n.r * 0.45,
        z: n.z,
        rz: s * 0.9,
        rx: -0.5
      }), i.P.ACC);
    }
  },
  aqua(i, e) {
    mane(i, {
      n: Math.round(4 + i.tier),
      from: 0.06,
      to: 0.78,
      len: 0.16 + i.tier * 0.07,
      w: 0.12,
      mat: i.P.ACC,
      rx: -0.15
    }), e > 0.6 && wingPair(i, {
      t: 0.3,
      len: 0.3 + i.tier * 0.1,
      w: 0.19,
      rz: 1.25,
      rx: -0.15,
      drop: 0.04,
      mat: i.P.ACC
    }), i.grand && e > 0.6 && wingPair(i, {
      t: 0.62,
      len: 0.22 + i.tier * 0.06,
      w: 0.14,
      rz: 1.4,
      mat: i.P.ACC,
      drop: 0.02
    });
  },
  verdant(i, e) {
    let t = i.anchors.head;
    if (petals(i, {
      x: t.x,
      y: t.y + t.r * 0.7,
      z: t.z - t.r * 0.5,
      n: Math.round(3 + i.tier * 1.5),
      len: 0.24 + i.tier * 0.12,
      w: 0.15,
      spread: t.r * 0.62,
      mat: i.P.ACC,
      droop: 0.75
    }), e > 0.6 && flameFan(i, {
      n: Math.round(1 + i.tier),
      w: 0.16,
      h: 0.14,
      t: 0.045,
      mat: i.P.B,
      jitter: 0.8
    }), e > 0.6) {
      let n = i.spine(0.5);
      if (i.add(xf2(new SphereGeometry(0.042 + i.tier * 0.016, 7, 6), {
        x: n.x,
        y: n.y + n.r * 0.74,
        z: n.z
      }), i.P.HOT), i.grand) for (let s of [-1, 1]) i.add(xf2(new SphereGeometry(0.036, 6, 5), {
        x: n.x + s * n.r * 0.55,
        y: n.y + n.r * 0.6,
        z: n.z - 0.05
      }), i.P.HOT);
    }
  },
  volt(i, e) {
    mane(i, {
      n: Math.round(4 + i.tier),
      from: 0.04,
      to: 0.7,
      len: 0.2 + i.tier * 0.08,
      w: 0.085,
      mat: i.P.ACC,
      kind: "shard",
      rx: -0.55
    });
    let t = i.anchors.chest;
    if (e > 0.5 && i.add(xf2(new SphereGeometry(0.055 + i.tier * 0.02, 8, 6), {
      x: t.x,
      y: t.y,
      z: t.z + t.r * 0.55
    }), i.P.HOT), e > 0.6) {
      let n = i.spine(0.2);
      for (let s of [-1, 1]) for (let r = 0; r < 2 + Math.round(i.tier); r++) {
        let o = 0.4 + r * 0.55;
        i.add(xf2(spikeGeo(0.014, 0.16 + i.tier * 0.05, 4), {
          x: s * (n.r * 0.95),
          y: n.y + n.r * 0.5 + Math.sin(o) * 0.1,
          z: n.z - r * 0.05,
          rz: s * (0.8 + Math.cos(o) * 0.5),
          rx: -0.3
        }), i.P.HOT);
      }
    }
  },
  terra(i, e) {
    if (flameFan(i, {
      n: Math.round((e > 0.6 ? 3 : 1) + i.tier * 1.2),
      w: 0.2 + i.tier * 0.05,
      h: 0.18,
      t: 0.06,
      mat: i.P.B,
      jitter: 1
    }), e > 0.6) for (let t = 0; t < 3; t++) {
      let n = i.spine(0.2 + i.rnd() * 0.55);
      i.add(xf2(profile(0.09, 0.07, 0.6, 5), {
        x: n.x + (i.rnd() - 0.5) * n.r,
        y: n.y + n.r * 0.85,
        z: n.z,
        rx: -1.2 + i.rnd() * 0.5,
        ry: i.rnd() * 3
      }), i.P.ACC);
    }
  },
  gale(i, e) {
    let t = i.spine(0.82);
    for (let n = 0; n < Math.round(2 + i.tier * 1.5); n++) {
      let s = n % 2 ? 1 : -1;
      whiskers(i, {
        x: t.x + s * t.r * 0.7,
        y: t.y + t.r * 0.3,
        z: t.z,
        len: 0.5 + i.tier * 0.25,
        r: 0.026,
        sway: 0.2,
        drop: 0.12,
        flip: s,
        mat: i.P.LIGHT
      });
    }
    if (e > 0.6) {
      let n = i.anchors.head;
      i.add(xf2(new TorusGeometry(n.r * 0.7, 0.016, 4, 12), {
        x: n.x,
        y: n.y + n.r * 1.05,
        z: n.z - n.r * 0.5,
        rx: -HALF_PI + 0.7
      }), i.P.LIGHT);
    }
  },
  frost(i, e) {
    if (finPair(i, {
      x: i.spine(0.3).x,
      y: i.spine(0.3).y + i.spine(0.3).r * 0.7,
      z: i.spine(0.3).z,
      n: Math.round(3 + i.tier),
      len: 0.18 + i.tier * 0.08,
      r: 0.05,
      mat: i.P.LIGHT
    }), e > 0.6 && finPair(i, {
      y: i.spine(0.66).y + i.spine(0.66).r * 0.65,
      z: i.spine(0.66).z,
      x: i.spine(0.66).x,
      n: 3,
      len: 0.13 + i.tier * 0.05,
      r: 0.04,
      mat: i.P.LIGHT
    }), i.grand && e > 0.6) for (let t of [-1, 1]) {
      let n = i.spine(0.45);
      i.add(xf2(UNIT_OCTA, {
        x: n.x + t * n.r,
        y: n.y,
        z: n.z,
        sx: 0.05,
        sy: 0.16,
        sz: 0.04,
        rz: t * 1.1
      }), i.P.LIGHT);
    }
  },
  umbra(i, e) {
    let t = i.spine(0.8);
    puff(i, {
      x: t.x,
      y: t.y + t.r * 0.2,
      z: t.z - 0.06,
      r: 0.1 + i.tier * 0.04,
      n: Math.round(3 + i.tier * 2),
      spread: 0.2 + i.tier * 0.08
    });
    let n = i.anchors.head;
    e > 0.6 && tuft(i, {
      x: n.x + n.r * 0.35,
      y: n.y + n.r * 0.45,
      z: n.z + n.r * 0.55,
      n: Math.round(3 + i.tier),
      r: 0.022,
      spread: n.r * 0.5
    }), i.tier >= 1.2 && e > 0.6 && tuft(i, {
      x: n.x - n.r * 0.4,
      y: n.y + n.r * 0.3,
      z: n.z + n.r * 0.5,
      n: 3,
      r: 0.02,
      spread: n.r * 0.4
    });
  },
  lumen(i, e) {
    let t = i.anchors.head;
    halo(i, {
      x: t.x,
      y: t.y + t.r * (1.35 + i.tier * 0.12),
      z: t.z - t.r * 0.25,
      r: t.r * (0.85 + i.tier * 0.12)
    }), e > 0.6 && frills(i, {
      y: i.spine(0.45).y + i.spine(0.45).r * 0.4,
      z: i.spine(0.45).z + 0.01,
      x: i.spine(0.45).r * 0.85,
      n: 3,
      r: 0.06,
      spread: 0.09,
      ry: HALF_PI
    }), i.tier >= 1.2 && e > 0.6 && halo(i, {
      x: t.x,
      y: t.y + t.r * 1.05,
      z: t.z - t.r * 0.25,
      r: t.r * 1.3,
      t: 0.014,
      rx: -0.9
    });
  },
  metal(i, e) {
    e > 0.6 && flameFan(i, {
      n: Math.round(2 + i.tier),
      w: 0.2,
      h: 0.13,
      t: 0.035,
      mat: i.P.MET,
      jitter: 0.2
    });
    let t = i.spine(0.4);
    beads(i, [[t.r * 0.8, t.y + t.r * 0.5, t.z + 0.05], [-t.r * 0.8, t.y + t.r * 0.5, t.z + 0.05], [t.r * 0.75, t.y + t.r * 0.1, t.z - 0.08], [-t.r * 0.75, t.y + t.r * 0.1, t.z - 0.08]], {
      r: 0.016,
      mat: i.P.LIGHT
    }), e > 0.6 && i.grand && gear(i, {
      x: 0,
      y: i.spine(0.62).y + i.spine(0.62).r * 0.6,
      z: i.spine(0.62).z,
      r: 0.1 + i.tier * 0.03,
      ry: 0,
      teeth: 7
    });
  }
};

function applyElementKit(i) {
  ELEMENT_KITS[i.el]?.(i, 1), i.el2 && ELEMENT_KITS[i.el2] && ELEMENT_KITS[i.el2](i, 0.45);
}

function curveSampler(i) {
  return e => {
    let t = Math.min(0.9999, Math.max(0, e)) * (i.length - 1),
      n = Math.floor(t),
      s = t - n,
      r = i[n],
      o = i[Math.min(i.length - 1, n + 1)],
      a = c => r[c] + (o[c] - r[c]) * s,
      l = Math.abs(o[2] - r[2]) || 0.05;
    return {
      x: a(0),
      y: a(1),
      z: a(2),
      r: a(3),
      slope: Math.max(-0.9, Math.min(0.9, (o[1] - r[1]) / l))
    };
  };
}

var STANCES = {
    plantigrade: i => [[0.3, i * 1.35, 0.16], [0.34, i * 1, -0.1], [0.3, i * 0.82, 0.06]],
    digitigrade: i => [[0.3, i * 1.3, 0.52], [0.33, i * 0.92, -0.5], [0.28, i * 0.66, 0.46]],
    column: i => [[0.44, i * 1.25, 0.06], [0.44, i * 1.1, -0.04]],
    bird: i => [[0.26, i * 1.7, 0.62], [0.32, i * 0.9, -0.62], [0.36, i * 0.62, 0.2]],
    insect: i => [[0.3, i * 1.1, -0.55], [0.34, i * 0.8, 0.75], [0.28, i * 0.55, 0.3]],
    root: i => [[0.42, i * 1.5, 0.1], [0.4, i * 1.1, -0.05]]
  },
  PART_BUILDERS = {
    paw: (i, e, t) => [{
      geo: xf2(blobGeo(i * 1.5, i * 0.85, i * 1.75, 3.2, 9), {
        z: i * 0.45
      }),
      mat: t
    }, ...[-1, 0, 1].map(n => ({
      geo: xf2(spikeGeo(i * 0.36, i * 0.85, 4), {
        x: n * i * 0.78,
        y: -i * 0.18,
        z: i * 1.7,
        rx: 1.9
      }),
      mat: t
    }))],
    hoof: (i, e, t) => [{
      geo: xf2(blobGeo(i * 1.3, i * 0.7, i * 1.3, 5, 8), {
        z: i * 0.2
      }),
      mat: t
    }, {
      geo: xf2(blobGeo(i * 1.2, i * 0.4, i * 1.2, 6, 8), {
        y: -i * 0.7,
        z: i * 0.2
      }),
      mat: e.DARK
    }],
    slab: (i, e, t) => [{
      geo: xf2(blobGeo(i * 1.7, i * 0.7, i * 2, 6, 9), {
        z: i * 0.4
      }),
      mat: t
    }, ...[-1, 1].map(n => ({
      geo: xf2(podGeo(i * 0.42, i * 0.5, i * 0.3, 4, 5), {
        x: n * i * 0.9,
        y: -i * 0.3,
        z: i * 1.7
      }),
      mat: e.DARK
    }))],
    talon: (i, e, t) => [{
      geo: xf2(blobGeo(i * 1.2, i * 0.7, i * 1, 3.4, 8), {
        z: i * 0.3
      }),
      mat: t
    }, ...[-1.1, 0, 1.1].map(n => ({
      geo: xf2(spikeGeo(i * 0.42, i * 2.3, 4), {
        x: n * i * 0.9,
        y: -i * 0.35,
        z: i * 1.5,
        rx: 1.75,
        rz: -n * 0.2
      }),
      mat: t
    })), {
      geo: xf2(spikeGeo(i * 0.36, i * 1.5, 4), {
        y: -i * 0.35,
        z: -i * 0.9,
        rx: -1.75
      }),
      mat: t
    }],
    claw: (i, e, t) => [{
      geo: xf2(spikeGeo(i * 1.1, i * 2.6, 5), {
        y: -i * 0.7,
        z: i * 0.5,
        rx: 1.4
      }),
      mat: e.DARK
    }],
    roots: (i, e, t) => [-1, 0, 1].map(n => ({
      geo: xf2(spikeGeo(i * 0.7, i * 2.6, 5, i * 0.6), {
        x: n * i * 0.9,
        y: -i * 0.5,
        z: (1 - Math.abs(n)) * i * 1.4,
        rx: 1.5 + n * 0.1,
        rz: n * 0.5
      }),
      mat: t
    })),
    none: () => []
  };

function limb(i, {
  x: e,
  y: t,
  z: n,
  len: s,
  r,
  mat: o,
  kind: a = "plantigrade",
  foot: l = "paw",
  splay: c = 0,
  lean: h = 0,
  yaw: d = 0,
  outline: u = !0
}) {
  let f = (STANCES[a] || STANCES.plantigrade)(r),
    p = f.reduce((_, [S,, b]) => _ + S * Math.cos(b), 0),
    x = s / p,
    g = [],
    m = 0,
    v = 0;
  g.push({
    geo: xf2(blobGeo(r * 1.6, r * 1.85, r * 1.6, 2.7, 9), {
      y: -r * 0.5
    }),
    mat: o
  });
  for (let [_, S, b] of f) {
    let T = _ * x,
      y = -Math.cos(b) * T,
      M = -Math.sin(b) * T;
    g.push({
      geo: xf2(capsuleGeo(S, Math.max(0.01, T - S * 1.1), 8), {
        y: m + y / 2,
        z: v + M / 2,
        rx: b
      }),
      mat: o
    }), m += y, v += M;
  }
  for (let _ of (PART_BUILDERS[l] || PART_BUILDERS.paw)(r, i.P, o)) _.geo.translate(0, m, v), g.push(_);
  let E = mergeByMaterial(g);
  return E.position.set(e, t, n), E.rotation.set(h, d, c), E.userData.noOutline = !u, i.group.add(E), i.rig.legs.push(E), E;
}

function headPart(i, {
  x: e = 0,
  y: t,
  z: n,
  r: s,
  snout: r = 1,
  snoutR: o = 0.55,
  drop: a = 0.22,
  jaw: l = !0,
  n: c = 2.5,
  seg: h = 14,
  mat: d,
  mat2: u,
  nose: f = !0,
  snoutMat: p
}) {
  let x = i.P,
    g = d || x.A,
    m = p === "a" ? g : u || x.B;
  i.add(xf2(blobGeo(s * 0.95, s, s * 1.02, c, h), {
    x: e,
    y: t,
    z: n
  }), g), i.add(xf2(blobGeo(s * 0.8, s * 0.52, s * 0.62, 2.9, 10), {
    x: e,
    y: t - s * 0.42,
    z: n + s * 0.34
  }), g);
  let v = n + s * (0.72 + r * 0.5);
  r > 0.05 && (i.add(xf2(blobGeo(s * o, s * o * 0.82, s * r * 0.72, 2.6, 10), {
    x: e,
    y: t - s * a,
    z: v
  }), m), l && i.add(xf2(podGeo(s * o * 0.82, s * r * 0.6, s * o * 0.3, 3.2, 8), {
    x: e,
    y: t - s * (a + o * 0.62),
    z: v - s * 0.05
  }), x.DARK), f && i.add(xf2(new SphereGeometry(s * 0.17, 7, 6), {
    x: e,
    y: t - s * (a - 0.06),
    z: v + s * r * 0.62
  }), x.DARK));
  let E = {
    x: e,
    y: t,
    z: n,
    r: s,
    snoutZ: v,
    snoutY: t - s * a
  };
  return i.anchors.head = E, E;
}

function earPart(i, {
  x: e = 0,
  y: t,
  z: n,
  r: s,
  kind: r = "round",
  mat: o,
  mat2: a,
  scale: l = 1,
  spread: c = 0.72
}) {
  let h = i.P,
    d = o || h.A,
    u = a || h.B;
  for (let f of [-1, 1]) {
    let p = e + f * s * c;
    r === "round" ? (i.add(xf2(blobGeo(s * 0.3 * l, s * 0.34 * l, s * 0.14 * l, 2.4, 8), {
      x: p,
      y: t + s * 0.62,
      z: n,
      rz: f * 0.35
    }), d), i.add(xf2(blobGeo(s * 0.18 * l, s * 0.2 * l, s * 0.08 * l, 2.4, 7), {
      x: p,
      y: t + s * 0.64,
      z: n + s * 0.1,
      rz: f * 0.35
    }), u)) : r === "tuft" ? (i.add(xf2(profile(s * 1.15 * l, s * 0.36 * l, 0.3, 7), {
      x: p,
      y: t + s * 0.5,
      z: n - s * 0.1,
      rz: f * 0.42,
      rx: -0.2
    }), d), i.add(xf2(profile(s * 0.6 * l, s * 0.16 * l, 0.3, 5), {
      x: p + f * s * 0.12,
      y: t + s * 0.72,
      z: n - s * 0.12,
      rz: f * 0.8,
      rx: -0.25
    }), u)) : r === "fan" ? i.add(xf2(profile(s * 1.4 * l, s * 0.78 * l, 0.55, 9), {
      x: p,
      y: t + s * 0.2,
      z: n - s * 0.2,
      rz: f * 1.15,
      rx: -0.35,
      ry: f * 0.5
    }), u) : r === "antenna" ? (i.add(xf2(spikeGeo(s * 0.1 * l, s * 1.7 * l, 4, s * 0.4), {
      x: p,
      y: t + s * 1 * l,
      z: n - s * 0.1,
      rz: f * 0.5,
      rx: -0.3
    }), h.DARK), i.add(xf2(UNIT_OCTA, {
      x: p + f * s * 0.62 * l,
      y: t + s * 1.72 * l,
      z: n - s * 0.24,
      sx: s * 0.16,
      sy: s * 0.3,
      sz: s * 0.16
    }), h.HOT)) : r === "frill" && i.add(xf2(profile(s * 1 * l, s * 0.5 * l, 0.7, 8), {
      x: p,
      y: t + s * 0.1,
      z: n - s * 0.45,
      rz: f * 1.35,
      rx: -0.9,
      ry: f * 0.3
    }), u);
  }
}

function buildQuad(i) {
  let e = i.d.q,
    t = i.P,
    n = e.bodyY,
    [s, r, o] = e.chest,
    [a, l, c] = e.waist,
    [h, d, u] = e.rump,
    f = i.seg(15);
  i.add(xf2(blobGeo(s, r, o, 2.8, f), {
    x: 0,
    y: n + e.rise,
    z: e.chestZ
  }), t.A), i.add(xf2(blobGeo(a, l, c, 2.7, f - 2), {
    x: 0,
    y: n + e.rise * 0.3,
    z: e.waistZ
  }), t.A), i.add(xf2(blobGeo(h, d, u, 2.8, f - 1), {
    x: 0,
    y: n,
    z: e.rumpZ
  }), t.A), i.add(xf2(blobGeo(s * 0.82, r * 0.5, (e.chestZ - e.rumpZ) * 0.62, 2.6, f - 3), {
    y: n - r * 0.52 + e.rise * 0.4,
    z: (e.chestZ + e.waistZ) * 0.5
  }), t.B), i.spine = curveSampler([[0, n + e.rise + r * 0.86, e.chestZ + o * 0.42, s], [0, n + e.rise + r * 0.9, e.chestZ, s], [0, n + e.rise * 0.3 + l * 0.88, e.waistZ, a], [0, n + d * 0.88, e.rumpZ, h], [0, n + d * 0.7, e.rumpZ - u * 0.8, h * 0.62]]), i.anchors.chest = {
    x: 0,
    y: n + e.rise - r * 0.1,
    z: e.chestZ + o * 0.5,
    r: s
  };
  let p = e.neck,
    x = p.y,
    g = p.z;
  i.add(latheGeo(curve([[0, n + e.rise + r * 0.45, e.chestZ + o * 0.35], [0, (n + e.rise + r * 0.45) * 0.45 + x * 0.55, (e.chestZ + o * 0.35) * 0.45 + g * 0.55], [0, x, g]]), E => p.r0 + (p.r1 - p.r0) * E, 7, 8), t.A);
  let m = headPart(i, {
    y: x,
    z: g,
    r: e.head.r,
    snout: e.head.snout,
    snoutR: e.head.snoutR,
    drop: e.head.drop ?? 0.22,
    n: e.head.n ?? 2.5,
    seg: i.seg(14),
    snoutMat: e.head.snoutMat
  });
  earPart(i, {
    y: x,
    z: g - e.head.r * 0.2,
    r: e.head.r,
    kind: e.ear,
    scale: e.earScale ?? 1
  }), faceParts(i, {
    y: x + e.head.r * (e.head.eyeY ?? 0.1),
    z: g + e.head.r * (e.head.eyeZ ?? 0.78),
    eye: e.head.r * (e.head.eye ?? 0.26),
    sep: e.head.r * (e.head.sep ?? 0.44),
    mood: i.d.mood
  });
  let v = e.legKind || "plantigrade";
  for (let E of [-1, 1]) limb(i, {
    x: E * e.stanceF,
    y: e.hipYF,
    z: e.frontZ,
    len: e.legF,
    r: e.legR,
    mat: t.A,
    kind: e.legKindF || v,
    foot: e.footF || e.foot || "paw",
    splay: E * (e.splayF ?? 0.04)
  });
  for (let E of [-1, 1]) limb(i, {
    x: E * e.stanceB,
    y: e.hipYB,
    z: e.backZ,
    len: e.legB,
    r: e.legRB ?? e.legR,
    mat: t.A,
    kind: v,
    foot: e.foot || "paw",
    splay: E * (e.splayB ?? 0.05)
  });
}

function buildSerpent(i) {
  let e = i.d.s,
    t = i.P,
    n = curve(e.spine),
    s = e.rAt;
  i.add(latheGeo(n, s, i.seg(22), i.seg(9)), t.A);
  let r = new Vector3();
  for (let c = 0; c < (e.scutes ?? 8); c++) {
    let h = 0.08 + c / (e.scutes ?? 8) * 0.8;
    n.getPointAt(h, r);
    let d = s(h);
    i.add(xf2(podGeo(d * 0.62, d * 0.42, d * 0.3, 4, 6), {
      x: r.x,
      y: r.y - d * 0.78,
      z: r.z
    }), t.B);
  }
  let o = [];
  for (let c = 0; c <= 5; c++) {
    let h = 1 - c / 5 * 0.94;
    n.getPointAt(Math.max(0.02, h), r), o.push([r.x, r.y, r.z, s(h)]);
  }
  i.spine = curveSampler(o), n.getPointAt(0.86, r), i.anchors.chest = {
    x: r.x,
    y: r.y,
    z: r.z + s(0.86) * 0.6,
    r: s(0.86)
  };
  let a = e.head,
    l = headPart(i, {
      x: a.x ?? 0,
      y: a.y,
      z: a.z,
      r: a.r,
      snout: a.snout ?? 1.2,
      snoutR: a.snoutR ?? 0.62,
      drop: a.drop ?? 0.1,
      n: a.n ?? 2.6,
      seg: i.seg(14),
      nose: !1
    });
  faceParts(i, {
    x: a.x ?? 0,
    y: a.y + a.r * (a.eyeY ?? 0.24),
    z: a.z + a.r * (a.eyeZ ?? 0.72),
    eye: a.r * (a.eye ?? 0.24),
    sep: a.r * (a.sep ?? 0.52),
    mood: i.d.mood
  }), a.frill && earPart(i, {
    x: a.x ?? 0,
    y: a.y,
    z: a.z - a.r * 0.2,
    r: a.r,
    kind: "frill",
    scale: a.frill
  });
}

function buildAvian(i) {
  let e = i.d.a,
    t = i.P,
    n = i.seg(16);
  i.add(xf2(blobGeo(e.body[0], e.body[1], e.body[2], e.n ?? 2.4, n), {
    y: e.bodyY,
    z: e.bodyZ ?? 0,
    rx: e.lean ?? 0
  }), t.A), i.add(xf2(blobGeo(e.body[0] * 0.78, e.body[1] * 0.6, e.body[2] * 0.7, 2.3, n - 3), {
    y: e.bodyY - e.body[1] * 0.3,
    z: (e.bodyZ ?? 0) + e.body[2] * 0.35
  }), t.B);
  for (let c of [-1, 1]) i.add(xf2(blobGeo(e.body[0] * 0.42, e.body[1] * 0.42, e.body[2] * 0.62, 2.6, n - 4), {
    x: c * e.body[0] * 0.72,
    y: e.bodyY + e.body[1] * 0.36,
    z: (e.bodyZ ?? 0) - e.body[2] * 0.1,
    rz: c * 0.3
  }), t.A);
  i.spine = curveSampler([[0, e.neckY, e.neckZ, e.body[0] * 0.55], [0, e.bodyY + e.body[1] * 0.86, (e.bodyZ ?? 0) + e.body[2] * 0.2, e.body[0] * 0.92], [0, e.bodyY + e.body[1] * 0.7, (e.bodyZ ?? 0) - e.body[2] * 0.35, e.body[0] * 0.8], [0, e.bodyY + e.body[1] * 0.2, (e.bodyZ ?? 0) - e.body[2] * 0.95, e.body[0] * 0.45]]), i.anchors.chest = {
    x: 0,
    y: e.bodyY,
    z: (e.bodyZ ?? 0) + e.body[2] * 0.75,
    r: e.body[0]
  }, i.add(latheGeo(curve([[0, e.bodyY + e.body[1] * 0.5, (e.bodyZ ?? 0) + e.body[2] * 0.2], [0, (e.bodyY + e.headY) * 0.5, ((e.bodyZ ?? 0) + e.headZ) * 0.5 - 0.02], [0, e.headY, e.headZ]]), c => e.neckR[0] + (e.neckR[1] - e.neckR[0]) * c, 6, 7), t.A);
  let s = headPart(i, {
      y: e.headY,
      z: e.headZ,
      r: e.headR,
      snout: 0,
      seg: i.seg(13)
    }),
    r = e.beak || {},
    o = r.len ?? e.headR * 1.1,
    a = r.mat === "dark" ? t.DARK : t.LIGHT;
  i.add(xf2(spikeGeo(e.headR * (r.r ?? 0.44), o, 6, r.hook ? o * 0.4 : 0), {
    y: e.headY - e.headR * (r.drop ?? 0.12),
    z: e.headZ + e.headR * 0.6 + o * 0.42,
    rx: HALF_PI + (r.tilt ?? 0)
  }), a), i.add(xf2(spikeGeo(e.headR * (r.r ?? 0.44) * 0.62, o * 0.62, 5), {
    y: e.headY - e.headR * ((r.drop ?? 0.12) + 0.3),
    z: e.headZ + e.headR * 0.6 + o * 0.3,
    rx: HALF_PI - 0.12
  }), a), faceParts(i, {
    y: e.headY + e.headR * (e.eyeY ?? 0.12),
    z: e.headZ + e.headR * (e.eyeZ ?? 0.62),
    eye: e.headR * (e.eye ?? 0.3),
    sep: e.headR * (e.sep ?? 0.62),
    mood: i.d.mood
  });
  let l = e.tail || {
    n: 3,
    len: 0.5,
    w: 0.16
  };
  for (let c = 0; c < l.n; c++) {
    let h = l.n === 1 ? 0 : c / (l.n - 1) - 0.5;
    i.add(xf2(profile(l.len * (1 - Math.abs(h) * 0.3), l.w, 0.25, 8), {
      x: h * l.w * 1.5,
      y: e.bodyY - e.body[1] * 0.2,
      z: (e.bodyZ ?? 0) - e.body[2] * 0.8,
      rx: -2 + (l.rx ?? 0),
      rz: h * 0.7
    }), t.B);
  }
  // Every avian used to hang its legs from the design's own hipY, which sat
  // below the belly: five creatures — including the legendary and a boss —
  // rendered as a floating body with a detached pair of legs under it. The hip
  // belongs just inside the underside, and the leg reaches the ground from
  // there, so the length follows from the body rather than being set by hand.
  let belly = e.bodyY - e.body[1] * 0.58,
    hipY = Math.max(e.hipY ?? belly, belly),
    legLen = Math.max(0.08, hipY - (e.footY ?? 0));
  for (let c of [-1, 1]) {
    // A haunch blends the leg into the body; without it even a correctly
    // placed leg reads as a stick pushed into a balloon.
    i.add(xf2(blobGeo(e.body[0] * 0.3, e.body[1] * 0.34, e.body[2] * 0.34, 2.5, n - 5), {
      x: c * e.stance * 1.15,
      y: hipY + e.body[1] * 0.16,
      z: (e.legZ ?? 0) - e.body[2] * 0.04
    }), t.A);
    limb(i, {
      x: c * e.stance,
      y: hipY,
      z: e.legZ ?? 0,
      len: legLen,
      r: e.legR,
      mat: e.legMat === "dark" ? t.DARK : t.LIGHT,
      kind: "bird",
      foot: "talon",
      splay: c * 0.06
    });
  }
  buildWings(i, e.wing);
}

/**
 * A wing built from solid feathers.
 *
 * This is the mane lesson again. The old wing was `finProfile` sheets — zero
 * thickness, all sharing one plane — so from most angles it was a two-pixel
 * line and the bird read as plucked. Raising or sweeping the sheets does not
 * help: a sheet is thin from every direction except straight on.
 *
 * Each feather is a flattened ellipsoid instead: still thin, but never
 * *nothing*, and it catches light on its rounded edge. They are fanned in the
 * horizontal plane with the middle ones longest, which is where the wing shape
 * actually comes from, and a dark quill along the leading edge gives the
 * silhouette a spine.
 */
function buildWings(i, e) {
  if (!e) return;
  let t = i.P,
    n = e.tint === "a" ? i.sp.model.a : e.tint === "acc" ? t.accent : i.sp.model.b,
    s = e.glass ? mat(n, {
      roughness: 0.25,
      transparent: !0,
      opacity: 0.72,
      env: 1.4
    }) : mat(n, {
      roughness: 0.5,
      env: 1
    }),
    count = Math.max(4, Math.round(e.feathers ?? 4 + e.span * 3)),
    spread = e.spread ?? 1.45,          // radians covered by the fan
    back = e.back ?? 0.34;              // how far the fan is rotated backwards
  for (let side of [-1, 1]) {
    let parts = [];
    // The covert: a mass at the shoulder so the wing grows out of the bird
    // rather than being stuck onto it.
    parts.push({
      geo: xf2(blobGeo(e.chord * 0.36, e.chord * 0.34, e.chord * 0.44, 2.4, 9), {
        y: e.chord * 0.02,
        z: -e.chord * 0.04
      }),
      mat: s
    });
    for (let k = 0; k < count; k++) {
      let u = count === 1 ? 0.5 : k / (count - 1),
        // Longest through the middle of the fan, like a real primary sequence.
        len = e.span * (0.56 + 0.44 * Math.sin(Math.PI * (0.22 + u * 0.66))),
        w = e.chord * (0.3 - u * 0.11),
        ang = -back + spread * (u - 0.5) * 2 * 0.5,   // fan back around +X
        lift = (0.5 - Math.abs(u - 0.5)) * e.chord * 0.3;
      parts.push({
        // A flattened ellipsoid: thin, but with a rounded edge that always
        // catches light. `profile` sheets here disappear edge-on.
        geo: xf2(blobGeo(len * 0.5, w * 0.5, Math.max(0.012, w * 0.17), 2.2, 9), {
          x: Math.cos(ang) * len * 0.5 + e.chord * 0.12,
          y: lift + e.chord * 0.04,
          z: Math.sin(ang) * len * 0.5 - e.chord * 0.1,
          ry: -ang,
          rz: (e.tilt ?? 0.12) * (u - 0.4)
        }),
        mat: s
      });
    }
    if (e.bone !== !1) parts.push({
      geo: xf2(taperGeo(0.016, 0.04, e.span * 0.8, 6), {
        x: e.span * 0.4 + e.chord * 0.1,
        y: e.chord * 0.13,
        z: -e.chord * 0.14,
        rz: HALF_PI,
        ry: -0.12
      }),
      mat: t.DARK
    });
    let node = mergeByMaterial(parts, {
      castShadow: !1
    });
    node.position.set(side * (e.root ?? 0.14), e.y, e.z ?? 0);
    node.scale.x = side;
    node.rotation.z = side * (e.dihedral ?? 0.22);
    node.rotation.y = side * (e.sweep ?? -0.3);
    node.userData.noOutline = !!e.glass;
    i.group.add(node);
    i.rig.wings.push({
      node,
      side
    });
  }
}

function buildGolem(i) {
  let e = i.d.g,
    t = i.P,
    n = i.seg(14),
    [s, r, o] = e.torso,
    a = e.torsoMat === "b" ? t.B : t.A,
    l = e.torsoMat === "b" ? t.A : t.B;
  i.add(xf2(blobGeo(s, r, o, e.hard ?? 5, n), {
    y: e.torsoY
  }), a), i.add(xf2(blobGeo(s * (e.shoulderW ?? 1.12), r * 0.3, o * 1.05, (e.hard ?? 5) + 1.4, n), {
    y: e.torsoY + r * 0.82
  }), l), i.add(xf2(blobGeo(s * 0.72, r * 0.5, o * 0.8, 4.4, n - 2), {
    y: e.torsoY - r * 0.92
  }), l), e.lopsided && i.add(xf2(blobGeo(s * 0.5, r * 0.42, o * 0.62, 4, n - 3), {
    x: s * e.lopsided,
    y: e.torsoY + r * 0.72,
    z: -o * 0.1
  }), a), i.spine = curveSampler([[0, e.torsoY + r * 1, o * 0.3, s * 0.95], [0, e.torsoY + r * 0.92, 0, s], [0, e.torsoY + r * 0.2, -o * 0.15, s * 0.95], [0, e.torsoY - r * 0.7, -o * 0.2, s * 0.75]]), i.anchors.chest = {
    x: 0,
    y: e.torsoY + r * 0.1,
    z: o,
    r: s
  };
  let c = headPart(i, {
    y: e.headY,
    z: e.headZ ?? 0,
    r: e.headR,
    snout: e.snout ?? 0.2,
    snoutR: e.snoutR ?? 0.7,
    drop: 0.1,
    n: e.headHard ?? 3.8,
    seg: i.seg(13),
    jaw: !1,
    nose: !1,
    mat: a,
    mat2: l
  });
  e.visor ? (i.add(xf2(podGeo(e.headR * 0.78, e.headR * 0.14, e.headR * 0.3, 3.6, 8), {
    y: e.headY + e.headR * 0.05,
    z: (e.headZ ?? 0) + e.headR * 0.82
  }), t.DARK), i.add(xf2(podGeo(e.headR * 0.6, e.headR * 0.07, e.headR * 0.18, 3.2, 6), {
    y: e.headY + e.headR * 0.05,
    z: (e.headZ ?? 0) + e.headR * 0.92
  }), t.HOT)) : faceParts(i, {
    y: e.headY + e.headR * (e.eyeY ?? 0.02),
    z: (e.headZ ?? 0) + e.headR * (e.eyeZ ?? 0.8),
    eye: e.headR * (e.eye ?? 0.24),
    sep: e.headR * (e.sep ?? 0.42),
    mood: i.d.mood
  });
  for (let h of [-1, 1]) {
    let u = e.bigArm && h === e.bigArm ? e.bigArmScale ?? 1.55 : 1,
      f = [];
    f.push({
      geo: xf2(blobGeo(e.armR * 1.45 * u, e.armR * 1.2 * u, e.armR * 1.4 * u, 5.4, 9), {
        y: 0,
        rz: h * 0.2
      }),
      mat: l
    }), f.push({
      geo: xf2(blobGeo(e.armR * 1 * u, e.armLen * 0.32, e.armR * 1 * u, 5, 9), {
        y: -e.armLen * 0.32
      }),
      mat: a
    }), f.push({
      geo: xf2(blobGeo(e.armR * 1.18 * u, e.armLen * 0.3, e.armR * 1.18 * u, 4.6, 9), {
        y: -e.armLen * 0.8
      }),
      mat: a
    }), f.push({
      geo: xf2(blobGeo(e.armR * 1.6 * u, e.armR * 1.5 * u, e.armR * 1.5 * u, 4.8, 9), {
        y: -e.armLen * 1.12,
        z: e.armR * 0.25
      }),
      mat: l
    }), f.push({
      geo: xf2(podGeo(e.armR * 1.5 * u, e.armR * 0.5 * u, e.armR * 0.35 * u, 4.4, 7), {
        y: -e.armLen * 0.58
      }),
      mat: t.DARK
    });
    let p = mergeByMaterial(f);
    p.position.set(h * (s * (e.shoulderW ?? 1.12) + e.armR * 0.9 * u), e.torsoY + r * 0.72, 0), i.group.add(p), i.rig.wings.push({
      node: p,
      side: h,
      isArm: !0
    });
  }
  if (e.float) i.group.userData.floats = !0;else for (let h of [-1, 1]) limb(i, {
    x: h * e.stance,
    y: e.hipY,
    z: 0,
    len: e.legLen,
    r: e.legR,
    mat: a,
    kind: e.legKind || "column",
    foot: e.foot || "slab",
    splay: h * 0.05
  });
}

function buildBlob(i) {
  let e = i.d.b,
    t = i.P,
    n = curve(e.axis);
  i.add(latheGeo(n, o => e.rAt(o), i.seg(16), i.seg(12), {
    squash: e.squash ?? 1
  }), t.A), i.add(xf2(blobGeo(e.rAt(0.25) * 0.78, e.rAt(0.25) * 0.4, e.rAt(0.25) * 0.66, 2.5, i.seg(12)), {
    y: e.footY,
    z: e.rAt(0.25) * 0.45
  }), t.B);
  let s = new Vector3(),
    r = [];
  for (let o = 0; o <= 4; o++) {
    let a = 0.9 - o * 0.2;
    n.getPointAt(Math.max(0.02, a), s), r.push([s.x, s.y, s.z - e.rAt(a) * 0.3, e.rAt(a)]);
  }
  if (i.spine = curveSampler(r), n.getPointAt(0.45, s), i.anchors.chest = {
    x: 0,
    y: s.y,
    z: s.z + e.rAt(0.45) * 0.7,
    r: e.rAt(0.45)
  }, i.anchors.head = {
    x: 0,
    y: e.faceY,
    z: e.rAt(e.faceT) * 0.92,
    r: e.rAt(e.faceT)
  }, faceParts(i, {
    y: e.faceY,
    z: e.rAt(e.faceT) * (e.faceZ ?? 0.88),
    eye: e.eye,
    sep: e.sep,
    mood: i.d.mood
  }), e.mouth && i.add(xf2(podGeo(e.eye * 1.1, e.eye * 0.28, e.eye * 0.3, 3, 7), {
    y: e.faceY - e.eye * 2.2,
    z: e.rAt(e.faceT) * 0.88
  }), t.DARK), e.legs) for (let o of [-1, 1]) limb(i, {
    x: o * e.legs.stance,
    y: e.legs.hipY,
    z: e.legs.z ?? 0,
    len: e.legs.len,
    r: e.legs.r,
    mat: t.B,
    kind: "plantigrade",
    foot: e.legs.foot || "paw",
    splay: o * 0.1
  });
}

function buildInsect(i) {
  let e = i.d.i,
    t = i.P,
    n = i.seg(13);
  i.add(xf2(blobGeo(e.thorax[0], e.thorax[1], e.thorax[2], 2.5, n + 2), {
    y: e.y,
    z: e.thoraxZ
  }), t.A);
  let s = e.abdomen.n ?? 3;
  for (let a = 0; a < s; a++) {
    let l = a / Math.max(1, s - 1),
      c = 1 - l * (e.abdomen.taper ?? 0.45);
    i.add(xf2(blobGeo(e.abdomen.r * c, e.abdomen.r * c * 0.9, e.abdomen.r * c * 0.85, 2.6, n), {
      y: e.y + (e.abdomen.rise ?? 0) * l,
      z: e.thoraxZ - e.thorax[2] * 0.9 - a * e.abdomen.r * 1.25
    }), a % 2 ? t.B : t.A);
  }
  i.spine = curveSampler([[0, e.y + e.thorax[1] * 0.9, e.thoraxZ + e.thorax[2] * 0.5, e.thorax[0]], [0, e.y + e.thorax[1] * 0.85, e.thoraxZ, e.thorax[0]], [0, e.y + e.abdomen.r * 0.85, e.thoraxZ - e.thorax[2] - e.abdomen.r, e.abdomen.r], [0, e.y + e.abdomen.r * 0.6 + (e.abdomen.rise ?? 0), e.thoraxZ - e.thorax[2] - e.abdomen.r * 2.6, e.abdomen.r * 0.6]]), i.anchors.chest = {
    x: 0,
    y: e.y,
    z: e.thoraxZ + e.thorax[2] * 0.8,
    r: e.thorax[0]
  };
  let r = e.thoraxZ + e.thorax[2] + e.headR * 0.7;
  if (i.add(xf2(blobGeo(e.headR, e.headR * 0.9, e.headR * 0.95, 2.4, n), {
    y: e.y + (e.headRise ?? 0),
    z: r
  }), t.A), i.anchors.head = {
    x: 0,
    y: e.y + (e.headRise ?? 0),
    z: r,
    r: e.headR
  }, faceParts(i, {
    y: e.y + (e.headRise ?? 0) + e.headR * 0.1,
    z: r + e.headR * 0.62,
    eye: e.headR * (e.eye ?? 0.62),
    sep: e.headR * (e.sep ?? 0.6),
    mood: i.d.mood,
    brow: !1
  }), e.mandibles) for (let a of [-1, 1]) i.add(xf2(spikeGeo(e.headR * 0.2, e.headR * 1.5, 5, e.headR * 0.55), {
    x: a * e.headR * 0.5,
    y: e.y + (e.headRise ?? 0) - e.headR * 0.55,
    z: r + e.headR * 0.5,
    rx: HALF_PI - 0.2,
    rz: a * 0.5,
    ry: a * 0.4
  }), t.DARK);
  if (e.antennae) for (let a of [-1, 1]) {
    let l = curve([[a * e.headR * 0.36, e.y + (e.headRise ?? 0) + e.headR * 0.7, r], [a * e.headR * 0.9, e.y + (e.headRise ?? 0) + e.headR * 1.5, r + e.headR * 0.2], [a * e.headR * 1.5, e.y + (e.headRise ?? 0) + e.headR * 2, r - e.headR * 0.2]]);
    if (i.add(latheGeo(l, c => e.headR * 0.09 * (1 - c * 0.6), 6, 5), t.DARK), e.antennae === "plume") for (let c = 0; c < 5; c++) {
      let h = 0.2 + c * 0.18,
        d = l.getPointAt(h);
      i.add(xf2(profile(e.headR * 0.5, e.headR * 0.16, 0.4, 5), {
        x: d.x,
        y: d.y,
        z: d.z,
        rz: a * 1.2,
        rx: -0.4,
        ry: a * 0.3
      }), t.B);
    }
  }
  let o = [e.thoraxZ + e.thorax[2] * 0.55, e.thoraxZ, e.thoraxZ - e.thorax[2] * 0.6];
  for (let a = 0; a < 3; a++) for (let l of [-1, 1]) limb(i, {
    x: l * e.thorax[0] * 0.85,
    y: e.y - e.thorax[1] * 0.2,
    z: o[a],
    len: e.legLen * (a === 1 ? 1.06 : 1),
    r: e.legR,
    mat: t.DARK,
    kind: "insect",
    foot: "claw",
    splay: l * (0.5 + a * 0.05),
    yaw: l * (0.4 - a * 0.4),
    outline: !1
  });
  buildWings(i, e.wing);
}

function buildSprite(i) {
  let e = i.d.p,
    t = i.P,
    n = i.seg(16);
  if (e.axis ? i.add(latheGeo(curve(e.axis), s => e.rAt(s), i.seg(14), i.seg(11)), t.A) : i.add(xf2(blobGeo(e.r[0], e.r[1], e.r[2], e.n ?? 2.2, n), {
    y: e.y
  }), t.A), e.hood && (i.add(latheGeo(curve(e.hood.axis), s => e.hood.rAt(s), i.seg(12), i.seg(12)), t.A), i.add(xf2(new SphereGeometry(e.hood.voidR, 9, 7), {
    y: e.hood.voidY,
    z: e.hood.voidZ ?? 0
  }), t.DARK)), i.spine = curveSampler([[0, e.y + (e.r ? e.r[1] : 0.3) * 0.9, (e.r ? e.r[2] : 0.3) * 0.3, e.r ? e.r[0] : 0.3], [0, e.y, 0, (e.r ? e.r[0] : 0.3) * 1], [0, e.y - (e.r ? e.r[1] : 0.3) * 0.6, -(e.r ? e.r[2] : 0.3) * 0.4, (e.r ? e.r[0] : 0.3) * 0.8]]), i.anchors.chest = {
    x: 0,
    y: e.y,
    z: (e.r ? e.r[2] : 0.3) * 0.9,
    r: e.r ? e.r[0] : 0.3
  }, i.anchors.head = {
    x: 0,
    y: e.faceY,
    z: e.faceZ,
    r: e.headR ?? (e.r ? e.r[0] : 0.3)
  }, e.faceKind === "void" ? tuft(i, {
    y: e.faceY,
    z: e.faceZ,
    n: e.voidEyes ?? 5,
    r: e.eye * 0.55,
    spread: e.sep * 1.5,
    mat: t.HOT
  }) : faceParts(i, {
    y: e.faceY,
    z: e.faceZ,
    eye: e.eye,
    sep: e.sep,
    mood: i.d.mood,
    brow: e.brow !== !1
  }), e.ring) {
    let s = [],
      r = e.ring.n ?? 5;
    for (let l = 0; l < r; l++) {
      let c = l / r * TAU,
        h = 0.78 + l % 3 * 0.16;
      s.push({
        geo: xf2(e.ring.kind === "blade" ? profile(e.ring.len * h, e.ring.w * h, 0.4, 7) : UNIT_OCTA, {
          x: Math.cos(c) * e.ring.r,
          z: Math.sin(c) * e.ring.r,
          y: Math.sin(c * 2 + 0.6) * (e.ring.wobble ?? 0.12),
          rx: e.ring.kind === "blade" ? -HALF_PI : c * 0.8,
          ry: e.ring.kind === "blade" ? -c + HALF_PI : c * 1.7,
          rz: e.ring.kind === "blade" ? 0 : 0.5,
          sx: e.ring.kind === "blade" ? 1 : e.ring.w * h,
          sy: e.ring.kind === "blade" ? 1 : e.ring.len * h,
          sz: e.ring.kind === "blade" ? 1 : e.ring.w * h * 0.7
        }),
        mat: e.ring.mat === "hot" ? t.HOT : e.ring.mat === "acc" ? t.ACC : t.B
      });
    }
    let o = new Group(),
      a = mergeByMaterial(s);
    a.userData.noOutline = !0, o.add(a), o.position.y = e.ring.y, o.rotation.z = e.ring.tilt ?? 0.16, o.userData.orbit = 0.5, i.group.add(o), i.rig.tail = o;
  }
  i.group.userData.floats = !0;
}

function buildTail(i, e) {
  if (!e) return;
  let t = i.P,
    n = [],
    s = curve(e.axis || [[0, 0, 0], [0, e.len * 0.45, -e.len * 0.12], [0, e.len * 0.85, -e.len * 0.05], [0, e.len, e.len * 0.1]]);
  if (n.push({
    geo: latheGeo(s, a => e.r * (1 - a * (e.taper ?? 0.8)) + 0.006, 10, 6),
    mat: e.mat === "b" ? t.B : t.A
  }), e.tuft) for (let a = 0; a < 4; a++) {
    let l = a / 4 * TAU;
    n.push({
      geo: xf2(profile(e.len * 0.4, e.len * 0.16, 0.4, 6), {
        x: Math.cos(l) * e.r * 0.6,
        y: e.len * 0.9,
        z: Math.sin(l) * e.r * 0.6,
        rz: l * 0.4,
        rx: -0.2
      }),
      mat: t.B
    });
  }
  let r = new Group(),
    o = mergeByMaterial(n);
  if (r.add(o), e.tip) {
    let a = [];
    if (e.tip === "flame") {
      let c = e.len;
      a.push({
        geo: xf2(spikeGeo(e.r * 1.5, c * 1.25, 7, 0.3), {
          y: c * 1.5
        }),
        mat: t.ACC
      }), a.push({
        geo: xf2(spikeGeo(e.r * 0.85, c * 0.95, 6, 0.35), {
          y: c * 1.42,
          z: e.r * 0.5
        }),
        mat: t.HOT
      });
      for (let h of [-1, 1]) a.push({
        geo: xf2(spikeGeo(e.r * 0.8, c * 0.72, 5, 0.5), {
          x: h * e.r * 1.25,
          y: c * 1.24,
          rz: -h * 0.62
        }),
        mat: t.ACC
      }), a.push({
        geo: xf2(spikeGeo(e.r * 0.5, c * 0.44, 5, 0.6), {
          x: h * e.r * 1.9,
          y: c * 1.06,
          rz: -h * 1.05
        }),
        mat: t.HOT
      });
    } else if (e.tip === "bolt") a.push({
      geo: xf2(UNIT_OCTA, {
        y: e.len * 1.1,
        sx: e.r * 1.6,
        sy: e.len * 0.5,
        sz: e.r * 1.2
      }),
      mat: t.HOT
    }), a.push({
      geo: xf2(UNIT_OCTA, {
        x: e.r * 2,
        y: e.len * 0.95,
        sx: e.r * 1,
        sy: e.len * 0.3,
        sz: e.r * 0.8,
        rz: -0.8
      }),
      mat: t.ACC
    });else if (e.tip === "fluke") for (let c of [-1, 1]) a.push({
      geo: xf2(profile(e.len * 0.62, e.len * 0.3, 0.4, 9), {
        y: e.len * 0.94,
        rz: c * 1,
        rx: -0.2
      }),
      mat: t.ACC
    });else if (e.tip === "club") {
      a.push({
        geo: xf2(blobGeo(e.r * 2.4, e.r * 2.6, e.r * 2.4, 3.4, 10), {
          y: e.len * 1.06
        }),
        mat: t.B
      });
      for (let c = 0; c < 4; c++) {
        let h = c / 4 * TAU;
        a.push({
          geo: xf2(spikeGeo(e.r * 0.7, e.r * 2.4, 4), {
            x: Math.cos(h) * e.r * 2.2,
            y: e.len * 1.06,
            z: Math.sin(h) * e.r * 2.2,
            rz: -Math.cos(h) * 1.3,
            rx: Math.sin(h) * 1.3
          }),
          mat: t.DARK
        });
      }
    }
    let l = mergeByMaterial(a, {
      castShadow: !1
    });
    l.userData.noOutline = e.tip !== "club", r.add(l);
  }
  r.position.set(e.x ?? 0, e.y, e.z), r.rotation.x = e.rx ?? -0.9, i.group.add(r), i.rig.tail = r;
}

export { ELEMENT_KITS, PART_BUILDERS, STANCES, UNIT_OCTA, applyElementKit, beads, buildAvian, buildBlob, buildGolem, buildInsect, buildQuad, buildSerpent, buildSprite, buildTail, buildWings, crest, curve, curveAt, curveSampler, earPart, faceParts, finPair, flameFan, frills, gear, halo, headPart, latheGeo, limb, mane, maw, palette, petals, podGeo, puff, shellHalves, speciesPalette, spikeGeo, spines, studs, sweep, tuft, whiskers, wingPair };
