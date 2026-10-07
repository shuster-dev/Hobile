// The field zones, planned.
//
// Every field zone used to be the same thing: rolling noise, trees and rocks
// thrown at it at random, a camp. A different colour of the same meadow. Here
// each one is laid out by hand (zoneplans.js) as a short list of features — a
// river, a mesa with a ramp up its side, a frozen lake, a village, a bridge —
// and this file compiles that list into the questions the rest of the game
// asks of the ground:
//
//   height(x, z)      the terrain             surface(x, z)  what you stand on
//   walkable(x, z)    can a body be here       deckAt(x, z)   a bridge / boardwalk
//   waterDepth(x, z)  below the zone's water   onCliff(x, z)  a rock face
//   roadAt / forestAt / isHabitat / tone       for drawing and for spawning
//   structures, colliders                      what is built, and what stops you
//
// It is shared and pure: the server walks the same ground the client draws,
// and nothing about a zone goes over the wire. All distances in metres; y up;
// a structure's `rot` turns it about y the way `object.rotation.y` does, so
// its local +z faces (sin rot, cos rot).
import { ZONES } from './gamedata.js';
import { fbm, hash, resolveCollision, valueNoise } from './props.js';
import { PLANS } from './zoneplans.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Distance from (x, z) to a polyline, and how far along it (0..1). */
function polyDist(pts, x, z) {
  let best = Infinity, at = 0, run = 0, total = 0;
  const lens = [];
  for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); lens.push(l); total += l; }
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = clamp01(((x - ax) * dx + (z - az) * dz) / l2);
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < best) { best = d; at = (run + lens[i] * t) / (total || 1); }
    run += lens[i];
  }
  return { d: best, t: at };
}

/** A polyline smoothed into a curve (Chaikin, twice): rivers and roads read as
 *  drawn, not ruled. */
