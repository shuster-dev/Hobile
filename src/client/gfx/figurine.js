/**
 * Figurines: every creature sculpted in code, the way a toy is sculpted.
 *
 * A body here is a signed distance field — spheres, ellipsoids, tapered
 * capsules and rounded boxes melted into each other with a smooth union — so a
 * neck grows out of a chest and a leg out of a hip the way they do on a vinyl
 * figure, with no seam where one shape meets the next. Colour is carried
 * through the same blend (and painted on with soft-edged volumes for bellies,
 * masks and tips), ambient occlusion is baked from the field itself, and the
 * surface is extracted with surface nets and projected onto the field so it
 * stays smooth at a modest triangle count.
 *
 * Things a field does badly — anything thin and sharp, like horns, claws,
 * fins, leaves, flames and wings — are built as ordinary geometry and bound
 * rigidly to a bone. Eyes are geometry too, drawn by the shader: iris,
 * pupil, highlights and a lid that blinks, crisp at any size.
 *
 * Everything — body, details, eyes — ends up in one skinned mesh with one
 * material: one draw call a creature (two with its outline), on a phone.
 */
import {
  BackSide, Bone, BufferAttribute, BufferGeometry, Color, ExtrudeGeometry, Group, LatheGeometry,
  Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Shape, Skeleton, SkinnedMesh, SphereGeometry, Vector2, Vector3,
} from 'three';

// ---------------------------------------------------------------------------
// the field
// ---------------------------------------------------------------------------

const SPHERE = 0, ELLIPSOID = 1, CONE = 2, BOX = 3, TORUS = 4;
const UNION = 0, CARVE = 1, PAINT = 2;

/**
 * Parts are packed into one Float64Array, a record of ST numbers each, so the
 * evaluator reads one kind of thing and the engine can keep it fast: the
 * field is asked a few hundred thousand questions per creature.
 */
const ST = 40;
const O_T = 0, O_OP = 1, O_K = 2, O_BI = 3, O_P = 4, O_Q = 7, O_R = 10, O_R2 = 11, O_M = 12, O_ROT = 21,
  O_BA = 22, O_L2 = 25, O_RR = 26, O_A2 = 27, O_IL2 = 28, O_SOFT = 29, O_ALPHA = 30, O_GLOW = 31, O_FLAME = 32,
  O_HASGLOW = 33, O_COL = 34, O_RIGID = 37;

/** Rotation from Euler angles (XYZ), as a row-major 3x3 for the inverse. */
function rotInv(rot) {
  const m = new Matrix4().makeRotationFromEuler({ x: rot[0] || 0, y: rot[1] || 0, z: rot[2] || 0, order: 'XYZ', isEuler: true });
  const e = m.elements;            // column-major; the inverse of a rotation is its transpose
  return [e[0], e[1], e[2], e[4], e[5], e[6], e[8], e[9], e[10]];
}

/**
 * Pack a design's parts. Returns the buffer, each part's bounds (for
 * culling), and the offsets of the shapes and of the paint, in order.
 */
function compile(parts, boneOf) {
  const n = parts.length;
  const B = new Float64Array(n * ST);
  const lo = [], hi = [], shapes = [], paints = [];
  const col = new Color();
  parts.forEach((p, i) => {
    const o = i * ST;
    const op = p.op ?? UNION;
    B[o + O_T] = p.t; B[o + O_OP] = op; B[o + O_K] = p.k || 0; B[o + O_BI] = boneOf ? boneOf(p.bone) : 0;
    const P = p.t === CONE ? p.a : p.p;
    B[o + O_P] = P[0]; B[o + O_P + 1] = P[1]; B[o + O_P + 2] = P[2];
    if (p.t === ELLIPSOID) { B[o + O_Q] = p.r[0]; B[o + O_Q + 1] = p.r[1]; B[o + O_Q + 2] = p.r[2]; }
    if (p.t === BOX) { B[o + O_Q] = p.h[0]; B[o + O_Q + 1] = p.h[1]; B[o + O_Q + 2] = p.h[2]; B[o + O_R] = p.round || 0; }
    if (p.t === SPHERE) B[o + O_R] = p.r;
    if (p.t === TORUS) { B[o + O_R] = p.R; B[o + O_R2] = p.r; }
    if (p.t === CONE) {
      B[o + O_Q] = p.b[0]; B[o + O_Q + 1] = p.b[1]; B[o + O_Q + 2] = p.b[2];
      B[o + O_R] = p.r1; B[o + O_R2] = p.r2;
      const bx = p.b[0] - p.a[0], by = p.b[1] - p.a[1], bz = p.b[2] - p.a[2];
      const l2 = Math.max(1e-9, bx * bx + by * by + bz * bz), rr = p.r1 - p.r2;
      B[o + O_BA] = bx; B[o + O_BA + 1] = by; B[o + O_BA + 2] = bz;
      B[o + O_L2] = l2; B[o + O_RR] = rr; B[o + O_A2] = l2 - rr * rr; B[o + O_IL2] = 1 / l2;
    }
    if (p.rot) { B.set(rotInv(p.rot), o + O_M); B[o + O_ROT] = 1; }
    B[o + O_SOFT] = p.soft || 0.01; B[o + O_ALPHA] = p.alpha ?? 1;
    B[o + O_GLOW] = p.glow || 0; B[o + O_FLAME] = p.flame || 0; B[o + O_HASGLOW] = p.glow != null ? 1 : 0;
    col.set(p.c ?? 0xffffff);
    B[o + O_COL] = col.r; B[o + O_COL + 1] = col.g; B[o + O_COL + 2] = col.b;
    B[o + O_RIGID] = p.rigid ? 1 : 0;
    let l, h;
    if (p.t === CONE) {
      const m = Math.max(p.r1, p.r2);
      l = [Math.min(p.a[0], p.b[0]) - m, Math.min(p.a[1], p.b[1]) - m, Math.min(p.a[2], p.b[2]) - m];
      h = [Math.max(p.a[0], p.b[0]) + m, Math.max(p.a[1], p.b[1]) + m, Math.max(p.a[2], p.b[2]) + m];
    } else {
      const r = p.t === SPHERE ? p.r : p.t === ELLIPSOID ? Math.max(...p.r) : p.t === BOX ? Math.hypot(...p.h) : p.R + p.r;
      l = [P[0] - r, P[1] - r, P[2] - r];
      h = [P[0] + r, P[1] + r, P[2] + r];
    }
    lo.push(l); hi.push(h);
    (op === PAINT ? paints : shapes).push(o);
  });
  return { B, n, lo, hi, shapes: Int32Array.from(shapes), paints: Int32Array.from(paints), parts };
}

