/**
 * Sculpted, rigged creatures — and the animation that brings them to life.
 *
 * The game has always generated every creature from code. That is why it loads
 * from a link in a second, and it is also the ceiling on how it looks: no
 * amount of shading turns spheres and cones into a character somebody designed.
 * This module is the other road. Every species maps to a real model with a real
 * skeleton, and the procedural body stays as the fallback for anything without
 * one, so a missing file costs nothing.
 *
 * The models ship rigged but with no animation clips at all, which sounds like
 * a problem and is actually the better deal: hand clips would be three poses on
 * a loop, whereas a skeleton can be driven. Everything below `resolveRig` is a
 * small animation system that reads the bone names, works out whether it is
 * looking at a quadruped or a biped, and drives the real joints — gait, spine
 * counter-rotation, head lead, tail sway — from the creature's actual speed.
 *
 * Provenance and licence: CREDITS.md. All of it is CC0; read that file before
 * adding an entry, because a pack with attribution terms has to be credited in
 * the shipped game, not just in the repo.
 */
import {
  AnimationMixer, BackSide, Box3, Color, Group, LoopOnce, LoopRepeat,
  MeshBasicMaterial, MeshToonMaterial, Quaternion, SkinnedMesh, Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { QUALITY, STYLE, toonGradient } from './core.js';

/**
 * Where model files are served from.
 *
 * Same-origin by default: the page and its models sit next to each other in the
 * build output, which is the only arrangement that works on a static host and
 * inside an artifact, where external origins are blocked outright.
 */
let BASE = './models/';
let INLINE = null;
export function setModelBase(base, inline) {
  if (base) BASE = base;
  if (inline) INLINE = inline;
}

/**
 * species id -> model.
 *
 * `size` is the creature's largest dimension in metres, and it is not a taste
 * decision: it is measured from the procedural body this model replaces
 * (`npm run audit`), so swapping a species changes how it looks and nothing
 * else — not the framing, not the battle camera, not where it stands.
 */
export const MODELS = {
  // ember
  cindcub: { file: 'trihound.glb', size: 1.6 },
  pyrelynx: { file: 'octogecko.glb', size: 3.0 },
  vulcanth: { file: 'heptangle.glb', size: 3.1 },
  // aqua
  puddlet: { file: 'sauris.glb', size: 1.1 },
  tidefin: { file: 'rectashark.glb', size: 2.4, floats: true },
  maelstride: { file: 'squaresquid.glb', size: 3.0 },
  // verdant
  sproutle: { file: 'starplant.glb', size: 1.0 },
  thornkin: { file: 'cacturnion.glb', size: 1.8 },
  verdammoth: { file: 'owltron.glb', size: 3.9 },
  // volt
  sparkit: { file: 'symbbit.glb', size: 1.2 },
  voltmane: { file: 'cobrangle.glb', size: 2.4 },
  // terra
  pebblin: { file: 'beaveriangle.glb', size: 1.2 },
  boulderon: { file: 'orclygon.glb', size: 2.5 },
  // gale
  zephyrb: { file: 'pentachick.glb', size: 1.5 },
  cirrowing: { file: 'natiangle.glb', size: 3.2 },
  // frost
  frostnib: { file: 'penguiton.glb', size: 1.0 },
  glacilisk: { file: 'scorpy.glb', size: 2.7 },
  // umbra
  umbrat: { file: 'mousylon.glb', size: 1.2 },
  nocturnix: { file: 'hexowl.glb', size: 2.8 },
  // lumen
  glimmer: { file: 'mushroomy.glb', size: 0.9 },
  solaraith: { file: 'binguilon.glb', size: 1.6 },
  // metal
  coglet: { file: 'vguy.glb', size: 1.1 },
  ferrogeist: { file: 'boargram.glb', size: 2.5 },
  // mixed commons
  mossnail: { file: 'snailus.glb', size: 0.7 },
  emberfly: { file: 'rhomgon.glb', size: 1.1, floats: true },
  // rare and legendary
  duskmaw: { file: 'triangaroo.glb', size: 2.8 },
  aurorix: { file: 'mermalygon.glb', size: 5.0, floats: true },
  // bosses
  magmadon: { file: 'bigfighter.glb', size: 7.7 },
  leviathorn: { file: 'turtlelion.glb', size: 8.0 },
  nullwarden: { file: 'bigsastylon.glb', size: 9.3 },
  rootfather: { file: 'penturtlen.glb', size: 7.8 },
  stormcaller: { file: 'mewphinx.glb', size: 12.4 },
  hollowking: { file: 'triplicoon.glb', size: 5.8 },
};

/**
 * The people.
 *
 * These come the other way round from the creatures: fully animated, with clips
 * the artist authored — Idle, Walking, Running, Attack, a death — so the mixer
 * plays them and the bone-driven animator below stays out of the way.
 *
 * `tint` maps a material in the file to a colour the player chose in the
 * character creator, which is the whole reason these two were worth having:
 * a model usually means giving up customisation, and here it does not.
 */
export const AVATARS = {
  corin: {
    file: 'hero-corin.glb',
    height: 1.78,
    clips: {
      idle: 'Idle', walk: 'Walking', run: 'Running',
      attack: 'Attack', down: 'Dying Backwards',
    },
    tint: { mat_skin: 'skin', mat_hair: 'hair', mat_clothprimary: 'a', mat_clothsecondary: 'b' },
  },
  renn: {
    file: 'hero-renn.glb',
    height: 1.78,
    clips: {
      idle: 'Idle', walk: 'Walking', run: 'Running',
      attack: 'Attack', down: 'Dying Backwards', cast: 'Cast Release',
    },
    tint: { mat_hair: 'hair' },
  },
};

/** Which body a player's choice maps to. */
export function avatarFor(body) {
  return body === 'slim' ? 'renn' : 'corin';
}

/** One line each, because each pack shares one licence. */
export const MODEL_CREDIT =
  'Creature models: XYZ pack by Polygonal Mind, released CC0 (public domain).';
export const AVATAR_CREDIT =
  'Character models: Aether Star Online open assets, released CC0 (public domain).';

// ---------------------------------------------------------------------------
// loading
// ---------------------------------------------------------------------------

const loader = new GLTFLoader();
const cache = new Map();          // file -> Promise<gltf|null>

function fetchModel(file) {
  if (cache.has(file)) return cache.get(file);
  // An artifact is one page on a host that serves no model files, so that build
  // carries them in the document. Everywhere else they sit beside it.
  const url = INLINE?.[file] || globalThis.HOBILE_MODELS?.[file] || BASE + file;
  const p = new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject))
    .catch((err) => {
      // A model that will not load is not something the player should ever see
      // as a failure: the procedural body is already on screen and stays there.
      console.warn('[models] could not load', file, err?.message || err);
      return null;
    });
  cache.set(file, p);
  return p;
}

