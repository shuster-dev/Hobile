import { Color } from 'three';

function mixHex(i, e, t) {
  let n = new Color(i),
    s = new Color(e);
  return n.lerp(s, t).getHex();
}

function rng(i) {
  let e = i >>> 0;
  return function () {
    e = e + 1831565813 | 0;
    let t = Math.imul(e ^ e >>> 15, 1 | e);
    return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash(i) {
  let e = 2166136261;
  for (let t = 0; t < i.length; t++) e ^= i.charCodeAt(t), e = Math.imul(e, 16777619);
  return e >>> 0;
}

function valueNoise(i, e, t = 0) {
  let n = Math.floor(i),
    s = Math.floor(e),
    r = i - n,
    o = e - s,
    a = (p, x) => {
      let g = Math.imul(p * 374761393 + x * 668265263 + t * 2246822519, 1);
      return g = (g ^ g >>> 13) >>> 0, (Math.imul(g, 1274126177) >>> 0) / 4294967296;
    },
    l = r * r * (3 - 2 * r),
    c = o * o * (3 - 2 * o),
    h = a(n, s),
    d = a(n + 1, s),
    u = a(n, s + 1),
    f = a(n + 1, s + 1);
  return (h * (1 - l) + d * l) * (1 - c) + (u * (1 - l) + f * l) * c;
}

function fbm(i, e, t = 0, n = 3) {
  let s = 0,
    r = 1,
    o = 1,
    a = 0;
  for (let l = 0; l < n; l++) s += valueNoise(i * o, e * o, t + l * 101) * r, a += r, r *= 0.5, o *= 2.03;
  return s / a - 0.5;
}

function heightAt(i, e, t) {
  if (URBAN_ZONES.has(i)) {
    let a = hash(i);
    if (t < EDGE_Y) return -1.35;
    let l = Math.min(1, (t - EDGE_Y) / 8);
    return (fbm(e * 0.02, t * 0.02, a, 2) * 0.5 - 0.05) * l + (l - 1) * 1.35;
  }
  let n = hash(i),
    s = n % 1e3,
    r = Math.sin((e + s) * 0.055) * Math.cos((t - s) * 0.062) * 2.1 + Math.sin((e * 0.021 + t * 0.017 + s) * 1.7) * 0.55 + fbm(e * 0.016, t * 0.016, n, 3) * 3.1 + fbm(e * 0.075, t * 0.075, n + 7, 2) * 0.42,
    o = Math.min(1, Math.hypot(e, t) / 26);
  return r * o;
}

var TAU_W = Math.PI * 2,
  BLOCK = 24,
  ROAD_HALF = 4.5,
  EDGE_Y = -38,
  URBAN_ZONES = new Set(["aetherport"]);

function blockGrid(i) {
  let e = Math.ceil(i / 2 / BLOCK) * BLOCK,
    t = [];
  for (let n = -e; n <= e; n += BLOCK) t.push(n);
  return t;
}

function distToGridLine(i) {
  let e = Math.round(i / BLOCK) * BLOCK;
  return Math.abs(i - e);
}

function onRoad(i, e, t = 0) {
  return distToGridLine(i) < ROAD_HALF + t || distToGridLine(e) < ROAD_HALF + t;
}

var BUILDING_STYLES = [{
    wall: 9274744,
    trim: 6116940,
    roof: 3880752,
    floors: [3, 5]
  }, {
    wall: 8153692,
    trim: 4865332,
    roof: 3485739,
    floors: [2, 4]
  }, {
    wall: 10133670,
    trim: 6054504,
    roof: 3093562,
    floors: [4, 7]
  }, {
    wall: 7306630,
    trim: 4345173,
    roof: 2765112,
    floors: [5, 9]
  }, {
    wall: 10719860,
    trim: 7035973,
    roof: 3814186,
    floors: [2, 3]
  }],
  POST = 3.2;

function generateUrbanProps(i) {
  let e = rng(hash(i.id)),
    t = i.size / 2,
    n = [],
    s = [],
    r = [],
    o = [],
    a = [],
    l = (f, p, x = 0) => i.landmarks.find(g => Math.hypot(g.x - f, g.z - p) < (g.r || 3) + x),
    c = (f, p, x, g, m, v) => s.push({
      x: f,
      z: p,
      hw: x / 2,
      hd: g / 2,
      rot: m,
      kind: v
    }),
    h = Math.floor((t - BLOCK * 0.5) / BLOCK) * BLOCK;
  for (let f = -h; f <= h; f += BLOCK) for (let p = -h; p <= h; p += BLOCK) {
    let x = f + BLOCK / 2,
      g = p + BLOCK / 2;
    if (g < EDGE_Y + 6 || Math.hypot(x, g) > t - 8) continue;
    let m = l(x, g, 2);
    if (m && m.kind !== "portal") continue;
    let v = BLOCK / 2 - ROAD_HALF - 1.2;
    for (let E = 0; E < 4; E++) {
      if (e() < 0.06) continue;
      let _ = E % 2 === 0 ? "x" : "z",
        S = E < 2 ? 1 : -1,
        b = e() < 0.45 ? 3 : 2,
        T = -v;
      for (let y = 0; y < b; y++) {
        let M = v * 2 / b - (b > 1 ? 1.4 : 0),
          P = M,
          A = 4.6 + e() * 2.2,
          k = v - A / 2,
          L = T + M / 2;
        T += M + 1.4;
        let O = _ === "x" ? x + L : x + k * S,
          B = _ === "x" ? g + k * S : g + L;
        if (onRoad(O, B, -1) || l(O, B, 1)) continue;
        let W = BUILDING_STYLES[Math.floor(e() * BUILDING_STYLES.length)],
          j = W.floors[0] + Math.floor(e() * (W.floors[1] - W.floors[0] + 1)),
          K = _ === "x" ? 0 : Math.PI / 2,
          U = _ === "x" ? P : A,
          N = _ === "x" ? A : P;
        n.push({
          x: O,
          z: B,
          w: U,
          d: N,
          h: j * POST,
          floors: j,
          rot: 0,
          kind: "block",
          wall: W.wall,
          trim: W.trim,
          roof: W.roof,
          facing: _ === "x" ? S > 0 ? 0 : Math.PI : S > 0 ? Math.PI / 2 : -Math.PI / 2,
          shop: e() < 0.45,
          sign: e() < 0.3,
          seed: e(),
          rot0: K
        }), c(O, B, U, N, 0, "building");
      }
    }
  }
  for (let f of i.landmarks) {
    let p = f.r || 5;
    if (f.kind === "archive" || f.kind === "workshop" || f.kind === "shop" || f.kind === "clinic") {
      let x = p * 1.5,
        g = p * 0.7,
        m = f.kind === "archive" ? 13 : f.kind === "clinic" ? 9.5 : 7.5,
        v = f.z - p * 0.6,
        E = {
          archive: 12563612,
          clinic: 14673636
        },
        _ = {
          clinic: 2778475
        };
      n.push({
        x: f.x,
        z: v,
        w: x,
        d: g,
        h: m,
        floors: Math.round(m / POST),
        rot: 0,
        kind: f.kind,
        wall: E[f.kind] ?? 9076592,
        trim: _[f.kind] ?? 5590080,
        roof: f.kind === "clinic" ? 4216924 : 3354666,
        facing: 0,
        shop: f.kind === "shop",
        sign: !0,
        seed: 0.5
      }), c(f.x, v, x, g, 0, "building");
    }
    if (f.kind === "clinic") {
      let x = (f.door?.z ?? f.z + p) - 1.6;
      for (let g of [-1, 1]) r.push({
        kind: "bench",
        x: f.x + g * 4.2,
        z: x,
        rot: g > 0 ? -Math.PI / 2 : Math.PI / 2
      }), r.push({
        kind: "planter",
        x: f.x + g * 2.2,
        z: x + 2.2,
        rot: 0,
        s: 1
      }), s.push({
        x: f.x + g * 2.2,
        z: x + 2.2,
        r: 0.55,
        kind: "prop"
      }), r.push({
        kind: "lamp",
        x: f.x + g * 5.6,
        z: x + 2.6,
        rot: 0,
        s: 1
      }), s.push({
        x: f.x + g * 5.6,
        z: x + 2.6,
        r: 0.55,
        kind: "prop"
      });
    }
    if (f.kind === "plaza") {
      r.push({
        kind: "fountain",
        x: f.x,
        z: f.z,
        s: 1
      }), s.push({
        x: f.x,
        z: f.z,
        r: 2.6,
        kind: "prop"
      });
      for (let x = 0; x < 8; x++) {
        let g = x / 8 * TAU_W;
        r.push({
          kind: "bench",
          x: f.x + Math.cos(g) * (p - 1.6),
          z: f.z + Math.sin(g) * (p - 1.6),
          rot: g + Math.PI / 2
        }), o.push({
          x: f.x + Math.cos(g + 0.4) * (p - 0.4),
          z: f.z + Math.sin(g + 0.4) * (p - 0.4),
          s: 0.85,
          rot: e() * TAU_W,
          tilt: 0,
          kind: "street"
        });
      }
    }
    if (f.kind === "base") {
      for (let x = 0; x < 22; x++) {
        let g = x / 22 * TAU_W;
        g > Math.PI * 0.85 && g < Math.PI * 1.15 || r.push({
          kind: "fence",
          x: f.x + Math.cos(g) * p,
          z: f.z + Math.sin(g) * p,
          rot: g
        });
      }
      r.push({
        kind: "workbench",
        x: f.x + 2,
        z: f.z - 2,
        rot: 0.4
      }), r.push({
        kind: "banner",
        x: f.x - p,
        z: f.z,
        rot: 0
      });
    }
    if (f.kind === "gate" && (r.push({
      kind: "gatehouse",
      x: f.x,
      z: f.z,
      rot: 0
    }), c(f.x - 6.5, f.z, 5, 3, 0, "building"), c(f.x + 6.5, f.z, 5, 3, 0, "building")), f.kind === "pier") {
      r.push({
        kind: "pier",
        x: f.x,
        z: f.z,
        rot: 0
      });
      for (let x = 0; x < 6; x++) r.push({
        kind: "bollard",
        x: f.x + (x % 2 ? 3.2 : -3.2),
        z: f.z - 6 + x * 2.6,
        rot: 0
      });
    }
    f.kind === "dungeon" && (r.push({
      kind: "hatch",
      x: f.x,
      z: f.z,
      rot: 0
    }), s.push({
      x: f.x,
      z: f.z - 0.6,
      r: 1.6,
      kind: "gate"
    }));
  }
  let d = blockGrid(i.size);
  for (let f of d) for (let p = -t + 6; p < t - 6; p += 6) for (let [x, g] of [[f, p], [p, f]]) {
    if (g < EDGE_Y + 2 || Math.hypot(x, g) > t - 6 || l(x, g, 1)) continue;
    let m = distToGridLine(x) < ROAD_HALF ? x > f ? 1 : -1 : 0,
      v = x + 0,
      E = g,
      _ = ROAD_HALF - 0.9,
      S = Math.round(v / BLOCK) * BLOCK > v ? -1 : 1,
      b = distToGridLine(v) < ROAD_HALF,
      T = b ? Math.round(v / BLOCK) * BLOCK + _ * S : v,
      y = b ? E : Math.round(E / BLOCK) * BLOCK + _ * S;
    onRoad(T, y, -ROAD_HALF);
    let M = e(),
      P = M < 0.5 ? "lamp" : M < 0.68 ? "planter" : M < 0.8 ? "bin" : M < 0.9 ? "bench" : "hydrant";
    r.push({
      kind: P,
      x: T,
      z: y,
      rot: b ? Math.PI / 2 : 0,
      s: 0.9 + e() * 0.25
    }), (P === "lamp" || P === "planter") && s.push({
      x: T,
      z: y,
      r: 0.55,
      kind: "prop"
    }), P === "planter" && o.push({
      x: T,
      z: y,
      s: 0.6 + e() * 0.2,
      rot: e() * TAU_W,
      tilt: 0,
      kind: "street"
    });
  }
  let u = i.landmarks.find(f => f.kind === "shop");
  if (u) for (let f = 0; f < 7; f++) {
    let p = f / 7 * TAU_W + 0.3,
      x = (u.r || 6) * 0.78,
      g = u.x + Math.cos(p) * x,
      m = u.z + Math.sin(p) * x;
    r.push({
      kind: "stall",
      x: g,
      z: m,
      rot: p + Math.PI / 2,
      s: 1,
      hue: f / 7
    }), s.push({
      x: g,
      z: m,
      r: 1.1,
      kind: "prop"
    });
  }
  for (let f = 0; f < Math.round(i.size * 2.2); f++) {
    let p = (e() * 2 - 1) * (t - 4),
      x = (e() * 2 - 1) * (t - 4);
    x < EDGE_Y || a.push({
      x: p,
      z: x,
      s: 0.4 + e() * 0.4,
      rot: e() * TAU_W,
      phase: e() * TAU_W
    });
  }
  return s.push(...boundaryRing(i)), {
    trees: o,
    rocks: [],
    bushes: [],
    grass: a,
    buildings: n,
    colliders: s,
    props: r,
    urban: !0
  };
}

function generateProps(i) {
  if (i.urban) return generateUrbanProps(i);
  let e = rng(hash(i.id)),
    t = i.size / 2 - 6,
    n = [],
    s = [],
    r = [],
    o = [],
    a = [],
    l = [],
    c = (m, v, E = 0) => i.landmarks.some(_ => _.r && Math.hypot(_.x - m, _.z - v) < _.r + E),
    h = (m, v, E = 5) => i.landmarks.some(_ => Math.hypot(_.x - m, _.z - v) < (_.r || 0) + E);
  for (let m of i.landmarks) {
    if (m.kind !== "town" && m.kind !== "camp") continue;
    let v = m.kind === "town" ? 7 : 4;
    for (let E = 0; E < v; E++) {
      let _ = E / v * TAU_W + e() * 0.25,
        S = (m.r || 10) * 0.66,
        b = m.x + Math.cos(_) * S,
        T = m.z + Math.sin(_) * S,
        y = 3.1 + e() * 1.1,
        M = 2.9 + e() * 1,
        P = 2.5 + e() * 0.9;
      a.push({
        x: b,
        z: T,
        w: y,
        d: M,
        h: P,
        rot: _ + Math.PI / 2,
        kind: E === 0 && m.kind === "town" ? "hall" : "house",
        seed: e()
      }), l.push({
        x: b,
        z: T,
        r: Math.max(y, M) * 0.62,
        kind: "building"
      });
    }
  }
  let d = {
      terra: {
        trees: 0.18,
        rocks: 1.9,
        bushes: 0.35,
        grass: 0.35
      },
      volt: {
        trees: 0.22,
        rocks: 1.15,
        bushes: 0.25,
        grass: 0.5
      },
      ember: {
        trees: 0.3,
        rocks: 1.5,
        bushes: 0.3,
        grass: 0.3
      },
      frost: {
        trees: 0.45,
        rocks: 1.2,
        bushes: 0.25,
        grass: 0.25
      },
      aqua: {
        trees: 0.7,
        rocks: 0.9,
        bushes: 1.1,
        grass: 0.9
      },
      umbra: {
        trees: 1.25,
        rocks: 0.7,
        bushes: 1.2,
        grass: 0.6
      },
      verdant: {
        trees: 1,
        rocks: 1,
        bushes: 1,
        grass: 1
      }
    },
    u = d[i.element] || d.verdant,
    f = Math.round(i.size * 0.85 * u.trees);
  for (let m = 0; m < f; m++) {
    let v = (e() * 2 - 1) * t,
      E = (e() * 2 - 1) * t;
    if (h(v, E, 7)) continue;
    let _ = 0.75 + e() * 0.95;
    n.push({
      x: v,
      z: E,
      s: _,
      rot: e() * TAU_W,
      tilt: (e() - 0.5) * 0.09,
      kind: e() < 0.24 ? "slim" : "broad"
    }), l.push({
      x: v,
      z: E,
      r: 0.52 * _ + 0.42,
      kind: "tree"
    });
  }
  let p = Math.round(i.size * 0.32 * u.rocks);
  for (let m = 0; m < p; m++) {
    let v = (e() * 2 - 1) * t,
      E = (e() * 2 - 1) * t;
    if (c(v, E, 3)) continue;
    let _ = 0.5 + e() * 1.35;
    s.push({
      x: v,
      z: E,
      s: _,
      rot: e() * TAU_W,
      tiltX: (e() - 0.5) * 0.5,
      tiltZ: (e() - 0.5) * 0.5
    }), _ > 0.85 && l.push({
      x: v,
      z: E,
      r: _ * 0.8,
      kind: "rock"
    });
  }
  let x = Math.round(i.size * 0.55 * u.bushes);
  for (let m = 0; m < x; m++) {
    let v = (e() * 2 - 1) * t,
      E = (e() * 2 - 1) * t;
    c(v, E, 2) || r.push({
      x: v,
      z: E,
      s: 0.5 + e() * 0.7,
      rot: e() * TAU_W
    });
  }
  let g = Math.round(i.size * 9 * u.grass);
  for (let m = 0; m < g; m++) {
    let v = (e() * 2 - 1) * t,
      E = (e() * 2 - 1) * t;
    o.push({
      x: v,
      z: E,
      s: 0.65 + e() * 0.8,
      rot: e() * TAU_W,
      phase: e() * TAU_W
    });
  }
  for (let m of i.landmarks) m.kind === "dungeon" && l.push({
    x: m.x,
    z: m.z - 0.6,
    r: 2,
    kind: "gate"
  });
  return l.push(...boundaryRing(i)), {
    trees: n,
    rocks: s,
    bushes: r,
    grass: o,
    buildings: a,
    colliders: l,
    props: [],
    urban: !1
  };
}

function boundaryRing(i) {
  let t = i.size / 2 - 3,
    n = 3.2,
    s = n * 1.35,
    r = Math.max(24, Math.round(TAU_W * t / s)),
    o = [];
  for (let a = 0; a < r; a++) {
    let l = a / r * TAU_W;
    o.push({
      x: Math.cos(l) * t,
      z: Math.sin(l) * t,
      r: n,
      kind: "edge"
    });
  }
  return o;
}

var PROP_CACHE = new Map();

function propsFor(i) {
  return PROP_CACHE.has(i.id) || PROP_CACHE.set(i.id, generateProps(i)), PROP_CACHE.get(i.id);
}

function resolveCollision(i, e, t, n = 0.5) {
  let s = e,
    r = t;
  for (let o = 0; o < 5; o++) {
    let a = !1;
    for (let l of i) {
      if (l.hw !== void 0) {
        let p = l.rot ? Math.cos(-l.rot) : 1,
          x = l.rot ? Math.sin(-l.rot) : 0,
          g = (s - l.x) * p - (r - l.z) * x,
          m = (s - l.x) * x + (r - l.z) * p,
          v = l.hw + n,
          E = l.hd + n;
        if (Math.abs(g) >= v || Math.abs(m) >= E) continue;
        let _ = v - Math.abs(g),
          S = E - Math.abs(m),
          b = 0,
          T = 0;
        _ < S ? b = g < 0 ? -_ : _ : T = m < 0 ? -S : S, s += b * p + T * x, r += -b * x + T * p, a = !0;
        continue;
      }
      let c = s - l.x,
        h = r - l.z,
        d = l.r + n,
        u = c * c + h * h;
      if (u >= d * d) continue;
      let f = Math.sqrt(u);
      if (f < 1e-4) s = l.x + d, r = l.z;else {
        let p = (d - f) / f;
        s += c * p, r += h * p;
      }
      a = !0;
    }
    if (!a) break;
  }
  return {
    x: s,
    z: r
  };
}

var CURB_IN = ROAD_HALF - 1.2,
  CURB_OUT = CURB_IN + 0.34,
  LAMP_SPACING = 5.72,
  CURB_RISE = 0.16,
  SIDEWALK = 54,
  TAU_G = Math.PI * 2;

function gridOffset(i) {
  return Math.abs(i - Math.round(i / BLOCK) * BLOCK);
}

var smoothBand = (i, e, t) => {
  let n = Math.min(1, Math.max(0, (t - i) / (e - i)));
  return n * n * (3 - 2 * n);
};

function curbHeight(i, e) {
  let t = Math.min(gridOffset(i), gridOffset(e)),
    n = CURB_RISE * smoothBand(CURB_IN, CURB_OUT, t);
  if (!PLAZA) return n;
  let s = Math.hypot(i - PLAZA.x, e - PLAZA.z);
  return s > PLAZA.r ? n : Math.max(n, CURB_RISE * smoothBand(PLAZA.r, PLAZA.r - 1.8, s));
}

var PLAZA = null;

function plazaOf(i) {
  let e = i?.urban && i.landmarks.find(t => t.kind === "plaza");
  PLAZA = e ? {
    x: e.x,
    z: e.z,
    r: e.r || 9
  } : null;
}

function plazaHeight(i, e, t) {
  if (!t) return null;
  let n = Math.abs(i - t.x),
    s = e - t.z;
  if (n > 3.4 || s > 9 || s < -10) return null;
  let r = smoothBand(9, 7.4, s);
  return r <= 0 ? null : {
    y: STREET_Y,
    blend: r
  };
}

var STREET_Y = -0.62;

export { BLOCK, BUILDING_STYLES, CURB_IN, CURB_OUT, CURB_RISE, EDGE_Y, LAMP_SPACING, PLAZA, POST, PROP_CACHE, ROAD_HALF, SIDEWALK, STREET_Y, TAU_G, TAU_W, URBAN_ZONES, blockGrid, boundaryRing, curbHeight, distToGridLine, fbm, generateProps, generateUrbanProps, gridOffset, hash, heightAt, mixHex, onRoad, plazaHeight, plazaOf, propsFor, resolveCollision, rng, smoothBand, valueNoise };
