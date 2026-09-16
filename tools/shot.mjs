// One screenshot of one page. The QA suite proves behaviour; this proves
// appearance — creature work is the part no assertion can check, so there has
// to be a cheap way to render and look.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 2611;   // not 2599/2573: never collide with a QA run
const file = process.argv[2] || 'solo.html';
const out = process.argv[3] || 'shots/shot.png';
const waitMs = Number(process.argv[4] || 3000);
const W = Number(process.env.SHOT_W || 430);
const H = Number(process.env.SHOT_H || 880);
const FULL = process.env.SHOT_FULL === '1';

const server = http.createServer((req, res) => {
  const f = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  const type = f.endsWith('.js') ? 'text/javascript'
    : f.endsWith('.glb') ? 'model/gltf-binary'
      : f.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8';
  res.writeHead(200, { 'content-type': type });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${PORT}/${file}`, { waitUntil: 'load' });
await page.waitForTimeout(waitMs);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: FULL });
console.log(`shot: ${out}`);
await browser.close();
server.close();