function soften(pts, n = 2) {
  let p = pts;
  for (let k = 0; k < n; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1];
      q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

/** Signed distance to an ellipse-ish blob (positive inside), its rim wobbled
 *  by noise so no lake is a perfect oval. */
function blobDist(f, x, z, seed) {
  const c = Math.cos(f.rot || 0), s = Math.sin(f.rot || 0);
  const dx = x - f.x, dz = z - f.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
  const q = Math.hypot(lx / f.rx, lz / f.rz);
  const ang = Math.atan2(lz, lx);
  const wob = (valueNoise(Math.cos(ang) * 2.2 + 7, Math.sin(ang) * 2.2 + 3, seed) - 0.5) * (f.wobble ?? 0.16);
  return (1 + wob - q) * Math.min(f.rx, f.rz);
}

/** A point in a rotated rectangle (a deck, a footprint). */
function inRect(r, x, z, pad = 0) {
  const c = Math.cos(-(r.rot || 0)), s = Math.sin(-(r.rot || 0));
  const lx = (x - r.x) * c - (z - r.z) * s, lz = (x - r.x) * s + (z - r.z) * c;
  return Math.abs(lx) <= r.hw + pad && Math.abs(lz) <= r.hd + pad ? { lx, lz } : null;
}

const CELL = 2;   // the habitat grid

class Plan {
  constructor(zone, spec) {
    this.id = zone.id;
    this.zone = zone;
    this.size = zone.size;
    this.half = zone.size / 2;
    this.spec = spec;
    this.seed = hash(zone.id);
    this.water = spec.water || null;          // { kind, level }
    this.level = this.water ? this.water.level : -99;
    const S = (a) => a || [];
    this.hills = S(spec.hills);
    this.plateaus = S(spec.plateaus).map((p) => ({ edge: 2.4, ...p }));
    this.rivers = S(spec.rivers).map((r) => ({ bank: 5, depth: 1.6, ...r, pts: soften(r.pts) }));
    this.lakes = S(spec.lakes).map((l) => ({ bank: 4, depth: 1.8, ...l }));
    this.chasms = S(spec.chasms).map((c) => ({ ...c, pts: soften(c.pts) }));
    this.sea = spec.sea || null;              // { z0, amp, freq, beach, bay }
    this.isles = S(spec.isles);
    this.roads = S(spec.roads).map((r) => ({ w: 3.2, ...r, pts: soften(r.pts) }));
    this.forests = S(spec.forests);
    this.patches = S(spec.grass);             // the tall grass the wild ones live in
    this.flats = [];
    // the ground the landmarks stand on is levelled (camp, portals, gates)
    for (const l of zone.landmarks || []) this.flats.push({ x: l.x, z: l.z, r: (l.r || 4) + 2, edge: 9 });
    for (const f of S(spec.flats)) this.flats.push({ edge: 8, ...f });
    for (const f of this.flats) f.y = this.rawHeight(f.x, f.z);
    // what is built
    this.structures = S(spec.structures).map((s, i) => ({ rot: 0, ...s, i }));
    this.decks = [];
    for (const s of this.structures) this.deckOf(s);
    for (const s of this.structures) {
      // a line of things (rails, lanterns) has points, not a middle
      if (s.x === undefined && s.pts?.length) { s.x = s.pts[0][0]; s.z = s.pts[0][1]; }
      s.y = s.y ?? (s.kind === 'bridge' || s.kind === 'boardwalk' || s.kind === 'pier' ? this.level : this.height(s.x, s.z));
    }
    this.colliders = this.structures.flatMap((s) => this.footprint(s));
    this.buildGrid();
  }

  // ------------------------------------------------------------- the ground
  /** The terrain before landmarks level it. */
  rawHeight(x, z) {
    const sp = this.spec, sd = this.seed % 997;
    let h = (fbm(x * 0.012, z * 0.012, this.seed, 3) * 2 + fbm(x * 0.05, z * 0.05, this.seed + 5, 2) * 0.35) * (sp.relief ?? 1.6) + (sp.base ?? 0);
    for (const k of this.hills) {
      const d = Math.hypot(x - k.x, z - k.z) / k.r;
      if (d < 1) h += k.h * 0.5 * (1 + Math.cos(Math.PI * d));
    }
    // open ground stays dry: only what is carved below holds the zone's water
    if (this.water && !this.sea) h = Math.max(h, this.level + 0.45 + (h - this.level) * 0.15);
    for (const p of this.plateaus) h = Math.max(h, this.plateauH(p, x, z, h));
    if (this.sea) {
      const s = this.seaSigned(x, z), b = this.sea.beach ?? 9;
      const deep = this.level - Math.min(7, 0.6 + Math.max(0, -s) * 0.22);
      const beach = this.level + 0.25 + Math.max(0, s) * 0.06;
      if (s < b + 10) h = s < 0 ? deep : s < b ? Math.min(h, beach) : lerp(Math.min(h, beach), h, smooth(b, b + 10, s));
      if (s < 0) h = Math.min(h, lerp(this.level + 0.25, deep, smooth(0, 6, -s)));
    }
    for (const k of this.isles) {
      const d = Math.hypot(x - k.x, z - k.z);
      if (d < k.r) h = Math.max(h, lerp(this.level - 2.5, this.level + k.h + fbm(x * 0.08, z * 0.08, this.seed + 9, 2) * 0.6, smooth(k.r, k.r * 0.5, d)));
    }
    for (const r of this.rivers) {
      const { d } = polyDist(r.pts, x, z), w = r.w / 2;
      if (d > w + r.bank + 6) continue;
      const ch = d < w ? this.level - r.depth * (1 - (d / w) ** 2) - 0.1 : this.level + 0.12;
      // a valley the river runs in, then the channel cut into it
      const vf = smooth(w + r.bank, w + r.bank + 6, d);
      const valley = lerp(Math.min(h, this.level + 0.45 + Math.max(0, h - this.level) * 0.25), h, vf);
      h = lerp(ch, valley, smooth(w, w + r.bank, d));
    }
    for (const l of this.lakes) {
      const s = blobDist(l, x, z, this.seed + 17);
      if (s < -l.bank - 6) continue;
      const ch = s > 0 ? this.level - Math.min(l.depth, 0.35 + s * 0.35) : this.level + 0.12;
      h = lerp(ch, h, smooth(0, l.bank, -s));
    }
    for (const c of this.chasms) {
      const { d } = polyDist(c.pts, x, z), w = c.w / 2;
      if (d < w + 2.5) h = lerp(-26, h, smooth(w - 1.2, w + 1.6, d));
    }
    return h;
  }

  plateauH(p, x, z, under) {
    const s = blobDist(p, x, z, this.seed + 31 + (p.x | 0));
    const E = this.plateauEdge(p, x, z);
    if (s < -E) return -Infinity;
    const top = p.h + (p.lift ?? 0) + fbm(x * 0.04, z * 0.04, this.seed + 3, 2) * 0.5;
    return lerp(under, Math.max(under, top), clamp01((s + E) / E));
  }

  /** How wide a plateau's edge is here: a cliff, or a ramp where it has one. */
  plateauEdge(p, x, z) {
    let E = p.edge;
    for (const r of p.ramps || []) {
      const a = Math.atan2(z - p.z, x - p.x), da = Math.abs(((a - r.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      const w = 1 - smooth(r.w * 0.6, r.w, da);
      E = Math.max(E, lerp(p.edge, r.len, w));
    }
    return E;
  }

  seaSigned(x, z) {
    const s = this.sea;
    return z - (s.z0 + Math.sin(x * (s.freq ?? 0.03) + (s.phase ?? 0)) * (s.amp ?? 12) + (valueNoise(x * 0.05, 3.3, this.seed) - 0.5) * 6 + (s.bay ? s.bay.d * Math.exp(-(((x - s.bay.x) / s.bay.w) ** 2)) : 0));
  }

  height(x, z) {
    let h = this.rawHeight(x, z);
    for (const f of this.flats) {
      const d = Math.hypot(x - f.x, z - f.z);
      if (d < f.r + f.edge) h = lerp(f.y, h, smooth(f.r, f.r + f.edge, d));
    }
    return h;
  }

  /** What a foot stands on: the terrain, a deck over it, or the ice. */
  surface(x, z) {
    const h = this.height(x, z);
    const d = this.deckAt(x, z);
    if (d) return Math.max(h, d.yAt(x, z));
    if (this.water?.kind === 'ice' && h < this.level) return this.level;
    return h;
  }

  waterDepth(x, z) { return this.water ? this.level - this.height(x, z) : -99; }

  /** Deep enough to stop a walker (ice holds you up). */
  inWater(x, z) {
    return !!this.water && this.water.kind !== 'ice' && this.waterDepth(x, z) > 0.32;
  }

  onCliff(x, z) {
    for (const p of this.plateaus) {
      const s = blobDist(p, x, z, this.seed + 31 + (p.x | 0)), E = this.plateauEdge(p, x, z);
      if (s > -E - 0.5 && s < 0.6 && p.h / E > 0.7) return true;
    }
    return false;
  }

  inChasm(x, z) {
    for (const c of this.chasms) if (polyDist(c.pts, x, z).d < c.w / 2 + 0.9) return true;
    return false;
  }

  deckAt(x, z) {
    for (const d of this.decks) if (inRect(d, x, z)) return d;
    return null;
  }

  /** Can a body stand here? Not in deep water or lava, not on a rock face,
   *  not over the chasm — unless a bridge or a boardwalk is under it. */
  walkable(x, z) {
    if (Math.hypot(x, z) > this.half - 3) return false;
    if (this.deckAt(x, z)) return true;
    return !(this.inWater(x, z) || this.inChasm(x, z) || this.onCliff(x, z));
  }

  roadAt(x, z) {
    let v = 0;
    for (const r of this.roads) {
      const { d } = polyDist(r.pts, x, z);
      if (d < r.w) v = Math.max(v, 1 - smooth(r.w * 0.35, r.w * 0.5 + 0.9, d));
    }
    return v;
  }

  forestAt(x, z) {
    let v = 0;
    for (const f of this.forests) {
      const d = Math.hypot(x - f.x, z - f.z) / f.r;
      if (d < 1) v = Math.max(v, (1 - d * d) * (f.density ?? 1));
    }
    return v;
  }

  grassAt(x, z) {
    let v = 0;
    for (const g of this.patches) {
      const d = Math.hypot(x - g.x, z - g.z) / g.r;
      if (d < 1) v = Math.max(v, 1 - smooth(0.55, 1, d));
    }
    return v;
  }

  // ------------------------------------------------------------- the built
  /** Bridges, boardwalks and piers carry you over what is under them. */
  deckOf(s) {
    if (s.kind !== 'bridge' && s.kind !== 'boardwalk' && s.kind !== 'pier') return;
    // a bridge can be placed by where it crosses: square across the river or
    // the chasm nearest that point, long enough to land on both banks
    if (s.at && !s.a) {
      let best = null;
      for (const f of [...this.rivers, ...this.chasms]) {
        const P = f.pts;
        for (let i = 0; i < P.length - 1; i++) {
          const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
          const t = clamp01(((s.at[0] - ax) * dx + (s.at[1] - az) * dz) / l2);
          const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(s.at[0] - px, s.at[1] - pz);
          if (!best || d < best.d) best = { d, px, pz, tx: dx / Math.sqrt(l2), tz: dz / Math.sqrt(l2), f };
        }
      }
      if (best) {
        const L = best.f.w / 2 + (best.f.bank ?? 0) * 0.6 + (this.chasms.includes(best.f) ? 3 : 1.5);
        s.a = [best.px + best.tz * L, best.pz - best.tx * L];
        s.b = [best.px - best.tz * L, best.pz + best.tx * L];
      }
    }
    const [ax, az] = s.a, [bx, bz] = s.b, len = Math.hypot(bx - ax, bz - az);
    s.x = (ax + bx) / 2; s.z = (az + bz) / 2;
    s.rot = Math.atan2(bx - ax, bz - az);
    s.len = len;
    s.w = s.w ?? (s.kind === 'bridge' ? 4.2 : 2.6);
    const ya = Math.max(this.height(ax, az), this.level + 0.3), yb = Math.max(this.height(bx, bz), this.level + 0.3);
    const lift = s.kind === 'bridge' ? (s.arch ?? 1.1) : 0;
    const flat = s.kind !== 'bridge';
    const deckY = Math.max(this.level + (this.water?.kind === 'lava' ? 1.4 : 0.55), Math.min(ya, yb));
    const deck = {
      x: s.x, z: s.z, rot: s.rot, hw: s.w / 2, hd: len / 2 + 0.6, kind: s.kind, s,
      yAt: (x, z) => {
        const c = Math.cos(-s.rot), sn = Math.sin(-s.rot);
        const lz = (x - s.x) * sn + (z - s.z) * c;
        const t = clamp01(lz / len + 0.5);
        if (flat) return deckY;
        return lerp(ya, yb, t) + lift * Math.sin(Math.PI * t) + Math.max(0, deckY - lerp(ya, yb, t)) * Math.sin(Math.PI * t);
      },
    };
    s.deck = deck;
    this.decks.push(deck);
  }

  /** What stops a body: a structure's walls, posts and railings. */
  footprint(s) { return footprintOf(s); }

  // ------------------------------------------------------------- habitats
  /** A coarse grid of the questions spawning asks a hundred times: is this
   *  ground walkable, how far is it from water, from a cliff, from lava. */
  buildGrid() {
    const n = Math.ceil(this.size / CELL), N = n * n, h0 = -this.half;
    const walk = new Uint8Array(N), wet = new Uint8Array(N), cliff = new Uint8Array(N);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = h0 + (i + 0.5) * CELL, z = h0 + (j + 0.5) * CELL, k = j * n + i;
      walk[k] = this.walkable(x, z) ? 1 : 0;
      wet[k] = this.water && this.waterDepth(x, z) > 0.05 ? 1 : 0;
      cliff[k] = this.onCliff(x, z) ? 1 : 0;
    }
    this.grid = { n, walk, waterD: chamfer(wet, n), cliffD: chamfer(cliff, n) };
  }

  cell(x, z) {
    const g = this.grid, i = Math.floor((x + this.half) / CELL), j = Math.floor((z + this.half) / CELL);
    if (i < 0 || j < 0 || i >= g.n || j >= g.n) return -1;
    return j * g.n + i;
  }

  waterDist(x, z) { const k = this.cell(x, z); return k < 0 ? 99 : this.grid.waterD[k] * CELL; }
  cliffDist(x, z) { const k = this.cell(x, z); return k < 0 ? 99 : this.grid.cliffD[k] * CELL; }

  /** Is (x, z) the kind of ground a species keeps to? (habitats.js) */
  isHabitat(x, z, tag) {
    const kind = this.water?.kind;
    switch (tag) {
      case 'grass': return this.grassAt(x, z) > 0.3;
      case 'forest': return this.forestAt(x, z) > 0.35;
      case 'water': return kind !== 'lava' && kind !== 'ice' && this.waterDist(x, z) <= 6;
      case 'shore': return !!this.sea && this.seaSigned(x, z) < (this.sea.beach ?? 9) + 2;
      case 'cliff': return this.cliffDist(x, z) <= 6 || (this.chasms.length > 0 && this.chasms.some((c) => polyDist(c.pts, x, z).d < c.w / 2 + 7));
      case 'lava': return kind === 'lava' && this.waterDist(x, z) <= 9;
      case 'ice': return kind === 'ice' && (this.waterDepth(x, z) > 0 || this.waterDist(x, z) <= 5);
      default: return true;
    }
  }

  /** The tall grass, forests, shores... a point is in, for the map's key. */
  habitatsAt(x, z) {
    return ['grass', 'forest', 'water', 'shore', 'cliff', 'lava', 'ice'].filter((t) => this.isHabitat(x, z, t));
  }

  // ------------------------------------------------------------- the look
  /** How the ground is coloured here, as weights the client mixes:
   *  sand (shore, dry wash), rock (faces, mesa tops), road, moss, ash, snow. */
  tone(x, z, h = this.height(x, z)) {
    const t = this.spec.tone || {};
    const w = { sand: 0, rock: 0, road: 0, moss: 0, ash: 0, snow: 0, dark: 0 };
    const wd = this.water ? this.level - h : -99;
    if (this.water && this.water.kind !== 'lava' && this.water.kind !== 'ice') w.sand = smooth(-1.4, 0.35, wd) * (t.shore ?? 1);
    if (this.sea) w.sand = Math.max(w.sand, 1 - smooth((this.sea.beach ?? 9) - 2, (this.sea.beach ?? 9) + 4, this.seaSigned(x, z)));
    if (this.water?.kind === 'lava') w.ash = 1 - smooth(1.5, 9, this.waterDist(x, z));
    if (this.water?.kind === 'ice') w.snow = 1 - smooth(0, 5, this.waterDist(x, z));
    for (const p of this.plateaus) {
      const s = blobDist(p, x, z, this.seed + 31 + (p.x | 0)), E = this.plateauEdge(p, x, z);
      if (s > -E - 1 && s < 1.2 && p.h / E > 0.7) w.rock = Math.max(w.rock, 1 - smooth(0.6, 1.4, Math.abs(s + E * 0.5) / (E * 0.5 + 0.6)));
      if (s > 0) w.rock = Math.max(w.rock, (t.mesaTop ?? 0.35) * smooth(0, 4, s));
    }
    for (const c of this.chasms) { const { d } = polyDist(c.pts, x, z); if (d < c.w / 2 + 4) w.rock = Math.max(w.rock, 1 - smooth(c.w / 2, c.w / 2 + 4, d)); }
    w.road = this.roadAt(x, z);
    w.moss = this.forestAt(x, z) * (t.moss ?? 0.6);
    if (t.snow) w.snow = Math.max(w.snow, t.snow * smooth(t.snowFrom ?? 3, (t.snowFrom ?? 3) + 4, h));
    return w;
  }
}

/** A structure's colliders in the world, from its kind (FOOTPRINTS below). */
export function footprintOf(s) {
  const rot = s.rot || 0;   // a haystack or a pond is laid without one
  const box = (lx, lz, hw, hd, top, kind = 'structure') => {
    const c = Math.cos(rot), sn = Math.sin(rot);
    return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c, hw, hd, rot: -rot, kind, top: (s.y ?? 0) + top };
  };
  const circ = (lx, lz, r, top, kind = 'structure') => {
    const c = Math.cos(rot), sn = Math.sin(rot);
    return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c, r, kind, top: (s.y ?? 0) + top };
  };
  const F = FOOTPRINTS[s.kind];
  if (F) return F(s, box, circ);
  if (s.w && s.d) return [box(0, 0, s.w / 2, s.d / 2, s.h ?? 4)];
  return [];
}

/** Distance in cells to the nearest set cell (two-pass chamfer, 1 / 1.4). */
function chamfer(src, n) {
  const D = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) D[k] = src[k] ? 0 : 1e6;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; let v = D[k];
    if (i > 0) v = Math.min(v, D[k - 1] + 1);
    if (j > 0) v = Math.min(v, D[k - n] + 1);
    if (i > 0 && j > 0) v = Math.min(v, D[k - n - 1] + 1.414);
    if (i < n - 1 && j > 0) v = Math.min(v, D[k - n + 1] + 1.414);
    D[k] = v;
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i; let v = D[k];
    if (i < n - 1) v = Math.min(v, D[k + 1] + 1);
    if (j < n - 1) v = Math.min(v, D[k + n] + 1);
    if (i < n - 1 && j < n - 1) v = Math.min(v, D[k + n + 1] + 1.414);
    if (i > 0 && j < n - 1) v = Math.min(v, D[k + n - 1] + 1.414);
    D[k] = v;
  }
  return D;
}

