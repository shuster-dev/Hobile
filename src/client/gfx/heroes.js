// The player characters as real models (KayKit Character Pack Adventures,
// CC0 — CREDITS.md): five adventurers on one skeleton, with the pack's own
// hand-made clips — a walk, a run, a throw, a cheer, a flinch, sitting.
//
// A person is built as the code-sculpted figure first (people.js), which is
// on screen at once, and `dressHero` swaps the model in when its file has
// arrived: in place, in the same group, at the same height, so nothing that
// holds the group has to know. Until then, or if a file never comes, the
// figure stays.
//
// What a player chose is painted into the model's colour atlas (8 × 4 cells
// of flat swatches, the same cells on all five): the skin cell takes the skin
// tone, the hair cell the hair, the main cloth's cells the tailor's dye — each
// pixel keeps how much lighter or darker it was than its cell. What they wear
// from the tailor (wardrobe3d.js) is fixed to the head or the chest bone, so
// it moves with every clip.
import { AnimationMixer, Box3, BoxGeometry, CanvasTexture, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, TorusGeometry, LoopOnce, LoopRepeat, Matrix4, MeshToonMaterial, Quaternion, SRGBColorSpace, SkinnedMesh, Vector3 } from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { QUALITY, STYLE, toonGradient } from './core.js';
import { loadModelFile, outlineMaterial } from './models.js';
import { BACKS, FACES, HATS, DYES } from '../../shared/cosmetics.js';
import { buildBack, buildFace, buildHat } from './wardrobe3d.js';

export const HERO_ANIMS = 'kk_hero_anims.glb';

// cells of the atlas, [column, row] from the top left
const SKIN = [0, 0], HAIR = [1, 0], MAIN = [[0, 1], [1, 1]];

/**
 * kind -> its model and what it does. `show` is its show-off move (the
 * creator, a critical hit) with what it holds for it; `gear` its own
 * headwear, worn in one of the two looks (`gearOn`) and off under a hat from
 * the tailor; `hairB` the hair of its second look.
 */
export const HEROES = {
  rogue: { file: 'kk_hero_rogue.glb', show: ['1H_Melee_Attack_Stab', ['Knife', 'Knife_Offhand']], attack: '1H_Melee_Attack_Stab', hairB: 0x2c2226 },
  ranger: { file: 'kk_hero_ranger.glb', show: ['1H_Ranged_Shoot', ['1H_Crossbow']], attack: '1H_Ranged_Shoot', hairB: 0x2c2226, hood: true },
  mage: { file: 'kk_hero_mage.glb', show: ['Spellcast_Shoot', ['1H_Wand']], attack: 'Spellcast_Shoot', hairB: 0xd8d0c8, gear: 'Mage_Hat', gearOn: 'a', skin: [[0, 0], [7, 2]] },
  knight: { file: 'kk_hero_knight.glb', show: ['1H_Melee_Attack_Chop', ['1H_Sword', 'Round_Shield']], attack: '1H_Melee_Attack_Chop', hairB: 0x6b3a2a, gear: 'Knight_Helmet', gearOn: 'b' },
  barbarian: { file: 'kk_hero_barbarian.glb', show: ['2H_Melee_Attack_Spin', ['2H_Axe']], attack: '2H_Melee_Attack_Spin', hairB: 0x3a2a22, gear: 'Barbarian_Hat', gearOn: 'a' },
};

/** A kind from before the models, as the adventurer that is nearest it. */
export const HERO_ALIAS = { pirate: 'barbarian', fire: 'mage', catcher: 'knight', explorer: 'knight' };
export const heroKind = (kind) => (HEROES[kind] ? kind : HERO_ALIAS[kind] || null);

