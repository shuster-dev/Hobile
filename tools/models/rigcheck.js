/**
 * Every species, through the real pipeline, rendered standing and mid-stride.
 *
 * This deliberately uses `attachModel` and `animateModel` rather than loading
 * the files directly: the thing worth checking is not whether a .glb opens, it
 * is whether the rig resolver found the legs and whether the walk looks like a
 * walk. A rig it could not read shows up here as a creature that renders
 * perfectly and never moves.
 */
import * as THREE from 'three';
import { MODELS, attachModel, animateModel, setModelBase } from '../../src/client/gfx/models.js';

const params = new URLSearchParams(location.search);
// `?one=cindcub&frames=10` walks a single creature through a full gait cycle
// instead of showing the whole roster: the only way to judge a walk is to see
// consecutive frames of it.
const ONE = params.get('one');
const FRAMES = Number(params.get('frames') || 0);
const CELL = 260;
const LABEL = 30;
const ids = ONE ? [ONE] : Object.keys(MODELS);
const COLS = ONE ? 1 : 6;
const rows = Math.ceil(ids.length / COLS);

setModelBase('./models/');

const SHOTS = ONE ? Math.max(2, FRAMES || 8) : 2;
const sheet = document.createElement('canvas');
sheet.width = COLS * CELL * SHOTS;      // still and stride, or a whole cycle
sheet.height = rows * (CELL + LABEL);
document.body.appendChild(sheet);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#e9edf2';
ctx.fillRect(0, 0, sheet.width, sheet.height);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(CELL, CELL, false);
renderer.setPixelRatio(2);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.LinearToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f2f5f9');
scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xbfd4ff, 0.7);
rim.position.set(-4, 2, -3);
scene.add(rim);
const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 300);

function frame(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.4;
  camera.position.set(dist * 0.7, centre.y + radius * 0.4, dist * 0.8);
  camera.lookAt(centre.x, centre.y, centre.z);
  camera.updateProjectionMatrix();
}

const report = [];

async function run() {
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    const group = new THREE.Group();
    scene.add(group);
    let ok = false;
    try { ok = await attachModel(group, id); } catch (err) { console.warn(id, err.message); }
    const rig = group.userData.model?.rig;
    report.push({
      id,
      file: MODELS[id].file,
      ok,
      mode: rig?.mode || '-',
      spine: rig?.spine.length || 0,
      head: rig?.head ? 1 : 0,
      tails: rig?.tails.length || 0,
      legs: rig?.legs.length || 0,
      arms: rig?.arms.length || 0,
      wings: rig?.wings.length || 0,
      appendages: rig?.appendages.length || 0,
      bones: rig?.bound?.all.length || 0,
      height: group.userData.model?.height || 0,
    });

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL * SHOTS;
    const y = row * (CELL + LABEL);

    // Standing still, then a third of the way through a stride at walking
    // speed — or, for a single creature, consecutive frames of the cycle.
    let clock = 1000;
    animateModel(group, clock, false, 1);
    frame(group);
    for (let s = 0; s < SHOTS; s += 1) {
      const steps = s === 0 && !ONE ? 0 : (ONE ? 5 : 26);
      for (let n = 0; n < steps; n += 1) {
        clock += 16;
        animateModel(group, clock, true, 1);
      }
      if (s === 0 && !ONE) animateModel(group, clock, false, 1);
      renderer.render(scene, camera);
      if (ok) ctx.drawImage(renderer.domElement, x + s * CELL, y, CELL, CELL);
    }

    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y + CELL, CELL * SHOTS, LABEL);
    ctx.fillStyle = ok ? '#111' : '#b00';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const r = report[report.length - 1];
    ctx.fillText(`${id} — ${r.mode} ${r.legs}L ${r.arms}A ${r.wings}W`,
      x + (CELL * SHOTS) / 2, y + CELL + 20);

    scene.remove(group);
  }
  window.__rig = report;
  window.__rigReady = true;
}
run();
