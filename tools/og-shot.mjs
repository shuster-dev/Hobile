/**
 * The link's picture (og:image): what a group chat shows under the link to
 * the game. A meadow in the morning, the team out, the title over it.
 *
 *   npm run build:solo && node tools/og-shot.mjs   # writes src/client/og.jpg
 *
 * (Below, from tools/look.mjs: the same browser, the same page.)
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

const outDir = 'shots/og';
const PORT = Number(process.env.PORT || 2653);
const W = 1200, H = 630;
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
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
// software GL draws a tier above low slowly: give every step time
page.setDefaultTimeout(Number(process.env.STEP_MS || 30000));
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

await page.goto(`http://127.0.0.1:${PORT}/${process.env.PAGE || 'solo.html'}${process.env.QUERY ? '?' + process.env.QUERY : ''}`, { waitUntil: 'load' });
// The front door first: the harbour turning behind the logo.
await page.waitForSelector('#btn-play:not([disabled])', { timeout: Number(process.env.STEP_MS || 30000) });
await wait(3000);
await snap('0-title');
await page.click('#btn-play', { timeout: Number(process.env.STEP_MS || 30000) });   // the title screen, as a player taps it
await page.waitForSelector('#btn-next', { timeout: Number(process.env.STEP_MS || 25000) });

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.click('#btn-play');
await page.waitForSelector('#btn-next');
await page.click('#btn-next');
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'Hobile');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.mode === 'world' && window.__hobile.profile);
await page.evaluate(() => {
  const g = window.__hobile, d = g.net.doc;
  g.ui.closePanel?.();
  d.badges = ['badge_leaf'];
  for (const [sp, lv] of [['grovenard', 14], ['pyrelynx', 14], ['tidefin', 14]]) {
    const c = { uid: 'og-' + sp, species: sp, level: lv, xp: 0, iv: 0.8, nature: 'steady', ability: 'surge', star: 2, hp: 200, maxHp: 200 };
    d.creatures[c.uid] = c; d.team.unshift(c.uid);
  }
  g.net.send('travel', { zone: 'verdant_meadow' });
});
await page.waitForFunction(() => window.__hobile?.world?.zone?.id === 'verdant_meadow' && window.__hobile.mode === 'world', null, { timeout: 40000 }).catch(() => {});
await page.evaluate(async () => {
  const g = window.__hobile, w = g.world;
  w.holdWeather('clear', 'summer'); w.holdTimeOfDay(0.36);
  // out into the open meadow, toward its middle, away from the camp's walls
  const camp = w.zone.landmarks.find((l) => l.kind === 'camp') || { x: 0, z: 0 };
  const yaw = Math.hypot(camp.x, camp.z) > 8 ? Math.atan2(-camp.x, -camp.z) : 0;
  for (let i = 0; i < 14; i++) {
    const p = w.selfPosition(), nx = p.x + Math.sin(yaw) * 2.4, nz = p.z + Math.cos(yaw) * 2.4;
    g.net.send('move', { x: nx, z: nz, rot: yaw, moving: true }); w.snapSelf(nx, nz);
    await new Promise((r) => setTimeout(r, 60));
  }
  g.net.send('move', { ...w.selfPosition(), rot: yaw, moving: false });
  // a low, wide look across it
  w.camYaw = yaw + Math.PI * 0.85; w.camDist = 9; w.camHeight = 3.2;
});
await wait(5500);
// no HUD: the world, and a title over it
await page.evaluate(() => {
  for (const s of ['#hud', '#tracker', '#objective', '#action-cluster', '#stick-zone', '.top-left', '.top-right', '#chat-mini', '.toast', '#coach', '.fs-btn', '#prompt', '#offers']) document.querySelectorAll(s).forEach((e) => (e.style.visibility = 'hidden'));
  const t = document.createElement('div');
  t.innerHTML = `<div style="font:900 86px/1 system-ui,sans-serif;letter-spacing:1px">Hobile</div><div style="font:700 30px/1.3 system-ui,sans-serif;margin-top:10px">לוכדים, מאמנים, רוכבים ועפים — עולם של יצורים בדפדפן</div>`;
  Object.assign(t.style, { position: 'fixed', insetInlineStart: '56px', bottom: '48px', color: '#fff', direction: 'rtl', textShadow: '0 4px 18px rgba(0,0,0,.55), 0 1px 2px rgba(0,0,0,.6)', zIndex: 99999, pointerEvents: 'none' });
  document.body.appendChild(t);
});
await wait(600);
await page.screenshot({ path: 'src/client/og.jpg', type: 'jpeg', quality: 82 });
console.log('src/client/og.jpg', fs.statSync('src/client/og.jpg').size, 'bytes', `console errors: ${errors.length}`);
await browser.close();
server.close();
