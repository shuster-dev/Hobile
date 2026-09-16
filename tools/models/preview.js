/**
 * A contact sheet of glTF files.
 *
 * Choosing which model stands in for which species is a judgement that can only
 * be made by looking, and a folder of .glb files cannot be looked at. This
 * renders every one of them at a consistent size and angle onto a single canvas.
 *
 * One renderer, drawn into a 2D canvas between frames: a browser drops the
 * oldest WebGL context somewhere around sixteen, so a canvas per model silently
 * blanks most of the sheet.
 */
import { AmbientLight, Box3, Color, DirectionalLight, Vector3 } from 'three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const CELL = Number(new URLSearchParams(location.search).get('cell') || 260);
const COLS = Number(new URLSearchParams(location.search).get('cols') || 6);
const LABEL = 26;

const files = window.FILES || [];
const rows = Math.ceil(files.length / COLS);

const sheet = document.createElement('canvas');
sheet.width = COLS * CELL;
sheet.height = rows * (CELL + LABEL);
document.body.appendChild(sheet);
const ctx = sheet.getContext('2d');
ctx.fillStyle = '#e9edf2';
ctx.fillRect(0, 0, sheet.width, sheet.height);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(CELL, CELL, false);
renderer.setPixelRatio(2);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.LinearToneMapping;

const scene = new THREE.Scene();
scene.background = new Color('#f4f6f9');
scene.add(new AmbientLight(0xffffff, 1.5));
const key = new DirectionalLight(0xffffff, 2.1);
key.position.set(3, 5, 4);
scene.add(key);
const rim = new DirectionalLight(0xbfd4ff, 0.8);
rim.position.set(-4, 2, -3);
scene.add(rim);

const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
const loader = new GLTFLoader();
const holder = new THREE.Group();
scene.add(holder);

function frame(object) {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const dist = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.35;
  camera.position.set(dist * 0.72, centre.y + radius * 0.45, dist * 0.78);
  camera.lookAt(centre.x, centre.y, centre.z);
  camera.updateProjectionMatrix();
}

async function run() {
  for (let i = 0; i < files.length; i += 1) {
    const name = files[i];
    holder.clear();
    let ok = true;
    try {
      const gltf = await new Promise((res, rej) => loader.load(`./glb/${name}`, res, undefined, rej));
      gltf.scene.rotation.y = Math.PI * 0.15;
      holder.add(gltf.scene);
      frame(gltf.scene);
    } catch (err) {
      ok = false;
      console.warn('failed', name, err?.message);
    }
    renderer.render(scene, camera);

    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = col * CELL;
    const y = row * (CELL + LABEL);
    if (ok) ctx.drawImage(renderer.domElement, x, y, CELL, CELL);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y + CELL, CELL, LABEL);
    ctx.fillStyle = '#111';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.replace(/_Art\.glb$/, '').replace(/\.glb$/, ''), x + CELL / 2, y + CELL + 18);
  }
  window.SHEET_READY = true;
}
run();
