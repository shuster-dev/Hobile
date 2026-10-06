/**
 * A tour of the planned zones: for each, a high look over it from the camp
 * and a few views from the ground at what is built there. The way to judge a
 * zone's layout and its buildings in the game's own renderer.
 *
 *   npm run build:solo && node tools/zone-tour.mjs [outDir] [zone,zone]
 *   TIER=medium   draw as a mid phone does (grade, shadows)
 *   CAM=dist,height   the ground views' camera
 *   HOUR=0.42     time of day (0.9 is night)
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] || 'shots/tour';
const only = process.argv[3] ? process.argv[3].split(',') : null;
const PORT = 2661;
const W = 430, H = 880;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const [camD, camH] = (process.env.CAM || '14,10').split(',').map(Number);
const HOUR = Number(process.env.HOUR || 0.42);

const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
fs.mkdirSync(outDir, { recursive: true });

await page.goto(`http://127.0.0.1:${PORT}/solo.html${process.env.TIER ? '?tier=' + process.env.TIER : ''}`, { waitUntil: 'load' });
await page.click('#btn-play', { timeout: 30000 });
await page.waitForSelector('#btn-next', { timeout: 25000 }); await page.click('#btn-next');
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter'); await page.fill('#in-charname', 'סייר'); await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.mode === 'world' && window.__hobile.profile, null, { timeout: 30000 });
await page.evaluate(() => { const d = window.__hobile.net.doc; d.level = 40; d.calmUntil = Date.now() + 3600e3; });

const zones = await page.evaluate(() => Object.keys(window.__hobileZones || {}));
const ids = only || ['verdant_meadow', 'emberfall_canyon', 'stonewake_mesa', 'stormreach_heights', 'tidal_hollow', 'frostpeak_ridge', 'umbral_grove'];
for (const id of ids) {
  await page.evaluate((z) => window.__hobile.net.send('travel', { zone: z }), id);
  await page.waitForFunction((z) => window.__hobile?.world?.zone?.id === z && window.__hobile.mode === 'world', id, { timeout: 40000 }).catch(() => {});
  await wait(2500);
  const views = await page.evaluate((hour) => {
    const w = window.__hobile.world, P = w.plan;
    w.holdWeather('clear', 'summer'); w.holdTimeOfDay(hour);
    const camp = w.zone.landmarks.find((l) => l.kind === 'camp');
    const seen = new Set(), out = [{ name: 'over', x: camp.x, z: camp.z, aerial: true }];
    for (const s of P?.structures || []) {
      if (seen.has(s.kind) || s.kind === 'volcano' || s.kind === 'rails' || s.kind === 'lanterns') continue;
      seen.add(s.kind);
      out.push({ name: s.kind, x: s.x, z: s.z, r: s.len ? s.len / 2 + 4 : 10 });
    }
    return out.slice(0, 7);
  }, HOUR);
  for (const v of views) {
    await page.evaluate(({ v, camD, camH }) => {
      const g = window.__hobile, w = g.world, P = w.plan;
      // stand back from it on open ground, looking at it
      let sx = v.x, sz = v.z, yaw = 0;
      if (!v.aerial) {
        for (let k = 0; k < 16; k++) {
          const a = k / 16 * Math.PI * 2, d = (v.r || 10) + 2;
          const x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d;
          if (P.walkable(x, z) && Math.hypot(x, z) < P.half - 8) { sx = x; sz = z; break; }
        }
        yaw = Math.atan2(v.x - sx, v.z - sz);
      } else yaw = Math.atan2(-v.x, -v.z);
      // the single-player build's world is right here: put the trainer down
      const me = g.net.room?.self?.();
      if (me) { me.x = sx; me.z = sz; }
      g.net.send('move', { x: sx, z: sz, rot: yaw + Math.PI, moving: false });
      w.snapSelf(sx, sz);
      w.camYaw = yaw;
      w._tourSaved ||= { d: w.camDist, h: w.camHeight, upd: w.updateCamera };
      w.camDist = camD; w.camHeight = camH;
      // the high look: the camera put where it is wanted, every frame
      w.updateCamera = v.aerial ? function () {
        const c = this.camera, p = this.selfPosition();
        c.position.set(p.x - Math.sin(yaw) * 62, p.y + 58, p.z - Math.cos(yaw) * 62);
        c.lookAt(p.x + Math.sin(yaw) * 40, p.y, p.z + Math.cos(yaw) * 40);
        if (this.scene.fog) { this.scene.fog.near = 160; this.scene.fog.far = 520; }
      } : w._tourSaved.upd;
      if (!v.aerial && w.scene.fog && w._tourFog) { w.scene.fog.near = w._tourFog[0]; w.scene.fog.far = w._tourFog[1]; }
      w._tourFog ||= w.scene.fog && [w.scene.fog.near, w.scene.fog.far];
    }, { v, camD, camH });
    await wait(v.aerial ? 2600 : 1800);
    const f = path.join(outDir, `${id}-${v.name}.png`);
    await page.screenshot({ path: f });
    console.log(' ', f);
  }
  await page.evaluate(() => { const w = window.__hobile.world, k = w._tourSaved; if (k) { w.camDist = k.d; w.camHeight = k.h; w.updateCamera = k.upd; } });
}
const stats = await page.evaluate(() => { const r = window.__hobile.world.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
console.log(`errors: ${errors.length}`, errors.slice(0, 4), stats);
await browser.close();
server.close();
