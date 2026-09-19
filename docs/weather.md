# Weather and seasons

## The clock is the protocol

Nothing about the sky is sent over the wire. The day cycle already runs off
`state.serverTime`, which every client in a room is handed, so `weatherAt(zone,
t)` in `src/shared/weather.js` is a pure function of that clock and the zone's
id. Two players standing beside each other compute the same rain from the same
millisecond; a screenshot at a fixed time is reproducible; the server pays
nothing per tick to keep anyone in step.

A replicated weather field would have cost a message per change and could still
drift between a client that joined mid-spell and one that did not. The one thing
a pure function cannot do is surprise the server, so anything that wants weather
asks for it by time rather than being told.

| Constant | Value | Why |
|---|---|---|
| `DAY_MS` | 12 min | repeated from `ui.js` (`wp`), which is a client module |
| `SPELL_MS` | 6 min | a sitting sees two or three skies |
| `TURN_MS` | 40 s | long enough that a change is never a cut |
| `SEASON_MS` | 4 days = 48 min | a long session sees a season turn, a short one does not |
| `YEAR_MS` | 16 days ≈ 3.2 h | |

`weatherAt` returns `{ from, to, blend, id, season, boost }`. A caller that can
interpolate uses `from`/`to`/`blend`; one that cannot reads `id`, which is
whichever of the two is more than half there.

## Tables

Each zone's row is its own weather before the season has its say, keyed on
`zone.element` (the harbour has none and uses `coast`). The season biases the
row rather than replacing it, so the mesa is still dry in autumn and the ridge
still cold in summer. Anything a bias does not list keeps its weight, and a zero
is a real zero — nothing snows in summer.

Measured over 4000 spells per zone:

| zone | what the sky mostly is |
|---|---|
| Umbral Grove | fog 40%, cloud 29% |
| Stormreach Heights | storm 31%, cloud 29% |
| Emberfall Canyon | clear 50%, ash 32% — and never anything else |
| Frostpeak Ridge | cloud 32%, snow 24%, fog 23% |
| Tidal Hollow | rain 29%, cloud 26% |

## Drawing it

`WEATHER_LOOK` in `world.js` is the look of each sky; `shared/weather.js` only
decides which one is overhead, so the two can be argued about separately and a
headless test of the schedule needs no GPU. The numbers are multipliers on the
zone's own palette rather than absolute colours — a rainy Emberfall is still
Emberfall. `fogHue` is the one thing weather states outright, because the colour
of the air *is* the weather.

Weather rides on top of the day cycle rather than beside it: `setTimeOfDay` is
where the sun, the cloud deck, the air and the exposure are all set from the
palette, so it is the only place they can be bent without two systems fighting
over one uniform. Across the seven skies: cloud cover 0.25 → 0.95, sun intensity
2.47 → 0.59, fog distance 168m → 50m.

**Precipitation costs one draw call and no triangles.** It is a single `Points`
cloud that wraps in place — vertical fall with a per-drop speed, sideways wrap
for the wind — parked on the player every frame. One sprite shape for
everything: squash the sample coordinate in x and a round flake becomes a rain
streak, which is also what lets rain and snow cross-fade without swapping
shaders. Two fields exist at once and fade against each other, because rain does
not become snow; it stops while snow starts.

Two numbers that are easy to get wrong:

- **The box is 24m across, not 50.** Spread the same drops over the larger
  volume and the density near the camera — the only density anyone sees — falls
  by an order of magnitude, and rain reads as three streaks and a rumour.
- **`size` is multiplied by 30 over the distance to the camera.** A flake near
  the lens is fifteen times its number in pixels. Snow at 4 photographs as
  bokeh; it wants 1.7.

Lightning is one added term in the colour grade, flat and applied *after* the
vignette, because a strike lights the corners of the frame too — which is most
of what tells the eye it came from outside the scene.

## Seasons

`SEASON_LOOK` leans the zone's own leaf and grass colours toward the season's
rather than repainting them. The tint is applied from the colour each material
started at, kept in `seasonTint`; tinting from the *current* colour would
compound every turn of the year until a wood came out grey. The dock's street
trees are registered too, or the harbour would be the one place where it is
always summer.

## What weather does to the rules

A move whose type matches the sky's `boost` hits for 1.2× — rain behind water, a
storm behind volt, snow behind frost, ash behind ember, fog behind umbra, a
clear sky behind lumen. It is fixed when the battle starts rather than sampled
per hit, so a spell turning over mid-fight cannot change what a move is doing
halfway through it, and a banner names it once at the start.

Writing the test for it turned up that `Combat` takes a `rand` so a fight can be
replayed, and `computeDamage` was calling `Math.random` anyway — seeding a
Combat changed everything about it except the numbers.

## Tools

    node tools/sky.mjs [out.png]          # all seven skies and four seasons
    SKY_ZONE=frostpeak_ridge node tools/sky.mjs shots/frost.png

`holdWeather(id, season)` pins the spell the way `holdTimeOfDay` pins the clock,
so the eleven frames differ by exactly one thing each. The tool also prints the
driven values — cloud cover, sun intensity, fog distance, draw calls — because
the cloud deck only shows when the camera looks up, which a third-person camera
never does.
