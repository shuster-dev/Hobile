/**
 * The camera never shows you a roof instead of yourself.
 *
 *   npm run build:solo && node tools/camera-test.mjs
 *
 * You arrive in a field zone somewhere in the ring around its camp, often with
 * a house a step behind you, and the camera has to find a view of you from
 * there. Its idea of a house is a box it tests a sightline against; the house
 * it draws is walls and a roof with eaves. Twice now the two have disagreed —
 * a collider circle inside the eaves, then a sightline that started under
 * them — and each time the result was the same picture: a close-up of roof
 * tiles, and no player. So this stands at 96 places around each camp, lets
 * the camera settle the way it does on arrival, and traces the real triangles
 * of the real houses between the lens and the player.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 2655;
const ZONES = ['verdant_meadow', 'tidal_hollow', 'stonewake_mesa'];
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};

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
const browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}),
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 430, height: 880 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.waitForSelector('#btn-play:not([disabled])', { timeout: 30000 });
await page.click('#btn-play');
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'Lens');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.mode === 'world' && window.__hobile.profile, null, { timeout: 30000 });

for (const zone of ZONES) {
  // Field zones are gated by level; the offline save is plain data.
  await page.evaluate((z) => {
    const g = window.__hobile;
    if (g.net.doc) g.net.doc.level = 40;
    g.net.send('travel', { zone: z });
  }, zone);
  const arrived = await page.waitForFunction((z) => window.__hobile?.world?.zone?.id === z
    && window.__hobile.mode === 'world', zone, { timeout: 30000 }).then(() => true).catch(() => false);
  ok(`${zone}: arrived`, arrived);
  if (!arrived) continue;
  await new Promise((r) => setTimeout(r, 1500));

  const r = await page.evaluate(() => {
    const w = window.__hobile.world;
    const keep = w.reconcile;
    w.reconcile = () => {};   // the server's position would drag us back to spawn
    const mesh = w.zoneGroup.children.find((m) => m.userData?.houses);
    if (!mesh) return { err: 'no houses in this zone' };
    const pos = mesh.geometry.attributes.position.array;
    // Nearest triangle along the ray (Moller-Trumbore), or Infinity.
    const hit = (o, d, far) => {
      let best = Infinity;
      for (let i = 0; i < pos.length; i += 9) {
        const ax = pos[i], ay = pos[i + 1], az = pos[i + 2];
        const e1x = pos[i + 3] - ax, e1y = pos[i + 4] - ay, e1z = pos[i + 5] - az;
        const e2x = pos[i + 6] - ax, e2y = pos[i + 7] - ay, e2z = pos[i + 8] - az;
        const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-9) continue;
        const inv = 1 / det, tx = o.x - ax, ty = o.y - ay, tz = o.z - az;
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-3 && t < far && t < best) best = t;
      }
      return best;
    };
    const camp = w.zone.landmarks.find((l) => l.kind === 'camp' || l.kind === 'town');
    let tests = 0;
    const hidden = [];
    for (let a = 0; a < 24; a++) {
      for (const rr of [1.9, 2.8, 3.7, 4.6]) {
        // Where the server's spawnPoint could put you: the camp ring, pushed
        // out of every collider by the same 0.72 it resolves with.
        const ang = a / 24 * Math.PI * 2;
        let x = camp.x + Math.cos(ang) * rr, z = camp.z + Math.sin(ang) * rr;
        for (let it = 0; it < 4; it++) for (const c of w.colliders) {
          if (c.r === undefined) continue;
          const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + 0.72;
          if (d < m && d > 1e-6) { x = c.x + dx / d * m; z = c.z + dz / d * m; }
        }
        // Arrive the way a spawn does: faceOpen from some server-given angle,
        // then let the camera settle.
        w.snapSelf(x, z);
        w._camRise = 0; w._camReach = undefined;
        w.faceOpen((a * 7 % 12) / 12 * Math.PI * 2);
        const p = w.selfPosition();
        w.camera.position.set(p.x - Math.sin(w.camYaw) * 9, p.y + 8, p.z - Math.cos(w.camYaw) * 9);
        for (let k = 0; k < 90; k++) w.updateCamera(1 / 60);
        const c = w.camera.position;
        // Feet, middle and head: hidden means two of the three are behind a house.
        let blocked = 0;
        for (const hgt of [0.5, 1.0, 1.4]) {
          const dx = p.x - c.x, dy = p.y + hgt - c.y, dz = p.z - c.z, len = Math.hypot(dx, dy, dz);
          if (hit(c, { x: dx / len, y: dy / len, z: dz / len }, len - 0.05) < Infinity) blocked++;
        }
        tests++;
        if (blocked >= 2) hidden.push({ x: +x.toFixed(1), z: +z.toFixed(1), yaw: +w.camYaw.toFixed(2) });
      }
    }
    w.reconcile = keep;
    return { tests, hidden };
  });
  if (r.err) { ok(`${zone}: ${r.err}`, false); continue; }
  ok(`${zone}: the player is in view from all ${r.tests} places round the camp`,
    r.hidden.length === 0, `${r.hidden.length} hidden, e.g. ${JSON.stringify(r.hidden.slice(0, 3))}`);
}

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
