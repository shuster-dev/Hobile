// Browser entry for the interior contact sheet. Builds each room straight out
// of `buildInterior` — no game, no server, no walking to a door — and puts a
// camera where a player standing just inside it would be.
import {
  Scene, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
  Color, Vector3, SRGBColorSpace, PCFSoftShadowMap, LinearToneMapping,
} from 'three';
import { buildInterior, INTERIORS, zoneTheme } from '../../src/client/gfx/world.js';

const kinds = window.ROOMS || Object.keys(INTERIORS);
const W = window.CELL_W || 560;
const H = window.CELL_H || 460;
const theme = zoneTheme({ id: 'aetherport', urban: true, element: 'verdant' });

const strip = document.body;
for (const kind of kinds) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `width:${W}px;height:${H}px;position:relative;`;
  const label = document.createElement('div');
  label.textContent = kind;
  label.style.cssText = 'position:absolute;left:10px;top:8px;z-index:2;font:600 15px system-ui;'
    + 'color:#fff;text-shadow:0 1px 3px #000;letter-spacing:.04em';
  wrap.appendChild(label);

  const canvas = document.createElement('canvas');
  canvas.width = W * 2; canvas.height = H * 2;
  canvas.style.cssText = `width:${W}px;height:${H}px;display:block`;
  wrap.appendChild(canvas);
  strip.appendChild(wrap);

  const room = buildInterior(kind, theme);
  const lit = room.lit || {};
  const scene = new Scene();
  scene.background = new Color(lit.bg ?? 0x101318);
  scene.add(room.group);
  const hemi = new HemisphereLight(lit.sky ?? 0xffffff, lit.ground ?? 0x404040, lit.hemi ?? 1.6);
  scene.add(hemi);
  const sun = new DirectionalLight(lit.sun ?? 0xffffff, lit.sunI ?? 1);
  sun.position.set(4, 9, 3); sun.castShadow = true;
  scene.add(sun);
  const rim = new DirectionalLight(lit.rim ?? 0x8899ff, lit.rimI ?? 0.3);
  rim.position.set(-5, 4, -6);
  scene.add(rim);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(2);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = LinearToneMapping;
  renderer.toneMappingExposure = lit.exposure ?? 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  // The room runs from the door wall at z = 0 back to z = -d, so a camera at
  // positive z is outside it looking at the back of a wall. Stand just inside
  // the door, up near the ceiling, and look down the length of the room.
  const cam = new PerspectiveCamera(62, W / H, 0.1, 200);
  const d = room.dims;
  cam.position.set(d.hw * 0.52, d.h * 0.86, -0.55);
  cam.lookAt(new Vector3(0, 1, -d.d * 0.6));
  room.tick?.(0.3);
  renderer.render(scene, cam);
}
document.title = 'rooms-ready';
