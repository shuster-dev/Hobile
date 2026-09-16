import { AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, CylinderGeometry, DodecahedronGeometry, DoubleSide, Float32BufferAttribute, Fog, FrontSide, Group, InstancedMesh, MathUtils, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, OctahedronGeometry, PerspectiveCamera, PlaneGeometry, PointLight, Points, RingGeometry, Scene, ShaderMaterial, Sphere, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { QUALITY, aimSun, blobGeo, glowMat, makeEnvironment, makeLights, makeRenderer, makeSky, mat, mergeByMaterial, mergeGeometries, profile, sizeRenderer, softShadowTexture, xf2 } from './core.js';
import { animateCreature, buildAvatar, buildCreature, setCreatureLod } from './creatures.js';
import { AVATAR, SPECIES, ZONES } from '../../shared/gamedata.js';
import { NPCS, npcList } from '../../shared/npcs.js';
import { BLOCK, CURB_IN, CURB_OUT, EDGE_Y, LAMP_SPACING, PLAZA, SIDEWALK, STREET_Y, TAU_G, blockGrid, curbHeight, fbm, gridOffset, hash, heightAt, mixHex, plazaHeight, plazaOf, propsFor, resolveCollision, rng, smoothBand } from '../../shared/props.js';

var PartBuilder = class {
  constructor() {
    this.parts = [], this.pos = [], this.nor = [], this.col = [], this._c = new Color();
  }
  get empty() {
    return !this.parts.length && !this.pos.length;
  }
  add(e, t) {
    let n = e.index ? e.toNonIndexed() : e,
      s = new BufferGeometry();
    s.setAttribute("position", n.attributes.position), n.attributes.normal ? s.setAttribute("normal", n.attributes.normal) : s.computeVertexNormals();
    let r = s.attributes.position.count,
      o = new Float32Array(r * 3),
      a = this._c.set(t);
    for (let l = 0; l < r; l++) o[l * 3] = a.r, o[l * 3 + 1] = a.g, o[l * 3 + 2] = a.b;
    return s.setAttribute("color", new BufferAttribute(o, 3)), this.parts.push(s), this;
  }
  box(e, t, n, s, r) {
    return this.add(xf2(new BoxGeometry(e, t, n), s), r);
  }
  quad(e, t, n, s, r) {
    let o = t[0] - e[0],
      a = t[1] - e[1],
      l = t[2] - e[2],
      c = s[0] - e[0],
      h = s[1] - e[1],
      d = s[2] - e[2],
      u = h * l - d * a,
      f = d * o - c * l,
      p = c * a - h * o,
      x = Math.hypot(u, f, p) || 1;
    u /= x, f /= x, p /= x;
    let g = this._c.set(r);
    for (let m of [e, s, n, e, n, t]) this.pos.push(m[0], m[1], m[2]), this.nor.push(u, f, p), this.col.push(g.r, g.g, g.b);
    return this;
  }
  put(e, t) {
    for (let n of e.parts) this.parts.push(xf2(n, t));
    return this;
  }
  mesh(e, {
    cast: t = !0,
    receive: n = !0
  } = {}) {
    let s = [...this.parts];
    if (this.pos.length) {
      let a = new BufferGeometry();
      a.setAttribute("position", new Float32BufferAttribute(this.pos, 3)), a.setAttribute("normal", new Float32BufferAttribute(this.nor, 3)), a.setAttribute("color", new Float32BufferAttribute(this.col, 3)), s.push(a);
    }
    if (!s.length) return null;
    let r = s.length === 1 ? s[0] : mergeGeometries(s, !1);
    if (!r) return null;
    r.computeBoundingSphere();
    let o = new Mesh(r, e);
    return o.castShadow = t, o.receiveShadow = n, o;
  }
};

function vertexColorMat(i = {}) {
  return new MeshStandardMaterial({
    vertexColors: !0,
    roughness: i.roughness ?? 0.88,
    metalness: i.metalness ?? 0.02,
    envMapIntensity: i.env ?? 0.6,
    flatShading: i.flat ?? !1,
    emissive: i.emissive ?? 0,
    emissiveIntensity: i.emissiveIntensity ?? 1,
    transparent: i.transparent ?? !1,
    opacity: i.opacity ?? 1,
    side: i.side ?? FrontSide
  });
}

function buildGroundMesh(i, e, t, n) {
  let s = i.size / 2,
    r = blockGrid(i.size).filter(S => Math.abs(S) < s + BLOCK),
    o = 1201,
    a = i.landmarks.find(S => S.kind === "plaza"),
    l = (S, b) => a && Math.hypot(S - a.x, b - a.z) < a.r,
    c = S => {
      let b = [-S, S];
      for (let y of r) for (let M of [-LAMP_SPACING, -CURB_OUT, -CURB_IN, CURB_IN, CURB_OUT, LAMP_SPACING]) {
        let P = y + M;
        P > -S && P < S && b.push(P);
      }
      for (let y = -S + 3.2; y < S; y += 3.2) b.push(y);
      b.sort((y, M) => y - M);
      let T = [];
      for (let y of b) (!T.length || y - T[T.length - 1] > 0.12) && T.push(y);
      return T;
    },
    h = c(s),
    d = c(s),
    u = e.asphalt,
    f = e.asphalt2,
    p = e.kerb,
    x = e.pave,
    g = e.pave2,
    m = e.yard,
    v = (S, b) => t(S, b) + 0.012;
  for (let S = 0; S < h.length - 1; S++) for (let b = 0; b < d.length - 1; b++) {
    let T = h[S],
      y = h[S + 1],
      M = d[b],
      P = d[b + 1],
      A = (T + y) / 2,
      k = (M + P) / 2;
    if (k < EDGE_Y + 0.6) continue;
    let L = Math.min(gridOffset(A), gridOffset(k)),
      O = Math.hypot(A, k);
    if (O > SIDEWALK && L > CURB_OUT || O > s - 2) continue;
    let B = fbm(A * 0.35, k * 0.35, o, 2),
      W;
    if (a && l(A, k)) {
      let j = Math.hypot(A - a.x, k - a.z);
      W = Math.floor(j / 1.6 + B * 0.9) % 2 ? e.flag : e.flag2, j < 3.4 && (W = e.flagDark);
    } else L < CURB_IN ? W = B > 0.04 ? f : u : L < CURB_OUT ? W = p : L < LAMP_SPACING ? W = B > 0.02 ? g : x : W = O > SIDEWALK - 6 ? tintHex(m, e.dirt, smoothBand(SIDEWALK - 6, SIDEWALK + 2, O)) : m;
    n.quad([T, v(T, M), M], [y, v(y, M), M], [y, v(y, P), P], [T, v(T, P), P], W);
  }
  let E = (S, b) => t(S, b) + 0.028,
    _ = (S, b, T, y, M) => {
      Math.min(b, y) < EDGE_Y + 2 || n.quad([S, E(S, b), b], [T, E(T, b), b], [T, E(T, y), y], [S, E(S, y), y], M);
    };
  for (let S of r) if (!(Math.abs(S) > s - 4)) for (let b = -s + 4; b < s - 4; b += 4.4) r.some(y => Math.abs(b + 1.1 - y) < CURB_IN + 2.2) || (b > EDGE_Y && Math.hypot(S, b) < s - 3 && !l(S, b + 1.1) && _(S - 0.11, b, S + 0.11, b + 2.2, e.line), Math.hypot(b, S) < s - 3 && S > EDGE_Y && !l(b + 1.1, S) && _(b, S - 0.11, b + 2.2, S + 0.11, e.line));
  for (let S of r) for (let b of r) if (!(Math.hypot(S, b) > SIDEWALK - 4) && !(a && Math.hypot(S - a.x, b - a.z) < a.r + 3)) for (let T of [-1, 1]) for (let y = 0; y < 5; y++) {
    let M = -CURB_IN + 0.55 + y * 1.35;
    _(S + M, b + T * (CURB_OUT + 0.35), S + M + 0.62, b + T * (CURB_OUT + 2), e.line), _(S + T * (CURB_OUT + 0.35), b + M, S + T * (CURB_OUT + 2), b + M + 0.62, e.line);
  }
  for (let S of r) for (let b = -s + 4; b < s - 4; b += 3.2) if (!(Math.hypot(S, b) > SIDEWALK)) for (let T of [-1, 1]) _(S + T * CURB_OUT, b - 0.05, S + T * LAMP_SPACING, b + 0.05, e.joint), _(b - 0.05, S + T * CURB_OUT, b + 0.05, S + T * LAMP_SPACING, e.joint);
  for (let S of r) for (let b = -s + 10; b < s - 10; b += 12) for (let [T, y] of [[S, b], [b, S]]) {
    if (y < EDGE_Y + 2 || Math.hypot(T, y) > SIDEWALK) continue;
    let M = Math.sign(fbm(T * 0.5, y * 0.5, 7, 1)) || 1,
      P = gridOffset(T) < CURB_IN ? T + M * (CURB_IN - 0.32) : T,
      A = gridOffset(T) < CURB_IN ? y : y + M * (CURB_IN - 0.32);
    _(P - 0.28, A - 0.5, P + 0.28, A + 0.5, e.drain), n.add(xf2(new CylinderGeometry(0.42, 0.42, 0.05, 10), {
      x: T - M * 1.4,
      y: t(T, y) + 0.03,
      z: y + M * 1.1
    }), e.drain);
  }
  return n;
}

function buildBuildingBlock(i, e, t, n, s, r, o, a) {
  let l = Math.abs(Math.cos(i.facing)) > 0.5,
    c = l ? i.w : i.d,
    h = l ? i.d : i.w,
    d = i.h,
    u = Math.max(1, i.floors),
    f = Math.min(r(i.x - i.w / 2, i.z - i.d / 2), r(i.x + i.w / 2, i.z - i.d / 2), r(i.x - i.w / 2, i.z + i.d / 2), r(i.x + i.w / 2, i.z + i.d / 2)),
    p = {
      x: i.x,
      y: f,
      z: i.z,
      ry: i.facing
    },
    x = Math.cos(i.facing),
    g = Math.sin(i.facing),
    m = K => ({
      x: p.x + (K.x || 0) * x + (K.z || 0) * g,
      y: f + (K.y || 0),
      z: p.z - (K.x || 0) * g + (K.z || 0) * x,
      ry: (K.ry || 0) + i.facing
    }),
    v = (K, U, N, X, Y) => e.box(K, U, N, m(X), Y),
    E = i.wall,
    _ = i.trim,
    S = i.roof,
    b = tintHex(E, 1316380, 0.35),
    T = Math.min(4.4, d / u * 1.3),
    y = u > 1 ? (d - T) / (u - 1) : d,
    M = h / 2,
    P = M + 0.07;
  v(c + 0.34, 0.42, h + 0.34, {
    y: 0.21
  }, tintHex(_, 0, 0.15)), v(c, d, h, {
    y: d / 2
  }, E), v(c + 0.14, T, h + 0.14, {
    y: T / 2
  }, tintHex(E, o.stone, 0.45)), v(c + 0.22, 0.18, h + 0.22, {
    y: T
  }, _);
  for (let K = 1; K < u - 1; K++) v(c + 0.1, 0.12, h + 0.1, {
    y: T + y * K
  }, tintHex(_, E, 0.35));
  v(c + 0.44, 0.26, h + 0.44, {
    y: d + 0.02
  }, _);
  let A = 0.62 + i.seed * 0.5;
  v(c + 0.2, A, h + 0.2, {
    y: d + 0.15 + A / 2
  }, tintHex(E, _, 0.4)), v(c - 0.3, 0.12, h - 0.3, {
    y: d + 0.2
  }, S);
  let k = Math.max(1, Math.min(5, Math.floor(c / 1.85))),
    L = c / k,
    O = Math.min(1.02, L * 0.5);
  for (let K = 0; K < u - 1; K++) {
    let U = T + y * K + y * 0.52,
      N = Math.min(1.62, y * 0.6);
    for (let X = 0; X < k; X++) {
      let Y = -c / 2 + L * (X + 0.5),
        ce = xf2(new PlaneGeometry(O, N), m({
          x: Y,
          y: U,
          z: M + 0.015
        })),
        Ee = jitter(i, K, X);
      if ((Ee < 0 ? t : n[Ee]).add(ce, o.glass), a) {
        v(O + 0.34, 0.17, 0.34, {
          x: Y,
          y: U - N / 2 - 0.08,
          z: M + 0.1
        }, _), v(O + 0.34, 0.15, 0.26, {
          x: Y,
          y: U + N / 2 + 0.08,
          z: M + 0.07
        }, _);
        for (let Pe of [-1, 1]) v(0.15, N + 0.16, 0.22, {
          x: Y + Pe * (O / 2 + 0.07),
          y: U,
          z: M + 0.06
        }, tintHex(_, E, 0.3));
      } else v(O + 0.3, 0.14, 0.16, {
        x: Y,
        y: U - N / 2 - 0.07,
        z: M + 0.06
      }, _);
    }
  }
  if (i.kind !== "block") return;
  if (i.shop) {
    let K = c - 0.9;
    v(K + 0.3, 0.55, 0.3, {
      y: 0.5,
      z: P + 0.1
    }, tintHex(_, 0, 0.2)), t.add(xf2(new PlaneGeometry(K, T - 2), m({
      y: 0.78 + (T - 2) / 2,
      z: P + 0.02
    })), o.shopGlass);
    for (let X = 1; X < 3; X++) v(0.12, T - 2, 0.16, {
      x: -K / 2 + K / 3 * X,
      y: 0.78 + (T - 2) / 2,
      z: P + 0.09
    }, _);
    for (let X of [-1, 1]) v(0.34, T - 1.9, 0.2, {
      x: X * (K / 2 + 0.1),
      y: 0.78 + (T - 2) / 2,
      z: P + 0.09
    }, _);
    v(c - 0.5, 0.42, 0.3, {
      y: T - 0.55,
      z: P + 0.08
    }, tintHex(o.awning[Math.floor(i.seed * o.awning.length)], 0, 0.25));
    let U = o.awning[Math.floor(i.seed * o.awning.length) % o.awning.length],
      N = c - 0.4;
    e.add(xf2(new BoxGeometry(N, 0.1, 1.5), m({
      y: T - 1.05,
      z: P + 0.78,
      rx: -0.34
    })), U), e.add(xf2(new BoxGeometry(N, 0.3, 0.09), m({
      y: T - 1.36,
      z: P + 1.42
    })), tintHex(U, 16777215, 0.25));
    for (let X of [-1, 1]) e.add(xf2(new CylinderGeometry(0.035, 0.035, 1.5, 6), m({
      x: X * N / 2,
      y: T - 1.2,
      z: P + 0.8,
      rx: 1.2
    })), o.metal);
  } else if (v(1 + 0.34, 2.25 + 0.24, 0.26, {
    y: (2.25 + 0.24) / 2,
    z: P + 0.06
  }, _), v(1, 2.25, 0.18, {
    y: 2.25 / 2,
    z: P + 0.12
  }, o.door), v(1 + 0.5, 0.14, 0.5, {
    y: 0.07,
    z: P + 0.3
  }, o.stone), s.add(xf2(new BoxGeometry(1 - 0.16, 0.3, 0.06), m({
    y: 2.25 - 0.12,
    z: P + 0.18
  })), o.fanlight), c > 4.4) for (let N of [-1, 1]) {
    let X = N * (c / 2 - 0.95);
    t.add(xf2(new PlaneGeometry(1, 1.5), m({
      x: X,
      y: 1.65,
      z: P + 0.015
    })), o.glass), v(1.34, 0.18, 0.34, {
      x: X,
      y: 0.85,
      z: P + 0.1
    }, _), v(1.34, 0.15, 0.26, {
      x: X,
      y: 2.48,
      z: P + 0.07
    }, _);
  }
  if (i.sign) {
    let K = T + 0.85,
      U = o.awning[Math.floor(i.seed * 7) % o.awning.length];
    e.add(xf2(new CylinderGeometry(0.045, 0.045, 0.8, 6), m({
      y: K,
      z: M + 0.4,
      rx: Math.PI / 2
    })), o.metal), e.box(0.09, 0.6, 0.78, m({
      y: K - 0.42,
      z: M + 0.74
    }), U), e.box(0.13, 0.05, 0.86, m({
      y: K - 0.1,
      z: M + 0.74
    }), o.metal), s.add(xf2(new BoxGeometry(0.11, 0.16, 0.52), m({
      y: K - 0.42,
      z: M + 0.74
    })), o.signGlow);
  }
  if (!a) return;
  let B = d + 0.26,
    W = rngFromFloat(i.seed),
    j = 1 + Math.floor(W() * 2.4);
  for (let K = 0; K < j; K++) {
    let U = (W() - 0.5) * (c - 1.6),
      N = (W() - 0.5) * (h - 1.6),
      X = Math.floor(W() * 4);
    if (X === 0) {
      e.add(xf2(new CylinderGeometry(0.62, 0.62, 1.2, 10), m({
        x: U,
        y: B + 1.3,
        z: N
      })), o.tank), e.add(xf2(new CylinderGeometry(0.66, 0.66, 0.12, 10), m({
        x: U,
        y: B + 1.95,
        z: N
      })), tintHex(o.tank, 0, 0.3));
      for (let [Y, ce] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) e.box(0.1, 0.7, 0.1, m({
        x: U + Y,
        y: B + 0.35,
        z: N + ce
      }), o.metal);
    } else if (X === 1) e.box(1.5, 0.85, 1.1, m({
      x: U,
      y: B + 0.42,
      z: N,
      ry: W()
    }), o.plant), e.box(1.6, 0.1, 1.2, m({
      x: U,
      y: B + 0.9,
      z: N,
      ry: W()
    }), tintHex(o.plant, 0, 0.35));else if (X === 2) {
      e.add(xf2(new CylinderGeometry(0.045, 0.045, 3.2, 5), m({
        x: U,
        y: B + 1.6,
        z: N
      })), o.metal);
      for (let Y = 0; Y < 3; Y++) e.box(0.9 - Y * 0.2, 0.05, 0.05, m({
        x: U,
        y: B + 2.1 + Y * 0.42,
        z: N
      }), o.metal);
    } else e.box(0.9, 0.7, 0.7, m({
      x: U,
      y: B + 0.35,
      z: N
    }), o.tank), e.add(xf2(new CylinderGeometry(0.26, 0.26, 0.14, 8), m({
      x: U,
      y: B + 0.76,
      z: N,
      rx: 0
    })), o.metal);
  }
}

function jitter(i, e, t) {
  let n = Math.abs(Math.sin(i.x * 12.9898 + i.z * 78.233 + e * 3.71 + t * 9.13) * 43758.5453) % 1;
  return n < 0.42 ? -1 : n < 0.62 ? 0 : n < 0.82 ? 1 : 2;
}

function buildTreeProp(i, e, t, n, s, r, o) {
  let a = s(i.x, i.z),
    l = h => ({
      x: i.x + (h.x || 0),
      y: a + (h.y || 0),
      z: i.z + (h.z || 0),
      ry: h.ry || 0
    }),
    c = i.d / 2;
  if (i.kind === "archive") {
    for (let d = 0; d < 3; d++) e.box(i.w + 1.6 - d * 0.5, 0.22, 2.2 - d * 0.5, l({
      y: 0.11 + d * 0.22,
      z: c + 1.5 - d * 0.25
    }), r.stone);
    for (let d = 0; d < 6; d++) {
      let u = -i.w / 2 + 0.9 + d * (i.w - 1.8) / 5;
      e.add(xf2(new CylinderGeometry(0.24, 0.28, 6.6, 12), l({
        x: u,
        y: 4,
        z: c + 1.4
      })), r.stone), e.box(0.74, 0.22, 0.74, l({
        x: u,
        y: 7.4,
        z: c + 1.4
      }), r.stone), e.box(0.7, 0.2, 0.7, l({
        x: u,
        y: 0.76,
        z: c + 1.4
      }), r.stone);
    }
    e.box(i.w + 1.2, 0.7, 1.9, l({
      y: 7.85,
      z: c + 1.4
    }), tintHex(r.stone, 0, 0.12)), e.box(i.w + 1.4, 0.34, 2.2, l({
      y: 8.3,
      z: c + 1.4
    }), r.stone), e.box(i.w * 0.8, 1.1, 1.6, l({
      y: 8.75,
      z: c + 1.3
    }), tintHex(r.stone, 16777215, 0.1)), e.box(i.w * 0.5, 0.9, 1.4, l({
      y: 9.75,
      z: c + 1.3
    }), r.stone), n.add(xf2(new PlaneGeometry(2.6, 4.2), l({
      y: 2.4,
      z: c + 0.16
    })), r.warmGlow), e.box(3.2, 4.8, 0.3, l({
      y: 2.4,
      z: c - 0.1
    }), tintHex(r.stone, 0, 0.4)), o && o.push({
      x: i.x,
      y: a + 2.6,
      z: i.z + c + 1,
      color: 16764826,
      power: 3.2,
      range: 13
    });
  }
  if (i.kind === "workshop") {
    e.box(1.5, 6.5, 1.5, l({
      x: i.w * 0.34,
      y: i.h * 0.5 + 3.2,
      z: -i.d * 0.2
    }), r.brick), e.box(1.8, 0.3, 1.8, l({
      x: i.w * 0.34,
      y: i.h + 6.6,
      z: -i.d * 0.2
    }), tintHex(r.brick, 0, 0.4));
    let h = Math.min(5.2, i.w * 0.55);
    e.box(h + 0.5, 0.4, 0.4, l({
      y: 3.5,
      z: c + 0.26
    }), r.metal);
    for (let d = 0; d < 5; d++) e.box(h, 0.26, 0.16, l({
      y: 3.2 - d * 0.3,
      z: c + 0.26
    }), d % 2 ? r.metal : tintHex(r.metal, 0, 0.25));
    n.add(xf2(new PlaneGeometry(h, 1.9), l({
      y: 0.95,
      z: c + 0.16
    })), r.forge), e.box(h + 0.6, 3.9, 0.3, l({
      y: 1.95,
      z: c - 0.2
    }), 1709330), o && o.push({
      x: i.x,
      y: a + 1.4,
      z: i.z + c + 1.2,
      color: 16742970,
      power: 5,
      range: 14
    });
  }
  if (i.kind === "clinic") {
    let h = i.w + 1.6;
    e.box(h, 0.24, 3, l({
      y: 0.12,
      z: c + 1.4
    }), tintHex(r.stone, 16777215, 0.3));
    for (let d of [-1, 1]) e.add(xf2(new CylinderGeometry(0.2, 0.24, 4.4, 12), l({
      x: d * (h / 2 - 0.4),
      y: 2.4,
      z: c + 2.6
    })), tintHex(r.stone, 16777215, 0.25));
    e.box(h, 0.4, 3.4, l({
      y: 4.8,
      z: c + 1.7
    }), tintHex(r.stone, 16777215, 0.18)), e.box(h - 0.6, 0.5, 0.24, l({
      y: 5.25,
      z: c + 3.3
    }), 2778475), n.add(xf2(new PlaneGeometry(2.4, 3), l({
      y: 1.6,
      z: c + 0.16
    })), 14677748), e.box(3, 3.6, 0.3, l({
      y: 1.8,
      z: c - 0.12
    }), tintHex(r.stone, 0, 0.45));
    for (let d of [-1, 1]) t.add(xf2(new PlaneGeometry(2, 2.2), l({
      x: d * 3,
      y: 1.8,
      z: c + 0.16
    })), r.shopGlass);
    n.add(xf2(new TorusGeometry(0.72, 0.085, 8, 26), l({
      y: 5.3,
      z: c + 3.45
    })), 3139280);
    for (let d of [-1, 1]) n.add(xf2(new BoxGeometry(0.1, 0.7, 0.08), {
      ...l({
        x: d * 0.23,
        y: 5.38,
        z: c + 3.5
      }),
      rz: d * 0.62
    }), 3139280), n.add(xf2(new BoxGeometry(0.1, 0.38, 0.08), {
      ...l({
        x: d * 0.34,
        y: 4.96,
        z: c + 3.5
      }),
      rz: d * 0.62
    }), 10482922);
    o && o.push({
      x: i.x,
      y: a + 2.8,
      z: i.z + c + 1.6,
      color: 12578538,
      power: 3.4,
      range: 14
    });
  }
  if (i.kind === "shop") {
    let h = i.w + 2.2;
    for (let d of [-1, 1]) for (let u of [0, 1]) e.add(xf2(new CylinderGeometry(0.1, 0.13, 4.6, 8), l({
      x: d * h / 2,
      y: 2.3,
      z: c + 1.2 + u * 2.8
    })), r.metal);
    for (let d = 0; d < 6; d++) {
      let u = r.awning[d % r.awning.length];
      e.box(h / 6, 0.12, 4, l({
        x: -h / 2 + h / 6 * (d + 0.5),
        y: 4.7,
        z: c + 2.6,
        rx: 0.05
      }), u);
    }
    e.box(h + 0.3, 0.16, 0.16, l({
      y: 4.6,
      z: c + 1.2
    }), r.metal), e.box(h + 0.3, 0.16, 0.16, l({
      y: 4.6,
      z: c + 4
    }), r.metal);
    for (let d = 0; d < 5; d++) n.add(xf2(new SphereGeometry(0.14, 8, 6), l({
      x: -h / 2 + h / 5 * (d + 0.5),
      y: 4.3,
      z: c + 1.3
    })), r.lampGlow);
    t.add(xf2(new PlaneGeometry(i.w - 1.4, 2.4), l({
      y: 1.6,
      z: c + 0.16
    })), r.shopGlass), o && o.push({
      x: i.x,
      y: a + 3.6,
      z: i.z + c + 2.6,
      color: 16759664,
      power: 3.4,
      range: 15
    });
  }
}

function buildRockProp(i, e, t, n, s, r) {
  let o = s(i.x, i.z),
    a = i.s || 1,
    l = h => ({
      x: i.x + (h.x || 0) * Math.cos(i.rot || 0) + (h.z || 0) * Math.sin(i.rot || 0),
      y: o + (h.y || 0),
      z: i.z - (h.x || 0) * Math.sin(i.rot || 0) + (h.z || 0) * Math.cos(i.rot || 0),
      ry: (h.ry || 0) + (i.rot || 0),
      rx: h.rx || 0,
      rz: h.rz || 0
    }),
    c = (h, d, u, f, p) => e.add(xf2(new CylinderGeometry(h, d, u, f.seg || 8), l(f)), p);
  switch (i.kind) {
    case "lamp":
      {
        c(0.2, 0.24, 0.22, {
          y: 0.11
        }, r.stone), c(0.075, 0.11, 4.1 * a, {
          y: 2.05 * a,
          seg: 8
        }, r.iron), e.box(0.09, 0.09, 0.8, l({
          y: 4.1 * a,
          z: 0.34
        }), r.iron), e.box(0.16, 0.16, 0.16, l({
          y: 4.16 * a,
          z: 0
        }), r.iron), t.add(xf2(new CylinderGeometry(0.24, 0.15, 0.55, 6), l({
          x: 0,
          y: 3.88 * a,
          z: 0.66
        })), r.lampGlow), e.add(xf2(new CylinderGeometry(0.11, 0.26, 0.18, 6), l({
          x: 0,
          y: 4.24 * a,
          z: 0.66
        })), r.iron), n.push({
          x: i.x + Math.sin(i.rot || 0) * 0.66,
          z: i.z + Math.cos(i.rot || 0) * 0.66,
          y: o + 0.05,
          r: 4.6
        });
        break;
      }
    case "bench":
      {
        for (let h of [-1, 1]) e.box(0.12, 0.44, 0.5, l({
          x: h * 0.62,
          y: 0.22
        }), r.iron), e.box(0.1, 0.5, 0.1, l({
          x: h * 0.62,
          y: 0.7,
          z: -0.24
        }), r.iron);
        for (let h = 0; h < 3; h++) e.box(1.5, 0.07, 0.15, l({
          y: 0.46,
          z: -0.18 + h * 0.18
        }), r.wood);
        for (let h = 0; h < 2; h++) e.box(1.5, 0.15, 0.07, l({
          y: 0.72 + h * 0.2,
          z: -0.28
        }), r.wood);
        break;
      }
    case "planter":
      {
        e.box(1.25, 0.62, 1.25, l({
          y: 0.31
        }), r.stone), e.box(1.35, 0.1, 1.35, l({
          y: 0.64
        }), tintHex(r.stone, 0, 0.25)), e.box(1.05, 0.12, 1.05, l({
          y: 0.66
        }), r.soil);
        break;
      }
    case "bin":
      {
        c(0.3, 0.26, 0.9, {
          y: 0.45
        }, r.iron), c(0.33, 0.33, 0.08, {
          y: 0.94
        }, tintHex(r.iron, 0, 0.3));
        for (let h = 0; h < 3; h++) e.box(0.58, 0.05, 0.05, l({
          y: 0.3 + h * 0.22,
          z: 0.28
        }), tintHex(r.iron, 16777215, 0.2));
        break;
      }
    case "hydrant":
      {
        c(0.16, 0.2, 0.72, {
          y: 0.36
        }, r.hydrant), e.add(xf2(new SphereGeometry(0.17, 10, 8), l({
          y: 0.76
        })), r.hydrant);
        for (let h of [-1, 1]) c(0.07, 0.07, 0.34, {
          x: h * 0.2,
          y: 0.52,
          rz: Math.PI / 2
        }, r.hydrant);
        break;
      }
    case "stall":
      {
        let h = r.awning[Math.round((i.hue || 0) * (r.awning.length - 1))];
        for (let [d, u] of [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]]) c(0.05, 0.05, 2.2, {
          x: d,
          y: 1.1,
          z: u,
          seg: 6
        }, r.wood);
        e.box(2.3, 0.12, 1.6, l({
          y: 0.95
        }), r.wood), e.box(2.3, 0.55, 0.1, l({
          y: 0.66,
          z: 0.75
        }), tintHex(r.wood, 0, 0.3));
        for (let d = 0; d < 6; d++) e.box(0.4, 0.06, 1.9, l({
          x: -1 + d * 0.4,
          y: 2.3,
          z: 0.1,
          rx: 0.12
        }), d % 2 ? h : 15985888);
        for (let d = 0; d < 4; d++) e.box(0.34, 0.24, 0.3, l({
          x: -0.7 + d * 0.45,
          y: 1.1,
          z: -0.1
        }), tintHex(h, 9075290, 0.55));
        t.add(xf2(new SphereGeometry(0.13, 8, 6), l({
          x: 0.4,
          y: 2.05,
          z: 0.55
        })), r.lampGlow);
        break;
      }
    case "fountain":
      {
        c(2.5, 2.62, 0.62, {
          y: 0.31,
          seg: 26
        }, r.stone), c(2.66, 2.66, 0.16, {
          y: 0.66,
          seg: 26
        }, tintHex(r.stone, 16777215, 0.14)), c(2.3, 2.3, 0.5, {
          y: 0.3,
          seg: 26
        }, tintHex(r.stone, 0, 0.35)), c(2.24, 2.24, 0.06, {
          y: 0.5,
          seg: 26
        }, r.water), c(0.62, 0.78, 0.5, {
          y: 0.78,
          seg: 12
        }, r.stone), c(0.34, 0.5, 1.15, {
          y: 1.55,
          seg: 12
        }, r.stone), c(0.78, 0.62, 0.16, {
          y: 2.2,
          seg: 14
        }, tintHex(r.stone, 16777215, 0.1)), c(0.7, 0.7, 0.05, {
          y: 2.28,
          seg: 14
        }, r.water), t.add(xf2(new OctahedronGeometry(0.34, 0), l({
          y: 2.75
        })), r.aether);
        for (let h = 0; h < 4; h++) {
          let d = h / 4 * TAU_G + 0.4;
          for (let u = 0; u < 3; u++) e.add(xf2(new CylinderGeometry(0.035, 0.02, 0.62, 5), l({
            x: Math.cos(d) * (0.62 + u * 0.42),
            z: Math.sin(d) * (0.62 + u * 0.42),
            y: 2.18 - u * 0.52,
            rx: Math.sin(d) * (0.5 + u * 0.25),
            rz: -Math.cos(d) * (0.5 + u * 0.25)
          })), r.waterBright);
        }
        break;
      }
    case "fence":
      {
        let h = {
            ry: -(i.rot || 0) - Math.PI / 2
          },
          d = u => ({
            x: i.x + (u.x || 0) * Math.cos(h.ry) + (u.z || 0) * Math.sin(h.ry),
            y: o + (u.y || 0),
            z: i.z - (u.x || 0) * Math.sin(h.ry) + (u.z || 0) * Math.cos(h.ry),
            ry: h.ry
          });
        e.box(0.12, 1.5, 0.12, d({
          y: 0.75
        }), r.iron), e.add(xf2(new SphereGeometry(0.09, 8, 6), d({
          y: 1.55
        })), r.iron), e.box(2.2, 0.09, 0.06, d({
          y: 1.38
        }), r.iron), e.box(2.2, 0.09, 0.06, d({
          y: 0.28
        }), r.iron);
        for (let u = 0; u < 5; u++) e.box(0.055, 1.2, 0.055, d({
          x: -0.9 + u * 0.45,
          y: 0.82
        }), r.iron);
        break;
      }
    case "workbench":
      {
        e.box(2.4, 0.16, 1.1, l({
          y: 0.95
        }), r.wood);
        for (let [h, d] of [[-1.05, -0.42], [1.05, -0.42], [-1.05, 0.42], [1.05, 0.42]]) e.box(0.14, 0.9, 0.14, l({
          x: h,
          y: 0.45,
          z: d
        }), tintHex(r.wood, 0, 0.3));
        e.box(0.5, 0.3, 0.3, l({
          x: -0.8,
          y: 1.18
        }), r.iron), e.box(0.24, 0.24, 0.7, l({
          x: 0.6,
          y: 1.15,
          ry: 0.4
        }), r.metal), e.box(2.5, 0.9, 0.1, l({
          y: 1.9,
          z: -0.55
        }), tintHex(r.wood, 0, 0.2));
        break;
      }
    case "banner":
      {
        c(0.08, 0.1, 5.4, {
          y: 2.7,
          seg: 8
        }, r.iron), e.box(0.1, 0.1, 1.15, l({
          y: 5,
          z: 0.5
        }), r.metal), e.box(0.05, 2, 0.95, l({
          y: 3.9,
          z: 0.98
        }), r.aetherCloth), e.box(0.05, 0.5, 0.5, l({
          y: 2.75,
          z: 0.98,
          ry: 0
        }), r.aetherCloth), t.add(xf2(new OctahedronGeometry(0.3, 0).scale(0.2, 1, 1), l({
          y: 4.1,
          z: 1.02
        })), r.aether), t.add(xf2(new SphereGeometry(0.13, 10, 8), l({
          y: 5.5
        })), r.aether);
        break;
      }
    case "gatehouse":
      {
        for (let h of [-1, 1]) {
          e.box(5, 9, 3.4, l({
            x: h * 6.4,
            y: 4.5
          }), r.stone), e.box(5.6, 0.5, 4, l({
            x: h * 6.4,
            y: 9.2
          }), tintHex(r.stone, 0, 0.2));
          for (let d = 0; d < 4; d++) e.box(0.7, 0.9, 0.7, l({
            x: h * 6.4 - 1.8 + d * 1.2,
            y: 9.85,
            z: 1.2
          }), r.stone), e.box(0.7, 0.9, 0.7, l({
            x: h * 6.4 - 1.8 + d * 1.2,
            y: 9.85,
            z: -1.2
          }), r.stone);
          t.add(xf2(new BoxGeometry(0.8, 1.4, 0.1), l({
            x: h * 4.2,
            y: 5.4,
            z: 1.72
          })), r.warmGlow);
        }
        for (let h = 0; h <= 12; h++) {
          let d = h / 12 * Math.PI;
          e.box(1.15, 0.9, 3.6, l({
            x: Math.cos(d) * 4.35,
            y: 5.4 + Math.sin(d) * 4.35,
            ry: 0,
            rz: d - Math.PI / 2
          }), h % 2 ? r.stone : tintHex(r.stone, 0, 0.12));
        }
        e.box(9.4, 1, 3.8, l({
          y: 10.3
        }), r.stone), e.box(3, 0.9, 0.14, l({
          y: 10.9,
          z: 1.9
        }), r.aetherCloth);
        break;
      }
    case "pier":
      {
        let h = STREET_Y;
        for (let d = 0; d < 22; d++) {
          let u = i.z + 8.6 - d * 0.86;
          e.box(7, 0.14, 0.72, {
            x: i.x,
            y: h + 0.07,
            z: u
          }, d % 2 ? r.deck : tintHex(r.deck, 0, 0.12));
        }
        e.box(7.2, 0.2, 19.2, {
          x: i.x,
          y: h - 0.1,
          z: i.z - 0.5
        }, tintHex(r.deck, 0, 0.35));
        for (let d = 0; d < 6; d++) for (let u of [-1, 1]) e.add(xf2(new CylinderGeometry(0.24, 0.28, 3.4, 8), {
          x: i.x + u * 3.2,
          y: h - 1.6,
          z: i.z + 8 - d * 3.4
        }), r.piling);
        for (let d of [-1, 1]) {
          for (let u = 0; u < 7; u++) e.box(0.12, 1, 0.12, {
            x: i.x + d * 3.35,
            y: h + 0.5,
            z: i.z + 8 - u * 2.9
          }, r.deck);
          e.box(0.1, 0.1, 18.4, {
            x: i.x + d * 3.35,
            y: h + 1,
            z: i.z - 0.6
          }, r.deck), e.box(0.08, 0.08, 18.4, {
            x: i.x + d * 3.35,
            y: h + 0.62,
            z: i.z - 0.6
          }, r.deck);
        }
        e.add(xf2(new CylinderGeometry(0.07, 0.1, 3.4, 8), {
          x: i.x,
          y: h + 1.7,
          z: i.z - 9
        }), r.iron), t.add(xf2(new SphereGeometry(0.26, 10, 8), {
          x: i.x,
          y: h + 3.5,
          z: i.z - 9
        }), r.lampGlow), n.push({
          x: i.x,
          z: i.z - 9,
          y: h + 0.08,
          r: 3.6
        });
        break;
      }
    case "bollard":
      {
        c(0.22, 0.26, 0.75, {
          y: 0.38,
          seg: 10
        }, r.iron), e.add(xf2(new SphereGeometry(0.24, 10, 8), l({
          y: 0.78
        })), r.iron), e.add(xf2(new TorusGeometry(0.3, 0.05, 6, 12), l({
          y: 0.5,
          rx: Math.PI / 2
        })), r.rope);
        break;
      }
    case "hatch":
      {
        e.box(4.4, 0.5, 4.4, l({
          y: 0.25
        }), r.stone), e.box(3.4, 0.6, 3.4, l({
          y: 0.05
        }), 657938);
        for (let h = 0; h < 4; h++) e.box(2.6, 0.18, 0.5, l({
          y: 0.16 - h * 0.2,
          z: 1 - h * 0.5
        }), tintHex(r.stone, 0, 0.25 + h * 0.12));
        for (let h of [-1, 1]) e.box(0.16, 1.1, 4.4, l({
          x: h * 2.1,
          y: 0.8
        }), r.iron), e.box(0.16, 0.1, 4.4, l({
          x: h * 2.1,
          y: 1.32
        }), r.iron);
        e.box(4.4, 1.1, 0.16, l({
          y: 0.8,
          z: -2.1
        }), r.iron), t.add(xf2(new TorusGeometry(1.2, 0.07, 6, 20), l({
          y: 0.2,
          z: -0.3,
          rx: Math.PI / 2
        })), r.rune);
        break;
      }
    default:
      break;
  }
}