function partDist(B, o, x, y, z) {
  const t = B[o];
  let dx = x - B[o + 4], dy = y - B[o + 5], dz = z - B[o + 6];
  if (t === SPHERE) return Math.sqrt(dx * dx + dy * dy + dz * dz) - B[o + 10];
  if (t === CONE) {
    // iq's exact round cone
    const bax = B[o + 22], bay = B[o + 23], baz = B[o + 24];
    const l2 = B[o + 25], rr = B[o + 26], a2 = B[o + 27], il2 = B[o + 28];
    const yv = dx * bax + dy * bay + dz * baz;
    const zv = yv - l2;
    const xx = dx * l2 - bax * yv, xy = dy * l2 - bay * yv, xz = dz * l2 - baz * yv;
    const x2 = xx * xx + xy * xy + xz * xz;
    const y2 = yv * yv * l2, z2 = zv * zv * l2;
    const k = (rr > 0 ? 1 : rr < 0 ? -1 : 0) * rr * rr * x2;
    if ((zv > 0 ? 1 : zv < 0 ? -1 : 0) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - B[o + 11];
    if ((yv > 0 ? 1 : yv < 0 ? -1 : 0) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - B[o + 10];
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - B[o + 10];
  }
  if (B[o + 21] > 0) {
    const rx = B[o + 12] * dx + B[o + 13] * dy + B[o + 14] * dz;
    const ry = B[o + 15] * dx + B[o + 16] * dy + B[o + 17] * dz;
    const rz = B[o + 18] * dx + B[o + 19] * dy + B[o + 20] * dz;
    dx = rx; dy = ry; dz = rz;
  }
  if (t === ELLIPSOID) {
    const a = B[o + 7], b = B[o + 8], c = B[o + 9];
    const ux = dx / a, uy = dy / b, uz = dz / c;
    const k0 = Math.sqrt(ux * ux + uy * uy + uz * uz);
    const vx = ux / a, vy = uy / b, vz = uz / c;
    const k1 = Math.sqrt(vx * vx + vy * vy + vz * vz);
    return k1 < 1e-9 ? -Math.min(a, b, c) : k0 * (k0 - 1) / k1;
  }
  if (t === BOX) {
    const rd = B[o + 10];
    const qx = Math.abs(dx) - B[o + 7] + rd, qy = Math.abs(dy) - B[o + 8] + rd, qz = Math.abs(dz) - B[o + 9] + rd;
    const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0, oz = qz > 0 ? qz : 0;
    const m = qx > qy ? (qx > qz ? qx : qz) : (qy > qz ? qy : qz);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + (m < 0 ? m : 0) - rd;
  }
  // torus
  const a = Math.sqrt(dx * dx + dz * dz) - B[o + 10];
  return Math.sqrt(a * a + dy * dy) - B[o + 11];
}

/** The distance alone, over the shape offsets in `L[0..n)` — the fast path. */
function fieldDist(B, L, n, x, y, z) {
  let d = 1e9;
  for (let i = 0; i < n; i++) {
    const o = L[i];
    const di = partDist(B, o, x, y, z);
    const k = B[o + 2];
    if (B[o + 1] === CARVE) {
      const kk = k || 1e-6;
      let h = 0.5 - 0.5 * (d + di) / kk;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      d = d * (1 - h) - di * h + kk * h * (1 - h);
    } else if (k > 0) {
      let h = 0.5 + 0.5 * (di - d) / k;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      d = di * (1 - h) + d * h - k * h * (1 - h);
    } else if (di < d) d = di;
  }
  return d;
}

/**
 * Distance, colour, glow and bone weights at a point — the slow path, once a
 * vertex. The weights ride the same blend as the colour but with a wider
 * reach, so a joint bends over a span instead of creasing.
 */
function fieldFull(B, L, n, P, np, x, y, z, nb, reach, out) {
  let d = 1e9, r = 0, g = 0, b = 0, glow = 0, flame = 0, dw = 1e9;
  const w = out.w;
  w.fill(0);
  for (let i = 0; i < n; i++) {
    const o = L[i];
    const di = partDist(B, o, x, y, z);
    if (B[o + 1] === CARVE) {
      const k = B[o + 2] || 1e-6;
      let h = 0.5 - 0.5 * (d + di) / k;
      h = h < 0 ? 0 : h > 1 ? 1 : h;
      d = d * (1 - h) - di * h + k * h * (1 - h);
      // the inside of a carve takes the carving part's colour: a mouth, a socket
      let hc = 0.5 - 0.5 * di / (k > 0.01 ? k : 0.01);
      hc = hc < 0 ? 0 : hc > 1 ? 1 : hc;
      r += (B[o + 34] - r) * hc; g += (B[o + 35] - g) * hc; b += (B[o + 36] - b) * hc;
      continue;
    }
    const k = B[o + 2] > 0 ? B[o + 2] : 1e-6;
    let h = 0.5 + 0.5 * (di - d) / k;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    if (d >= 1e8) { r = B[o + 34]; g = B[o + 35]; b = B[o + 36]; glow = B[o + 31]; flame = B[o + 32]; }
    else {
      r = B[o + 34] * (1 - h) + r * h; g = B[o + 35] * (1 - h) + g * h; b = B[o + 36] * (1 - h) + b * h;
      glow = B[o + 31] * (1 - h) + glow * h; flame = B[o + 32] * (1 - h) + flame * h;
    }
    d = di * (1 - h) + d * h - k * h * (1 - h);
    const kw = B[o + 37] > 0 ? 1e-6 : (k > reach ? k : reach);
    let hw = 0;
    if (dw < 1e8) { hw = 0.5 + 0.5 * (di - dw) / kw; hw = hw < 0 ? 0 : hw > 1 ? 1 : hw; }
    for (let j = 0; j < nb; j++) w[j] *= hw;
    w[B[o + 3]] += 1 - hw;
    dw = di * (1 - hw) + dw * hw - kw * hw * (1 - hw);
  }
  for (let i = 0; i < np; i++) {
    const o = P[i];
    const di = partDist(B, o, x, y, z);
    const s = B[o + 29];
    const f = (1 - smooth(-s, s, di)) * B[o + 30];
    if (f <= 0) continue;
    r += (B[o + 34] - r) * f; g += (B[o + 35] - g) * f; b += (B[o + 36] - b) * f;
    if (B[o + 33] > 0) glow += (B[o + 31] - glow) * f;
  }
  out.d = d; out.r = r; out.g = g; out.b = b; out.glow = glow; out.flame = flame;
  return out;
}

function smooth(a, b, x) {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// surface nets
// ---------------------------------------------------------------------------

/**
 * Extract the surface of the field as an indexed mesh.
 *
 * The grid is walked in bricks of 4 cells: a brick whose middle is further
 * from the surface than its own radius cannot contain any of it, so it is
 * filled with that one value instead of being evaluated point by point, and a
 * brick that does hold surface only asks the parts that can reach it. Most of
 * the grid is empty air or solid body, so this is most of the speed.
 */
function* meshGen(F0, bounds, cell) {
  const { B, shapes } = F0;
  const [lx, ly, lz] = bounds.lo;
  const nx = Math.max(2, Math.ceil((bounds.hi[0] - lx) / cell) + 1);
  const ny = Math.max(2, Math.ceil((bounds.hi[1] - ly) / cell) + 1);
  const nz = Math.max(2, Math.ceil((bounds.hi[2] - lz) / cell) + 1);
  const F = new Float32Array(nx * ny * nz);
  const BR = 4;
  const ns = shapes.length;
  let kmax = 0;
  for (let i = 0; i < ns; i++) kmax = Math.max(kmax, B[shapes[i] + 2]);
  const near = new Int32Array(ns), dcen = new Float64Array(ns);
  const rad = Math.sqrt(3) * (BR / 2) * cell + cell;
  let bricks = 0;
  for (let bk = 0; bk < nz; bk += BR) for (let bj = 0; bj < ny; bj += BR) for (let bi = 0; bi < nx; bi += BR) {
    if (++bricks % 48 === 0) yield;
    const i1 = Math.min(nx, bi + BR + 1), j1 = Math.min(ny, bj + BR + 1), k1 = Math.min(nz, bk + BR + 1);
    const cx = lx + (bi + (i1 - 1 - bi) / 2) * cell, cy = ly + (bj + (j1 - 1 - bj) / 2) * cell, cz = lz + (bk + (k1 - 1 - bk) / 2) * cell;
    let best = 1e9;
    for (let s = 0; s < ns; s++) {
      const o = shapes[s];
      const dq = partDist(B, o, cx, cy, cz);
      dcen[s] = dq;
      if (B[o + 1] !== CARVE && dq < best) best = dq;
    }
    let nn = 0;
    for (let s = 0; s < ns; s++) {
      const o = shapes[s], k = B[o + 2];
      if (B[o + 1] === CARVE ? dcen[s] < rad + k : dcen[s] - rad < best + rad + k + kmax) near[nn++] = o;
    }
    const dc = fieldDist(B, near, nn, cx, cy, cz);
    if (Math.abs(dc) > rad * 1.05) {
      for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) {
        const row = (k * ny + j) * nx;
        for (let i = bi; i < i1; i++) F[row + i] = dc;
      }
      continue;
    }
    for (let k = bk; k < k1; k++) for (let j = bj; j < j1; j++) {
      const row = (k * ny + j) * nx;
      for (let i = bi; i < i1; i++) F[row + i] = fieldDist(B, near, nn, lx + i * cell, ly + j * cell, lz + k * cell);
    }
  }

  // one vertex per cell the surface passes through
  const cx1 = nx - 1, cy1 = ny - 1;
  const vid = new Int32Array(cx1 * cy1 * (nz - 1)).fill(-1);
  const pos = [];
  const v = new Float64Array(8);
  const E0 = [0, 2, 4, 6, 0, 1, 4, 5, 0, 1, 2, 3], E1 = [1, 3, 5, 7, 2, 3, 6, 7, 4, 5, 6, 7];
  const CX = [0, 1, 0, 1, 0, 1, 0, 1], CY = [0, 0, 1, 1, 0, 0, 1, 1], CZ = [0, 0, 0, 0, 1, 1, 1, 1];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) {
      v[c] = F[((k + CZ[c]) * ny + j + CY[c]) * nx + i + CX[c]];
      if (v[c] < 0) inside++;
    }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (let e = 0; e < 12; e++) {
      const a = v[E0[e]], b = v[E1[e]];
      if ((a < 0) === (b < 0)) continue;
      const t = a / (a - b);
      const e0 = E0[e], e1 = E1[e];
      sx += CX[e0] + (CX[e1] - CX[e0]) * t; sy += CY[e0] + (CY[e1] - CY[e0]) * t; sz += CZ[e0] + (CZ[e1] - CZ[e0]) * t; n++;
    }
    vid[(k * cy1 + j) * cx1 + i] = pos.length / 3;
    pos.push(lx + (i + sx / n) * cell, ly + (j + sy / n) * cell, lz + (k + sz / n) * cell);
  }

  // a quad across every grid edge the surface crosses
  const tri = [];
  const V = (i, j, k) => vid[(k * cy1 + j) * cx1 + i];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = F[(k * ny + j) * nx + i];
    const inA = a < 0;
    if (inA !== (F[(k * ny + j) * nx + i + 1] < 0)) {
      const q0 = V(i, j - 1, k - 1), q1 = V(i, j, k - 1), q2 = V(i, j, k), q3 = V(i, j - 1, k);
      if (q0 >= 0 && q1 >= 0 && q2 >= 0 && q3 >= 0) inA ? tri.push(q0, q1, q2, q0, q2, q3) : tri.push(q0, q2, q1, q0, q3, q2);
    }
    if (inA !== (F[(k * ny + j + 1) * nx + i] < 0)) {
      const q0 = V(i - 1, j, k - 1), q1 = V(i, j, k - 1), q2 = V(i, j, k), q3 = V(i - 1, j, k);
      if (q0 >= 0 && q1 >= 0 && q2 >= 0 && q3 >= 0) inA ? tri.push(q0, q2, q1, q0, q3, q2) : tri.push(q0, q1, q2, q0, q2, q3);
    }
    if (inA !== (F[((k + 1) * ny + j) * nx + i] < 0)) {
      const q0 = V(i - 1, j - 1, k), q1 = V(i, j - 1, k), q2 = V(i, j, k), q3 = V(i - 1, j, k);
      if (q0 >= 0 && q1 >= 0 && q2 >= 0 && q3 >= 0) inA ? tri.push(q0, q1, q2, q0, q2, q3) : tri.push(q0, q2, q1, q0, q3, q2);
    }
  }
  return { pos: new Float32Array(pos), index: tri };
}

