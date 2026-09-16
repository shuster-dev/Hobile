import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';

const solo = process.argv.includes('--solo');
const dev = process.argv.includes('--dev');
const outDir = 'dist/web';
fs.mkdirSync(outDir, { recursive: true });

const entry = solo ? 'src/client/solo.js' : 'src/client/main.js';
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
if (solo) {
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
  console.log(`${outDir}/  index.html + main.js  (js ${(js.length / 1024).toFixed(0)} KB)`);
}
