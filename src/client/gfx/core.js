import { ACESFilmicToneMapping, AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, CapsuleGeometry, Color, CylinderGeometry, DirectionalLight, DoubleSide, Euler, Float32BufferAttribute, FrontSide, Group, HemisphereLight, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, PCFShadowMap, PCFSoftShadowMap, PMREMGenerator, PlaneGeometry, Quaternion, SRGBColorSpace, Scene, ShaderMaterial, SphereGeometry, Vector3, WebGLRenderer } from 'three';

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
  return e.setPixelRatio(Math.min(window.devicePixelRatio, t)), e.outputColorSpace = SRGBColorSpace, e.toneMapping = ACESFilmicToneMapping, e.toneMappingExposure = 1.02, e.shadowMap.enabled = QUALITY.tier !== "low", e.shadowMap.type = QUALITY.tier === "high" ? PCFSoftShadowMap : PCFShadowMap, e.info.autoReset = !0, e;
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

  void main() {
    vec3 dir = normalize(vWorld);
    float h = dir.y;

    // sky gradient: ground haze -> horizon -> zenith, eased so the horizon band
    // stays thin and the zenith holds its colour
    vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.62));
    col = mix(col, uGround, pow(clamp(-h * 1.6, 0.0, 1.0), 0.7));

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
  let o = QUALITY.tier === "high" ? 1024 : 512,
    a = new HemisphereLight(n, s, 0.92);
  i.add(a);
  let l = new DirectionalLight(t, 2.45);
  l.position.copy(e).multiplyScalar(60), l.castShadow = !0, l.shadow.mapSize.set(o, o), l.shadow.camera.near = 5, l.shadow.camera.far = 190, l.shadow.camera.left = -r, l.shadow.camera.right = r, l.shadow.camera.top = r, l.shadow.camera.bottom = -r, l.shadow.bias = -9e-4, l.shadow.normalBias = 0.035, i.add(l), i.add(l.target);
  let c = new DirectionalLight(n, 0.6);
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

function mat(i, e = {}) {
  let t = `${i}|${JSON.stringify(e)}`;
  if (MAT_CACHE.has(t)) return MAT_CACHE.get(t);
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
  thickness: e = 0.028,
  color: t = 1054752,
  opacity: n = 0.55
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

export { HALF_PI, Jv, MAT_CACHE, MOODS, QUALITY, Qv, TAU, TIER, aimSun, bez2, bez4, blobGeo, capsuleGeo, eyeParts, finProfile, glowMat, jv, lathe, makeEnvironment, makeLights, makeRenderer, makeSky, mat, mergeByMaterial, mergeGeometries, outlineMat, profile, sampleCurve, sizeRenderer, softShadowTexture, taperGeo, toNonIndexed, v0, weldGeometry, x0, xf2, y0 };
