// Does resizing leak? The smoke test's draw-call count climbed every time it
// gained a viewport change, which is how the old arena leak looked too.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const server = http.createServer((q,r)=>{const f=path.join('dist',decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':'text/html; charset=utf-8'});r.end(fs.readFileSync(f))});
await new Promise(r=>server.listen(2619,r));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:430,height:880}, deviceScaleFactor:2 });
await p.goto('http://127.0.0.1:2619/solo.html', { waitUntil:'load' });
await p.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await p.click('#pick-starter .starter'); await p.fill('#in-charname','QA'); await p.click('#btn-create');
await p.waitForFunction(() => window.__hobile?.mode === 'world', null, { timeout: 30000 });
await p.waitForTimeout(2500);
const read = () => p.evaluate(() => {
  const g = window.__hobile, r = g.world.renderer;
  return { calls: r.info.render.calls, tris: r.info.render.triangles,
    geo: r.info.memory.geometries, tex: r.info.memory.textures,
    kids: g.world.scene.children.length };
});
console.log('start      ', JSON.stringify(await read()));
for (let i = 0; i < 4; i++) {
  await p.setViewportSize({ width: 880, height: 400 }); await p.waitForTimeout(700);
  await p.setViewportSize({ width: 430, height: 880 }); await p.waitForTimeout(700);
  console.log(`after ${i + 1} flips`, JSON.stringify(await read()));
}
await b.close(); server.close();
