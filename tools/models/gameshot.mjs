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
const hideUi = (on) => page.evaluate((v) => {
  for (const el of document.querySelectorAll('#hud, #overlay, .hud, #tracker, #chat, #stick, #actions')) {
    el.style.visibility = v ? 'hidden' : '';
  }
}, on);

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'מאיר');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.zone && window.__hobile.mode !== 'boot', null, { timeout: 30000 });
await page.evaluate(() => window.__hobile.world.holdTimeOfDay(0.34));
// Models arrive over the network, so the creature on screen at second one is
// still the procedural one. Wait for the swap before judging anything.
await page.waitForFunction(() => !!window.__hobile?.world?.selfActor?.()?.pet?.group?.userData?.model,
  null, { timeout: 30000 }).catch(() => console.log('  (pet model did not attach)'));

// --- walk out to a wild creature before photographing anything: the spawn
// point is under the street trees, and the inside of a canopy tells nobody
// anything about how the game looks.
const walk = await page.evaluate(async () => {
  const g = window.__hobile;
  const said = [];
  g.net.on('error', (e) => said.push(e?.code || JSON.stringify(e)));
  const wilds = [...(g.worldState()?.wilds || [])]
    .map((e) => (Array.isArray(e) ? e : [e.id, e]));
  if (!wilds.length) return { note: 'no wilds' };
  // Prefer a creature standing in the open. The camera swings in behind the
  // player and a wild spawned against a wall gives a photograph of the wall.
  const openness = ([, w]) => {
    let best = 99;
    for (const b of g.world.blockers) {
      const d = Math.hypot(b.x - w.x, b.z - w.z) - (b.hw !== undefined ? Math.max(b.hw, b.hd) : b.r || 0);
      if (d < best) best = d;
    }
    return best;
  };
  wilds.sort((a, b) => openness(b) - openness(a));
  const [id, wild] = wilds[0];
  // The server clamps movement to three metres a packet, so arriving next to
  // the creature means walking there. selfPosition() hands back the live
  // vector, so the start has to be copied out of it.
  // Wild creatures wander, so this walks towards where the creature is *now*
  // on every step rather than towards where it was when we started, and stops
  // a few metres short so it ends up in frame rather than in the lens.
  const start = Math.hypot(wild.x - g.world.selfPosition().x, wild.z - g.world.selfPosition().z);
  for (let i = 0; i < 80; i += 1) {
    const me = g.world.selfPosition();
    const dx = wild.x - me.x;
    const dz = wild.z - me.z;
    const d = Math.hypot(dx, dz);
    if (d <= 5) break;
    const step = Math.min(2.4, d - 4.5);
    const x = me.x + (dx / d) * step;
    const z = me.z + (dz / d) * step;
    g.world.snapSelf(x, z);
    g.net.send('move', { x, z, rot: Math.atan2(dx, dz), moving: true });
    await new Promise((r) => setTimeout(r, 40));
  }
  // Face the creature, and leave the camera behind the player's shoulder.
  const me = g.world.selfPosition();
  g.world.camYaw = Math.atan2(wild.x - me.x, wild.z - me.z);
  return { id, species: wild.species, walked: start.toFixed(0), refused: said.join(',') };
});
console.log(`  walked ${walk.walked}m to a wild ${walk.species}${walk.refused ? ` (refused: ${walk.refused})` : ''}`);

await page.evaluate(() => {
  const w = window.__hobile.world;
  w.camDist = 9.5;
  w.camHeight = 3.6;
  w.camPitch = 0.34;
});
await page.waitForTimeout(1600);
console.log('  canopies hidden for the camera:', await page.evaluate(
  () => (window.__hobile.world.canopies || []).map((c) => `${c.hidden.size}/${c.items.length}`).join(' ') || 'none',
));
await shot('world');
await hideUi(true);
await page.waitForTimeout(400);
await shot('world-clean');
await hideUi(false);

// --- and then the battle
// Wild creatures wander, so the one we photographed may not be the one we
// fight. Chase whichever is nearest until something agrees to a battle.
console.log('  engage:', await page.evaluate(async () => {
  const g = window.__hobile;
  const said = [];
  g.net.on('error', (e) => said.push(e?.code));
  for (let i = 0; i < 60 && g.mode !== 'battle'; i += 1) {
    const me = g.world.selfPosition();
    const near = g.nearestWild(me);
    if (!near) return 'no wild creature in the zone';
    if (near.d > 5.5) {
      const w = near.w;
      const x = me.x + ((w.x - me.x) / near.d) * Math.min(2.4, near.d - 4);
      const z = me.z + ((w.z - me.z) / near.d) * Math.min(2.4, near.d - 4);
      g.world.snapSelf(x, z);
      g.net.send('move', { x, z, rot: Math.atan2(w.x - me.x, w.z - me.z), moving: true });
      await new Promise((r) => setTimeout(r, 60));
    } else {
      g.net.send('engage', { wildId: near.id });
      await new Promise((r) => setTimeout(r, 450));
    }
  }
  return g.mode === 'battle' ? 'started' : `gave up${said.length ? `: ${[...new Set(said)].join(',')}` : ''}`;
}));
await page.waitForFunction(() => window.__hobile?.mode === 'battle', null, { timeout: 25000 })
  .catch(() => console.log('  (battle did not start)'));
await page.waitForTimeout(4500);
await shot('battle');
await hideUi(true);
await page.waitForTimeout(400);
await shot('battle-clean');

console.log(`console errors: ${errors.length}`);
for (const e of [...new Set(errors)].slice(0, 6)) console.log('   ', e.slice(0, 200));
await browser.close();
server.close();
