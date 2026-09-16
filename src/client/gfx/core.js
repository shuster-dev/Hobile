import { ACESFilmicToneMapping, AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, CapsuleGeometry, Color, CylinderGeometry, DataTexture, DirectionalLight, DoubleSide, Euler, Float32BufferAttribute, FrontSide, Group, HemisphereLight, LinearToneMapping, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, MeshToonMaterial, NearestFilter, PCFShadowMap, PCFSoftShadowMap, PMREMGenerator, PlaneGeometry, Quaternion, RedFormat, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, UnsignedByteType, Vector3, WebGLRenderer } from 'three';

function Jv(i) {
  let e = "";
  try {
    let r = i.getContext(),
      o = r.getExtension("WEBGL_debug_renderer_info");
    o && (e = String(r.getParameter(o.UNMASKED_RENDERER_WEBGL) || ""));
  } catch {}
  if (/swiftshader|llvmpipe|software|mesa offscreen/i.test(e)) return "low";
  let n = navigator.deviceMemory || 4,
    s = navigator.hardwareConcurrency || 4;
  return n <= 3 || s <= 4 ? "medium" : "high";
}

var QUALITY = {
  tier: "high"
};

function makeRenderer(i) {
  let e = new WebGLRenderer({
    canvas: i,
    antialias: !0,
    powerPreference: "high-performance",
    stencil: !1
  });
  QUALITY.tier = Jv(e);
  let t = {
    low: 1,
    medium: 1.5,
    high: 2
  }[QUALITY.tier];
  return e.setPixelRatio(Math.min(window.devicePixelRatio, t)), e.outputColorSpace = SRGBColorSpace, e.toneMapping = STYLE.toon ? LinearToneMapping : ACESFilmicToneMapping, e.toneMappingExposure = STYLE.toon ? 1.0 : 1.02, e.shadowMap.enabled = QUALITY.tier !== "low", e.shadowMap.type = QUALITY.tier === "high" ? PCFSoftShadowMap : PCFShadowMap, e.info.autoReset = !0, e;
}

function sizeRenderer(i) {
  let e = {
      low: 1,
      medium: 1.5,
      high: 2
    }[QUALITY.tier],
    t = 1,
    n = 0,
    s = 0;
  return function (o) {
    if (n += o, s++, n < 1.5) return;
    let a = s / n;
    n = 0, s = 0;
    let l = t;
    a < 26 && t > 0.6 ? t -= 0.15 : a > 55 && t < 1 && (t += 0.1), t = Math.max(0.6, Math.min(1, t)), t !== l && i.setPixelRatio(Math.min(window.devicePixelRatio, e) * t);
  };
}

