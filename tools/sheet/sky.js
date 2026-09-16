// The sky on its own. Fighting the game camera to look up wastes more time
// than building the isolated view that the shader work needs anyway.
import * as THREE from 'three';
import { makeSky } from '../../src/client/gfx/core.js';
import { ZONES } from '../../src/shared/gamedata.js';
// ZONES[x].sky is a single colour; the gradient the shader wants comes from
// zoneTheme, which is what the game feeds it.
import { zoneTheme } from '../../src/client/gfx/world.js';

const q = new URLSearchParams(location.search);
const CELL = Number(q.get('cell') || 380);
const grid = document.getElementById('grid');
grid.style.gridTemplateColumns = `repeat(${Number(q.get('cols') || 3)}, ${CELL}px)`;

const work = document.createElement('canvas');
work.width = CELL * 2; work.height = CELL * 2;
const renderer = new THREE.WebGLRenderer({ canvas: work, antialias: true });
renderer.setSize(CELL * 2, CELL * 2, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.LinearToneMapping;   // same as the game's toon path

// Times of day, and cloud cover, are what the shader has to hold up across.
const CASES = [
  { label: 'בוקר · שמיים פתוחים', elev: 0.35, clouds: 0.15, night: 0 },
  { label: 'צהריים · עננות רגילה', elev: 0.85, clouds: 0.5, night: 0 },
  { label: 'צהריים · מעונן', elev: 0.8, clouds: 0.95, night: 0 },
  { label: 'שקיעה', elev: 0.06, clouds: 0.45, night: 0.25 },
  { label: 'לילה', elev: -0.2, clouds: 0.4, night: 1 },
  { label: 'מבט למעלה', elev: 0.7, clouds: 0.55, night: 0, pitch: 0.95 },
];

const theme = zoneTheme(ZONES.verdant_meadow);
for (const c of CASES) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const out = document.createElement('canvas');
  out.width = CELL * 2; out.height = CELL * 2;
  out.style.width = CELL + 'px'; out.style.height = CELL + 'px';
  const label = document.createElement('div');
  label.className = 'label';
  label.innerHTML = `<b>${c.label}</b><span>elev ${c.elev} · cover ${c.clouds}</span>`;
  cell.append(out, label);
  grid.append(cell);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
  cam.position.set(0, 0, 0);
  cam.rotation.set(c.pitch ?? 0.18, 0, 0);

  const sunDir = new THREE.Vector3(Math.cos(0.6) * 0.55, c.elev, 0.46).normalize();
  const sky = makeSky({
    top: theme.sky.top, horizon: theme.sky.horizon, ground: theme.sky.ground,
    sun: theme.sky.sun, sunDir,
  });
  sky.scale.setScalar(40);
  scene.add(sky);
  const u = sky.material.uniforms;
  u.uTime.value = 120;
  u.uClouds.value = c.clouds;
  u.uNight.value = c.night;
  renderer.render(scene, cam);
  out.getContext('2d').drawImage(work, 0, 0);
  sky.geometry.dispose();
}
window.__sheetReady = true;