// the clips, by what the game asks for
const CLIPS = { idle: 'Idle', walk: 'Walking_A', run: 'Running_A', ride: 'Sit_Chair_Idle', throw: 'Throw', cheer: 'Cheer', hit: 'Hit_A', faint: 'Death_A', jump: 'Jump_Full_Short', use: 'Use_Item' };
// a trainer's own weapon (shared/arms.js), whatever kind they are
const ARM_CLIPS = { swing: '1H_Melee_Attack_Chop', smash: '2H_Melee_Attack_Spin', shoot: '1H_Ranged_Shoot', cast: 'Spellcast_Shoot' };
const HELD = /Knife|Crossbow|Throwable|Sword|Shield|Wand|Staff|Spellbook|Axe|Mug/;

// -- the colour atlas, painted with what was chosen -----------------------------------
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const textures = new Map();
function paintAtlas(src, key, jobs) {
  if (!jobs.length || !src?.image) return src;
  if (textures.has(key)) return textures.get(key);
  const img = src.image, W = img.width, H = img.height;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0, W, H);
  const cw = W / 8, ch = H / 4;
  for (const { cell: [c, r], color } of jobs) {
    const x0 = Math.round(c * cw), y0 = Math.round(r * ch), w = Math.round(cw), h = Math.round(ch);
    const im = cx.getImageData(x0, y0, w, h), d = im.data;
    // the cell's own colour: down its middle, where there is no seam
    let ref = 0, n = 0;
    for (let y = 0; y < h; y++) { const i = (y * w + (w >> 1)) * 4; ref += lum(d[i], d[i + 1], d[i + 2]); n++; }
    ref = Math.max(8, ref / n);
    // the canvas holds sRGB bytes: the colour goes in as written
    const sr = (color >> 16) & 255, sg = (color >> 8) & 255, sb = color & 255;
    for (let i = 0; i < d.length; i += 4) {
      const k = lum(d[i], d[i + 1], d[i + 2]) / ref;
      d[i] = Math.min(255, sr * k); d[i + 1] = Math.min(255, sg * k); d[i + 2] = Math.min(255, sb * k);
    }
    cx.putImageData(im, x0, y0);
  }
  const t = new CanvasTexture(cv);
  t.flipY = src.flipY;
  t.colorSpace = SRGBColorSpace;
  t.magFilter = src.magFilter; t.minFilter = src.minFilter;
  t.anisotropy = src.anisotropy;
  textures.set(key, t);
  return t;
}

const toonMats = new Map();
function toon(map, key) {
  let m = toonMats.get(key);
  if (!m) toonMats.set(key, m = new MeshToonMaterial({ map, gradientMap: toonGradient(STYLE.bands) }));
  return m;
}

// -- loading ---------------------------------------------------------------------------
let anims = null;
const clipsReady = () => anims || (anims = loadModelFile(HERO_ANIMS).then((g) => g?.animations || []));

/** Fetch these kinds' models (and the clips) ahead of when they are needed. */
export function warmHeroes(kinds) {
  const files = [...new Set((kinds || []).map(heroKind).filter(Boolean))].map((k) => loadModelFile(HEROES[k].file));
  return Promise.all([clipsReady(), ...files]);
}

const _m = new Matrix4(), _v = new Vector3(), _q = new Quaternion(), _s = new Vector3();

/** Fix `item` to `bone` so that it sits at `pos` in the model's frame, upright, `unit` metres to one. */
function fixTo(bone, item, pos, unit, root) {
  root.updateMatrixWorld(true);
  const want = new Matrix4().compose(pos, root.getWorldQuaternion(_q), _s.setScalar(unit));
  item.matrix.copy(_m.copy(bone.matrixWorld).invert().multiply(want));
  item.matrix.decompose(item.position, item.quaternion, item.scale);
  bone.add(item);
}

/**
 * Swap the model in for the figure in `group`, once it is here. `look` is
 * people.js personLook's (kind, look, skin, hair, hat, dye, face, back).
 * Resolves true when it is on, false when this kind has no model or the group
 * was let go first.
 */
