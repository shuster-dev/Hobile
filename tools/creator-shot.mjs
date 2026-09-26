/**
 * The character creator, photographed: the first step for a few kinds, and the
 * second with a partner — the way to see a change to that screen.
 *
 *   npm run build:solo && node tools/creator-shot.mjs [outDir] [kind,kind…]
 */
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const outDir = process.argv[2] || 'shots/creator';
const kinds = (process.argv[3] || 'catcher,mage').split(',');
const PORT = 2654, W = Number(process.env.W || 430), H = Number(process.env.H || 880);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const ext = path.extname(f);
  res.writeHead(200, { 'content-type': ext === '.js' ? 'text/javascript' : ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));
const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
fs.mkdirSync(outDir, { recursive: true });
await page.goto(`http://127.0.0.1:${PORT}/solo.html`, { waitUntil: 'load' });
await page.click('#btn-play', { timeout: 30000 });
await page.waitForSelector('#btn-next', { timeout: 25000 });
await page.waitForFunction(() => document.querySelectorAll('#pick-kind .cc-kind img').length >= 7, null, { timeout: 40000 }).catch(() => {});
for (const k of kinds) {
  await page.click(`#pick-kind .cc-kind[data-kind="${k}"]`);
  await wait(Number(process.env.HOLD || 4200));
  await page.screenshot({ path: path.join(outDir, `1-${k}.png`) });
  console.log(`  ${outDir}/1-${k}.png`);
}
await page.click('#btn-next');
await page.waitForSelector('#pick-starter .portrait', { timeout: 12000 }).catch(() => {});
await wait(2400);
await page.screenshot({ path: path.join(outDir, '2-partner.png') });
console.log(`  ${outDir}/2-partner.png`, errors.length ? errors.slice(0, 3) : '');
await browser.close();
server.close();
