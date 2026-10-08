// Who comes back, and where they stop (checklist g5).
//
// Nothing leaves the server for this. Each player's document keeps a small
// record of when they play (`seen`): the first day, the days they came (UTC
// day stamps, the last 120), how many sittings and how long in all. A sitting
// starts when a player is first online anywhere (social.js attach) and ends a
// minute and a half after the last of their rooms closes — so walking into a
// fight and out again is one sitting, not three.
//
// The report is worked out on demand from those records: daily, weekly and
// monthly players, new ones, retention after one, seven and thirty days (by
// the day they started), how long a sitting lasts, and — for everyone who has
// not been back for three days — how far they had got when they stopped: the
// level, the time played, the step of the story, the step of the guide.
let STORE = null;
export function useMetrics(store) { STORE = store; }

export const METRICS = {
  graceMs: 90_000,            // a gap shorter than this is the same sitting
  sittingCapMs: 4 * 3600e3,   // a tab left open overnight is not a 9-hour sitting
  keepDays: 120,
  goneDays: 3,                // not back for this long: counted as having stopped
};

const DAY = 86400e3;
export const dayStamp = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const dayNum = (stamp) => Math.floor(Date.parse(`${stamp}T00:00:00Z`) / DAY);

/** The record on the document, made whole. */
export function seenOf(doc) {
  const s = doc.seen && typeof doc.seen === 'object' ? doc.seen : (doc.seen = {});
  Array.isArray(s.days) || (s.days = []);
  s.sessions ||= 0, s.playMs ||= 0;
  return s;
}

/** Mark today as a day this player came. */
export function markDay(doc, now = Date.now()) {
  const s = seenOf(doc), d = dayStamp(now);
  s.first ||= now;
  s.last = now;
  if (s.days[s.days.length - 1] !== d && !s.days.includes(d)) {
    s.days.push(d);
    s.days.length > METRICS.keepDays && s.days.splice(0, s.days.length - METRICS.keepDays);
  }
  return s;
}

// sittings in progress: player id -> { doc, start, timer }
const OPEN = new Map();

/** A player is online (their first room opened). */
export function online(doc, now = Date.now()) {
  if (!doc?.id) return;
  const o = OPEN.get(doc.id);
  if (o) { clearTimeout(o.timer); o.timer = null; o.doc = doc; markDay(doc, now); return; }
  markDay(doc, now);
  OPEN.set(doc.id, { doc, start: now, timer: null });
}

/** Their last room closed: the sitting ends unless they are back soon. */
export function offline(doc, now = Date.now()) {
  const o = doc?.id && OPEN.get(doc.id);
  if (!o) return;
  clearTimeout(o.timer);
  o.endAt = now;
  o.timer = setTimeout(() => close(doc.id), METRICS.graceMs);
  o.timer.unref?.();
}

function close(id) {
  const o = OPEN.get(id);
  if (!o) return;
  OPEN.delete(id);
  const s = seenOf(o.doc), ms = Math.max(0, Math.min(METRICS.sittingCapMs, (o.endAt || Date.now()) - o.start));
  s.sessions += 1, s.playMs += ms, s.longest = Math.max(s.longest || 0, ms), s.last = o.endAt || Date.now();
  o.doc._deleted || STORE?.saveDoc?.(o.doc)?.catch?.(() => {});
}

/** Close every open sitting now (shutdown, and the tests). */
export function flush() { for (const id of [...OPEN.keys()]) { clearTimeout(OPEN.get(id).timer); OPEN.get(id).endAt ||= Date.now(); close(id); } }
export const _open = OPEN;

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
const bucket = (v, edges, labels) => labels[edges.findIndex((e) => v < e)] ?? labels[labels.length - 1];

/** The report, from the documents' records. */
export function report(rows, { now = Date.now(), onlineNow = 0, mainIds = [] } = {}) {
  const today = dayNum(dayStamp(now));
  const players = rows.filter((r) => r?.seen?.days?.length);
  const daysOf = (r) => new Set(r.seen.days.map(dayNum));
  const activeWithin = (n) => players.filter((r) => [...daysOf(r)].some((d) => today - d < n)).length;
  const firstDay = (r) => dayNum(dayStamp(r.seen.first || Date.parse(`${r.seen.days[0]}T00:00:00Z`)));

  // retention by the day a player started: of those who started on day d, how
  // many came on day d+k — counted over every start day old enough to know
  const retention = (k) => {
    let base = 0, back = 0;
    for (const r of players) {
      const f = firstDay(r);
      if (today - f < k || today - f > 60 + k) continue;
      base += 1;
      daysOf(r).has(f + k) && (back += 1);
    }
    return { pct: pct(back, base), of: base };
  };

  const sessions = players.reduce((a, r) => a + (r.seen.sessions || 0), 0);
  const playMs = players.reduce((a, r) => a + (r.seen.playMs || 0), 0);
  const plays = players.map((r) => r.seen.playMs || 0).sort((a, b) => a - b);

  // the ones who stopped: how far they had got
  const gone = players.filter((r) => today - Math.max(...daysOf(r)) >= METRICS.goneDays);
  const count = (fn, order) => {
    const m = new Map(order.map((k) => [k, 0]));
    for (const r of gone) { const k = fn(r); m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([label, n]) => ({ label, n, pct: pct(n, gone.length) }));
  };
  const LV = ['1–2', '3–5', '6–10', '11–20', '21+'];
  const TIME = ['פחות מ‑5 דק׳', '5–15 דק׳', '15–60 דק׳', '1–3 שע׳', 'יותר מ‑3 שע׳'];
  const mainSet = new Set(mainIds);
  const story = (r) => (r.quests?.done || []).filter((q) => mainSet.has(q)).length;
  const STORY = ['0', '1', '2', '3–5', '6–10', '11+'];

  return {
    at: now,
    players: players.length,
    untracked: rows.length - players.length,
    online: onlineNow,
    dau: activeWithin(1), wau: activeWithin(7), mau: activeWithin(30),
    newToday: players.filter((r) => firstDay(r) === today).length,
    newWeek: players.filter((r) => today - firstDay(r) < 7).length,
    d1: retention(1), d7: retention(7), d30: retention(30),
    sessions,
    avgSessionMin: sessions ? Math.round(playMs / sessions / 6e3) / 10 : null,
    medianPlayMin: plays.length ? Math.round(plays[Math.floor(plays.length / 2)] / 6e3) / 10 : null,
    gone: gone.length,
    byLevel: count((r) => bucket(r.level || 1, [3, 6, 11, 21], LV), LV),
    byTime: count((r) => bucket((r.seen.playMs || 0) / 6e4, [5, 15, 60, 180], TIME), TIME),
    byStory: count((r) => bucket(story(r), [1, 2, 3, 6, 11], STORY), STORY),
    byGuide: gone.some((r) => r.tutorial) ? count((r) => (r.tutorial?.done ? 'סיים' : `צעד ${(r.tutorial?.step || 0) + 1}`), []) : [],
  };
}

/** The report for the GM panel, straight from the store. */
export async function metricsReport({ onlineNow = 0, mainIds = [] } = {}) {
  const rows = STORE?.metricsRows ? await STORE.metricsRows() : [];
  // sittings still open count as played so far
  for (const r of rows) {
    const o = OPEN.get(r.id);
    if (o) r.seen = { ...(r.seen || {}), playMs: (r.seen?.playMs || 0) + (Date.now() - o.start), sessions: (r.seen?.sessions || 0) + 1 };
  }
  return report(rows, { onlineNow, mainIds });
}
