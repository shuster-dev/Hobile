// What the planned zones are drawn with (see shared/worldplan.js):
//   Kit         simple shapes with a colour each, merged into one geometry
//   toonVC      the cel-shaded vertex-colour material all of it shares
//   splitByChunks  one merged geometry cut into 48m squares, so the camera
//               draws the part of the zone it can see and not the whole of it
//   buildWater  the zone's water, lava, ice or swamp as one surface
import {
  BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DodecahedronGeometry,
  Float32BufferAttribute, FrontSide, Mesh, MeshBasicMaterial, MeshToonMaterial, ShaderMaterial, SphereGeometry, TorusGeometry,
  UniformsLib, UniformsUtils, Vector3,
} from 'three';
import { STYLE, displayFrag, mergeGeometries, styleColor, toonGradient, xf2 } from './core.js';

const TMP = new Color();

/**
 * A bag of shapes in one local frame (x across, y up, z along, like a
 * structure in the plan), each with its colour, merged on `geometry()`. `at`
 * places the whole bag in the world: origin, turn about y.
 */
export class Kit {
  constructor(at = { x: 0, y: 0, z: 0, rot: 0 }) {
    this.at = at;
    this.parts = [];
  }
  /** Any three geometry, transformed ({x,y,z,rx,ry,rz,sx,sy,sz}) and coloured. */
  add(geo, o, color) {
    let g = xf2(geo, o || {});
    g = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    TMP.set(STYLE.toon ? styleColor(color) : color);
    for (let i = 0; i < n; i++) { c[i * 3] = TMP.r; c[i * 3 + 1] = TMP.g; c[i * 3 + 2] = TMP.b; }
    g.setAttribute('color', new BufferAttribute(c, 3));
    this.parts.push(g);
    return this;
  }
  box(w, h, d, o, color) { return this.add(new BoxGeometry(w, h, d), o, color); }
  /** A post, a tower, a trunk: rTop and rBottom, `seg` sides. */
  cyl(rt, rb, h, o, color, seg = 8) { return this.add(new CylinderGeometry(rt, rb, h, seg, 1), o, color); }
  cone(r, h, o, color, seg = 8) { return this.add(new ConeGeometry(r, h, seg, 1), o, color); }
  ball(r, o, color, seg = 8) { return this.add(new SphereGeometry(r, seg, Math.max(4, seg >> 1)), o, color); }
  rock(r, o, color) { return this.add(new DodecahedronGeometry(r, 0), o, color); }
  ring(R, r, o, color, seg = 16) { return this.add(new TorusGeometry(R, r, 5, seg), o, color); }
  /** A gabled roof over w × d, ridge along z, eaves at y0, ridge at y1. */
  gable(w, d, y0, y1, o, color, thick = 0.18) {
    const half = w / 2 + 0.35, rise = y1 - y0, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const s of [1, -1]) {
      this.box(len, thick, d + 0.5, { ...o, x: (o?.x ?? 0) + s * half / 2, y: (o?.y ?? 0) + y0 + rise / 2, rz: -s * ang }, color);
    }
    return this;
  }
  /** The triangle of wall under a gable, at both ends. */
  gableEnds(w, d, y0, y1, o, color) {
    const tri = new BufferGeometry();
    const hw = w / 2, rise = y1 - y0;
    const v = [-hw, 0, 0, hw, 0, 0, 0, rise, 0];
    tri.setAttribute('position', new Float32BufferAttribute(v, 3));
    tri.computeVertexNormals();
    for (const s of [1, -1]) {
      const g = tri.clone();
      this.add(g, { ...o, y: (o?.y ?? 0) + y0, z: (o?.z ?? 0) + s * d / 2, ry: s > 0 ? 0 : Math.PI }, color);
    }
    return this;
  }
  /** Everything in this bag as one geometry in world space. */
  geometry() {
    if (!this.parts.length) return null;
    const g = this.parts.length === 1 ? this.parts[0] : mergeGeometries(this.parts, false);
    if (!g) return null;
    return xf2(g, { x: this.at.x, y: this.at.y, z: this.at.z, ry: this.at.rot || 0 });
  }
}

const TOON = new Map();
/** Cel-shaded, coloured by its vertices: one material for a whole zone's
 *  buildings, so they cost a draw call per chunk and not per wall. */
