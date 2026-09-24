import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const server = http.createServer((req,res)=>{let f=path.join('dist',decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(fs.readFileSync(f))});
await new Promise(r=>server.listen(2613,r));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport: { width: 430, height: 880 }, deviceScaleFactor: 2 });
p.on('pageerror',e=>console.log('PAGEERROR',e.message));
await p.goto('http://127.0.0.1:2613/solo.html');
await p.click('#btn-play', { timeout: 30000 });   // the title screen, as a player taps it

for (let i = 0; i < 9; i++) {
  await p.waitForTimeout(2000);
  console.log(i*2+'s', JSON.stringify(await p.evaluate(() => ({
  screens: [...document.querySelectorAll('.screen')].map(e => e.id + ' => ' + e.className),
  overlayClass: document.querySelector('#overlay')?.className,
  loadingHidden: document.querySelector('#loading')?.className,
  starterBtns: document.querySelectorAll('#pick-starter .starter').length,
  firstStarterBox: (() => { const b = document.querySelector('#pick-starter .starter'); if (!b) return null; const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top }; })(),
}))));
}
await b.close(); server.close();
