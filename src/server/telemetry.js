// Crashes and errors from the phones (and from the server itself), for the GM.
//
// Until now an error on a player's phone went nowhere. The client
// (client/crash.js) sends each distinct error once per session to
// /api/errors; here it is cleaned, given a signature (the message and the
// first line of the stack, with numbers taken out so the same fault on two
// builds is one row), and counted in the store: how many times, since when,
// on which builds, for how many players, on what kind of device. The GM panel
// lists them, worst first, and a row can be marked fixed — it comes back if
// it happens again.
//
// No third party sees any of it.
let STORE = null;
export function useTelemetry(store) { STORE = store; }

export const ERR_LIMITS = { message: 300, stack: 2400, field: 120, list: 60 };

const clip = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').slice(0, n);

/** The same fault, wherever and whenever: message + where, numbers out. */
export function signature(message, stack = '') {
  const top = String(stack || '').split('\n').map((l) => l.trim()).find((l) => /^at |@|\.js/.test(l)) || '';
  const norm = (s) => s.replace(/https?:\/\/[^\s)]+\//g, '').replace(/\.[A-Z0-9]{6,}\.js/gi, '.js').replace(/\d+/g, '#').slice(0, 200);
  return `${norm(String(message || ''))}|${norm(top)}`;
}

/** What a device sent, made safe to keep. Returns null for nonsense. */
export function cleanReport(body = {}, extra = {}) {
  const message = clip(body.message, ERR_LIMITS.message).trim();
  if (!message) return null;
  const sample = {
    message,
    stack: clip(body.stack, ERR_LIMITS.stack),
    source: clip(body.source, ERR_LIMITS.field),
    kind: ['error', 'rejection', 'webgl', 'load', 'server'].includes(body.kind) ? body.kind : 'error',
    version: clip(body.version, 24),
    mode: clip(body.mode, 24),
    zone: clip(body.zone, 40),
    device: clip(body.device, ERR_LIMITS.field),
    screen: clip(body.screen, 24),
    standalone: !!body.standalone,
    at: Date.now(),
    ...extra,
  };
  return { sig: signature(message, sample.stack), sample };
}

/** Count one error (from a phone, or the server's own). */
export async function noteError(body, extra = {}) {
  if (!STORE?.noteError) return false;
  const r = cleanReport(body, extra);
  if (!r) return false;
  await STORE.noteError(r.sig, r.sample);
  return true;
}

/** The server's own failures go in the same list. */
export function serverError(err, where = '') {
  noteError({ message: err?.message || String(err), stack: err?.stack || '', kind: 'server', source: where, version: 'server' })
    .catch(() => {});
}

export async function listErrors(limit = ERR_LIMITS.list) {
  return STORE?.listErrors ? STORE.listErrors(limit) : [];
}

export async function resolveError(sig) {
  return STORE?.resolveError ? STORE.resolveError(String(sig || '')) : null;
}
