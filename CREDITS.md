# Credits

## Creature models

Every creature in the game is a model from the **XYZ** pack by
[Polygonal Mind](https://github.com/PolygonalMind) (Zaragoza, 2015–2024),
released through their Open Source Initiative.

**Licence: CC0 1.0 Universal (public domain).** In the studio's own words, from
the release's README:

> This projects falls under the license **CC0**, which means that you are free
> to use, modify, and distribute our work without any restrictions, even for
> commercial purposes, and without having to attribute the original creator.

Attribution is therefore not required. It is here because the work deserves it.

| | |
|---|---|
| Original release | https://github.com/PolygonalMind/initiative-opensource-release |
| glTF conversion | https://github.com/ToxSam/cc0-models-Polygonal-Mind (`projects/xyz`) |
| Index used to find it | https://github.com/ToxSam/open-source-3D-assets |
| Vendored in | `assets/models/` |

The pack ships 60 creatures; 33 are used, one per species. The files are renamed
to the pack's own creature names rather than to the species that uses them, so
that a model can be reassigned without a file rename, and so it stays obvious
which upstream asset a file came from.

| species | model | species | model |
|---|---|---|---|
| cindcub | Trihound | glacilisk | Scorpy |
| pyrelynx | Octogecko | umbrat | Mousylon |
| vulcanth | Heptangle | nocturnix | Hexowl |
| puddlet | Sauris | glimmer | Mushroomy |
| tidefin | Rectashark | solaraith | Binguilon |
| maelstride | Squaresquid | coglet | Vguy |
| sproutle | Starplant | ferrogeist | Boargram |
| thornkin | Cacturnion | mossnail | Snailus |
| verdammoth | Owltron | emberfly | Rhomgon |
| sparkit | Symbbit | duskmaw | Triangaroo |
| voltmane | Cobrangle | aurorix | Mermalygon |
| pebblin | Beaveriangle | magmadon | Monkeylon (Big Fighter) |
| boulderon | Orclygon | leviathorn | Turtlelion |
| zephyrb | Pentachick | nullwarden | Bigsastylon |
| cirrowing | Natiangle | rootfather | Penturtlen |
| frostnib | Penguiton | stormcaller | Mewphinx |
| | | hollowking | Triplicoon |

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
