/**
 * Play the first loop and see what breaks.
 *
 *   npm run build:solo && node tools/play.mjs
 *
 * Static checks find data that points at nothing. They cannot find a button
 * that sends a message the server refuses, or a reward that never lands. This
 * drives the real client through walk → encounter → fight → capture → reward →
 * door → shop, and says at which step it stopped.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 2653;
let pass = 0, fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? ' :: ' + detail : ''}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const e = path.extname(f);
  res.writeHead(200, { 'content-type': e === '.js' ? 'text/javascript'
    : e === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 430, height: 880 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.click('#btn-play', { timeout: 30000 });   // the title screen, as a player taps it
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'מאיר');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.mode === 'world' && window.__hobile.profile, null, { timeout: 30000 });
await page.evaluate(() => window.__hobile.world.holdTimeOfDay(0.34));
await wait(2200);

// --- the errors the server sends back are the loudest signal there is -----
await page.evaluate(() => {
  window.__refused = [];
  window.__hobile.net.on('error', (e) => window.__refused.push(e?.code || String(e)));
});

const state = () => page.evaluate(() => {
  const g = window.__hobile;
  return { mode: g.mode, level: g.profile?.level, gold: g.profile?.gold,
    team: g.profile?.team?.length, xp: g.profile?.xp,
    inv: { ...(g.profile?.inventory || {}) }, refused: [...window.__refused] };
});
const before = await state();
ok('the world loads with a starter in the team', before.team >= 1, JSON.stringify(before));

// --- walk to a wild and engage -------------------------------------------
// Wilds wander on the server's own clock, so the one you set off toward can be
// somewhere else by the time you arrive, or already engaged. Re-target and try
// again rather than calling a moving creature a failure.
const approach = () => page.evaluate(async () => {
  const g = window.__hobile, w = g.world;
  if (g.mode !== 'world') return { err: 'not in the world', mode: g.mode };
  const st = g.worldState();
  const all = [...(st?.wilds?.values?.() || [])];
  const wilds = all.filter((x) => !x.engagedBy);
  if (!wilds.length) return { err: 'no free wild', total: all.length, engaged: all.filter((x) => x.engagedBy).length,
    mode: g.mode, zone: g.world?.zone?.id, hasState: !!st, room: g.net?.room?.constructor?.name || null };
  const me = w.selfPosition();
  const t = wilds.sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
  for (let i = 0; i < 150; i++) {
    const p = w.selfPosition();
    const live = g.worldState()?.wilds?.get?.(t.id) || t;
    const dx = live.x - p.x, dz = live.z - p.z, d = Math.hypot(dx, dz);
    if (d < 1.2) break;
    const step = Math.min(2.5, d);
    const nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
    g.net.send('move', { x: nx, z: nz, rot: Math.atan2(dx, dz), moving: true });
    w.snapSelf(nx, nz);
    await new Promise((r) => setTimeout(r, 32));
  }
  // Measure from the authority, not the view. `engage` is refused on the
  // server's idea of where the player is, and the client is only reconciled
  // toward it — so a client that thinks it has arrived can still be told it is
  // too far. Close the last gap against the server's own number.
  const meId = g.net?.room?.sessionId || 'me';
  const srv = () => g.worldState()?.players?.get?.(meId) || w.selfPosition();
  for (let i = 0; i < 40; i++) {
    const sp = srv(), live = g.worldState()?.wilds?.get?.(t.id) || t;
    const dx = live.x - sp.x, dz = live.z - sp.z, d = Math.hypot(dx, dz);
    if (d < 3) break;
    const step = Math.min(2.5, d);
    const nx = sp.x + (dx / d) * step, nz = sp.z + (dz / d) * step;
    g.net.send('move', { x: nx, z: nz, rot: Math.atan2(dx, dz), moving: true });
    w.snapSelf(nx, nz);
    await new Promise((r) => setTimeout(r, 40));
  }
  const sp = srv(), live = g.worldState()?.wilds?.get?.(t.id) || t;
  return { dist: +Math.hypot(live.x - sp.x, live.z - sp.z).toFixed(1), id: t.id, species: t.species };
});

let hunt = null, entered = false;
for (let attempt = 0; attempt < 3 && !entered; attempt++) {
  hunt = await approach();
  // Already fighting means an earlier attempt landed and the handoff simply
  // took longer than the wait — that is a slow room, not a failed encounter.
  if (hunt.mode === 'battle') { entered = true; break; }
  if (hunt.err) { await wait(1500); continue; }
  await page.evaluate(() => { window.__hobile.engagePending = 0; window.__hobile.doAction('action'); });
  entered = await page.waitForFunction(() => window.__hobile?.mode === 'battle', null, { timeout: 15000 })
    .then(() => true).catch(() => false);
}
ok('a wild creature is reachable on foot', !hunt?.err && hunt?.dist < 3, JSON.stringify(hunt));
ok('walking into it starts a fight', entered, JSON.stringify((await state()).refused));

if (entered) {
  await wait(1800);
  const bt = await page.evaluate(() => {
    const b = window.__hobile.battle;
    return { you: b.youId, team: b.team?.length, trainer: b.trainerId, weather: b.weather?.id || null,
      combatants: b.combatants?.length };
  });
  ok('the battle knows the whole team, not just the active creature', bt.team >= 1 && !!bt.you, JSON.stringify(bt));
  ok('both sides are on the field', bt.combatants >= 2, String(bt.combatants));

  // The home dock says `capturable: false`, so a sphere thrown here must be
  // refused and must cost nothing. Do it first, while the creature is fresh.
  const caught = await page.evaluate(async () => {
    const g = window.__hobile;
    const rejects = [];
    g.net.on('actionRejected', (e) => rejects.push(e?.reason));
    const capturable = g.world.zone.capturable !== false;
    const had = g.profile.inventory.sphere_basic || 0;
    for (let i = 0; i < 3 && g.mode === 'battle'; i++) {
      g.net.send('trainer', { action: 'sphere', sphere: 'sphere_basic' });
      await new Promise((r) => setTimeout(r, 700));
    }
    return { capturable, rejects, spent: had - (g.profile.inventory.sphere_basic || 0) };
  });
  if (caught.capturable) ok('throwing a sphere is allowed here', !caught.rejects.includes('no_capture_here'), JSON.stringify(caught));
  else {
    ok('a sphere is refused where the zone says it must be',
      caught.rejects.includes('no_capture_here'), JSON.stringify(caught));
    ok('and refusing it costs no spheres', caught.spent === 0, String(caught.spent));
  }

  // Then win it the ordinary way.
  const fight = await page.evaluate(async () => {
    const g = window.__hobile;
    const foe = () => g.battle.combatants.find((c) => c.side !== g.battle.mySide && !c.benched);
    const mine = () => g.battle.combatants.find((c) => c.id === g.battle.youId);
    const start = foe()?.hp;
    for (let i = 0; i < 120 && g.mode === 'battle'; i++) {
      const f = foe(), m = mine();
      if (!f || !m) break;
      const skills = (m.skills || []).filter(Boolean);
      if (skills.length) g.hooks().useSkill(skills[i % skills.length]);
      await new Promise((r) => setTimeout(r, 360));
    }
    return { start, left: foe()?.hp, mode: g.mode };
  });
  // The fight can also end because the creature fled or your own fainted; what
  // must not happen is the loop running out with both sides untouched.
  ok('attacking resolves the fight', fight.mode !== 'battle' || fight.left < fight.start, JSON.stringify(fight));

  await page.waitForFunction(() => window.__hobile?.mode === 'world', null, { timeout: 30000 }).catch(() => {});
  const after = await state();
  ok('the fight ends and the world comes back', after.mode === 'world', JSON.stringify({ fight, after: after.mode }));
  ok('something was earned — xp, gold or a creature',
    after.xp > before.xp || after.gold !== before.gold || after.team > before.team,
    JSON.stringify({ before: { xp: before.xp, gold: before.gold, team: before.team },
      after: { xp: after.xp, gold: after.gold, team: after.team } }));
}

// --- a door, and the shop behind it --------------------------------------
const indoors = await page.evaluate(async () => {
  const g = window.__hobile, w = g.world;
  const door = (w.zone.landmarks || []).find((l) => l.kind === 'shop' && l.door);
  if (!door) return { err: 'no shop door in this zone' };
  const out = Math.hypot(door.door.x - door.x, door.door.z - door.z) || 1;
  const goals = [
    { x: door.door.x + (door.door.x - door.x) / out * 6, z: door.door.z + (door.door.z - door.z) / out * 6 },
    { x: door.door.x, z: door.door.z },
  ];
  for (const goal of goals) {
    for (let i = 0; i < 90; i++) {
      const p = w.selfPosition();
      const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz);
      if (d < 1) break;
      const step = Math.min(2.5, d);
      const nx = p.x + (dx / d) * step, nz = p.z + (dz / d) * step;
      g.net.send('move', { x: nx, z: nz, rot: Math.atan2(dx, dz), moving: true });
      w.snapSelf(nx, nz);
      await new Promise((r) => setTimeout(r, 30));
    }
  }
  g.net.send('enterBuilding', { id: door.interior || door.kind });
  await new Promise((r) => setTimeout(r, 1500));
  return { inside: !!w._inside, kind: w._inside?.def?.kind || null, refused: [...window.__refused] };
});
ok('a shop door opens', indoors.inside === true, JSON.stringify(indoors));

const shop = await page.evaluate(async () => {
  const g = window.__hobile;
  g.ui.openPanel('shop');
  await new Promise((r) => setTimeout(r, 700));
  const rows = document.querySelectorAll('#panel .list-item').length;
  const buy = [...document.querySelectorAll('#panel button')].find((b) => /קנה|רכוש/.test(b.textContent));
  const goldBefore = g.profile.gold;
  buy?.click();
  await new Promise((r) => setTimeout(r, 900));
  return { rows, clicked: !!buy, goldBefore, goldAfter: g.profile.gold, refused: [...window.__refused] };
});
ok('the shop has stock', shop.rows > 0, JSON.stringify(shop));
// Separate assertions on purpose: `!clicked || bought` passes when the button
// is missing, which is the failure it was meant to catch.
ok('the shop has something to press', shop.clicked === true, JSON.stringify(shop));
ok('buying takes the gold', shop.goldAfter < shop.goldBefore,
  JSON.stringify({ before: shop.goldBefore, after: shop.goldAfter, refused: shop.refused }));

const refused = (await state()).refused;
console.log(`\nserver refusals during the run: ${refused.length ? refused.join(', ') : 'none'}`);
console.log(`console errors: ${errors.length}`, errors.slice(0, 4));
ok('no console errors during the loop', errors.length === 0);

fs.mkdirSync('shots', { recursive: true });
await page.screenshot({ path: 'shots/play.png' });
await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
