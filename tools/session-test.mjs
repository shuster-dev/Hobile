/**
 * The promise this whole flow exists to keep: close the tab, come back, and be
 * where you left off.
 *
 *   npm run build:web && node tools/session-test.mjs
 *
 * A real server, a real browser, and no fixtures — the page is loaded from the
 * server that serves it in production, so what is proved here is what a player
 * gets. Three things, in order: the first click needs no form; a reload lands
 * back in the world with the same character; and claiming a username turns the
 * guest into an account that can be logged into from a browser that has never
 * seen this one's localStorage.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';

const PORT = 2591;
const BASE = `http://127.0.0.1:${PORT}`;
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await wait(150); }
  return false;
};

if (!fs.existsSync('dist/web/index.html')) {
  console.error('needs a web build: npm run build:web');
  process.exit(1);
}

const server = spawn(process.execPath, ['src/server/index.js'], {
  env: { ...process.env, PORT: String(PORT), AUTH_SECRET: 'session-test', NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const log = [];
server.stdout.on('data', (d) => log.push(String(d)));
server.stderr.on('data', (d) => log.push('ERR ' + String(d)));
const up = await until(async () => {
  try { return (await fetch(`${BASE}/api/health`)).ok; } catch { return false; }
}, 15000);
ok('the server serves the built client', up, log.join('').slice(-300));
if (!up) { server.kill(); process.exit(1); }

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const errors = [];
const openPage = async (context) => {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE, { waitUntil: 'load' });
  return page;
};
const inWorld = (page) => page.waitForFunction(
  () => window.__hobile?.mode === 'world' && !!window.__hobile.profile, null, { timeout: 45000 });

// --- first visit: no form ------------------------------------------------
// A phone, because that is the only shape this game is played in.
const PHONE = { viewport: { width: 430, height: 880 }, deviceScaleFactor: 2 };
const first = await browser.newContext(PHONE);
const page = await openPage(first);
await page.waitForSelector('#pick-starter .starter, #screen-login:not(.hidden)', { timeout: 30000 });
ok('the first click goes straight to the character, not a login form',
  await page.isVisible('#pick-starter .starter'));

await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'רמי');
await page.click('#btn-create');
await inWorld(page);
const born = await page.evaluate(() => ({
  id: window.__hobile.profile.id,
  name: window.__hobile.profile.name,
  guest: window.__hobile.account?.guest,
  token: localStorage.getItem('hobile.token'),
}));
ok('a character is created and the world loads', !!born.id && born.name === 'רמי');
ok('and it is a guest account', born.guest === true);
ok('the claim chip is on screen while it is', await page.isVisible('#btn-claim'));
// An assertion can prove the chip exists; only a look shows whether it reads as
// a status or as an advert.
fs.mkdirSync('shots', { recursive: true });
await page.screenshot({ path: 'shots/session-guest.png' });
await page.click('#btn-claim');
await wait(500);
await page.screenshot({ path: 'shots/session-claim.png' });
await page.evaluate(() => window.__hobile.ui.closePanel());
await wait(400);

// --- leave and come back -------------------------------------------------
// Travel first, so "where you left off" means somewhere other than the start.
await page.evaluate(() => window.__hobile.net.send('travel', { zone: 'verdant_meadow' }));
await page.waitForFunction(() => window.__hobile?.world?.zone?.id === 'verdant_meadow', null, { timeout: 30000 });
await wait(1500);
await page.reload({ waitUntil: 'load' });
await inWorld(page);
const again = await page.evaluate(() => ({
  id: window.__hobile.profile.id,
  name: window.__hobile.profile.name,
  zone: window.__hobile.world.zone.id,
  login: !document.getElementById('screen-login').classList.contains('hidden'),
}));
ok('a reload lands back in the world with no login screen', again.login === false);
ok('as the same character', again.id === born.id && again.name === 'רמי', `${born.id} -> ${again.id}`);
ok('in the zone it was left in', again.zone === 'verdant_meadow', again.zone);

// --- claim it ------------------------------------------------------------
const claimed = await page.evaluate(async () => {
  const r = await window.__hobile.hooks().claim('rami_test', 'hunter2');
  return { r, account: window.__hobile.account };
});
ok('the guest can claim a username from inside the game', claimed.r?.ok === true, JSON.stringify(claimed.r));
ok('and stops being a guest', claimed.account?.guest === false && claimed.account?.username === 'rami_test');
ok('the chip goes away once there is nothing to claim', !(await page.isVisible('#btn-claim')));

// --- a browser that has never seen this one ------------------------------
const stranger = await browser.newContext(PHONE);
const page2 = await openPage(stranger);
await page2.waitForSelector('#pick-starter .starter, #screen-login:not(.hidden)', { timeout: 30000 });
await page2.evaluate(async () => {
  const g = window.__hobile;
  g.net.logout();
  await g.net.login('rami_test', 'hunter2');
});
await page2.reload({ waitUntil: 'load' });
await inWorld(page2);
const elsewhere = await page2.evaluate(() => ({
  id: window.__hobile.profile.id,
  name: window.__hobile.profile.name,
  zone: window.__hobile.world.zone.id,
}));
ok('logging in from another browser finds the same character',
  elsewhere.id === born.id && elsewhere.name === 'רמי', `${born.id} -> ${elsewhere.id}`);
ok('and the same place', elsewhere.zone === 'verdant_meadow', elsewhere.zone);

console.log(`\nconsole errors: ${errors.length}`, errors.slice(0, 4));
ok('no console errors anywhere in the flow', errors.length === 0);

await browser.close();
server.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
