/**
 * Weather and seasons.
 *
 * Nothing here is sent over the wire. The day cycle already runs off
 * `state.serverTime`, which every client in a room is handed, so the sky can be
 * a pure function of that clock and the zone's id: two players standing beside
 * each other compute the same rain from the same millisecond, a screenshot
 * taken at a fixed time is reproducible, and the server pays nothing per tick
 * to keep them in step. The alternative — a weather field in the room state,
 * replicated — would cost a message every change and could still drift between
 * a client that joined mid-spell and one that did not.
 *
 * The one thing a pure function cannot do is surprise the server, so anything
 * that wants weather asks for it by time rather than being told.
 */

// A day is 12 minutes. The constant lives in `ui.js` as `wp`, because that is
// where the day cycle is driven from; it is repeated rather than imported
// because this file is shared and `ui.js` is a client module that touches the
// DOM at import time.
export const DAY_MS = 720 * 1000;

// Four game days to a season, sixteen to a year — 48 real minutes and a little
// over three hours. A long session sees a season turn; a short one does not,
// which is the right way round. Weather holds for half a day and takes forty
// seconds to turn over, so a player sees two or three skies in a sitting and
// never a cut.
export const SEASON_MS = DAY_MS * 4;
export const YEAR_MS = SEASON_MS * 4;
export const SPELL_MS = DAY_MS / 2;
export const TURN_MS = 40 * 1000;

export const SEASONS = [
  { id: 'spring', he: 'אביב' },
  { id: 'summer', he: 'קיץ' },
  { id: 'autumn', he: 'סתיו' },
  { id: 'winter', he: 'חורף' },
];

export const WEATHER = {
  clear: { id: 'clear', he: 'בהיר', boost: 'lumen' },
  cloud: { id: 'cloud', he: 'מעונן', boost: null },
  rain: { id: 'rain', he: 'גשם', boost: 'aqua' },
  storm: { id: 'storm', he: 'סופה', boost: 'volt' },
  snow: { id: 'snow', he: 'שלג', boost: 'frost' },
  fog: { id: 'fog', he: 'ערפל', boost: 'umbra' },
  ash: { id: 'ash', he: 'אפר', boost: 'ember' },
};

// What each zone's sky is made of, before the season has its say. The weights
// are relative within a row and nothing else reads them.
const TABLES = {
  coast: { clear: 5, cloud: 3, rain: 2, fog: 1, snow: 0.5 },
  verdant: { clear: 5, cloud: 3, rain: 2.5, fog: 1, snow: 0.8 },
  terra: { clear: 5, cloud: 2.5, fog: 2, rain: 1, snow: 0.6 },
  volt: { storm: 3.5, cloud: 3, rain: 2, clear: 2, snow: 0.6 },
  ember: { clear: 5, ash: 3.5, cloud: 1.5 },
  aqua: { rain: 4, cloud: 3, fog: 2, clear: 2, storm: 1, snow: 0.6 },
  frost: { snow: 4, cloud: 3, fog: 2, clear: 2 },
  umbra: { fog: 4, cloud: 3, rain: 2, clear: 1, snow: 0.8 },
};

// A season does not replace a zone's weather, it leans on it: the mesa is still
// dry in autumn and the ridge is still cold in summer. Anything a row does not
// list keeps its weight, and a zero is a real zero — nothing snows in summer.
const SEASON_BIAS = {
  spring: { rain: 1.6, fog: 1.3, clear: 1.1, snow: 0.35, storm: 1.2 },
  summer: { clear: 1.9, storm: 1.4, ash: 1.4, rain: 0.7, fog: 0.6, snow: 0 },
  autumn: { rain: 1.5, fog: 1.8, cloud: 1.3, clear: 0.7, snow: 0.5 },
  winter: { snow: 3, cloud: 1.4, fog: 1.2, clear: 0.7, rain: 0.5, ash: 0.7, storm: 0.8 },
};

function hash(str, salt) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  return (Math.imul(h, 1274126177) >>> 0) / 4294967296;
}

export function tableFor(zone) {
  return TABLES[zone?.element] || TABLES.coast;
}

export function seasonAt(t) {
  const n = Math.floor(t / SEASON_MS);
  const season = SEASONS[((n % 4) + 4) % 4];
  return { ...season, index: ((n % 4) + 4) % 4, phase: (t % SEASON_MS) / SEASON_MS };
}

function pick(zone, block, season) {
  const table = tableFor(zone);
  const bias = SEASON_BIAS[season.id] || {};
  let total = 0;
  const rows = [];
  for (const [id, base] of Object.entries(table)) {
    const w = base * (bias[id] ?? 1);
    if (w <= 0) continue;
    total += w;
    rows.push([id, total]);
  }
  if (!rows.length) return 'clear';
  const r = hash(zone?.id || 'nowhere', block * 2654435761 >>> 0) * total;
  for (const [id, upto] of rows) if (r < upto) return id;
  return rows[rows.length - 1][0];
}

/**
 * The sky over `zone` at server time `t`.
 *
 * `from` and `to` are weather ids and `blend` runs 0 to 1 across the last
 * `TURN_MS` of a spell, so a caller that can interpolate should; one that
 * cannot reads `id`, which is whichever of the two is more than half there.
 */
export function weatherAt(zone, t) {
  const block = Math.floor(t / SPELL_MS);
  const into = t - block * SPELL_MS;
  const season = seasonAt(t);
  const from = pick(zone, block, season);
  const to = pick(zone, block + 1, seasonAt((block + 1) * SPELL_MS));
  const blend = into > SPELL_MS - TURN_MS ? (into - (SPELL_MS - TURN_MS)) / TURN_MS : 0;
  const id = blend > 0.5 ? to : from;
  return { from, to, blend, id, season, he: WEATHER[id].he, boost: WEATHER[id].boost };
}
