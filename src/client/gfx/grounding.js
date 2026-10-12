// Things standing on the ground, not floating over it.
//
// Two halves, both baked once per zone and read in the shaders, so they cost
// a texture fetch rather than a pass:
//
//  - The contact map. A soft dark pool on the ground under and around
//    everything that stands on it — a house, a tree, a rock, a bench — drawn
//    from the colliders the server already knows (shared/props.js). It is the
//    ambient occlusion a real renderer would find where a wall meets the
//    earth, and it is what stops a cottage reading as a box set on a rug.
//
//  - The foot of every object. The bottom of a wall, a trunk, a rock, a post
//    is darker than its top: less sky reaches it, and the ground bounces less
//    than the sky gives. Each world material learns how high a fragment is
//    above the ground under it — baked into merged geometry as `aGroundY`, or
//    for an instanced or placed object, the height of its own origin — and
//    darkens the last stretch above it.
import { BufferAttribute, CanvasTexture, Color, DataTexture, InstancedMesh, LinearFilter, Object3D, RGBAFormat, SphereGeometry } from 'three';

export const GROUNDING = {
  contact: 0.68,     // how dark the pool under a thing gets (0..1 of the ground's colour)
  footH: 1.1,        // metres above the ground the foot shading reaches
  foot: 0.6,         // brightness at the very bottom
  mapPx: 1024,       // contact map resolution, across the whole zone
};

let WHITE = null;
/** A one-pixel white texture: "nothing is standing here". */
export function noContact() {
  if (WHITE) return WHITE;
  WHITE = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  WHITE.needsUpdate = true;
  return WHITE;
}

/**
 * The contact map for a zone `size` metres across: white where the ground is
 * open, darker under and around each collider. Circles (`r`) for trees and
 * rocks, turned rectangles (`hw`, `hd`, `rot`) for buildings and benches.
 */
