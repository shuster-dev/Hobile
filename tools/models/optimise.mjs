/**
 * Shrink a character model to something a phone should download.
 *
 *   node tools/models/optimise.mjs in.glb out.glb
 *
 * Two thirds of these files are maps the game never reads: the toon material
 * ignores normal, metallic-roughness and occlusion entirely, so shipping them
 * is a megabyte spent lighting a surface in a way it is never lit. What is left
 * is the baked base colour, which is the whole look, resized to 512.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';

const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: optimise.mjs in.glb out.glb'); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
for (const m of doc.getRoot().listMaterials()) {
  m.setNormalTexture(null);
  m.setMetallicRoughnessTexture(null);
  m.setOcclusionTexture(null);
  m.setEmissiveTexture(null);
}
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }),
  weld(),
  // Two thirds of what is left is vertex data stored as 32-bit floats, which is
  // far more precision than a 1.4-metre character at phone resolution can show.
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }),
  dedup(),
  prune(),
);
await io.write(dst, doc);
