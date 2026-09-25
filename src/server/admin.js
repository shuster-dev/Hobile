// Who is a GM.
//
// The repo is public, so nothing in it names anyone. The server reads the list
// from the ADMIN_USERS environment variable (set in the Render dashboard):
// usernames, separated by commas or spaces. Only a registered or claimed
// account counts — a guest has no username to match, only an auto-generated
// placeholder — and the check runs on the server when a player joins a zone,
// so nothing the client sends can turn it on.
//
// A name in the list that nobody has registered yet would go to whoever
// registers it first. The server says so in its log at startup.

export function adminNames(env = process.env) {
  return new Set(String(env.ADMIN_USERS || '')
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean));
}

export function isAdmin(user, env = process.env) {
  if (!user || user.guest || typeof user.username !== 'string') return false;
  return adminNames(env).has(user.username.toLowerCase());
}

/** The document ids of the GM accounts, for leaving them off the leaderboard:
 *  a GM can hand themselves anything, so a GM on the board is noise. */
let cached = { at: 0, ids: [] };
export async function adminIds(store, env = process.env) {
  if (Date.now() - cached.at < 60_000) return cached.ids;
  const ids = [];
  for (const name of adminNames(env)) {
    const u = await store.findUser(name).catch(() => null);
    if (u && !u.guest) ids.push(u.id);
  }
  cached = { at: Date.now(), ids };
  return ids;
}

export async function reportAdmins(store, env = process.env, log = console.log) {
  const names = [...adminNames(env)];
  if (!names.length) return;
  const rows = [];
  for (const name of names) {
    const u = await store.findUser(name).catch(() => null);
    rows.push(u && !u.guest ? `${name} (ok)` : `${name} (NOT REGISTERED — whoever registers this name becomes a GM)`);
  }
  log(`[gm] ADMIN_USERS: ${rows.join(', ')}`);
}
