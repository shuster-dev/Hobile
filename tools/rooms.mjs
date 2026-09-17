/**
 * Contact sheet of every building interior.
 *
 *   node tools/rooms.mjs [out.png] [cols]
 *   ROOMS="shop,clinic" node tools/rooms.mjs shots/two.png 2
 *
 * Builds each room out of `buildInterior` directly, so it needs no build, no
 * server and no walking to a door — and it is the only way to judge whether a
 * room reads as a shop rather than a shed with a counter in it.
 */
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots/rooms.png';
const cols = Number(process.argv[3] || 2);
const rooms = process.env.ROOMS ? process.env.ROOMS.split(',').map((s) => s.trim()) : null;
const PORT = 2637;
const CELL_W = 560, CELL_H = 420;

const bundle = await esbuild.build({
  entryPoints: ['tools/rooms/preview.js'],
  bundle: true, format: 'iife', write: false, target: ['es2020'],
});
const js = bundle.outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0b0d11;display:grid;
grid-template-columns:repeat(${cols},${CELL_W}px)">
<script>window.ROOMS=${JSON.stringify(rooms)};window.CELL_W=${CELL_W};window.CELL_H=${CELL_H}</script>
<script>${js}</script>`;

const server = http.createServer((req, res) => {
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
const page = await browser.newPage({ viewport: { width: CELL_W * cols, height: CELL_H * 5 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => document.title === 'rooms-ready', null, { timeout: 60000 })
  .catch(() => console.error('  (preview did not finish)'));
await page.waitForTimeout(400);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: true });
console.log(`sheet: ${out}`);
if (errors.length) console.log('errors:', errors.slice(0, 4));
await browser.close();
server.close();
process.exit(errors.length ? 1 : 0);
