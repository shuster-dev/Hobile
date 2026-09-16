import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const server = http.createServer((req,res)=>{const f=path.join('dist',decodeURIComponent(req.url.split('?')[0]));if(!fs.existsSync(f)){res.writeHead(404);return res.end()}res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(fs.readFileSync(f))});
await new Promise(r=>server.listen(2617,r));
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p = await b.newPage({ viewport:{width:430,height:880}, deviceScaleFactor:2 });
await p.goto('http://127.0.0.1:2617/solo.html', { waitUntil:'load' });
await p.waitForSelector('#pick-starter .starter', { timeout: 25000 });
await p.click('#pick-starter .starter'); await p.fill('#in-charname','מאיר'); await p.click('#btn-create');
await p.waitForFunction(() => window.__hobile?.mode === 'world', null, { timeout: 30000 });
await p.waitForTimeout(2000);
// unlock a few so the panel is not almost entirely dim in the screenshot
await p.evaluate(() => {
  const g = window.__hobile;
  const d = g.net.doc;
  for (const id of ['mossnail','sparkit','pebblin','umbrat','puddlet']) {
    d.dex[id] = { caught: id === 'mossnail' ? 3 : 1, first: Date.now(), best: 1 };
  }
  g.ui.openPanel('dex');
});
await p.waitForTimeout(1200);
fs.mkdirSync('shots',{recursive:true});
await p.screenshot({ path: 'shots/dex.png' });
console.log('shot: shots/dex.png');
await b.close(); server.close();
