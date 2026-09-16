# Recovery tools — historical, do not run

These rebuilt `src/` once, from the published minified single-file build, after
the original repo was lost. `split.mjs` wipes `src/` and regenerates it from
`recovered/bundle.pretty.js`; every fix made since the recovery would go with
it. They are kept because they document how the source was reconstructed, not
because they are part of the build.

The order was: `scan.mjs` (find the data tables) → `three-map2.mjs` (identify
three.js classes from the `isX` / `type` tags that survive minification) →
`split.mjs` (Babel scope-aware rename from `names.json`, then split into ES
modules with imports derived from the reference graph) → `finalize.mjs`
(bootstrap side effects, entry points, HTML shell).

`src/` is the source of truth now.
