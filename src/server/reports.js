// Player reports, and the GM's inbox of them.
//
// A player reports another with a reason from a short list (shared/reports.js)
// and, if they like, a few words. What the reported player said lately goes
// with it, as typed — the chat filter's asterisks would hide the very words a
// "bad language" report is about (social.js `saidBy`). The report waits in the
// store as `open` until a GM marks it handled or dismissed; a GM online is told
// the moment one comes in.
//
// Kept honest both ways: a reason not on the list is refused, the same player
// can be reported by the same reporter once in ten minutes, and nobody files
// more than a handful an hour — a report is a call for a person's attention,
// not a button to mash at someone.
//
// No node-only imports: the single-player build bundles world-messages.js,
// which reaches here (and has no store, so every report there is refused).
import { REPORT_LIMITS, REPORT_REASONS, REPORT_STATUS } from '../shared/reports.js';
import * as Social from './social.js';

let STORE = null;
export function useReports(store) { STORE = store; }

// GM sessions online, to be told of a new report: id -> Map(key -> send)
const WATCHERS = new Map();
export function watch(id, key, send) {
  let m = WATCHERS.get(id);
  m || WATCHERS.set(id, m = new Map());
  m.set(key, send);
}
export function unwatch(id, key) {
  const m = WATCHERS.get(id);
  m && (m.delete(key), m.size || WATCHERS.delete(id));
}

const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const plain = (s, n) => String(s || '').replace(/[\u0000-\u001f‎‏‪-‮]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** How many reports are waiting, for the GM's menu badge. */
export async function openCount() {
  if (!STORE?.listReports) return 0;
  return (await STORE.listReports(200)).filter((r) => r.status === 'open').length;
}

/**
 * A report from `doc` about player `id`. Returns { ok, report } or { error }.
 * `zone` is where the reporter is.
 */
export async function fileReport(doc, { id, reason, note } = {}, { zone = '' } = {}, now = Date.now()) {
  if (!STORE?.saveReport) return { error: 'reports_unavailable' };
  const aboutId = typeof id === 'string' ? id.slice(0, 64) : '';
  if (!aboutId) return { error: 'bad_player' };
  if (aboutId === doc.id) return { error: 'not_yourself' };
  if (!own(REPORT_REASONS, reason) || REPORT_REASONS[reason].self) return { error: 'bad_reason' };
  const def = REPORT_REASONS[reason], words = plain(note, REPORT_LIMITS.note);
  if (def.needsNote && words.length < 3) return { error: 'need_note' };
  const about = Social.liveDoc(aboutId) || await STORE.getDoc(aboutId).catch(() => null);
  if (!about) return { error: 'bad_player' };
  if (await STORE.reportsSince(doc.id, aboutId, now - REPORT_LIMITS.sameTargetMs) > 0) return { error: 'already_reported' };
  if (await STORE.reportsSince(doc.id, null, now - 3600_000) >= REPORT_LIMITS.perHour) return { error: 'too_many_reports' };
  const where = Social.whereIs?.(aboutId);
  const report = {
    id: `r_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    at: now,
    status: 'open',
    reason,
    note: words,
    zone,
    by: { id: doc.id, name: doc.name },
    about: { id: about.id, name: about.name, level: about.level || 1, zone: where?.zone || about.zone || '' },
    // the reported player's own lines, as typed (none for a cheating report)
    evidence: def.evidence ? Social.saidBy(aboutId, REPORT_LIMITS.evidence, REPORT_LIMITS.evidenceMs, now) : [],
  };
  await STORE.saveReport(report);
  const open = await openCount().catch(() => 0);
  for (const sends of WATCHERS.values()) for (const send of sends.values()) {
    try { send('gm', { kind: 'reportNew', report, open }); } catch { /* gone */ }
  }
  return { ok: true, report };
}

/**
 * A bug, from the player who met it (the menu's 🐞): their words, a small
 * picture of the screen and where they were in the game, to the same inbox.
 * The GMs online are told at once, as for any report.
 */
export async function fileBug(doc, { note, shot, context } = {}, { zone = '' } = {}, now = Date.now()) {
  if (!STORE?.saveReport) return { error: 'reports_unavailable' };
  const words = plain(note, REPORT_LIMITS.bugNote);
  if (words.length < 3) return { error: 'need_note' };
  if (await STORE.reportsSince(doc.id, doc.id, now - 3600_000) >= REPORT_LIMITS.bugsPerHour) return { error: 'too_many_reports' };
  const pic = typeof shot === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(shot) && shot.length <= REPORT_LIMITS.bugShot ? shot : null;
  // what the client says of where it was: a flat bag of short strings and numbers
  const ctx = {};
  for (const [k, v] of Object.entries(context && typeof context === 'object' ? context : {}).slice(0, 30)) {
    typeof v === 'number' && Number.isFinite(v) ? (ctx[plain(k, 24)] = v) : typeof v === 'string' || typeof v === 'boolean' ? (ctx[plain(k, 24)] = plain(String(v), 300)) : null;
  }
  const report = {
    id: `b_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    at: now, status: 'open', reason: 'bug', note: words, zone,
    by: { id: doc.id, name: doc.name },
    about: { id: doc.id, name: doc.name, level: doc.level || 1, zone: doc.zone || zone },
    evidence: [], context: ctx, shot: pic,
  };
  await STORE.saveReport(report);
  const open = await openCount().catch(() => 0);
  for (const sends of WATCHERS.values()) for (const send of sends.values()) {
    try { send('gm', { kind: 'reportNew', report: { ...report, shot: null }, open }); } catch { /* gone */ }
  }
  return { ok: true, report };
}

/** The inbox: open ones first. */
export async function listReports(limit = 60) {
  if (!STORE?.listReports) return [];
  // a bug's picture stays behind (it is fetched one at a time: /api/admin/bug-shot)
  return (await STORE.listReports(limit)).map(({ shot, ...r }) => (shot ? { ...r, hasShot: true } : r));
}

/** One bug's picture of the screen, or null. */
export async function bugShot(id) {
  if (!STORE?.listReports) return null;
  return (await STORE.listReports(200)).find((r) => r.id === id)?.shot || null;
}

/** A GM marks a report handled, dismissed, or open again. */
export async function setReport(gm, id, status, now = Date.now()) {
  if (!STORE?.updateReport) return { error: 'reports_unavailable' };
  if (!own(REPORT_STATUS, status)) return { error: 'bad_status' };
  const r = await STORE.updateReport(String(id || ''), status === 'open'
    ? { status, doneBy: null, doneAt: null }
    : { status, doneBy: { id: gm.id, name: gm.name }, doneAt: now });
  return r ? { ok: true, report: r } : { error: 'not_found' };
}

export function _reset() { WATCHERS.clear(); }
