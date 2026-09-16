/**
 * Making a browser page behave like an app on a phone.
 *
 * A game in a mobile browser fights the browser for every gesture: a pinch
 * zooms the page instead of the camera, a double tap zooms, a drag near the
 * top edge pulls to refresh, a long press pops a selection menu over the
 * joystick, and the screen dims mid-battle. None of that is the game's doing
 * and all of it is the game's problem.
 *
 * On iPhone Safari there is no Fullscreen API at all — `requestFullscreen`
 * exists on iPad and on Android, not on iPhone. The only way to lose the
 * browser chrome there is Add to Home Screen, which needs the page served from
 * its own origin with a manifest. Inside an iframe that is not possible, so
 * `standalone` below reports what we actually got rather than what we asked
 * for, and the UI can tell the player the truth.
 */

const iOS = () => /iP(hone|ad|od)/.test(navigator.platform || '')
  || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform || ''));

export const device = {
  ios: false,
  standalone: false,      // launched from the home screen: no browser chrome
  canFullscreen: false,   // the Fullscreen API is actually usable here
  framed: false,          // running inside an iframe (an artifact, say)
};

let wakeLock = null;

/** Keep the screen awake while playing. Released and re-taken across tab switches. */
async function holdWakeLock() {
  try {
    if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener?.('release', () => { wakeLock = null; });
  } catch { /* denied or unsupported: not worth telling anyone */ }
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement) || device.standalone;
}

export async function toggleFullscreen() {
  try {
    if (isFullscreen() && !device.standalone) {
      await (document.exitFullscreen?.() || document.webkitExitFullscreen?.());
      return false;
    }
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return false;
    await req.call(el, { navigationUI: 'hide' });
    return true;
  } catch { return false; }
}

export function initDevice() {
  device.ios = iOS();
  device.framed = window.self !== window.top;
  device.standalone = !!(window.navigator.standalone
    || window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)')?.matches);
  const el = document.documentElement;
  device.canFullscreen = !!(el.requestFullscreen || el.webkitRequestFullscreen);

  document.body.classList.toggle('is-standalone', device.standalone);
  document.body.classList.toggle('is-ios', device.ios);

  // iOS pinch-zoom arrives as non-standard gesture events, and ignores
  // user-scalable=no in Safari. These are the only way to stop it.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }

  // Double-tap to zoom: Safari decides from the gap between taps, so the second
  // tap is what has to be cancelled — and only outside scrollable panels, or
  // the inventory stops scrolling.
  let lastTap = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 320 && !e.target.closest('.body, input, textarea, select')) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  // Rubber-band scroll and pull-to-refresh. Panels keep their own scrolling.
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) { e.preventDefault(); return; }       // two fingers is always a zoom
    if (!e.target.closest('.body, .team-bar, .log, .screen')) e.preventDefault();
  }, { passive: false });

  // Long press over the world would otherwise pop a text-selection callout.
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('input, textarea')) e.preventDefault();
  });

  // The visual viewport is the honest one on iOS: the address bar collapsing
  // changes it without firing resize, which leaves the canvas the wrong height.
  const syncViewport = () => {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', `${h}px`);
  };
  syncViewport();
  window.visualViewport?.addEventListener('resize', syncViewport);
  window.addEventListener('orientationchange', () => setTimeout(syncViewport, 240));
  window.addEventListener('resize', syncViewport);

  holdWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') holdWakeLock();
  });

  // Installability, and offline once installed. Neither applies inside an
  // iframe, so this is skipped rather than failing loudly in the console.
  if (!device.framed && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  return device;
}
