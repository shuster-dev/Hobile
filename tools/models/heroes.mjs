/**
 * The player characters as real models: KayKit Character Pack Adventures by
 * Kay Lousberg (CC0, CREDITS.md), five adventurers on one shared skeleton.
 *
 *   node tools/models/heroes.mjs <the pack's Characters/gltf folder>
 *
 * The pack ships each character with all 76 of the skeleton's clips inside it
 * (3.6MB a piece). The clips are the same for all five, so they are written
 * once, the few the game plays, into `kk_hero_anims.glb` (a skeleton and its
 * clips, no meshes), and each character into `kk_hero_<kind>.glb` without
 * them. The colour atlas is flat swatches like the buildings' (8 × 4 cells,
 * a soft gradient down each), so 256px loses nothing that shows.
 *
 * What the game wants from each is in src/client/gfx/heroes.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';

const dir = process.argv[2];
if (!dir) { console.error('usage: heroes.mjs <Characters/gltf folder>'); process.exit(1); }

// kind -> the pack's character, and the hand-held things it keeps (shown in
// its show-off move only, heroes.js); the rest of its kit is dropped
export const HERO_SOURCES = {
  rogue: ['Rogue', ['Knife', 'Knife_Offhand']],
  ranger: ['Rogue_Hooded', ['1H_Crossbow']],
  mage: ['Mage', ['1H_Wand', 'Spellbook_open']],
  knight: ['Knight', ['1H_Sword', 'Round_Shield']],
  barbarian: ['Barbarian', ['2H_Axe']],
};
// the clips the game plays (heroes.js CLIPS)
export const HERO_CLIPS = [
  'Idle', 'Walking_A', 'Running_A', 'Throw', 'Cheer', 'Hit_A', 'Sit_Floor_Idle', 'Sit_Chair_Idle',
  'Spellcast_Shoot', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Stab', '1H_Ranged_Shoot', '2H_Melee_Attack_Spin',
  'Interact', 'Use_Item', 'Jump_Full_Short', 'Death_A',
];
// held things the pack hangs off a hand: everything a character carries
const HELD = /Knife|Crossbow|Throwable|Sword|Shield|Wand|Staff|Spellbook|Axe|Mug/;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out = 'assets/models';
fs.mkdirSync(out, { recursive: true });
let total = 0;
// a clip, all of it: disposing an animation leaves its samplers holding
// their keyframes, and a writer that still finds those accessors ships them
const dropClip = (a) => { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); };
// what a dropped clip or mesh leaves behind
const sweep = (doc) => {
  for (const a of doc.getRoot().listAccessors()) if (a.listParents().every((p) => p.propertyType === 'Root')) a.dispose();
};
const write = async (doc, name) => {
  sweep(doc);
  const dst = path.join(out, name);
  await io.write(dst, doc);
  const kb = fs.statSync(dst).size / 1024;
  total += kb;
  console.log(`${name.padEnd(24)} ${kb.toFixed(1)} KB`);
};

for (const [kind, [file, keep]] of Object.entries(HERO_SOURCES)) {
  const doc = await io.read(path.join(dir, `${file}.glb`));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) dropClip(a);
  for (const n of root.listNodes()) {
    if (n.getMesh() && HELD.test(n.getName()) && !keep.includes(n.getName())) { n.getMesh().dispose(); n.setMesh(null); }
  }
  for (const m of root.listMaterials()) {
    m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); m.setEmissiveTexture(null);
  }
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'png', resize: [256, 256] }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }),
    dedup(),
    prune({ keepLeaves: true }),
  );
  await write(doc, `kk_hero_${kind}.glb`);
}

// the clips, once: a skeleton with nothing on it
{
  const doc = await io.read(path.join(dir, 'Rogue.glb'));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) if (!HERO_CLIPS.includes(a.getName())) dropClip(a);
  for (const n of root.listNodes()) {
    if (n.getMesh()) { n.getMesh().dispose(); n.setMesh(null); }
    n.setSkin(null);
  }
  for (const s of root.listSkins()) s.dispose();
  // only the bones that move skin: the rig's IK targets and roll controls
  // are Blender's handles, baked into the bones already; a bone's length is
  // fixed, so only the hips (and the root) are moved, the rest only turned
  for (const a of root.listAnimations()) {
    for (const c of a.listChannels()) {
      const n = c.getTargetNode()?.getName() || '', p = c.getTargetPath();
      const handle = /IK|control-/.test(n);
      if (handle || p === 'scale' || (p === 'translation' && !/^(hips|root)$/.test(n))) { c.getSampler()?.dispose(); c.dispose(); }
    }
  }
  await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune({ keepLeaves: true }));
  const missing = HERO_CLIPS.filter((c) => !root.listAnimations().some((a) => a.getName() === c));
  missing.length && console.warn('missing clips', missing);
  await write(doc, 'kk_hero_anims.glb');
}
console.log(`total ${total.toFixed(0)} KB`);
