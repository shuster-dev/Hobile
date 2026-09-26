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

Every person — the player's adventurer and everyone in the world — is sculpted
in code the same way as the creatures: `src/client/gfx/people.js` describes the
seven kinds and how they move, and `figurine.js` builds them. There is no
third-party character art in the game.

Until v0.28 the people were the `char_corin` and `char_renn` models from the
**Aether Star Online open assets** (https://github.com/aether-star-online/aso-assets,
CC0 1.0). Thanks to them for the time those two stood in.

### Models, if any are added again

Any model put in `assets/models/` is run through `tools/models/optimise.mjs`
before it is committed: normal, metallic-roughness and occlusion maps are
dropped (the toon material reads none of them), the base colour is resized to
512, and vertex data is quantized — and `tools/models/rigcheck.mjs` fails loudly
if a rig or its clips did not survive.

## Everything else

The world, its props, buildings, effects, interface and every remaining piece of
geometry are generated from code in this repository. No other third-party art,
audio or fonts are used.

## Adding an asset

Anything added to `assets/` has to be listed here with its author, its licence
and a link to where it came from, before it is used. A CC-BY asset also needs
its credit visible inside the running game, not only in this file.
