import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const server = http.createServer((q,r)=>{const f=path.join('dist',decodeURIComponent(q.url.split('?')[0]));if(!fs.existsSync(f)){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':'text/html; charset=utf-8'});r.end(fs.readFileSync(f))});
await new Promise(r=>server.listen(2623,r));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:500,height:800} });
await p.goto('http://127.0.0.1:2623/solo.html', { waitUntil:'load' });
await p.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await p.click('#pick-starter .starter'); await p.fill('#in-charname','QA'); await p.click('#btn-create');
await p.waitForFunction(() => window.__hobile?.mode === 'world', null, { timeout: 30000 });
await p.waitForTimeout(2500);
console.log(await p.evaluate(() => {
  const w = window.__hobile.world;
  const a = w.selfActor?.();
  if (!a) return { error: 'no selfActor', keys: Object.keys(w).slice(0, 30) };
  const h = a.holder;
  let minY = Infinity;
  h.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    o.updateWorldMatrix(true, false);
    const pos = o.geometry.attributes.position, m = o.matrixWorld.elements;
    for (let i = 0; i < pos.count; i += 5) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
      if (wy < minY) minY = wy;
    }
  });
  // What the player actually sees: raycast straight down onto the rendered
  // ground, and compare it with the height entities are placed at.
  let hitY = null, hitName = '';
  try {
    const THREE = w.renderer.constructor;   // not useful; use the scene's own classes
  } catch {}
  const rc = w.__rc || (w.__rc = new (Object.getPrototypeOf(w.scene).constructor === Object ? Object : Object)());
  return {
    holderY: +h.position.y.toFixed(3),
    groundHere: +w.heightAt(h.position.x, h.position.z).toFixed(3),
    lowestVertexY: +minY.toFixed(3),
    gap: +(minY - w.heightAt(h.position.x, h.position.z)).toFixed(3),
  };
}));
await b.close(); server.close();