export async function dressHero(group, look, { outline = true } = {}) {
  const kind = heroKind(look.kind), H = HEROES[kind];
  if (!H || typeof document === 'undefined') return false;
  const [clips, gltf] = await Promise.all([clipsReady(), loadModelFile(H.file)]);
  if (!gltf?.scene || group.userData.disposed) return false;

  const model = cloneSkinned(gltf.scene);
  const hat = look.hat && HATS[look.hat], face = look.face && FACES[look.face], back = look.back && BACKS[look.back];
  const gearOn = H.gear && !hat && (look.look || 'a') === H.gearOn;
  const meshes = {};
  let headMesh = null, bodyMesh = null;
  model.traverse((o) => {
    if (o.isMesh) meshes[o.name] = o;
    if (/_Head/.test(o.name) && o.isSkinnedMesh) headMesh = o;
    if (/_Body$/.test(o.name)) bodyMesh = o;
  });

  // the atlas, painted: skin, hair (the second look's, or one chosen), the dye
  const jobs = [];
  for (const cell of H.skin || [SKIN]) jobs.push({ cell, color: new Color(look.skin).getHex() });
  const hair = look.hair ? new Color(look.hair).getHex() : look.look === 'b' ? H.hairB : null;
  hair != null && jobs.push({ cell: HAIR, color: hair });
  const dye = look.dye && DYES[look.dye];
  dye && MAIN.forEach((cell) => jobs.push({ cell, color: dye.color }));
  const vkey = `${kind}|${look.skin}|${hair ?? ''}|${look.dye || ''}`;

  const outlined = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    src.map && (src.map.colorSpace = SRGBColorSpace);
    o.material = toon(paintAtlas(src.map, vkey, jobs), `${vkey}|${src.uuid}`);
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;
    if (HELD.test(o.name)) o.visible = false;
    if (H.gear && o.name === H.gear) o.visible = !!gearOn;
    if (/_Cape$/.test(o.name) && back && !back.keepsCape) o.visible = false;
    o.isSkinnedMesh && outlined.push(o);
  });

  // stand it as tall as the figure it replaces, feet on the ground
  model.updateMatrixWorld(true);
  const box = new Box3();
  for (const n of ['_Body', '_LegLeft', '_LegRight', '_Head']) {
    const o = Object.values(meshes).find((x) => x.name.endsWith(n) || (n === '_Head' && x === headMesh));
    o && box.expandByObject(o);
  }
  const tall = (group.userData.height || 1.42);
  const s = tall / Math.max(0.1, box.max.y - box.min.y);
  model.scale.setScalar(s);
  model.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);

  const ol = outline && STYLE.outline > 0 && QUALITY.tier !== 'low' ? outlineMaterial(0.011 / s) : null;
  if (ol) {
    for (const mesh of outlined) {
      if (!mesh.visible) continue;
      const shell = new SkinnedMesh(mesh.geometry, ol);
      shell.bind(mesh.skeleton, mesh.bindMatrix);
      shell.bindMode = mesh.bindMode;
      Object.assign(shell, { renderOrder: -1, castShadow: false, receiveShadow: false, frustumCulled: false });
      shell.userData.noOutline = true;
      mesh.parent.add(shell);
    }
  }

  const holder = new Group();
  holder.name = 'hero';
  holder.add(model);
  holder.updateMatrixWorld(true);

  // what the tailor made, on the bones
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const headBone = bones.head, chest = bones.chest || bones.spine;
  if (headMesh && headBone && (hat || face)) {
    const hb = new Box3().setFromObject(headMesh);
    const u = (hb.max.x - hb.min.x) / 2;
    const dims = { hy: (hb.max.y - hb.min.y) / 2 / u, hz: (hb.max.z - hb.min.z) / 2 / u, hood: !!H.hood, ol: 0.011 / u };
    const top = new Vector3((hb.min.x + hb.max.x) / 2, hb.max.y, (hb.min.z + hb.max.z) / 2);
    if (hat) {
      const g = buildHat(hat.shape, hat.color, dims);
      g && fixTo(headBone, g, top, u, holder);
    }
    if (face) {
      const g = buildFace(face.shape, face.color, dims);
      g && fixTo(headBone, g, top.clone(), u, holder);
    }
  }
  if (bodyMesh && chest && back) {
    const bb = new Box3().setFromObject(bodyMesh);
    const u = (bb.max.x - bb.min.x) / 2;
    const g = buildBack(back.shape, back.color, { hz: (bb.max.z - bb.min.z) / 2 / u, hy: (bb.max.y - bb.min.y) / u, ol: 0.011 / u });
    g && fixTo(chest, g, new Vector3((bb.min.x + bb.max.x) / 2, bb.max.y, (bb.min.z + bb.max.z) / 2), u, holder);
  }

  // the clips
  const mixer = new AnimationMixer(model);
  const actions = {};
  for (const [name, clipName] of Object.entries({ ...CLIPS, ...ARM_CLIPS, attack: H.attack, show: H.show[0] })) {
    const clip = clips.find((c) => c.name === clipName);
    if (clip) actions[name] = mixer.clipAction(clip);
  }
  actions.idle?.play();

  // drop the figure, keep everything else the group carries
  if (group.userData.disposed) return false;
  group.userData.figure && group.remove(group.userData.figure);
  group.userData.figure = null;
  group.add(holder);

  const hips = bones.hips;
  const rec = {
    hero: true, animate: animateHero, kind, mixer, actions, current: 'idle', holder, model,
    height: tall, last: null, once: null, held: H.show[1].map((n) => meshes[n]).filter(Boolean),
    hipsY: hips ? hips.position.y : 0, hips,
    slot: model.getObjectByName('handslot.r') || model.getObjectByName('handslotr') || bones['hand.r'] || bones.handr || null, arms: {},
  };
  group.userData.model = rec;
  group.userData.rig = { arms: [bones['hand.r'] || bones.handr || bones.wristr, bones['hand.l'] || bones.handl || bones.wristl].filter(Boolean), person: true };
  group.userData.hero = kind;
  return true;
}

