// The bell: notifications to this phone (server/push.js). Asking the browser,
// subscribing with the server's key, and telling the server which ones are
// wanted. On an iPhone it only works once the game is on the home screen.
const PREFS_KEY = 'hobile.push.prefs';

const b64 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:';
}

/** A phone that could do it once the game is installed (iOS in Safari). */
export function needsInstall() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  return ios && !standalone;
}

export function savedPrefs() {
  try { return { train: true, boss: true, farm: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { train: true, boss: true, farm: true }; }
}

/** Where things stand: 'unsupported' | 'install' | 'denied' | 'off' | 'on'. */
export async function pushState() {
  if (needsInstall()) return 'install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush(net, prefs = savedPrefs()) {
  if (!pushSupported()) throw new Error('unsupported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('denied');
  const reg = await navigator.serviceWorker.ready;
  const { key } = await net.api('/push/key', null, 'GET');
  if (!key) throw new Error('no_key');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
  await net.api('/push/subscribe', { subscription: sub.toJSON(), prefs });
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
  return true;
}

export async function disablePush(net) {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (sub) { await net.api('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  return true;
}

export async function testPush(net) { return net.api('/push/test', {}); }