export function toonVC({ side = FrontSide, emissive = 0 } = {}) {
  const key = `${side}|${emissive}`;
  if (!TOON.has(key)) {
    TOON.set(key, new MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(STYLE.bands), side, emissive }));
    TOON.get(key).userData.shared = true;
  }
  return TOON.get(key);
}

/** Lit from inside: windows at night, lava seams, crystals. Its brightness
 *  is set every frame from the hour (see zoneart.js). */
export function glowVC() {
  const m = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  m.userData.glow = true;
  return m;
}

/**
 * Cut a merged geometry into squares of `cell` metres by triangle centre, so
 * frustum culling has something to cull. Returns [geometry, ...].
 */
export function splitByChunks(geo, cell = 48) {
  if (!geo) return [];
  const pos = geo.attributes.position, n = pos.count / 3;
  const buckets = new Map();
  for (let t = 0; t < n; t++) {
    const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3;
    const cz = (pos.getZ(t * 3) + pos.getZ(t * 3 + 1) + pos.getZ(t * 3 + 2)) / 3;
    const k = `${Math.floor(cx / cell)}|${Math.floor(cz / cell)}`;
    (buckets.get(k) || buckets.set(k, []).get(k)).push(t);
  }
  const out = [];
  for (const tris of buckets.values()) {
    const g = new BufferGeometry();
    for (const [name, attr] of Object.entries(geo.attributes)) {
      const sz = attr.itemSize, src = attr.array, dst = new Float32Array(tris.length * 3 * sz);
      let o = 0;
      for (const t of tris) for (let v = 0; v < 3; v++) for (let c = 0; c < sz; c++) dst[o++] = src[(t * 3 + v) * sz + c];
      g.setAttribute(name, new BufferAttribute(dst, sz));
    }
    g.computeBoundingSphere();
    out.push(g);
  }
  return out;
}

/** Meshes for a merged geometry, cut into chunks. */
export function chunkMeshes(geo, material, { cast = true, receive = true, cell = 48 } = {}) {
  return splitByChunks(geo, cell).map((g) => {
    const m = new Mesh(g, material);
    m.castShadow = cast; m.receiveShadow = receive;
    return m;
  });
}