// ---------------------------------------------------------------------------
// baking the body
// ---------------------------------------------------------------------------

const _o = { d: 0, r: 0, g: 0, b: 0, glow: 0, flame: 0, w: null };

/** The field's gradient, by central differences: the surface normal. */
function gradient(B, L, n, x, y, z, e, out) {
  out.set(
    fieldDist(B, L, n, x + e, y, z) - fieldDist(B, L, n, x - e, y, z),
    fieldDist(B, L, n, x, y + e, z) - fieldDist(B, L, n, x, y - e, z),
    fieldDist(B, L, n, x, y, z + e) - fieldDist(B, L, n, x, y, z - e),
  );
  const l = out.length();
  return l > 1e-9 ? out.divideScalar(l) : out.set(0, 1, 0);
}

/**
 * Bake a design into buffers: the body's surface (projected onto the field,
 * coloured, occluded and weighted to its bones) at one level of detail.
 * `cells` is roughly how many cells span the creature's longest side.
 */
function* bakeBodyGen(design, F0, nb, cells) {
  const { B, shapes, paints } = F0;
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < F0.n; i++) {
    if (B[i * ST + 1] !== UNION) continue;
    for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], F0.lo[i][a]); hi[a] = Math.max(hi[a], F0.hi[i][a]); }
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  const cell = span / cells;
  const pad = cell * 2 + (design.pad || 0);
  const bounds = { lo: lo.map((v) => v - pad), hi: hi.map((v) => v + pad) };
  const { pos, index } = yield* meshGen(F0, bounds, cell);

  const n = pos.length / 3;
  const nor = new Float32Array(n * 3), col = new Float32Array(n * 3), fx = new Float32Array(n * 4);
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  // Scratch of its own: a bake can be paused half way while another runs.
  const _o = { d: 0, r: 0, g: 0, b: 0, glow: 0, flame: 0, w: new Float32Array(nb) };
  const g = new Vector3();
  const reach = design.reach ?? span * 0.07;
  const aoStep = span * 0.022, aoK = design.ao ?? 1;
  const ramp = design.ramp ?? 0;
  // Only the parts that can reach a vertex are asked about it: each part's
  // box, grown by its blend, the weights' reach and the occlusion's reach.
  const grow = aoStep * 5 + reach + cell * 2;
  const boxes = new Float64Array(F0.n * 6);
  for (let i = 0; i < F0.n; i++) {
    const m = grow + B[i * ST + 2] + (B[i * ST + 1] === PAINT ? B[i * ST + 29] : 0);
    boxes.set([F0.lo[i][0] - m, F0.lo[i][1] - m, F0.lo[i][2] - m, F0.hi[i][0] + m, F0.hi[i][1] + m, F0.hi[i][2] + m], i * 6);
  }
  const LS = new Int32Array(shapes.length), LP = new Int32Array(Math.max(1, paints.length));
  const inBox = (o, x, y, z) => {
    const b = (o / ST) * 6;
    return x > boxes[b] && y > boxes[b + 1] && z > boxes[b + 2] && x < boxes[b + 3] && y < boxes[b + 4] && z < boxes[b + 5];
  };
  for (let i = 0; i < n; i++) {
    if (i % 200 === 199) yield;
    let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    let ns = 0, np = 0;
    for (let s = 0; s < shapes.length; s++) if (inBox(shapes[s], x, y, z)) LS[ns++] = shapes[s];
    for (let s = 0; s < paints.length; s++) if (inBox(paints[s], x, y, z)) LP[np++] = paints[s];
    const L = ns ? LS : shapes, nl = ns || shapes.length;
    // onto the surface along the gradient, then the normal there
    {
      const d = fieldDist(B, L, nl, x, y, z);
      gradient(B, L, nl, x, y, z, cell * 0.25, g);
      x -= g.x * d; y -= g.y * d; z -= g.z * d;
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    gradient(B, L, nl, x, y, z, cell * 0.35, g);
    nor[i * 3] = g.x; nor[i * 3 + 1] = g.y; nor[i * 3 + 2] = g.z;
    fieldFull(B, L, nl, LP, np, x, y, z, nb, reach, _o);
    // occlusion, from how soon the field closes in along the normal
    let occ = 0, wt = 0.5;
    for (let s = 1; s <= 5; s++) {
      const h = aoStep * s;
      occ += (h - fieldDist(B, L, nl, x + g.x * h, y + g.y * h, z + g.z * h)) * wt;
      wt *= 0.55;
    }
    const ao = Math.min(1, Math.max(0, 1 - occ / aoStep * 0.5 * aoK));
    // bellies and undersides a shade deeper, like a painted figure's shading
    const shade = (0.62 + 0.38 * ao) * (1 - ramp * Math.max(0, -g.y) * 0.25);
    col[i * 3] = _o.r * shade; col[i * 3 + 1] = _o.g * shade; col[i * 3 + 2] = _o.b * shade;
    fx[i * 4] = _o.glow; fx[i * 4 + 1] = _o.flame; fx[i * 4 + 2] = 9; fx[i * 4 + 3] = 9;
    topWeights(_o.w, si, sw, i);
  }
  return { pos, nor, col, fx, si, sw, index, cell, span };
}

