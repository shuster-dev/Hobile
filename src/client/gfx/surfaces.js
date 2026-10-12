// What things are made of.
//
// Everything in the world is a shape with a flat colour, cel-shaded: a log
// wall and a plaster one differed only in hue, and up close nothing had a
// surface. This gives each material its own — grain in wood, courses and
// mortar in stone, rows of tiles on a roof, straw in thatch, a crust and a
// glitter in snow — drawn in the shader from the world position, so it costs
// no texture to download and never stretches. The pattern is worked into the
// colour before the cel ramp, so it reads as part of the toon look, not as a
// photo stuck on it; and it fades out past the middle distance, where it
// would only shimmer.
//
// Which surface a part is comes from its colour (surfaceOf), or a builder
// says (Kit.add's `surf`). It travels with the geometry in the `tangent`
// attribute — xyz the way its grain runs, w the surface — because three
// turns `tangent` with the geometry on every transform and merge, so the
// grain of a plank still runs along the plank once it is turned, placed and
// merged into a zone.
import { BufferAttribute } from 'three';

export const SURF = { plain: 0, wood: 1, stone: 2, thatch: 3, roof: 4, plaster: 5, snow: 6, metal: 7, rock: 8, bark: 9, painted: 10 };

/** The surface a colour most likely is: brown is wood, grey is stone, cool white is snow. */
export function surfaceOf(hex) {
  if (typeof hex !== 'number') return SURF.plain;
  // in the colour as written (sRGB), not three's linear working space
  const r = (hex >> 16 & 255) / 255, g = (hex >> 8 & 255) / 255, b = (hex & 255) / 255,
    mx = Math.max(r, g, b), mn = Math.min(r, g, b), chroma = mx - mn, lum = (mx + mn) / 2;
  let deg = 0;
  if (chroma > 1e-6) {
    deg = mx === r ? ((g - b) / chroma) % 6 : mx === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
    deg = (deg * 60 + 360) % 360;
  }
  // (chroma, not HSL saturation: a white is "fully saturated" in HSL terms
  // the moment it leans a percent towards blue)
  if (lum > 0.84 && chroma < 0.14) return b >= r - 0.01 ? SURF.snow : SURF.plaster;
  if (chroma < 0.1 && lum > 0.2) return SURF.stone;
  if (chroma < 0.12 && lum <= 0.2) return SURF.metal;
  if (deg >= 36 && deg <= 56 && chroma > 0.3 && lum > 0.5) return SURF.thatch;
  if (deg >= 8 && deg <= 45 && chroma >= 0.1 && chroma <= 0.65 && lum >= 0.1 && lum <= 0.62) return SURF.wood;
  return SURF.plain;
}

/**
 * Write the surface and the grain into a geometry, before it is turned and
 * placed. `grain` is a local axis (x/y/z) or, by default, the longest side
 * of the part — the way a plank, a post or a beam runs.
 */
export function tagSurface(geo, surf, grain = null) {
  const pos = geo.attributes.position;
  if (!pos) return geo;
  let ax = grain;
  if (!ax) {
    geo.computeBoundingBox();
    const b = geo.boundingBox, dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
    ax = dx >= dy && dx >= dz ? 'x' : dy >= dz ? 'y' : 'z';
  }
  const v = ax === 'x' ? [1, 0, 0] : ax === 'y' ? [0, 1, 0] : [0, 0, 1];
  const n = pos.count, t = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { t[i * 4] = v[0]; t[i * 4 + 1] = v[1]; t[i * 4 + 2] = v[2]; t[i * 4 + 3] = surf; }
  geo.setAttribute('tangent', new BufferAttribute(t, 4));
  return geo;
}

const NOISE = `
float sfH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sfH3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float sfN(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(sfH(i), sfH(i + vec2(1.0, 0.0)), u.x), mix(sfH(i + vec2(0.0, 1.0)), sfH(i + vec2(1.0, 1.0)), u.x), u.y);
}
float sfF(vec2 p) { return sfN(p) * 0.55 + sfN(p * 2.03 + 7.1) * 0.3 + sfN(p * 4.1 + 3.3) * 0.15; }
// the edge between cells: 0 on a joint, 1 in the middle of a stone
vec2 sfCell(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = vec2(sfH(i + g), sfH(i + g + 17.3)) * 0.8 + 0.1;
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = sfH(i + g + 3.1); } else if (d < d2) d2 = d;
  }
  return vec2(d2 - d1, id);
}
// two world axes across a face: the plane the face mostly lies in
vec2 sfPlane(vec3 p, vec3 n) {
  vec3 a = abs(n);
  return a.y > a.x && a.y > a.z ? p.xz : a.x > a.z ? p.zy : p.xy;
}`;

