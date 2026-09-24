/**
 * The character creator's stage: the trainer the player is building, standing
 * beside the starter they are choosing, on a small island of grass that turns.
 *
 * Every choice on the form shows up here the moment it is made. Picking a hair
 * colour from a swatch without seeing it on anyone is guessing, and choosing a
 * starter from a coloured circle is choosing a colour. The figures are built by
 * the same `buildAvatar` / `buildCreature` the world uses, so what you see here
 * is exactly who walks out into the harbour — chibi proportions and all.
 *
 * Its own small renderer with a transparent canvas, so the card's sky shows
 * through, and it stops drawing entirely the moment the screen is left.
 */
import {
  Box3, CanvasTexture, CircleGeometry, CylinderGeometry, DirectionalLight, Group, HemisphereLight,
  LinearToneMapping, Mesh, MeshBasicMaterial, PerspectiveCamera, SRGBColorSpace, Scene, Vector3,
  WebGLRenderer,
} from 'three';
import { mat } from './core.js';
import { animateCreature, buildAvatar, buildCreature } from './creatures.js';

const SKY = 0xe2f2ff, GROUND = 0x7fae5e, SUN = 0xfff0d2;

function blobShadow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(20,40,20,0.42)');
  r.addColorStop(1, 'rgba(20,40,20,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const m = new Mesh(new CircleGeometry(0.5, 24), new MeshBasicMaterial({
    map: new CanvasTexture(c), transparent: true, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.006;
  return m;
}

function lights(scene) {
  scene.add(new HemisphereLight(SKY, GROUND, 1.55));
  const sun = new DirectionalLight(SUN, 1.65);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  const rim = new DirectionalLight(0xbfe3ff, 0.75);
  rim.position.set(-4, 3, -4);
  scene.add(rim);
}

function dropTree(group) {
  if (!group) return;
  group.parent?.remove(group);
  group.userData.model?.mixer?.stopAllAction?.();
  // Nothing is disposed: once a model arrives the figure is a clone whose
  // geometry and materials are shared with every other copy of that file, and
  // freeing them here would blank the same species out in the world.
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const until = async (fn, ms) => {
  const end = performance.now() + ms;
  while (performance.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
  return !!fn();
};

export class CreatorStage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = LinearToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(30, 1, 0.1, 60);
    this.camera.position.set(0, 1.25, 5.4);
    this.camera.lookAt(0, 0.68, 0);
    lights(this.scene);

    this.spin = new Group();
    this.scene.add(this.spin);
    const top = new Mesh(new CylinderGeometry(1.55, 1.42, 0.22, 40), mat(0x7cc35a, { roughness: 0.9 }));
    top.position.y = -0.11;
    const soil = new Mesh(new CylinderGeometry(1.42, 1.02, 0.4, 40), mat(0xc0925e, { roughness: 0.95 }));
    soil.position.y = -0.42;
    this.spin.add(top, soil);
    this.trainerSpot = new Group();
    this.trainerSpot.position.set(-0.42, 0, 0.1);
    this.trainerSpot.add(blobShadow());
    this.petSpot = new Group();
    this.petSpot.position.set(0.6, 0, 0.25);
    this.petSpot.rotation.y = -0.35;
    this.petSpot.add(blobShadow());
    this.spin.add(this.trainerSpot, this.petSpot);

    this.avatar = null;
    this.pet = null;
    this.look = null;
    this.species = null;
    this.angle = 0.35;
    this.drag = null;
    this.idleSince = 0;
    this._bind();
    this.resize();
    this._raf = requestAnimationFrame((t) => this._frame(t));
  }

  /** Show this trainer and this starter. Only what changed is rebuilt. */
  set(appearance, species) {
    if (!same(appearance, this.look)) {
      this.look = { ...appearance };
      dropTree(this.avatar);
      this.avatar = buildAvatar(this.look);
      this.trainerSpot.add(this.avatar);   // parented before the model arrives, or it is dropped
    }
    if (species !== this.species) {
      this.species = species;
      dropTree(this.pet);
      this.pet = buildCreature(species);
      this.petSpot.add(this.pet);
    }
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
    const w = this.canvas.clientWidth || 300, h = this.canvas.clientHeight || 220;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _frame(t) {
    if (!this.renderer) return;
    this._raf = requestAnimationFrame((n) => this._frame(n));
    // Turn slowly on its own, and hold still for a couple of seconds after a
    // drag so the player can look at the side they turned to.
    if (!this.drag && t - this.idleSince > 2200) this.angle += 0.006;
    this.spin.rotation.y = Math.sin(this.angle) * 0.75;
    if (this.avatar) animateCreature(this.avatar, t, false);
    if (this.pet) animateCreature(this.pet, t, false);
    if (this.canvas.clientWidth !== this._w) { this._w = this.canvas.clientWidth; this.resize(); }
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
    dropTree(this.avatar);
    dropTree(this.pet);
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
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
  lights(scene);
  const camera = new PerspectiveCamera(28, 1, 0.1, 60);
  const out = {};
  try {
    for (const id of speciesIds) {
      const g = buildCreature(id);
      g.rotation.y = -0.45;
      scene.add(g);
      await until(() => !!g.userData.model, 4000);
      animateCreature(g, performance.now(), false);
      g.updateMatrixWorld(true);
      // Frame what is actually there — a long tail or a wide pair of wings
      // counts — so every card holds its creature at the same size.
      const box = new Box3().setFromObject(g);
      const size = box.getSize(new Vector3()), mid = box.getCenter(new Vector3());
      const fit = Math.max(0.35, size.y, size.x * 0.9, size.z * 0.6);
      const dist = (fit * 0.6) / Math.tan((camera.fov * Math.PI) / 360) + size.z * 0.5;
      camera.position.set(mid.x, mid.y + fit * 0.2, mid.z + dist);
      camera.lookAt(mid);
      renderer.render(scene, camera);
      out[id] = canvas.toDataURL('image/png');
      scene.remove(g);
      dropTree(g);
    }
  } finally {
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
  return out;
}