function fadeTo(m, name, t = 0.22, loop = true) {
  const to = m.actions[name];
  if (!to) return false;
  const from = m.actions[m.current];
  to.reset();
  to.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
  to.clampWhenFinished = !loop;
  to.timeScale = 1;
  to.fadeIn(t).play();
  if (from && from !== to) from.fadeOut(t);
  m.current = name;
  return true;
}

/**
 * The frame's pose: stand, walk or run by how fast the feet go over the
 * ground (the stride kept in step with it), sit astride when riding, and a
 * one-off move on top until it is done.
 */
function animateHero(group, m, timeMs, moving, speed = 1) {
  const dt = m.last == null ? 0.016 : Math.min(0.1, Math.max(0, (timeMs - m.last) * 0.001));
  m.last = timeMs;
  const riding = !!group.userData.riding;
  if (m.once) {
    m.once.left -= dt;
    if (m.once.left <= 0 || riding) {
      for (const o of m.held) o.visible = false;
      for (const w of Object.values(m.arms)) w.visible = false;
      m.once = null;
    }
  }
  const gs = group.userData.groundSpeed, H = m.height || 1.4;
  if (!m.once) {
    const run = gs != null ? gs > 2.1 * H : speed > 1.6;
    const want = riding ? 'ride' : !moving ? 'idle' : run ? 'run' : 'walk';
    if (want !== m.current) fadeTo(m, want);
    const act = m.actions[m.current];
    // a walk's stride is about 0.9 of the body's height, a run's about 2
    if (act && (m.current === 'walk' || m.current === 'run')) {
      act.timeScale = gs != null ? Math.min(2.2, Math.max(0.6, gs / ((m.current === 'run' ? 2.0 : 0.9) * H))) : speed;
    }
  }
  m.mixer.update(dt);
  // sitting drops the hips to a chair: on a creature's back they stay where
  // the rider was put, legs either side
  m.holder.position.y = riding && m.hips ? (m.hipsY - m.hips.position.y) * m.model.scale.y : 0;
  group.position.y = group.userData.baseY || 0;
  return true;
}

