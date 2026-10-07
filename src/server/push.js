// Notifications to the player's phone (Web Push, VAPID).
//
// What is worth a buzz in a pocket: a creature's training is done, and a
// world boss has appeared. A phone that said yes (the bell in the menu)
// sends its subscription here; it is kept per device, with which of the two
// the player wants. A training's notification is queued for the moment it
// ends and sent by a sweep every half minute — so a restart in between loses
// nothing — and a boss is sent at once to whoever wants bosses and is not in
// the game already.
//
// The keys: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY from the environment if set,
// otherwise made once and kept in the store, so a redeploy does not break
// every phone's subscription.
import webpush from 'web-push';

const SWEEP_MS = 30_000;
const BOSS_COOLDOWN_MS = 45 * 60_000;     // one boss buzz per player per 45 minutes
export const PREFS = { train: 'האימון הסתיים', boss: 'בוס עולמי הופיע', farm: 'הסל בחווה מלא' };

let store = null, keys = null, timer = null, online = () => false;
const lastBoss = new Map();
const sent = { ok: 0, gone: 0, failed: 0 };

/** Start: keys from the environment or the store, and the sweep. */
export async function usePush(s, env = process.env, { isOnline } = {}) {
  store = s;
  isOnline && (online = isOnline);
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) keys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  else {
    keys = await store.getConfig('vapid');
    if (!keys?.publicKey) { keys = webpush.generateVAPIDKeys(); await store.setConfig('vapid', keys); console.log('[push] made new VAPID keys (kept in the store)'); }
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT || 'mailto:admin@hobile.app', keys.publicKey, keys.privateKey);
  clearInterval(timer);
  timer = setInterval(() => sweep().catch((e) => console.warn('[push] sweep', e.message)), SWEEP_MS);
  timer.unref?.();
  return keys.publicKey;
}

export const publicKey = () => keys?.publicKey || null;
export const stats = () => ({ ...sent });

const cleanPrefs = (p = {}) => Object.fromEntries(Object.keys(PREFS).map((k) => [k, p[k] !== false]));
const validSub = (sub) => sub && typeof sub.endpoint === 'string' && /^https:\/\//.test(sub.endpoint) && sub.endpoint.length < 1024
  && typeof sub.keys?.p256dh === 'string' && typeof sub.keys?.auth === 'string';

/** A device says yes (or changes what it wants). */
export async function subscribe(userId, sub, prefs) {
  if (!store || !validSub(sub)) return { ok: false, error: 'bad_subscription' };
  const mine = await store.pushSubsFor(userId);
  // a few devices each, the oldest let go
  for (const old of mine.sort((a, b) => a.at - b.at).slice(0, Math.max(0, mine.length - 4))) await store.deletePushSub(old.sub.endpoint);
  await store.savePushSub({ userId, sub: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, prefs: cleanPrefs(prefs), at: Date.now() });
  return { ok: true, prefs: cleanPrefs(prefs) };
}

export async function unsubscribe(userId, endpoint) {
  if (!store) return { ok: false };
  const mine = await store.pushSubsFor(userId);
  for (const r of mine) if (!endpoint || r.sub.endpoint === endpoint) await store.deletePushSub(r.sub.endpoint);
  return { ok: true };
}

/** Send one notification to every device of a player that wants `pref`. */
export async function notify(userId, pref, msg) {
  if (!store || !keys) return 0;
  const subs = (await store.pushSubsFor(userId)).filter((r) => !pref || r.prefs?.[pref] !== false);
  let n = 0;
  for (const r of subs) n += await deliver(r, msg);
  return n;
}

async function deliver(r, msg) {
  try {
    await webpush.sendNotification(r.sub, JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag || '', url: msg.url || './' }), { TTL: msg.ttl ?? 3600, urgency: msg.urgency || 'normal' });
    sent.ok++;
    return 1;
  } catch (e) {
    // gone for good: the phone unsubscribed or the app was removed
    if (e.statusCode === 404 || e.statusCode === 410) { sent.gone++; await store.deletePushSub(r.sub.endpoint).catch(() => {}); }
    else { sent.failed++; console.warn('[push] send', e.statusCode || '', e.message); }
    return 0;
  }
}

/** Queue a notification for later (`tag` replaces one queued before it). */
export async function schedule(userId, at, pref, tag, title, body) {
  if (!store) return;
  await store.queuePush({ userId, at, pref, tag, title, body });
}
export async function cancel(userId, tag) { store && await store.cancelPush(userId, tag); }

/** Send what has come due. */
export async function sweep(now = Date.now()) {
  if (!store || !keys) return 0;
  let n = 0;
  for (const q of await store.takeDuePush(now)) {
    // someone playing right now sees it in the game
    if (online(q.userId)) continue;
    n += await notify(q.userId, q.pref, { title: q.title, body: q.body, tag: q.tag });
  }
  return n;
}

/** A world boss is up: everyone who wants to know, and is not already here. */
export async function bossAlert(boss, zoneHe) {
  if (!store || !keys) return 0;
  const now = Date.now();
  let n = 0;
  for (const r of await store.pushSubsWanting('boss')) {
    if (online(r.userId) || now - (lastBoss.get(r.userId) || 0) < BOSS_COOLDOWN_MS) continue;
    lastBoss.set(r.userId, now);
    n += await deliver(r, { title: `⚠ ${boss} הופיע!`, body: `ב${zoneHe} — כל מי שבאזור נלחם בו ביחד. יש לך כמה דקות.`, tag: 'boss', ttl: 600, urgency: 'high' });
  }
  return n;
}