/** Warm the cache for species about to appear, so nothing pops in late. */
export function preloadModels(ids) {
  const files = new Set();
  for (const id of ids || []) if (MODELS[id]) files.add(MODELS[id].file);
  return Promise.all([...files].map(fetchModel));
}

export function hasModel(id) {
  return !!MODELS[id];
}

// ---------------------------------------------------------------------------
// look
// ---------------------------------------------------------------------------

/**
 * An outline on a skinned mesh cannot be a scaled copy: skinning ignores the
 * mesh's own transform, so the copy would sit exactly on top of the original.
 * It has to be pushed out along the normal in the vertex shader, after the
 * skinning has been applied.
 */
function outlineMaterial(thickness) {
  const m = new MeshBasicMaterial({
    color: new Color(STYLE.outlineColor),
    side: BackSide,
    transparent: true,
    opacity: STYLE.outlineOpacity,
    depthWrite: false,
  });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uThickness = { value: thickness };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uThickness;')
      .replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\n\ttransformed += objectNormal * uThickness;',
      );
  };
  return m;
}

/**
 * Match a loaded model to the game's art direction rather than its own.
 * The baked texture is the whole point of these models, so it is kept and the
 * lighting response is what changes: flat toon bands instead of PBR falloff.
 *
 * `tint` recolours named materials from the player's own choices. The baked map
 * stays underneath, so the shading the artist painted survives the recolour
 * instead of being flattened into a block of colour.
 */
