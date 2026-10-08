/**
 * Errors on this phone, sent home (server/telemetry.js) — so a crash a player
 * meets is something the GM can see, instead of nothing anyone ever hears of.
 *
 * Each distinct error goes once a session (its message and where), a dozen at
 * most, a few seconds after it happens so a cascade of them goes in one
 * request — by sendBeacon, which survives the page being closed on the error.
 * What goes: the message, the stack, the build, where in the game (world,
 * fight; which zone), the kind of phone, the screen, whether it was opened
 * from the home screen. Whose it was only by the session token the page holds.
 */
const MAX = 12;
const seen = new Set();
let sent = 0, queue = [], timer = null, ctx = null;

function device() {
  const ua = navigator.userAgent || '';
  const os = /iPhone|iPad|iPod/.test(ua) ? `iOS ${(ua.match(/OS (\d+[_\d]*)/) || [])[1]?.replace(/_/g, '.') || ''}`
    : /Android/.test(ua) ? `Android ${(ua.match(/Android ([\d.]+)/) || [])[1] || ''}` : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'other';
  const br = /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '';
  return `${os} ${br}`.trim();
}

function flush() {
  timer = null;
  if (!queue.length) return;
  const st = (() => { try { return ctx?.state?.() || {}; } catch { return {}; } })();
  const body = JSON.stringify({ token: st.token || undefined, reports: queue.splice(0) });
  const url = './api/errors';
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
  } catch { /* fall through */ }
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

/** One error: once a session, a few at most, sent together. */
export function reportError(kind, message, stack = '', source = '') {
  if (!ctx || sent >= MAX) return;
  const msg = String(message || '').slice(0, 300);
  if (!msg) return;
  const key = `${msg}|${String(stack).split('\n')[1] || source}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent++;
  const st = (() => { try { return ctx.state?.() || {}; } catch { return {}; } })();
  queue.push({
    kind, message: msg, stack: String(stack || '').slice(0, 2400), source: String(source || '').slice(0, 120),
    version: ctx.version || '', mode: st.mode || '', zone: st.zone || '', device: device(),
    screen: `${innerWidth}x${innerHeight}@${devicePixelRatio || 1}`,
    standalone: !!(navigator.standalone || matchMedia?.('(display-mode: standalone)')?.matches),
  });
  timer || (timer = setTimeout(flush, 3000));
}

/** Listen for what goes wrong on this page. `state()` says where we are. */
export function initCrash({ version = '', state = null } = {}) {
  if (ctx) return;
  ctx = { version, state };
  window.addEventListener('error', (e) => {
    // a script or a model that failed to load arrives as an error on the element
    const t = e.target;
    if (t && t !== window && (t.src || t.href)) return reportError('load', `failed to load ${t.tagName?.toLowerCase()}`, '', String(t.src || t.href).replace(location.origin, ''));
    reportError('error', e.message || e.error?.message, e.error?.stack || '', `${String(e.filename || '').replace(location.origin, '')}:${e.lineno || 0}:${e.colno || 0}`);
  }, true);
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reportError('rejection', r?.message || String(r), r?.stack || '');
  });
  // a phone that ran out of graphics memory: the screen goes black
  document.addEventListener('webglcontextlost', () => reportError('webgl', 'WebGL context lost'), true);
  addEventListener('pagehide', flush);
}
