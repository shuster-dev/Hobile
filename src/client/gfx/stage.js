/**
 * The character creator's stage: the adventurer the player is choosing, alone
 * on a lit pedestal — and, once a partner is being chosen, the starter beside
 * them.
 *
 * The figures are built by the same `buildPerson` / `buildCreature` the world
 * uses, so who you see here is exactly who walks out into the harbour. The
 * atmosphere behind is the screen's own CSS (the canvas is transparent); the
 * pedestal, its light and the motes rising off it take the kind's colour.
 *
 * Its own small renderer, and it stops drawing entirely the moment the screen
 * is left. A second, offscreen one draws the portraits on the cards.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color,
  CylinderGeometry, DirectionalLight, DoubleSide, Group, HemisphereLight, LinearToneMapping, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial,
  RingGeometry, SRGBColorSpace, Scene, TorusGeometry, Box3, Vector3, WebGLRenderer,
} from 'three';
import { animateCreature, buildCreature } from './creatures.js';
import { closeUp } from './figurine.js';
import { KINDS, buildPerson, personAct } from './people.js';

const until = async (fn, ms) => {
  const end = performance.now() + ms;
  while (performance.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return !!fn();
};
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/** A soft round spot: white in the middle, nothing at the edge. */
function spotTexture(inner = 0, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, size * inner * 0.5, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** The column of light over the pedestal: bright at the floor, gone by head height. */
function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const r = g.createLinearGradient(0, 0, 0, 128);
  r.addColorStop(0, 'rgba(255,255,255,0)');
  r.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  r.addColorStop(1, 'rgba(255,255,255,0.75)');
  g.fillStyle = r;
  g.fillRect(0, 0, 4, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function glowMat(map, opacity) {
  return new MeshBasicMaterial({
    map, transparent: true, opacity, depthWrite: false, blending: AdditiveBlending, color: 0xffffff,
  });
}

function shadowBlob(r = 0.5) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const m = new Mesh(new CircleGeometry(r, 28), new MeshBasicMaterial({
    map: new CanvasTexture(c), transparent: true, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.004;
  return m;
}

/** The pedestal: two tiers of dark stone, a lit edge and an engraved ring. */
function pedestal(tinted) {
  const g = new Group();
  const stone = new MeshStandardMaterial({ color: 0x2a3052, roughness: 0.5, metalness: 0.15 });
  const deep = new MeshStandardMaterial({ color: 0x191d36, roughness: 0.7, metalness: 0.1 });
  const top = new Mesh(new CylinderGeometry(1.0, 1.02, 0.12, 72), stone);
  top.position.y = -0.06;
  const base = new Mesh(new CylinderGeometry(1.16, 1.24, 0.12, 72), deep);
  base.position.y = -0.18;
  g.add(top, base);
  const edge = new Mesh(new TorusGeometry(1.0, 0.016, 10, 120), new MeshBasicMaterial({ color: 0xffffff }));
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.0;
  const lower = new Mesh(new TorusGeometry(1.2, 0.01, 8, 120), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  lower.rotation.x = Math.PI / 2;
  lower.position.y = -0.12;
  const rune = new Mesh(new RingGeometry(0.7, 0.712, 120), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
  rune.rotation.x = -Math.PI / 2;
  rune.position.y = 0.002;
  const rune2 = new Mesh(new RingGeometry(0.86, 0.866, 120), new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false }));
  rune2.rotation.x = -Math.PI / 2;
  rune2.position.y = 0.002;
  const pool = new Mesh(new CircleGeometry(1.0, 64), glowMat(spotTexture(), 0.3));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.003;
  const halo = new Mesh(new PlaneGeometry(5.2, 5.2), glowMat(spotTexture(0.3), 0.42));
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = -0.235;
  g.add(edge, lower, rune, rune2, pool, halo);
  tinted.push(edge.material, lower.material, rune.material, rune2.material, pool.material, halo.material);
  return g;
}

/** Motes of light rising off the pedestal and fading out overhead. */
function motes(tinted, n = 46) {
  const pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.25 + Math.random() * 0.85;
    seed.push({ a, r, y: Math.random() * 2.4, v: 0.12 + Math.random() * 0.22, w: (Math.random() - 0.5) * 0.4 });
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = seed[i].y; pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const m = new PointsMaterial({
    size: 0.05, map: spotTexture(), transparent: true, opacity: 0.85, depthWrite: false,
    blending: AdditiveBlending, color: 0xffffff, sizeAttenuation: true,
  });
  tinted.push(m);
  const p = new Points(geo, m);
  p.userData.seed = seed;
  p.frustumCulled = false;
  return p;
}

const STEP = { hero: { hero: [0, 0, 0], pet: [1.9, 0, 0.1] }, duo: { hero: [-0.4, 0, 0.02], pet: [0.5, 0, 0.1] } };
// the partner a little smaller than in the world: this close, it would crowd its trainer
const PET_K = 0.8;
const ease = (x) => 1 - Math.pow(1 - x, 3);
const back = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);

export class CreatorStage {
  /** `reserve()`: how much of the canvas, from the top, the page has covered
   *  (the kind's name and line) — the figures are framed under it. */
  constructor(canvas, { reserve = () => 0 } = {}) {
    this.canvas = canvas;
    this.reserve = reserve;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = LinearToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(24, 1, 0.1, 60);

    // Key from the front and to one side, the kind's colour from behind.
    this.scene.add(new HemisphereLight(0xe8eeff, 0x363b5c, 1.35));
    const key = new DirectionalLight(0xfff0dc, 1.85);
    key.position.set(2.6, 4.2, 5);
    this.rimA = new DirectionalLight(0xffffff, 1.5);
    this.rimA.position.set(-3.5, 2.6, -3.5);
    this.rimB = new DirectionalLight(0xffffff, 0.8);
    this.rimB.position.set(3.5, 1.8, -3);
    this.scene.add(key, this.rimA, this.rimB);

    this.tinted = [];
    this.spin = new Group();
    this.scene.add(this.spin);
    this.plinth = pedestal(this.tinted);
    this.plinthK = 0.8;
    this.spin.add(this.plinth);
    const beam = new Mesh(new CylinderGeometry(0.92, 1.0, 3.4, 56, 1, true), new MeshBasicMaterial({
      map: beamTexture(), transparent: true, opacity: 0.16, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    }));
    beam.position.y = 1.7;
    this.tinted.push(beam.material);
    this.scene.add(beam);
    this.beam = beam;
    this.motes = motes(this.tinted);
    this.scene.add(this.motes);
    this.pulse = new Mesh(new RingGeometry(0.9, 1.0, 96), new MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, color: 0xffffff,
    }));
    this.pulse.rotation.x = -Math.PI / 2;
    this.pulse.position.y = 0.01;
    this.tinted.push(this.pulse.material);
    this.plinth.add(this.pulse);

    this.heroSpot = new Group();
    this.heroSpot.add(shadowBlob(0.42));
    this.petSpot = new Group();
    this.petSpot.rotation.y = -0.4;
    this.petSpot.add(shadowBlob(0.4));
    this.spin.add(this.heroSpot, this.petSpot);

    this.color = new Color(0xb07cff);
    this.want = new Color(0xb07cff);
    this.hero = null; this.heroKey = null; this.heroBorn = 0;
    this.pet = null; this.species = null; this.petBorn = 0;
    this.mode = 'hero';
    this.angle = 0.28;
    this.drag = null;
    this.idleSince = 0;
    this.nextAct = 0;
    this.cam = null;
    this._bind();
    this.resize();
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  /** Show this adventurer. Only a new kind, look or skin is rebuilt. */
  setHero(appearance) {
    const key = `${appearance.kind}:${appearance.look}:${appearance.skin}:${appearance.hat || ''}:${appearance.dye || ''}`;
    if (key === this.heroKey) return;
    const kindChanged = !this.heroKey || this.heroKey.split(':')[0] !== appearance.kind;
    this.heroKey = key;
    if (this.hero) this.heroSpot.remove(this.hero);
    this.hero = buildPerson(appearance, { hi: true });
    this.heroSpot.add(this.hero);
    // and then finer still, a slice at a time: this one is seen up close
    closeUp(this.hero.userData.model);
    this.heroBorn = performance.now();
    const K = KINDS[appearance.kind];
    if (K && !this.accent) this.want.set(K.accent);
    if (kindChanged) {
      // a new kind shows what it does, and the pedestal answers
      personAct(this.hero, K?.pose || 'cheer', 1.7);
      this.nextAct = performance.now() + 9000;
      this.pulseAt = performance.now();
    }
    this.frameFor();
  }

  /** The stage's colour; null to take the adventurer's kind's again. */
  setAccent(hex) {
    this.accent = hex || null;
    const K = this.hero && KINDS[this.hero.userData.kind];
    this.want.set(hex || K?.accent || 0xb07cff);
  }

  /** The starter beside them, or no one (null). */
  setPet(species) {
    if (species === this.species) return;
    this.species = species;
    if (this.pet) this.petSpot.remove(this.pet);
    this.pet = species ? buildCreature(species, { hi: true }) : null;
    if (this.pet) { this.petSpot.add(this.pet); this.petBorn = performance.now(); }
  }

  /** 'hero': the adventurer alone and close; 'duo': the two of them. */
  focus(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.frameFor();
  }

  /** Where the camera should be for what is on the pedestal, in this canvas. */
  frameFor() {
    const h = (this.hero?.userData.height || 1.42);
    const aspect = this.camera.aspect || 0.8;
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    let lo, hi, wide;
    if (this.mode === 'duo') { lo = -0.3; hi = h * 1.1; wide = 2.45; }
    else { lo = -0.24; hi = h * 1.1; wide = 1.45; }
    // the page's text covers the top of the canvas: frame the figure under it
    const r = Math.max(0, Math.min(0.42, (this.reserve() || 0) / (this._h || 1)));
    hi = lo + (hi - lo) / (1 - r);
    const span = hi - lo, mid = (hi + lo) / 2;
    const dist = Math.max(span / 2 / half / 0.94, wide / 2 / (half * aspect) / 0.94);
    this.camTo = { pos: new Vector3(0, mid + dist * 0.1, dist), aim: new Vector3(0, mid - span * 0.03, 0) };
    if (!this.cam) this.cam = { pos: this.camTo.pos.clone(), aim: this.camTo.aim.clone() };
  }

  _bind() {
    const c = this.canvas;
    this._down = (e) => { this.drag = { x: e.clientX, a: this.angle }; c.setPointerCapture?.(e.pointerId); };
    this._move = (e) => {
      if (!this.drag) return;
      this.angle = this.drag.a + (e.clientX - this.drag.x) * 0.012;
      this.idleSince = performance.now();
    };
    this._up = () => { this.drag = null; this.idleSince = performance.now(); };
    c.addEventListener('pointerdown', this._down);
    c.addEventListener('pointermove', this._move);
    c.addEventListener('pointerup', this._up);
    c.addEventListener('pointercancel', this._up);
    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
  }

  resize() {
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 300;
    this._w = w; this._h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frameFor();
  }

  _frame(t) {
    if (!this.renderer) return;
    this._raf = requestAnimationFrame((n) => this._frame(n));
    if (this.canvas.clientWidth !== this._w || this.canvas.clientHeight !== this._h) this.resize();
    const dt = Math.min(0.05, ((t - (this._last ?? t)) || 16) / 1000);
    this._last = t;
    // Turn a little on its own; hold still for a while after a drag so the
    // player can look at the side they turned to.
    if (!this.drag && t - this.idleSince > 2600) this.angle += dt * 0.22;
    const swing = Math.sin(this.angle) * 0.62;
    this.heroSpot.rotation.y = swing;
    this.petSpot.rotation.y = swing * 0.6 - 0.4;

    // the figures slide to their marks; a new one arrives with a little spring
    const P = STEP[this.mode];
    this.heroSpot.position.lerp(new Vector3(...P.hero), Math.min(1, dt * 6));
    // the pedestal is sized for who is on it
    this.plinthK += ((this.mode === 'duo' ? 1 : 0.74) - this.plinthK) * Math.min(1, dt * 5);
    this.plinth.scale.setScalar(this.plinthK);
    this.beam.scale.set(this.plinthK, 1, this.plinthK);
    this.petSpot.position.lerp(new Vector3(...P.pet), Math.min(1, dt * 5));
    if (this.hero) {
      const k = Math.min(1, (t - this.heroBorn) / 420);
      this.hero.scale.setScalar(0.86 + 0.14 * back(k));
      animateCreature(this.hero, t, false);
      if (t > this.nextAct) {
        personAct(this.hero, KINDS[this.hero.userData.kind]?.pose || 'cheer', 1.7);
        this.nextAct = t + 11000;
      }
    }
    if (this.pet) {
      const k = Math.min(1, (t - this.petBorn) / 460);
      this.pet.scale.setScalar((0.6 + 0.4 * back(k)) * PET_K);
      animateCreature(this.pet, t, false);
    }

    // the kind's colour, eased in
    this.color.lerp(this.want, Math.min(1, dt * 5));
    for (const m of this.tinted) m.color.copy(this.color);
    this.rimA.color.copy(this.color).lerp(new Color(0xffffff), 0.35);
    this.rimB.color.copy(this.color).lerp(new Color(0xffffff), 0.55);
    const pk = this.pulseAt ? (t - this.pulseAt) / 700 : 1;
    if (pk < 1) {
      this.pulse.material.opacity = 0.7 * (1 - pk);
      this.pulse.scale.setScalar(0.7 + ease(pk) * 0.9);
    } else this.pulse.material.opacity = 0;

    const seed = this.motes.userData.seed, pos = this.motes.geometry.attributes.position;
    for (let i = 0; i < seed.length; i++) {
      const s = seed[i];
      s.y += s.v * dt;
      if (s.y > 2.5) s.y = 0;
      s.a += s.w * dt;
      pos.array[i * 3] = Math.cos(s.a) * s.r * this.plinthK;
      pos.array[i * 3 + 1] = s.y;
      pos.array[i * 3 + 2] = Math.sin(s.a) * s.r * this.plinthK;
    }
    pos.needsUpdate = true;
    this.motes.material.opacity = 0.8;

    if (this.camTo) {
      this.cam.pos.lerp(this.camTo.pos, Math.min(1, dt * 4));
      this.cam.aim.lerp(this.camTo.aim, Math.min(1, dt * 4));
      this.camera.position.copy(this.cam.pos);
      this.camera.lookAt(this.cam.aim);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    c.removeEventListener('pointerup', this._up);
    c.removeEventListener('pointercancel', this._up);
    window.removeEventListener('resize', this._resize);
    // The figures' geometry is shared with every other copy of them (the
    // world's included); only what the stage made for itself is freed.
    if (this.hero) this.heroSpot.remove(this.hero);
    if (this.pet) this.petSpot.remove(this.pet);
    this.scene.traverse((o) => {
      if (o.isMesh || o.isPoints) { o.geometry.dispose(); o.material.map?.dispose(); o.material.dispose(); }
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer = null;
  }
}

/**
 * Head-and-shoulders portraits of adventurers, for the cards: one offscreen
 * renderer, kept while the creator is open, draws them one per frame so the
 * page never stalls on a row of them.
 */
export class PortraitPainter {
  constructor(w = 144, h = 176) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = LinearToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new Scene();
    this.scene.add(new HemisphereLight(0xeef3ff, 0x3a3f5e, 1.45));
    const key = new DirectionalLight(0xfff0dc, 1.8);
    key.position.set(2.2, 3.5, 5);
    const rim = new DirectionalLight(0xdfe6ff, 1.1);
    rim.position.set(-3, 2.5, -3);
    this.scene.add(key, rim);
    this.camera = new PerspectiveCamera(22, w / h, 0.05, 30);
    this.cache = new Map();
    this.queue = [];
    this.busy = false;
  }

  /** A portrait of this look, as a data URL; `cb` when it is drawn. */
  want(appearance, cb) {
    const key = `${appearance.kind}:${appearance.look}:${appearance.skin}`;
    if (this.cache.has(key)) { cb(this.cache.get(key)); return; }
    this.queue.push({ key, appearance, cb });
    this._pump();
  }

  async _pump() {
    if (this.busy) return;
    this.busy = true;
    while (this.queue.length && this.renderer) {
      await frame();
      const job = this.queue.shift();
      if (!this.renderer) break;
      if (!this.cache.has(job.key)) this.cache.set(job.key, this._draw(job.appearance));
      job.cb(this.cache.get(job.key));
    }
    this.busy = false;
  }

  _draw(appearance) {
    const g = buildPerson(appearance, { hi: true, outline: true });
    g.rotation.y = -0.32;
    this.scene.add(g);
    animateCreature(g, 1000, false);
    g.updateMatrixWorld(true);
    const h = g.userData.height;
    const box = new Box3().setFromObject(g);
    // from the chest to the top of the head (a hat is let run off the top)
    const top = Math.min(box.max.y, h * 1.2), low = h * 0.5;
    const span = top - low, mid = (top + low) / 2;
    const half = Math.tan((this.camera.fov * Math.PI) / 360);
    const dist = span / 2 / half / 0.98;
    this.camera.position.set(0, mid + 0.02, dist);
    this.camera.lookAt(0, mid, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.canvas.toDataURL('image/png');
    this.scene.remove(g);
    return url;
  }

  dispose() {
    this.queue.length = 0;
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
    this.renderer = null;
  }
}

/**
 * A portrait of each species, as a data URL — for the starter cards, where
 * three more live canvases would be three more GPU contexts on a phone. One
 * offscreen renderer draws them all and is thrown away.
 */
export async function portraits(speciesIds, size = 176) {
  const canvas = document.createElement('canvas');
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = LinearToneMapping;
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  scene.add(new HemisphereLight(0xe2f2ff, 0x7fae5e, 1.55));
  const sun = new DirectionalLight(0xfff0d2, 1.65);
  sun.position.set(3, 6, 5);
  const rim = new DirectionalLight(0xbfe3ff, 0.75);
  rim.position.set(-4, 3, -4);
  scene.add(sun, rim);
  const camera = new PerspectiveCamera(28, 1, 0.1, 60);
  const out = {};
  try {
    for (const id of speciesIds) {
      const g = buildCreature(id, { hi: true });
      g.rotation.y = -0.45;
      scene.add(g);
      await until(() => !!g.userData.model, 4000);
      animateCreature(g, performance.now(), false);
      g.updateMatrixWorld(true);
      // Frame what is actually there — a long tail or a wide pair of wings
      // counts — so every card holds its creature at the same size.
      const box = new Box3().setFromObject(g);
      const s = box.getSize(new Vector3()), mid = box.getCenter(new Vector3());
      const fit = Math.max(0.35, s.y, s.x * 0.9, s.z * 0.6);
      const dist = (fit * 0.6) / Math.tan((camera.fov * Math.PI) / 360) + s.z * 0.5;
      camera.position.set(mid.x, mid.y + fit * 0.2, mid.z + dist);
      camera.lookAt(mid);
      // a raid boss is built twenty metres tall: reach past it
      camera.far = Math.max(60, dist + fit * 2);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      out[id] = canvas.toDataURL('image/png');
      scene.remove(g);
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
  return out;
}
