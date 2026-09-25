# Credits

## Creatures

Every creature is sculpted in code for this game — `src/client/gfx/figurine.js`
builds them and `src/client/gfx/figurine-designs.js` describes each one — so
there is no third-party creature art in it.

Until v0.24 the creatures were models from the **XYZ** pack by
[Polygonal Mind](https://github.com/PolygonalMind), released CC0
(https://github.com/PolygonalMind/initiative-opensource-release). Thanks to them
for the years those models stood in.

## Character models

The trainer, and every person in the world, is a model from the **Aether Star
Online open assets** — a fantasy MMO's public asset repository.

**Licence: CC0 1.0 Universal (public domain)**, stated in that repository's own
`LICENSE` and README: *"Everything in this repository is dedicated to the public
domain under CC0 1.0."* Attribution is not required.

| | |
|---|---|
| Source | https://github.com/aether-star-online/aso-assets (`characters/`) |
| Used | `char_corin` → `hero-corin.glb`, `char_renn` → `hero-renn.glb` |

These arrive the other way round from the creatures: fully animated, with clips
an artist authored (Idle, Walking, Running, Attack, a death), which the mixer
plays directly. What the game adds is the recolouring — `Mat_Skin`, `Mat_Hair`,
`Mat_ClothPrimary` and `Mat_ClothSecondary` are tinted from the player's own
choices in the character creator, so a model does not cost customisation.

Every model in `assets/` is run through `tools/models/optimise.mjs` before it is
committed: normal, metallic-roughness and occlusion maps are dropped (the toon
material reads none of them), the base colour is resized to 512, and vertex data
is quantized. That is 5.1 MB of source art down to 3.4 MB shipped, with the rigs
and clips intact — `tools/models/rigcheck.mjs` fails loudly if one is not.

### Animation

The models ship rigged and with no animation clips. Nothing in `assets/models/`
was animated by anyone else: the idle, walk, run, swim, flap and sway are all
generated at runtime from the skeleton by `src/client/gfx/models.js`.

## Everything else

The world, its props, buildings, effects, interface and every remaining piece of
geometry are generated from code in this repository. No other third-party art,
audio or fonts are used.

## Adding an asset

Anything added to `assets/` has to be listed here with its author, its licence
and a link to where it came from, before it is used. A CC-BY asset also needs
its credit visible inside the running game, not only in this file.