function buildTerrainMesh(i, e, t) {
  let n = new PlaneGeometry(560, 420, 48, 36);
  n.rotateX(-Math.PI / 2);
  let s = new MeshStandardMaterial({
    color: e.water,
    roughness: 0.19,
    metalness: 0.22,
    envMapIntensity: 1.9,
    transparent: !0,
    opacity: 0.94
  });
  s.userData.shared = !1, s.onBeforeCompile = o => {
    o.uniforms.uTime = {
      value: 0
    }, o.uniforms.uNight = {
      value: 0
    }, o.uniforms.uShore = {
      value: EDGE_Y
    }, o.uniforms.uRift = {
      value: new Vector3(t?.x ?? 0, 0, t?.z ?? EDGE_Y - 14)
    }, o.vertexShader = o.vertexShader.replace("#include <common>", `#include <common>
        uniform float uTime; varying vec3 vWorld;`).replace("#include <begin_vertex>", `#include <begin_vertex>
        vec3 _wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float _swell = sin(_wp.x * 0.06 + uTime * 0.8) * 0.14 + sin(_wp.z * 0.085 - uTime * 0.62) * 0.11;
        transformed.y += _swell;
        vWorld = _wp + vec3(0.0, _swell, 0.0);`), o.fragmentShader = o.fragmentShader.replace("#include <common>", `#include <common>
        uniform float uTime; uniform float uNight; uniform float uShore; uniform vec3 uRift;
        varying vec3 vWorld;`).replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>
        {
          vec2 w = vWorld.xz;
          vec3 wn = vec3(0.0, 1.0, 0.0);
          wn.x += 0.16 * sin(w.x * 0.55 + uTime * 1.6) + 0.09 * sin(w.x * 0.19 - w.y * 0.27 + uTime * 0.9);
          wn.z += 0.16 * cos(w.y * 0.48 - uTime * 1.3) + 0.09 * cos(w.x * 0.23 + w.y * 0.14 + uTime * 1.05);
          // world space, then into view space — perturbing the view normal
          // directly would glue the ripples to the camera
          normal = normalize((viewMatrix * vec4(normalize(wn), 0.0)).xyz);
        }`).replace("#include <dithering_fragment>", `#include <dithering_fragment>
        float _shore = 1.0 - smoothstep(0.0, 3.2, vWorld.z - uShore);
        float _wash = 0.5 + 0.5 * sin(vWorld.x * 0.7 + uTime * 1.7);
        gl_FragColor.rgb += vec3(0.55, 0.68, 0.72) * _shore * (0.16 + 0.2 * _wash);
        // the rift throws a cold column of light down the water toward you
        float _lane = exp(-pow((vWorld.x - uRift.x) / (7.0 + max(0.0, uRift.z - vWorld.z) * 0.35), 2.0));
        float _fall = smoothstep(-190.0, -30.0, vWorld.z);
        float _shim = 0.6 + 0.4 * sin(vWorld.z * 0.9 + uTime * 2.3);
        gl_FragColor.rgb += vec3(0.18, 0.86, 0.78) * _lane * _fall * _shim * (0.10 + uNight * 0.42);`), s.userData.shader = o;
  };
  let r = new Mesh(n, s);
  return r.position.set(0, i.water?.level ?? -1.35, EDGE_Y - 150), r.receiveShadow = !1, r.renderOrder = 1, r;
}

var A_ = `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uNight;
  uniform float uGain;
  uniform vec3 uCore, uRim, uHaze;

  float hash(vec2 p) { p = fract(p * vec2(127.31, 311.7)); p += dot(p, p + 34.12); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += noise(p) * a; p *= 2.07; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    // A lens: widest at the middle, drawn to a point at both ends. The ends
    // are asymmetric — a tear does not open like a leaf.
    float prof = pow(max(0.0, 1.0 - uv.y * uv.y), 0.62) * (1.0 - 0.22 * uv.y);
    // torn edges: the seam is ragged, and the rag drifts upward into the tear
    float tearL = fbm(vec2(uv.y * 2.2 - uTime * 0.07, 3.1)) - 0.5;
    float tearR = fbm(vec2(uv.y * 2.4 - uTime * 0.05, 11.7)) - 0.5;
    float breathe = 0.92 + 0.08 * sin(uTime * 0.47);
    float side = step(0.0, uv.x);
    float w = max(1e-3, prof * (0.52 + mix(tearL, tearR, side) * 0.34) * breathe);
    float d = abs(uv.x) / w;

    float body = smoothstep(1.02, 0.2, d);
    float core = pow(smoothstep(0.85, 0.0, d), 4.5);
    // filaments inside the tear, sliding up into it
    float fil = fbm(vec2(uv.x * 4.0, uv.y * 1.8 - uTime * 0.3));
    core *= 0.5 + 1.0 * fil;
    // The hot edge is one edge, and only where the tear is widest — a coral
    // outline on both sides reads as a candy stripe, not as a wound.
    float rim = smoothstep(0.62, 0.99, d) * smoothstep(1.16, 0.99, d);
    rim *= mix(0.25, 1.0, side) * (0.45 + prof * 0.9);
    // haze bleeding out past the seam
    float haze = exp(-d * 1.6) * prof;

    vec3 col = uCore * core * 2.2 + uRim * rim * 1.1 + uHaze * (haze * 0.7 + body * 0.3);
    float lift = 0.72 + uNight * 0.5;
    gl_FragColor = vec4(col * lift * uGain, 1.0);
  }
`,
  R_ = `
  attribute vec3 aStart;
  attribute float aSeed;
  uniform float uTime;
  uniform float uSize;
  varying float vA;
  void main() {
    float t = fract(uTime * (0.045 + aSeed * 0.05) + aSeed);
    float e = t * t;                        // accelerate as it is pulled in
    vec3 p = mix(aStart, vec3(0.0, aStart.y * 0.15, 0.0), e);
    float a = t * 4.0 + aSeed * 6.283;
    p.x += sin(a) * (1.0 - t) * 1.6;
    p.y += cos(a * 0.7) * (1.0 - t) * 1.1;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.5 + aSeed) * (1.0 - e * 0.7) * (60.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
    vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.72, 1.0, t));
  }
`,
  C_ = `
  varying float vA;
  uniform vec3 uNear, uFar;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    float s = smoothstep(0.25, 0.02, r);
    gl_FragColor = vec4(mix(uFar, uNear, vA) * s * vA * 1.1, 1.0);
  }
