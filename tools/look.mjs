/**
 * The screens a player actually sees, photographed the same way every time.
 *
 *   npm run build:solo && node tools/look.mjs [outDir]
 *
 * "It doesn't look good" is the one bug report no assertion can check, so the
 * only honest way to work on it is to look — before, after, and at the same
 * shots, so a change is judged against itself and not against memory. Phone
 * viewport, pinned time of day and weather, one file per screen.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] || 'shots/look';
const PORT = 2653;
const W = 430, H = 880;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript'
    : ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.glb' ? 'model/gltf-binary' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
fs.mkdirSync(outDir, { recursive: true });
const shots = [];
const snap = async (name) => {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
  console.log(`  ${file}`);
};

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
// The front door first: the harbour turning behind the logo.
await page.waitForSelector('#btn-play:not([disabled])', { timeout: 30000 });
await wait(3000);
await snap('0-title');
await page.click('#btn-play', { timeout: 30000 });   // the title screen, as a player taps it
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
// The stage's figures and the starter portraits load their models first.
await page.waitForSelector('#pick-starter .portrait', { timeout: 12000 }).catch(() => {});
await wait(2200);
await snap('1-create');

await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'מאיר');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.mode === 'world' && window.__hobile.profile, null, { timeout: 30000 });
const pin = (phase) => page.evaluate((p) => {
  const w = window.__hobile.world;
  w.holdWeather('clear', 'summer');
  w.holdTimeOfDay(p);
}, phase);
await pin(0.42);
await wait(2600);
await snap('2-town');

// The trainer up close, from the front: proportions and colour are judged here.
await page.evaluate(() => {
  const w = window.__hobile.world, a = w.selfActor();
  w._lookSaved = { d: w.camDist, h: w.camHeight, y: w.camYaw };
  w.camDist = 3.4; w.camHeight = 1.3; w.camYaw = (a?.holder.rotation.y || 0) + Math.PI;
});
await wait(1600);
await snap('2b-hero');
await page.evaluate(() => {
  const w = window.__hobile.world, k = w._lookSaved;
  w.camDist = k.d; w.camHeight = k.h; w.camYaw = k.y;
});
await wait(900);

await pin(0.72);
await wait(1800);
await snap('3-town-dusk');

// A field zone, where the creatures are.
await page.evaluate(() => window.__hobile.net.send('travel', { zone: 'verdant_meadow' }));
await page.waitForFunction(() => window.__hobile?.world?.zone?.id === 'verdant_meadow'
  && window.__hobile.mode === 'world', null, { timeout: 30000 }).catch(() => {});
await pin(0.42);
await wait(3200);
await snap('4-field');

// Walk up to the nearest wild and start a fight. Wilds wander on their own
// clock, so the one you set off toward may have moved: re-target and retry.
const approach = () => page.evaluate(async () => {
  const g = window.__hobile, w = g.world;
  if (g.mode !== 'world') return g.mode;
  const all = [...(g.worldState()?.wilds?.values?.() || [])].filter((x) => !x.engagedBy);
  if (!all.length) return 'none';
  const me = w.selfPosition();
  const t = all.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
  const meId = g.net?.room?.sessionId || 'me';
  for (let i = 0; i < 220; i++) {
    const p = g.worldState()?.players?.get?.(meId) || w.selfPosition();
    const live = g.worldState()?.wilds?.get?.(t.id) || t;
    const dx = live.x - p.x, dz = live.z - p.z, d = Math.hypot(dx, dz);
    if (d < 2.2) break;
    const step = Math.min(2.5, d), nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
    g.net.send('move', { x: nx, z: nz, rot: Math.atan2(dx, dz), moving: true });
    w.snapSelf(nx, nz);
    await new Promise((r) => setTimeout(r, 36));
  }
  g.engagePending = 0;
  g.doAction('action');
  return 'tried';
});
let fought = false;
for (let attempt = 0; attempt < 4 && !fought; attempt++) {
  const r = await approach();
  if (r === 'battle') { fought = true; break; }
  fought = await page.waitForFunction(() => window.__hobile?.mode === 'battle', null, { timeout: 12000 })
    .then(() => true).catch(() => false);
}
if (fought) {
  await wait(3500);
  await snap('5-battle');
} else {
  console.log('  (no battle: could not reach a wild)');
}

console.log(`\n${shots.length} shots · console errors: ${errors.length}`, errors.slice(0, 3));
await browser.close();
server.close();
