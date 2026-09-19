import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

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
  if (!fs.existsSync(src)) return 0;
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
const result = await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  target: ['es2020', 'safari15'],
  minify: !dev,
  sourcemap: dev ? 'inline' : false,
  write: false,
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': dev ? '"development"' : '"production"' },
});
const js = result.outputFiles[0].text;

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
  fs.writeFileSync(path.join(outDir, 'main.js'), js);
  // `Ib()` in ui.js reads `?server=` first and this second, so a baked default
  // can still be overridden by a query string when testing against staging.
  const page = serverArg
    ? shell.replace('<script type="module" src="./main.js"></script>',
      () => `<script>window.HOBILE_SERVER=${JSON.stringify(serverArg)}</script>\n<script type="module" src="./main.js"></script>`)
    : shell;
  fs.writeFileSync(path.join(outDir, 'index.html'), page);
  // The app shell: without these on the served origin there is no Add to Home
  // Screen, and on iPhone that is the only route to a chrome-free screen.
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) {
    fs.copyFileSync(path.join('src/client', f), path.join(outDir, f));
  }
  const m = copyModels(outDir);
  console.log(`${outDir}/  index.html + main.js  (js ${(js.length / 1024).toFixed(0)} KB)  + ${m.count} models (${m.kb} KB)${serverArg ? `  server=${serverArg}` : ''}`);
}
