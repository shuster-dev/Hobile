# How the world is made to look solid (v0.45)

Three passes that run on every zone, all baked once at load and read in the
shaders. None of them add draw calls, and none of them download textures.

## Grounding — `src/client/gfx/grounding.js`

**Contact map.** A 1024² canvas over the whole zone: white where the ground is
open, a soft dark pool under and around everything that stands on it. It is
drawn from what already knows where things are: the colliders
(`shared/props.js`: circles for trees and rocks, turned boxes for buildings,
benches and fences), plus the planned zones' building footprints
(`shared/worldplan.js` structures with `w`×`d`). A building also gets a tight
dark sill along its walls. The terrain shader (`groundDetail` in `world.js`)
multiplies by it (`GROUNDING.contact`).

**Foot shading.** Every world material learns how high a fragment is above the
ground under it and darkens (and cools) the last metre (`GROUNDING.footH`,
`GROUNDING.foot`). Merged geometry is laid out in world space at the origin,
so `groundZone()` writes the terrain height under each vertex into
`aGroundY` (stored + 1000, so a geometry without it reads 0 and falls back).
An instanced or placed object uses the height of its own origin.

Wind-swayed materials (grass, flowers) and the ground itself are left alone.

## Surfaces — `src/client/gfx/surfaces.js`

Wood (fibres along the grain, boards of different tone, seams, knots), bark,
dressed stone (courses and joints), natural rock (cracks, lichen on top),
thatch, roof tiles (rows across the slope, each with a shadowed lip), plaster,
snow (blue in the dips, glints that move with the camera) and iron.

Worked into the colour before the cel ramp, so it stays part of the toon look.
Fine detail fades out past ~15m and the broad pattern past ~45m, where it
would only shimmer on a phone.

Which surface a part is:

- Planned zones (`zonekit.js` `Kit`) and the town (`PartBuilder`): from the
  part's colour (`surfaceOf`: brown → wood, grey → stone, cool white → snow,
  warm white → plaster, straw → thatch), or the builder says (`gable` is
  always roof, `rock` is always rock).
- `mat(color, { surface: SURF.x })`: one surface for the whole material
  (tree trunks are bark, rocks are rock, village roofs are roof).

The surface and the direction of the grain travel in the geometry's
`tangent` attribute (xyz grain, w surface), because three turns `tangent`
with the geometry on every `applyMatrix4` — a plank's grain still runs along
the plank after it is turned, placed and merged.

## Scale

The trainer is 1.43m. A planned zone's house used to be drawn with 4.2m of
wall and a ridge at ~6.9m — five trainers. `STOREY` in `zoneart.js` draws a
house's walls at ~2.1× the trainer and the roof at a cottage's pitch; a barn
a little taller. Only the drawn height changes: the plan's footprints, which
the server walks into, are untouched.

## Shadows

The sun's shadow map is 1024² on a mid phone and 2048² on a strong one, over
the ±26m around the player (5cm and 2.5cm a texel).

## Looking at it

```
npm run build:solo
CLEAN=1 TIER=medium STEP_MS=400000 node tools/zone-tour.mjs shots/tour frostpeak_ridge,verdant_meadow
```

`CLEAN=1` hides the HUD; `PAGE=other.html` tours another build in `dist/`
(for a before/after); `PORT` and `DSF` as named.