/** The four strongest bones at a vertex, normalised. */
function topWeights(w, si, sw, i) {
  let p0 = -1, p1 = -1, p2 = -1, p3 = -1, v0 = 0, v1 = 0, v2 = 0, v3 = 0;
  for (let j = 0; j < w.length; j++) {
    const x = w[j];
    if (x <= v3) continue;
    if (x > v0) { v3 = v2; p3 = p2; v2 = v1; p2 = p1; v1 = v0; p1 = p0; v0 = x; p0 = j; }
    else if (x > v1) { v3 = v2; p3 = p2; v2 = v1; p2 = p1; v1 = x; p1 = j; }
    else if (x > v2) { v3 = v2; p3 = p2; v2 = x; p2 = j; }
    else { v3 = x; p3 = j; }
  }
  let t = v0 + v1 + v2 + v3;
  if (t < 1e-6) { v0 = 1; p0 = 0; t = 1; }
  si[i * 4] = Math.max(0, p0); si[i * 4 + 1] = Math.max(0, p1); si[i * 4 + 2] = Math.max(0, p2); si[i * 4 + 3] = Math.max(0, p3);
  sw[i * 4] = v0 / t; sw[i * 4 + 1] = v1 / t; sw[i * 4 + 2] = v2 / t; sw[i * 4 + 3] = v3 / t;
}

// ---------------------------------------------------------------------------
// details: the hard parts, as geometry
// ---------------------------------------------------------------------------

const _v = new Vector3(), _w = new Vector3(), _u = new Vector3();
/** 1 for the near mesh, lower for the far one: fewer segments in the details. */
let DETAIL = 1;
const segs = (n, min = 4) => Math.max(min, Math.round(n * DETAIL));

/** A frame (two perpendiculars) for a direction. */
function frameFor(dir) {
  const d = _v.copy(dir).normalize();
  const up = Math.abs(d.y) < 0.95 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const a = new Vector3().crossVectors(up, d).normalize();
  const b = new Vector3().crossVectors(d, a).normalize();
  return [a, b, d.clone()];
}

/**
 * A tube swept along a quadratic curve from `p0` through a bend to `p1`, its
 * radius given by `rad(t)` — horns, claws, spikes, tails, whiskers, antennae.
 * The tip is closed to a point; the base is capped.
 */
function sweep(p0, p1, bend, rad, { sides = 10, rings = 10, col0, col1 } = {}) {
  sides = segs(sides, 5); rings = segs(rings, 4);
  const A = new Vector3(...p0), Bv = new Vector3(...p1);
  const C = A.clone().add(Bv).multiplyScalar(0.5).add(new Vector3(...(bend || [0, 0, 0])));
  const at = (t) => {
    const s = 1 - t;
    return new Vector3(
      s * s * A.x + 2 * s * t * C.x + t * t * Bv.x,
      s * s * A.y + 2 * s * t * C.y + t * t * Bv.y,
      s * s * A.z + 2 * s * t * C.z + t * t * Bv.z);
  };
  const pos = [], idx = [], cols = [];
  const c0 = new Color(col0), c1 = new Color(col1 ?? col0);
  let prevA = null;
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const p = at(t), q = at(Math.min(1, t + 0.01)), q0 = at(Math.max(0, t - 0.01));
    const dir = q.clone().sub(q0);
    let [a, b] = frameFor(dir);
    // keep the frame from twisting round the curve
    if (prevA) { const bb = new Vector3().crossVectors(dir.normalize(), prevA).normalize(); a = new Vector3().crossVectors(bb, dir).normalize(); b = bb; }
    prevA = a.clone();
    const rr = rad(t);
    const cc = c0.clone().lerp(c1, t);
    for (let s = 0; s < sides; s++) {
      const ang = s / sides * Math.PI * 2;
      pos.push(p.x + (a.x * Math.cos(ang) + b.x * Math.sin(ang)) * rr, p.y + (a.y * Math.cos(ang) + b.y * Math.sin(ang)) * rr, p.z + (a.z * Math.cos(ang) + b.z * Math.sin(ang)) * rr);
      cols.push(cc.r, cc.g, cc.b);
    }
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < sides; s++) {
    const a = r * sides + s, b = r * sides + (s + 1) % sides, c = (r + 1) * sides + s, d = (r + 1) * sides + (s + 1) % sides;
    idx.push(a, b, c, b, d, c);
  }
  // base cap
  const base = pos.length / 3;
  pos.push(A.x, A.y, A.z); cols.push(c0.r, c0.g, c0.b);
  for (let s = 0; s < sides; s++) idx.push(base, (s + 1) % sides, s);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(cols), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A flat part with thickness and rounded edges — a fin, a wing, a leaf, a
 * bolt, a crest, a gear — from a 2D outline. `place` puts its local x/y plane
 * into the figure: origin, and the directions its x, y and thickness point.
 */
function plate(outline, depth, place, { col, col1, bevel, curl = 0, holes } = {}) {
  const sh = new Shape(outline.map(([x, y]) => new Vector2(x, y)));
  if (holes) for (const h of holes) sh.holes.push(new Shape(h.map(([x, y]) => new Vector2(x, y))));
  const bv = bevel ?? depth * 0.45;
  const g = new ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.9, bevelSegments: DETAIL < 1 ? 1 : 2, curveSegments: segs(10, 4) });
  g.translate(0, 0, -depth / 2);
  const p = g.attributes.position;
  // bounds of the outline, for the colour ramp along y
  let ylo = 1e9, yhi = -1e9, xlo = 1e9, xhi = -1e9;
  for (const [x, y] of outline) { ylo = Math.min(ylo, y); yhi = Math.max(yhi, y); xlo = Math.min(xlo, x); xhi = Math.max(xhi, x); }
  const c0 = new Color(col), c1 = new Color(col1 ?? col);
  const cols = new Float32Array(p.count * 3);
  const [o, ax, ay, az] = [new Vector3(...place.o), new Vector3(...place.x).normalize(), new Vector3(...place.y).normalize(), new Vector3(...(place.z || [0, 0, 1])).normalize()];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    let z = p.getZ(i);
    // curl: the far end bends out of the plane, like a leaf or a feather
    const far = Math.max(0, (Math.abs(x - xlo) / Math.max(1e-6, xhi - xlo)));
    z += curl * far * far;
    const t = (y - ylo) / Math.max(1e-6, yhi - ylo);
    const c = c0.clone().lerp(c1, Math.min(1, Math.max(0, place.rampX ? far : t)));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    const w = o.clone().addScaledVector(ax, x).addScaledVector(ay, y).addScaledVector(az, z);
    p.setXYZ(i, w.x, w.y, w.z);
  }
  g.setAttribute('color', new BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  // A placement that mirrors (a left side made by negating x) turns the part
  // inside out; wind it back.
  if (new Vector3().crossVectors(ax, ay).dot(az) < 0) flipWinding(g);
  g.computeVertexNormals();
  return g;
}

/** Reverse every triangle, indexed or not. */
function flipWinding(g) {
  if (g.index) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    return;
  }
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name], a = at.array, n = at.itemSize;
    for (let i = 0; i < at.count; i += 3) for (let j = 0; j < n; j++) {
      const t = a[(i + 1) * n + j]; a[(i + 1) * n + j] = a[(i + 2) * n + j]; a[(i + 2) * n + j] = t;
    }
  }
}

/** A crystal: a six-sided prism with a pointed end, cut flat so it glints. */
function crystal(base, dir, len, r, col, col1) {
  const [a, b, d] = frameFor(new Vector3(...dir));
  const O = new Vector3(...base);
  const sides = 6, body = len * 0.68;
  const ring = (h, rr) => Array.from({ length: sides }, (_, s) => {
    const ang = s / sides * Math.PI * 2;
    return O.clone().addScaledVector(d, h).addScaledVector(a, Math.cos(ang) * rr).addScaledVector(b, Math.sin(ang) * rr);
  });
  const r0 = ring(0, r * 0.8), r1 = ring(body, r), tip = O.clone().addScaledVector(d, len);
  const pos = [], cols = [];
  const c0 = new Color(col), c1 = new Color(col1 ?? col);
  const push = (p, t) => { pos.push(p.x, p.y, p.z); const c = c0.clone().lerp(c1, t); cols.push(c.r, c.g, c.b); };
  for (let s = 0; s < sides; s++) {
    const s1 = (s + 1) % sides;
    push(r0[s], 0); push(r1[s], 0.7); push(r1[s1], 0.7);
    push(r0[s], 0); push(r1[s1], 0.7); push(r0[s1], 0);
    push(r1[s], 0.7); push(tip, 1); push(r1[s1], 0.7);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(cols), 3));
  outward(g, O, d);
  g.computeVertexNormals();       // not indexed: every face keeps its own normal
  return g;
}

/** Turn any face of a non-indexed, convex-ish part that faces its own axis
 *  (the line from `O` along `d`) the right way out. */
