// Geometry audit: find creatures whose bounding box is dominated by a stray
// part. A part sitting far from the body is invisible at normal camera
// distance but silently wrecks framing, outlines and culling.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 2614;
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
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${PORT}/audit.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__auditReady, null, { timeout: 90000 });
const rows = await page.evaluate(() => window.__audit);
await browser.close(); server.close();

rows.sort((a, b) => b.outlierRatio - a.outlierRatio);
console.log('species          bbox(w,h,d)          body(w,h,d)          outlier  worst part');
for (const r of rows) {
  const flag = r.outlierRatio > 1.6 ? ' <<<' : '';
  console.log(
    r.id.padEnd(16),
    `${r.box.map((v) => v.toFixed(1)).join(',')}`.padEnd(20),
    `${r.body.map((v) => v.toFixed(1)).join(',')}`.padEnd(20),
    r.outlierRatio.toFixed(2).padStart(6),
    ' ', r.worst + flag);
}
const bad = rows.filter((r) => r.outlierRatio > 1.6);
console.log(`\n${bad.length} of ${rows.length} creatures have a part well outside the body: ${bad.map((r) => r.id).join(', ') || 'none'}`);
fs.writeFileSync('shots/creature-audit.json', JSON.stringify(rows, null, 1));