/**
 * What stops you, per kind of structure, in its own frame (x across, z along
 * its facing). Anything not listed with a w and d is one box; a kind that is
 * only scenery (a field of crops, a lantern you walk round) can return [].
 */
const FOOTPRINTS = {
  // decks: the railings along both sides, open at the ends
  bridge: (s, box) => [box(s.w / 2 + 0.15, 0, 0.18, s.len / 2 - 0.3, 1.6, 'rail'), box(-s.w / 2 - 0.15, 0, 0.18, s.len / 2 - 0.3, 1.6, 'rail')],
  boardwalk: () => [],
  pier: (s, box) => [box(s.w / 2 + 0.1, 0, 0.12, s.len / 2 - 0.4, 1.2, 'rail'), box(-s.w / 2 - 0.1, 0, 0.12, s.len / 2 - 0.4, 1.2, 'rail')],
  windmill: (s, box, circ) => [circ(0, 0, 3.4, 13)],
  watchtower: (s, box) => [box(0, 0, 2.2, 2.2, 11)],
  lighthouse: (s, box, circ) => [circ(0, 0, 3.2, 17)],
  turbine: (s, box, circ) => [circ(0, 0, 1.1, 18)],
  mast: (s, box, circ) => [circ(0, 0, 1.4, 22)],
  crystals: (s, box, circ) => [circ(0, 0, (s.r ?? 3) * 0.75, (s.r ?? 3) * 1.6)],
  basalt: (s, box, circ) => [circ(0, 0, (s.r ?? 3) * 0.8, (s.r ?? 3))],
  spire: (s, box, circ) => [circ(0, 0, (s.r ?? 2.5) * 0.8, (s.r ?? 2.5) * 4)],
  gianttree: (s, box, circ) => [circ(0, 0, (s.r ?? 2.6), 30)],
  mushroom: (s, box, circ) => [circ(0, 0, (s.r ?? 1.2) * 0.45, (s.r ?? 1.2) * 3)],
  arch: (s, box) => [box((s.span ?? 10) / 2 + 1.2, 0, 1.6, 2, 9), box(-(s.span ?? 10) / 2 - 1.2, 0, 1.6, 2, 9)],
  mine: (s, box) => [box(3.3, 0, 1, 2, 5), box(-3.3, 0, 1, 2, 5), box(0, -2.2, 4.3, 0.8, 5)],
  field: () => [],
  orchard: () => [],
  rails: () => [],
  lanterns: () => [],
  fence: (s, box) => [box(0, 0, (s.len ?? 8) / 2, 0.15, 1.2, 'fence')],
  well: (s, box, circ) => [circ(0, 0, 1.1, 1.6)],
  haystack: (s, box, circ) => [circ(0, 0, 1.2, 2)],
  crates: (s, box) => [box(0, 0, 1.3, 1, 1.6)],
  cart: (s, box) => [box(0, 0, 1, 1.6, 1.8)],
  boat: (s, box) => [box(0, 0, 1.2, 3, 1.5)],
  tent: (s, box) => [box(0, 0, 1.8, 2, 2.4)],
  anvil: (s, box) => [box(0, 0, 0.6, 0.4, 1)],
  ruinwall: (s, box) => [box(0, 0, (s.len ?? 10) / 2, 0.8, 4)],
  ruintower: (s, box, circ) => [circ(0, 0, 3.2, 8)],
  temple: (s, box) => [box(0, -1, 7, 6, 10), box(0, 6.5, 6.5, 1.5, 1.2)],
  airship: () => [],
  volcano: () => [],
  stilthouse: (s, box) => [box(0, 0, 3, 2.8, 5.5)],
  trough: (s, box) => [box(0, 0, 1.2, 0.45, 0.8)],
  pond: (s, box, circ) => [circ(0, 0, (s.r ?? 4) + 0.3, 0.5)],
};