/** A one-off move (people.js personAct's names): true when this group is a model and played it. */
export function heroAct(group, name, dur) {
  const m = group?.userData?.model;
  if (!m?.hero || group.userData.riding) return !!m?.hero;
  const key = m.actions[name] ? name : name === 'attack' ? 'attack' : 'show';
  const a = m.actions[key];
  if (!a) return true;
  fadeTo(m, key, 0.12, false);
  const len = a.getClip().duration;
  m.once = { left: Math.max(0.4, Math.min(len, dur ? Math.max(dur, len * 0.9) : len) - 0.1) };
  if (key === 'show') for (const o of m.held) o.visible = true;
  return true;
}

// -- the weapon in hand --------------------------------------------------------------
// Drawn here, not taken from a model: the five kinds each came with their
// own, and a knight with a bow should hold a bow. Built along +Y from the
// grip (as the models' own props are, under `handslot.r`), about a sword long.
const armMat = (c) => new MeshToonMaterial({ color: c, gradientMap: toonGradient() });
function armMesh(arm, item) {
  const g = new Group(), wood = armMat(0x8a5a2e), steel = armMat(0xd8dee8), gold = armMat(0xe8c05a);
  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m; };
  const tint = { sword_wood: 0xc8955a, blade_storm: 0x8ac8ff, blade_ember: 0xff8a4a, hammer_titan: 0xe8b23a, bow_wind: 0x5ad8b8, staff_star: 0xffd86a, staff_rift: 0x2fe6d0 }[item];
  if (arm === 'sword') {
    add(new CylinderGeometry(0.035, 0.035, 0.22, 8), wood, 0, 0.0);
    add(new BoxGeometry(0.26, 0.05, 0.06), gold, 0, 0.13);
    add(new BoxGeometry(0.09, 0.72, 0.025), tint ? armMat(tint) : steel, 0, 0.52);
    add(new ConeGeometry(0.064, 0.14, 4), tint ? armMat(tint) : steel, 0, 0.95);
  } else if (arm === 'hammer') {
    add(new CylinderGeometry(0.035, 0.04, 0.95, 8), wood, 0, 0.32);
    add(new BoxGeometry(0.34, 0.2, 0.2), armMat(tint || 0x9aa4b4), 0, 0.82);
    add(new BoxGeometry(0.36, 0.05, 0.22), gold, 0, 0.82);
  } else if (arm === 'bow') {
    const bow = add(new TorusGeometry(0.42, 0.028, 6, 18, Math.PI * 0.9), armMat(tint || 0xa8743e), 0, 0.12, 0, 0, Math.PI * 0.55);
    bow.position.x = -0.18;
    add(new CylinderGeometry(0.006, 0.006, 0.84, 4), armMat(0xeef2f8), 0.2, 0.12);
  } else {
    add(new CylinderGeometry(0.03, 0.04, 1.1, 8), wood, 0, 0.38);
    const orb = add(new SphereGeometry(0.1, 14, 10), new MeshBasicMaterial({ color: tint || 0x7ae87a }), 0, 0.98);
    orb.userData.noOutline = true;
    add(new TorusGeometry(0.11, 0.018, 6, 14), gold, 0, 0.9, 0, Math.PI / 2);
  }
  g.traverse((o) => { o.castShadow = !!o.isMesh; });
  g.visible = false;
  return g;
}

/** The trainer strikes with what is in their hand: its move, and the weapon
 *  shown for it. True when this group is a model and did. */
export function heroStrike(group, arm, item) {
  const m = group?.userData?.model;
  if (!m?.hero || group.userData.riding) return false;
  const clip = { sword: 'swing', hammer: 'smash', bow: 'shoot', staff: 'cast' }[arm] || 'swing';
  heroAct(group, clip, 0.7);
  const key = `${arm}|${item || ''}`;
  if (m.slot && !m.arms[key]) {
    const w = armMesh(arm, item);
    // the slot's scale is the model's; the weapon is sized to the figure
    const v = new Vector3(); m.slot.getWorldScale(v);
    const k = (m.height || 1.4) * 0.55 / Math.max(1e-4, v.y || 1);
    w.scale.setScalar(k); m.slot.add(w); m.arms[key] = w;
  }
  for (const [k, w] of Object.entries(m.arms)) w.visible = k === key;
  for (const o of m.held) o.visible = false;
  return true;
}
