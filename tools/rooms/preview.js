// Browser entry for the interior contact sheet. Builds each room straight out
// of `buildInterior` — no game, no server, no walking to a door — and lights it
// the way the game lights it, including the point lights the game adds from
// `room.points`. Without those the archive photographs as a black box with a
// light shaft in it, which is a fact about this tool, not about the room.
//
// Two views per room, because one is a liar: an eye-level shot from the door
// hides whatever is against the side walls, and a workshop with a forge, an
// anvil, a quench barrel and a tool rack can photograph as an empty floor.
import {
  Scene, PerspectiveCamera, WebGLRenderer, HemisphereLight, DirectionalLight,
  PointLight, Fog, Color, Vector3, SRGBColorSpace, PCFSoftShadowMap, LinearToneMapping,
} from 'three';
import { buildInterior, INTERIORS, zoneTheme, SUN_DIR } from '../../src/client/gfx/world.js';

const kinds = window.ROOMS || Object.keys(INTERIORS);
const W = window.CELL_W || 560;
const H = window.CELL_H || 420;
const theme = zoneTheme({ id: 'aetherport', urban: true, element: 'verdant' });

const VIEWS = [
  // wide, from just inside the door and high enough to see both side walls —
  // an eye-level shot down the middle hides whatever is against them, and a
  // workshop with a forge, an anvil, a quench barrel and a tool rack can
  // photograph as an empty floor
  (d) => ({ from: [0, d.h * 0.7, -0.7], at: [0, 1, -d.d * 0.72], fov: 86, tag: 'from the door' }),
  // the same from the back, looking at the door — on the centre line, because
  // the corners are where the heavy things live: the archive's shelving stands
  // 0.8m proud of the wall and the workshop's forge fills its back left, and a
  // camera in either photographs the inside of a solid
  (d) => ({ from: [0, d.h * 0.78, -d.d * 0.86], at: [0, 1, -d.d * 0.1], fov: 84, tag: 'from the back' }),
];

for (const kind of kinds) {
  const room = buildInterior(kind, theme);
  const lit = room.lit || {};
  const d = room.dims;

  const scene = new Scene();
  scene.background = new Color(lit.bg ?? 0x101318);
  scene.fog = new Fog(lit.fog ?? 0x101318, lit.near ?? 12, lit.far ?? 32);
  scene.add(room.group);
  scene.add(new HemisphereLight(lit.sky ?? 0xffffff, lit.ground ?? 0x404040, lit.hemi ?? 1.6));
  const sun = new DirectionalLight(lit.sun ?? 0xffffff, lit.sunI ?? 1);
  sun.position.copy(SUN_DIR).multiplyScalar(30); sun.castShadow = true;
  scene.add(sun);
  const rim = new DirectionalLight(lit.rim ?? 0x8899ff, lit.rimI ?? 0.3);
  rim.position.set(-SUN_DIR.x * 20, 8, -SUN_DIR.z * 20);
  scene.add(rim);
  for (const pt of room.points || []) {
    const l = new PointLight(pt.color, pt.power, pt.range, 2);
    l.position.set(pt.x, pt.y, pt.z);
    scene.add(l);
  }
  room.tick?.(0.3);

  for (const make of VIEWS) {
    const v = make(d);
    const wrap = document.createElement('div');
    wrap.style.cssText = `width:${W}px;height:${H}px;position:relative`;
    const label = document.createElement('div');
    label.textContent = `${kind} — ${v.tag}`;
    label.style.cssText = 'position:absolute;left:10px;top:8px;z-index:2;font:600 14px system-ui;'
      + 'color:#fff;text-shadow:0 1px 3px #000;letter-spacing:.04em';
    wrap.appendChild(label);
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `width:${W}px;height:${H}px;display:block`;
    wrap.appendChild(canvas);
    document.body.appendChild(wrap);

    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(2);
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = LinearToneMapping;
    renderer.toneMappingExposure = lit.exposure ?? 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;

    const cam = new PerspectiveCamera(v.fov, W / H, 0.1, 200);
    cam.position.set(...v.from);
    cam.lookAt(new Vector3(...v.at));
    renderer.render(scene, cam);
  }
}
document.title = 'rooms-ready';