const CACHE = new Map();

/** The compiled plan of a zone, or null for a zone without one (the town). */
export function planFor(zoneOrId) {
  const zone = typeof zoneOrId === 'string' ? ZONES[zoneOrId] : ZONES[zoneOrId?.id] || zoneOrId;
  if (!zone || !PLANS[zone.id]) return null;
  if (!CACHE.has(zone.id)) CACHE.set(zone.id, new Plan(zone, PLANS[zone.id]));
  return CACHE.get(zone.id);
}

/**
 * One step from (fx, fz) toward (tx, tz) for a body of radius r: out of the
 * colliders, and — in a planned zone — never into deep water, lava, a chasm
 * or up a rock face. Blocked, it slides along whichever axis keeps it on its
 * feet. A body that is somehow already off the ground (an old save, a GM
 * warp) is let walk out.
 */
export function stepWithin(zone, colliders, fx, fz, tx, tz, r = 0.5) {
  const P = zone && !zone.urban ? planFor(zone) : null;
  const p = resolveCollision(colliders, tx, tz, r);
  if (!P || P.walkable(p.x, p.z)) return p;
  for (const [x, z] of [[tx, fz], [fx, tz]]) {
    const q = resolveCollision(colliders, x, z, r);
    if (P.walkable(q.x, q.z)) return q;
  }
  return P.walkable(fx, fz) ? { x: fx, z: fz } : p;
}