`;

function buildWaterPlane(i, e) {
  let t = new Group();
  t.position.set(i.x, i.y, i.z);
  let n = {
      uTime: {
        value: 0
      },
      uNight: {
        value: 0
      },
      uGain: {
        value: 1
      },
      uCore: {
        value: new Color(e.riftCore)
      },
      uRim: {
        value: new Color(e.riftRim)
      },
      uHaze: {
        value: new Color(e.riftHaze)
      }
    },
    s = new ShaderMaterial({
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: A_,
      uniforms: n,
      transparent: !0,
      blending: AdditiveBlending,
      depthWrite: !1,
      side: DoubleSide
    }),
    r = i.r || 10,
    o = new Mesh(new PlaneGeometry(r * 3.2, r * 4.4), s);
  t.add(o);
  let a = new Mesh(new PlaneGeometry(r * 4.4, r * 5.6), s.clone());
  a.material.uniforms = {
    ...n,
    uTime: {
      value: 0
    },
    uGain: {
      value: 0.42
    }
  }, a.rotation.y = 0.5, a.scale.setScalar(0.92), t.add(a);
  let l = buildAmbientMotes(r, e);
  return t.add(l.points), {
    group: t,
    tear: o,
    tick(c, h) {
      n.uTime.value = c, n.uNight.value = h, a.material.uniforms.uTime.value = c * 0.72 + 11, a.material.uniforms.uNight.value = h, l.uniforms.uTime.value = c, t.position.y = i.y + Math.sin(c * 0.21) * 0.9;
    }
  };
}

function buildAmbientMotes(i, e) {
  let t = QUALITY.tier === "low" ? 70 : 150,
    n = new BufferGeometry(),
    s = new Float32Array(t * 3),
    r = new Float32Array(t * 3),
    o = new Float32Array(t);
  for (let h = 0; h < t; h++) {
    let d = Math.random() * TAU_G,
      u = i * (1.2 + Math.random() * 2.2);
    r[h * 3] = Math.cos(d) * u, r[h * 3 + 1] = (Math.random() - 0.5) * i * 3.6, r[h * 3 + 2] = Math.sin(d) * u * 0.5, o[h] = Math.random();
  }
  n.setAttribute("position", new BufferAttribute(s, 3)), n.setAttribute("aStart", new BufferAttribute(r, 3)), n.setAttribute("aSeed", new BufferAttribute(o, 1)), n.boundingSphere = new Sphere(new Vector3(), i * 6);
  let a = {
      uTime: {
        value: 0
      },
      uSize: {
        value: 2.4
      },
      uNear: {
        value: new Color(e.riftCore)
      },
      uFar: {
        value: new Color(e.riftRim)
      }
    },
    l = new ShaderMaterial({
      vertexShader: R_,
      fragmentShader: C_,
      uniforms: a,
      transparent: !0,
      blending: AdditiveBlending,
      depthWrite: !1
    }),
    c = new Points(n, l);
  return c.frustumCulled = !1, {
    points: c,
    uniforms: a
  };
}

function buildFogWall(i, e, t) {
  let n = new ShaderMaterial({
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `
      varying vec2 vUv;
      uniform float uTime; uniform float uNight; uniform vec3 uColor;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float ring = exp(-dot(p, p) * 2.4);
        float lane = exp(-pow(p.x * 3.0, 2.0)) * smoothstep(-1.0, 0.4, p.y);
        float shim = 0.7 + 0.3 * sin(p.y * 22.0 + uTime * 2.0);
        // fade to nothing at the panel's own edges: an additive quad that is
        // still bright where it stops draws a straight line across the harbour
        float edge = (1.0 - smoothstep(0.55, 1.0, abs(p.x))) * (1.0 - smoothstep(0.55, 1.0, abs(p.y)));
        gl_FragColor = vec4(uColor * (ring * 0.5 + lane * 0.45 * shim) * edge * (0.35 + uNight * 0.8), 1.0);
      }`,
      uniforms: {
        uTime: {
          value: 0
        },
        uNight: {
          value: 0
        },
        uColor: {
          value: new Color(t.riftCore)
        }
      },
      transparent: !0,
      blending: AdditiveBlending,
      depthWrite: !1
    }),
    s = new Mesh(new PlaneGeometry(64, 52), n);
  return s.rotation.x = -Math.PI / 2, s.position.set(i.x, e + 0.06, i.z + 12), s.renderOrder = 2, {
    mesh: s,
    uniforms: n.uniforms
  };
}

function buildEdgeWall(i, e, t) {
  let n = new Group(),
    s = i.size / 2,
    r = new Mesh(new RingGeometry(s - 6, 420, 48, 3), mat(e.dirt, {
      roughness: 1,
      env: 0.35
    }));
  r.rotation.x = -Math.PI / 2, r.position.y = t(0, s) - 0.7, r.receiveShadow = !1, n.add(r);
  let o = new PartBuilder(),
    a = rngFromFloat(0.317);
  for (let c = 0; c < 130; c++) {
    let h = a() * TAU_G,
      d = Math.cos(h) * 0 + Math.sin(h),
      u = s + 16 + a() * 90,
      f = Math.cos(h) * u,
      p = Math.sin(h) * u;
    if (p < EDGE_Y - 10 && Math.abs(f) < 90 || d < -0.8) continue;
    let x = 6 + a() * 16,
      g = 8 + a() * 34;
    o.box(x, g, 6 + a() * 14, {
      x: f,
      y: g / 2 - 2,
      z: p,
      ry: a() * TAU_G
    }, tintHex(e.far, e.farHigh, a()));
  }
  let l = o.mesh(vertexColorMat({
    roughness: 1,
    env: 0.2
  }), {
    cast: !1,
    receive: !1
  });
  return l && n.add(l), n;
}

function buildNpcBody(i, {
  coat: e,
  trouser: t
}) {
  let n = new PartBuilder(),
    s = tintHex(e, 724500, 0.45);
  if (i === "scholar") {
    for (let o of [-1, 1]) n.box(0.16, 0.72, 0.1, {
      x: o * 0.1,
      y: 0.62,
      z: 0.085
    }, e);
    n.add(xf2(blobGeo(0.2, 0.34, 0.14, 3, 12), {
      y: 0.62
    }), e), n.box(0.26, 0.2, 0.1, {
      x: 0.17,
      y: 0.86,
      z: -0.02,
      ry: 0.2
    }, s), n.box(0.05, 0.42, 0.05, {
      x: 0.1,
      y: 1.06,
      z: 0.02,
      rz: 0.5
    }, s);
  } else i === "ranger" ? (n.add(xf2(blobGeo(0.2, 0.13, 0.16, 3.2, 14), {
    y: 1.32,
    z: -0.02
  }), s), n.box(0.14, 0.16, 0.09, {
    x: -0.13,
    y: 0.92,
    z: 0.06
  }, s), n.box(0.06, 0.5, 0.06, {
    x: -0.16,
    y: 1.15,
    z: -0.1,
    rz: -0.24
  }, t)) : i === "wanderer" ? (n.add(xf2(blobGeo(0.16, 0.2, 0.11, 3.4, 14), {
    y: 1.24,
    z: -0.13
  }), s), n.box(0.3, 0.06, 0.06, {
    y: 1.32,
    z: -0.02
  }, t), n.box(0.14, 0.1, 0.08, {
    y: 1.05,
    z: -0.19
  }, t)) : i === "tide" ? (n.add(xf2(blobGeo(0.19, 0.24, 0.15, 3, 14), {
    y: 1.16,
    z: -0.05
  }), e), n.add(xf2(blobGeo(0.11, 0.09, 0.1, 2.6, 12), {
    y: 1.4,
    z: -0.11
  }), s)) : n.box(0.28, 0.05, 0.11, {
    y: 1
  }, s);
  let r = n.mesh(vertexColorMat({
    roughness: 0.8,
    env: 0.7
  }), {
    cast: !0,
    receive: !1
  });
  return r && (r.userData.noOutline = !0), r;
}

function buildCityGround(i, e, t, n) {
  let s = new Group(),
    r = QUALITY.tier !== "low";
  plazaOf(i);
  let o = new PartBuilder(),
    a = new PartBuilder(),
    l = new PartBuilder(),
    c = [new PartBuilder(), new PartBuilder(), new PartBuilder()],
    h = new PartBuilder(),
    d = [],
    u = [];
  buildGroundMesh(i, t, n, o);
  for (let A of collectColliders(i, e)) A.kind === "block" ? buildBuildingBlock(A, a, l, c, h, n, t, r) : (buildBuildingBlock({
    ...A,
    sign: !1
  }, a, l, c, h, n, t, r), buildTreeProp(A, a, l, h, n, t, u));
  for (let A of e.props) buildRockProp(A, a, h, d, n, t);
  buildRimRange(i, a, n, t), PLAZA && d.push({
    x: PLAZA.x,
    z: PLAZA.z,
    y: n(PLAZA.x, PLAZA.z) + 0.05,
    r: PLAZA.r * 1.1
  });
  let f = vertexColorMat({
      roughness: 0.9,
      env: 0.55
    }),
    p = o.mesh(vertexColorMat({
      roughness: 0.97,
      env: 0.35
    }), {
      cast: !1,
      receive: !0
    });
  p && s.add(p);
  let x = a.mesh(f, {
    cast: !0,
    receive: !0
  });
  x && s.add(x);
  let g = vertexColorMat({
      roughness: 0.14,
      metalness: 0.55,
      env: 1.5
    }),
    m = l.mesh(g, {
      cast: !1,
      receive: !1
    });
  m && s.add(m);
  let v = [];
  c.forEach((A, k) => {
    let L = vertexColorMat({
      roughness: 0.2,
      metalness: 0.3,
      env: 1,
      emissive: t.glassLit,
      emissiveIntensity: 0
    });
    v.push({
      mat: L,
      at: 0.22 + k * 0.24
    });
    let O = A.mesh(L, {
      cast: !1,
      receive: !1
    });
    O && s.add(O);
  });
  let E = vertexColorMat({
    roughness: 0.4,
    emissive: 16777215,
    emissiveIntensity: 0.55,
    env: 0.4
  });
  E.onBeforeCompile = A => {
    A.fragmentShader = A.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
	totalEmissiveRadiance *= vColor.rgb;`);
  };
  let _ = h.mesh(E, {
    cast: !1,
    receive: !1
  });
  _ && s.add(_);
  let S = null;
  if (d.length) {
    S = new ShaderMaterial({
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `varying vec2 vUv; uniform float uAmt; uniform vec3 uColor;
        void main(){ vec2 p = vUv * 2.0 - 1.0; float f = exp(-dot(p,p) * 3.4);
        gl_FragColor = vec4(uColor * f * uAmt, 1.0); }`,
      uniforms: {
        uAmt: {
          value: 0
        },
        uColor: {
          value: new Color(t.lampGlow)
        }
      },
      transparent: !0,
      blending: AdditiveBlending,
      depthWrite: !1
    });
    let A = new Mesh(mergeProps(d), S);
    A.renderOrder = 2, s.add(A);
  }
  let b = i.water ? buildTerrainMesh(i, t, i.rift) : null;
  b && s.add(b);
  let T = i.rift ? buildWaterPlane(i.rift, t) : null;
  T && s.add(T.group);
  let y = i.rift && i.water ? buildFogWall(i.rift, i.water.level, t) : null;
  y && s.add(y.mesh), s.add(buildEdgeWall(i, t, n));
  let M = [];
  if (r) for (let A of u.slice(0, 3)) {
    let k = new PointLight(A.color, A.power, A.range, 2);
    k.position.set(A.x, A.y, A.z), s.add(k), M.push({
      light: k,
      power: A.power
    });
  }
  let P = 0;
  return {
    group: s,
    water: b,
    rift: T,
    setNight(A) {
      P = A;
      for (let {
        mat: k,
        at: L
      } of v) k.emissiveIntensity = smoothBand(L, L + 0.3, A) * 1.35;
      E.emissiveIntensity = 0.35 + A * 1.5, S && (S.uniforms.uAmt.value = smoothBand(0.12, 0.55, A) * 0.55);
      for (let k of M) k.light.intensity = k.power * (0.35 + A * 0.9);
      b && b.material.userData.shader && (b.material.userData.shader.uniforms.uNight.value = A), y && (y.uniforms.uNight.value = A);
    },
    tick(A) {
      b?.material.userData.shader && (b.material.userData.shader.uniforms.uTime.value = A), T && T.tick(A, P), y && (y.uniforms.uTime.value = A);
    }
  };
}

function collectColliders(i, e) {
  let t = [...e.buildings];
  for (let n of i.landmarks || []) {
    if (!n.interior) continue;
    let s = n.r || 6,
      r = n.z - s * 0.6;
    if (t.some(c => Math.hypot(c.x - n.x, c.z - r) < s)) continue;
    let o = s * 1.5,
      a = s * 0.7,
      l = 7.5;
    t.push({
      x: n.x,
      z: r,
      w: o,
      d: a,
      h: l,
      floors: Math.round(l / 3.2),
      rot: 0,
      kind: n.interior,
      wall: 10134428,
      trim: 5595228,
      roof: 3354666,
      facing: 0,
      shop: !1,
      sign: !0,
      seed: 0.5,
      noCollider: !0
    });
  }
  return t;
}

function mergeProps(i) {
  let e = [],
    t = [];
  for (let s of i) {
    let r = [[s.x - s.r, s.y, s.z - s.r, 0, 0], [s.x + s.r, s.y, s.z - s.r, 1, 0], [s.x + s.r, s.y, s.z + s.r, 1, 1], [s.x - s.r, s.y, s.z + s.r, 0, 1]];
    for (let o of [0, 3, 2, 0, 2, 1]) e.push(r[o][0], r[o][1], r[o][2]), t.push(r[o][3], r[o][4]);
  }
  let n = new BufferGeometry();
  return n.setAttribute("position", new Float32BufferAttribute(e, 3)), n.setAttribute("uv", new Float32BufferAttribute(t, 2)), n;
}

function buildRimRange(i, e, t, n) {
  let s = rngFromFloat(0.77),
    r = EDGE_Y + 1.2;
  for (let a = -46; a < 46; a += 4) {
    if (Math.abs(a) < 4.6) continue;
    let l = t(a + 2, r);
    e.box(3.9, 0.55, 1.1, {
      x: a + 2,
      y: l + 0.2,
      z: r
    }, n.stone), e.box(3.9, 0.12, 1.3, {
      x: a + 2,
      y: l + 0.5,
      z: r
    }, tintHex(n.stone, 0, 0.25));
  }
  for (let a = 0; a < 10; a++) {
    let l = -40 + a * 9;
    if (Math.abs(l) < 6) continue;
    let c = t(l, r + 1.6);
    e.add(xf2(new CylinderGeometry(0.2, 0.24, 0.7, 10), {
      x: l,
      y: c + 0.35,
      z: r + 1.6
    }), n.iron), e.add(xf2(new SphereGeometry(0.22, 8, 6), {
      x: l,
      y: c + 0.72,
      z: r + 1.6
    }), n.iron);
  }
  let o = r - 0.62;
  for (let a = -47; a < 47; a += 1.6) {
    if (Math.abs(a) < 4.4) continue;
    let l = t(a, o) + 0.5;
    e.box(0.1, 1.05, 0.1, {
      x: a,
      y: l + 0.52,
      z: o
    }, n.iron), e.add(xf2(new SphereGeometry(0.08, 6, 5), {
      x: a,
      y: l + 1.09,
      z: o
    }), n.iron);
  }
  for (let [a, l] of [[-47, -4.4], [4.4, 47]]) {
    let c = t((a + l) / 2, o) + 0.5;
    for (let h of [1.02, 0.66, 0.3]) e.box(l - a, h === 1.02 ? 0.1 : 0.06, h === 1.02 ? 0.12 : 0.06, {
      x: (a + l) / 2,
      y: c + h,
      z: o
    }, n.iron);
  }
  for (let a = 0; a < 26; a++) {
    let l = (s() * 2 - 1) * 44,
      c = EDGE_Y + 3 + s() * 14;
    if (Math.abs(l) < 6) continue;
    let h = t(l, c),
      d = 0.7 + s() * 0.5;
    s() < 0.6 ? (e.box(d * 1.3, d * 1.2, d * 1.3, {
      x: l,
      y: h + d * 0.6,
      z: c,
      ry: s() * TAU_G
    }, s() < 0.5 ? n.crate : tintHex(n.crate, 2764856, 0.4)), s() < 0.4 && e.box(d * 1.1, d * 1, d * 1.1, {
      x: l,
      y: h + d * 1.7,
      z: c,
      ry: s() * TAU_G
    }, n.crate)) : (e.add(xf2(new CylinderGeometry(d * 0.5, d * 0.5, d * 1.3, 10), {
      x: l,
      y: h + d * 0.65,
      z: c
    }), n.barrel), e.add(xf2(new CylinderGeometry(d * 0.54, d * 0.54, 0.08, 10), {
      x: l,
      y: h + d * 1,
      z: c
    }), n.iron));
  }
  for (let a of [-34, 31]) {
    let l = t(a, EDGE_Y + 3),
      c = EDGE_Y + 3;
    for (let [h, d] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) e.box(0.34, 14, 0.34, {
      x: a + h,
      y: l + 7,
      z: c + d
    }, n.crane);
    for (let h = 0; h < 4; h++) for (let d of [-1.9, 1.9]) e.box(3.9, 0.16, 0.16, {
      x: a,
      y: l + 2 + h * 3.4,
      z: c + d
    }, n.crane), e.box(4.4, 0.12, 0.12, {
      x: a,
      y: l + 3.7 + h * 3.4,
      z: c + d,
      rz: h % 2 ? 0.7 : -0.7
    }, n.crane);
    e.box(4.8, 0.5, 4.8, {
      x: a,
      y: l + 14.2,
      z: c
    }, n.crane), e.box(2.6, 2.4, 3, {
      x: a,
      y: l + 15.6,
      z: c + 1.2
    }, tintHex(n.crane, 1711394, 0.45));
    for (let h of [-0.5, 0.5]) e.box(0.22, 0.22, 19, {
      x: a + h,
      y: l + 17.2,
      z: EDGE_Y - 5,
      rx: -0.1
    }, n.crane);
    for (let h = 0; h < 8; h++) e.box(1.2, 0.12, 0.12, {
      x: a,
      y: l + 17.4 - h * 0.22,
      z: EDGE_Y + 2.5 - h * 2.3
    }, n.crane);
    e.box(0.34, 0.34, 7, {
      x: a,
      y: l + 17.8,
      z: c + 6.5,
      rx: 0.3
    }, n.crane), e.box(0.12, 4.5, 0.12, {
      x: a,
      y: l + 14.6,
      z: EDGE_Y - 11
    }, n.iron), e.box(1, 0.8, 0.8, {
      x: a,
      y: l + 12.2,
      z: EDGE_Y - 11
    }, n.iron);
  }
}

var U_ = 0.4,
  WALL_H = 1.25,
  DOOR_W = 2.7,
  INTERIORS = {
    clinic: {
      hw: 6.2,
      d: 10.8,
      h: 4.3,
      floor: 13031126,
      floor2: 11585223,
      wall: 15200238,
      wain: 2778475,
      trim: 16055033,
      ceil: 14543079,
      beam: 12768210,
      wood: 11057595,
      street: 10469078,
      streetMid: 7308438,
      streetLow: 8294041,
      lit: {
        sky: 15005430,
        ground: 8232608,
        hemi: 1.7,
        sun: 15137023,
        sunI: 1.1,
        rim: 10475744,
        rimI: 0.34,
        fog: 1320492,
        near: 14,
        far: 34,
        bg: 727069,
        exposure: 1
      }
    },
    shop: {
      hw: 5.6,
      d: 9.4,
      h: 3.9,
      floor: 9070914,
      floor2: 7821615,
      wall: 10980450,
      wain: 6243628,
      trim: 12624242,
      ceil: 7296054,
      beam: 5455914,
      wood: 9069624,
      street: 12372429,
      streetMid: 9077624,
      streetLow: 8223346,
      lit: {
        sky: 16768942,
        ground: 7163185,
        hemi: 2.1,
        sun: 16767392,
        sunI: 1.05,
        rim: 16758903,
        rimI: 0.34,
        fog: 2365965,
        near: 11,
        far: 28,
        bg: 1182725,
        exposure: 1.06
      }
    },
    archive: {
      hw: 6.4,
      d: 11.4,
      h: 6.8,
      floor: 4998198,
      floor2: 4274734,
      wall: 10983802,
      wain: 5128756,
      trim: 13219727,
      ceil: 5720632,
      beam: 4011047,
      wood: 7033910,
      street: 12897734,
      streetMid: 9209204,
      streetLow: 8354672,
      lit: {
        sky: 15786684,
        ground: 5917748,
        hemi: 1.6,
        sun: 16772804,
        sunI: 1.25,
        rim: 14206874,
        rimI: 0.3,
        fog: 2169356,
        near: 12,
        far: 32,
        bg: 1051910,
        exposure: 1.03
      }
    },
    workshop: {
      hw: 6.2,
      d: 10.4,
      h: 4.7,
      floor: 5919048,
      floor2: 4866618,
      wall: 8217172,
      wain: 4733488,
      trim: 10125680,
      ceil: 4734774,
      beam: 3682346,
      wood: 6966834,
      street: 11977414,
      streetMid: 8682866,
      streetLow: 8025708,
      lit: {
        sky: 16762010,
        ground: 5127986,
        hemi: 1.75,
        sun: 16762006,
        sunI: 0.95,
        rim: 16751196,
        rimI: 0.38,
        fog: 2364424,
        near: 10,
        far: 26,
        bg: 985093,
        exposure: 1.06
      }
    }
  };

function buildWainscot(i, {
  x0: e,
  x1: t,
  h: n,
  z: s,
  t: r,
  hex: o
}, a = []) {
  let l = e;
  for (let c of [...a].sort((h, d) => h.x - d.x)) {
    let h = c.x - c.hw,
      d = c.x + c.hw;
    h - l > 0.02 && i.box(h - l, n, r, {
      x: (l + h) / 2,
      y: n / 2,
      z: s
    }, o), c.y0 > 0.02 && i.box(c.hw * 2, c.y0, r, {
      x: c.x,
      y: c.y0 / 2,
      z: s
    }, o), n - c.y1 > 0.02 && i.box(c.hw * 2, n - c.y1, r, {
      x: c.x,
      y: (c.y1 + n) / 2,
      z: s
    }, o), l = Math.max(l, d);
  }
  t - l > 0.02 && i.box(t - l, n, r, {
    x: (l + t) / 2,
    y: n / 2,
    z: s
  }, o);
}

