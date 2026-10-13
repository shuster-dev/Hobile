// The world's built things as real models (KayKit, CC0 — CREDITS.md).
//
// Houses, the forge, the windmill, the well, the town's farmhouses, the crypt
// in the grove: shapes an artist made, in place of the boxes the builders
// used to stack. What stops a walker is unchanged — the plan's and the
// props' footprints still decide that — so a model is fitted to the
// footprint it replaces: as large as it fits, never taller than `maxH`, with
// a little give in its width so it fills a lot without towering.
//
// Each model is loaded once (models.js loadModelFile, beside the page or
// inlined in the artifact), and every copy of it in a zone is one
// InstancedMesh per part — a street of twenty houses is two draw calls. A
// model with a part that turns (the windmill's sails) is cloned instead and
// its part spun. Shading is the game's: the pack's colour atlas through the
// cel ramp, with the grounding's foot shading (grounding.js).
//
// Until a model arrives its place is empty: the zone does not wait for it.
import { Box3, Group, InstancedMesh, Matrix4, MeshToonMaterial, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { STYLE, toonGradient } from './core.js';
import { groundMaterial } from './grounding.js';
import { loadModelFile } from './models.js';

/** key -> file in assets/models (tools/models/props.mjs makes them). */
export const PROP_MODELS = Object.fromEntries([
  'home_a', 'home_b', 'home_a_blue', 'home_b_blue', 'home_a_yellow', 'home_b_yellow', 'tavern', 'blacksmith', 'windmill', 'well',
  'tower', 'barrel', 'crate_big', 'crate_small', 'sack',
  'crypt', 'lantern_stone', 'post_lantern', 'gravestone', 'grave',
].map((k) => [k, `kk_${k}.glb`]));

export const PROP_CREDIT = 'Buildings and props: KayKit Medieval Hexagon and Halloween Bits by Kay Lousberg (CC0).';

const prepared = new Map();
const SPIN = /fan|blade|sail/i;

/** A model as parts in its own frame, its box, and whether something on it turns. */
function prepare(key) {
  if (prepared.has(key)) return prepared.get(key);
  const file = PROP_MODELS[key];
  const p = (file ? loadModelFile(file) : Promise.resolve(null)).then((gltf) => {
    if (!gltf?.scene) return null;
    const scene = gltf.scene;
    scene.updateMatrixWorld(true);
    const parts = [], mats = new Map();
    let spins = false;
    scene.traverse((o) => {
      if (SPIN.test(o.name || '')) spins = true;
      if (!o.isMesh) return;
      const src = o.material;
      let m = mats.get(src);
      if (!m) {
        // the pack's colour atlas through the game's cel ramp
        src.map && (src.map.colorSpace = SRGBColorSpace);
        m = new MeshToonMaterial({ map: src.map || null, color: src.map ? 0xffffff : src.color, gradientMap: toonGradient(STYLE.bands) });
        groundMaterial(m);
        mats.set(src, m);
      }
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      parts.push({ geometry: g, material: m });
    });
    const box = new Box3().setFromObject(scene);
    return { parts, box, size: box.getSize(new Vector3()), scene, mats, spins };
  });
  prepared.set(key, p);
  return p;
}

const T = new Matrix4(), S = new Matrix4(), R = new Matrix4(), C = new Matrix4(), Q = new Quaternion(), UP = new Vector3(0, 1, 0);

/**
 * How one placement is drawn. `fit: { w, d, maxH, give }` fits the model to a
 * footprint w (along its own x) by d (along its z); `s` scales it outright.
 * The model's front is its +z, which is the way every builder faced a door.
 */
function placement(pl, info) {
  const { size, box } = info;
  let sx, sy, sz;
  if (pl.fit) {
    const { w, d, maxH = Infinity, give = 1.18, fill = 0.96 } = pl.fit;
    let s = Math.min(w * fill / Math.max(size.x, 1e-3), d * fill / Math.max(size.z, 1e-3));
    s = Math.min(s, maxH / Math.max(size.y, 1e-3));
    sy = s;
    // a little wider than true, to fill a footprint a tall house would not
    sx = Math.min(w * fill / size.x, s * give);
    sz = Math.min(d * fill / size.z, s * give);
  } else {
    sx = sy = sz = pl.s || 1;
  }
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  C.makeTranslation(-cx, -box.min.y, -cz);
  S.makeScale(sx, sy, sz);
  R.makeRotationFromQuaternion(Q.setFromAxisAngle(UP, pl.rot || 0));
  T.makeTranslation(pl.x, pl.y, pl.z);
  return new Matrix4().multiplyMatrices(T, R).multiply(S).multiply(C);
}

/**
 * Put models in the world. `list`: [{ key, x, y, z, rot, fit | s }]. Returns
 * a group (filled as the models arrive) with `update(t)` for the parts that
 * turn and `ready`, a promise for when everything asked for is in.
 */
export function placeProps(list, { cast = true } = {}) {
  const group = new Group();
  group.name = 'prop-models';
  const spinners = [];
  const byKey = new Map();
  for (const pl of list || []) {
    if (!PROP_MODELS[pl.key] || !Number.isFinite(pl.x) || !Number.isFinite(pl.z)) continue;
    (byKey.get(pl.key) || byKey.set(pl.key, []).get(pl.key)).push(pl);
  }
  const jobs = [...byKey].map(([key, pls]) => prepare(key).then((info) => {
    if (!info || group.userData.disposed) return;
    if (info.spins) {
      // few of these in a zone: each its own copy, with its sails turning
      for (const pl of pls) {
        const copy = info.scene.clone(true);
        copy.traverse((o) => {
          if (o.isMesh) { o.material = info.mats.get(o.material) || o.material; o.castShadow = cast; o.receiveShadow = true; }
          SPIN.test(o.name || '') && spinners.push({ o, rate: 0.6 + (pl.x * 0.13 % 0.3) });
        });
        const holder = new Group();
        holder.matrixAutoUpdate = false;
        holder.matrix.copy(placement(pl, info));
        holder.add(copy);
        group.add(holder);
      }
      return;
    }
    const mats = pls.map((pl) => placement(pl, info));
    for (const part of info.parts) {
      const im = new InstancedMesh(part.geometry, part.material, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere?.();
      im.castShadow = cast;
      im.receiveShadow = true;
      // instanced: the foot shading reads each copy's own origin
      im.userData.noGround = true;
      group.add(im);
    }
  }));
  group.userData.ready = Promise.all(jobs);
  group.userData.update = (t) => { for (const s of spinners) s.o.rotation.z = t * s.rate; };
  return group;
}

/** Fetch these ahead of when they are needed (a zone about to load). */
export function warmProps(keys) {
  return Promise.all([...new Set(keys)].filter((k) => PROP_MODELS[k]).map(prepare));
}
