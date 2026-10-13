/**
 * The world's built things as real models: two KayKit packs by Kay
 * Lousberg (CC0, CREDITS.md), each converted to one small .glb.
 *
 *   node tools/models/props.mjs <dir with the three packs cloned>
 *
 * The packs are glTF with a separate .bin and one shared colour atlas each —
 * a texture of flat swatches the faces are mapped into, not a painted
 * surface. So the atlas comes down to 128px with no visible loss, the vertex
 * data is quantized, and each model is written as a single file into
 * assets/models/ as `kk_<key>.glb` (build.mjs ships everything there).
 *
 * The packs themselves are not in the repository; where they come from:
 *   github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
 *   github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0
 */
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';

const root = process.argv[2];
if (!root) { console.error('usage: props.mjs <dir with the KayKit packs>'); process.exit(1); }

const MED = 'KayKit-Medieval-Hexagon-Pack-1.0/addons/kaykit_medieval_hexagon_pack/Assets/gltf';
const MED_ALT = 'kaykit/addons/kaykit_medieval_hexagon_pack/Assets/gltf';
const HAL = 'KayKit-Halloween-Bits-1.0/addons/kaykit_halloween_bits/Assets/gltf';

// key -> source, relative to its pack's gltf folder
export const PROP_SOURCES = {
  // villages and farms (Medieval Hexagon)
  home_a: [MED, 'buildings/red/building_home_A_red'],
  home_b: [MED, 'buildings/red/building_home_B_red'],
  home_a_blue: [MED, 'buildings/blue/building_home_A_blue'],
  home_b_blue: [MED, 'buildings/blue/building_home_B_blue'],
  home_a_yellow: [MED, 'buildings/yellow/building_home_A_yellow'],
  home_b_yellow: [MED, 'buildings/yellow/building_home_B_yellow'],
  tavern: [MED, 'buildings/red/building_tavern_red'],
  blacksmith: [MED, 'buildings/red/building_blacksmith_red'],
  windmill: [MED, 'buildings/red/building_windmill_red'],
  well: [MED, 'buildings/red/building_well_red'],
  tower: [MED, 'buildings/red/building_tower_A_red'],
  barrel: [MED, 'decoration/props/barrel'],
  crate_big: [MED, 'decoration/props/crate_A_big'],
  crate_small: [MED, 'decoration/props/crate_B_small'],
  sack: [MED, 'decoration/props/sack'],
  // the dark grove (Halloween Bits)
  crypt: [HAL, 'crypt'],
  lantern_stone: [HAL, 'lantern_standing'],
  post_lantern: [HAL, 'post_lantern'],
  gravestone: [HAL, 'gravestone'],
  grave: [HAL, 'grave_A'],
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const out = 'assets/models';
fs.mkdirSync(out, { recursive: true });
let total = 0;
for (const [key, [pack, name]] of Object.entries(PROP_SOURCES)) {
  let src = path.join(root, pack, `${name}.gltf`);
  if (!fs.existsSync(src) && pack === MED) src = path.join(root, MED_ALT, `${name}.gltf`);
  if (!fs.existsSync(src)) { console.warn('missing', key, src); continue; }
  const doc = await io.read(src);
  for (const m of doc.getRoot().listMaterials()) {
    m.setNormalTexture(null); m.setMetallicRoughnessTexture(null); m.setOcclusionTexture(null); m.setEmissiveTexture(null);
  }
  await doc.transform(
    // flat swatches: 128px is all of it (KayKit's own guide says down to 128)
    textureCompress({ encoder: sharp, targetFormat: 'png', resize: [128, 128] }),
    weld(),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
    dedup(),
    prune(),
  );
  const dst = path.join(out, `kk_${key}.glb`);
  await io.write(dst, doc);
  const kb = fs.statSync(dst).size / 1024;
  total += kb;
  console.log(`${key.padEnd(15)} ${kb.toFixed(1)} KB`);
}
console.log(`total ${total.toFixed(0)} KB`);