function outward(g, O, d) {
  const p = g.attributes.position.array, c = g.attributes.color?.array;
  const A = new Vector3(), B2 = new Vector3(), C2 = new Vector3(), n = new Vector3(), m = new Vector3(), ax = new Vector3();
  for (let i = 0; i < p.length; i += 9) {
    A.fromArray(p, i); B2.fromArray(p, i + 3); C2.fromArray(p, i + 6);
    n.subVectors(B2, A).cross(m.subVectors(C2, A));
    m.copy(A).add(B2).add(C2).divideScalar(3);
    const t = m.clone().sub(O).dot(d);
    ax.copy(O).addScaledVector(d, t);
    if (n.dot(m.sub(ax)) < 0) {
      for (let j = 0; j < 3; j++) { const x = p[i + 3 + j]; p[i + 3 + j] = p[i + 6 + j]; p[i + 6 + j] = x; }
      if (c) for (let j = 0; j < 3; j++) { const x = c[i + 3 + j]; c[i + 3 + j] = c[i + 6 + j]; c[i + 6 + j] = x; }
    }
  }
}

/**
 * A flame: a tongue of fire turned on a lathe — a round belly low down, drawn
 * out to a tip that curls over — flattened a little, yellow at the root and
 * red at the tip. `lean` is how far the tip curls, along `side`.
 */
function flame(base, dir, len, r, col0 = 0xFFB52E, col1 = 0xE8340C, lean = 0.28, side = null) {
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const rr = r * Math.sin(Math.PI * Math.pow(t, 0.55)) * (1 - t * 0.2);
    pts.push(new Vector2(Math.max(1e-4, rr), t * len));
  }
  const g = new LatheGeometry(pts, segs(12, 6));
  // flatter one way than the other, and the tip curls over
  const p0 = g.attributes.position;
  for (let i = 0; i < p0.count; i++) {
    const y = p0.getY(i), t = y / len;
    p0.setX(i, p0.getX(i) + lean * len * t * t * (1.2 - 0.4 * t));
    p0.setZ(i, p0.getZ(i) * 0.72);
  }
  const [a0, , d] = frameFor(new Vector3(...dir));
  const a = side ? new Vector3(...side).addScaledVector(d, -new Vector3(...side).dot(d)).normalize() : a0;
  // (a, dir, a x dir) is right-handed; (a, dir, b) was a mirror, and turned
  // every flame inside out
  const m = new Matrix4().makeBasis(a, d, new Vector3().crossVectors(a, d)).setPosition(...base);
  g.applyMatrix4(m);
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const c0 = new Color(col0), c1 = new Color(col1), mid = new Color(col0).lerp(new Color(col1), 0.45);
  const O = new Vector3(...base), D = new Vector3(...dir).normalize();
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, _w.set(p.getX(i), p.getY(i), p.getZ(i)).sub(O).dot(D) / len));
    const c = t < 0.5 ? c0.clone().lerp(mid, t * 2) : mid.clone().lerp(c1, (t - 0.5) * 2);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new BufferAttribute(cols, 3));
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

/** A small sphere — a nose, a berry, a bead, an orb. */
function ball(c, r, col, sy = 1) {
  const g = new SphereGeometry(r, segs(14, 6), segs(10, 5));
  g.scale(1, sy, 1);
  g.translate(...c);
  g.deleteAttribute('uv');
  const cc = new Color(col), n = g.attributes.position.count;
  g.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).map((_, i) => [cc.r, cc.g, cc.b][i % 3]), 3));
  return g;
}

/** A ring or a halo. */
function ring(c, R, r, rot, col) {
  const pos = [], idx = [], S = segs(36, 12), T = segs(8, 4);
  for (let i = 0; i <= S; i++) for (let j = 0; j <= T; j++) {
    const u = i / S * Math.PI * 2, v = j / T * Math.PI * 2;
    pos.push((R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u));
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < T; j++) {
    const a = i * (T + 1) + j, b = (i + 1) * (T + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const t = new BufferGeometry();
  t.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  t.setIndex(idx);
  const m = new Matrix4().makeRotationFromEuler({ x: rot?.[0] || 0, y: rot?.[1] || 0, z: rot?.[2] || 0, order: 'XYZ', isEuler: true });
  m.setPosition(...c);
  t.applyMatrix4(m);
  t.computeVertexNormals();
  const cc = new Color(col), n = t.attributes.position.count;
  t.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).map((_, i) => [cc.r, cc.g, cc.b][i % 3]), 3));
  return t;
}

/**
 * An eye: a lens set into the head, facing out along the surface. The shader
 * draws everything on it from the (x, y) each vertex carries, so it is crisp
 * however close the camera gets, and it can blink.
 */
function eyeLens(center, normal, fwd, rx, ry, depth, col) {
  const g = new SphereGeometry(1, segs(22, 10), segs(14, 7));
  g.deleteAttribute('uv');
  const p = g.attributes.position;
  const fx = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    fx[i * 4] = 0.35; fx[i * 4 + 1] = 0; fx[i * 4 + 2] = x; fx[i * 4 + 3] = y;
  }
  g.scale(rx, ry, depth);
  // face along the surface normal, leaning toward the creature's front a
  // little, which is what makes a face read as looking at you
  const z = new Vector3(...normal).lerp(new Vector3(...fwd), 0.35).normalize();
  const x = new Vector3().crossVectors(new Vector3(0, 1, 0), z).normalize();
  const y = new Vector3().crossVectors(z, x).normalize();
  g.applyMatrix4(new Matrix4().makeBasis(x, y, z).setPosition(...center));
  const cc = new Color(col), n = p.count;
  g.setAttribute('color', new BufferAttribute(new Float32Array(n * 3).map((_, i) => [cc.r, cc.g, cc.b][i % 3]), 3));
  g.setAttribute('aFx', new BufferAttribute(fx, 4));
  return g;
}

// ---------------------------------------------------------------------------
// assembling a figurine from a design
// ---------------------------------------------------------------------------

const _hitN = new Vector3();

/** From inside the body, march out along `dir` to the surface. */
function surfaceAlong(F0, from, dir, maxLen) {
  const { B, shapes } = F0, ns = shapes.length;
  const d = new Vector3(...dir).normalize();
  const p = new Vector3(...from);
  const at = (t) => fieldDist(B, shapes, ns, p.x + d.x * t, p.y + d.y * t, p.z + d.z * t);
  let t = 0, prev = 0, s = at(0);
  for (let i = 0; i < 400 && s <= 0 && t < maxLen; i++) {
    prev = t;
    t += Math.max(2e-3, Math.abs(s) * 0.9);
    s = at(t);
  }
  // bisect to the crossing
  let a = prev, b = t;
  for (let i = 0; i < 24; i++) {
    const m = (a + b) / 2;
    at(m) < 0 ? a = m : b = m;
  }
  const hit = p.clone().addScaledVector(d, (a + b) / 2);
  gradient(B, shapes, ns, hit.x, hit.y, hit.z, 1e-3, _hitN);
  return { p: hit, n: _hitN.clone() };
}

/**
 * Build a design's geometry and bones, in design units. Returns buffers
 * ready to scale, and the joint positions.
 */