/** Can a wild (or a returning player) be put down here? */
export function standable(zone, colliders, x, z, pad = 1.2) {
  const P = zone && !zone.urban ? planFor(zone) : null;
  if (P && (!P.walkable(x, z) || P.deckAt(x, z))) return false;
  if (P && Math.hypot(x, z) > P.half - 8) return false;
  return !colliders.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r ?? Math.max(c.hw, c.hd)) + pad);
}

/**
 * A point out in the field for a wild: on walkable ground, clear of the
 * landmarks and of anything built, and — when `tag` names a habitat — on that
 * kind of ground if there is any (shared/habitats.js). Wilds with no ground of
 * their own keep mostly to the tall grass (65%), as they always have in the
 * stories: that is where you go looking.
 */
export function fieldPoint(zone, colliders, rnd = Math.random, tag = null) {
  const P = zone && !zone.urban ? planFor(zone) : null;
  const half = zone.size / 2 - 8;
  if (!tag && P && P.patches.length && rnd() < 0.65) tag = 'grass';
  for (let i = 0; i < 80; i++) {
    let x, z;
    if (P) { const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (P.half - 10); x = Math.cos(a) * d; z = Math.sin(a) * d; }
    else { x = (rnd() * 2 - 1) * half; z = (rnd() * 2 - 1) * half; }
    if (zone.landmarks.some((l) => l.r && Math.hypot(l.x - x, l.z - z) < l.r + 4)) continue;
    if (!standable(zone, colliders, x, z)) continue;
    if (tag && P && i < 64 && !P.isHabitat(x, z, tag)) continue;
    return { x, z };
  }
  return null;
}

/** How many wilds a zone keeps: more ground, more of them. */
export function wildTarget(zone, base = 14) {
  if (!zone || zone.urban) return base;
  return Math.round(base * Math.min(2.6, Math.max(1, (zone.size / 130) ** 2 * 0.62)));
}

export { PLANS, polyDist, inRect, CELL };
