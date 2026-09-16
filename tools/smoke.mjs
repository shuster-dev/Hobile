import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 2612;
const root = 'dist';
const server = http.createServer((req, res) => {
  let f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  const ext = path.extname(f);
  res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript' : ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise(r => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 430, height: 880 }, deviceScaleFactor: 2 });
const errors = [], logs = [];
page.on('console', m => { logs.push(`${m.type()}: ${m.text()}`); if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message + ' :: ' + (e.stack||'').split('\n').slice(0,3).join(' | ')));
page.on('requestfailed', r => logs.push('reqfail: ' + r.url().slice(0, 120)));
page.on('response', r => { if (r.status() >= 400) logs.push('http ' + r.status() + ' ' + r.url().slice(0, 120)); });

const dump = async (why) => {
  console.log('\n--- ' + why + ' ---');
  console.log('console (last 25):'); logs.slice(-40).forEach(l => console.log('   ' + l.slice(0, 220)));
  try { fs.mkdirSync('shots', { recursive: true }); await page.screenshot({ path: 'shots/fail.png' }); console.log('shot: shots/fail.png'); } catch {}
  try { console.log('errors:', JSON.stringify(errors.slice(0, 6), null, 1)); } catch {}
  try { console.log('diag:', await page.evaluate(() => ({
    hasGame: typeof window.__hobile, mode: window.__hobile?.mode,
    overlay: document.querySelector('#overlay')?.className,
    loading: document.querySelector('#loading-msg')?.textContent,
    screens: [...document.querySelectorAll('[id^=screen], .screen')].map(e => e.id + ':' + e.className).slice(0, 8),
    starters: document.querySelectorAll('#pick-starter *').length,
  }))); } catch (e) { console.log('diag failed', String(e).slice(0,120)); }
};
const step = async (label, fn) => { try { await fn(); console.log('  ok  ' + label); } catch (e) { console.log('  FAIL ' + label + ' :: ' + String(e).split('\n')[0].slice(0, 130)); await dump('failure detail'); await browser.close(); server.close(); process.exit(1); } };

const PAGE = process.env.SMOKE_PAGE || 'solo.html';
await page.goto(`http://127.0.0.1:${PORT}/${PAGE}`, { waitUntil: 'load' });
await step('boot: character creation appears', () => page.waitForSelector('#pick-starter .starter', { timeout: 25000 }));
await step('pick a starter', async () => { await page.click('#pick-starter .starter'); });
await step('name the trainer', () => page.fill('#in-charname', 'QA'));
await step('start the journey', () => page.click('#btn-create'));
await step('world is live', () => page.waitForFunction(() => window.__hobile?.zone && window.__hobile.mode !== 'boot', null, { timeout: 30000 }));
await page.waitForTimeout(2500);

// The collection panel: open it the way a player does, through the menu.
await step('the collection panel opens', async () => {
  await page.evaluate(() => window.__hobile.ui.openPanel('dex'));
  await page.waitForFunction(() => document.querySelectorAll('.dex-tile').length > 0, null, { timeout: 8000 });
});
const dex = await page.evaluate(() => ({
  tiles: document.querySelectorAll('.dex-tile').length,
  locked: document.querySelectorAll('.dex-tile.locked').length,
  header: document.querySelector('#panel .section h4')?.textContent || '',
}));
console.log(`  dex: ${dex.tiles} tiles, ${dex.locked} locked — "${dex.header}"`);
if (dex.tiles - dex.locked !== 1) { console.log('  FAIL exactly the starter should be unlocked'); errors.push('dex unlock count'); }
await page.evaluate(() => window.__hobile.ui.closePanel());
await page.waitForTimeout(400);

// Phone behaviour: the browser must stop competing with the game for gestures.
const app = await page.evaluate(() => {
  const vp = document.querySelector('meta[name=viewport]')?.content || '';
  const cs = getComputedStyle(document.body);
  const canvas = getComputedStyle(document.querySelector('#world-canvas'));
  return {
    viewportLocked: vp.includes('user-scalable=no') && vp.includes('viewport-fit=cover'),
    appleCapable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
    manifest: !!document.querySelector('link[rel=manifest]'),
    overscroll: cs.overscrollBehavior || cs.overscrollBehaviorY,
    canvasTouch: canvas.touchAction,
    vh: document.documentElement.style.getPropertyValue('--vh'),
  };
});
const expectApp = [
  ['viewport is locked against zoom and covers the notch', app.viewportLocked],
  ['the page declares itself installable', app.appleCapable && app.manifest],
  ['pull-to-refresh / rubber-band is off', /none/.test(app.overscroll || '')],
  ['the world canvas takes its own touches', app.canvasTouch === 'none'],
  ['the measured viewport height is published', /px$/.test(app.vh || '')],
];
for (const [label, cond] of expectApp) {
  if (cond) { console.log('  ok  ' + label); } else { console.log('  FAIL ' + label); errors.push(label); }
}

// Landscape: the phone turned sideways must not be a letterbox of furniture.
await page.setViewportSize({ width: 880, height: 400 });
await page.waitForTimeout(700);
const land = await page.evaluate(() => {
  const hidden = (sel) => { const e = document.querySelector(sel); return !e || getComputedStyle(e).display === 'none'; };
  const stick = document.querySelector('#stick-zone').getBoundingClientRect();
  const act = document.querySelector('#action-cluster').getBoundingClientRect();
  return { tracker: hidden('#tracker'), chat: hidden('#chat-mini'),
    stickOnScreen: stick.bottom <= window.innerHeight + 1 && stick.left >= -1,
    actionOnScreen: act.bottom <= window.innerHeight + 1 && act.right <= window.innerWidth + 1 };
});
for (const [label, cond] of [
  ['landscape drops the quest panel and chat', land.tracker && land.chat],
  ['landscape keeps the stick on screen', land.stickOnScreen],
  ['landscape keeps the action cluster on screen', land.actionOnScreen],
]) { if (cond) { console.log('  ok  ' + label); } else { console.log('  FAIL ' + label); errors.push(label); } }
await page.screenshot({ path: 'shots/landscape.png' });
await page.setViewportSize({ width: 430, height: 880 });
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const g = window.__hobile;
  const r = g.world?.renderer?.info;
  return {
    mode: g.mode, zone: g.zone?.id, profile: g.profile?.name, level: g.profile?.level,
    team: (g.profile?.team || []).length,
    calls: r?.render?.calls, tris: r?.render?.triangles,
    players: g.world?.players ? Object.keys(g.world.players).length : null,
  };
});
console.log('\nstate:', JSON.stringify(info));
fs.mkdirSync('shots', { recursive: true });
await page.screenshot({ path: 'shots/world.png' });
console.log('shot: shots/world.png');
console.log(`console errors: ${errors.length}`);
errors.slice(0, 12).forEach(e => console.log('   ! ' + e.slice(0, 160)));
await browser.close(); server.close();
process.exit(errors.length ? 1 : 0);