function toonify(root, outline, tint) {
  const swapped = new Map();
  const added = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    o.castShadow = true;
    o.receiveShadow = false;
    o.frustumCulled = false;      // a skinned pose can leave the bind-pose box
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (STYLE.toon) {
      const wanted = tint?.[String(src.name || '').toLowerCase()] || null;
      const key = wanted ? `${src.uuid}|${wanted}` : src.uuid;
      let toon = swapped.get(key);
      if (!toon) {
        toon = new MeshToonMaterial({
          map: src.map || null,
          color: wanted || (src.map ? 0xffffff : (src.color?.clone?.() ?? 0xffffff)),
          gradientMap: toonGradient(STYLE.bands),
          transparent: src.transparent,
          opacity: src.opacity ?? 1,
          side: src.side,
        });
        swapped.set(key, toon);
      }
      o.material = toon;
    }
    if (outline && o.isSkinnedMesh) added.push(o);
  });

  for (const mesh of added) {
    const shell = new SkinnedMesh(mesh.geometry, outline);
    shell.bind(mesh.skeleton, mesh.bindMatrix);
    shell.bindMode = mesh.bindMode;
    shell.renderOrder = -1;
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.frustumCulled = false;
    shell.userData.noOutline = true;
    mesh.parent.add(shell);
  }
}

// ---------------------------------------------------------------------------
// the rig
// ---------------------------------------------------------------------------

/**
 * Split a bone name into what it is, which side it is on, and where it sits in
 * its chain.
 *
 * The pack was rigged by hand over several years, so the names are related
 * rather than identical: `front_shin.R`, `frontleg.002.R`, `leg.001.R`,
 * `Wing.L.002`, `LargeTentacle.003.L`, `back_fin.T.001.Bk`. They all share a
 * grammar — dotted parts, an optional side, an optional index — so parsing the
 * grammar handles every model in the pack and most rigs outside it, where
 * matching literal names would handle about a third.
 */
function parseBone(rawName) {
  // The loader strips dots and colons out of node names, so `front_thigh.L`
  // arrives as `front_thighL` and `leg.001.R` as `leg001R`. Case is the only
  // separator left, which is why this reads the raw name and lowercases last:
  // `tail` ends in an l, and lowercasing first would make it a left-side `tai`.
  let n = String(rawName).replace(/^mixamorig/i, '').replace(/^Kid/, '');
  let side = null;
  // A side marker is an L or R with nothing after it but its index.
  const sideAt = n.match(/([LR])(?=\d*$)/);
  if (sideAt) {
    side = sideAt[1].toLowerCase();
    n = n.slice(0, sideAt.index) + n.slice(sideAt.index + 1);
  }
  let index = 0;
  const digits = n.match(/\d+/g);
  if (digits) index = Number(digits[digits.length - 1]);
  const base = n.replace(/\d+/g, '').replace(/[_-]+$/, '').toLowerCase();
  return { base, side, index };
}

/**
 * Work out what the bones are for.
 *
 * Roles, not names: a chain of bones from hip to toe is a leg whether it was
 * called `thigh/shin/foot` or `leg.001/leg.002/foot`, and the animator should
 * never have to care which. What comes back says how this creature is built —
 * four legs, two legs and two arms, wings, a body that swims — and the animator
 * reads that, so one set of movement rules covers a pack of thirty-three.
 *
 * Bones whose names end in IK or PT are rigging handles with no skin weights.
 * Leaving them alone is deliberate: moving them does nothing and costs time.
 */