// ---------------------------------------------------------------- water
const WATER_VERT = `
attribute float aDepth;
varying float vDepth;
varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vDepth = aDepth;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WATER_FRAG = `
uniform float uGTime, uNight, uKind;
uniform vec3 uDeep, uShallow, uFoam, uSky;
varying float vDepth;
varying vec3 vW;
#include <fog_pars_fragment>
float wh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float wn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 w = vW.xz;
  float t = uGTime;
  float d = max(vDepth, 0.0);
  float day = 1.0 - uNight * 0.62;
  vec3 col; float a = 1.0;
  if (uKind < 0.5) {
    // water: shallows to deep, ripples catching the sky, a lap of foam
    float r = wn(w * 0.35 + vec2(t * 0.18, t * 0.11)) * 0.6 + wn(w * 1.1 - vec2(t * 0.3, -t * 0.22)) * 0.4;
    col = mix(uShallow, uDeep, smoothstep(0.0, 2.2, d));
    col += uSky * smoothstep(0.62, 0.9, r) * 0.22;
    float lap = 0.06 * sin(t * 1.3 + w.x * 0.35 + w.y * 0.2);
    float foam = 1.0 - smoothstep(0.04, 0.22, d + lap);
    foam = max(foam, smoothstep(0.86, 0.95, r) * (1.0 - smoothstep(0.0, 0.8, d)) * 0.6);
    col = mix(col, uFoam, foam * 0.8);
    col *= day;
    a = mix(0.5, 0.9, smoothstep(0.0, 1.4, d)) + foam * 0.2;
  } else if (uKind < 1.5) {
    // lava: a dark crust breaking over a glowing flow; it lights itself
    float f = wn(w * 0.22 + vec2(t * 0.05, t * 0.08)) * 0.6 + wn(w * 0.7 - vec2(t * 0.09, 0.0)) * 0.4;
    float crust = smoothstep(0.45, 0.62, f);
    float seam = 1.0 - smoothstep(0.0, 0.07, abs(f - 0.5));
    col = mix(uShallow * 1.25, uDeep, crust);
    col += uFoam * seam * (0.8 + 0.2 * sin(t * 3.0 + w.x));
    col *= 1.0 - (1.0 - smoothstep(0.0, 0.4, d)) * 0.25;
  } else if (uKind < 2.5) {
    // ice: pale, cracked, dusted with snow, a sheen where the sun is
    float cr = wn(w * 0.45);
    float crack = 1.0 - smoothstep(0.0, 0.035, abs(cr - 0.5));
    float snow = smoothstep(0.55, 0.75, wn(w * 0.12 + 7.0));
    col = mix(uDeep, uShallow, smoothstep(0.0, 1.2, d) * 0.6 + 0.2);
    col = mix(col, uFoam, snow * 0.55);
    col = mix(col, uDeep * 0.75, crack * 0.6);
    col += uSky * pow(wn(w * 0.08 + t * 0.02), 6.0) * 0.4;
    col *= day;
  } else {
    // swamp: still, dark, a skin of green, motes that glow after dark
    float scum = smoothstep(0.5, 0.75, wn(w * 0.18 + 3.0));
    col = mix(uDeep, uShallow, scum * 0.7);
    vec2 cell = floor(w * 0.6);
    float m = step(0.93, wh(cell)) * (1.0 - smoothstep(0.03, 0.09, length(fract(w * 0.6) - 0.5)));
    col *= day;
    col += uFoam * m * (0.15 + uNight * 1.1) * (0.6 + 0.4 * sin(t * 2.0 + wh(cell + 3.0) * 6.28));
    a = mix(0.75, 0.95, smoothstep(0.0, 0.6, d));
  }
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}
`;

const KINDS = {
  water: { k: 0, deep: 0x1E6FA8, shallow: 0x58C2C8, foam: 0xF2FBFF, sky: 0xFFFFFF },
  lava: { k: 1, deep: 0x4A1A10, shallow: 0xFF7A1A, foam: 0xFFE07A, sky: 0x000000 },
  ice: { k: 2, deep: 0x8FC4E8, shallow: 0xDDF2FF, foam: 0xFFFFFF, sky: 0xFFFFFF },
  swamp: { k: 3, deep: 0x3A5244, shallow: 0x7A9A5A, foam: 0x8FF6C8, sky: 0x9FB8A8 },
};

/**
 * The zone's water as one surface at its level: a grid laid only where the
 * ground dips below it, each vertex knowing how deep it is there (shallows,
 * foam at the edge). `pal.water` tints ordinary water to the zone.
 */
export function buildWater(P, pal = {}) {
  if (!P.water) return null;
  const L = P.level, half = P.half, step = 2;
  const pos = [], dep = [];
  const n = Math.ceil(P.size / step);
  const depth = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) depth[j * (n + 1) + i] = L - P.height(-half + i * step, -half + j * step);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = [j * (n + 1) + i, j * (n + 1) + i + 1, (j + 1) * (n + 1) + i, (j + 1) * (n + 1) + i + 1];
    if (Math.max(...k.map((q) => depth[q])) < -0.05) continue;
    const x0 = -half + i * step, z0 = -half + j * step;
    if (Math.hypot(x0 + step / 2, z0 + step / 2) > half + 12) continue;
    const v = [[x0, z0, k[0]], [x0 + step, z0, k[1]], [x0, z0 + step, k[2]], [x0 + step, z0 + step, k[3]]];
    for (const q of [0, 2, 1, 1, 2, 3]) { pos.push(v[q][0], L, v[q][1]); dep.push(depth[v[q][2]]); }
  }
  if (!pos.length) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('aDepth', new Float32BufferAttribute(dep, 1));
  g.computeBoundingSphere();
  const K = KINDS[P.water.kind] || KINDS.water;
  const deep = P.water.kind === 'water' && pal.water ? pal.water : K.deep;
  const u = UniformsUtils.merge([UniformsLib.fog, {
    uGTime: { value: 0 }, uNight: { value: 0 }, uKind: { value: K.k },
    uDeep: { value: new Color(deep) }, uShallow: { value: new Color(K.shallow) }, uFoam: { value: new Color(K.foam) }, uSky: { value: new Color(K.sky) },
  }]);
  const m = new ShaderMaterial({
    uniforms: u, vertexShader: WATER_VERT, fragmentShader: displayFrag(WATER_FRAG),
    transparent: P.water.kind === 'water' || P.water.kind === 'swamp', depthWrite: P.water.kind === 'lava' || P.water.kind === 'ice', fog: true,
  });
  const mesh = new Mesh(g, m);
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;
  mesh.userData.uniforms = u;
  return mesh;
}

export { Vector3 };