function* assembleGen(design, cells) {
  DETAIL = cells >= 30 ? 1 : 0.55;
  const bones = design.bones;
  const names = Object.keys(bones);
  const bix = new Map(names.map((n, i) => [n, i]));
  const bi = (name) => bix.get(name) ?? bix.get(design.fallbackBone || 'body') ?? 0;

  // parts, with mirrors made real
  const flipName = (n) => n && (/L$/.test(n) ? n.replace(/L$/, 'R') : /R$/.test(n) ? n.replace(/R$/, 'L') : n);
  const flipP = (v) => v && [-v[0], v[1], v[2]];
  const flipRot = (r) => r && [r[0], -(r[1] || 0), -(r[2] || 0)];
  const parts = [];
  for (const p of design.parts) {
    parts.push(p);
    if (p.mirror) parts.push({ ...p, mirror: false, p: flipP(p.p), a: flipP(p.a), b: flipP(p.b), rot: flipRot(p.rot), bone: flipName(p.bone) });
  }
  const F0 = compile(parts, bi);
  const body = yield* bakeBodyGen(design, F0, names.length, cells);
  DETAIL = cells >= 30 ? 1 : 0.55;

  // details
  const extra = [];
  const add = (g, bone, fxv = [0, 0, 9, 9]) => {
    if (!g.index) {
      const n = g.attributes.position.count;
      g.setIndex(Array.from({ length: n }, (_, i) => i));
    }
    const n = g.attributes.position.count;
    if (!g.attributes.aFx) {
      const fx = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) fx.set(fxv, i * 4);
      g.setAttribute('aFx', new BufferAttribute(fx, 4));
    }
    extra.push({ g, bone: bi(bone) });
  };
  const mirrorGeo = (g) => {
    const m = g.clone();
    m.applyMatrix4(new Matrix4().makeScale(-1, 1, 1));
    // a mirror turns every triangle inside out
    const ix = m.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    m.computeVertexNormals();
    return m;
  };
  for (const d of design.details || []) {
    const make = () => {
      switch (d.kind) {
        case 'horn': return sweep(d.a, d.b, d.bend, (t) => d.r * (1 - Math.pow(t, 1.15) * 0.93), { col0: d.c, col1: d.c1, sides: d.sides || 10, rings: d.rings || 10 });
        case 'tube': return sweep(d.a, d.b, d.bend, (t) => d.r * (1 - t * (1 - (d.taper ?? 1))), { col0: d.c, col1: d.c1, sides: d.sides || 8, rings: d.rings || 8 });
        case 'plate': return plate(d.shape, d.depth, d.place, { col: d.c, col1: d.c1, curl: d.curl, bevel: d.bevel });
        case 'crystal': return crystal(d.a, d.dir, d.len, d.r, d.c, d.c1);
        case 'flame': return flame(d.a, d.dir, d.len, d.r, d.c, d.c1, d.lean, d.side);
        case 'ball': return ball(d.p, d.r, d.c, d.sy);
        case 'ring': return ring(d.p, d.R, d.r, d.rot, d.c);
      }
      return null;
    };
    const fxv = [d.glow || 0, d.kind === 'flame' ? (d.flicker ?? 1) : 0, 9, 9];
    const g = make();
    if (!g) continue;
    add(g, d.bone, fxv);
    if (d.mirror) add(mirrorGeo(g), flipName(d.bone), fxv);
  }

  // eyes, set into the surface
  const E = design.eyes;
  if (E) {
    const fwd = E.fwd || [0, 0, 1];
    for (const side of [1, -1]) {
      const from = [E.at[0] * side * 0.25, E.at[1], E.at[2] * 0.6];
      const dir = [E.at[0] * side - from[0], E.at[1] - from[1], E.at[2] - from[2]];
      const hit = surfaceAlong(F0, from, dir, 5);
      const n = hit.n;
      const c = hit.p.clone().addScaledVector(n, -E.r * (E.sink ?? 0.28));
      const f = [fwd[0] + side * (E.splay ?? 0.18), fwd[1], fwd[2]];
      add(eyeLens([c.x, c.y, c.z], [n.x, n.y, n.z], f, E.r, E.r * (E.tall ?? 1.18), E.r * (E.depth ?? 0.5), E.iris), E.bone || 'head');
    }
  }
  return { body, extra, names, bones, F0 };
}

/** Run a resumable bake to the end, now. */
function finish(gen) {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}
const bakeBody = (design, F0, nb, cells) => finish(bakeBodyGen(design, F0, nb, cells));
const assemble = (design, cells) => finish(assembleGen(design, cells));

