import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import zlib from 'node:zlib';

/**
 * The page's first script: download the game with a bar that moves (the
 * bytes counted as they arrive, against the sizes the build wrote down), then
 * start it — from the browser's cache, since every file is fetched first.
 * Anything it cannot do (an old browser, a failed fetch) just starts the game.
 */
const LOADER = `(function(){var B=window.HOBILE_BUNDLE,w=document.getElementById('boot-bar-wrap'),bar=document.getElementById('boot-bar'),msg=document.getElementById('loading-msg');
var total=0,got=0;B.files.forEach(function(f){total+=f[1]});
function show(){var k=Math.min(1,got/Math.max(1,total));bar&&(bar.style.width=(k*100).toFixed(1)+'%');msg&&(msg.textContent='מוריד את המשחק… '+Math.round(k*100)+'%')}
function go(){if(go.done)return;go.done=1;msg&&(msg.textContent='טוען את העולם…');var s=document.createElement('script');s.type='module';s.src='./'+B.main;document.head.appendChild(s)}
if(!window.fetch||!window.ReadableStream||!window.Promise){go();return}
w&&w.classList.remove('hidden');show();
Promise.all(B.files.map(function(f){return fetch('./'+f[0]).then(function(r){if(!r.ok)throw 0;if(!r.body)return r.arrayBuffer().then(function(){got+=f[1];show()});var rd=r.body.getReader();return(function pump(){return rd.read().then(function(x){if(x.done)return;got+=x.value.length;show();return pump()})})()})})).then(go,go);setTimeout(go,30000)})();`;

const solo = process.argv.includes('--solo');
const artifact = process.argv.includes('--artifact');
const dev = process.argv.includes('--dev');
// Where the client should look for the server. Only needed when the two are on
// different origins — the server serves `dist/web` itself, so a same-origin
// deploy leaves this empty and the client uses `location.host`. A static host
// like Pages needs it: `--server=https://hobile.up.railway.app`.
const serverArg = (process.argv.find((a) => a.startsWith('--server=')) || '').slice(9).replace(/\/+$/, '');
const outDir = 'dist/web';
fs.mkdirSync(outDir, { recursive: true });

/**
 * Creature models travel beside the page, never inside it.
 *
 * Four megabytes of glTF inlined as base64 would be four megabytes the player
 * downloads before the loading screen can even appear, for creatures they may
 * never meet. As separate files next to the page they are same-origin — which
 * is what a static host and an artifact both require — fetched only when a
 * species first appears, and cached by the browser from then on.
 */
function copyModels(dir) {
  const src = 'assets/models';
  if (!fs.existsSync(src)) return { count: 0, kb: 0 };
  const dest = path.join(dir, 'models');
  fs.mkdirSync(dest, { recursive: true });
  const files = fs.readdirSync(src).filter((f) => f.endsWith('.glb'));
  let bytes = 0;
  for (const f of files) {
    fs.copyFileSync(path.join(src, f), path.join(dest, f));
    bytes += fs.statSync(path.join(src, f)).size;
  }
  return { count: files.length, kb: Math.round(bytes / 1024) };
}

const entry = (solo || artifact) ? 'src/client/solo.js' : 'src/client/main.js';
// The online build is split: what the first screen needs, and chunks loaded
// when they are wanted (the story's scenes, the music, the bell, the model
// loader). Names carry a hash of their content, so a browser may keep them
// forever and a new build is a new name. The single-file builds stay whole.
const web = !(solo || artifact);
const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: web ? 'esm' : 'iife',
  splitting: web,
  outdir: web ? outDir : undefined,
  entryNames: 'main.[hash]',
  chunkNames: 'chunk.[hash]',
  metafile: web,
  target: ['es2020', 'safari15'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
});
const js = web ? '' : result.outputFiles[0].text;