function resolveRig(root) {
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isBone) return;
    const { base, side, index } = parseBone(o.name);
    if (/(ik|pt)$/.test(base)) return;
    const key = `${base}|${side || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ index, bone: o });
  });
  for (const [k, list] of groups) {
    list.sort((a, b) => a.index - b.index);
    groups.set(k, list.map((e) => e.bone));
  }
  const g = (base, side = '') => groups.get(`${base}|${side}`) || [];

  const spine = [...g('spine'), ...g('stem')];
  const head = g('head')[0] || g('neck')[0] || null;
  const tails = [...groups.entries()]
    .filter(([k]) => /^(tail|middletail)\|/.test(k))
    .map(([, v]) => v);
  const appendages = [...groups.entries()]
    .filter(([k]) => /tentacle|fin|leaf|frill|antenna/.test(k))
    .map(([, v]) => v);

  const front = (s) => (g('front_thigh', s).length
    ? [...g('front_thigh', s), ...g('front_shin', s), ...g('front_foot', s)]
    : [...g('frontleg', s), ...g('frontfoot', s)]);
  const hind = (s) => {
    if (g('upleg', s).length) return [...g('upleg', s), ...g('leg', s), ...g('foot', s)];
    if (g('thigh', s).length) return [...g('thigh', s), ...g('shin', s), ...g('foot', s)];
    if (g('backleg', s).length) {
      return [...g('backleg', s), ...g('backfoot', s), ...g('backlfoot', s)];
    }
    return [...g('leg', s), ...g('foot', s)];
  };
  const arm = (s) => (g('arm', s).length
    ? [...g('arm', s), ...g('forearm', s), ...g('hand', s)]
    : [...g('upperarm', s), ...g('bottomarm', s)]);

  const frontLegs = [front('l'), front('r')].filter((l) => l.length);
  const hindLegs = [hind('l'), hind('r')].filter((l) => l.length);
  const arms = [arm('l'), arm('r')].filter((a) => a.length);
  const wings = [g('wing', 'l'), g('wing', 'r')].filter((w) => w.length);

  // Front legs lead and back legs trail — the diagonal gait every four-legged
  // animal walks with. On two legs the arms counter-swing against them.
  const legs = [...frontLegs, ...hindLegs];
  const phases = frontLegs.length
    ? [0, Math.PI, Math.PI, 0].slice(0, legs.length)
    : [0, Math.PI].slice(0, legs.length);

  const quad = frontLegs.length >= 2;
  const mode = legs.length ? (quad ? 'quad' : 'biped') : (wings.length ? 'flyer' : 'swim');
  return { spine, head, tails, appendages, legs, arms, wings, phases, quad, mode };
}

/**
 * Cache each bone's rest pose and its axes expressed in its parent's frame.
 *
 * Doing it this way is what makes one animator work across a whole pack. A bone
 * rotated about its own X may swing a leg forwards on one model and sideways on
 * the next, depending on how the rigger rolled it; a bone rotated about the
 * *model's* right-hand axis swings a leg forwards on all of them. The axes are
 * resolved once, from the rest pose, so the per-frame cost is one quaternion.
 */
const _pq = new Quaternion();
const _rq = new Quaternion();

function bindBone(bone, rootQuat) {
  if (!bone || bone.userData.__hb) return bone?.userData.__hb || null;
  bone.parent.getWorldQuaternion(_pq).invert();
  // world axis -> model space -> parent space
  const toParent = (x, y, z) => new Vector3(x, y, z)
    .applyQuaternion(rootQuat)
    .applyQuaternion(_pq)
    .normalize();
  const rec = {
    node: bone,
    rest: bone.quaternion.clone(),
    right: toParent(1, 0, 0),
    up: toParent(0, 1, 0),
    fwd: toParent(0, 0, 1),
    q: new Quaternion(),
    tmp: new Quaternion(),
  };
  bone.userData.__hb = rec;
  return rec;
}

function bindRig(rig, root) {
  root.updateWorldMatrix(true, true);
  root.getWorldQuaternion(_rq);
  const map = (b) => bindBone(b, _rq);
  const chain = (list) => list.map(map);
  rig.bound = {
    spine: chain(rig.spine),
    head: rig.head ? map(rig.head) : null,
    tails: rig.tails.map(chain),
    appendages: rig.appendages.map(chain),
    legs: rig.legs.map(chain),
    arms: rig.arms.map(chain),
    wings: rig.wings.map(chain),
  };
  rig.bound.all = [
    ...rig.bound.spine, rig.bound.head,
    ...rig.bound.tails.flat(), ...rig.bound.appendages.flat(),
    ...rig.bound.legs.flat(), ...rig.bound.arms.flat(), ...rig.bound.wings.flat(),
  ].filter(Boolean);
  return rig;
}

/** Start every animated bone from its rest pose, before the pose is built up. */
function resetPose(bound) {
  for (const rec of bound.all) rec.q.copy(rec.rest);
}

/** Rotate a bone about an axis of the model, on top of whatever it already has. */
function turn(rec, axis, angle) {
  if (!rec || !angle) return;
  rec.tmp.setFromAxisAngle(rec[axis], angle);
  rec.q.premultiply(rec.tmp);
}

function applyPose(bound) {
  for (const rec of bound.all) rec.node.quaternion.copy(rec.q);
}

// ---------------------------------------------------------------------------
// attaching
// ---------------------------------------------------------------------------

/**
 * Swap a procedurally built group for its model, in place.
 *
 * In place matters: the group is already parented, already tracked by the
 * battle view and the world view, already carrying userData that other code
 * reads every frame. Replacing the object would mean chasing every reference.
 */
export async function attachModel(group, speciesId) {
  const def = MODELS[speciesId];
  if (!def || !group) return false;
  const gltf = await fetchModel(def.file);
  if (!gltf || !group.parent) return false;      // removed while we were loading

  const model = cloneSkinned(gltf.scene);
  const outline = STYLE.outline > 0 && QUALITY.tier !== 'low'
    ? outlineMaterial(def.outline ?? 0.012) : null;
  toonify(model, outline);

  // Scale from the model's own measurements, so a pack's units never matter.
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const span = Math.max(size.x, size.y, size.z) || 1;
  const scale = (def.size || 1) / span;
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;
  model.position.x = -((box.min.x + box.max.x) / 2) * scale;
  model.position.z = -((box.min.z + box.max.z) / 2) * scale;
  if (def.yaw) model.rotation.y = def.yaw;

  const holder = new Group();
  holder.add(model);

  // Drop the procedural body but keep everything else the group carries.
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse?.((o) => { if (o.isMesh) o.geometry?.dispose?.(); });
  }
  group.add(holder);

  const rig = bindRig(resolveRig(model), model);
  group.userData.model = {
    def, rig, holder,
    height: size.y * scale,
    phase: Math.random() * Math.PI * 2,
    gait: 0,          // the walk cycle's own clock, so speed changes never snap
    blend: 0,         // 0 idle, 1 walking
    last: null,
  };
  group.userData.rig = null;      // the procedural rig is gone; bones drive it now
  return true;
}

/**
 * Chibi proportions, set on the bones.
 *
 * Both humanoids are drawn at adult proportions — about seven heads tall, a
 * long spine, a cloak to the ankles — which is a realistic figure in a world
 * the brief calls cute and casual. A big head, stubby legs, shorter arms and
 * chunky hands and feet turn the same rig, the same clips and the same colour
 * tinting into the MapleStory-sized hero the brief asked for, with nothing
 * re-modelled. Legs are shortened along the bone rather than shrunk, so they
 * read stocky instead of spindly.
 *
 * The exporter wrote a scale key for every bone on every frame — all 1.0 — so
 * the mixer would put the adult proportions back on the next frame. Those
 * tracks are dropped once per file; rotation and translation are untouched.
 */
const CHIBI = {
  Head: [1.55, 1.55, 1.55],
  LeftArm: [0.86, 0.86, 0.86], RightArm: [0.86, 0.86, 0.86],
  LeftHand: [1.3, 1.3, 1.3], RightHand: [1.3, 1.3, 1.3],
  LeftUpLeg: [0.97, 0.74, 0.97], RightUpLeg: [0.97, 0.74, 0.97],
  LeftLeg: [1, 0.9, 1], RightLeg: [1, 0.9, 1],
  LeftFoot: [1.3, 1.3, 1.3], RightFoot: [1.3, 1.3, 1.3],
};
/** Of the adult height. Small next to a door, which is most of what reads cute. */
export const CHIBI_HEIGHT = 0.8;
const clipsNoScale = new WeakMap();
function playableClips(gltf) {
  let clips = clipsNoScale.get(gltf);
  if (!clips) {
    clips = gltf.animations.map((a) => {
      const c = a.clone();
      c.tracks = c.tracks.filter((t) => !t.name.endsWith('.scale'));
      return c;
    });
    clipsNoScale.set(gltf, clips);
  }
  return clips;
}
function chibify(model) {
  model.traverse((o) => {
    const k = o.isBone && CHIBI[o.name];
    if (k) o.scale.set(k[0], k[1], k[2]);
  });
  model.updateMatrixWorld(true);
}

/**
 * Swap a procedurally built avatar for its model, in place.
 *
 * Same surgery as `attachModel`, but these files carry their own animation, so
 * what gets stored is a mixer and a set of named actions rather than a rig.
 */
export async function attachAvatar(group, appearance = {}) {
  const def = AVATARS[avatarFor(appearance.body)];
  if (!def || !group) return false;
  const gltf = await fetchModel(def.file);
  if (!gltf || !group.parent) return false;

  const outfit = appearance.outfit || {};
  const tint = {};
  for (const [material, slot] of Object.entries(def.tint || {})) {
    const colour = slot === 'skin' ? appearance.skin
      : slot === 'hair' ? appearance.hair
        : slot === 'a' ? (outfit.a || appearance.outfitA)
          : (outfit.b || appearance.outfitB);
    if (colour) tint[material] = new Color(colour);
  }

  const model = cloneSkinned(gltf.scene);
  const outline = STYLE.outline > 0 && QUALITY.tier !== 'low'
    ? outlineMaterial(0.009) : null;
  toonify(model, outline, tint);
  chibify(model);

  // Measured after the proportions change, so the feet land on the ground.
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const height = def.height * CHIBI_HEIGHT * (appearance.body === 'tall' ? 1.045
    : appearance.body === 'stocky' ? 0.955 : 1);
  const scale = height / Math.max(0.001, size.y);
  model.scale.set(scale * (appearance.body === 'stocky' ? 1.1 : 1), scale, scale);
  model.position.y = -box.min.y * scale;

  const holder = new Group();
  holder.add(model);
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse?.((o) => { if (o.isMesh) o.geometry?.dispose?.(); });
  }
  group.add(holder);

  const mixer = new AnimationMixer(model);
  const actions = {};
  const clips = playableClips(gltf);
  for (const [state, name] of Object.entries(def.clips)) {
    const clip = clips.find((c) => c.name === name);
    if (clip) actions[state] = mixer.clipAction(clip);
  }
  actions.idle?.play();

  group.userData.model = {
    def, mixer, actions, holder, height,
    current: 'idle', once: null, last: null,
  };
  group.userData.rig = null;
  group.userData.height = height;
  return true;
}

/**
 * Play a one-shot clip — a punch, a knockdown — and fall back to the walk cycle
 * when it finishes. A no-op on anything that has no such clip, so callers never
 * have to ask what kind of thing they are animating.
 */
export function playClip(group, name, { hold = false } = {}) {
  const m = group?.userData?.model;
  const action = m?.actions?.[name];
  if (!action) return false;
  action.reset();
  action.setLoop(hold ? LoopRepeat : LoopOnce, hold ? Infinity : 1);
  action.clampWhenFinished = hold;
  action.fadeIn(0.12).play();
  const from = m.actions[m.current];
  if (from && from !== action) from.fadeOut(0.12);
  m.once = hold ? null : { action, until: action.getClip().duration };
  m.current = name;
  return true;
}

// ---------------------------------------------------------------------------
// the animator
// ---------------------------------------------------------------------------

/**
 * Advance a model-backed creature. Returns false when the creature has no
 * model, so the caller falls through to the procedural animation.
 *
 * `timeMs` is the absolute clock the rest of the animation code runs on, not a
 * delta; every call site already has it, and the delta is derived per creature
 * so that one going off screen for a second and coming back does not jump a
 * second of walk cycle.
 */
export function animateModel(group, timeMs, moving, speed = 1) {
  const m = group?.userData?.model;
  if (!m) return false;
  const dt = m.last == null ? 0.016 : Math.min(0.1, Math.max(0, (timeMs - m.last) * 0.001));
  m.last = timeMs;

  // A model that came with its own clips is played, not driven.
  if (m.mixer) {
    if (m.once) {
      m.once.until -= dt;
      if (m.once.until <= 0) m.once = null;
    }
    const gs = group.userData.groundSpeed;
    if (!m.once) {
      const fast = gs != null ? gs > 1.7 * (m.height || 1) : speed > 1.6;
      const want = !moving ? 'idle' : (fast && m.actions.run ? 'run' : 'walk');
      if (want !== m.current && m.actions[want]) {
        const to = m.actions[want];
        const from = m.actions[m.current];
        to.reset().setLoop(LoopRepeat, Infinity).fadeIn(0.22).play();
        if (from && from !== to) from.fadeOut(0.22);
        m.current = want;
      }
    }
    // Feet that keep pace with the ground: a clip's own stride, in metres per
    // second, is about 0.88 of the body's height walking and 2.3 running.
    const act = m.actions[m.current];
    if (act && gs != null && !m.once) {
      act.timeScale = m.current === 'idle' ? 1
        : Math.min(2.4, Math.max(0.6, gs / ((m.current === 'run' ? 2.3 : 0.88) * (m.height || 1))));
    }
    m.mixer.update(dt);
    group.position.y = group.userData.baseY || 0;
    return true;
  }
  if (!m.rig?.bound) return true;

  const t = timeMs * 0.001 + m.phase;
  const gs = group.userData.groundSpeed;
  const run = gs != null ? gs > 1.7 * (m.height || 1) : speed > 1.6;
  // Ease between standing and walking instead of switching: a creature that
  // snaps from one to the other reads as a puppet.
  const target = moving ? 1 : 0;
  m.blend += Math.max(-1, Math.min(1, target - m.blend)) * Math.min(1, dt * 7);
  const k = m.blend;

  // The gait keeps pace with the ground (a cycle is about 1.1 body-heights),
  // within bounds a leg can still be seen to swing.
  const pace = (run ? 9.2 : 6.2) * speed;
  const rate = gs != null && moving
    ? Math.min(pace * 2.2, Math.max(pace * 0.6, Math.PI * 2 * gs / (1.1 * (m.height || 1))))
    : pace;
  m.gait += dt * rate;
  const p = m.gait;
  const { bound, mode } = m.rig;
  resetPose(bound);

  const amp = (run ? 0.85 : 0.62) * k;
  const idle = 1 - k * 0.8;
  const swims = mode === 'swim';

  // --- breathing under everything, and for a body with no legs, the swim
  // itself: a wave travelling down the spine, which is how a shark, a snake
  // and a squid all move.
  const breathe = Math.sin(t * 1.55);
  const n = bound.spine.length;
  bound.spine.forEach((rec, i) => {
    const f = (i + 1) / (n + 1);
    turn(rec, 'right', breathe * 0.022 * f * idle);
    if (swims) {
      turn(rec, 'up', Math.sin(t * 2.2 + p * 0.35 - i * 0.8) * (0.07 + 0.09 * k));
    } else {
      turn(rec, 'fwd', Math.sin(p) * 0.05 * f * k);
      turn(rec, 'up', Math.sin(p * 0.5) * 0.045 * f * k);
    }
  });

  // --- head: leads into the walk, drifts and looks around when standing
  if (bound.head) {
    turn(bound.head, 'right', (Math.sin(t * 1.55 + 0.7) * 0.05 * idle) - k * 0.1);
    turn(bound.head, 'up', Math.sin(t * 0.62) * 0.13 * idle);
    turn(bound.head, 'fwd', Math.sin(p + 0.4) * 0.06 * k);
  }

  // --- tails, tentacles, fins, leaves: a wave travelling down each chain,
  // each with its own speed, so nothing moves in lockstep
  bound.tails.forEach((chain, c) => {
    chain.forEach((rec, i) => {
      turn(rec, 'up', Math.sin((t * 1.9 + p * 0.55) - i * 0.7 + c * 1.1) * (0.12 + 0.1 * k));
      turn(rec, 'right', Math.sin(t * 1.2 - i * 0.5) * 0.05);
    });
  });
  bound.appendages.forEach((chain, c) => {
    chain.forEach((rec, i) => {
      const w = Math.sin(t * (1.3 + c * 0.17) - i * 0.85 + c);
      turn(rec, 'right', w * (0.09 + 0.06 * k));
      turn(rec, 'up', Math.cos(t * 1.1 - i * 0.6 + c) * 0.05);
    });
  });

  // --- wings: a flap, deep and slow when hovering, shallower at speed
  const flap = Math.sin(t * (moving ? 7.4 : 3.1));
  bound.wings.forEach((chain, s) => {
    const dir = s === 0 ? 1 : -1;
    chain.forEach((rec, i) => {
      const lag = 1 - i * 0.22;
      turn(rec, 'fwd', dir * flap * 0.34 * lag);
      turn(rec, 'right', flap * 0.08 * lag);
    });
  });

  // --- the gait
  bound.legs.forEach((leg, i) => {
    const [hip, knee, foot] = leg;
    const ph = p + m.rig.phases[i];
    const swing = Math.sin(ph);
    // Knees only bend one way, so the lower joint is driven by a rectified
    // wave — a leg that bends backwards is the clearest sign of a fake walk.
    const bend = Math.max(0, -Math.sin(ph + 0.85));
    turn(hip, 'right', swing * amp * 0.55 + Math.sin(t * 1.5 + i) * 0.012 * idle);
    turn(knee, 'right', bend * amp * 0.9);
    turn(foot, 'right', -swing * amp * 0.28);
  });

  // Arms counter-swing against the legs; when standing they just hang and breathe.
  bound.arms.forEach((a, i) => {
    const [upper, fore] = a;
    const ph = p + (i === 0 ? Math.PI : 0);
    turn(upper, 'right', Math.sin(ph) * amp * 0.45);
    turn(fore, 'right', Math.max(0, Math.sin(ph + 0.5)) * amp * 0.35);
    turn(upper, 'fwd', (i ? -1 : 1) * (0.05 + Math.sin(t * 1.5) * 0.03) * idle);
  });

  applyPose(bound);

  // --- the body itself: bob on each step, lean into a run, hover if it flies
  const base = group.userData.baseY || 0;
  const floats = group.userData.floats || m.def.floats || mode === 'swim';
  if (floats) {
    group.position.y = base + m.height * 0.18 + Math.sin(t * 1.35) * m.height * 0.05;
  } else {
    group.position.y = base + Math.abs(Math.sin(p)) * m.height * 0.022 * k;
  }
  const holder = m.holder;
  holder.rotation.x = -k * (run ? 0.1 : 0.045);
  holder.rotation.z = Math.sin(p) * 0.03 * k;
  return true;
}

/** Everything that has to appear in the game's credits. */
export function modelCredits() {
  return [MODEL_CREDIT, AVATAR_CREDIT];
}