const BODY = `
{
  float sId = floor(vSurf.w + 0.5);
  float sDist = length(vSW - cameraPosition);
  float sNear = 1.0 - smoothstep(26.0, 58.0, sDist);
  // fine detail (fibres, grit) only up close: further off it would only shimmer
  float sFine = 1.0 - smoothstep(9.0, 22.0, sDist);
  if (sId > 0.5 && sNear > 0.0) {
    vec3 N = normalize(vSN), G = normalize(vSurf.xyz + vec3(1e-4));
    // the end of a plank or a post faces along its grain: run it up the face
    // there, rather than have no direction across it at all
    if (abs(dot(G, N)) > 0.7) G = abs(N.y) < 0.7 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 c = diffuseColor.rgb;
    float k = 1.0;
    if (sId < 1.5 || sId > 8.5) {
      // wood and bark: fibres along the grain, boards of slightly different
      // tone side by side, a darker line between them, now and then a knot
      vec3 A = normalize(cross(G, N) + vec3(1e-4));
      float u = dot(vSW, G), v = dot(vSW, A);
      bool bark = sId > 8.5 && sId < 9.5;
      // painted boards: the boards and their seams, the grain under the paint faint
      float paint = sId > 9.5 ? 0.35 : 1.0;
      float board = floor(v / (bark ? 0.11 : 0.24));
      float fib = sfN(vec2(v * (bark ? 9.0 : 16.0) + sfN(vec2(u * 0.7, board)) * 3.0, u * (bark ? 1.2 : 0.6)));
      k *= 1.0 + (fib - 0.5) * 0.22 * sFine * paint;
      // the long streaks of the grain, which still read from further away
      k *= 1.0 + (sfN(vec2(v * 5.0, u * 0.25 + board * 7.0)) - 0.5) * 0.14 * paint;
      k *= 1.0 + (sfH(vec2(board, 3.0)) - 0.5) * 0.18 * mix(0.5, 1.0, paint);
      float seam = abs(fract(v / (bark ? 0.11 : 0.24)) - 0.5) * 2.0;
      // a board's edge is a thin dark line; bark's furrows are wide
      k *= bark ? 0.78 + 0.22 * smoothstep(0.1, 0.75, 1.0 - seam) : 0.8 + 0.2 * smoothstep(0.0, 0.08, 1.0 - seam);
      float knot = smoothstep(0.08, 0.0, length(vec2(fract(u * 0.55) - 0.5, (fract(v / 0.24) - 0.5) * 2.4))) * step(0.82, sfH(vec2(floor(u * 0.55), board)));
      k *= 1.0 - knot * 0.35 * (bark ? 0.0 : paint);
    } else if (sId < 2.5) {
      // dressed stone: courses and joints, each block its own shade
      vec2 q = sfPlane(vSW, N) * vec2(2.2, 3.0);
      q.x += floor(q.y) * 0.5;
      vec2 f = abs(fract(q) - 0.5) * 2.0;
      float joint = smoothstep(0.86, 0.96, max(f.x, f.y));
      float tone = sfH(floor(q));
      k *= (0.88 + tone * 0.2) * (0.9 + sfN(q * 3.1) * 0.16);
      k *= 1.0 - joint * 0.42;
    } else if (sId < 3.5) {
      // thatch: straw down the slope, in bundles
      vec3 A = normalize(cross(G, N) + vec3(1e-4));
      float u = dot(vSW, G), v = dot(vSW, A);
      float straw = mix(0.5, sfN(vec2(v * 30.0, u * 2.0)), sFine) * 0.6 + sfN(vec2(v * 7.0, u * 0.8)) * 0.4;
      float row = abs(fract(u / 0.34) - 0.5) * 2.0;
      k *= (0.8 + straw * 0.32) * (0.84 + 0.16 * smoothstep(0.0, 0.7, row));
    } else if (sId < 4.5) {
      // tiles or shingles: rows across the slope, each tile's lower edge
      // shadowed, every other row offset half a tile
      vec3 A = normalize(cross(G, N) + vec3(1e-4));
      float u = dot(vSW, G) / 0.3, v = dot(vSW, A) / 0.42;
      v += floor(u) * 0.5;
      float lip = smoothstep(0.0, 0.22, fract(u)) * (0.75 + 0.25 * fract(u));
      k *= 0.72 + 0.28 * lip;
      k *= 1.0 - smoothstep(0.93, 0.99, abs(fract(v) - 0.5) * 2.0) * 0.28;
      k *= 0.9 + sfH(floor(vec2(u, v))) * 0.18;
    } else if (sId < 5.5) {
      // plaster: soft mottling and a fine grit
      vec2 q = sfPlane(vSW, N);
      k *= (0.93 + sfF(q * 0.9) * 0.12) * (1.0 + (sfH(floor(q * 40.0)) - 0.5) * 0.08 * sFine);
    } else if (sId < 6.5) {
      // snow: a soft crust, bluer where it dips, and glints that come and go
      // as you move
      vec2 q = sfPlane(vSW, N);
      float drift = sfF(q * 0.6);
      c = mix(c, c * vec3(0.84, 0.9, 1.04), (1.0 - drift) * 0.55);
      k *= 0.95 + sfN(q * 6.0) * 0.08 * sFine + 0.04;
      vec3 V = normalize(cameraPosition - vSW);
      vec3 cellp = floor(vSW * 22.0);
      vec3 r = normalize(vec3(sfH3(cellp), sfH3(cellp + 5.0), sfH3(cellp + 9.0)) - 0.5);
      float glint = step(0.93, sfH3(cellp + 13.0)) * smoothstep(0.86, 0.99, dot(reflect(-V, N), r));
      sGlint = glint * sNear;
    } else if (sId < 7.5) {
      // iron: brushed, a little rust where it is low
      vec3 A = normalize(cross(G, N) + vec3(1e-4));
      k *= 1.0 + (sfN(vec2(dot(vSW, A) * 30.0, dot(vSW, G) * 2.0)) - 0.5) * 0.16 * sFine;
    } else {
      // rock: weathered, with cracks and a little lichen
      vec2 q = sfPlane(vSW, N);
      vec2 cl = sfCell(q * 1.4);
      k *= 0.82 + sfF(q * 1.8) * 0.3;
      k *= 1.0 - (1.0 - smoothstep(0.0, 0.07, cl.x)) * 0.32;
      float lichen = smoothstep(0.62, 0.7, sfF(q * 2.6 + 11.0)) * step(0.0, N.y);
      c = mix(c, c * vec3(0.86, 1.02, 0.78), lichen * 0.6);
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, c * k, sNear);
  }
}`;