const shell = fs.readFileSync('src/client/index.html', 'utf8');
if (artifact) {
  // The Artifact host supplies the page skeleton, so this build ships only
  // what goes inside it: the styles, the markup, and one inline script.
  const styles = [...shell.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const bodyMatch = shell.match(/<body[^>]*>([\s\S]*)<\/body>/);
  const body = (bodyMatch ? bodyMatch[1] : shell)
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style>[\s\S]*?<\/style>/g, '');
  const safe = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  // The artifact host serves the page and nothing else — it has no notion of a
  // .glb — so this is the one build where the models ride inside the document.
  const dir = 'assets/models';
  const inline = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => n.endsWith('.glb')) : []) {
    inline[f] = `data:model/gltf-binary;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`;
  }
  const prelude = `<script>window.HOBILE_MODELS=${JSON.stringify(inline)}</script>\n`;
  const out = `<style>\n${styles}\n</style>\n${body}\n${prelude}<script>${safe}</script>\n`;
  fs.writeFileSync('dist/artifact.html', out);
  copyModels('dist');
  console.log(`dist/artifact.html  ${(out.length / 1048576).toFixed(1)} MB  (${Object.keys(inline).length} models inlined)`);
} else if (solo) {
  // one self-contained file: inline the bundle
  // NB: replacement must be a function - a string replacement would expand $& / $1
  // inside the minified bundle (it is full of `$&&` and `$1`), corrupting the output.
  const inline = '<script>' + js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--') + '</script>';
  const html = shell.replace(/<script type="module" src="\.\/main\.js"><\/script>/, () => inline);
  fs.writeFileSync('dist/solo.html', html);
  const m = copyModels('dist');
  console.log(`dist/solo.html  ${(html.length / 1024).toFixed(0)} KB  (js ${(js.length / 1024).toFixed(0)} KB)  + ${m.count} models (${m.kb} KB)`);
} else {
  // the last build's files go: a hashed name nobody links to is only clutter
  for (const f of fs.readdirSync(outDir)) if (/^(main|chunk)\.[A-Z0-9]+\.js(\.br|\.gz)?$/i.test(f) || f === 'main.js') fs.unlinkSync(path.join(outDir, f));
  const files = [];
  let mainFile = '', total = 0;
  for (const o of result.outputFiles) {
    const name = path.basename(o.path);
    fs.writeFileSync(path.join(outDir, name), o.contents);
    // compressed beside it, once, here — not on every request (server/index.js serves them)
    fs.writeFileSync(path.join(outDir, `${name}.br`), zlib.brotliCompressSync(o.contents, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }));
    fs.writeFileSync(path.join(outDir, `${name}.gz`), zlib.gzipSync(o.contents, { level: 9 }));
    files.push(name);
    total += o.contents.length;
    if (name.startsWith('main.')) mainFile = name;
  }
  // what the first screen loads: the entry and the chunks it imports outright
  const meta = result.metafile.outputs, key = Object.keys(meta).find((k) => path.basename(k) === mainFile);
  const first = [mainFile, ...(meta[key]?.imports || []).filter((i) => i.kind === 'import-statement').map((i) => path.basename(i.path))];
  const sizes = first.map((f) => [f, fs.statSync(path.join(outDir, f)).size]);
  const version = mainFile.replace(/^main\.|\.js$/g, '');
  fs.writeFileSync(path.join(outDir, 'version.json'), JSON.stringify({ version, at: new Date().toISOString() }));
  const boot = `<script>window.HOBILE_BUNDLE=${JSON.stringify({ version, main: mainFile, files: sizes })}</script>\n<script>${LOADER}</script>`;
  // `Ib()` in ui.js reads `?server=` first and this second, so a baked default
  // can still be overridden by a query string when testing against staging.
  const page = shell
    .replace('<script type="module" src="./main.js"></script>', () => (serverArg ? `<script>window.HOBILE_SERVER=${JSON.stringify(serverArg)}</script>\n` : '') + boot)
    .replace(/(<div class="msg" id="build-stamp"[^>]*>)[^<]*(<\/div>)/, (m, a, b) => `${a}${version}${b}`);
  fs.writeFileSync(path.join(outDir, 'index.html'), page);
  const brSize = first.reduce((a, f) => a + fs.statSync(path.join(outDir, `${f}.br`)).size, 0);
  console.log(`${outDir}/  ${files.length} files, first load ${(sizes.reduce((a, [, n]) => a + n, 0) / 1024).toFixed(0)} KB (brotli ${(brSize / 1024).toFixed(0)} KB) of ${(total / 1024).toFixed(0)} KB`);
  // The app shell: without these on the served origin there is no Add to Home
  // Screen, and on iPhone that is the only route to a chrome-free screen.
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) {
    fs.copyFileSync(path.join('src/client', f), path.join(outDir, f));
  }
  const m = copyModels(outDir);
  m.count && console.log(`  + ${m.count} models (${m.kb} KB)${serverArg ? `  server=${serverArg}` : ''}`);
}