function buildLamp(i, e = {}) {
  let t = vertexColorMat({
    roughness: 0.5,
    env: 0.2,
    emissive: 16777215,
    emissiveIntensity: i,
    ...e
  });
  return t.onBeforeCompile = n => {
    n.fragmentShader = n.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
	totalEmissiveRadiance *= vColor.rgb;`);
  }, t;
}

var O_ = `
  attribute vec3 aStart;
  attribute float aSeed;
  uniform float uTime, uSize, uRise, uSway, uRate;
  varying float vA;
  void main() {
    float t = fract(uTime * uRate * (0.55 + aSeed) + aSeed);
    vec3 p = aStart;
    p.y += t * uRise;
    p.x += sin(uTime * 0.6 + aSeed * 6.283) * uSway * (0.4 + t);
    p.z += cos(uTime * 0.47 + aSeed * 4.11) * uSway * (0.4 + t);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uSize * (0.5 + aSeed) * (30.0 / max(0.8, -mv.z));
    gl_Position = projectionMatrix * mv;
    vA = sin(t * 3.14159);
  }
`,
  B_ = `
  varying float vA;
  uniform vec3 uNear, uFar;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    gl_FragColor = vec4(mix(uFar, uNear, vA) * smoothstep(0.25, 0.02, r) * vA, 1.0);
  }
`;

function buildDust(i, e) {
  let t = QUALITY.tier === "low" ? Math.round(e.count * 0.4) : e.count,
    n = rngFromFloat(e.seed ?? 0.41),
    s = new Float32Array(t * 3),
    r = new Float32Array(t);
  for (let c = 0; c < t; c++) s[c * 3] = i.x + (n() * 2 - 1) * i.hw, s[c * 3 + 1] = i.y + n() * i.h, s[c * 3 + 2] = i.z + (n() * 2 - 1) * i.hd, r[c] = n();
  let o = new BufferGeometry();
  o.setAttribute("position", new BufferAttribute(new Float32Array(t * 3), 3)), o.setAttribute("aStart", new BufferAttribute(s, 3)), o.setAttribute("aSeed", new BufferAttribute(r, 1));
  let a = {
      uTime: {
        value: 0
      },
      uSize: {
        value: e.size ?? 2.6
      },
      uRise: {
        value: e.rise ?? 1.2
      },
      uSway: {
        value: e.sway ?? 0.25
      },
      uRate: {
        value: e.rate ?? 0.08
      },
      uNear: {
        value: new Color(e.near)
      },
      uFar: {
        value: new Color(e.far ?? e.near)
      }
    },
    l = new Points(o, new ShaderMaterial({
      vertexShader: O_,
      fragmentShader: B_,
      uniforms: a,
      transparent: !0,
      blending: AdditiveBlending,
      depthWrite: !1
    }));
  return l.frustumCulled = !1, {
    points: l,
    uniforms: a
  };
}

function buildRug(i, e, t, n, s) {
  let r = new Color(s),
    o = [],
    a = [],
    l = new Vector3(e.x - i.x, e.y - i.y, e.z - i.z).normalize(),
    c = new Vector3(0, 1, 0).cross(l).normalize(),
    h = new Vector3().crossVectors(l, c).normalize(),
    d = (E, _, S) => [E.x + c.x * _ + h.x * S, E.y + c.y * _ + h.y * S, E.z + c.z * _ + h.z * S],
    u = (E, _, S, b) => {
      let T = [d(i, ...E), d(i, ..._), d(e, ...b), d(e, ...S)],
        y = [0.95, 0.95, 0.12, 0.12];
      for (let M of [0, 1, 2, 0, 2, 3]) o.push(T[M][0], T[M][1], T[M][2]), a.push(r.r * y[M], r.g * y[M], r.b * y[M]);
    },
    f = t / 2,
    p = 0.22,
    x = n / 2,
    g = 0.4;
  u([-f, -p], [f, -p], [-x, -g], [x, -g]), u([f, p], [-f, p], [x, g], [-x, g]), u([-f, p], [-f, -p], [-x, g], [-x, -g]), u([f, -p], [f, p], [x, -g], [x, g]);
  let m = new BufferGeometry();
  m.setAttribute("position", new Float32BufferAttribute(o, 3)), m.setAttribute("color", new Float32BufferAttribute(a, 3));
  let v = new Mesh(m, new MeshBasicMaterial({
    vertexColors: !0,
    transparent: !0,
    opacity: 0.55,
    blending: AdditiveBlending,
    depthWrite: !1,
    side: DoubleSide
  }));
  return v.renderOrder = 3, v.userData.noOutline = !0, v;
}

function buildInterior(i, e) {
  let t = INTERIORS[i] || INTERIORS.shop,
    n = t.hw,
    s = t.d,
    r = t.h,
    o = U_,
    a = {
      wood: e.wood ?? e.bark ?? 8019006,
      iron: e.iron ?? 3948873,
      metal: e.metal ?? 10134187,
      stone: e.stone ?? e.rock ?? 10985620,
      crate: e.crate ?? 10123858,
      barrel: e.barrel ?? 7031600,
      lamp: e.lampGlow ?? 16763770,
      forge: e.forge ?? 16742970,
      aether: e.aether ?? 3139280,
      awning: e.awning ?? [12737098, 3112312, 13867580, 4873610, 8018572]
    },
    l = new Group(),
    c = new PartBuilder(),
    h = new PartBuilder(),
    d = new PartBuilder(),
    u = [],
    f = [],
    p = [],
    x = [],
    g = rngFromFloat(0.63),
    m = (U, N, X, Y, ce = 1.4) => {
      u.push({
        x: U,
        z: N,
        hw: X / 2,
        hd: Y / 2,
        rot: 0,
        kind: "interior"
      }), f.push({
        x: U,
        z: N,
        hw: X / 2,
        hd: Y / 2,
        rot: 0,
        top: ce
      });
    },
    v = (U, N, X, Y = 1.4) => {
      u.push({
        x: U,
        z: N,
        r: X,
        kind: "interior"
      }), f.push({
        x: U,
        z: N,
        r: X,
        top: Y
      });
    },
    E = i === "shop" || i === "archive" ? 0.62 : 1.05,
    _ = i === "shop" || i === "archive" ? 2.4 : 1.05;
  for (let U = -n; U < n - 0.01; U += E) for (let N = -s; N < -0.01; N += _) {
    let X = Math.min(n, U + E - 0.035),
      Y = Math.min(0, N + _ - 0.035),
      ce = fbm(U * 1.7, N * 1.7, 311, 2),
      Ee = i === "clinic" ? (Math.round(U / E) + Math.round(N / _)) % 2 === 0 : ce > 0.02;
    c.quad([U, 0, N], [X, 0, N], [X, 0, Y], [U, 0, Y], Ee ? t.floor : t.floor2);
  }
  c.quad([-n, -0.02, -s], [n, -0.02, -s], [n, -0.02, 0], [-n, -0.02, 0], tintHex(t.floor2, 0, 0.45));
  let S = 1.55,
    b = 2.95,
    T = 0.82,
    y = (n + WALL_H) / 2;
  buildWainscot(c, {
    x0: -n - o,
    x1: n + o,
    h: r,
    z: o / 2,
    t: o,
    hex: t.wall
  }, [{
    x: 0,
    hw: WALL_H,
    y0: 0,
    y1: DOOR_W
  }, {
    x: -y,
    hw: T,
    y0: S,
    y1: b
  }, {
    x: y,
    hw: T,
    y0: S,
    y1: b
  }]);
  let M = i === "archive" ? [{
    x: -s * 0.62,
    hw: 1,
    y0: r - 2.3,
    y1: r - 0.7
  }] : [];
  c.box(n * 2 + o * 2, r, o, {
    y: r / 2,
    z: -s - o / 2
  }, t.wall);
  for (let U of [-1, 1]) {
    let N = new PartBuilder();
    buildWainscot(N, {
      x0: -s - o,
      x1: o,
      h: r,
      z: 0,
      t: o,
      hex: t.wall
    }, U < 0 ? M : []), c.put(N, {
      x: U * (n + o / 2),
      ry: -Math.PI / 2
    });
  }
  c.box(n * 2 + o * 2, 0.3, s + o * 2, {
    y: r + 0.15,
    z: -s / 2
  }, t.ceil);
  let P = Math.max(3, Math.round(s / 2.2));
  for (let U = 0; U < P; U++) {
    let N = -s + s / P * (U + 0.5);
    c.box(n * 2 + 0.2, 0.28, 0.3, {
      y: r - 0.14,
      z: N
    }, t.beam);
  }
  for (let U of [-1, 1]) c.box(0.22, 0.3, s, {
    x: U * (n - 0.1),
    y: r - 0.15,
    z: -s / 2
  }, t.beam);
  for (let U of [-1, 1]) c.box(0.12, 0.24, s, {
    x: U * (n - 0.06),
    y: 0.12,
    z: -s / 2
  }, t.trim), c.box(0.1, 0.1, s, {
    x: U * (n - 0.05),
    y: 1.08,
    z: -s / 2
  }, t.wain);
  if (c.box(n * 2, 0.24, 0.12, {
    y: 0.12,
    z: -s + 0.06
  }, t.trim), c.box(n * 2, 0.1, 0.1, {
    y: 1.08,
    z: -s + 0.05
  }, t.wain), i === "clinic" || i === "shop") {
    for (let U of [-1, 1]) c.box(0.06, 1.04, s, {
      x: U * (n - 0.03),
      y: 0.54,
      z: -s / 2
    }, t.wain);
    c.box(n * 2, 1.04, 0.06, {
      y: 0.54,
      z: -s + 0.03
    }, t.wain);
  }
  let A = tintHex(t.wain, 0, 0.2);
  for (let U of [-1, 1]) c.box(0.16, DOOR_W + 0.2, 0.5, {
    x: U * (WALL_H + 0.08),
    y: DOOR_W / 2,
    z: o / 2
  }, A);
  c.box(WALL_H * 2 + 0.5, 0.2, 0.5, {
    y: DOOR_W + 0.1,
    z: o / 2
  }, A), c.box(WALL_H * 2 + 0.5, 0.08, 0.8, {
    y: 0.04,
    z: 0.1
  }, t.trim);
  let k = (U, N, X, Y, ce) => {
    d.box(X, Y * 0.44, 0.2, {
      x: U,
      y: N + Y * 0.28,
      z: ce
    }, t.street), d.box(X, Y * 0.33, 0.2, {
      x: U,
      y: N - Y * 0.045,
      z: ce + 0.02
    }, t.streetMid), d.box(X, Y * 0.23, 0.2, {
      x: U,
      y: N - Y * 0.385,
      z: ce + 0.04
    }, t.streetLow);
  };
  k(0, DOOR_W / 2 + 0.2, WALL_H * 2 + 0.6, DOOR_W + 0.4, o + 0.55);
  for (let U of [-1, 1]) {
    let N = U * y;
    k(N, (S + b) / 2, T * 2 + 0.1, b - S + 0.1, o + 0.3);
    for (let X of [-1, 1]) c.box(0.1, b - S, o, {
      x: N + X * T,
      y: (S + b) / 2,
      z: o / 2
    }, t.trim);
    c.box(T * 2 + 0.2, 0.1, o, {
      x: N,
      y: b,
      z: o / 2
    }, t.trim), c.box(T * 2 + 0.3, 0.12, 0.44, {
      x: N,
      y: S - 0.06,
      z: o / 2
    }, t.trim), c.box(0.07, b - S, 0.08, {
      x: N,
      y: (S + b) / 2,
      z: o - 0.04
    }, t.trim), c.box(T * 2, 0.07, 0.08, {
      x: N,
      y: (S + b) / 2,
      z: o - 0.04
    }, t.trim);
  }
  i === "archive" && d.box(0.16, 1.5, 2, {
    x: -(n + o * 0.5) + 0.16,
    y: r - 1.5,
    z: -s * 0.62
  }, t.street), m(0, -s - o / 2, n * 2 + o * 2, o, r);
  for (let U of [-1, 1]) m(U * (n + o / 2), -s / 2, o, s + o * 2, r), m(U * (n + WALL_H) / 2, o / 2, n - WALL_H, o, r);
  u.push({
    x: 0,
    z: 0.78,
    hw: WALL_H + 0.1,
    hd: 0.22,
    rot: 0,
    kind: "interior"
  }), f.push({
    x: 0,
    z: 0.62,
    hw: WALL_H + 0.1,
    hd: 0.3,
    rot: 0,
    top: r
  });
  let L = -s * 0.56,
    O = i === "archive" ? 2.4 : 2.7,
    B = i === "clinic" ? t.trim : tintHex(t.wood, 0, 0.15);
  h.box(O * 2, 0.92, 0.84, {
    y: 0.46,
    z: L
  }, tintHex(t.wain, 0, 0.1)), h.box(O * 2 + 0.24, 0.12, 1.02, {
    y: 0.98,
    z: L
  }, B), h.box(O * 2 + 0.1, 0.1, 0.12, {
    y: 0.44,
    z: L + 0.44
  }, B);
  for (let U of [-1, 1]) h.box(0.16, 1.02, 0.9, {
    x: U * O,
    y: 0.51,
    z: L
  }, tintHex(t.wood, 0, 0.3));
  if (m(0, L, O * 2 + 0.3, 1.1, 1.2), i === "clinic") {
    for (let Y = 0; Y < 3; Y++) {
      let ce = -2.2 - Y * 2.5,
        Ee = -n + 1.3;
      h.box(1.1, 0.46, 2.1, {
        x: Ee,
        y: 0.3,
        z: ce
      }, a.metal), h.add(xf2(blobGeo(0.56, 0.14, 1.02, 3.4, 12), {
        x: Ee,
        y: 0.62,
        z: ce
      }), 15397874), h.add(xf2(blobGeo(0.38, 0.1, 0.22, 3, 10), {
        x: Ee,
        y: 0.78,
        z: ce - 0.72
      }), 16777215), h.box(1.08, 0.1, 0.9, {
        x: Ee,
        y: 0.7,
        z: ce + 0.56
      }, t.wain);
      for (let [Pe, G] of [[-0.48, -0.94], [0.48, -0.94], [-0.48, 0.94], [0.48, 0.94]]) h.box(0.09, 0.3, 0.09, {
        x: Ee + Pe,
        y: 0.15,
        z: ce + G
      }, tintHex(a.metal, 0, 0.4));
      h.box(0.07, 0.95, 0.07, {
        x: Ee + 0.52,
        y: 0.95,
        z: ce - 1
      }, a.metal), d.box(0.34, 0.24, 0.05, {
        x: Ee + 0.52,
        y: 1.48,
        z: ce - 0.98
      }, 8384740), m(Ee, ce, 1.3, 2.2, 1);
    }
    let U = n - 1.5,
      N = -4.4;
    h.add(xf2(new CylinderGeometry(1.05, 1.2, 0.5, 20), {
      x: U,
      y: 0.25,
      z: N
    }), a.metal), h.add(xf2(new CylinderGeometry(0.95, 0.95, 2.1, 20, 1, !0), {
      x: U,
      y: 1.55,
      z: N
    }), 12577002), h.add(xf2(new CylinderGeometry(1.05, 0.95, 0.4, 20), {
      x: U,
      y: 2.75,
      z: N
    }), a.metal), h.add(xf2(new CylinderGeometry(0.24, 0.24, 1.1, 10), {
      x: U,
      y: 3.4,
      z: N
    }), a.metal), d.add(xf2(blobGeo(0.5, 0.42, 0.5, 2.6, 14), {
      x: U,
      y: 1.45,
      z: N
    }), 6548696), d.add(xf2(new TorusGeometry(0.86, 0.05, 6, 22), {
      x: U,
      y: 0.62,
      z: N,
      rx: Math.PI / 2
    }), 3139280), d.add(xf2(new TorusGeometry(0.86, 0.05, 6, 22), {
      x: U,
      y: 2.5,
      z: N,
      rx: Math.PI / 2
    }), 3139280), v(U, N, 1.2, 2.8), p.push({
      x: U,
      y: 1.6,
      z: N,
      color: 6285020,
      power: 3.4,
      range: 7
    });
    for (let Y = 0; Y < 3; Y++) {
      let ce = 1.25 + Y * 0.78;
      h.box(n * 1.5, 0.09, 0.42, {
        y: ce,
        z: -s + 0.32
      }, t.trim);
      for (let Ee = 0; Ee < 16; Ee++) {
        let Pe = -n * 0.72 + (Ee + 0.5) * (n * 1.44 / 16),
          G = 0.2 + g() * 0.2,
          ae = [7329999, 15253599, 14250859, 11129983][(Ee + Y) % 4];
        h.add(xf2(new CylinderGeometry(0.06, 0.07, G, 7), {
          x: Pe,
          y: ce + 0.05 + G / 2,
          z: -s + 0.32
        }), ae), h.box(0.05, 0.05, 0.05, {
          x: Pe,
          y: ce + 0.06 + G,
          z: -s + 0.32
        }, t.trim);
      }
    }
    let X = r - 1.25;
    d.add(xf2(new TorusGeometry(0.62, 0.075, 8, 30), {
      y: X,
      z: -s + 0.16
    }), 3139280);
    for (let Y of [-1, 1]) d.box(0.09, 0.62, 0.07, {
      x: Y * 0.2,
      y: X + 0.06,
      z: -s + 0.2,
      rz: Y * 0.62
    }, 3139280), d.box(0.09, 0.34, 0.07, {
      x: Y * 0.3,
      y: X - 0.34,
      z: -s + 0.2,
      rz: Y * 0.62
    }, 10482922);
    for (let Y = 0; Y < 3; Y++) d.box(2.6, 0.06, 0.5, {
      y: r - 0.34,
      z: -1.9 - Y * 3.1
    }, 15400191);
    p.push({
      x: 0,
      y: r - 0.8,
      z: -s * 0.4,
      color: 14677759,
      power: 4.2,
      range: 15
    });
  }
  if (i === "shop") {
    let U = (N, X, Y, ce, Ee, Pe) => {
      let G = Math.max(2, Math.round(ce / 0.55));
      for (let ae = 0; ae < G; ae++) {
        let re = -ce / 2 + (ae + 0.5) * (ce / G),
          Be = g(),
          qe = N + Math.cos(Ee) * re + Math.sin(Ee) * Pe,
          fe = Y - Math.sin(Ee) * re + Math.cos(Ee) * Pe;
        if (Be < 0.4) {
          let Ye = 0.2 + g() * 0.14;
          h.box(Ye * 1.8, Ye * 1.7, Ye * 1.5, {
            x: qe,
            y: X + Ye * 0.85,
            z: fe,
            ry: Ee
          }, g() < 0.5 ? a.crate : tintHex(a.crate, 2764856, 0.35));
        } else if (Be < 0.72) {
          let Ye = 0.22 + g() * 0.18;
          h.add(xf2(new CylinderGeometry(0.1, 0.11, Ye, 9), {
            x: qe,
            y: X + Ye / 2,
            z: fe
          }), a.awning[Math.floor(g() * a.awning.length)]), h.add(xf2(new CylinderGeometry(0.06, 0.09, 0.06, 9), {
            x: qe,
            y: X + Ye + 0.03,
            z: fe
          }), tintHex(t.wood, 0, 0.3));
        } else h.add(xf2(blobGeo(0.18, 0.19, 0.15, 2.6, 10), {
          x: qe,
          y: X + 0.2,
          z: fe,
          ry: Ee
        }), tintHex(13219210, t.wood, g() * 0.5));
      }
    };
    for (let N of [-1, 1]) {
      let X = N * (n - 0.3);
      h.box(0.5, r - 0.4, s - 1.4, {
        x: X,
        y: (r - 0.4) / 2,
        z: -s / 2 - 0.1
      }, tintHex(t.wood, 0, 0.35));
      for (let Y = 0; Y < 5; Y++) {
        let ce = 0.5 + Y * 0.68;
        h.box(0.62, 0.07, s - 1.4, {
          x: X,
          y: ce,
          z: -s / 2 - 0.1
        }, t.wood), U(X, ce + 0.035, -s / 2 - 0.1, s - 1.8, Math.PI / 2, -N * 0.2);
      }
      m(X, -s / 2 - 0.1, 0.8, s - 1.4, 1.6);
    }
    h.box(n * 2 - 1.4, r - 0.4, 0.5, {
      y: (r - 0.4) / 2,
      z: -s + 0.3
    }, tintHex(t.wood, 0, 0.35));
    for (let N = 0; N < 5; N++) {
      let X = 0.5 + N * 0.68;
      h.box(n * 2 - 1.4, 0.07, 0.62, {
        y: X,
        z: -s + 0.3
      }, t.wood), U(0, X + 0.035, -s + 0.3, n * 2 - 1.8, 0, 0.2);
    }
    for (let N of [-1, 1]) {
      let X = N * 2.9,
        Y = -3.1;
      h.box(1.9, 0.12, 1.2, {
        x: X,
        y: 0.82,
        z: Y
      }, t.wood);
      for (let [ce, Ee] of [[-0.8, -0.48], [0.8, -0.48], [-0.8, 0.48], [0.8, 0.48]]) h.box(0.12, 0.76, 0.12, {
        x: X + ce,
        y: 0.38,
        z: Y + Ee
      }, tintHex(t.wood, 0, 0.35));
      h.box(2, 0.2, 1.3, {
        x: X,
        y: 0.4,
        z: Y
      }, tintHex(t.wood, 0, 0.25));
      for (let ce = 0; ce < 4; ce++) {
        let Ee = X - 0.62 + ce * 0.42;
        g() < 0.5 ? (h.add(xf2(blobGeo(0.22, 0.26, 0.2, 2.4, 12), {
          x: Ee,
          y: 1.12,
          z: Y + (g() - 0.5) * 0.4,
          ry: g()
        }), tintHex(13219210, t.wood, g() * 0.4)), h.box(0.1, 0.08, 0.1, {
          x: Ee,
          y: 1.36,
          z: Y
        }, tintHex(t.wood, 0, 0.4))) : h.box(0.26, 0.5, 0.26, {
          x: Ee,
          y: 1.13,
          z: Y + (g() - 0.5) * 0.4,
          ry: g(),
          rz: 0.12
        }, a.awning[Math.floor(g() * a.awning.length)]);
      }
      v(X, Y, 1.15, 1.1);
    }
    for (let [N, X, Y] of [[-n + 1.1, -1.4, 0.42], [-n + 1.9, -2.1, 0.36], [n - 1.2, -1.5, 0.4]]) h.add(xf2(new CylinderGeometry(Y, Y * 0.92, 0.95, 12), {
      x: N,
      y: 0.48,
      z: X
    }), a.barrel), h.add(xf2(new CylinderGeometry(Y * 1.04, Y * 1.04, 0.07, 12), {
      x: N,
      y: 0.76,
      z: X
    }), a.iron), h.add(xf2(new CylinderGeometry(Y * 0.96, Y * 0.96, 0.06, 12), {
      x: N,
      y: 0.98,
      z: X
    }), tintHex(a.barrel, 0, 0.35)), v(N, X, Y + 0.1, 1.1);
    for (let N = 0; N < 5; N++) {
      let X = 0.52 - N * 0.03;
      h.box(X * 1.6, X * 1.4, X * 1.6, {
        x: n - 1.4,
        y: 0.7 + N * 0.72,
        z: -3.6,
        ry: g() * 0.5
      }, N % 2 ? a.crate : tintHex(a.crate, 3813416, 0.3));
    }
    v(n - 1.4, -3.6, 0.8, 3.2), h.box(0.62, 0.42, 0.5, {
      x: -1.5,
      y: 1.25,
      z: L
    }, tintHex(a.metal, 6965800, 0.5)), h.box(0.66, 0.08, 0.54, {
      x: -1.5,
      y: 1.5,
      z: L
    }, a.metal), h.box(0.1, 0.3, 0.1, {
      x: -1.12,
      y: 1.6,
      z: L,
      rz: -0.4
    }, a.iron), h.add(xf2(new SphereGeometry(0.12, 10, 8), {
      x: 1.7,
      y: 1.14,
      z: L
    }), a.metal);
    for (let N = 0; N < 3; N++) {
      let X = -1.9 - N * 2.6;
      h.box(0.05, 0.85, 0.05, {
        y: r - 0.6,
        z: X
      }, a.iron), h.add(xf2(new CylinderGeometry(0.34, 0.1, 0.3, 12), {
        y: r - 1.15,
        z: X
      }), tintHex(a.iron, 16777215, 0.15)), d.add(xf2(new SphereGeometry(0.16, 10, 8), {
        y: r - 1.32,
        z: X
      }), a.lamp);
    }
    p.push({
      x: 0,
      y: r - 1.4,
      z: -2.2,
      color: 16760954,
      power: 7.5,
      range: 14
    }), p.push({
      x: 0,
      y: r - 1.4,
      z: -5.2,
      color: 16758903,
      power: 6.5,
      range: 13
    }), p.push({
      x: 0,
      y: r - 1.4,
      z: -s + 1.6,
      color: 16756838,
      power: 5,
      range: 11
    });
  }
  if (i === "archive") {
    let U = (fe, Ye, je, mt, dt) => {
        let ot = -mt / 2 + 0.05;
        for (; ot < mt / 2 - 0.08;) {
          let Ct = 0.045 + g() * 0.05,
            Vt = 0.3 + g() * 0.16,
            en = tintHex([8206896, 3100490, 5917298, 7166510, 3951204][Math.floor(g() * 5)], 14207398, g() * 0.35);
          h.box(Ct, Vt, 0.2, {
            x: fe + Math.cos(dt) * (ot + Ct / 2),
            y: Ye + Vt / 2,
            z: je - Math.sin(dt) * (ot + Ct / 2),
            ry: dt,
            rz: g() < 0.06 ? 0.24 : 0
          }, en), ot += Ct + 0.008;
        }
      },
      N = r - 0.9;
    for (let fe of [-1, 1]) {
      let Ye = fe * (n - 0.28);
      h.box(0.5, N, s - 1.2, {
        x: Ye,
        y: N / 2,
        z: -s / 2 - 0.1
      }, tintHex(t.wood, 0, 0.3));
      for (let je = 0; je < 6; je++) {
        let mt = 0.5 + je * (N - 0.7) / 6;
        h.box(0.56, 0.07, s - 1.2, {
          x: Ye,
          y: mt,
          z: -s / 2 - 0.1
        }, t.wood), U(Ye, mt + 0.035, -s / 2 - 0.1, s - 1.5, Math.PI / 2);
      }
      h.box(0.62, 0.18, s - 1, {
        x: Ye,
        y: N + 0.09,
        z: -s / 2 - 0.1
      }, t.trim), m(Ye, -s / 2 - 0.1, 0.78, s - 1.2, 2.4);
    }
    h.box(n * 2 - 1.2, N, 0.5, {
      y: N / 2,
      z: -s + 0.28
    }, tintHex(t.wood, 0, 0.3));
    for (let fe = 0; fe < 6; fe++) {
      let Ye = 0.5 + fe * (N - 0.7) / 6;
      h.box(n * 2 - 1.2, 0.07, 0.56, {
        y: Ye,
        z: -s + 0.28
      }, t.wood), U(0, Ye + 0.035, -s + 0.28, n * 2 - 1.5, 0);
    }
    let X = -3.4,
      Y = 0.12,
      ce = N + 0.2,
      Ee = -n + 1.55;
    h.box(0.1, 0.1, s - 1.4, {
      x: -n + 0.52,
      y: N - 0.4,
      z: -s / 2 - 0.1
    }, a.iron);
    for (let fe of [-1, 1]) h.box(0.09, ce, 0.09, {
      x: Ee - Math.sin(Y) * ce / 2,
      y: ce / 2,
      z: X + fe * 0.34,
      rz: Y
    }, t.trim);
    for (let fe = 0; fe < 9; fe++) {
      let Ye = 0.4 + fe * (ce - 0.7) / 8;
      h.box(0.08, 0.07, 0.72, {
        x: Ee - Math.sin(Y) * Ye,
        y: Ye,
        z: X
      }, t.trim);
    }
    v(Ee - 0.1, X, 0.55, 2);
    let Pe = 3,
      G = -4.2;
    h.box(2.6, 0.12, 1.5, {
      x: Pe,
      y: 0.78,
      z: G
    }, tintHex(t.wood, 14207398, 0.18)), h.box(2.4, 0.14, 1.3, {
      x: Pe,
      y: 0.7,
      z: G
    }, tintHex(t.wood, 0, 0.3));
    for (let [fe, Ye] of [[-1.1, -0.56], [1.1, -0.56], [-1.1, 0.56], [1.1, 0.56]]) h.box(0.14, 0.7, 0.14, {
      x: Pe + fe,
      y: 0.35,
      z: G + Ye
    }, tintHex(t.wood, 0, 0.35));
    h.box(0.5, 0.08, 0.5, {
      x: Pe - 0.2,
      y: 0.46,
      z: G + 1.15
    }, t.wood), h.box(0.5, 0.7, 0.08, {
      x: Pe - 0.2,
      y: 0.8,
      z: G + 1.37
    }, t.wood);
    for (let [fe, Ye] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) h.box(0.07, 0.44, 0.07, {
      x: Pe - 0.2 + fe,
      y: 0.22,
      z: G + 1.15 + Ye
    }, tintHex(t.wood, 0, 0.3));
    h.box(0.22, 0.05, 0.22, {
      x: Pe - 0.9,
      y: 0.86,
      z: G - 0.2
    }, a.metal), h.box(0.05, 0.3, 0.05, {
      x: Pe - 0.9,
      y: 1,
      z: G - 0.2
    }, a.metal), h.add(xf2(new CylinderGeometry(0.05, 0.26, 0.2, 14), {
      x: Pe - 0.9,
      y: 1.2,
      z: G - 0.2
    }), 3107406), d.add(xf2(new SphereGeometry(0.11, 10, 8), {
      x: Pe - 0.9,
      y: 1.13,
      z: G - 0.2
    }), 16769704);
    for (let fe of [-1, 1]) h.box(0.42, 0.05, 0.52, {
      x: Pe + 0.3 + fe * 0.22,
      y: 0.87,
      z: G,
      rz: fe * 0.1
    }, 15261638);
    for (let fe = 0; fe < 3; fe++) h.box(0.36, 0.06, 0.48, {
      x: Pe + 1,
      y: 0.87 + fe * 0.07,
      z: G + 0.1,
      ry: g() * 0.3
    }, tintHex(7166510, 14207398, g()));
    m(Pe, G, 2.8, 1.7, 1), m(Pe - 0.2, G + 1.2, 0.6, 0.6, 1), p.push({
      x: Pe - 0.9,
      y: 1.25,
      z: G - 0.2,
      color: 16767130,
      power: 5.5,
      range: 9
    }), p.push({
      x: 0,
      y: r - 1.8,
      z: -s * 0.7,
      color: 16770748,
      power: 4.2,
      range: 14
    }), p.push({
      x: 0,
      y: 2.6,
      z: -2.4,
      color: 16771787,
      power: 3.4,
      range: 11
    });
    let ae = {
        x: -n + 0.4,
        y: r - 1.5,
        z: -s * 0.62
      },
      re = {
        x: Pe,
        y: 0.02,
        z: G + 0.2
      };
    l.add(buildRug(ae, re, 1.7, 3.2, 16772804));
    let Be = new Mesh(new PlaneGeometry(3.2, 2.4), new MeshBasicMaterial({
      color: 16772804,
      transparent: !0,
      opacity: 0.28,
      blending: AdditiveBlending,
      depthWrite: !1
    }));
    Be.rotation.x = -Math.PI / 2, Be.position.set(re.x, 0.015, re.z), Be.renderOrder = 3, Be.userData.noOutline = !0, l.add(Be);
    let qe = buildDust({
      x: -1,
      hw: 3.6,
      y: 0.2,
      h: r - 1,
      z: (G + -s * 0.62) / 2,
      hd: 2.4
    }, {
      count: 170,
      size: 2.4,
      rise: 1.6,
      sway: 0.3,
      rate: 0.05,
      near: 16773324,
      far: 6970430,
      seed: 0.19
    });
    l.add(qe.points), x.push(fe => {
      qe.uniforms.uTime.value = fe;
    });
  }
  if (i === "workshop") {
    let U = -n + 2.2,
      N = -s + 1.3;
    h.box(3.4, 1.1, 2, {
      x: U,
      y: 0.55,
      z: N
    }, tintHex(a.stone, 3811874, 0.5)), h.box(3.6, 0.16, 2.2, {
      x: U,
      y: 1.16,
      z: N
    }, tintHex(a.stone, 0, 0.3));
    for (let G of [-1, 1]) h.box(0.7, 1.6, 2, {
      x: U + G * 1.35,
      y: 2,
      z: N
    }, tintHex(a.stone, 3811874, 0.4));
    h.box(3.4, 0.5, 2, {
      x: U,
      y: 3.05,
      z: N
    }, tintHex(a.stone, 3811874, 0.4)), h.add(xf2(new CylinderGeometry(0.55, 1.7, 1.2, 4), {
      x: U,
      y: 3.9,
      z: N,
      ry: Math.PI / 4
    }), a.iron), h.add(xf2(new CylinderGeometry(0.5, 0.5, r - 4.3, 8), {
      x: U,
      y: r - (r - 4.3) / 2,
      z: N
    }), tintHex(a.iron, 0, 0.25)), d.box(2, 1, 0.3, {
      x: U,
      y: 1.55,
      z: N + 0.9
    }, a.forge), d.add(xf2(blobGeo(0.8, 0.22, 0.6, 2.4, 12), {
      x: U,
      y: 1.28,
      z: N + 0.2
    }), 16757335), m(U, N, 4.6, 2.2, 3);
    let X = {
      x: U,
      y: 1.6,
      z: N + 1.1,
      color: 16745528,
      power: 10,
      range: 18
    };
    p.push(X);
    for (let G = 0; G < 2; G++) {
      let ae = -2.6 - G * 3.4;
      h.box(0.05, 0.7, 0.05, {
        y: r - 0.5,
        z: ae
      }, a.iron), h.add(xf2(new CylinderGeometry(0.38, 0.1, 0.28, 12), {
        y: r - 1,
        z: ae
      }), tintHex(a.iron, 16777215, 0.2)), d.add(xf2(new SphereGeometry(0.15, 10, 8), {
        y: r - 1.16,
        z: ae
      }), 16767912), p.push({
        x: 0,
        y: r - 1.3,
        z: ae,
        color: 16763274,
        power: 5.5,
        range: 12
      });
    }
    let Y = -3,
      ce = -4.9;
    h.add(xf2(new CylinderGeometry(0.46, 0.52, 0.62, 12), {
      x: Y,
      y: 0.31,
      z: ce
    }), tintHex(t.wood, 0, 0.45)), h.box(0.5, 0.2, 1.35, {
      x: Y,
      y: 0.72,
      z: ce
    }, a.iron), h.box(0.3, 0.22, 0.95, {
      x: Y,
      y: 0.92,
      z: ce
    }, tintHex(a.iron, 0, 0.2)), h.box(0.52, 0.16, 1.5, {
      x: Y,
      y: 1.1,
      z: ce
    }, tintHex(a.iron, 16777215, 0.12)), h.add(xf2(new CylinderGeometry(0.15, 0.2, 0.45, 10), {
      x: Y,
      y: 1.12,
      z: ce + 0.92,
      rx: Math.PI / 2
    }), tintHex(a.iron, 16777215, 0.12)), v(Y, ce, 0.75, 1.3), h.box(0.09, 0.09, 0.7, {
      x: Y + 0.1,
      y: 1.24,
      z: ce - 0.2,
      ry: 0.5
    }, t.wood), h.box(0.15, 0.16, 0.3, {
      x: Y + 0.34,
      y: 1.26,
      z: ce - 0.05,
      ry: 0.5
    }, a.iron), h.add(xf2(new CylinderGeometry(0.44, 0.4, 1, 12), {
      x: Y - 1.4,
      y: 0.5,
      z: ce + 0.7
    }), a.barrel), h.add(xf2(new CylinderGeometry(0.46, 0.46, 0.08, 12), {
      x: Y - 1.4,
      y: 0.8,
      z: ce + 0.7
    }), a.iron), h.add(xf2(new CylinderGeometry(0.38, 0.38, 0.04, 12), {
      x: Y - 1.4,
      y: 0.96,
      z: ce + 0.7
    }), 2767680), v(Y - 1.4, ce + 0.7, 0.55, 1.1);
    let Ee = n - 0.28;
    h.box(0.1, 2.1, 3.6, {
      x: Ee,
      y: 2,
      z: -s * 0.45
    }, tintHex(t.wood, 0, 0.4));
    for (let G = 0; G < 9; G++) {
      let ae = -s * 0.45 - 1.6 + G * 0.4,
        re = 0.55 + g() * 0.5;
      h.box(0.07, re, 0.07, {
        x: Ee - 0.18,
        y: 2.5 - re / 2,
        z: ae
      }, t.wood), G % 3 === 0 ? h.box(0.13, 0.14, 0.3, {
        x: Ee - 0.18,
        y: 2.5 - re - 0.07,
        z: ae
      }, a.iron) : G % 3 === 1 ? h.box(0.09, 0.4, 0.1, {
        x: Ee - 0.18,
        y: 2.5 - re - 0.2,
        z: ae,
        rz: 0.1
      }, tintHex(a.iron, 16777215, 0.1)) : h.box(0.06, 0.3, 0.12, {
        x: Ee - 0.18,
        y: 2.5 - re - 0.15,
        z: ae
      }, a.metal);
    }
    h.box(0.9, 0.14, 3.4, {
      x: Ee - 0.62,
      y: 0.95,
      z: -s * 0.45
    }, t.wood);
    for (let G of [-1.4, 1.4]) h.box(0.16, 0.9, 0.16, {
      x: Ee - 0.62,
      y: 0.45,
      z: -s * 0.45 + G
    }, tintHex(t.wood, 0, 0.35));
    h.add(xf2(blobGeo(0.34, 0.42, 0.22, 3.2, 12), {
      x: Ee - 0.62,
      y: 1.34,
      z: -s * 0.45 - 1,
      rx: 0.4
    }), a.metal), h.add(xf2(blobGeo(0.17, 0.2, 0.17, 2.6, 12), {
      x: Ee - 0.62,
      y: 1.22,
      z: -s * 0.45 + 0.2
    }), tintHex(a.metal, 0, 0.25)), h.box(0.36, 0.07, 0.12, {
      x: Ee - 0.62,
      y: 1.24,
      z: -s * 0.45 + 0.36
    }, tintHex(a.metal, 16777215, 0.2));
    for (let G = 0; G < 3; G++) h.add(xf2(new CylinderGeometry(0.16, 0.16, 0.06, 10), {
      x: Ee - 0.62,
      y: 1.05 + G * 0.07,
      z: -s * 0.45 + 1.2,
      ry: g()
    }), a.iron);
    h.box(0.26, 0.3, 0.26, {
      x: Ee - 0.62,
      y: 1.17,
      z: -s * 0.45 + 1.5
    }, a.iron), m(Ee - 0.5, -s * 0.45, 1.3, 3.6, 1.5);
    for (let G = 0; G < 6; G++) h.box(0.08, 2.6, 0.08, {
      x: n - 0.8 - G % 3 * 0.18,
      y: 1.3,
      z: -1.5 + Math.floor(G / 3) * 0.24,
      rz: 0.06 + g() * 0.05
    }, a.metal);
    v(n - 0.9, -1.5, 0.55, 2.4), h.box(0.5, 0.36, 0.5, {
      x: 1.5,
      y: 1.22,
      z: L
    }, a.iron), h.box(0.18, 0.2, 0.62, {
      x: 1.5,
      y: 1.3,
      z: L
    }, tintHex(a.iron, 16777215, 0.2));
    let Pe = buildDust({
      x: U,
      hw: 1,
      y: 1.3,
      h: 0.5,
      z: N + 0.8,
      hd: 0.5
    }, {
      count: 90,
      size: 2.8,
      rise: 2.6,
      sway: 0.22,
      rate: 0.42,
      near: 16765050,
      far: 16734750,
      seed: 0.77
    });
    l.add(Pe.points), x.push(G => {
      Pe.uniforms.uTime.value = G, X.flicker = 0.78 + Math.sin(G * 6.1) * 0.13 + Math.sin(G * 13.7) * 0.09;
    });
  }
  let W = c.mesh(vertexColorMat({
    roughness: 0.92,
    env: 0.25
  }), {
    cast: !1,
    receive: !0
  });
  W && l.add(W);
  let j = h.mesh(vertexColorMat({
    roughness: 0.82,
    env: 0.3
  }), {
    cast: !0,
    receive: !0
  });
  j && l.add(j);
  let K = d.mesh(buildLamp(1.1), {
    cast: !1,
    receive: !1
  });
  return K && l.add(K), {
    kind: i,
    group: l,
    dims: {
      hw: n,
      d: s,
      h: r,
      doorHW: WALL_H
    },
    colliders: u,
    blockers: f,
    points: p,
    lit: t.lit,
    spawn: {
      x: 0,
      z: -2.6,
      ry: Math.PI
    },
    exit: {
      x: 0,
      z: -0.7,
      r: 1.7
    },
    counter: {
      x: 0,
      z: L
    },
    npc: {
      x: 0,
      z: L - 1.15,
      ry: 0
    },
    tick(U) {
      for (let N of x) N(U);
    }
  };
}

function tintHex(i, e, t) {
  let n = i >> 16 & 255,
    s = i >> 8 & 255,
    r = i & 255,
    o = e >> 16 & 255,
    a = e >> 8 & 255,
    l = e & 255;
  return Math.round(n + (o - n) * t) << 16 | Math.round(s + (a - s) * t) << 8 | Math.round(r + (l - r) * t);
}

function rngFromFloat(i) {
  let e = Math.floor(i * 4294967295) >>> 0;
  return function () {
    e = e + 1831565813 | 0;
    let t = Math.imul(e ^ e >>> 15, 1 | e);
    return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

var SUN_DIR = new Vector3(0.42, 0.78, 0.46).normalize(),
  SUN_STRENGTH = 0.42,
  V_ = new Vector3(),
  W_ = new Vector3(),
  q_ = new Vector3(),
  $_ = new Vector3(),
  X_ = new Vector3(),
  eo = new Vector3(),
  WorldView = class {
    constructor(e) {
      this.canvas = e, this.renderer = makeRenderer(e), this.scene = new Scene(), this.camera = new PerspectiveCamera(50, 1, 0.1, 600), this.camDist = 12, this.camHeight = 6.4, this.camYaw = 0, this.camPitch = 0.32, this._camPos = new Vector3(), this.actors = new Map(), this.effects = [], this.zone = null, this.props = null, this.colliders = [], this.blockers = [], this.npcs = new Map(), this.city = null, this.self = null, this.time = 0, this.night = 0, this.lights = makeLights(this.scene, {
        sunDir: SUN_DIR,
        sunColor: 16773853,
        skyColor: 12376319,
        groundColor: 4867126,
        shadowRadius: 26
      }), this.viewMode = "third", this.camPitch = 0, this.interior = null, this._inside = null, this.camMin = 3.2, this.zoneGroup = new Group(), this.scene.add(this.zoneGroup), this.windMaterials = [], this.adapt = sizeRenderer(this.renderer), this.density = {
        low: 0.45,
        medium: 0.75,
        high: 1
      }[QUALITY.tier], this.resize(), window.addEventListener("resize", () => this.resize());
    }
    resize() {
      let e = this.canvas.clientWidth || window.innerWidth,
        t = this.canvas.clientHeight || window.innerHeight;
      !e || !t || (this.renderer.setSize(e, t, !1), this.camera.aspect = e / t, this.camera.updateProjectionMatrix());
    }
    setViewMode(e) {
      this.viewMode = e === "first" ? "first" : "third", this.camera.near = this.viewMode === "first" ? 0.08 : 0.3, this.camera.updateProjectionMatrix();
      let t = this.selfActor();
      return t && (t.holder.visible = this.viewMode !== "first"), this.viewMode;
    }
    heightAt(e, t) {
      if (this._inside) return this._inside.floorY;
      if (!this.zone) return 0;
      let n = heightAt(this.zone.id, e, t);
      if (!this.urban) return n;
      let s = plazaHeight(e, t, this.pier),
        r = n + curbHeight(e, t);
      return s ? r + (s.y - r) * s.blend : r;
    }
    loadZone(e) {
      this.interior && this.exitInterior({
        move: !1
      });
      let t = ZONES[e.id];
      this.zone = t ? {
        ...t,
        ...e
      } : e, e = this.zone, this.urban = !!e.urban, this.pier = this.urban ? e.landmarks.find(s => s.kind === "pier") : null, plazaOf(e), this.props = propsFor(e), this.colliders = this.props.colliders, this.blockers = buildingIndex(this.props), this.windMaterials = [], this.city = null, this.plazaLight = null, this.hazeWall = null, this.npcAvatar = null, this.npcs.clear(), this.clearPlates();
      for (let s of [...this.zoneGroup.children]) this.zoneGroup.remove(s), disposeTree(s);
      let n = zoneTheme(e);
      this.sky && (this.scene.remove(this.sky), disposeTree(this.sky)), this.sky = makeSky({
        ...n.sky,
        sunDir: SUN_DIR
      }), this.scene.add(this.sky), this.scene.environment && this.scene.environment.dispose?.(), this.scene.environment = QUALITY.tier === "low" ? null : makeEnvironment(this.renderer, this.sky), this.scene.fog = new Fog(n.fog, n.fogNear ?? 62, n.fogFar ?? 168), this.lights.hemi.color.set(n.sky.horizon), this.lights.hemi.groundColor.set(n.groundLight), this.lights.sun.color.set(n.sunLight), this.lights.rim.color.set(n.sky.top), this.palette = n, this.buildTerrain(n), this.buildEdge(n), this.buildDecals(n), this.buildFoliage(n), this.urban ? (this.city = buildCityGround(e, this.props, n, (s, r) => this.heightAt(s, r)), this.zoneGroup.add(this.city.group), this.buildUrbanLandmarks(n), this.buildNpcs()) : (this.buildBuildings(n), this.buildLandmarks(n));
    }
    buildTerrain(e) {
      if (this.urban) {
        this.buildCityGround(e);
        return;
      }
      let t = this.zone.size,
        n = QUALITY.tier === "high" ? 1.4 : 2.2,
        s = Math.max(48, Math.min(200, Math.round(t / n))),
        r = new PlaneGeometry(t, t, s, s);
      r.rotateX(-Math.PI / 2);
      let o = r.attributes.position,
        a = new Float32Array(o.count * 3),
        l = new Color(e.groundLow),
        c = new Color(e.groundHigh),
        h = new Color(e.path),
        d = new Color(),
        u = hash(this.zone.id),
        f = (m, v, E) => {
          let _ = MathUtils.clamp((E - m) / (v - m), 0, 1);
          return _ * _ * (3 - 2 * _);
        },
        p = t / s;
      for (let m = 0; m < o.count; m++) {
        let v = o.getX(m),
          E = o.getZ(m),
          _ = heightAt(this.zone.id, v, E);
        o.setY(m, _);
        let S = heightAt(this.zone.id, v + p, E),
          b = heightAt(this.zone.id, v, E + p),
          T = Math.min(1, Math.hypot(S - _, b - _) / p * 2.6),
          y = f(-2.2, 2.2, _),
          M = fbm(v * 0.045, E * 0.045, u + 31, 2),
          P = fbm(v * 0.42, E * 0.42, u + 57, 2),
          A = MathUtils.clamp(y * 0.72 + T * 0.34 + M * 0.5 + P * 0.14, 0, 1);
        d.copy(l).lerp(c, A);
        for (let k of this.zone.landmarks) {
          if (!k.r) continue;
          let L = Math.hypot(k.x - v, k.z - E),
            O = k.r + 4.5 + fbm(v * 0.09, E * 0.09, u + 11, 2) * 5.2;
          L < O && d.lerp(h, f(O, k.r * 0.55, L) * 0.92);
        }
        a[m * 3] = d.r, a[m * 3 + 1] = d.g, a[m * 3 + 2] = d.b;
      }
      r.setAttribute("color", new BufferAttribute(a, 3)), r.computeVertexNormals();
      let x = new Mesh(r, new MeshStandardMaterial({
        vertexColors: !0,
        roughness: 0.95,
        metalness: 0,
        envMapIntensity: 0.55
      }));
      x.receiveShadow = !0, this.zoneGroup.add(x);
      let g = new Mesh(new TorusGeometry(t / 2 + 5, 7, 6, 72), mat(e.groundHigh, {
        roughness: 1,
        env: 0.4
      }));
      if (g.rotation.x = Math.PI / 2, g.position.y = -4.4, g.receiveShadow = !0, this.zoneGroup.add(g), e.water) {
        let m = new Mesh(new PlaneGeometry(t * 1.6, t * 1.6, 1, 1), new MeshStandardMaterial({
          color: e.water,
          transparent: !0,
          opacity: 0.82,
          roughness: 0.08,
          metalness: 0.25,
          envMapIntensity: 1.6
        }));
        m.rotation.x = -Math.PI / 2, m.position.y = -1.15, this.zoneGroup.add(m), this.water = m;
      } else this.water = null;
    }
    buildCityGround(e) {
      let t = this.zone.size,
        n = this.zone.water?.level ?? -1.35,
        s = Math.max(40, Math.round(t / 2.6)),
        r = new PlaneGeometry(t * 1.04, t * 1.04, s, s);
      r.rotateX(-Math.PI / 2);
      let o = r.attributes.position,
        a = new Float32Array(o.count * 3),
        l = new Color(e.yard),
        c = new Color(e.dirt),
        h = new Color(e.seabed),
        d = new Color();
      for (let f = 0; f < o.count; f++) {
        let p = o.getX(f),
          x = o.getZ(f),
          g = heightAt(this.zone.id, p, x);
        x < EDGE_Y && (g = n - 0.5 - Math.min(4.5, (EDGE_Y - x) * 0.22)), o.setY(f, g);
        let m = fbm(p * 0.06, x * 0.06, 91, 3);
        d.copy(l).lerp(c, MathUtils.clamp(0.35 + m * 1.3, 0, 1)), x < EDGE_Y + 3 && d.lerp(h, MathUtils.clamp((EDGE_Y + 3 - x) / 6, 0, 1)), a[f * 3] = d.r, a[f * 3 + 1] = d.g, a[f * 3 + 2] = d.b;
      }
      r.setAttribute("color", new BufferAttribute(a, 3)), r.computeVertexNormals();
      let u = new Mesh(r, new MeshStandardMaterial({
        vertexColors: !0,
        roughness: 0.97,
        metalness: 0,
        envMapIntensity: 0.45
      }));
      u.receiveShadow = !0, this.zoneGroup.add(u), this.water = null;
    }
    buildEdge(e) {
      let t = this.zone.size / 2,
        n = e.rim || "trees",
        s = this.urban,
        r = 80,
        o = new Group(),
        a = hash(this.zone.id) + 991,
        l = T => !s || T > EDGE_Y + 3,
        c = s ? 0.5 : 1,
        h = e.rock ?? e.groundHigh,
        d = n === "cloud" ? [{
          r: t - 5,
          lift: -0.2,
          c: e.groundHigh,
          ground: !0
        }, {
          r: t + 1.5,
          lift: 1.6,
          c: e.groundHigh
        }, {
          r: t + 4,
          lift: -7,
          c: h
        }, {
          r: t + 9,
          lift: -26,
          c: mixHex(h, e.fog, 0.5)
        }] : [{
          r: t - 5,
          lift: -0.2,
          c: e.groundHigh,
          ground: !0
        }, {
          r: t + 2,
          lift: 4.2 * c,
          c: e.groundHigh
        }, {
          r: t + 13,
          lift: 9.5 * c,
          c: mixHex(h, e.fog, 0.25)
        }, {
          r: t + 52,
          lift: 7.5 * c,
          c: mixHex(e.fog, h, 0.3)
        }, {
          r: t + 260,
          lift: 1.5 * c,
          c: e.fog
        }],
        u = [],
        f = [],
        p = new Color(),
        x = (T, y) => {
          let M = d[T],
            P = fbm(Math.cos(y) * 9, Math.sin(y) * 9, a, 2) * (T === 0 ? 1.6 : 9),
            A = M.r + P * (T === d.length - 1 ? 0 : 1),
            k = Math.cos(y) * A,
            L = Math.sin(y) * A,
            B = (M.ground ? this.heightAt(k, L) : this.heightAt(Math.cos(y) * (t - 5), Math.sin(y) * (t - 5))) + M.lift + (T === 0 ? 0 : fbm(k * 0.05, L * 0.05, a + T * 7, 2) * 4.5 * c);
          return [k, B, L];
        },
        g = (T, y) => {
          p.set(y), u.push(T[0], T[1], T[2]), f.push(p.r, p.g, p.b);
        };
      for (let T = 0; T < r; T++) {
        let y = T / r * Math.PI * 2,
          M = (T + 1) / r * Math.PI * 2;
        if (l(Math.sin((y + M) / 2) * t)) for (let P = 0; P < d.length - 1; P++) {
          let A = x(P, y),
            k = x(P, M),
            L = x(P + 1, y),
            O = x(P + 1, M);
          g(A, d[P].c), g(L, d[P + 1].c), g(O, d[P + 1].c), g(A, d[P].c), g(O, d[P + 1].c), g(k, d[P].c);
        }
      }
      if (u.length) {
        let T = new BufferGeometry();
        T.setAttribute("position", new Float32BufferAttribute(u, 3)), T.setAttribute("color", new Float32BufferAttribute(f, 3)), T.computeVertexNormals();
        let y = new Mesh(T, new MeshStandardMaterial({
          vertexColors: !0,
          roughness: 1,
          metalness: 0,
          envMapIntensity: 0.35
        }));
        y.receiveShadow = !1, o.add(y);
      }
      let m = rng(a),
        v = Math.round((n === "mesa" ? 55 : n === "cliff" ? 150 : 190) * Math.min(1, this.density + 0.35)),
        E = new Object3D(),
        _ = [];
      for (let T = 0; n !== "cloud" && T < v * 2 && _.length < v; T++) {
        let y = m() * Math.PI * 2,
          M = t + 1 + m() * 22,
          P = Math.cos(y) * M,
          A = Math.sin(y) * M;
        if (!l(A)) continue;
        let k = this.heightAt(Math.cos(y) * (t - 5), Math.sin(y) * (t - 5)),
          L = Math.min(1, (M - t + 1) / 14);
        _.push({
          x: P,
          z: A,
          y: k + 4.2 * c * L + 5.3 * c * Math.max(0, L - 0.3),
          rot: m() * Math.PI * 2,
          s: 0.8 + m() * 0.9
        });
      }
      if (_.length && n === "mesa") {
        let T = mergePlain([xf2(new CylinderGeometry(1, 1.12, 0.55, 8), {
            y: 0.27
          }), xf2(new CylinderGeometry(0.92, 1, 0.3, 8), {
            y: 0.7,
            ry: 0.4
          }), xf2(new CylinderGeometry(0.86, 0.92, 0.42, 8), {
            y: 1.06,
            ry: 0.1
          }), xf2(new CylinderGeometry(0.9, 0.86, 0.12, 8), {
            y: 1.33
          })]) || new CylinderGeometry(1, 1.1, 1.4, 8),
          y = new InstancedMesh(T, mat(e.rock, {
            roughness: 1,
            flat: !0,
            env: 0.3
          }), _.length);
        y.castShadow = !1, y.receiveShadow = !1, _.forEach((M, P) => {
          E.position.set(M.x, M.y - 1.5, M.z), E.rotation.set(0, M.rot, 0), E.scale.set(M.s * 7, M.s * (7 + m() * 6), M.s * 7), E.updateMatrix(), y.setMatrixAt(P, E.matrix);
        }), o.add(y);
      } else if (_.length && n === "cliff") {
        let T = new DodecahedronGeometry(1, 0);
        offsetGeometry(T, 0.34);
        let y = new InstancedMesh(T, mat(e.rock, {
          roughness: 1,
          flat: !0,
          env: 0.3
        }), _.length);
        y.castShadow = !1, y.receiveShadow = !1, _.forEach((M, P) => {
          E.position.set(M.x, M.y + M.s * 3.5, M.z), E.rotation.set((m() - 0.5) * 0.3, M.rot, (m() - 0.5) * 0.3), E.scale.set(M.s * 5.5, M.s * 9, M.s * 5.5), E.updateMatrix(), y.setMatrixAt(P, E.matrix);
        }), o.add(y);
      } else if (_.length) {
        let T = mergePlain([xf2(blobGeo(2.6, 3.4, 2.6, 2.4, 12), {
            y: 3.6
          }), xf2(blobGeo(1.9, 2.2, 1.9, 2.4, 10), {
            y: 6.4,
            x: 0.5
          }), xf2(new CylinderGeometry(0.35, 0.55, 4.5, 6), {
            y: 1.6
          })]) || blobGeo(2.6, 3.4, 2.6, 2.4, 12),
          y = mixHex(e.leaf, 660496, 0.3),
          M = new InstancedMesh(T, mat(y, {
            roughness: 0.95,
            env: 0.35
          }), _.length);
        M.castShadow = !1, M.receiveShadow = !1, _.forEach((P, A) => {
          E.position.set(P.x, P.y, P.z), E.rotation.set(0, P.rot, 0), E.scale.set(P.s * 1.25, P.s * (1.1 + m() * 0.7), P.s * 1.25), E.updateMatrix(), M.setMatrixAt(A, E.matrix);
        }), o.add(M);
      }
      if (n === "cloud") {
        let T = this.heightAt(0, t - 5),
          y = new Mesh(new CircleGeometry(t + 320, 64), mat(14345458, {
            roughness: 1,
            env: 0.5,
            emissive: 2765896,
            emissiveIntensity: 0.6
          }));
        y.rotation.x = -Math.PI / 2, y.position.y = T - 19, o.add(y);
        let M = rng(a + 55),
          P = mergePlain([xf2(blobGeo(1, 0.42, 1, 2.2, 12), {}), xf2(blobGeo(0.62, 0.3, 0.62, 2.2, 10), {
            x: 0.8,
            y: 0.1
          }), xf2(blobGeo(0.5, 0.24, 0.5, 2.2, 10), {
            x: -0.7,
            z: 0.5
          })]) || blobGeo(1, 0.42, 1, 2.2, 12),
          A = QUALITY.tier === "low" ? 70 : 150,
          k = new InstancedMesh(P, mat(15660283, {
            roughness: 1,
            env: 0.8
          }), A);
        k.castShadow = !1, k.receiveShadow = !1;
        for (let L = 0; L < A; L++) {
          let O = M() * Math.PI * 2,
            B = t + 6 + M() * 240,
            W = 7 + M() * 26;
          E.position.set(Math.cos(O) * B, T - 18 + M() * 5, Math.sin(O) * B), E.rotation.set(0, M() * Math.PI * 2, 0), E.scale.set(W, W * (0.5 + M() * 0.5), W), E.updateMatrix(), k.setMatrixAt(L, E.matrix);
        }
        o.add(k);
      }
      let S = s ? t + 150 : n === "cloud" ? t + 140 : t + 62,
        b = new Mesh(new CylinderGeometry(S, S, 120, 56, 1, !0), new ShaderMaterial({
          vertexShader: "varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
          fragmentShader: `varying float vY; uniform vec3 uColor; uniform float uLo, uHi;
          void main(){ gl_FragColor = vec4(uColor, 0.97 * (1.0 - smoothstep(uLo, uHi, vY))); }`,
          uniforms: {
            uColor: {
              value: new Color(e.fog)
            },
            uLo: {
              value: S * 0.02
            },
            uHi: {
              value: S * 0.2
            }
          },
          transparent: !0,
          depthWrite: !1,
          side: BackSide,
          fog: !1
        }));
      b.position.y = this.heightAt(0, t - 5), b.renderOrder = -1, o.add(b), this.hazeWall = b.material, o.name = "worldEdge", this.edgeGroup = o, this.zoneGroup.add(o);
    }
    buildStreetTrees(e) {
      let t = this.props.trees,
        n = new Object3D();
      if (t.length) {
        let l = new CylinderGeometry(0.11, 0.17, 3.6, 6);
        l.translate(0, 1.8, 0);
        let c = mergeGeometries([xf2(blobGeo(0.86, 0.72, 0.86, 2.8, 12), {
            y: 4.2
          }), xf2(blobGeo(0.6, 0.5, 0.6, 2.8, 10), {
            y: 4.85,
            x: 0.16,
            z: -0.12
          }), xf2(blobGeo(0.5, 0.42, 0.5, 2.8, 10), {
            y: 3.85,
            x: -0.44,
            z: 0.3
          }), xf2(new CylinderGeometry(0.05, 0.05, 0.7, 5), {
            y: 3.6,
            x: 0.3,
            rz: -0.5
          })].map(u => u.toNonIndexed()), !1),
          h = new InstancedMesh(l, mat(e.bark, {
            roughness: 0.95
          }), t.length),
          d = new InstancedMesh(c, mat(e.leaf, {
            roughness: 0.88,
            env: 0.6
          }), t.length);
        h.castShadow = !0, d.castShadow = !0, t.forEach((u, f) => {
          n.position.set(u.x, this.heightAt(u.x, u.z), u.z), n.rotation.set(0, u.rot, 0), n.scale.setScalar(0.85 + u.s * 0.35), n.updateMatrix(), h.setMatrixAt(f, n.matrix), d.setMatrixAt(f, n.matrix);
        }), this.zoneGroup.add(h, d);
      }
      let s = this.props.grass.filter((l, c) => c % Math.max(1, Math.round(1 / this.density)) === 0);
      if (!s.length) return;
      let r = mergeGeometries([0, 1, 2, 3].map(l => {
          let c = l / 4 * Math.PI * 2 + 0.4;
          return xf2(profile(0.3 + l % 3 * 0.08, 0.05, 0.35, 4), {
            x: Math.cos(c) * 0.04,
            z: Math.sin(c) * 0.04,
            ry: c,
            rz: Math.cos(c * 1.7) * 0.4
          });
        }), !1),
        o = this.windMaterial(new MeshStandardMaterial({
          color: e.grass,
          roughness: 0.92,
          side: DoubleSide,
          envMapIntensity: 0.5
        }), 0.12),
        a = new InstancedMesh(r, o, s.length);
      s.forEach((l, c) => {
        n.position.set(l.x, this.heightAt(l.x, l.z), l.z), n.rotation.set(0, l.rot, 0), n.scale.setScalar(l.s), n.updateMatrix(), a.setMatrixAt(c, n.matrix);
      }), this.zoneGroup.add(a);
    }
    buildFoliage(e) {
      if (this.urban) {
        this.buildStreetTrees(e);
        return;
      }
      let t = this.props,
        n = (A, k) => k >= 1 ? A : A.filter((L, O) => O % Math.round(1 / k) === 0),
        s = n(t.trees, Math.min(1, this.density + 0.25)),
        r = n(t.rocks, Math.min(1, this.density + 0.3)),
        o = n(t.bushes, this.density),
        a = n(t.grass, this.density * 0.5),
        l = new Object3D(),
        c = new CylinderGeometry(0.16, 0.3, 2.6, 7);
      c.translate(0, 1.3, 0);
      let h = P(e.flora),
        d = mat(e.bark, {
          roughness: 0.92
        }),
        u = mat(e.leaf, {
          roughness: 0.85,
          env: 0.7
        }),
        f = new InstancedMesh(c, d, s.length),
        p = new InstancedMesh(h, u, s.length);
      f.castShadow = !0, f.receiveShadow = !0, p.castShadow = !0, s.forEach((A, k) => {
        let L = heightAt(this.zone.id, A.x, A.z);
        l.position.set(A.x, L, A.z), l.rotation.set(A.tilt, A.rot, A.tilt * 0.6);
        let O = A.kind === "slim";
        l.scale.set(A.s * (O ? 0.78 : 1), A.s * (O ? 1.25 : 1), A.s * (O ? 0.78 : 1)), l.updateMatrix(), f.setMatrixAt(k, l.matrix), p.setMatrixAt(k, l.matrix);
      }), this.zoneGroup.add(f, p);
      let x = e.rockStyle,
        g = x === "strata" ? buildBush() : x === "shard" ? buildReed() : (() => {
          let A = new DodecahedronGeometry(1, 1);
          return offsetGeometry(A, 0.16), A;
        })(),
        m = mat(e.rock, {
          roughness: 0.9,
          flat: !0
        }),
        v = new InstancedMesh(g, m, Math.max(1, r.length));
      v.castShadow = !0, v.receiveShadow = !0;
      let E = x === "shard" ? new InstancedMesh(new OctahedronGeometry(0.2, 0), glowMat(11457791, 0.75), Math.max(1, r.length)) : null;
      r.forEach((A, k) => {
        let L = heightAt(this.zone.id, A.x, A.z),
          O = x === "strata" || x === "shard";
        l.position.set(A.x, L + (O ? 0 : A.s * 0.35), A.z), l.rotation.set(O ? A.tiltX * 0.25 : A.tiltX, A.rot, O ? A.tiltZ * 0.25 : A.tiltZ), O ? l.scale.set(A.s, A.s * (1.5 + A.tiltX), A.s) : l.scale.set(A.s, A.s * 0.75, A.s * 0.9), l.updateMatrix(), v.setMatrixAt(k, l.matrix), E && (l.position.y = L + A.s * (1.5 + A.tiltX) * 2.55, l.scale.setScalar(A.s * 0.9), l.updateMatrix(), E.setMatrixAt(k, l.matrix));
      }), this.zoneGroup.add(v), E && (E.userData.noOutline = !0, this.zoneGroup.add(E));
      let _ = blobGeo(0.6, 0.42, 0.6, 2.3, 12),
        S = this.windMaterial(mat(mixHex(e.leaf, 662032, 0.25), {
          roughness: 0.9
        }), 0.06),
        b = new InstancedMesh(_, S, Math.max(1, o.length));
      b.castShadow = !0, o.forEach((A, k) => {
        let L = heightAt(this.zone.id, A.x, A.z);
        l.position.set(A.x, L + 0.22 * A.s, A.z), l.rotation.set(0, A.rot, 0), l.scale.setScalar(A.s), l.updateMatrix(), b.setMatrixAt(k, l.matrix);
      }), this.zoneGroup.add(b);
      let T = mergeGeometries([0, 1, 2, 3, 4].map(A => {
          let k = A / 5 * Math.PI * 2 + 0.4,
            L = 0.4 + A % 3 * 0.12;
          return xf2(profile(L, 0.055, 0.35, 5), {
            x: Math.cos(k) * 0.045,
            z: Math.sin(k) * 0.045,
            ry: k,
            rz: Math.cos(k * 1.7) * 0.34,
            rx: Math.sin(k) * 0.2
          });
        }), !1) || profile(0.5, 0.08, 0.25, 6),
        y = this.windMaterial(new MeshStandardMaterial({
          color: e.grass,
          roughness: 0.9,
          side: DoubleSide,
          envMapIntensity: 0.6
        }), 0.16),
        M = new InstancedMesh(T, y, Math.max(1, a.length));
      M.receiveShadow = !1, a.forEach((A, k) => {
        let L = heightAt(this.zone.id, A.x, A.z);
        l.position.set(A.x, L, A.z), l.rotation.set(0, A.rot, 0), l.scale.setScalar(A.s), l.updateMatrix(), M.setMatrixAt(k, l.matrix);
      }), this.zoneGroup.add(M);
      function P(A) {
        let k = A === "arid" ? [xf2(blobGeo(1.9, 0.42, 1.9, 3.4, 14), {
          y: 2.9
        }), xf2(blobGeo(1.25, 0.3, 1.25, 3.4, 12), {
          y: 3.35,
          x: 0.3,
          z: -0.2
        }), xf2(blobGeo(0.8, 0.22, 0.8, 3.2, 10), {
          y: 2.55,
          x: -1.1,
          z: 0.5
        })] : A === "alpine" ? [xf2(blobGeo(1.35, 0.8, 1.1, 2.6, 14), {
          y: 3.1,
          x: 0.5,
          rz: -0.3
        }), xf2(blobGeo(0.95, 0.55, 0.8, 2.6, 12), {
          y: 3.7,
          x: 1.15,
          rz: -0.4
        }), xf2(blobGeo(0.7, 0.4, 0.6, 2.6, 10), {
          y: 2.5,
          x: -0.5,
          z: 0.3
        })] : [xf2(blobGeo(1.5, 1.15, 1.5, 2.3, 14), {
          y: 3.4
        }), xf2(blobGeo(1.05, 0.85, 1.05, 2.3, 12), {
          y: 4.35,
          x: 0.25
        }), xf2(blobGeo(0.8, 0.62, 0.8, 2.3, 12), {
          y: 3,
          x: -0.9,
          z: 0.4
        })];
        return mergePlain(k) || k[0];
      }
    }
    buildDecals(e) {
      let t = e.decal;
      if (!t || this.urban) return;
      let n = this.zone.size / 2 - 8,
        s = rng(hash(this.zone.id) + 7717),
        r = [],
        o = [],
        a = new Color(),
        l = new Color(t.color),
        c = new Color(e.groundHigh);
      for (let u = 0; u < t.count; u++) {
        let f = (s() * 2 - 1) * n,
          p = (s() * 2 - 1) * n,
          x = t.size[0] + s() * (t.size[1] - t.size[0]),
          g = 9,
          m = [];
        for (let E = 0; E < g; E++) {
          let _ = E / g * Math.PI * 2,
            S = x * (0.55 + fbm(Math.cos(_) * 3 + u, Math.sin(_) * 3, 404, 2) * 1.4),
            b = f + Math.cos(_) * S,
            T = p + Math.sin(_) * S;
          m.push([b, heightAt(this.zone.id, b, T) + 0.035, T]);
        }
        let v = [f, heightAt(this.zone.id, f, p) + 0.045, p];
        for (let E = 0; E < g; E++) {
          let _ = m[E],
            S = m[(E + 1) % g];
          for (let [b, T] of [[v, l], [S, c], [_, c]]) r.push(b[0], b[1], b[2]), a.copy(T), o.push(a.r, a.g, a.b);
        }
      }
      if (!r.length) return;
      let h = new BufferGeometry();
      h.setAttribute("position", new Float32BufferAttribute(r, 3)), h.setAttribute("color", new Float32BufferAttribute(o, 3)), h.computeVertexNormals();
      let d = new Mesh(h, new MeshStandardMaterial({
        vertexColors: !0,
        roughness: 0.94,
        metalness: 0,
        envMapIntensity: 0.4,
        polygonOffset: !0,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }));
      d.receiveShadow = !0, this.zoneGroup.add(d);
    }
    windMaterial(e, t) {
      let n = e.clone();
      return n.userData = {
        wind: !0,
        shared: !1
      }, n.onBeforeCompile = s => {
        s.uniforms.uTime = {
          value: 0
        }, s.uniforms.uStrength = {
          value: t
        }, s.vertexShader = s.vertexShader.replace("#include <common>", `#include <common>
          uniform float uTime; uniform float uStrength;`).replace("#include <begin_vertex>", `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 wpos = (instanceMatrix * vec4(transformed, 1.0)).xyz;
          #else
            vec3 wpos = transformed;
          #endif
          float sway = sin(uTime * 1.6 + wpos.x * 0.35 + wpos.z * 0.28);
          transformed.x += sway * uStrength * max(0.0, transformed.y);
          transformed.z += cos(uTime * 1.1 + wpos.x * 0.2) * uStrength * 0.6 * max(0.0, transformed.y);
        `), n.userData.shader = s;
      }, n.needsUpdate = !0, this.windMaterials.push(n), n;
    }
    buildBuildings(e) {
      let t = [],
        n = mat(e.wall, {
          roughness: 0.88
        }),
        s = mat(mixHex(e.wall, 2760984, 0.3), {
          roughness: 0.9
        }),
        r = mat(e.roof, {
          roughness: 0.78
        }),
        o = mat(mixHex(e.roof, 1774096, 0.34), {
          roughness: 0.85
        }),
        a = mat(e.bark, {
          roughness: 0.85
        }),
        l = mat(16770728, {
          emissive: 16763490,
          emissiveIntensity: 0.9,
          roughness: 0.3
        }),
        c = mat(mixHex(e.wall, 9080726, 0.55), {
          roughness: 0.96
        }),
        h = mat(mixHex(e.bark, 1182728, 0.35), {
          roughness: 0.8
        });
      for (let u of this.props.buildings) {
        let f = heightAt(this.zone.id, u.x, u.z),
          p = u.kind === "hall" ? 1.35 : 1,
          x = u.h * p,
          g = {
            x: u.x,
            y: f,
            z: u.z,
            ry: u.rot
          },
          m = (S, b = {}) => xf2(S, {
            ...b,
            ...rotateLocal(g, b)
          });
        t.push({
          geo: m(new BoxGeometry(u.w + 0.22, 0.34, u.d + 0.22), {
            y: 0.17
          }),
          mat: c
        }), t.push({
          geo: m(new BoxGeometry(u.w, x, u.d), {
            y: x / 2
          }),
          mat: n
        }), t.push({
          geo: m(new BoxGeometry(u.w + 0.07, 0.15, u.d + 0.07), {
            y: x * 0.54
          }),
          mat: a
        }), t.push({
          geo: m(new BoxGeometry(u.w + 0.14, 0.16, u.d + 0.14), {
            y: x + 0.02
          }),
          mat: s
        }), t.push({
          geo: m(new BoxGeometry(u.w + 0.62, 0.12, u.d + 0.74), {
            y: x + 0.14
          }),
          mat: a
        });
        let v = u.w * 0.74,
          E = new CylinderGeometry(v, v, u.d + 0.7, 3, 1);
        t.push({
          geo: m(E, {
            y: x + 0.5,
            rx: Math.PI / 2,
            rz: Math.PI / 6
          }),
          mat: r
        }), t.push({
          geo: m(new BoxGeometry(0.2, 0.16, u.d + 0.82), {
            y: x + 0.5 + v - 0.04
          }),
          mat: a
        });
        for (let S of [-1, 1]) for (let b = 1; b <= 6; b++) {
          let T = b / 7;
          t.push({
            geo: m(new BoxGeometry(0.16, 0.11, u.d + 0.76), {
              x: S * 0.866 * v * T,
              y: x + 0.5 + v - 1.5 * v * T,
              z: 0,
              rz: S * Math.PI / 3
            }),
            mat: o
          });
        }
        let _ = u.d / 2;
        t.push({
          geo: m(new BoxGeometry(0.86, 1.46, 0.09), {
            y: 0.73,
            z: _ + 0.015
          }),
          mat: a
        }), t.push({
          geo: m(new BoxGeometry(0.62, 1.22, 0.1), {
            y: 0.61,
            z: _ + 0.05
          }),
          mat: h
        }), t.push({
          geo: m(new BoxGeometry(0.98, 0.12, 0.42), {
            y: 0.06,
            z: _ + 0.2
          }),
          mat: c
        });
        for (let S of [-1, 1]) {
          let b = S * u.w * 0.3,
            T = x * 0.62;
          t.push({
            geo: m(new BoxGeometry(0.64, 0.64, 0.07), {
              x: b,
              y: T,
              z: _ + 0.01
            }),
            mat: a
          }), t.push({
            geo: m(new BoxGeometry(0.46, 0.46, 0.08), {
              x: b,
              y: T,
              z: _ + 0.04
            }),
            mat: l
          }), t.push({
            geo: m(new BoxGeometry(0.05, 0.5, 0.06), {
              x: b,
              y: T,
              z: _ + 0.07
            }),
            mat: a
          }), t.push({
            geo: m(new BoxGeometry(0.5, 0.05, 0.06), {
              x: b,
              y: T,
              z: _ + 0.07
            }),
            mat: a
          }), t.push({
            geo: m(new BoxGeometry(0.72, 0.1, 0.16), {
              x: b,
              y: T - 0.36,
              z: _ + 0.06
            }),
            mat: c
          });
        }
        for (let S of [-1, 1]) for (let b of [-1, 1]) t.push({
          geo: m(new BoxGeometry(0.13, x, 0.13), {
            x: S * u.w / 2,
            y: x / 2,
            z: b * u.d / 2
          }),
          mat: a
        });
        if (u.kind === "hall" || (Math.round(u.x * 7 + u.z * 13) & 3) !== 0) {
          let S = u.w * 0.3,
            b = -u.d * 0.2;
          t.push({
            geo: m(new BoxGeometry(0.46, 1.35, 0.46), {
              x: S,
              y: x + 1.05,
              z: b
            }),
            mat: c
          }), t.push({
            geo: m(new BoxGeometry(0.6, 0.14, 0.6), {
              x: S,
              y: x + 1.78,
              z: b
            }),
            mat: s
          });
        }
      }
      if (!t.length) return;
      let d = mergeByMaterial(t, {
        castShadow: !0,
        receiveShadow: !0
      });
      d.receiveShadow = !0, this.zoneGroup.add(d);
    }
    buildLandmarks(e) {
      let t = new Group();
      this.portalRings = [];
      for (let n of this.zone.landmarks) {
        let s = heightAt(this.zone.id, n.x, n.z);
        if (n.kind === "portal") {
          let r = new Mesh(new TorusGeometry(1.9, 0.18, 12, 40), mat(13625855, {
            emissive: 6269183,
            emissiveIntensity: 1.6,
            roughness: 0.25,
            metalness: 0.3
          }));
          r.position.set(n.x, s + 2.2, n.z), r.castShadow = !0;
          let o = new Mesh(new CircleGeometry(1.78, 32), glowMat(8373503, 0.28));
          o.position.copy(r.position);
          let a = new Mesh(new CylinderGeometry(2.3, 2.6, 0.3, 24), mat(e.wall, {
            roughness: 0.8
          }));
          if (a.position.set(n.x, s + 0.15, n.z), a.receiveShadow = !0, t.add(r, o, a), QUALITY.tier !== "low") {
            let l = new PointLight(7321855, 3.5, 12, 2);
            l.position.set(n.x, s + 2.2, n.z), t.add(l);
          }
          this.portalRings.push({
            arch: r,
            veil: o
          });
        } else if (n.kind === "dungeon") {
          let r = new Mesh(blobGeo(2, 2.6, 0.7, 4.5, 16), mat(3814736, {
            roughness: 0.85
          }));
          r.position.set(n.x, s + 2.2, n.z), r.castShadow = !0;
          let o = new Mesh(new CircleGeometry(1.25, 26), new MeshBasicMaterial({
            color: 657172
          }));
          o.position.set(n.x, s + 2, n.z + 0.72);
          let a = new Mesh(new TorusGeometry(1.35, 0.07, 8, 32), glowMat(11566335, 0.85));
          if (a.position.set(n.x, s + 2, n.z + 0.75), t.add(r, o, a), QUALITY.tier !== "low") {
            let l = new PointLight(10514431, 2.6, 10, 2);
            l.position.set(n.x, s + 2.2, n.z + 1), t.add(l);
          }
          this.portalRings.push({
            arch: a,
            veil: null
          });
        } else if (n.kind === "npc" || n.kind === "shop") {
          let r = new Mesh(new CylinderGeometry(0.09, 0.11, 2.3, 8), mat(e.bark, {
            roughness: 0.9
          }));
          r.position.set(n.x, s + 1.15, n.z), r.castShadow = !0;
          let o = new Mesh(blobGeo(0.7, 0.42, 0.06, 4, 12), mat(n.kind === "shop" ? 15972159 : 7652592, {
            roughness: 0.5,
            emissive: n.kind === "shop" ? 7360005 : 865616,
            emissiveIntensity: 0.5
          }));
          if (o.position.set(n.x, s + 2.2, n.z), o.castShadow = !0, t.add(r, o), n.kind === "npc") {
            let a = buildAvatar({
              body: "stocky",
              skin: "#e0ac7e",
              hair: "#e8e8e8",
              outfit: "scholar"
            });
            a.position.set(n.x + 0.9, s, n.z), a.rotation.y = Math.PI, a.userData.baseY = s, t.add(a), this.npcAvatar = a;
          }
        } else if (n.kind === "town" || n.kind === "camp") {
          let r = new Mesh(new CylinderGeometry(0.85, 0.95, 0.7, 18), mat(e.rock, {
            roughness: 0.9
          }));
          r.position.set(n.x, s + 0.35, n.z), r.castShadow = !0, r.receiveShadow = !0;
          let o = new Mesh(new CircleGeometry(0.78, 20), mat(3108751, {
            roughness: 0.1,
            metalness: 0.4,
            env: 1.8
          }));
          if (o.rotation.x = -Math.PI / 2, o.position.set(n.x, s + 0.68, n.z), t.add(r, o), QUALITY.tier !== "low") {
            let a = new PointLight(16763274, 6, 22, 2);
            a.position.set(n.x, s + 4.2, n.z), t.add(a);
          }
        }
      }
      this.zoneGroup.add(t);
    }
    buildUrbanLandmarks(e) {
      let t = new Group();
      this.portalRings = [];
      for (let n of this.zone.landmarks) {
        let s = this.heightAt(n.x, n.z);
        if (n.kind === "portal") {
          let r = new Mesh(new TorusGeometry(2.1, 0.2, 12, 40), mat(13625855, {
            emissive: 6269183,
            emissiveIntensity: 1.6,
            roughness: 0.25,
            metalness: 0.3
          }));
          r.position.set(n.x, s + 2.5, n.z), r.castShadow = !0;
          let o = new Mesh(new CircleGeometry(1.98, 32), glowMat(8373503, 0.28));
          o.position.copy(r.position);
          let a = new Mesh(new CylinderGeometry(2.8, 3.1, 0.42, 24), mat(e.stone ?? e.rock ?? 9277330, {
            roughness: 0.9
          }));
          if (a.position.set(n.x, s + 0.2, n.z), a.receiveShadow = !0, t.add(r, o, a), QUALITY.tier !== "low") {
            let l = new PointLight(7321855, 3.5, 14, 2);
            l.position.set(n.x, s + 2.5, n.z), t.add(l);
          }
          this.portalRings.push({
            arch: r,
            veil: o
          });
        } else if (n.kind === "dungeon") {
          let r = new Mesh(new TorusGeometry(1.15, 0.08, 8, 28), glowMat(11566335, 0.5));
          if (r.position.set(n.x, s + 1.4, n.z - 0.4), r.rotation.x = Math.PI / 2, t.add(r), QUALITY.tier !== "low") {
            let o = new PointLight(10514431, 2.4, 9, 2);
            o.position.set(n.x, s + 0.8, n.z), t.add(o);
          }
          this.portalRings.push({
            arch: r,
            veil: null
          });
        } else if (n.kind === "plaza" && QUALITY.tier !== "low") {
          let r = new PointLight(16760954, 4, 26, 2);
          r.position.set(n.x, s + 6.4, n.z), t.add(r), this.plazaLight = r;
        }
      }
      this.zoneGroup.add(t);
    }
    buildNpcs() {
      let e = new Group();
      for (let t of Object.values(NPCS)) {
        let n = buildAvatar({
            body: t.body,
            skin: t.skin,
            hair: t.hair,
            outfit: t.outfit
          }),
          s = AVATAR.outfits.find(l => l.id === t.outfit) || AVATAR.outfits[0],
          r = buildNpcBody(t.outfit, {
            coat: new Color(s.a).getHex(),
            trouser: new Color(s.b).getHex()
          });
        r && n.add(r);
        let o = new Group();
        o.add(n, softShadowTexture(0.6, 0.3));
        let a = new Mesh(new OctahedronGeometry(0.3, 0), glowMat(3139280, 0.55));
        a.position.y = (n.userData.height || 1.78) + 0.75, a.scale.set(0.7, 1.5, 0.7), a.visible = !1, o.add(a), e.add(o), this.npcs.set(t.id, {
          id: t.id,
          def: t,
          holder: o,
          group: n,
          marker: a,
          target: new Vector3(),
          rotTarget: 0,
          moving: !1,
          act: "idle",
          phase: Math.random() * 6.28
        });
      }
      this.zoneGroup.add(e), this._npcAt = void 0, this.setNpcs(0.35);
      for (let t of this.npcs.values()) t.holder.position.copy(t.target);
    }
    setNpcs(e) {
      if (!this.npcs.size) return;
      let t = this.time;
      if (!(this._npcAt !== void 0 && t - this._npcAt < 0.1)) {
        this._npcAt = t;
        for (let n of npcList(e)) {
          let s = this.npcs.get(n.id);
          if (!s) continue;
          let r = n.act === "sleep";
          s.act = n.act, s.moving = n.moving;
          let o = resolveCollision(this.colliders, n.x, n.z, 0.45);
          if (s.target.set(o.x, this.heightAt(o.x, o.z), o.z), n.moving && (s.rotTarget = n.rot), r) {
            s.holder.visible = !1;
            continue;
          }
          s.holder.visible || s.holder.position.copy(s.target), s.holder.visible = !0;
        }
      }
    }
    updateNpcs(e, t) {
      if (!this.npcs.size) return;
      if (this._inside) {
        for (let s of this._plates?.values() || []) s.style.display = "none";
        return;
      }
      let n = typeof window < "u" ? window.__hobileQuestNpc : null;
      for (let s of this.npcs.values()) {
        if (!s.holder.visible) continue;
        s.holder.position.lerp(s.target, Math.min(1, e * 4));
        let r = s.rotTarget - s.holder.rotation.y;
        for (; r > Math.PI;) r -= Math.PI * 2;
        for (; r < -Math.PI;) r += Math.PI * 2;
        s.holder.rotation.y += r * Math.min(1, e * 6), s.group.userData.baseY = 0, setCreatureLod(s.group, s.holder.position.distanceTo(this.camera.position)), animateCreature(s.group, t, s.moving);
        let o = t * 0.001 + s.phase,
          a = s.group.userData.rig;
        if (!s.moving && a?.arms?.length) {
          if (s.act === "work") {
            let l = Math.abs(Math.sin(o * 2.6));
            a.arms[0].rotation.x = -0.5 - l * 0.9, a.arms[1].rotation.x = -0.3 - l * 0.4, s.group.rotation.y = Math.sin(o * 0.4) * 0.08;
          } else if (s.act === "social") {
            let l = Math.sin(o * 1.7);
            a.arms[0].rotation.x = -0.15 + l * 0.55, a.arms[0].rotation.z = 0.09 + Math.max(0, l) * 0.35, s.group.rotation.y = Math.sin(o * 0.5) * 0.42;
          } else s.group.rotation.y = Math.sin(o * 0.3) * 0.12;
        } else s.moving && (s.group.rotation.y = 0);
        if (s.marker) {
          let l = n === s.id;
          s.marker.visible = l, l && (s.marker.rotation.y = o * 1.6, s.marker.position.y = (s.group.userData.height || 1.78) + 0.75 + Math.sin(o * 2.2) * 0.12);
        }
      }
      this.syncNpcPlates();
    }
    syncNpcPlates() {
      if (!this.npcs.size) return;
      this._overlay === void 0 && (this._overlay = typeof document < "u" ? document.getElementById("overlay") : null);
      let e = this._overlay;
      if (e) {
        this._plates = this._plates || new Map();
        for (let t of this.npcs.values()) {
          let n = this._plates.get(t.id);
          n || (n = document.createElement("div"), n.className = "nameplate npc", n.style.borderColor = "rgba(47, 230, 208, 0.42)", n.textContent = t.def.he || t.def.name, this._plates.set(t.id, n)), n.isConnected || e.appendChild(n);
          let s = this.npcScreenPos(t.id),
            r = t.holder.visible && s.visible && s.dist < 42;
          n.style.display = r ? "block" : "none", r && (n.style.left = `${s.x}px`, n.style.top = `${s.y}px`, n.style.opacity = String(Math.max(0.35, 1 - s.dist / 46)));
        }
      }
    }
    clearPlates() {
      for (let e of this._plates?.values() || []) e.remove();
      this._plates?.clear();
    }
    npcPosition(e) {
      let t = this.npcs.get(e);
      return t && t.holder.visible ? t.holder.position : null;
    }
    npcScreenPos(e) {
      let t = this.npcs.get(e);
      if (!t) return {
        x: 0,
        y: 0,
        visible: !1,
        dist: 1 / 0
      };
      eo.copy(t.holder.position), eo.y += (t.group.userData.height || 1.78) + 0.42;
      let n = this.project(eo);
      return n.dist = t.holder.position.distanceTo(this.camera.position), n;
    }
    enterInterior(e) {
      if (this.interior || !e || !e.door) return null;
      let t = e.door,
        n = e.kind || "shop",
        s = interiorOf(t, this.props, this.zone, e),
        r = Math.atan2(s.x, s.z),
        o = r + Math.PI,
        a = Math.cos(o),
        l = Math.sin(o),
        c = (T, y) => ({
          x: t.x + T * a + y * l,
          z: t.z - T * l + y * a
        }),
        h = buildInterior(n, this.palette || {}),
        d = this.heightAt(t.x, t.z) + 0.18;
      h.group.position.set(t.x, d, t.z), h.group.rotation.y = o;
      let u = {
        def: e,
        room: h,
        kind: n,
        door: t,
        yaw: r,
        G: o,
        cos: a,
        sin: l,
        floorY: d,
        toWorld: c,
        colliders: this.colliders,
        blockers: this.blockers,
        cam: {
          dist: this.camDist,
          height: this.camHeight,
          min: this.camMin
        },
        fog: this.scene.fog,
        background: this.scene.background,
        skyVisible: this.sky ? this.sky.visible : !0,
        zoneVisible: this.zoneGroup.visible,
        exposure: this.renderer.toneMappingExposure,
        fov: this.camera.fov,
        lights: {
          hemiSky: this.lights.hemi.color.getHex(),
          hemiGround: this.lights.hemi.groundColor.getHex(),
          hemiI: this.lights.hemi.intensity,
          sun: this.lights.sun.color.getHex(),
          sunI: this.lights.sun.intensity,
          rim: this.lights.rim.color.getHex(),
          rimI: this.lights.rim.intensity
        },
        npcPos: new Vector3(),
        added: []
      };
      this._inside = u, this.interior = e, this.colliders = h.colliders.map(T => {
        let y = c(T.x, T.z);
        return T.hw !== void 0 ? {
          x: y.x,
          z: y.z,
          hw: T.hw,
          hd: T.hd,
          rot: o,
          kind: "interior"
        } : {
          x: y.x,
          z: y.z,
          r: T.r,
          kind: "interior"
        };
      }), this.blockers = h.blockers.map(T => {
        let y = c(T.x, T.z);
        return T.hw !== void 0 ? {
          x: y.x,
          z: y.z,
          hw: T.hw,
          hd: T.hd,
          rot: o,
          top: T.top
        } : {
          x: y.x,
          z: y.z,
          r: T.r,
          top: T.top
        };
      });
      let f = npcNear(e, n),
        p = buildAvatar(f),
        x = AVATAR.outfits.find(T => T.id === f.outfit) || AVATAR.outfits[0],
        g = buildNpcBody(f.outfit, {
          coat: new Color(x.a).getHex(),
          trouser: new Color(x.b).getHex()
        });
      g && p.add(g);
      let m = new Group();
      m.add(p, softShadowTexture(0.6, 0.26)), m.position.set(h.npc.x, 0, h.npc.z), m.rotation.y = h.npc.ry, h.group.add(m), u.keeper = {
        holder: m,
        group: p,
        look: f
      };
      let v = c(h.npc.x, h.npc.z);
      u.npcPos.set(v.x, d, v.z);
      let E = h.lit;
      for (let T of h.points) {
        if (QUALITY.tier === "low") break;
        let y = c(T.x, T.z),
          M = new PointLight(T.color, T.power, T.range, 2);
        M.position.set(y.x, d + T.y, y.z), h.group.add(M), u.added.push({
          light: M,
          power: T.power,
          src: T
        });
      }
      this.scene.add(h.group), this.zoneGroup.visible = !1, this.sky && (this.sky.visible = !1), this.scene.background = new Color(E.bg), this.scene.fog = new Fog(E.fog, E.near, E.far), this.lights.hemi.color.set(E.sky), this.lights.hemi.groundColor.set(E.ground), this.lights.hemi.intensity = E.hemi, this.lights.sun.color.set(E.sun), this.lights.sun.intensity = E.sunI, this.lights.rim.color.set(E.rim), this.lights.rim.intensity = E.rimI, this.renderer.toneMappingExposure = E.exposure, this.camera.fov = 66, this.camera.updateProjectionMatrix(), this.camDist = 5, this.camHeight = 2.6, this.camMin = 1.05, this.camYaw = r;
      let _ = c(h.spawn.x, h.spawn.z),
        S = resolveCollision(this.colliders, _.x, _.z, SUN_STRENGTH),
        b = this.selfActor();
      return b && (b.holder.position.set(S.x, d, S.z), b.target.copy(b.holder.position), b.rotTarget = r, b.holder.rotation.y = r, b.moving = !1), this._camReach = void 0, e;
    }
    exitInterior({
      move: e = !0
    } = {}) {
      let t = this._inside;
      if (!t) return null;
      let {
        def: n,
        room: s
      } = t;
      this.scene.remove(s.group), disposeTree(s.group), this.colliders = t.colliders, this.blockers = t.blockers, this.camDist = t.cam.dist, this.camHeight = t.cam.height, this.camMin = t.cam.min, this.scene.fog = t.fog, this.scene.background = t.background, this.sky && (this.sky.visible = t.skyVisible), this.zoneGroup.visible = t.zoneVisible, this.lights.hemi.color.setHex(t.lights.hemiSky), this.lights.hemi.groundColor.setHex(t.lights.hemiGround), this.lights.hemi.intensity = t.lights.hemiI, this.lights.sun.color.setHex(t.lights.sun), this.lights.sun.intensity = t.lights.sunI, this.lights.rim.color.setHex(t.lights.rim), this.lights.rim.intensity = t.lights.rimI, this.renderer.toneMappingExposure = t.exposure, this.camera.fov = t.fov, this.camera.updateProjectionMatrix(), this._inside = null, this.interior = null, this._camReach = void 0;
      for (let r of this.actors.values()) r.holder.visible = !0;
      if (e) {
        let r = {
            x: t.door.x - Math.sin(t.yaw) * 1.9,
            z: t.door.z - Math.cos(t.yaw) * 1.9
          },
          o = resolveCollision(this.colliders, r.x, r.z, SUN_STRENGTH);
        this.snapSelf(o.x, o.z), this.camYaw = t.yaw + Math.PI;
      }
      return this._phase !== void 0 && this.setTimeOfDay(this._phase), n;
    }
    atInteriorExit() {
      let e = this._inside,
        t = this.selfActor();
      if (!e || !t) return !1;
      let n = t.holder.position.x - e.door.x,
        s = t.holder.position.z - e.door.z,
        r = n * e.cos - s * e.sin,
        o = n * e.sin + s * e.cos;
      return Math.hypot(r - e.room.exit.x, o - e.room.exit.z) < e.room.exit.r;
    }
    interiorNpc() {
      let e = this._inside;
      return e ? {
        ...e.keeper.look,
        kind: e.kind,
        interior: e.def.id ?? e.kind
      } : null;
    }
    interiorNpcScreenPos() {
      let e = this._inside;
      if (!e) return {
        x: 0,
        y: 0,
        visible: !1,
        dist: 1 / 0
      };
      eo.copy(e.npcPos), eo.y += (e.keeper.group.userData.height || 1.78) + 0.42;
      let t = this.project(eo);
      return t.dist = e.npcPos.distanceTo(this.camera.position), t;
    }
    interiorNpcDistance() {
      let e = this._inside,
        t = this.selfActor();
      return !e || !t ? 1 / 0 : Math.hypot(t.holder.position.x - e.npcPos.x, t.holder.position.z - e.npcPos.z);
    }
    ensureActor(e, t) {
      let n = this.actors.get(e);
      if (n && n.signature === t.signature) return n;
      n && this.removeActor(e);
      let s = new Group(),
        r = t.kind === "player" ? buildAvatar(t.appearance) : buildCreature(t.species, {
          outline: t.kind !== "wild"
        });
      s.add(r);
      let o = softShadowTexture(t.kind === "boss" ? 3.6 : 0.62, t.kind === "boss" ? 0.42 : 0.3);
      return s.add(o), this.scene.add(s), n = {
        key: e,
        holder: s,
        group: r,
        shadow: o,
        kind: t.kind,
        signature: t.signature,
        target: new Vector3(),
        rotTarget: 0,
        moving: !1,
        pet: null
      }, this.actors.set(e, n), t.kind === "player" && t.petSpecies && this.attachPet(n, t.petSpecies), n;
    }
    attachPet(e, t) {
      if (e.pet?.species === t) return;
      if (e.pet && (e.holder.remove(e.pet.holder), disposeTree(e.pet.holder)), !t || !SPECIES[t]) {
        e.pet = null;
        return;
      }
      let n = new Group(),
        s = buildCreature(t, {
          outline: !1
        });
      s.scale.multiplyScalar(0.6), n.add(s, softShadowTexture(0.38, 0.24)), n.position.set(-1.35, 0, -1.45), e.holder.add(n), e.pet = {
        species: t,
        holder: n,
        group: s,
        lag: new Vector3()
      };
    }
    removeActor(e) {
      let t = this.actors.get(e);
      t && (this.scene.remove(t.holder), disposeTree(t.holder), this.actors.delete(e));
    }
    pruneActors(e) {
      for (let t of [...this.actors.keys()]) e.has(t) || this.removeActor(t);
    }
    setActorTarget(e, t, n, s, r) {
      let o = this.actors.get(e);
      o && (o.target.set(t, this.heightAt(t, n), n), o.rotTarget = s, o.moving = r);
    }
    setSelf(e) {
      this.self = e;
    }
    selfActor() {
      return this.actors.get(this.self);
    }
    selfPosition() {
      let e = this.selfActor();
      return e ? e.holder.position : new Vector3();
    }
    snapSelf(e, t) {
      let n = this.selfActor();
      n && (n.holder.position.set(e, this.heightAt(e, t), t), n.target.copy(n.holder.position));
    }
    moveSelf(e, t, n) {
      let s = this.selfActor();
      if (!s) return null;
      let r = (this.zone?.size || 100) / 2 - 1,
        o = s.holder.position.x + e * n,
        a = s.holder.position.z + t * n;
      return ({
        x: o,
        z: a
      } = resolveCollision(this.colliders, o, a, SUN_STRENGTH)), this._inside || (o = MathUtils.clamp(o, -r, r), a = MathUtils.clamp(a, -r, r)), s.holder.position.set(o, this.heightAt(o, a), a), s.target.copy(s.holder.position), e || t ? (s.rotTarget = Math.atan2(e, t), s.moving = !0) : s.moving = !1, {
        x: o,
        z: a,
        rot: s.rotTarget,
        moving: s.moving
      };
    }
    reconcile(e, t) {
      if (this._inside) return;
      let n = this.selfActor();
      if (!n) return;
      let s = Math.hypot(n.holder.position.x - e, n.holder.position.z - t);
      if (s < 0.6) return;
      if (s > 9) {
        this.snapSelf(e, t);
        return;
      }
      let r = Math.min(0.25, s * 0.05);
      n.holder.position.x += (e - n.holder.position.x) * r, n.holder.position.z += (t - n.holder.position.z) * r, n.holder.position.y = this.heightAt(n.holder.position.x, n.holder.position.z), n.target.copy(n.holder.position);
    }
    ring(e, t = 16777215, n = 1) {
      let s = new Mesh(new RingGeometry(0.45, 0.62, 28), glowMat(t, 0.95));
      s.rotation.x = -Math.PI / 2, s.position.copy(e).setY(e.y + 0.08), s.userData.noOutline = !0, this.scene.add(s), this.effects.push({
        kind: "ring",
        mesh: s,
        t: 0,
        scale: n
      });
    }
    update(e, t) {
      this.time += e, this.adapt(e);
      for (let n of this.windMaterials) n.userData.shader && (n.userData.shader.uniforms.uTime.value = this.time);
      if (this.water && (this.water.position.y = -1.15 + Math.sin(this.time * 0.7) * 0.05), this._inside) {
        let n = this._inside;
        n.room.tick(this.time);
        for (let s of n.added) s.light.intensity = s.power * (s.src.flicker ?? 1);
        for (let s of this.actors.values()) s.key !== this.self && (s.holder.visible = !1);
        n.keeper.group.userData.baseY = 0, animateCreature(n.keeper.group, t, !1), n.keeper.group.rotation.y = Math.sin(this.time * 0.35) * 0.14;
      }
      if (this.city && !this._inside) {
        this.city.tick(this.time);
        let n = this.city.rift;
        n && (n.group.rotation.y = Math.atan2(this.camera.position.x - n.group.position.x, this.camera.position.z - n.group.position.z));
      }
      for (let n of this.portalRings || []) n.arch.rotation.z += e * 0.5, n.veil && (n.veil.material.opacity = 0.22 + Math.sin(this.time * 2) * 0.08);
      this.updateNpcs(e, t), this.npcAvatar && animateCreature(this.npcAvatar, t, !1);
      for (let n of this.actors.values()) {
        n.key !== this.self && n.holder.position.lerp(n.target, Math.min(1, e * 10));
        let s = n.holder.rotation.y,
          r = n.rotTarget - s;
        for (; r > Math.PI;) r -= Math.PI * 2;
        for (; r < -Math.PI;) r += Math.PI * 2;
        if (n.holder.rotation.y = s + r * Math.min(1, e * 11), n.group.userData.baseY = 0, setCreatureLod(n.group, n.holder.position.distanceTo(this.camera.position)), animateCreature(n.group, t, n.moving), n.pet) {
          let o = new Vector3(-1.35, 0, -1.45);
          n.pet.lag.lerp(o, Math.min(1, e * 3)), n.pet.holder.position.copy(n.pet.lag), n.pet.group.userData.baseY = 0, animateCreature(n.pet.group, t + 400, n.moving), n.pet.holder.rotation.y = Math.sin(this.time * 0.9) * 0.25;
        }
      }
      for (let n = this.effects.length - 1; n >= 0; n--) {
        let s = this.effects[n];
        s.t += e, s.kind === "ring" ? (s.mesh.scale.setScalar((1 + s.t * 7) * s.scale), s.mesh.material.opacity = Math.max(0, 0.95 - s.t * 1.7), s.t > 0.65 && (this.scene.remove(s.mesh), disposeTree(s.mesh), this.effects.splice(n, 1))) : s.t > 1.4 && this.effects.splice(n, 1);
      }
      this.updateCamera(e), aimSun(this.lights.sun, this.selfPosition(), SUN_DIR), this.sky && this.sky.position.copy(this.camera.position), this.renderer.render(this.scene, this.camera);
    }
    updateCamera(e) {
      let t = this.selfActor();
      if (!t) return;
      let n = t.holder.position;
      if (this.viewMode === "first") {
        t.holder.visible = !1;
        let f = new Vector3(n.x, n.y + 1.62, n.z);
        f.x -= Math.sin(this.camYaw) * 0.16, f.z -= Math.cos(this.camYaw) * 0.16, this.camera.position.lerp(f, Math.min(1, e * 22));
        let p = f.clone();
        p.x -= Math.sin(this.camYaw) * 10, p.z -= Math.cos(this.camYaw) * 10, p.y += this.camPitch * 10, this.camera.lookAt(p);
        return;
      }
      t.holder.visible = !0;
      let s = V_.set(n.x, n.y + 1.35, n.z),
        r = W_.set(s.x - Math.sin(this.camYaw) * this.camDist, s.y + this.camHeight, s.z - Math.cos(this.camYaw) * this.camDist),
        o = q_.copy(r).sub(s),
        a = o.length(),
        l = $_.copy(o).divideScalar(a || 1),
        c = a;
      for (let f of this.blockers) {
        let p = f.hw !== void 0 ? boxHit(s, l, a, f, this.heightAt(f.x, f.z)) : circleHit(s, l, a, f, this.heightAt(f.x, f.z));
        p !== null && p < c && (c = p);
      }
      c = Math.max(this.camMin, c - 0.45), this._camReach === void 0 && (this._camReach = c);
      let h = c < this._camReach ? Math.min(1, e * 16) : Math.min(1, e * 2.6);
      this._camReach += (c - this._camReach) * h;
      let d = X_.copy(s).addScaledVector(l, Math.min(this._camReach, a));
      d.y = Math.max(d.y, this.heightAt(d.x, d.z) + 1.1), this.camera.position.lerp(d, Math.min(1, e * 8));
      let u = this.camera.position;
      for (let f of this.blockers) {
        let p = this.heightAt(f.x, f.z) + (f.top ?? propRadius(f));
        if (u.y > p) continue;
        if (f.hw !== void 0) {
          let _ = f.rot ? Math.cos(-f.rot) : 1,
            S = f.rot ? Math.sin(-f.rot) : 0,
            b = (u.x - f.x) * _ - (u.z - f.z) * S,
            T = (u.x - f.x) * S + (u.z - f.z) * _,
            y = f.hw + 0.4,
            M = f.hd + 0.4;
          if (Math.abs(b) >= y || Math.abs(T) >= M) continue;
          let P = y - Math.abs(b),
            A = M - Math.abs(T),
            k = 0,
            L = 0;
          P < A ? k = b < 0 ? -P : P : L = T < 0 ? -A : A, u.x += k * _ + L * S, u.z += -k * S + L * _;
          continue;
        }
        let x = u.x - f.x,
          g = u.z - f.z,
          m = f.r + 0.45,
          v = Math.hypot(x, g);
        if (v >= m) continue;
        let E = v < 0.001 ? 0 : (m - v) / v;
        u.x += v < 0.001 ? m : x * E, u.z += v < 0.001 ? 0 : g * E;
      }
      u.y = Math.max(u.y, this.heightAt(u.x, u.z) + 1.1), this._inside && (u.y = Math.min(u.y, this._inside.floorY + this._inside.room.dims.h - 0.35)), this.camera.lookAt(s);
    }
    setTimeOfDay(e) {
      if (this._phase = e, this._inside || !this.sky || !this.palette) return;
      let t = this.palette,
        n = Math.PI * 2,
        s = (e - 0.25) * n,
        r = Math.sin(s),
        o = SUN_DIR.clone();
      o.set(Math.cos(s) * 0.55, Math.max(-0.35, r), 0.46).normalize();
      let a = MathUtils.smoothstep(r, -0.3, 0.18),
        l = Math.max(0, 1 - Math.abs(r) * 2.6) * (1 - a * 0.3);
      this.night = 1 - a;
      let c = (x, g, m) => new Color(x).lerp(new Color(g), m),
        h = 725808,
        d = 2372186,
        u = 16751196,
        f = this.sky.material.uniforms;
      f.uTop.value.copy(c(h, t.sky.top, a)), f.uHorizon.value.copy(c(d, t.sky.horizon, a).lerp(new Color(u), l * 0.55)), f.uSunColor.value.copy(c(12374271, t.sky.sun, a)), f.uSunDir.value.copy(o), this.lights.sun.position.copy(o).multiplyScalar(60), this.lights.sun.intensity = 0.42 + a * 2.05, this.lights.sun.color.copy(c(11058431, t.sunLight, a).lerp(new Color(u), l * 0.6));
      let p = t.ambient ?? 1;
      if (this.lights.hemi.intensity = (0.46 + a * 0.5) * p, this.lights.hemi.color.copy(c(3358827, t.sky.horizon, a)), this.lights.rim.intensity = (0.4 + a * 0.22) * p, this.scene.fog) {
        this.scene.fog.color.copy(c(1186352, t.fog, a).lerp(new Color(u), l * 0.4));
        let x = t.fogNear ?? 62,
          g = t.fogFar ?? 168;
        this.scene.fog.near = x - this.night * x * 0.26, this.scene.fog.far = g - this.night * g * 0.26, this.hazeWall && this.hazeWall.uniforms.uColor.value.copy(this.scene.fog.color);
      }
      this.renderer && (this.renderer.toneMappingExposure = 1.02 - this.night * 0.08), this.city?.setNight(this.night), this.plazaLight && (this.plazaLight.intensity = 0.4 + this.night * 5.5), this.setNpcs(e);
    }
    project(e) {
      let t = e.clone().project(this.camera);
      return {
        x: (t.x * 0.5 + 0.5) * this.canvas.clientWidth,
        y: (-t.y * 0.5 + 0.5) * this.canvas.clientHeight,
        visible: t.z < 1 && t.x > -1.02 && t.x < 1.02 && t.y > -1.1 && t.y < 1.1
      };
    }
  };

function zoneTheme(i) {
  let e = {
    aetherport: {
      sky: {
        top: 2973598,
        horizon: 12899294,
        ground: 2835280,
        sun: 16771787
      },
      fog: 11518930,
      fogNear: 44,
      fogFar: 158,
      sunLight: 16772820,
      groundLight: 4998976,
      ambient: 1.5,
      groundLow: 7170659,
      groundHigh: 9144190,
      path: 10131081,
      leaf: 6062672,
      bark: 5786171,
      rock: 9080726,
      grass: 7635279,
      wall: 9274744,
      roof: 3880752,
      asphalt: 3816771,
      asphalt2: 4408909,
      kerb: 11183258,
      pave: 9275777,
      pave2: 9999243,
      yard: 7893867,
      dirt: 7038297,
      line: 14472900,
      drain: 2500652,
      flag: 10788240,
      flag2: 10130567,
      flagDark: 9077617,
      joint: 7301988,
      seabed: 3096648,
      stone: 10985620,
      brick: 8018506,
      metal: 10134187,
      iron: 3948873,
      wood: 8019006,
      soil: 4142120,
      crate: 10123858,
      barrel: 7031600,
      crane: 12744239,
      rope: 9272156,
      door: 4863268,
      deck: 9071430,
      piling: 5587507,
      tank: 9278620,
      plant: 7765381,
      hydrant: 12076335,
      glass: 2830909,
      glassLit: 16764810,
      shopGlass: 3752526,
      lampGlow: 16763770,
      warmGlow: 16760938,
      signGlow: 9431261,
      fanlight: 16766624,
      forge: 16742970,
      rune: 11566335,
      aether: 3139280,
      aetherCloth: 2776936,
      water: 1720919,
      waterBright: 8378088,
      awning: [12737098, 3112312, 13867580, 4873610, 8018572, 12084794],
      far: 4871528,
      farHigh: 6122112,
      riftCore: 3139280,
      riftRim: 16743001,
      riftHaze: 1777467,
      rim: "trees"
    },
    verdant_meadow: {
      sky: {
        top: 3108799,
        horizon: 12376562,
        ground: 7176042,
        sun: 16774358
      },
      fog: 12901613,
      sunLight: 16773848,
      groundLight: 5464127,
      groundLow: 5533759,
      groundHigh: 8164688,
      path: 12231798,
      leaf: 5212741,
      bark: 6966322,
      rock: 9277330,
      grass: 7315533,
      wall: 14997179,
      roof: 10504764,
      rim: "trees"
    },
    emberfall_canyon: {
      sky: {
        top: 9060138,
        horizon: 15769713,
        ground: 5909020,
        sun: 16766880
      },
      fog: 14721143,
      sunLight: 16766893,
      groundLight: 4858904,
      groundLow: 9062956,
      groundHigh: 12089930,
      path: 13673335,
      leaf: 9071151,
      bark: 5913124,
      rock: 10118216,
      grass: 10516544,
      wall: 14465941,
      roof: 8205095,
      rim: "cliff"
    },
    tidal_hollow: {
      sky: {
        top: 1923724,
        horizon: 10475754,
        ground: 2905440,
        sun: 15267583
      },
      fog: 11065832,
      sunLight: 14676223,
      groundLight: 2049104,
      groundLow: 3635055,
      groundHigh: 6988432,
      path: 13222560,
      leaf: 4165498,
      bark: 4997688,
      rock: 8360088,
      grass: 5283980,
      wall: 14212304,
      roof: 3108221,
      water: 3047326,
      rim: "trees"
    },
    frostpeak_ridge: {
      sky: {
        top: 4026280,
        horizon: 14281979,
        ground: 8229540,
        sun: 16777215
      },
      fog: 13821685,
      sunLight: 15923455,
      groundLight: 7176080,
      groundLow: 11060440,
      groundHigh: 15003899,
      path: 12175058,
      leaf: 6258566,
      bark: 4868690,
      rock: 10135732,
      grass: 9416892,
      wall: 14674160,
      roof: 4743539,
      rim: "cliff",
      flora: "alpine"
    },
    umbral_grove: {
      sky: {
        top: 1314859,
        horizon: 4930166,
        ground: 1709104,
        sun: 12033535
      },
      fog: 3813212,
      sunLight: 10784736,
      groundLight: 2366528,
      groundLow: 3352911,
      groundHigh: 4865388,
      path: 6050167,
      leaf: 4864626,
      bark: 3090240,
      rock: 5787760,
      grass: 5589128,
      wall: 4866406,
      roof: 2892864,
      rim: "trees"
    },
    stonewake_mesa: {
      sky: {
        top: 5209262,
        horizon: 15785138,
        ground: 7034176,
        sun: 16774354
      },
      fog: 14929316,
      fogNear: 50,
      fogFar: 175,
      sunLight: 16773324,
      groundLight: 8020034,
      groundLow: 11042895,
      groundHigh: 14070915,
      path: 14731936,
      leaf: 9081936,
      bark: 8019772,
      rock: 12620386,
      grass: 11576416,
      wall: 14206106,
      roof: 8020548,
      rim: "mesa",
      flora: "arid",
      rockStyle: "strata",
      decal: {
        color: 15259053,
        count: 48,
        size: [5, 13]
      }
    },
    stormreach_heights: {
      sky: {
        top: 1910608,
        horizon: 9741e3,
        ground: 3357526,
        sun: 15002879
      },
      fog: 11056338,
      fogNear: 38,
      fogFar: 150,
      sunLight: 14082815,
      groundLight: 3818336,
      groundLow: 4148295,
      groundHigh: 7306356,
      path: 9278368,
      leaf: 4612175,
      bark: 3948098,
      rock: 8226724,
      grass: 6257244,
      wall: 12568278,
      roof: 3818070,
      rim: "cloud",
      flora: "alpine",
      rockStyle: "shard",
      decal: {
        color: 9675709,
        count: 40,
        size: [4, 11]
      }
    }
  };
  return e[i.id] || e.verdant_meadow;
}

function interiorOf(i, e, t, n) {
  let s = (t?.landmarks || []).find(l => l.interior && (l.interior === n?.id || l.interior === n?.kind)),
    r = s && Math.hypot(s.x - i.x, s.z - i.z) > 0.2 ? {
      x: s.x - i.x,
      z: s.z - i.z
    } : null;
  if (!r) for (let l of e?.buildings || []) {
    let c = Math.hypot(l.x - i.x, l.z - i.z);
    c < 16 && (!r || c < r.d) && (r = {
      d: c,
      x: l.x - i.x,
      z: l.z - i.z
    });
  }
  r || (r = {
    x: 0,
    z: -1
  });
  let o = Math.atan2(r.x, r.z),
    a = Math.round(o / (Math.PI / 2)) * (Math.PI / 2);
  return {
    x: Math.sin(a),
    z: Math.cos(a)
  };
}

function npcNear(i, e) {
  let t = i.npc && NPCS[i.npc];
  if (t) return {
    id: t.id,
    name: t.name,
    he: t.he,
    icon: t.icon,
    body: t.body,
    skin: t.skin,
    hair: t.hair,
    outfit: t.outfit
  };
  let n = {
    clinic: {
      id: "medic",
      name: "Ward Iven",
      he: "איוון מהמרפאה",
      icon: "✚",
      body: "slim",
      skin: "#d8a97f",
      hair: "#3a2f2a",
      outfit: "tide"
    },
    shop: {
      id: "trader",
      name: "Quartermaster",
      he: "הסוחר",
      icon: "🛍",
      body: "stocky",
      skin: "#8a5a3c",
      hair: "#2b1b16",
      outfit: "wanderer"
    },
    archive: {
      id: "clerk",
      name: "Archivist",
      he: "הארכיונאי",
      icon: "📜",
      body: "tall",
      skin: "#c98f63",
      hair: "#d8d4cc",
      outfit: "scholar"
    },
    workshop: {
      id: "smith",
      name: "Smith",
      he: "הנפח",
      icon: "🔨",
      body: "stocky",
      skin: "#6f452c",
      hair: "#151515",
      outfit: "ranger"
    }
  };
  return n[e] || n.shop;
}

function rotateLocal(i, e) {
  let t = Math.cos(i.ry),
    n = Math.sin(i.ry),
    s = e.x || 0,
    r = e.z || 0;
  return {
    x: i.x + s * t + r * n,
    y: i.y + (e.y || 0),
    z: i.z + (-s * n + r * t),
    ry: (e.ry || 0) + i.ry
  };
}

function offsetGeometry(i, e) {
  let t = i.attributes.position;
  for (let n = 0; n < t.count; n++) t.setXYZ(n, t.getX(n) * (1 + (Math.random() - 0.5) * e), t.getY(n) * (1 + (Math.random() - 0.5) * e), t.getZ(n) * (1 + (Math.random() - 0.5) * e));
  i.computeVertexNormals();
}

function buildBush() {
  let i = [xf2(new CylinderGeometry(0.62, 0.86, 0.75, 9), {
      y: 0.38
    }), xf2(new CylinderGeometry(0.5, 0.6, 0.55, 9), {
      y: 0.98,
      ry: 0.4
    }), xf2(new CylinderGeometry(0.62, 0.46, 0.45, 9), {
      y: 1.45,
      ry: 0.8
    }), xf2(new CylinderGeometry(0.42, 0.66, 0.5, 9), {
      y: 1.92,
      ry: 0.2
    }), xf2(new CylinderGeometry(0.72, 0.44, 0.34, 9), {
      y: 2.32,
      ry: 0.6
    })],
    e = mergePlain(i) || i[0];
  return offsetGeometry(e, 0.07), e;
}

function buildReed() {
  let i = [xf2(new CylinderGeometry(0.16, 0.78, 2.5, 5), {
      y: 1.25
    }), xf2(new CylinderGeometry(0.1, 0.42, 1.5, 5), {
      y: 0.75,
      x: 0.5,
      z: 0.3,
      rz: 0.22
    }), xf2(new CylinderGeometry(0.08, 0.3, 1, 5), {
      y: 0.5,
      x: -0.42,
      z: -0.3,
      rz: -0.3
    })],
    e = mergePlain(i) || i[0];
  return offsetGeometry(e, 0.06), e;
}

function mergePlain(i) {
  let e = mergeByMaterial(i.map(t => ({
    geo: t,
    mat: eb
  })));
  return e.isMesh ? e.geometry : null;
}

var eb = new MeshBasicMaterial();

function propRadius(i) {
  return i.kind === "building" ? 4.4 : i.kind === "tree" ? 2.8 : i.kind === "gate" ? 4 : 1.7;
}

function buildingIndex(i) {
  let e = new Map();
  for (let t of i.buildings || []) {
    let n = t.floors !== void 0 ? t.h + 1.2 : t.h * (t.kind === "hall" ? 1.35 : 1) + t.w * 0.74 + 0.8;
    e.set(`${t.x.toFixed(2)}|${t.z.toFixed(2)}`, n);
  }
  return (i.colliders || []).map(t => {
    let n = e.get(`${t.x.toFixed(2)}|${t.z.toFixed(2)}`);
    return t.hw === void 0 ? n === void 0 ? t : {
      ...t,
      top: n
    } : {
      x: t.x,
      z: t.z,
      hw: t.hw,
      hd: t.hd,
      rot: t.rot || 0,
      kind: t.kind,
      top: n ?? 9
    };
  });
}

function boxHit(i, e, t, n, s) {
  let r = n.rot ? Math.cos(-n.rot) : 1,
    o = n.rot ? Math.sin(-n.rot) : 0,
    a = (i.x - n.x) * r - (i.z - n.z) * o,
    l = (i.x - n.x) * o + (i.z - n.z) * r,
    c = e.x * r - e.z * o,
    h = e.x * o + e.z * r,
    d = n.hw + 0.4,
    u = n.hd + 0.4,
    f = 0,
    p = t;
  for (let [x, g, m] of [[a, c, d], [l, h, u]]) {
    if (Math.abs(g) < 1e-6) {
      if (Math.abs(x) > m) return null;
      continue;
    }
    let v = (-m - x) / g,
      E = (m - x) / g;
    if (v > E) {
      let _ = v;
      v = E, E = _;
    }
    if (f = Math.max(f, v), p = Math.min(p, E), f > p) return null;
  }
  return f < 0.2 || f > t || i.y + e.y * f > s + (n.top ?? 9) ? null : f;
}

function circleHit(i, e, t, n, s) {
  let r = i.x - n.x,
    o = i.z - n.z,
    a = e.x * e.x + e.z * e.z;
  if (a < 1e-6) return null;
  let l = 2 * (r * e.x + o * e.z),
    c = n.r + 0.35,
    h = r * r + o * o - c * c,
    d = l * l - 4 * a * h;
  if (d < 0) return null;
  let u = (-l - Math.sqrt(d)) / (2 * a);
  if (u < 0.2 || u > t) return null;
  let f = i.y + e.y * u,
    p = s + (n.top ?? propRadius(n));
  return f > p ? null : u;
}

function disposeTree(i) {
  i.traverse?.(e => {
    if (e.geometry && e.geometry.dispose?.(), e.material) {
      let t = Array.isArray(e.material) ? e.material : [e.material];
      for (let n of t) !n || n.userData?.shared || (n.map?.dispose?.(), n.alphaMap?.dispose?.(), n.emissiveMap?.dispose?.(), n.dispose?.());
    }
  });
}

export { $_, A_, B_, C_, DOOR_W, INTERIORS, O_, PartBuilder, R_, SUN_DIR, SUN_STRENGTH, U_, V_, WALL_H, W_, WorldView, X_, boxHit, buildAmbientMotes, buildBuildingBlock, buildBush, buildCityGround, buildDust, buildEdgeWall, buildFogWall, buildGroundMesh, buildInterior, buildLamp, buildNpcBody, buildReed, buildRimRange, buildRockProp, buildRug, buildTerrainMesh, buildTreeProp, buildWainscot, buildWaterPlane, buildingIndex, circleHit, collectColliders, disposeTree, eb, eo, interiorOf, jitter, mergePlain, mergeProps, npcNear, offsetGeometry, propRadius, q_, rngFromFloat, rotateLocal, tintHex, vertexColorMat, zoneTheme };
