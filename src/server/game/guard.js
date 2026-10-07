// Keeping the game honest: what a client may send, how fast it may go, and
// when it starts to look like a script rather than a thumb.
//
// The server already decides everything that matters — damage, captures,
// rewards, prices, what is in reach. This is the rest:
//   flood   — a session sending far more messages than a game needs is
//             slowed (extra messages dropped) and, if it keeps on, let go;
//   speed   — movement has a budget: as far as the fastest way you can be
//             travelling goes in the time since you last moved, plus a little.
//             A step past it is cut short, and counted;
//   cadence — a hand on a phone never sends its moves at exactly the same
//             interval for minutes on end; a script does. That is reported to
//             the GM log once, not punished: a person decides.
// Strikes decay: one burst of lag is not a cheat.
import { RIDE } from '../../shared/riding.js';

export const GUARD = {
  walk: 7.4,              // m/s at full stick (client ui.js kb)
  slack: 1.35,            // lag, a packet that arrives late with two steps in it
  burstSec: 0.9,          // how much unused distance a session may bank
  msgRate: 45,            // messages a second, sustained (moves are ~12)
  msgBurst: 90,
  strikeWindowMs: 60_000,
  kickAt: 120,            // dropped messages in a minute before the session is let go
  speedReportAt: 25,      // cut-short moves in a minute before the GM hears of it
  cadenceSamples: 400,    // moves before the rhythm is judged
  cadenceJitterMs: 1.2,   // a thumb is never this steady
};

/** Tokens that refill over time: `take` says whether there is one to spend. */
export class Bucket {
  constructor(rate, burst) { this.rate = rate; this.burst = burst; this.level = burst; this.at = 0; }
  take(now = Date.now(), n = 1) {
    if (this.at) this.level = Math.min(this.burst, this.level + (now - this.at) / 1000 * this.rate);
    this.at = now;
    if (this.level < n) return false;
    this.level -= n;
    return true;
  }
}

/** The guard's record for one session (kept on its context). */
export function guardOf(ctx) {
  return ctx.guard || (ctx.guard = { msgs: new Bucket(GUARD.msgRate, GUARD.msgBurst), strikes: [], reported: new Set(), moveAt: 0, bank: 0, gaps: { n: 0, mean: 0, m2: 0, last: 0 } });
}

/** Count a strike of `kind`; returns how many of that kind in the window. */
export function strike(ctx, kind, now = Date.now()) {
  const g = guardOf(ctx);
  g.strikes.push({ kind, at: now });
  while (g.strikes.length && now - g.strikes[0].at > GUARD.strikeWindowMs) g.strikes.shift();
  return g.strikes.filter((s) => s.kind === kind).length;
}

/** A message arrived: may it be handled? (false: drop it) */
export function admitMessage(ctx, now = Date.now()) {
  return guardOf(ctx).msgs.take(now);
}

/** The fastest this session may be travelling now, in m/s. */
export function speedLimit(ride) {
  return GUARD.walk * (RIDE[ride?.kind]?.speed || 1) * GUARD.slack;
}

/**
 * How far a move may go: the distance budget since the last move (banked up
 * to `burstSec`). Returns the allowed distance; `spend` it with what was used.
 */
export function moveAllowance(ctx, now = Date.now()) {
  const g = guardOf(ctx), v = speedLimit(ctx.ride);
  if (!g.moveAt) { g.moveAt = now; g.bank = v * GUARD.burstSec; }
  g.bank = Math.min(v * GUARD.burstSec, g.bank + (now - g.moveAt) / 1000 * v);
  g.moveAt = now;
  return g.bank;
}
export function spendMove(ctx, d) { const g = guardOf(ctx); g.bank = Math.max(0, g.bank - d); }

/**
 * The rhythm of a session's moves. Returns 'bot_cadence' once, when the gaps
 * between moves have been machine-steady for long enough; otherwise null.
 */
export function cadence(ctx, now = Date.now()) {
  const g = guardOf(ctx), c = g.gaps;
  if (c.last) {
    const gap = now - c.last;
    if (gap > 0 && gap < 1000) {
      // Welford's running mean and variance
      c.n++;
      const d = gap - c.mean;
      c.mean += d / c.n;
      c.m2 += d * (gap - c.mean);
    }
  }
  c.last = now;
  if (c.n >= GUARD.cadenceSamples && !g.reported.has('bot_cadence')) {
    const sd = Math.sqrt(c.m2 / (c.n - 1));
    if (sd < GUARD.cadenceJitterMs) { g.reported.add('bot_cadence'); return 'bot_cadence'; }
    // judged and human: start a fresh window, so a later switch to a script is seen too
    c.n = 0; c.mean = 0; c.m2 = 0;
  }
  return null;
}

/** HTTP: requests per client address, for the doors people guess passwords at. */
export class AddressLimiter {
  constructor(rate, burst, max = 20000) { this.rate = rate; this.burst = burst; this.max = max; this.map = new Map(); }
  take(key, now = Date.now()) {
    let b = this.map.get(key);
    if (!b) {
      if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
      b = new Bucket(this.rate, this.burst);
      this.map.set(key, b);
    }
    return b.take(now);
  }
  /** Express middleware: 429 when the address has knocked too often. */
  middleware() {
    return (req, res, next) => (this.take(req.ip || req.socket?.remoteAddress || '?') ? next() : res.status(429).json({ error: 'too_many_requests' }));
  }
}
