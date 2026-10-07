// Two real browsers on one real server, playing together the way two people
// would: meet in the port, open each other, make a party, fight a wild
// together, then a duel. Screenshots of each step from both sides.
//
//   npm run build && node tools/duo-test.mjs [outDir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const outDir = process.argv[2] || 'shots/duo';
fs.mkdirSync(outDir, { recursive: true });
const PORT = 2575, BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await wait(150); } return false; };

const server = spawn(process.execPath, ['src/server/index.js'], {
  env: { ...process.env, PORT: String(PORT), AUTH_SECRET: 'duo-secret', NODE_ENV: 'test', ADMIN_USERS: 'alice' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const kill = () => { try { server.kill('SIGKILL'); } catch {} };
process.on('exit', kill);
const log = [];
server.stdout.on('data', (d) => log.push(String(d))); server.stderr.on('data', (d) => log.push('ERR ' + d));
ok('server starts', await until(async () => { try { return (await fetch(`${BASE}/api/health`)).ok; } catch { return false; } }, 15000));

const api = async (p, body, token) => {
  const r = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return r.json().catch(() => ({}));
};
const players = {};
for (const [u, name, starter, kind] of [['alice', 'אליס', 'cindcub', 'ranger'], ['bob', 'בוב', 'sproutle', 'pirate']]) {
  const r = await api('/api/register', { username: u, password: 'hunter22' });
  await api('/api/character', { name, starter, appearance: { kind, look: 'a' } }, r.token);
  const me = await api('/api/me', null, r.token);
  players[u] = { token: r.token, id: me.profile.id, name };
}

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pages = {}, errors = { alice: [], bob: [] };
for (const u of ['alice', 'bob']) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 880 }, deviceScaleFactor: 1.25 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('hobile.token', t); localStorage.setItem('hobile.remember', '1'); } catch {} }, players[u].token);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors[u].push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|GPU stall/i.test(m.text())) errors[u].push(m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?tier=low`, { waitUntil: 'load' });
  pages[u] = page;
}
const A = pages.alice, B = pages.bob;
const shot = async (u, name) => { const f = path.join(outDir, `${name}-${u}.png`); await pages[u].screenshot({ path: f }); return f; };
const g = (page, fn, arg) => page.evaluate(fn, arg);

for (const u of ['alice', 'bob']) {
  await pages[u].waitForSelector('#btn-play:not([disabled])', { timeout: 60000 });
  await pages[u].click('#btn-play', { timeout: 60000 });
}
ok('both are in the world', await until(async () => (await g(A, () => window.__hobile?.mode)) === 'world' && (await g(B, () => window.__hobile?.mode)) === 'world', 60000));
await wait(1500);

// walk Bob over to Alice, the way the client moves: small steps the server accepts
const walkTo = async (page, target) => {
  for (let i = 0; i < 80; i++) {
    const d = await page.evaluate(async (t) => {
      const h = window.__hobile, w = h.world, p = w.selfPosition();
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      if (d < 2.2) return d;
      const s = Math.min(2, d - 1.8), nx = p.x + dx / d * s, nz = p.z + dz / d * s;
      h.net.send('move', { x: nx, z: nz, rot: Math.atan2(dx, dz), moving: true }); w.snapSelf(nx, nz);
      await new Promise((r) => setTimeout(r, 60));
      return d;
    }, target);
    if (d < 2.2) return d;
  }
  return 99;
};
const posOf = (page) => page.evaluate(() => { const p = window.__hobile.world.selfPosition(); return { x: p.x, z: p.z }; });
const near = await walkTo(B, await posOf(A));
ok('Bob walks up to Alice', near < 3, String(near));
await wait(800);
ok('each sees the other in the port', await until(async () => (await g(A, () => window.__hobile.worldState()?.players?.size)) >= 2, 5000));
await shot('alice', '01-meet');

// Alice taps the action button beside Bob: his sheet
await g(A, () => window.__hobile.doAction());
ok('the action button beside a player opens them', await until(() => g(A, () => document.querySelector('#panel')?.dataset.panelId === 'player'), 4000));
await shot('alice', '02-player-sheet');
await A.locator('#panel button', { hasText: 'הזמן לקבוצה' }).click();
ok('Bob gets the invitation on screen', await until(() => g(B, () => !!document.querySelector('#offers .offer')), 6000));
await shot('bob', '03-party-invite');
await B.locator('#offers .offer .btn.primary').first().click();
ok('he joins: both see the party on the world screen',
  await until(() => g(A, () => !document.querySelector('#party-strip')?.classList.contains('hidden') && document.querySelector('#party-strip')?.textContent.includes('בוב')), 6000)
  && await until(() => g(B, () => document.querySelector('#party-strip')?.textContent.includes('אליס')), 6000));
await shot('alice', '04-party');

// a wild for the two of them
await g(A, () => window.__hobile.net.send('gm', { op: 'summon', species: 'pebblin', level: 3 }));
let wildId = null;
await until(async () => { wildId = await g(A, () => { const h = window.__hobile, p = h.world.selfPosition(); for (const [id, w] of h.worldState().wilds) if (w.species === 'pebblin' && w.level === 3 && !w.engagedBy && Math.hypot(w.x - p.x, w.z - p.z) < 7) return id; return null; }); return !!wildId; }, 5000);
ok('a wild appears beside them', !!wildId);
await g(A, (id) => { window.__hobile.engagePending = 0; window.__hobile.net.send('engage', { wildId: id }); }, wildId);
ok('Alice takes it on', await until(() => g(A, () => window.__hobile.mode === 'battle'), 30000));
ok('Bob is asked to join', await until(() => g(B, () => [...document.querySelectorAll('#offers .offer')].some((o) => o.textContent.includes('הצטרף'))), 8000));
await shot('bob', '05-join-offer');
await B.locator('#offers .offer', { hasText: 'הצטרף' }).locator('.btn.primary').first().click();
ok('Bob is in the same fight', await until(() => g(B, () => window.__hobile.mode === 'battle' && (window.__hobile.battle.players || []).length === 2), 30000));
await wait(2500);
await shot('alice', '06-coop'); await shot('bob', '06-coop');
const rows = await g(A, () => document.querySelectorAll('#combat-bars-self .combat-row').length);
ok('Alice sees Bob\'s creature beside hers', rows >= 2, String(rows));
const fightOn = async (pg) => pg.evaluate(() => { const b = [...document.querySelectorAll('#battle-skills .sk')].find((x) => !x.disabled); b?.click(); });
const ended = (pg) => pg.evaluate(() => window.__hobile.mode !== 'battle');
await until(async () => { await fightOn(A); await fightOn(B); return (await ended(A)) && (await ended(B)); }, 90000);
ok('they finish it together and are back in the world', await until(async () => (await g(A, () => window.__hobile.mode)) === 'world' && (await g(B, () => window.__hobile.mode)) === 'world', 20000));
await wait(1500);

// a duel
await walkTo(B, await posOf(A));
await g(A, () => window.__hobile.doAction());
await until(() => g(A, () => document.querySelector('#panel')?.dataset.panelId === 'player'), 4000);
await A.locator('#panel button', { hasText: 'דו‑קרב 1 נגד 1' }).click();
ok('Bob is challenged', await until(() => g(B, () => [...document.querySelectorAll('#offers .offer')].some((o) => o.textContent.includes('דו‑קרב'))), 6000));
await shot('bob', '07-duel-offer');
await B.locator('#offers .offer', { hasText: 'דו‑קרב' }).locator('.btn.primary').first().click();
ok('both are in the arena', await until(async () => (await g(A, () => window.__hobile.mode)) === 'battle' && (await g(B, () => window.__hobile.mode)) === 'battle', 30000));
await wait(4500);
await shot('alice', '08-duel'); await shot('bob', '08-duel');
const sides = { a: await g(A, () => window.__hobile.battle.mySide), b: await g(B, () => window.__hobile.battle.mySide) };
ok('on opposite sides, each seeing their own up close', sides.a !== sides.b, JSON.stringify(sides));
await until(async () => { await fightOn(A); await fightOn(B); return (await ended(A)) && (await ended(B)); }, 120000);
ok('the duel ends and both are back', await until(async () => (await g(A, () => window.__hobile.mode)) === 'world' && (await g(B, () => window.__hobile.mode)) === 'world', 20000));
await shot('alice', '09-after');

ok('no errors in either browser', !errors.alice.length && !errors.bob.length, JSON.stringify(errors).slice(0, 400));
await browser.close();
server.kill('SIGTERM');
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log(log.join('').slice(-1500));
process.exit(fail ? 1 : 0);
