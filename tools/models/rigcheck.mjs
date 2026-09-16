/**
 * Run the rig check in a real browser and report what the resolver found.
 *
 *   node tools/models/rigcheck.mjs [out.png]
 */
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots/rigcheck.png';
const PORT = 2615;
const MODELS_DIR = 'assets/models';

const bundle = await esbuild.build({
  entryPoints: ['tools/models/rigcheck.js'],
  bundle: true, format: 'iife', write: false, target: ['es2020'],
});
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#e9edf2">
<script>${bundle.outputFiles[0].text}</script>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url.startsWith('/models/')) {
    const f = path.join(MODELS_DIR, url.slice(8));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'model/gltf-binary' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const noise = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') noise.push(m.text()); });
page.on('pageerror', (e) => noise.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:${PORT}/${process.env.RIG_QUERY || ''}`, { waitUntil: 'load' });
await page.waitForFunction('window.__rigReady === true', { timeout: 240000 });

const rows = await page.evaluate(() => window.__rig);
const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await browser.close();
server.close();

console.log('species       file               mode   bones spine head tail legs arms wing app   height');
let bad = 0;
for (const r of rows) {
  const still = r.mode === 'swim' && !r.spine;
  const flag = !r.ok ? ' <-- FAILED' : (!r.legs && !r.wings && !r.tails.length && r.spine < 2 ? ' <-- nothing to animate' : '');
  if (flag) bad += 1;
  console.log(
    r.id.padEnd(13), r.file.padEnd(18), String(r.mode).padEnd(6),
    String(r.bones).padStart(5), String(r.spine).padStart(5), String(r.head).padStart(4),
    String(r.tails).padStart(4), String(r.legs).padStart(4), String(r.arms).padStart(4),
    String(r.wings).padStart(4), String(r.appendages).padStart(4),
    r.height.toFixed(2).padStart(8), flag,
  );
}
for (const n of [...new Set(noise)].slice(0, 12)) console.log('  [page]', n);
console.log(`\n${rows.length} species, ${rows.filter((r) => r.ok).length} with a model, ${bad} needing attention`);
console.log(`sheet: ${out}`);
