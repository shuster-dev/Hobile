import fs from 'node:fs';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default;

const code = fs.readFileSync('recovered/bundle.pretty.js', 'utf8');
const ast = parse(code, { sourceType: 'script', errorRecovery: true });
let topScope = null;
traverse(ast, { Function(p) { if (!topScope) { topScope = p.scope; p.stop(); } } });

const map = {};
const evidence = {};
for (const [name, binding] of Object.entries(topScope.bindings)) {
  const n = binding.path.node;
  const init = n.init || n;
  if (init.type !== 'ClassExpression' && init.type !== 'ClassDeclaration') continue;
  const body = code.slice(init.start, init.end);
  // three marks instances: this.isVector3 = !0  /  this.type = "SphereGeometry"
  const flags = [...body.matchAll(/this\.is([A-Z][\w]*)\s*=\s*!0/g)].map(m => m[1]);
  const types = [...body.matchAll(/this\.type\s*=\s*"([A-Z][\w]*)"/g)].map(m => m[1]);
  let real = null, why = '';
  // prefer a type string that matches a flag, else the most specific flag
  const cand = types.filter(t => flags.includes(t));
  if (cand.length) { real = cand[cand.length - 1]; why = 'type+flag'; }
  else if (types.length) { real = types[0]; why = 'type'; }
  else if (flags.length) { real = flags[flags.length - 1]; why = 'flag'; }
  if (real) { map[name] = real; evidence[name] = why; }
}
// de-duplicate: if two mangled names claim one real name, keep the one with more references
const byReal = {};
for (const [m, r] of Object.entries(map)) {
  const refs = topScope.bindings[m].references;
  if (!byReal[r] || refs > byReal[r].refs) byReal[r] = { m, refs };
}
const clean = {};
for (const [r, v] of Object.entries(byReal)) clean[v.m] = r;
fs.writeFileSync('recovered/three-map.json', JSON.stringify(clean, null, 1));
console.log(`mapped ${Object.keys(clean).length} three.js classes`);
const inv = Object.entries(clean).sort((a, b) => a[1].localeCompare(b[1]));
console.log(inv.map(([m, r]) => `${m}->${r}`).join('  '));