/** Everything into one skinned geometry. */
function merge(body, extra, scale, offset) {
  let nv = body.pos.length / 3, ni = body.index.length;
  for (const { g } of extra) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), fx = new Float32Array(nv * 4);
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const nb = body.pos.length / 3;
  pos.set(body.pos); nor.set(body.nor); col.set(body.col); fx.set(body.fx); si.set(body.si); sw.set(body.sw);
  index.set(body.index);
  let v = nb, k = body.index.length;
  for (const { g, bone } of extra) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, v * 3);
    nor.set(g.attributes.normal.array, v * 3);
    col.set(g.attributes.color.array, v * 3);
    fx.set(g.attributes.aFx.array, v * 4);
    for (let i = 0; i < n; i++) { si[(v + i) * 4] = bone; sw[(v + i) * 4] = 1; }
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i++) index[k + i] = ix[i] + v;
    v += n; k += ix.length;
  }
  for (let i = 0; i < nv; i++) {
    pos[i * 3] = (pos[i * 3] + offset[0]) * scale;
    pos[i * 3 + 1] = (pos[i * 3 + 1] + offset[1]) * scale;
    pos[i * 3 + 2] = (pos[i * 3 + 2] + offset[2]) * scale;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('color', new BufferAttribute(col, 3));
  g.setAttribute('aFx', new BufferAttribute(fx, 4));
  g.setAttribute('skinIndex', new BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new BufferAttribute(sw, 4));
  g.setIndex(new BufferAttribute(index, 1));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// the material: vinyl
// ---------------------------------------------------------------------------

/**
 * Painted vinyl: the colour in the vertices (occlusion already baked in), a
 * gloss the sun catches, a studio highlight and a soft rim that hold even
 * under a flat sky, glowing parts, flames that flicker, and the eyes.
 */
function vinyl(spec, u) {
  const m = new MeshStandardMaterial({
    vertexColors: true,
    roughness: spec.rough ?? 0.4,
    metalness: spec.metal ?? 0,
    envMapIntensity: spec.env ?? 0.85,
  });
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aFx; varying vec4 vFx; uniform float uTime, uFlame;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFx = aFx;
        if (aFx.y > 0.0) {
          float fl = sin(uTime * 9.0 + position.y * 23.0 + position.x * 11.0) * 0.6 + sin(uTime * 14.0 - position.z * 17.0) * 0.4;
          transformed += objectNormal * fl * uFlame * aFx.y;
        }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vFx; uniform float uBlink, uGlow, uRim, uSpec, uEyeStyle, uEyeGlow; uniform vec3 uLid;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float eyeLit = 0.0;
        if (vFx.z < 4.0) {
          vec2 e = vFx.zw;
          vec3 iris = diffuseColor.rgb, c;
          if (uEyeStyle < 0.5) {
            // dark at the top, the iris colour rising from below, a pupil
            c = mix(iris * 0.16, iris * 1.05, smoothstep(0.6, -0.8, e.y));
            float pr = length((e - vec2(0.0, -0.06)) * vec2(1.05, 0.88));
            c = mix(c, iris * 0.05, smoothstep(0.44, 0.36, pr));
          } else if (uEyeStyle < 1.5) {
            // a white eye with an iris
            float r = length(e * vec2(1.0, 0.92) - vec2(0.02, -0.06));
            c = mix(vec3(0.96, 0.97, 1.0), iris, smoothstep(0.64, 0.58, r));
            c = mix(c, iris * 0.07, smoothstep(0.32, 0.26, r));
          } else {
            c = iris * 1.15;
            eyeLit = 0.9;
          }
          c *= mix(0.62, 1.0, smoothstep(1.0, 0.78, length(e)));
          float h1 = smoothstep(0.25, 0.17, length(e - vec2(-0.3, 0.38)));
          float h2 = smoothstep(0.11, 0.06, length(e - vec2(0.3, -0.36)));
          c = mix(c, vec3(1.0), max(h1, h2 * 0.9));
          eyeLit = max(eyeLit, max(h1, h2));
          float lid = step(1.0 - 2.15 * uBlink, e.y);
          c = mix(c, uLid, lid);
          eyeLit *= 1.0 - lid;
          diffuseColor.rgb = c;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (vFx.z < 4.0) totalEmissiveRadiance += diffuseColor.rgb * (0.16 + eyeLit * 0.75 + uEyeGlow);
        else if (vFx.y > 0.0) {
          // fire lights itself: most of its colour is its own, not the sun's
          totalEmissiveRadiance += diffuseColor.rgb * (0.85 + 0.25 * vFx.x);
          diffuseColor.rgb *= 0.3;
        }
        else totalEmissiveRadiance += diffuseColor.rgb * vFx.x * uGlow;
        {
          vec3 Vv = normalize(vViewPosition);
          float ndv = max(dot(normal, Vv), 0.0);
          totalEmissiveRadiance += (diffuseColor.rgb * 0.55 + vec3(0.45)) * pow(1.0 - ndv, 3.0) * uRim;
          vec3 Hk = normalize(normalize(vec3(-0.45, 0.75, 0.55)) + Vv);
          totalEmissiveRadiance += vec3(pow(max(dot(normal, Hk), 0.0), 64.0) * uSpec);
        }`);
  };
  m.customProgramCacheKey = () => 'vinyl';
  return m;
}

/** A dark shell pushed out along the normals after skinning: the outline. */
function shellMaterial(thickness) {
  const m = new MeshBasicMaterial({ color: 0x1a1426, side: BackSide, transparent: true, opacity: 0.85, depthWrite: false });
  m.onBeforeCompile = (s) => {
    s.uniforms.uThickness = { value: thickness };
    // no outline round fire: it is drawn inside the flame instead of outside
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uThickness; attribute vec4 aFx;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n\ttransformed += objectNormal * uThickness * (aFx.y > 0.0 ? -2.0 : 1.0);');
  };
  m.customProgramCacheKey = () => 'fig-shell';
  return m;
}

// ---------------------------------------------------------------------------
// templates and instances
// ---------------------------------------------------------------------------

const TEMPLATES = new Map();

/**
 * Bake a design, scaled so its longest side is `size` metres, feet on the
 * ground. The coarse mesh is baked at once — it is quick, and it is what a
 * creature across a field needs — and the fine one is baked in a quiet moment
 * soon after, or right away when something close up asks for it (a battle, a
 * portrait). Cached for the session.
 */
function template(id, design, needHi = false) {
  let T = TEMPLATES.get(id);
  if (!T) {
    const lo = assemble(design, design.cellsLo ?? 20);
    const p = lo.body.pos;
    const box = { lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] };
    const grow = (x, y, z) => {
      box.lo[0] = Math.min(box.lo[0], x); box.lo[1] = Math.min(box.lo[1], y); box.lo[2] = Math.min(box.lo[2], z);
      box.hi[0] = Math.max(box.hi[0], x); box.hi[1] = Math.max(box.hi[1], y); box.hi[2] = Math.max(box.hi[2], z);
    };
    for (let i = 0; i < p.length; i += 3) grow(p[i], p[i + 1], p[i + 2]);
    for (const { g } of lo.extra) {
      const a = g.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) grow(a[i], a[i + 1], a[i + 2]);
    }
    const dims = [box.hi[0] - box.lo[0], box.hi[1] - box.lo[1], box.hi[2] - box.lo[2]];
    const scale = (design.size || 1) / Math.max(...dims);
    const offset = [-(box.lo[0] + box.hi[0]) / 2, -box.lo[1], -(box.lo[2] + box.hi[2]) / 2 + (design.shiftZ || 0)];
    const joints = lo.names.map((n) => {
      const [x, y, z] = lo.bones[n];
      return new Vector3((x + offset[0]) * scale, (y + offset[1]) * scale, (z + offset[2]) * scale);
    });
    T = {
      id, design, names: lo.names, parents: lo.names.map((n) => lo.bones[n][3] ?? null), joints,
      geoLo: merge(lo.body, lo.extra, scale, offset), geoHi: null,
      height: dims[1] * scale, size: design.size || 1, scale, offset,
    };
    for (const { g } of lo.extra) g.dispose();
    TEMPLATES.set(id, T);
    if (!needHi) later(T);
  }
  if (needHi && !T.geoHi) bakeHi(T);
  return T;
}

function bakeHi(T) {
  if (T.geoHi) return;
  finishHi(T, assemble(T.design, T.design.cells ?? 44));
}

function finishHi(T, hi) {
  if (T.geoHi) { for (const { g } of hi.extra) g.dispose(); return; }
  T.geoHi = merge(hi.body, hi.extra, T.scale, T.offset);
  for (const { g } of hi.extra) g.dispose();
}

// The fine meshes still to bake. Each is baked a few milliseconds at a time
// between frames — a whole one at once is a dropped frame or three on a
// phone, and they are always wanted just as a zone has loaded.
const QUEUE = [];
let pumping = false, current = null;
const SLICE_MS = 5;
function later(T) {
  QUEUE.push(T);
  if (pumping) return;
  pumping = true;
  const tick = () => {
    const t0 = performance.now();
    while (performance.now() - t0 < SLICE_MS) {
      if (!current) {
        const T2 = QUEUE.shift();
        if (!T2) { pumping = false; return; }
        if (T2.geoHi) continue;
        current = { T: T2, gen: assembleGen(T2.design, T2.design.cells ?? 44) };
      }
      const r = current.gen.next();
      if (r.done) { finishHi(current.T, r.value); current = null; }
    }
    setTimeout(tick, 12);
  };
  setTimeout(tick, 100);
}

/** Bake a species now, both meshes, so nothing waits later (a battle's two). */
function warmFigurine(id, design) {
  template(id, design, true);
}

/** Bones at the design's joints. The first is the root; a bone that names no
 *  parent hangs from it. */
function skeletonFor(T) {
  const list = T.names.map((n) => { const b = new Bone(); b.name = n; return b; });
  const root = list[0];
  root.position.copy(T.joints[0]);
  for (let i = 1; i < list.length; i++) {
    let pi = T.parents[i] != null ? T.names.indexOf(T.parents[i]) : 0;
    if (pi < 0) pi = 0;
    list[pi].add(list[i]);
    list[i].position.copy(T.joints[i]).sub(T.joints[pi]);
  }
  return { list, root };
}

/**
 * A figurine, ready to stand in the world: a holder carrying one skinned mesh
 * (and its outline). The model record it returns is what the animator drives.
 */
function instance(id, design, { outline = true, hi = false } = {}) {
  const T = template(id, design, hi);
  const { list, root } = skeletonFor(T);
  const skeleton = new Skeleton(list);
  const u = {
    uTime: { value: 0 },
    uBlink: { value: 0 },
    uLid: { value: new Color(design.lid ?? 0xffffff) },
    uGlow: { value: design.glowK ?? 1.5 },
    uFlame: { value: (design.flameAmp ?? 0.018) * T.size },
    uRim: { value: design.rim ?? 0.26 },
    uSpec: { value: design.spec ?? 0.2 },
    uEyeStyle: { value: design.eyeStyle ?? 0 },
    uEyeGlow: { value: design.eyeGlow ?? 0 },
  };
  const mat = vinyl(design, u);
  const geo = T.geoHi || T.geoLo;
  const mesh = new SkinnedMesh(geo, mat);
  mesh.add(root);
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  const bs = geo.boundingSphere.clone();
  bs.radius *= 1.3;
  mesh.boundingSphere = bs;
  const holder = new Group();
  holder.add(mesh);
  let shell = null;
  if (outline) {
    shell = new SkinnedMesh(geo, shellMaterial((design.outline ?? 0.0075) * T.size));
    shell.bind(skeleton, mesh.bindMatrix);
    shell.renderOrder = -1;
    shell.castShadow = false;
    shell.userData.noOutline = true;
    shell.boundingSphere = bs;
    holder.add(shell);
  }
  const bones = Object.fromEntries(list.map((b) => [b.name, b]));
  const rest = Object.fromEntries(list.map((b) => [b.name, { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }]));
  return {
    holder,
    model: {
      fig: true, def: design, T, mesh, shell, skeleton, bones, rest, u, holder,
      height: T.height, size: T.size,
      phase: Math.random() * Math.PI * 2, gait: 0, blend: 0, last: null,
      blinkAt: 1 + Math.random() * 3, far: false,
    },
  };
}

/** The coarse mesh far away (and until the fine one is baked), no outline. */
function setFigurineLod(m, far) {
  const want = !far && m.T.geoHi ? m.T.geoHi : m.T.geoLo;
  if (m.mesh.geometry !== want) {
    m.mesh.geometry = want;
    if (m.shell) m.shell.geometry = want;
  }
  if (m.shell) m.shell.visible = !far;
  m.far = far;
}

// ---------------------------------------------------------------------------
// the animator
// ---------------------------------------------------------------------------

const _q = new Quaternion(), _axis = new Vector3();

function rot(b, x, y, z) {
  if (!b) return;
  if (x) b.quaternion.multiply(_q.setFromAxisAngle(_axis.set(1, 0, 0), x));
  if (y) b.quaternion.multiply(_q.setFromAxisAngle(_axis.set(0, 1, 0), y));
  if (z) b.quaternion.multiply(_q.setFromAxisAngle(_axis.set(0, 0, 1), z));
}

/**
 * Bring a figurine to life from how it is moving. Every design names its
 * bones from one vocabulary — body, head, ears, a tail chain, legs, arms,
 * wings, fins, antennae, a spine chain — and this drives whatever is there.
 */
function animateFigurine(group, m, timeMs, moving, speed = 1) {
  const dt = m.last == null ? 0.016 : Math.min(0.1, Math.max(0, (timeMs - m.last) * 0.001));
  m.last = timeMs;
  const t = timeMs * 0.001 + m.phase;
  const B = m.bones, R = m.rest, plan = m.def.plan || 'quad';
  for (const n in B) {
    const b = B[n], r = R[n];
    b.position.copy(r.p); b.quaternion.copy(r.q); b.scale.copy(r.s);
  }
  const gs = group.userData.groundSpeed;
  const H = m.height || 1;
  const run = gs != null ? gs > 1.7 * H : speed > 1.6;
  m.blend += Math.max(-1, Math.min(1, (moving ? 1 : 0) - m.blend)) * Math.min(1, dt * 7);
  const k = m.blend, idle = 1 - k;
  const pace = (run ? 9.5 : 6.4) * speed;
  const rate = gs != null && moving ? Math.min(pace * 2.2, Math.max(pace * 0.6, Math.PI * 2 * gs / (1.15 * H))) : pace;
  m.gait += dt * rate;
  const p = m.gait;
  const amp = (run ? 0.8 : 0.55) * k;
  const lively = m.def.lively ?? 1;

  // breathing, and a body that bobs on its steps
  const breathe = Math.sin(t * 1.9);
  if (B.body) {
    B.body.scale.set(1 + breathe * 0.012 * lively, 1 - breathe * 0.01 * lively, 1 + breathe * 0.012 * lively);
    B.body.position.y += Math.abs(Math.sin(p)) * H * 0.03 * k;
    rot(B.body, -0.06 * k * (run ? 1.6 : 1) + Math.sin(p * 2) * 0.025 * k, Math.sin(t * 0.7) * 0.05 * idle, Math.sin(p) * 0.04 * k);
  }
  if (B.chest) rot(B.chest, 0, Math.sin(t * 0.9) * 0.05 * idle, 0);
  // the head: looks about when standing, leads and nods when walking
  if (B.head) {
    const look = Math.sin(t * 0.43) * 0.28 + Math.sin(t * 1.13) * 0.08;
    rot(B.head, Math.sin(t * 0.61) * 0.08 * idle + Math.sin(p * 2 + 0.6) * 0.06 * k + 0.05 * k,
      look * idle * (m.def.lookK ?? 1), Math.sin(t * 0.37) * 0.07 * idle);
  }
  if (B.jaw) rot(B.jaw, Math.max(0, Math.sin(t * 0.8)) * 0.08, 0, 0);
  // ears flick now and then
  const flick = Math.pow(Math.max(0, Math.sin(t * 0.9 + 1.3)), 24);
  for (const [n, s] of [['earL', 1], ['earR', -1]]) if (B[n]) rot(B[n], Math.sin(t * 2.1 + s) * 0.04, 0, s * (flick * 0.35 + Math.sin(p * 2) * 0.08 * k));
  for (const [n, s] of [['antL', 1], ['antR', -1]]) if (B[n]) rot(B[n], Math.sin(t * 3.1 + s) * 0.12, 0, s * Math.sin(t * 2.3) * 0.08);
  // tail chains: a wave down the chain
  for (let c = 0; c < 3; c++) {
    const base = c === 0 ? 'tail' : c === 1 ? 'tailB' : 'tailC';
    for (let i = 0; i < 6; i++) {
      const b = B[i === 0 ? base : base + (i + 1)];
      if (!b) break;
      const w = Math.sin(t * (2.2 + c * 0.3) + p * 0.5 - i * 0.7 + c) * (0.16 + 0.1 * k) * (m.def.tailK ?? 1);
      rot(b, Math.sin(t * 1.3 - i * 0.5) * 0.06, w, 0);
    }
  }
  // a spine chain, for serpents and fish: the swim
  for (let i = 1; i <= 8; i++) {
    const b = B['seg' + i];
    if (!b) break;
    rot(b, Math.sin(t * 1.4 - i * 0.6) * 0.05, Math.sin(t * (moving ? 5.2 : 2.2) - i * 0.85) * (0.12 + 0.12 * k), 0);
  }
  // legs
  if (plan === 'quad') {
    for (const [n, ph] of [['legFL', 0], ['legFR', Math.PI], ['legBL', Math.PI], ['legBR', 0]]) {
      if (!B[n]) continue;
      rot(B[n], Math.sin(p + ph) * amp + Math.sin(t * 1.3 + ph) * 0.02 * idle, 0, 0);
      const low = B[n.replace('leg', 'shin')];
      if (low) rot(low, Math.max(0, -Math.sin(p + ph + 0.9)) * amp * 0.9, 0, 0);
    }
  } else {
    for (const [n, ph] of [['legL', 0], ['legR', Math.PI]]) {
      if (!B[n]) continue;
      rot(B[n], Math.sin(p + ph) * amp * 0.9, 0, 0);
      const low = B[n.replace('leg', 'shin')];
      if (low) rot(low, Math.max(0, -Math.sin(p + ph + 0.9)) * amp, 0, 0);
    }
  }
  // arms: counter-swing, and a little life when standing
  for (const [n, s, ph] of [['armL', 1, Math.PI], ['armR', -1, 0]]) {
    if (!B[n]) continue;
    rot(B[n], Math.sin(p + ph) * amp * 0.7 + Math.sin(t * 1.7 + s) * 0.08 * idle, 0, s * (Math.sin(t * 1.2) * 0.06 * idle + 0.05 * k));
  }
  // wings: flying things flap; the rest settle them and stretch now and then
  const flies = m.def.flies;
  const flap = flies ? Math.sin(t * (moving ? 9 : 5.5)) : Math.sin(t * 1.4) * 0.25 + Math.pow(Math.max(0, Math.sin(t * 0.5)), 30) * 1.2;
  for (const [n, s] of [['wingL', 1], ['wingR', -1]]) {
    if (!B[n]) continue;
    rot(B[n], 0, 0, s * flap * (flies ? 0.55 : 0.3));
    const tip = B[n + '2'];
    if (tip) rot(tip, 0, 0, s * flap * 0.3);
  }
  for (const [n, s] of [['finL', 1], ['finR', -1]]) if (B[n]) rot(B[n], 0, Math.sin(t * 3 + s) * 0.18 * s, s * Math.sin(t * 2.2) * 0.12);
  if (B.crest) rot(B.crest, Math.sin(t * 1.7) * 0.05, 0, Math.sin(t * 1.1) * 0.06);
  if (B.orb) { B.orb.position.y += Math.sin(t * 2.1) * H * 0.03; rot(B.orb, 0, t * 0.8 % (Math.PI * 2), 0); }

  // flying and swimming things hover
  const base = group.userData.baseY || 0;
  if (flies || m.def.floats || group.userData.floats) group.position.y = base + H * (m.def.hover ?? 0.16) + Math.sin(t * 1.6) * H * 0.045;
  else group.position.y = base;
  // the little round ones hop now and then when they are standing about
  if (m.def.hop && idle > 0.4) {
    const hp = (t * 0.75) % 4.2;
    if (hp < 0.5) {
      const u = hp / 0.5;
      group.position.y += Math.sin(u * Math.PI) * H * 0.14 * idle;
      if (B.body) B.body.scale.y *= 1 + Math.sin(u * Math.PI * 2) * 0.07 * idle;
    }
  }
  m.holder.rotation.z = Math.sin(p) * 0.025 * k;

  // blink: a quick close and open every few seconds, now and then twice
  m.blinkAt -= dt;
  let bl = 0;
  if (m.blinkAt < 0) {
    const s = -m.blinkAt;
    bl = s < 0.07 ? s / 0.07 : s < 0.16 ? 1 - (s - 0.07) / 0.09 : 0;
    if (s > 0.16) m.blinkAt = Math.random() < 0.2 ? 0.12 : 2.2 + Math.random() * 3.5;
  }
  m.u.uBlink.value = bl;
  m.u.uTime.value = t;
  return true;
}

export {
  SPHERE, ELLIPSOID, CONE, BOX, TORUS, UNION, CARVE, PAINT, compile, fieldDist, bakeBody, gradient,
  assemble, merge, surfaceAlong, template, instance, setFigurineLod, animateFigurine, warmFigurine, TEMPLATES,
};
