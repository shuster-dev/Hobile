/**
 * Walk the real player into a solid thing and see whether it stops them.
 *
 *   node tools/bump.mjs              # the smallest rock in the meadow
 *   node tools/bump.mjs bench        # a bench on the home dock
 *   node tools/bump.mjs fence shots/fence.png
 *
 * An assertion can prove a collider exists. Only this can show that the player
 * stops at the surface the artist drew rather than a ring somewhere inside it,
 * and it prints the closest approach so the answer is a number, not a look.
 *
 * Needs a solo build: `node tools/build.mjs --solo`.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const kind = process.argv[2] || 'rock';
const out = process.argv[3] || `shots/bump-${kind}.png`;
const PORT = 2631;

// Rocks live outdoors, street furniture lives on the home dock.
const ZONE = kind === 'rock' ? 'verdant_meadow' : 'aetherport';
const PORT_OK = (f) => fs.existsSync(f) && !fs.statSync(f).isDirectory();

const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!PORT_OK(f)) { res.writeHead(404); return res.end(); }
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

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'מאיר');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.zone && window.__hobile.mode !== 'boot', null, { timeout: 30000 });

if (ZONE !== 'aetherport') {
  await page.evaluate((z) => window.__hobile.net.send('travel', { zone: z }), ZONE);
  await page.waitForFunction((z) => window.__hobile?.world?.zone?.id === z, ZONE, { timeout: 30000 });
}
await page.evaluate(() => window.__hobile.world.holdTimeOfDay(0.34));
await page.waitForTimeout(2500);

const report = await page.evaluate(async ({ kind }) => {
  const g = window.__hobile, w = g.world;
  const here = w.selfPosition();
  const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // A rock's radius is its own scale; a street prop's is half its longer side.
  const target = kind === 'rock'
    ? [...w.props.rocks].filter((r) => r.s <= 0.86).sort((a, b) => near(a, here) - near(b, here))[0]
    : [...w.props.props].filter((p) => p.kind === kind).sort((a, b) => near(a, here) - near(b, here))[0];
  if (!target) return { error: `no ${kind} in ${w.zone.id}` };
  const col = w.colliders
    .map((c) => ({ c, d: near(c, target) }))
    .filter(({ d }) => d < 0.4)
    .sort((a, b) => a.d - b.d)[0]?.c;
  const surface = kind === 'rock' ? target.s : col ? (col.r ?? Math.min(col.hw, col.hd)) : 0;

  const goal = { x: target.x, z: target.z + 3.4 };
  for (let i = 0; i < 80; i++) {                 // the server clamps a move packet
    const p = w.selfPosition();
    const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.3) break;
    const step = Math.min(2.5, d);
    const nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
    g.net.send('move', { x: nx, z: nz, rot: Math.atan2(dx, dz), moving: true });
    w.snapSelf(nx, nz);
    await new Promise((r) => setTimeout(r, 30));
  }
  w.camYaw = Math.PI;                            // look north, at the thing
  await new Promise((r) => setTimeout(r, 600));

  let closest = Infinity;
  for (let i = 0; i < 140; i++) {                // push north, hard
    const m = w.moveSelf(0, -3.2, 1 / 60);
    g.net.send('move', { x: m.x, z: m.z, rot: m.rot, moving: true });
    closest = Math.min(closest, near(m, target));
    await new Promise((r) => requestAnimationFrame(r));
  }
  // Back off, so the photograph is taken in front of the thing rather than
  // from wherever the push happened to end.
  for (let i = 0; i < 70 && near(w.selfPosition(), target) < surface + 1.6; i++) {
    const m = w.moveSelf(0, 3.2, 1 / 60);
    g.net.send('move', { x: m.x, z: m.z, rot: m.rot, moving: false });
    await new Promise((r) => requestAnimationFrame(r));
  }
  await new Promise((r) => setTimeout(r, 500));
  return {
    kind, zone: w.zone.id,
    surface: +surface.toFixed(2),
    closestApproach: +closest.toFixed(2),
    playerEdge: +(closest - 0.42).toFixed(2),   // 0.42 is the player's own radius
  };
}, { kind });

console.log(JSON.stringify(report, null, 2));
if (!report.error) {
  console.log(report.playerEdge >= report.surface - 0.06
    ? `  -> stopped at the ${kind}`
    : `  -> WALKED INTO THE ${kind.toUpperCase()}`);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
console.log(`shot: ${out}`);
console.log(`console errors: ${errors.length}`, errors.slice(0, 3));
await browser.close();
server.close();
process.exit(report.error || report.playerEdge < report.surface - 0.06 ? 1 : 0);
