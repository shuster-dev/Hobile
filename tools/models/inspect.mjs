/**
 * Boot the real game and report what the running instance exposes, so a
 * screenshot tool can drive it instead of guessing at the DOM.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 2617;
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
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await page.click('#pick-starter .starter');
await page.fill('#in-charname', 'QA');
await page.click('#btn-create');
await page.waitForFunction(() => window.__hobile?.zone && window.__hobile.mode !== 'boot', null, { timeout: 30000 });
await page.waitForTimeout(2000);

console.log(JSON.stringify(await page.evaluate(() => {
  const g = window.__hobile;
  const own = (o) => (o ? Object.getOwnPropertyNames(Object.getPrototypeOf(o)).concat(Object.keys(o)) : []);
  return {
    game: own(g).slice(0, 80),
    world: own(g.world).slice(0, 90),
    net: own(g.net).slice(0, 30),
    me: g.world?.me ? Object.keys(g.world.me) : null,
    profileTeam: g.profile?.team?.map?.((t) => t.species || t.sp) || null,
  };
}), null, 1));

await browser.close();
server.close();