export function contactMap(colliders, size, extra = []) {
  if (typeof document === 'undefined') return noContact();
  const px = GROUNDING.mapPx, k = px / size, c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, px, px);
  const at = (x, z) => [(x + size / 2) * k, (z + size / 2) * k];
  // A blurred ellipse is the pool; drawn as a radial gradient, so it costs
  // nothing to blur and keeps its soft edge at any size.
  const pool = (x, z, rx, rz, rot, dark) => {
    const [cx, cy] = at(x, z), R = Math.max(rx, rz) * k;
    if (R < 0.8) return;
    g.save();
    g.translate(cx, cy);
    g.rotate(rot || 0);
    g.scale(rx / Math.max(rx, rz), rz / Math.max(rx, rz));
    const gr = g.createRadialGradient(0, 0, R * 0.15, 0, 0, R);
    gr.addColorStop(0, `rgba(0,0,0,${dark})`);
    gr.addColorStop(0.55, `rgba(0,0,0,${dark * 0.55})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  // a wall's own line of shadow where it meets the ground: tight and darker
  const sill = (x, z, hw, hd, rot, dark) => {
    const [cx, cy] = at(x, z), m = 0.55 * k;
    g.save();
    g.translate(cx, cy);
    g.rotate(rot || 0);
    g.filter = `blur(${Math.max(1, m * 0.9)}px)`;
    g.fillStyle = `rgba(0,0,0,${dark})`;
    g.fillRect(-hw * k - m, -hd * k - m, (hw * 2) * k + m * 2, (hd * 2) * k + m * 2);
    g.restore();
  };
  for (const o of [...colliders, ...extra]) {
    if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.z)) continue;
    if (o.kind === 'water' || o.kind === 'edge' || o.kind === 'cliff') continue;
    if (Number.isFinite(o.r)) {
      // a trunk or a stone: a round pool a good deal wider than it
      pool(o.x, o.z, o.r * 2.1 + 0.5, o.r * 2.1 + 0.5, 0, 0.5);
    } else if (Number.isFinite(o.hw) && Number.isFinite(o.hd)) {
      const big = Math.max(o.hw, o.hd) > 2;
      // canvas y runs with world z; a collider's rot turns its box the same
      // way a canvas turn does (shared/props.js resolveCollision)
      const rot = o.rot || 0;
      big && sill(o.x, o.z, o.hw, o.hd, rot, 0.55);
      pool(o.x, o.z, o.hw + (big ? 1.6 : 0.7), o.hd + (big ? 1.6 : 0.7), rot, big ? 0.34 : 0.3);
    }
  }
  const t = new CanvasTexture(c);
  t.minFilter = t.magFilter = LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/**
 * Bake the ground's height under every vertex of a static mesh, in world
 * space, as `aGroundY` (stored + 1000 so that a geometry without it — read
 * as 0 — is told apart). Geometry is assumed already placed (merged meshes).
 */
export function bakeGroundY(mesh, height) {
  const geo = mesh.geometry, pos = geo?.attributes?.position;
  if (!pos || geo.attributes.aGroundY) return;
  mesh.updateWorldMatrix(true, false);
  const e = mesh.matrixWorld.elements, out = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const wx = e[0] * x + e[4] * y + e[8] * z + e[12], wz = e[2] * x + e[6] * y + e[10] * z + e[14];
    out[i] = height(wx, wz) + 1000;
  }
  geo.setAttribute('aGroundY', new BufferAttribute(out, 1));
}

const VERT_DECL = `
attribute float aGroundY;
varying float vAbove;`;
const VERT_BODY = `
{
  #ifdef USE_INSTANCING
    vec4 gW = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
    float gY = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;
  #else
    vec4 gW = modelMatrix * vec4(transformed, 1.0);
    float gY = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).y;
  #endif
  if (aGroundY > 500.0) gY = aGroundY - 1000.0;
  vAbove = gW.y - gY;
}`;
const FRAG_DECL = `
varying float vAbove;
uniform float uFootH, uFoot;`;
const FRAG_BODY = `
{
  // the foot of a thing: darker, and a touch cooler, toward the ground
  float gf = 1.0 - smoothstep(0.0, uFootH, max(vAbove, 0.0));
  gf *= gf;
  diffuseColor.rgb *= mix(1.0, uFoot, gf);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.92, 0.96, 1.08), gf * 0.5);
}`;

const FOOT_U = { uFootH: { value: GROUNDING.footH }, uFoot: { value: GROUNDING.foot } };

/** Teach one material the foot shading. Chains any shader edit it already has. */
export function groundMaterial(m) {
  if (!m || m.userData?.grounded || m.isMeshBasicMaterial || m.isShaderMaterial || m.isPointsMaterial || m.isSpriteMaterial || m.isLineBasicMaterial) return;
  if (m.transparent && m.opacity < 0.98) return;
  if (!(m.isMeshToonMaterial || m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial)) return;
  m.userData.grounded = true;
  const prev = m.onBeforeCompile, prevKey = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null;
  m.onBeforeCompile = function (s, r) {
    prev && prev.call(this, s, r);
    Object.assign(s.uniforms, FOOT_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>${VERT_DECL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${VERT_BODY}`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>${FRAG_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>${FRAG_BODY}`);
  };
  // the key has to tell apart every edit chained under this one
  m.customProgramCacheKey = function () { return `${prevKey ? prevKey.call(this) : prev ? prev.toString() : ''}|grounded`; };
  m.needsUpdate = true;
}

/**
 * Snow banked against what stands in it: low drifts along a wall, a ring
 * round a trunk, a cap of drift against a stone. In a snowfield a cabin set
 * straight onto a flat white sheet reads as a model on a tablecloth; the
 * drift is what says the snow fell around it. One instanced mesh.
 */
export function snowBanks(colliders, boxes, height, material, half, groundHex = 0xC8D8EE) {
  const spots = [];
  let seed = 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const o of colliders) {
    if (!Number.isFinite(o?.x) || !Number.isFinite(o?.r) || Math.abs(o.x) > half || Math.abs(o.z) > half) continue;
    // a trunk or a stone, not a whole hill or the zone's rim
    if (o.r < 0.2 || o.r > 1.8 || (o.kind && o.kind !== 'tree' && o.kind !== 'rock' && o.kind !== 'structure')) continue;
    // a drift or two against it, heaped on the windward side
    const n = o.r > 0.8 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = 0.9 + (i - (n - 1) / 2) * 1.3 + rnd() * 0.5, d = o.r * 0.7;
      spots.push([o.x + Math.cos(a) * d, o.z + Math.sin(a) * d, Math.min(1.4, o.r * 0.9 + 0.35), 0.1 + Math.min(0.14, o.r * 0.08) + rnd() * 0.05, a]);
    }
  }
  for (const b of boxes) {
    if (!Number.isFinite(b?.x) || !(b.hw > 0.5) || !(b.hd > 0.5)) continue;
    const c = Math.cos(b.rot || 0), sn = Math.sin(b.rot || 0);
    // along each wall, drifts a metre or so long, pushed out from it a little
    for (const [ex, ez, len, nx, nz] of [[0, b.hd, b.hw, 0, 1], [0, -b.hd, b.hw, 0, -1], [b.hw, 0, b.hd, 1, 0], [-b.hw, 0, b.hd, -1, 0]]) {
      const n = Math.max(2, Math.round(len * 2 / 1.5));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n * 2 - 1, lx = ex + (nz !== 0 ? t * len : 0) + nx * 0.25, lz = ez + (nx !== 0 ? t * len : 0) + nz * 0.25;
        // local box frame to world: the collider's turn (shared/props.js)
        const wx = b.x + lx * c - lz * sn, wz = b.z + lx * sn + lz * c;
        spots.push([wx, wz, 0.95 + rnd() * 0.45, 0.17 + rnd() * 0.12, -(b.rot || 0) + (nz !== 0 ? 0 : Math.PI / 2)]);
      }
    }
  }
  if (!spots.length) return null;
  // the drift fades from the snowfield's own colour at its foot to fresh
  // white on its crest, so it rises out of the ground instead of sitting on it
  const geo = new SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const base = new Color(groundHex), top = new Color(0xF6FAFF), pos = geo.attributes.position, col = new Float32Array(pos.count * 3), cc = new Color();
  for (let i = 0; i < pos.count; i++) {
    cc.copy(base).lerp(top, Math.min(1, Math.pow(Math.max(0, pos.getY(i)), 0.6) * 1.1));
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const mesh = new InstancedMesh(geo, material, spots.length), o = new Object3D();
  spots.forEach(([x, z, r, h, rot], i) => {
    o.position.set(x, height(x, z) - 0.06, z);
    o.rotation.set(0, rot, 0);
    o.scale.set(r * 1.35, h, r * 0.85);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  });
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.noGround = true;
  return mesh;
}
