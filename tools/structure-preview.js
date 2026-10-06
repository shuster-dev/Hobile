// Page side of tools/structure-sheet.mjs: every kind of structure the planned
// zones build (zonebuild.js), each alone on a patch of ground, in daylight.
import { ACESFilmicToneMapping, BoxGeometry, Color, DirectionalLight, HemisphereLight, Mesh, MeshStandardMaterial, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer, Box3, Vector3 } from 'three';
import { BUILDERS } from '../src/client/gfx/zonebuild.js';
import { Kit, toonVC, glowVC } from '../src/client/gfx/zonekit.js';

const q = new URLSearchParams(location.search);
const kinds = (q.get('only') || Object.keys(BUILDERS).join(',')).split(',');
const W = Number(q.get('w') || 300), H = Number(q.get('h') || 240), COLS = Number(q.get('cols') || 6);
const out = document.createElement('canvas');
out.width = W * COLS; out.height = H * Math.ceil(kinds.length / COLS);
document.body.appendChild(out);
const g2 = out.getContext('2d');
const work = document.createElement('canvas');
const renderer = new WebGLRenderer({ canvas: work, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false); renderer.outputColorSpace = SRGBColorSpace; renderer.toneMapping = ACESFilmicToneMapping;
const camera = new PerspectiveCamera(30, W / H, 0.1, 2000);
const night = q.get('night') ? Number(q.get('night')) : 0;

// a plan that is flat ground with water below it
const P = { level: -0.7, water: { kind: 'water', level: -0.7 }, zone: { element: 'volt' }, height: () => 0, structures: [] };
const SPEC = {
  bridge: { len: 14, w: 4.2 }, boardwalk: { len: 12, w: 2.6 }, pier: { len: 14, w: 3.4 },
  barn: { w: 10, d: 14, h: 6 }, dwelling: { w: 6.5, d: 6, h: 4 }, field: { w: 16, d: 10 }, orchard: { w: 14, d: 10 },
  forge: { w: 8, d: 7, h: 5 }, stonehouse: { w: 6, d: 6, h: 4 }, cabin: { w: 6, d: 7, h: 4 }, fence: { len: 8 },
  basalt: { r: 4 }, crystals: { r: 3 }, spire: { r: 2.5 }, gianttree: { r: 2.6 }, mushroom: { r: 1.5 }, arch: { span: 10 },
  rails: { pts: [[-6, 0], [6, 0]] }, lanterns: { pts: [[-14, 0], [14, 0]] },
};
let i = 0;
for (const kind of kinds) {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xe8f4ff, 0x8aa86a, 1.5));
  const sun = new DirectionalLight(0xfff0d2, 1.8); sun.position.set(30, 60, 40); scene.add(sun);
  const ground = new Mesh(new BoxGeometry(200, 0.2, 200), new MeshStandardMaterial({ color: 0x86b05a }));
  ground.position.y = -0.1; scene.add(ground);
  const s = { kind, x: 0, z: 0, y: 0, rot: 0.5, i, ...(SPEC[kind] || {}) };
  if (s.len) { // a deck: lay it along its rotation, over water
    const yAt = () => (kind === 'bridge' ? 1.2 : 0.2);
    s.deck = { yAt };
    const water = new Mesh(new BoxGeometry(s.len - 2, 0.05, 30), new MeshStandardMaterial({ color: 0x3a8ad0 }));
    water.position.y = 0.02; water.rotation.y = s.rot + Math.PI / 2; scene.add(water);
  }
  const k = new Kit({ x: 0, y: 0, z: 0, rot: s.rot }), g = new Kit({ x: 0, y: 0, z: 0, rot: s.rot }), lit = new Kit({ x: 0, y: 0, z: 0, rot: s.rot });
  const world = new Kit(), wg = new Kit();
  const parts = [];
  const o = {
    P, pal: { wall: 0xF2E6D0 }, world, glow: wg, lit,
    part(name, pivot) { const kk = new Kit({ x: pivot.x, y: pivot.y, z: pivot.z, rot: 0 }); parts.push(kk); return kk; },
    partGlow() { return new Kit(); }, smoke() {}, beacon() {},
  };
  try {
    BUILDERS[kind](k, g, s, o);
  } catch (e) { console.error(kind, e.message); }
  const gm = glowVC(); gm.color.setScalar(0.4 + night);
  for (const [kit, m] of [[k, toonVC()], [g, gm], [lit, glowVC()], [world, toonVC()], [wg, gm]]) { const geo = kit.geometry(); geo && scene.add(new Mesh(geo, m)); }
  for (const kk of parts) { const geo = kk.geometry(); if (geo) { const m = new Mesh(geo, toonVC()); m.rotation.y = 0; scene.add(m); } }
  const box = new Box3();
  scene.traverse((m) => { if (m.isMesh && m !== ground && m.geometry.attributes.position.count < 1e6) box.expandByObject(m); });
  const size = box.getSize(new Vector3()), mid = box.getCenter(new Vector3());
  const span = Math.max(size.x, size.y * 1.2, size.z, 2);
  camera.position.set(mid.x + span * 0.9, mid.y + span * 0.75, mid.z + span * 1.5);
  camera.lookAt(mid);
  renderer.setClearColor(new Color(0xdfe8ee)); renderer.clear(); renderer.render(scene, camera);
  const x = (i % COLS) * W, y = Math.floor(i / COLS) * H;
  g2.drawImage(work, x, y);
  g2.fillStyle = '#1b2430'; g2.font = 'bold 15px sans-serif'; g2.fillText(`${kind}  ${renderer.info.render.triangles} tris`, x + 8, y + 18);
  i++;
}
window.SHEET_READY = true;