/**
 * Teach a material the surfaces. `fixed` makes every fragment one surface
 * (for a material that is all bark, or all rock) instead of reading it from
 * the geometry. Chains any shader edit already on the material.
 */
export function withSurfaces(m, fixed = null) {
  if (!m || m.userData?.surfaced) return m;
  m.userData.surfaced = true;
  const prev = m.onBeforeCompile, prevKey = Object.prototype.hasOwnProperty.call(m, 'customProgramCacheKey') ? m.customProgramCacheKey : null;
  const tag = fixed == null ? 'attr' : `fixed${fixed}`;
  m.onBeforeCompile = function (s, r) {
    prev && prev.call(this, s, r);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        ${fixed == null ? '#ifndef USE_TANGENT\n attribute vec4 tangent;\n#endif' : ''}
        varying vec3 vSW, vSN;
        varying vec4 vSurf;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            mat4 sM = modelMatrix * instanceMatrix;
          #else
            mat4 sM = modelMatrix;
          #endif
          vSW = (sM * vec4(transformed, 1.0)).xyz;
          vSN = normalize(mat3(sM) * objectNormal);
          ${fixed == null
            ? 'vSurf = vec4(normalize(mat3(sM) * tangent.xyz + vec3(1e-5)), tangent.w);'
            : `vSurf = vec4(normalize(mat3(sM) * vec3(0.0, 1.0, 0.0)), ${fixed.toFixed(1)});`}
        }`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSW, vSN;
        varying vec4 vSurf;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float sGlint = 0.0;
        ${BODY}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.98, 0.92) * sGlint * 1.4;`);
  };
  m.customProgramCacheKey = function () { return `${prevKey ? prevKey.call(this) : prev ? prev.toString() : ''}|surf:${tag}`; };
  m.needsUpdate = true;
  return m;
}
