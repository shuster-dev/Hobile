// Work at the farm: creatures from the box, put to a job, out in the yard
// doing it while you are away — tending the garden, digging in the quarry,
// stoking the forge, scouting the roads. Each job suits some elements better
// than others; a creature that likes its job does more of it.
//
// Pure: the server (game/combat.js) pays by these numbers, the base panel
// shows them, and the farm draws the workers at their job's spot.

export const JOBS = {
  garden: { he: 'גינון', icon: '🌱', likes: ['verdant', 'aqua', 'lumen'], text: 'מגדל סיבים, והגינה מניבה יותר' },
  mine: { he: 'כרייה', icon: '⛏', likes: ['terra', 'metal', 'frost'], text: 'כורה גרוטאות ושברים' },
  forge: { he: 'נפחייה', icon: '🔥', likes: ['ember', 'volt', 'metal'], text: 'מזרז את הייצור, ומזקק שברים מהיסוד שלו' },
  scout: { he: 'סיור', icon: '🧭', likes: ['gale', 'umbra', 'volt'], text: 'מביא זהב ולפעמים כדורים מהדרכים' },
};
export const JOB_IDS = Object.keys(JOBS);

export const WORK = {
  capHours: 12,          // a worker stops when its basket is full
  gardenBoost: 0.25,     // each gardener: the garden's own yield up a quarter
  forgeBoost: 0.15,      // each smith: crafts a sixth faster
  maxSlots: 6,
};

/** How many can work: more as the farm's buildings go up. */
export function workerSlots(buildings = {}) {
  const sum = Object.values(buildings).reduce((s, v) => s + (v || 0), 0);
  return Math.max(1, Math.min(WORK.maxSlots, 1 + Math.floor((sum - 4) / 2)));
}

/** The job that suits a creature best (its first element decides). */
export function bestJob(types = []) {
  for (const t of types) for (const id of JOB_IDS) if (JOBS[id].likes.includes(t)) return id;
  return 'scout';
}

/** How much one worker turns out in an hour, as {item: n} (gold under 'gold'). */
export function workRate(job, c, types = []) {
  const J = JOBS[job];
  if (!J || !c) return {};
  const k = (0.6 + (c.level || 1) / 20) * (types.some((t) => J.likes.includes(t)) ? 1.5 : 1) * (1 + 0.1 * ((c.star || 1) - 1));
  const el = types[0] || 'terra';
  if (job === 'garden') return { fiber: 2 * k };
  if (job === 'mine') return { scrap_iron: 1.5 * k, [`shard_${el === 'terra' || el === 'metal' || el === 'frost' ? el : 'terra'}`]: 0.4 * k };
  if (job === 'forge') return { [`shard_${el}`]: 0.6 * k };
  return { gold: 40 * k, sphere_basic: 0.15 * k };
}
