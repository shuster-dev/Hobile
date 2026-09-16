import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const server = http.createServer((q,r)=>{const f=path.join('dist',decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':'text/html; charset=utf-8'});r.end(fs.readFileSync(f))});
await new Promise(r=>server.listen(2621,r));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:1000,height:620}, deviceScaleFactor:2 });
await p.goto('http://127.0.0.1:2621/solo.html', { waitUntil:'load' });
await p.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await p.click('#pick-starter .starter'); await p.fill('#in-charname','QA'); await p.click('#btn-create');
await p.waitForFunction(() => window.__hobile?.mode === 'world', null, { timeout: 30000 });
await p.waitForTimeout(2500);
// look up at the sky, in daylight, and hide the HUD
// Out to the meadow, where there is a horizon to see, and a low camera.
await p.evaluate(() => window.__hobile.net.send('travel', { zone: 'verdant_meadow' }));
await p.waitForTimeout(4000);
await p.evaluate(() => {
  const g = window.__hobile;
  g.world.holdTimeOfDay(0.32);        // mid-morning
  g.world.camHeight = 6.8; g.world.camDist = 13.5;
  document.getElementById('hud').style.display = 'none';
  document.getElementById('overlay').style.display = 'none';
});
// The game's loop points the camera every frame, so tilt it back up after the
// loop has run — a later-registered rAF wins for that frame.
await p.evaluate(() => {
  const g = window.__hobile;
  g.world.holdTimeOfDay(0.32);        // mid-morning
  // Walk out of the village so there is sky and horizon rather than roofs.
  const s = g.world.selfPosition();
  g.net.send('move', { x: s.x, z: s.z - 3, rot: 0, moving: false });
  
});
await p.waitForTimeout(2500);
fs.mkdirSync('shots',{recursive:true});
await p.screenshot({ path: 'shots/sky.png' });
console.log('shot: shots/sky.png');
await b.close(); server.close();
