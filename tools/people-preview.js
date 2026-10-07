// Page side of tools/people-sheet.mjs: every kind of person, both looks, from
// the front and turned, in the creator's light — one canvas, one PNG.
import { DirectionalLight, HemisphereLight, LinearToneMapping, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer, Color } from 'three';
import { KINDS, KIND_IDS, SKINS, buildPerson, personAct, personDesign } from '../src/client/gfx/people.js';
import { animateCreature } from '../src/client/gfx/creatures.js';

const q = new URLSearchParams(location.search);
const kinds = (q.get('kinds') || KIND_IDS.join(',')).split(',');
// a column: look, turn, and optionally a move and how far into it (0..1)
const cols = JSON.parse(q.get('cols') || '[["a",0.35],["a",-2.6],["b",0.35],["b",-0.9]]');
const skinOf = (i) => SKINS[Number(q.get('skin') ?? (i % SKINS.length))];
const W = Number(q.get('w') || 260), H = Number(q.get('h') || 340), zoom = Number(q.get('zoom') || 1);

const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W * cols.length, H * kinds.length, false);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = LinearToneMapping;
renderer.setScissorTest(true);
const scene = new Scene();
scene.add(new HemisphereLight(0xe2f2ff, Number(q.get('ground') || 0x7fae5e), 1.55));
const sun = new DirectionalLight(0xfff0d2, 1.65); sun.position.set(3, 6, 5); scene.add(sun);
const rim = new DirectionalLight(0xbfe3ff, 0.75); rim.position.set(-4, 3, -4); scene.add(rim);
const camera = new PerspectiveCamera(26, W / H, 0.1, 50);

let row = 0;
for (const kind of kinds) {
  let col = 0;
  for (const [look, turn, move, at] of cols) {
    // cells=, ink=: bake as the creator's close-up would, or try a setting
    const d = personDesign({ kind, look, skin: skinOf(row) });
    if (q.get('cells')) d.cells = Number(q.get('cells'));
    if (q.get('ink')) d.ink = Number(q.get('ink'));
    const g = buildPerson({ kind, look, skin: skinOf(row) }, { hi: true });
    g.rotation.y = turn;
    scene.add(g);
    const m = g.userData.model;
    // walk the animation to the moment wanted: a still, or a frame of a move
    const t0 = 1000;
    animateCreature(g, t0, move === 'walk' || move === 'run', move === 'run' ? 2 : 1);
    if (move && move !== 'walk' && move !== 'run') {
      personAct(g, move, 1.3);
      const steps = Math.round((at ?? 0.5) * 1.3 / 0.016);
      for (let i = 1; i <= steps; i++) animateCreature(g, t0 + i * 16, false);
    } else if (move) {
      for (let i = 1; i <= Math.round((at ?? 0.3) * 60); i++) animateCreature(g, t0 + i * 16, true, move === 'run' ? 2 : 1);
    }
    g.updateMatrixWorld(true);
    const h = m.height;
    camera.position.set(0, h * 0.6, h * 2.75 / zoom);
    camera.lookAt(0, h * (zoom > 1.5 ? 0.78 : 0.52), 0);
    const x = col * W, y = (kinds.length - 1 - row) * H;
    renderer.setViewport(x, y, W, H);
    renderer.setScissor(x, y, W, H);
    renderer.setClearColor(new Color(row % 2 ? 0xdfe6ee : 0xe9eef3));
    renderer.clear();
    renderer.render(scene, camera);
    scene.remove(g);
    col++;
  }
  row++;
}
window.SHEET_READY = true;
