/**
 * Contact sheet of the structures the planned zones build (zonebuild.js),
 * each alone on a patch of ground.
 *
 *   node tools/structure-sheet.mjs [out.png] [query]
 *
 * `query`: only=barn,windmill  cols=6  night=1
 */
import { chromium } from 'playwright';
import * as esbuild from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots/structures.png';
const query = process.argv[3] || '';
const PORT = Number(process.env.PORT || 2619);

const bundle = await esbuild.build({
  entryPoints: ['tools/structure-preview.js'],
  bundle: true, format: 'iife', write: false, target: ['es2020'],
});
const html = `<!doctype html><meta charset="utf-8"><body style="margin:0">
<script>${bundle.outputFiles[0].text}</script>`;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(PORT, r));

const CHROME = ['/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1800, height: 1200 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/?${query}`, { waitUntil: 'load' });
await page.waitForFunction('window.SHEET_READY === true', { timeout: 300000 }).catch(() => {});
if (!(await page.evaluate(() => !!document.querySelector('canvas')))) { console.error(errors.join('\n')); process.exit(1); }
const data = await page.evaluate(() => document.querySelectorAll('canvas')[0].toDataURL('image/png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));

console.log(out, errors.length ? `errors: ${errors.slice(0, 3).join(' | ')}` : '');
await browser.close();
server.close();
