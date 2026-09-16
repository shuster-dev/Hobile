// A contact sheet of every species. The build notes are emphatic that creature
// work cannot be checked with assertions — you render it and look.
//
// One WebGLRenderer for the whole sheet: a browser keeps only ~16 live WebGL
// contexts and silently drops the oldest, so a canvas per creature leaves the
// first half of the sheet blank.
import * as THREE from 'three';
import { SPECIES } from '../../src/shared/gamedata.js';
import { buildCreature, DESIGN } from '../../src/client/gfx/creatures.js';
import { STYLE } from '../../src/client/gfx/core.js';

const q = new URLSearchParams(location.search);
const ids = q.get('only') ? q.get('only').split(',') : Object.keys(SPECIES);
const COLS = Number(q.get('cols') || 6);
const CELL = Number(q.get('cell') || 240);
const SS = 2;                              // supersample
const ANGLE = Number(q.get('angle') || -0.5);

// art direction knobs, so one render can sweep a style choice
if (q.get('toon') !== null) STYLE.toon = q.get('toon') !== '0';
if (q.get('bands') !== null) STYLE.bands = Number(q.get('bands'));
if (q.get('outline') !== null) STYLE.outline = Number(q.get('outline'));
if (q.get('saturate') !== null) STYLE.saturate = Number(q.get('saturate'));
if (q.get('chibi') === '0') STYLE.chibi = null;
if (q.get('head') !== null && STYLE.chibi) STYLE.chibi.head = Number(q.get('head'));
if (q.get('eye') !== null && STYLE.chibi) STYLE.chibi.eye = Number(q.get('eye'));
if (q.get('leg') !== null && STYLE.chibi) STYLE.chibi.leg = Number(q.get('leg'));

// visual tuning: ?raise=… overrides every wing's raise so one render sweeps it
if (q.get('raise') !== null) {
  const v = Number(q.get('raise'));
  for (const d of Object.values(DESIGN)) if (d.a?.wing) d.a.wing.raise = v;
}
if (q.get('sweep') !== null) {
  const v = Number(q.get('sweep'));
  for (const d of Object.values(DESIGN)) if (d.a?.wing) d.a.wing.sweep = v;
}

const grid = document.getElementById('grid');
grid.style.gridTemplateColumns = `repeat(${COLS}, ${CELL}px)`;

const work = document.createElement('canvas');
work.width = CELL * SS; work.height = CELL * SS;
const renderer = new THREE.WebGLRenderer({ canvas: work, antialias: true, alpha: true });
renderer.setSize(CELL * SS, CELL * SS, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
cam.position.set(2.6, 1.9, 3.4);
cam.lookAt(0, 0.85, 0);
if (q.get('toon') !== '0') {
  // Cel shading wants a dominant key and a generous fill: with a weak fill the
  // quantised ramp collapses the whole shadow side into one dark band.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8894b8, 1.5));
  const key = new THREE.DirectionalLight(0xfff6e6, 1.7); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe4ff, 0.7); rim.position.set(-4, 2.5, -3); scene.add(rim);
} else {
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2f45, 1.15));
  const key = new THREE.DirectionalLight(0xfff3e0, 2.1); key.position.set(3, 5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fd8ff, 1.0); rim.position.set(-4, 2, -3); scene.add(rim);
}

const stats = {};
const errors = [];

for (const id of ids) {
  const s = SPECIES[id];
  const cell = document.createElement('div');
  cell.className = 'cell';
  const out = document.createElement('canvas');
  out.width = CELL * SS; out.height = CELL * SS;
  out.style.width = CELL + 'px'; out.style.height = CELL + 'px';
  const label = document.createElement('div');
  label.className = 'label';
  label.innerHTML = `<b>${s.he}</b><span>${id} · ${s.rarity} · ${s.types.join('/')}</span>`;
  cell.append(out, label);
  grid.append(cell);

  let group = null;
  try {
    group = buildCreature(id, { outline: true, detail: 1 });
  } catch (e) {
    errors.push(`${id}: ${e.message}`);
    label.innerHTML += `<span class="err">${e.message}</span>`;
    continue;
  }
  scene.add(group);
  // Frame on the body, not on outliers: a single long tail or antenna would
  // otherwise shrink the whole creature to nothing.
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  // multiply, never set: buildCreature already scales the group by the
  // species' tier, and overwriting that makes every boss render tiny.
  const fit = 1.75 / Math.max(size.x, size.y, size.z, 0.001);
  group.scale.multiplyScalar(fit);
  group.position.set(-centre.x * fit, -box.min.y * fit, -centre.z * fit);
  group.rotation.y = ANGLE;

  renderer.info.reset();
  renderer.render(scene, cam);
  out.getContext('2d').drawImage(work, 0, 0);
  stats[id] = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles,
    h: +(size.y * fit).toFixed(2), w: +(size.x * fit).toFixed(2) };
  label.innerHTML += `<span class="stat">${stats[id].tris.toLocaleString()} tris</span>`;
  scene.remove(group);
  group.traverse((o) => { o.geometry?.dispose?.(); });
}

window.__sheetStats = stats;
window.__sheetErrors = errors;
window.__sheetReady = true;
