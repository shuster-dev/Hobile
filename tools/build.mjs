import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const solo = process.argv.includes('--solo');
const artifact = process.argv.includes('--artifact');
const dev = process.argv.includes('--dev');
const outDir = 'dist/web';
fs.mkdirSync(outDir, { recursive: true });

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
  const out = `<style>\n${styles}\n</style>\n${body}\n<script>${safe}</script>\n`;
  fs.writeFileSync('dist/artifact.html', out);
  console.log(`dist/artifact.html  ${(out.length / 1024).toFixed(0)} KB`);
} else if (solo) {
  // one self-contained file: inline the bundle
  // NB: replacement must be a function - a string replacement would expand $& / $1
  // inside the minified bundle (it is full of `$&&` and `$1`), corrupting the output.
  const inline = '<script>' + js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--') + '</script>';
  const html = shell.replace(/<script type="module" src="\.\/main\.js"><\/script>/, () => inline);
  fs.writeFileSync('dist/solo.html', html);
  console.log(`dist/solo.html  ${(html.length / 1024).toFixed(0)} KB  (js ${(js.length / 1024).toFixed(0)} KB)`);
} else {
  fs.writeFileSync(path.join(outDir, 'main.js'), js);
  fs.writeFileSync(path.join(outDir, 'index.html'), shell);
  // The app shell: without these on the served origin there is no Add to Home
  // Screen, and on iPhone that is the only route to a chrome-free screen.
  for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) {
    fs.copyFileSync(path.join('src/client', f), path.join(outDir, f));
  }
  console.log(`${outDir}/  index.html + main.js  (js ${(js.length / 1024).toFixed(0)} KB)`);
}
