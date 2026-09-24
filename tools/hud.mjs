/**
 * How much of the screen is not the game.
 *
 *   node tools/hud.mjs [out.png]
 *
 * "Too crowded" is an opinion until it is a number. This measures the union of
 * every visible HUD rectangle as a share of the viewport, names the worst
 * offenders, and says how much of the minimap survives whatever is on top of
 * it. Needs a solo build.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots/hud.png';
const PORT = 2647;
const W = Number(process.env.HUD_W || 430), H = Number(process.env.HUD_H || 880);

const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript'
    : ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
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

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.click('#btn-play', { timeout: 30000 });   // the title screen, as a player taps it
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'מאיר');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.zone && window.__hobile.mode !== 'boot', null, { timeout: 30000 });
await page.evaluate(() => window.__hobile.world.holdTimeOfDay(0.34));
await page.waitForTimeout(2600);
// HUD_PANEL=map photographs a panel over the world instead of the bare HUD.
if (process.env.HUD_PANEL) {
  await page.evaluate((id) => window.__hobile.ui.openPanel(id), process.env.HUD_PANEL);
  await page.waitForTimeout(900);
}

const report = await page.evaluate(() => {
  const vw = innerWidth, vh = innerHeight;
  // Every element that paints over the canvas, measured where it actually is.
  const shown = [];
  for (const el of document.querySelectorAll('#hud *, #overlay *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue;
    // Only count a container when it is the thing being painted; a wrapper with
    // no background of its own is measured through its children.
    const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
      || (cs.borderTopWidth !== '0px' && cs.borderTopColor !== 'rgba(0, 0, 0, 0)')
      || (el.children.length === 0 && el.textContent.trim());
    if (!paints) continue;
    shown.push({
      id: el.id || '', cls: (el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase(),
      x: Math.max(0, r.left), y: Math.max(0, r.top),
      w: Math.min(vw, r.right) - Math.max(0, r.left), h: Math.min(vh, r.bottom) - Math.max(0, r.top),
    });
  }
  // Union by stamping a coarse grid — overlapping panels must not be counted twice.
  const CELL = 4, gx = Math.ceil(vw / CELL), gy = Math.ceil(vh / CELL);
  const grid = new Uint8Array(gx * gy);
  const stamp = (b) => {
    for (let i = Math.floor(b.x / CELL); i < Math.ceil((b.x + b.w) / CELL); i++)
      for (let j = Math.floor(b.y / CELL); j < Math.ceil((b.y + b.h) / CELL); j++)
        if (i >= 0 && j >= 0 && i < gx && j < gy) grid[j * gx + i] = 1;
  };
  shown.forEach(stamp);
  let covered = 0;
  for (let i = 0; i < grid.length; i++) covered += grid[i];

  // The minimap: how much of it is under something else?
  const mm = document.querySelector('#minimap')?.getBoundingClientRect();
  let mmHidden = 0, mmArea = 0;
  if (mm) {
    const own = new Set();
    for (let i = Math.floor(mm.left / CELL); i < Math.ceil(mm.right / CELL); i++)
      for (let j = Math.floor(mm.top / CELL); j < Math.ceil(mm.bottom / CELL); j++) own.add(j * gx + i);
    mmArea = own.size;
    const g2 = new Uint8Array(gx * gy);
    for (const b of shown) {
      if (b.id === 'minimap') continue;
      for (let i = Math.floor(b.x / CELL); i < Math.ceil((b.x + b.w) / CELL); i++)
        for (let j = Math.floor(b.y / CELL); j < Math.ceil((b.y + b.h) / CELL); j++)
          if (i >= 0 && j >= 0 && i < gx && j < gy) g2[j * gx + i] = 1;
    }
    for (const k of own) if (g2[k]) mmHidden++;
  }
  return {
    vw, vh,
    coverage: covered / grid.length,
    minimap: mm ? { w: Math.round(mm.width), h: Math.round(mm.height), hidden: mmArea ? mmHidden / mmArea : 0 } : null,
    biggest: shown.map((b) => ({ ...b, area: Math.round(b.w * b.h) }))
      .sort((a, b) => b.area - a.area).slice(0, 10)
      .map((b) => `${b.id || '.' + b.cls} ${Math.round(b.w)}x${Math.round(b.h)} = ${(b.area / (vw * vh) * 100).toFixed(1)}%`),
    count: shown.length,
  };
});

console.log(`viewport ${report.vw}x${report.vh}`);
console.log(`HUD covers ${(report.coverage * 100).toFixed(1)}% of the screen across ${report.count} painted elements`);
if (report.minimap) console.log(`minimap ${report.minimap.w}x${report.minimap.h}, ${(report.minimap.hidden * 100).toFixed(0)}% of it under something else`);
console.log('biggest:');
for (const b of report.biggest) console.log('  ' + b);
console.log(`console errors: ${errors.length}`, errors.slice(0, 3));
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(`shot: ${out}`);
await browser.close();
server.close();
