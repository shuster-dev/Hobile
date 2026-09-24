/**
 * Every sky and every season, photographed from the same spot.
 *
 *   node tools/sky.mjs [out.png]
 *   SKY_ZONE=frostpeak_ridge SKY_PHASE=0.2 node tools/sky.mjs shots/frost.png
 *
 * `holdWeather` pins the spell the way `holdTimeOfDay` pins the clock, so the
 * eleven frames below differ by exactly one thing each. Needs a solo build.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots/weather.png';
const ZONE = process.env.SKY_ZONE || 'verdant_meadow';
const PHASE = Number(process.env.SKY_PHASE || 0.34);
const PORT = 2641;
const W = 430, H = 560;

const SKIES = ['clear', 'cloud', 'rain', 'storm', 'snow', 'fog', 'ash'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

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
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
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
if (ZONE !== 'aetherport') {
  await page.evaluate((z) => window.__hobile.net.send('travel', { zone: z }), ZONE);
  await page.waitForFunction((z) => window.__hobile?.world?.zone?.id === z, ZONE, { timeout: 30000 });
}
await page.evaluate((p) => window.__hobile.world.holdTimeOfDay(p), PHASE);
// Travel keeps the player's coordinates, which drops them wherever the last
// zone's gate happened to be — here, inside the meadow camp, where the camera
// is pulled to its minimum by the tents and photographs a canvas awning. Walk
// out to open ground first.
await page.evaluate(async () => {
  const g = window.__hobile, w = g.world;
  const clear = (x, z) => !w.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < (c.r ?? Math.hypot(c.hw, c.hd)) + 6)
    && !(w.zone.landmarks || []).some((l) => Math.hypot(l.x - x, l.z - z) < (l.r || 3) + 10);
  let goal = null;
  for (let r = 18; r < w.zone.size / 2 - 12 && !goal; r += 6) {
    for (let i = 0; i < 24 && !goal; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (clear(x, z)) goal = { x, z };
    }
  }
  if (!goal) return;
  for (let i = 0; i < 60; i++) {
    const p = w.selfPosition();
    const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
    if (d < 1) break;
    const step = Math.min(2.5, d);
    const nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
    g.net.send('move', { x: nx, z: nz, rot: Math.atan2(dx, dz), moving: true });
    w.snapSelf(nx, nz);
    await new Promise((r) => setTimeout(r, 34));
  }
  // Flatter than the game's own framing, because the subject is the sky and a
  // third-person camera spends most of its frame on the ground.
  w.camHeight = 3.4;
  w.camDist = 19;
  w.camYaw = Math.atan2(-goal.x, -goal.z) + Math.PI;
});
// The HUD covers a third of the frame and none of it is weather.
await page.evaluate(() => {
  for (const sel of ['.top-left', '.top-right', '#tracker', '#chat-mini', '#action-cluster', '#objective', '#stick-base', '#stick-knob', '.hud-toggle', '#boss-banner']) {
    for (const el of document.querySelectorAll(sel)) el.style.visibility = 'hidden';
  }
});
await page.waitForTimeout(2500);

const dir = path.dirname(out);
fs.mkdirSync(dir, { recursive: true });
const tiles = [];
const shoot = async (weather, season, label) => {
  await page.evaluate(([w, s]) => window.__hobile.world.holdWeather(w, s), [weather, season]);
  await page.waitForTimeout(1400);   // let the fields fill and the fog settle
  const f = path.join(dir, `_sky-${label}.png`);
  await page.screenshot({ path: f });
  tiles.push({ file: f, label });
  // The cloud deck only shows when the camera looks up, which a third-person
  // camera never does, so the numbers go beside the picture.
  const n = await page.evaluate(() => {
    const w = window.__hobile.world;
    return {
      clouds: +w.sky.material.uniforms.uClouds.value.toFixed(2),
      sun: +w.lights.sun.intensity.toFixed(2),
      fogFar: Math.round(w.scene.fog.far),
      calls: w.renderer.info.render.calls,
      tris: w.renderer.info.render.triangles,
    };
  });
  console.log(`  ${label.padEnd(7)} clouds=${n.clouds} sun=${n.sun} fogFar=${n.fogFar} calls=${n.calls} tris=${(n.tris / 1000).toFixed(0)}k`);
};
for (const w of SKIES) await shoot(w, 'summer', w);
for (const s of SEASONS) await shoot('clear', s, s);

console.log(`console errors: ${errors.length}`, errors.slice(0, 3));
await browser.close();
server.close();

// Montage with whatever is at hand. A grid is the only way to see that two
// skies differ by more than a name.
const py = `
from PIL import Image, ImageDraw
tiles = ${JSON.stringify(tiles)}
cols = 4
ims = [Image.open(t["file"]) for t in tiles]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows), (11, 13, 17))
d = ImageDraw.Draw(sheet)
for i, (im, t) in enumerate(zip(ims, tiles)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    d.text((x + 10, y + 8), t["label"], fill=(255, 255, 255))
sheet.save(${JSON.stringify(out)})
print("sheet:", ${JSON.stringify(out)})
`;
const { execFileSync } = await import('node:child_process');
execFileSync('python3', ['-c', py], { stdio: 'inherit' });
for (const t of tiles) fs.unlinkSync(t.file);
