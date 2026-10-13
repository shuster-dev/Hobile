// Which model stands where a builder used to stack boxes (propmodels.js).
//
// `planModels(s, zoneId)` answers for one of a planned zone's structures
// (shared/worldplan.js): the models to put in its place, in its own frame —
// x across, z the way it faces, as the builders drew it — or null to leave
// the builder to draw it. Heights are against a 1.43m trainer: a cottage to
// its ridge about four of them, a door half again as tall as one.

const H = { house: 6.2, big: 7.4, tower: 10.5, mill: 11.5 };

// a cottage's colour by where it is: blue roofs in the snow, ochre in the
// canyon, red and ochre side by side on a farm
const homeFor = (zoneId, i) => {
  const v = i % 2 ? 'b' : 'a';
  if (zoneId === 'frostpeak_ridge' || zoneId === 'umbral_grove') return `home_${v}_blue`;
  if (zoneId === 'emberfall_canyon' || zoneId === 'stonewake_mesa') return `home_${v}_yellow`;
  return i % 3 === 2 ? `home_${v}_yellow` : `home_${v}`;
};

const one = (key, fit, extra = {}) => [{ key, lx: 0, lz: 0, fit, ...extra }];

// Not here, on purpose, and left to their builders: the barn (no model fills
// its 10 × 14 footprint without towering, and an unfilled footprint is an
// invisible wall), the mine (its footprint is two posts with the way in open
// between them) and the mesa's tents (the pack's "tent" is a market canopy).
const KINDS = {
  dwelling: (s, z) => one(homeFor(z, s.i || 0), { w: s.w, d: s.d, maxH: H.house }),
  cabin: (s, z) => one(homeFor(z, s.i || 0), { w: s.w, d: s.d, maxH: H.house }),
  stonehouse: (s, z) => one(homeFor(z, (s.i || 0) + 1), { w: s.w, d: s.d, maxH: H.house }),
  forge: (s) => one('blacksmith', { w: s.w, d: s.d, maxH: H.big }),
  windmill: () => one('windmill', { w: 6, d: 6, maxH: H.mill }),
  well: () => one('well', { w: 2.6, d: 2.6, maxH: 3.6 }),
  watchtower: () => one('tower', { w: 4.6, d: 4.6, maxH: H.tower }),
  // a stack of a merchant's goods
  crates: () => [
    { key: 'crate_big', lx: -0.5, lz: 0, fit: { w: 1.1, d: 1.1, maxH: 1.1 } },
    { key: 'crate_small', lx: 0.65, lz: 0.2, rot: 0.3, fit: { w: 0.8, d: 0.8, maxH: 0.8 } },
    { key: 'barrel', lx: 0.9, lz: -0.9, fit: { w: 0.85, d: 0.85, maxH: 1.05 } },
    { key: 'sack', lx: -0.2, lz: 0.95, rot: 0.6, fit: { w: 0.7, d: 0.7, maxH: 0.6 } },
  ],
  // the grove's shrine is a crypt now, its yard inside the temple's
  // footprint (15 by 13, steps to the front): lamps at the gate, graves
  temple: () => [
    { key: 'crypt', lx: 0, lz: -1.5, fit: { w: 9, d: 9, maxH: 10 } },
    ...[-1, 1].flatMap((sx) => [
      { key: 'post_lantern', lx: sx * 3.2, lz: 5.2, fit: { w: 0.9, d: 0.9, maxH: 3 } },
      { key: 'lantern_stone', lx: sx * 6.3, lz: 4.6, fit: { w: 1, d: 1, maxH: 1.6 } },
      { key: 'gravestone', lx: sx * 6, lz: 0.5, rot: sx * 0.15, fit: { w: 1.2, d: 0.6, maxH: 1.5 } },
      { key: 'grave', lx: sx * 6, lz: -3, rot: -sx * 0.1, fit: { w: 1.4, d: 2.4, maxH: 1.2 } },
    ]),
  ],
};

/** The models for one planned structure, placed in the world, or null. */
export function planModels(s, zoneId, groundY) {
  const f = KINDS[s.kind];
  if (!f) return null;
  const list = f(s, zoneId);
  if (!list?.length) return null;
  const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0);
  return list.map((m) => ({
    key: m.key,
    // a local offset turned with the structure (as zoneart's toWorld does)
    x: s.x + m.lx * c + m.lz * sn,
    z: s.z - m.lx * sn + m.lz * c,
    y: groundY,
    rot: (s.rot || 0) + (m.rot || 0),
    fit: m.fit,
  }));
}

/** Kinds a model replaces outright: the builder draws nothing for these. */
export const MODELLED = new Set(Object.keys(KINDS));

/** A village house in a field zone (shared/props.js buildings): a cottage, or the tavern for a hall. */
export function villageModel(u, zoneId, y, i = 0) {
  const hall = u.kind === 'hall';
  return { key: hall ? 'tavern' : homeFor(zoneId, i), x: u.x, z: u.z, y, rot: u.rot || 0, fit: { w: u.w, d: u.d, maxH: hall ? H.big : H.house } };
}
