/**
 * Screenshots of the models where it actually matters: inside the game.
 *
 * A contact sheet proves a model loads. It cannot show whether the creature is
 * the right size next to a person, whether it reads at the camera distance the
 * game actually uses, or whether the battle view frames it. That needs the real
 * game, driven to the right place, and then a look.
 *
 *   node tools/models/gameshot.mjs [outPrefix]
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const prefix = process.argv[2] || 'shots/game';
const PORT = 2618;
const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, {
    'content-type': ext === '.js' ? 'text/javascript'
      : ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream',
  });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 430, height: 880 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shot = async (name) => {
  fs.mkdirSync(path.dirname(prefix), { recursive: true });
  await page.screenshot({ path: `${prefix}-${name}.png` });
  console.log(`  shot: ${prefix}-${name}.png`);
};

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'מאיר');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.zone && window.__hobile.mode !== 'boot', null, { timeout: 30000 });
await page.evaluate(() => window.__hobile.world.holdTimeOfDay(0.34));
// Models arrive over the network, so the creature on screen at second one is
// still the procedural one. Wait for the swap before judging anything.
await page.waitForFunction(() => {
  const w = window.__hobile?.world;
  const actor = w?.selfActor?.();
  return !!(actor?.pet?.group?.userData?.model);
}, null, { timeout: 30000 }).catch(() => console.log('  (pet model did not attach)'));
await page.waitForTimeout(1500);

// --- the player and their creature, close in
await page.evaluate(() => {
  const w = window.__hobile.world;
  w.camDist = 11;
  w.camHeight = 4.4;
  w.camPitch = 0.42;
});
await page.waitForTimeout(1200);
await shot('world');

// --- the same thing with the interface out of the way
await page.evaluate(() => {
  for (const el of document.querySelectorAll('#hud, #overlay, .hud, #tracker, #chat, #stick, #actions')) {
    el.style.visibility = 'hidden';
  }
});
await page.waitForTimeout(400);
await shot('world-clean');
await page.evaluate(() => {
  for (const el of document.querySelectorAll('#hud, #overlay, .hud, #tracker, #chat, #stick, #actions')) {
    el.style.visibility = '';
  }
});

// --- a battle: walk to the nearest wild creature, then engage it
const engaged = await page.evaluate(async () => {
  const g = window.__hobile;
  const said = [];
  g.net.on('error', (e) => said.push(e?.code || JSON.stringify(e)));
  const state = g.worldState();
  const wilds = [...(state?.wilds || [])];
  if (!wilds.length) return 'no wilds';
  const [id, wild] = wilds[0].length === 2 ? wilds[0] : [wilds[0].id, wilds[0]];
  // The server clamps movement to three metres a packet, so arriving next to
  // the creature means walking there rather than teleporting. selfPosition()
  // hands back the live vector, so the start has to be copied out of it.
  const from = { x: g.world.selfPosition().x, z: g.world.selfPosition().z };
  const gap = Math.hypot(wild.x - from.x, wild.z - from.z);
  const steps = Math.max(8, Math.ceil(gap / 2.4));
  for (let i = 1; i <= steps; i += 1) {
    const x = from.x + ((wild.x - from.x) * i) / steps;
    const z = from.z + ((wild.z - from.z) * i) / steps;
    g.world.snapSelf(x, z);
    g.net.send('move', { x, z, rot: 0 });
    await new Promise((r) => setTimeout(r, 40));
  }
  g.net.send('engage', { wildId: id });
  await new Promise((r) => setTimeout(r, 600));
  const now = g.world.selfPosition();
  return `${id} species=${wild.species} gap=${Math.hypot(wild.x - now.x, wild.z - now.z).toFixed(1)}m${said.length ? ` refused: ${said.join(',')}` : ''}`;
});
console.log(`  engaged: ${engaged}`);
await page.waitForFunction(() => window.__hobile?.mode === 'battle', null, { timeout: 25000 })
  .catch(() => console.log('  (battle did not start)'));
await page.waitForTimeout(4000);
await shot('battle');

console.log(errors.length ? `console errors: ${errors.length}` : 'console errors: 0');
for (const e of [...new Set(errors)].slice(0, 6)) console.log('   ', e.slice(0, 200));
await browser.close();
server.close();