var jv = `
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`,
  Qv = `
  varying vec3 vWorld;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uTime;
  uniform float uClouds;      // 0 clear .. 1 overcast
  uniform float uNight;

  // Value noise. Cheap, and the banding a hash this simple produces is hidden
  // by the octaves — a gradient-noise version costs more than the sky is worth.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorld);
    float h = dir.y;

    // sky gradient: ground haze -> horizon -> zenith, eased so the horizon band
    // stays thin and the zenith holds its colour
    vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.62));
    col = mix(col, uGround, pow(clamp(-h * 1.6, 0.0, 1.0), 0.7));

    // Clouds on a flat plane above the camera: project the view direction onto
    // it, which stretches the noise toward the horizon exactly the way real
    // cloud cover foreshortens. Below the horizon there is no plane to hit.
    if (h > 0.015) {
      vec2 cp = dir.xz / max(h, 0.05);
      float drift = uTime * 0.0065;

      // Two decks. The lower one carries the shape, the upper one thin wisps
      // moving faster, which is what stops a single layer reading as wallpaper.
      //
      // The frequency is set by what the zenith needs, not the horizon. Looking
      // straight up you only see the patch of plane directly overhead — about
      // half a unit across — so at a low frequency the whole sky above you is
      // one noise cell and reads as a flat smear.
      float lower = fbm(cp * 2.4 + vec2(drift, drift * 0.6));
      float upper = fbm(cp * 5.6 + vec2(-drift * 2.1, drift * 1.4));
      float mask = lower * 0.72 + upper * 0.28;

      // Coverage as a threshold, not a multiply: clouds have edges.
      float cover = mix(0.62, 0.30, uClouds);
      float density = smoothstep(cover, cover + 0.22, mask);

      // Fade out toward the horizon, where the projection stretches the noise
      // into streaks that no amount of frequency fixes. The fade has to start
      // low, though: at a normal third-person camera you are looking at the
      // bottom of the sky, and a fade that begins too high leaves it empty.
      density *= smoothstep(0.012, 0.075, h);
      // Thin them out as they stretch, so the streaks read as haze.
      density *= mix(0.55, 1.0, smoothstep(0.05, 0.3, h));

      // Lighting: the sun side of a cloud is bright, the bulk is the shadowed
      // body colour. Using the noise itself as a stand-in for thickness is
      // wrong physically and reads correctly.
      float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
      vec3 lit = mix(vec3(0.62), vec3(1.05), smoothstep(0.35, 0.95, mask));
      lit = mix(lit, lit * 1.25 + uSunColor * 0.35, pow(sunAmt, 2.5));
      vec3 cloudCol = mix(uHorizon, vec3(1.0), 0.55) * lit;
      cloudCol = mix(cloudCol * vec3(0.30, 0.34, 0.46), cloudCol, 1.0 - uNight * 0.75);

      col = mix(col, cloudCol, density * 0.92);
    }

    // sun: a soft disc plus a wide bloom halo
    float sun = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * pow(sun, 620.0) * 1.9;
    col += uSunColor * pow(sun, 12.0) * 0.16;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeSky({
  top: i,
  horizon: e,
  ground: t,
  sun: n,
  sunDir: s
}) {
  let r = new SphereGeometry(1, 32, 20),
    o = new ShaderMaterial({
      vertexShader: jv,
      fragmentShader: Qv,
      side: BackSide,
      depthWrite: !1,
      uniforms: {
        uTop: {
          value: new Color(i)
        },
        uHorizon: {
          value: new Color(e)
        },
        uGround: {
          value: new Color(t)
        },
        uSunColor: {
          value: new Color(n)
        },
        uTime: {
          value: 0
        },
        uClouds: {
          value: 0.5
        },
        uNight: {
          value: 0
        },
        uSunDir: {
          value: s.clone().normalize()
        }
      }
    }),
    a = new Mesh(r, o);
  return a.scale.setScalar(480), a.frustumCulled = !1, a.renderOrder = -1, a;
}

function makeEnvironment(i, e) {
  let t = new PMREMGenerator(i);
  t.compileEquirectangularShader();
  let n = new Scene(),
    s = e.clone();
  s.scale.setScalar(10), n.add(s);
  let r = t.fromScene(n, QUALITY.tier === "low" ? 0.15 : 0.04, 0.1, 100);
  return t.dispose(), r.texture;
}

function makeLights(i, {
  sunDir: e,
  sunColor: t,
  skyColor: n,
  groundColor: s,
  shadowRadius: r = 42
}) {
  // Cel shading needs a generous fill and a softer key: with the PBR balance
  // the quantised ramp turns every shadowed face into one flat dark band.
  let o = QUALITY.tier === "high" ? 1024 : 512,
    a = new HemisphereLight(n, s, STYLE.toon ? 1.45 : 0.92);
  i.add(a);
  let l = new DirectionalLight(t, STYLE.toon ? 1.75 : 2.45);
  l.position.copy(e).multiplyScalar(60), l.castShadow = !0, l.shadow.mapSize.set(o, o), l.shadow.camera.near = 5, l.shadow.camera.far = 190, l.shadow.camera.left = -r, l.shadow.camera.right = r, l.shadow.camera.top = r, l.shadow.camera.bottom = -r, l.shadow.bias = -9e-4, l.shadow.normalBias = 0.035, i.add(l), i.add(l.target);
  let c = new DirectionalLight(n, STYLE.toon ? 0.85 : 0.6);
  return c.position.set(-e.x * 40, 26, -e.z * 40), i.add(c), {
    hemi: a,
    sun: l,
    rim: c
  };
}

function aimSun(i, e, t) {
  i.target.position.set(e.x, 0, e.z), i.target.updateMatrixWorld(), i.position.set(e.x + t.x * 60, t.y * 60, e.z + t.z * 60);
}

var MAT_CACHE = new Map();

/**
 * Art direction.
 *
 * `toon` swaps the PBR materials for banded cel shading, which is what makes
 * the creatures read as drawn rather than rendered. Everything else here is a
 * dial the look depends on — outline weight in particular, because a cel look
 * without a confident outline just looks like a lighting bug.
 */
const STYLE = {
  toon: true,
  bands: 4,            // shading steps; 3 is poster-flat, 5 is nearly smooth
  saturate: 1.22,      // cartoon palettes are more saturated than lit ones
  lift: 0.06,          // pull very dark colours up so shadows stay readable
  outline: 0.05,       // fraction of the part's size
  outlineOpacity: 0.9,
  outlineColor: 0x15121f,
  // Cartoon proportions. null turns the pass off entirely.
  chibi: { head: 1.26, eye: 1.34, sep: 1.06, snout: 0.7, limb: 1.22, stance: 1.05, leg: 0.72, girth: 1.08, avatarHeads: 4.8 },
};

let GRADIENT = null;
function toonGradient(bands) {
  if (GRADIENT && GRADIENT.userData.bands === bands) return GRADIENT;
  // A ramp of `bands` steps, sampled with NEAREST: that quantisation is the
  // whole cel-shading trick. The darkest step is lifted off black so shadowed
  // sides keep their hue instead of turning into silhouette.
  const data = new Uint8Array(bands);
  for (let i = 0; i < bands; i++) data[i] = Math.round(255 * (0.42 + 0.58 * (i / (bands - 1))));
  const tex = new DataTexture(data, bands, 1, RedFormat, UnsignedByteType);
  tex.minFilter = tex.magFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  tex.userData = { bands };
  GRADIENT = tex;
  return tex;
}

const STYLED = new Color();
function styleColor(hex) {
  if (!STYLE.toon) return hex;
  STYLED.setHex(hex);
  const hsl = STYLED.getHSL({ h: 0, s: 0, l: 0 });
  STYLED.setHSL(hsl.h, Math.min(1, hsl.s * STYLE.saturate), Math.min(0.97, hsl.l + STYLE.lift * (1 - hsl.l)));
  return STYLED.getHex();
}

function mat(i, e = {}) {
  let t = `${i}|${JSON.stringify(e)}`;
  if (MAT_CACHE.has(t)) return MAT_CACHE.get(t);
  if (STYLE.toon && !e.pbr) {
    let toon = new MeshToonMaterial({
      color: styleColor(i),
      gradientMap: toonGradient(STYLE.bands),
      emissive: e.emissive ?? 0,
      emissiveIntensity: e.emissiveIntensity ?? 1,
      transparent: e.transparent ?? !1,
      opacity: e.opacity ?? 1,
      side: e.side ?? FrontSide,
      depthWrite: e.depthWrite ?? !0
    });
    // Metal and glass used to come from envMapIntensity, which toon materials
    // ignore. A little emissive of the base colour stands in for the sheen so
    // coglet and ferrogeist do not flatten into grey card.
    if ((e.env ?? 0.85) > 1.05 && !e.emissive) {
      toon.emissive = new Color(styleColor(i));
      toon.emissiveIntensity = Math.min(0.3, ((e.env ?? 0.85) - 1) * 0.5);
    }
    return toon.userData.shared = !0, MAT_CACHE.set(t, toon), toon;
  }
  let n = new MeshStandardMaterial({
    color: i,
    roughness: e.roughness ?? 0.72,
    metalness: e.metalness ?? 0.02,
    emissive: e.emissive ?? 0,
    emissiveIntensity: e.emissiveIntensity ?? 1,
    transparent: e.transparent ?? !1,
    opacity: e.opacity ?? 1,
    side: e.side ?? FrontSide,
    flatShading: e.flat ?? !1,
    envMapIntensity: e.env ?? 0.85,
    depthWrite: e.depthWrite ?? !0
  });
  return n.userData.shared = !0, MAT_CACHE.set(t, n), n;
}

function glowMat(i, e = 0.9) {
  return new MeshBasicMaterial({
    color: i,
    transparent: !0,
    opacity: e,
    blending: AdditiveBlending,
    depthWrite: !1,
    side: DoubleSide
  });
}

function outlineMat(i, {
  thickness: e = STYLE.outline,
  color: t = STYLE.outlineColor,
  opacity: n = STYLE.outlineOpacity
} = {}) {
  let s = new MeshBasicMaterial({
      color: t,
      side: BackSide,
      transparent: !0,
      opacity: n,
      depthWrite: !1
    }),
    r = [];
  i.traverse(o => {
    !o.isMesh || o.userData.noOutline || r.push(o);
  });
  for (let o of r) {
    let a = new Mesh(o.geometry, s);
    a.scale.setScalar(1 + e / Math.max(0.15, o.scale.length())), a.renderOrder = -1, a.userData.noOutline = !0, a.castShadow = !1, a.receiveShadow = !1, o.add(a);
  }
  return i;
}

function softShadowTexture(i = 0.6, e = 0.34) {
  let n = document.createElement("canvas");
  n.width = n.height = 64;
  let s = n.getContext("2d"),
    r = s.createRadialGradient(64 / 2, 64 / 2, 0, 64 / 2, 64 / 2, 64 / 2);
  r.addColorStop(0, "rgba(0,0,0,0.75)"), r.addColorStop(0.55, "rgba(0,0,0,0.32)"), r.addColorStop(1, "rgba(0,0,0,0)"), s.fillStyle = r, s.fillRect(0, 0, 64, 64);
  let o = new CanvasTexture(n);
  o.colorSpace = SRGBColorSpace;
  let a = new Mesh(new PlaneGeometry(i * 2.6, i * 2.6), new MeshBasicMaterial({
    map: o,
    transparent: !0,
    opacity: e,
    depthWrite: !1
  }));
  return a.rotation.x = -Math.PI / 2, a.position.y = 0.03, a.userData.noOutline = !0, a;
}

function mergeGeometries(i, e = !1) {
  let t = i[0].index !== null,
    n = new Set(Object.keys(i[0].attributes)),
    s = new Set(Object.keys(i[0].morphAttributes)),
    r = {},
    o = {},
    a = i[0].morphTargetsRelative,
    l = new BufferGeometry(),
    c = 0;
  for (let h = 0; h < i.length; ++h) {
    let d = i[h],
      u = 0;
    if (t !== (d.index !== null)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + h + ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."), null;
    for (let f in d.attributes) {
      if (!n.has(f)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + h + ". All geometries must have compatible attributes; make sure \"" + f + "\" attribute exists among all geometries, or in none of them."), null;
      r[f] === void 0 && (r[f] = []), r[f].push(d.attributes[f]), u++;
    }
    if (u !== n.size) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + h + ". Make sure all geometries have the same number of attributes."), null;
    if (a !== d.morphTargetsRelative) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + h + ". .morphTargetsRelative must be consistent throughout all geometries."), null;
    for (let f in d.morphAttributes) {
      if (!s.has(f)) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + h + ".  .morphAttributes must be consistent throughout all geometries."), null;
      o[f] === void 0 && (o[f] = []), o[f].push(d.morphAttributes[f]);
    }
    if (e) {
      let f;
      if (t) f = d.index.count;else if (d.attributes.position !== void 0) f = d.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " + h + ". The geometry must have either an index or a position attribute"), null;
      l.addGroup(c, f, h), c += f;
    }
  }
  if (t) {
    let h = 0,
      d = [];
    for (let u = 0; u < i.length; ++u) {
      let f = i[u].index;
      for (let p = 0; p < f.count; ++p) d.push(f.getX(p) + h);
      h += i[u].attributes.position.count;
    }
    l.setIndex(d);
  }
  for (let h in r) {
    let d = weldGeometry(r[h]);
    if (!d) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + h + " attribute."), null;
    l.setAttribute(h, d);
  }
  for (let h in o) {
    let d = o[h][0].length;
    if (d !== 0) {
      l.morphAttributes = l.morphAttributes || {}, l.morphAttributes[h] = [];
      for (let u = 0; u < d; ++u) {
        let f = [];
        for (let x = 0; x < o[h].length; ++x) f.push(o[h][x][u]);
        let p = weldGeometry(f);
        if (!p) return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " + h + " morphAttribute."), null;
        l.morphAttributes[h].push(p);
      }
    }
  }
  return l;
}

function weldGeometry(i) {
  let e,
    t,
    n,
    s = -1,
    r = 0;
  for (let c = 0; c < i.length; ++c) {
    let h = i[c];
    if (e === void 0 && (e = h.array.constructor), e !== h.array.constructor) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."), null;
    if (t === void 0 && (t = h.itemSize), t !== h.itemSize) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."), null;
    if (n === void 0 && (n = h.normalized), n !== h.normalized) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."), null;
    if (s === -1 && (s = h.gpuType), s !== h.gpuType) return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."), null;
    r += h.count * t;
  }
  let o = new e(r),
    a = new BufferAttribute(o, t, n),
    l = 0;
  for (let c = 0; c < i.length; ++c) {
    let h = i[c];
    if (h.isInterleavedBufferAttribute) {
      let d = l / t;
      for (let u = 0, f = h.count; u < f; u++) for (let p = 0; p < t; p++) {
        let x = h.getComponent(u, p);
        a.setComponent(u + d, p, x);
      }
    } else o.set(h.array, l);
    l += h.count * t;
  }
  return s !== void 0 && (a.gpuType = s), a;
}

var x0 = new Matrix4(),
  y0 = new Quaternion(),
  v0 = new Euler();

function blobGeo(i, e, t, n = 4, s = 20) {
  let r = new SphereGeometry(1, s, Math.round(s * 0.7)),
    o = r.attributes.position,
    a = 2 / n;
  for (let l = 0; l < o.count; l++) {
    let c = o.getX(l),
      h = o.getY(l),
      d = o.getZ(l),
      u = Math.sign(c) * Math.pow(Math.abs(c), a),
      f = Math.sign(h) * Math.pow(Math.abs(h), a),
      p = Math.sign(d) * Math.pow(Math.abs(d), a),
      x = Math.max(1e-6, Math.hypot(u, f, p));
    o.setXYZ(l, u / x * i, f / x * e, p / x * t);
  }
  return r.computeVertexNormals(), r;
}

function taperGeo(i, e, t, n = 12, s = 0) {
  let r = new CylinderGeometry(i, e, t, n, 6, !1);
  if (s) {
    let o = r.attributes.position;
    for (let a = 0; a < o.count; a++) {
      let c = (o.getY(a) + t / 2) / t;
      o.setZ(a, o.getZ(a) + Math.sin(c * Math.PI * 0.5) * s);
    }
    r.computeVertexNormals();
  }
  return r;
}

function capsuleGeo(i, e, t = 14) {
  return new CapsuleGeometry(i, Math.max(0.001, e), 6, t);
}

function bez2(i, e, t, n) {
  let s = 1 - n;
  return [s * s * i[0] + 2 * s * n * e[0] + n * n * t[0], s * s * i[1] + 2 * s * n * e[1] + n * n * t[1]];
}

function bez4(i, e, t, n, s) {
  let r = 1 - s,
    o = r * r,
    a = s * s;
  return [o * r * i[0] + 3 * o * s * e[0] + 3 * r * a * t[0] + a * s * n[0], o * r * i[1] + 3 * o * s * e[1] + 3 * r * a * t[1] + a * s * n[1]];
}

function sampleCurve(i, e) {
  let t = i.length,
    n = Math.min(t - 1, Math.floor(e * t)),
    s = e * t - n,
    [r, o, a] = i[n];
  return bez2(r, o, a, s);
}

function lathe(i, e, t) {
  let n = [],
    s = [],
    r = [];
  for (let l = 0; l <= t; l++) {
    let c = l / t,
      h = e(c),
      d = i(c);
    n.push(h[0], h[1], 0, d[0], d[1], 0), s.push(1, c, 0, c);
  }
  let o = (l, c) => {
    let h = n[l * 3],
      d = n[l * 3 + 1],
      u = n[c * 3],
      f = n[c * 3 + 1];
    return Math.abs(h - u) < 1e-7 && Math.abs(d - f) < 1e-7;
  };
  for (let l = 0; l < t; l++) {
    let c = l * 2,
      h = l * 2 + 1,
      d = c + 2,
      u = h + 2;
    o(c, h) || r.push(c, d, h), o(d, u) || r.push(d, u, h);
  }
  let a = new BufferGeometry();
  return a.setAttribute("position", new Float32BufferAttribute(n, 3)), a.setAttribute("uv", new Float32BufferAttribute(s, 2)), a.setIndex(r), a;
}

function profile(i, e, t = 0.3, n = 18) {
  let s = [0, i],
    r = [0, 0],
    o = h => bez4(r, [e * 0.9, i * 0.18], [e * 0.62, i * 0.72], s, h),
    l = lathe(h => {
      let d = o(h);
      return [-d[0], d[1]];
    }, o, n),
    c = l.attributes.position;
  for (let h = 0; h < c.count; h++) {
    let d = c.getY(h) / i;
    c.setZ(h, Math.sin(d * Math.PI) * t * i * 0.25);
  }
  return l.computeVertexNormals(), l;
}

function finProfile(i, e) {
  let t = o => bez2([0, 0], [i * 0.55, e * 0.55], [i, e * 0.16], o),
    n = [[[i, e * 0.16], [i * 0.78, -e * 0.18], [i * 0.6, -e * 0.34]], [[i * 0.6, -e * 0.34], [i * 0.4, -e * 0.1], [i * 0.28, -e * 0.4]], [[i * 0.28, -e * 0.4], [i * 0.14, -e * 0.12], [0, -e * 0.34]]],
    r = lathe(t, o => sampleCurve(n, 1 - o), 18);
  return r.computeVertexNormals(), r;
}

function xf2(i, {
  x: e = 0,
  y: t = 0,
  z: n = 0,
  rx: s = 0,
  ry: r = 0,
  rz: o = 0,
  sx: a = 1,
  sy: l = 1,
  sz: c = 1
} = {}) {
  let h = i.clone();
  return v0.set(s, r, o), y0.setFromEuler(v0), x0.compose(new Vector3(e, t, n), y0, new Vector3(a, l, c)), h.applyMatrix4(x0), h;
}

function mergeByMaterial(i, {
  castShadow: e = !0,
  receiveShadow: t = !1
} = {}) {
  let n = new Map();
  for (let l of i) n.has(l.mat) || n.set(l.mat, []), n.get(l.mat).push(l.geo);
  let s = [],
    r = [];
  for (let [l, c] of n) {
    let h = c.length === 1 ? c[0] : mergeGeometries(c.map(toNonIndexed), !1);
    h && (s.push(l), r.push(h));
  }
  let o = mergeGeometries(r.map(toNonIndexed), !0);
  if (!o) {
    let l = new Group();
    for (let c of i) l.add(new Mesh(c.geo, c.mat));
    return l;
  }
  let a = new Mesh(o, s);
  return a.castShadow = e, a.receiveShadow = t, a;
}

function toNonIndexed(i) {
  let e = new BufferGeometry(),
    t = i.index ? i.toNonIndexed() : i;
  return e.setAttribute("position", t.attributes.position.clone()), t.attributes.normal ? e.setAttribute("normal", t.attributes.normal.clone()) : e.computeVertexNormals(), e;
}

function eyeParts(i, {
  x: e,
  y: t,
  z: n,
  r: s,
  size: r,
  look: o = 0,
  tilt: a = 0,
  seg: l = 1
}) {
  let c = s ?? (r ?? 1) * 0.06,
    h = (f, p) => [Math.max(6, Math.round(f * l)), Math.max(4, Math.round(p * l))],
    d = n - c * 0.5,
    u = o * c * 0.14;
  return [{
    geo: xf2(new SphereGeometry(c, ...h(12, 8)), {
      x: e,
      y: t,
      z: d,
      sy: 1.08,
      sz: 0.52,
      rz: a
    }),
    mat: i.white
  }, {
    geo: xf2(new SphereGeometry(c * 0.58, ...h(10, 7)), {
      x: e + u,
      y: t,
      z: d + c * 0.36,
      sz: 0.42
    }),
    mat: i.iris
  }, {
    geo: xf2(new SphereGeometry(c * 0.3, ...h(8, 6)), {
      x: e + u,
      y: t,
      z: d + c * 0.52,
      sz: 0.42
    }),
    mat: i.pupil
  }, {
    geo: xf2(new SphereGeometry(c * 0.14, ...h(6, 4)), {
      x: e + u + c * 0.3,
      y: t + c * 0.3,
      z: d + c * 0.6
    }),
    mat: i.spec
  }];
}

var HALF_PI = Math.PI / 2,
  TAU = Math.PI * 2,
  TIER = {
    starter: 0.45,
    common: 0.3,
    evolved: 0.9,
    rare: 1.3,
    final: 1.5,
    legendary: 2,
    boss: 2.4
  },
  MOODS = {
    curious: {
      eye: 1.16,
      browRZ: -0.3,
      browY: 0.62,
      browW: 0.85,
      browT: 0.16,
      lid: 0
    },
    eager: {
      eye: 1.05,
      browRZ: -0.16,
      browY: 0.58,
      browW: 0.95,
      browT: 0.18,
      lid: 0
    },
    predatory: {
      eye: 0.8,
      browRZ: 0.46,
      browY: 0.4,
      browW: 1.3,
      browT: 0.3,
      lid: 0.3
    },
    fierce: {
      eye: 0.92,
      browRZ: 0.6,
      browY: 0.34,
      browW: 1.45,
      browT: 0.38,
      lid: 0.18
    },
    sleepy: {
      eye: 1,
      browRZ: -0.08,
      browY: 0.46,
      browW: 1.05,
      browT: 0.2,
      lid: 0.52
    },
    wary: {
      eye: 0.9,
      browRZ: 0.22,
      browY: 0.5,
      browW: 1.1,
      browT: 0.24,
      lid: 0.14
    },
    serene: {
      eye: 0.95,
      browRZ: -0.1,
      browY: 0.56,
      browW: 0.9,
      browT: 0.14,
      lid: 0.22
    }
  };

export { STYLE, styleColor, toonGradient, HALF_PI, Jv, MAT_CACHE, MOODS, QUALITY, Qv, TAU, TIER, aimSun, bez2, bez4, blobGeo, capsuleGeo, eyeParts, finProfile, glowMat, jv, lathe, makeEnvironment, makeLights, makeRenderer, makeSky, mat, mergeByMaterial, mergeGeometries, outlineMat, profile, sampleCurve, sizeRenderer, softShadowTexture, taperGeo, toNonIndexed, v0, weldGeometry, x0, xf2, y0 };
