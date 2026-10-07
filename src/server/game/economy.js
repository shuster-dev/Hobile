// Every coin, in and out, and where it came from or went.
//
// Gold is the one number every system touches — fights, quests, the shop, the
// farm, the clinic, guilds — and "is the game paying too much?" cannot be
// answered by reading code. All of it passes through here: `earn` and `spend`
// move the gold and write it down. The ledger is per process (the GM panel and
// /api/admin/economy read it); each player also carries today's totals
// (doc.econ), so one account farming far past everyone else stands out.
//
// tools/economy.mjs runs the other half: a simulated player through the real
// reward and price tables, hour by hour, to see income against costs.

/** Where gold comes from. */
export const SOURCES = ['battle', 'capture', 'quest', 'daily', 'boss', 'dungeon', 'pvp', 'farm', 'pass', 'gm'];
/** Where it goes. */
export const SINKS = ['shop', 'clinic', 'building', 'training', 'craft', 'guild', 'blackout', 'cosmetic', 'gm'];

const HOUR = 3600_000;
const KEEP_HOURS = 48;

function fresh() {
  return { since: Date.now(), in: {}, out: {}, hours: [] };
}
let LEDGER = fresh();

function bucket(now) {
  const h = Math.floor(now / HOUR) * HOUR;
  const list = LEDGER.hours;
  let b = list[list.length - 1];
  if (!b || b.at !== h) {
    b = { at: h, in: 0, out: 0, players: new Set() };
    list.push(b);
    while (list.length > KEEP_HOURS) list.shift();
  }
  return b;
}

function utcDay(now) {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function note(doc, dir, key, amount, now = Date.now()) {
  if (!(amount > 0)) return;
  LEDGER[dir][key] = (LEDGER[dir][key] || 0) + amount;
  const b = bucket(now);
  b[dir] += amount;
  doc?.id && b.players.add(doc.id);
  if (doc) {
    const day = utcDay(now);
    if (!doc.econ || doc.econ.day !== day) doc.econ = { day, in: 0, out: 0 };
    doc.econ[dir] += amount;
  }
}

// Who else wants to know a player was paid for something (the season's
// track, server/game/pass.js). Called whatever the amount: it is the deed
// that counts there, not the gold.
const LISTENERS = new Set();
export function onEarn(fn) { LISTENERS.add(fn); return () => LISTENERS.delete(fn); }

/** Pay a player. Returns what was paid. */
export function earn(doc, amount, source) {
  if (doc && LISTENERS.size) for (const fn of LISTENERS) { try { fn(doc, source); } catch {} }
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  if (!doc || !n) return 0;
  doc.gold = (doc.gold || 0) + n;
  note(doc, 'in', SOURCES.includes(source) ? source : 'other', n);
  return n;
}

/** Take from a player, never below zero. Returns what was taken. */
export function spend(doc, amount, sink) {
  const n = Math.max(0, Math.min(doc?.gold || 0, Math.floor(Number(amount) || 0)));
  if (!doc || !n) return 0;
  doc.gold -= n;
  note(doc, 'out', SINKS.includes(sink) ? sink : 'other', n);
  return n;
}

/** Whether a player has this much. */
export function canPay(doc, amount) {
  return (doc?.gold || 0) >= Math.floor(Number(amount) || 0);
}

/** The ledger, for the GM panel and /api/admin/economy. */
export function economyReport(now = Date.now()) {
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const totIn = sum(LEDGER.in), totOut = sum(LEDGER.out);
  const hrs = Math.max(1 / 60, (now - LEDGER.since) / HOUR);
  const hours = LEDGER.hours.map((b) => ({ at: b.at, in: b.in, out: b.out, players: b.players.size,
    perPlayer: b.players.size ? Math.round((b.in - b.out) / b.players.size) : 0 }));
  return {
    since: LEDGER.since,
    hours: +hrs.toFixed(2),
    in: { ...LEDGER.in }, out: { ...LEDGER.out },
    totalIn: totIn, totalOut: totOut,
    net: totIn - totOut,
    // the health number: how much of what is paid out is taken back
    sinkRatio: totIn ? +(totOut / totIn).toFixed(3) : 0,
    perHour: hours,
  };
}

export function _resetEconomy() {
  LEDGER = fresh();
}
