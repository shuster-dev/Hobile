/**
 * Render a folder of .glb files to one PNG contact sheet.
 *
 *   node tools/models/sheet.mjs <glbDir> <out.png> [cols]
 */
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2] || 'assets/models';
const out = process.argv[3] || 'shots/models.png';
const cols = Number(process.argv[4] || 6);
const PORT = 2614;

const files = fs.readdirSync(dir).filter((f) => f.endsWith('.glb')).sort();
if (!files.length) { console.error(`no .glb in ${dir}`); process.exit(1); }

const bundle = await esbuild.build({
  entryPoints: ['tools/models/preview.js'],
  bundle: true, format: 'iife', write: false, target: ['es2020'],
});
const js = bundle.outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#e9edf2">
<script>window.FILES=${JSON.stringify(files)}</script><script>${js}</script>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(html);
  }
  if (url.startsWith('/glb/')) {
    const f = path.join(dir, url.slice(5));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': 'model/gltf-binary' });
    return res.end(fs.readFileSync(f));
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('  [page]', m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?cols=${cols}`, { waitUntil: 'load' });
await page.waitForFunction('window.SHEET_READY === true', { timeout: 180000 });

const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
console.log(`${out}  ${files.length} models`);
await browser.close();
server.close();
