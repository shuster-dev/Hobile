# Credits

## Creatures

Every creature is sculpted in code for this game — `src/client/gfx/figurine.js`
builds them and `src/client/gfx/figurine-designs.js` describes each one — so
there is no third-party creature art in it.

Until v0.24 the creatures were models from the **XYZ** pack by
[Polygonal Mind](https://github.com/PolygonalMind), released CC0
(https://github.com/PolygonalMind/initiative-opensource-release). Thanks to them
for the years those models stood in.

## People

The adventurers — the player's, and everyone else's in the world — are the
five characters of the **KayKit Character Pack Adventures** by **Kay Lousberg**
(www.kaylousberg.com), released **CC0 1.0**, with the pack's own animation
(https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0).
`tools/models/heroes.mjs` converts them into `assets/models/kk_hero_*.glb` (the
clips once, in `kk_hero_anims.glb`) and `src/client/gfx/heroes.js` puts them on.
What the tailor sells is built in code (`src/client/gfx/wardrobe3d.js`).

While a model is on its way, the person is the figure sculpted in code
(`src/client/gfx/people.js`, built by `figurine.js`), as all of them were from
v0.28 until v0.45.

Until v0.28 the people were the `char_corin` and `char_renn` models from the
**Aether Star Online open assets** (https://github.com/aether-star-online/aso-assets,
CC0 1.0). Thanks to them for the time those two stood in.

### Models, if any are added again

Any model put in `assets/models/` is run through `tools/models/optimise.mjs`
before it is committed: normal, metallic-roughness and occlusion maps are
dropped (the toon material reads none of them), the base colour is resized to
512, and vertex data is quantized — and `tools/models/rigcheck.mjs` fails loudly
if a rig or its clips did not survive.

## Buildings and props

The houses, the forge, the windmill, the well, the watchtower, crates and
barrels in the field zones and on the town's farm, and the crypt with its
lanterns and graves in the Umbral Grove, are models from two packs by
**Kay Lousberg** (www.kaylousberg.com), both released **CC0 1.0** — free for
commercial use, no attribution required. Thanks to Kay all the same.

- **KayKit Medieval Hexagon Pack 1.0** —
  https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0
- **KayKit Halloween Bits 1.0** —
  https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0

They are converted by `tools/models/props.mjs` (atlas down to 128px, vertex
data quantized) into `assets/models/kk_*.glb`; `src/client/gfx/propmap.js` says
which stands where and `propmodels.js` places them.

## Everything else

The world's ground, trees, the town's buildings, effects, interface and every
remaining piece of geometry are generated from code in this repository. No
other third-party art, audio or fonts are used.

## Adding an asset

Anything added to `assets/` has to be listed here with its author, its licence
and a link to where it came from, before it is used. A CC-BY asset also needs
its credit visible inside the running game, not only in this file.
