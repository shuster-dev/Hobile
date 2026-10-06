// Page side of tools/creature-sheet.mjs: species as they are built in the
// game (buildCreature → figurine), each from two sides, in daylight, with its
// name and its real height — one 2D canvas, one PNG.
import { DirectionalLight, HemisphereLight, ACESFilmicToneMapping, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer, Color, Box3, Vector3 } from 'three';
import { SPECIES } from '../src/shared/gamedata.js';
import { buildCreature, animateCreature } from '../src/client/gfx/creatures.js';
import { setStarLook } from '../src/client/gfx/starlook.js';

const q = new URLSearchParams(location.search);
const ids = (q.get('only') || Object.keys(SPECIES).join(',')).split(',').filter((id) => SPECIES[id]);
// a column: turn, and optionally 'walk' and how far into the stride (0..1)
// stars=1,3,5: one column per star instead, each dressed for it (starlook.js)
const cols = q.get('stars') ? q.get('stars').split(',').map((n) => [0.6, null, 0, Number(n)])
  : JSON.parse(q.get('cols') || '[[0.6],[-0.6],[2.5]]');
const W = Number(q.get('w') || 300), H = Number(q.get('h') || 280);
const PER = Number(q.get('per') || 2);            // species per row
// scale=1: every cell at the same metres per pixel, so sizes compare
const SAME = q.get('scale') === '1';

const out = document.createElement('canvas');
out.width = W * cols.length * PER; out.height = H * Math.ceil(ids.length / PER);
document.body.appendChild(out);
const g2 = out.getContext('2d');
const work = document.createElement('canvas');
const renderer = new WebGLRenderer({ canvas: work, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
const scene = new Scene();
scene.add(new HemisphereLight(0xe8f4ff, 0x8aa86a, 1.6));
const sun = new DirectionalLight(0xfff0d2, 1.8); sun.position.set(3, 6, 5); scene.add(sun);
const rim = new DirectionalLight(0xbfe3ff, 0.8); rim.position.set(-4, 3, -4); scene.add(rim);
const camera = new PerspectiveCamera(28, W / H, 0.05, 80);
const stats = {};

ids.forEach((id, n) => {
  const s = SPECIES[id];
  const r = Math.floor(n / PER), c0 = (n % PER) * cols.length;
  cols.forEach(([turn, move, at, star], k) => {
    const g = buildCreature(id, { outline: true, hi: true });
    if (star) setStarLook(g, star);
    g.rotation.y = turn;
    scene.add(g);
    const t0 = 1000;
    animateCreature(g, t0, move === 'walk', 1);
    for (let i = 1; i <= Math.round((at ?? 0) * 60); i++) animateCreature(g, t0 + i * 16, move === 'walk', 1);
    g.updateMatrixWorld(true);
    const box = new Box3().setFromObject(g), size = box.getSize(new Vector3()), mid = box.getCenter(new Vector3());
    const span = SAME ? 3.2 : Math.max(size.x, size.y * 1.1, size.z, 0.3);
    const ctr = SAME ? new Vector3(0, 1.2, 0) : mid;
    camera.position.set(ctr.x + 0.35 * span, ctr.y + span * 0.55, ctr.z + span * 2.5);
    camera.lookAt(ctr.x, ctr.y, ctr.z);
    renderer.setClearColor(new Color(r % 2 ? 0xdfe8ee : 0xeef3f6));
    renderer.clear();
    renderer.render(scene, camera);
    const x = (c0 + k) * W, y = r * H;
    g2.drawImage(work, x, y);
    if (k === 0) {
      stats[id] = { h: +size.y.toFixed(2), len: +Math.max(size.x, size.z).toFixed(2), tris: renderer.info.render.triangles };
      g2.fillStyle = '#1b2430'; g2.font = 'bold 15px sans-serif';
      g2.fillText(`${s.name}  ${s.he}`, x + 8, y + 20);
      g2.font = '12px sans-serif';
      g2.fillText(`${s.types.join('/')} · ${s.rarity} · h ${stats[id].h}m · ${stats[id].len}m long`, x + 8, y + 37);
    }
    if (star) { g2.fillStyle = '#b8860b'; g2.font = 'bold 16px sans-serif'; g2.fillText('★'.repeat(star), x + 8, y + H - 12); }
    scene.remove(g);
  });
});
window.SHEET_STATS = stats;
window.SHEET_READY = true;
