import fs from 'node:fs';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default;
const code = fs.readFileSync('recovered/bundle.pretty.js', 'utf8');
const ast = parse(code, { sourceType: 'script', errorRecovery: true });
let topScope = null;
traverse(ast, { Function(p) { if (!topScope) { topScope = p.scope; p.stop(); } } });

const cands = {};
for (const [name, binding] of Object.entries(topScope.bindings)) {
  const n = binding.path.node;
  const init = n.init || n;
  if (!/Class|Function/.test(init.type)) continue;
  const body = code.slice(init.start, init.end);
  const flags = [...body.matchAll(/(?:this\.)?is([A-Z][\w]*)\s*=\s*!0/g)].map(m => m[1]);
  const types = [...body.matchAll(/(?:this\.)?type\s*=\s*"([A-Z][\w]*)"/g)].map(m => m[1]);
  const all = [...types.filter(t => flags.includes(t)), ...types, ...flags];
  if (all.length) cands[name] = { real: all[0], refs: binding.references };
}
// prototype-style tags outside class bodies:  X.prototype.isVector3 = !0
for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\.prototype\.is([A-Z][\w]*)\s*=\s*!0/g)) {
  if (!cands[m[1]]) cands[m[1]] = { real: m[2], refs: topScope.bindings[m[1]]?.references || 0 };
}
const byReal = {};
for (const [m, v] of Object.entries(cands)) if (!byReal[v.real] || v.refs > byReal[v.real].refs) byReal[v.real] = { m, refs: v.refs };
const clean = {};
for (const [r, v] of Object.entries(byReal)) clean[v.m] = r;
fs.writeFileSync('recovered/three-map.json', JSON.stringify(clean, null, 1));
console.log(`mapped ${Object.keys(clean).length}`);
const need = ['Vector3','Vector2','Matrix4','Float32BufferAttribute','LineSegments','Line','LatheGeometry','TubeGeometry','ExtrudeGeometry','Shape','Curve','AmbientLight','Raycaster','Clock','Frustum','MeshLambertMaterial','LineBasicMaterial','Spherical','Box3Helper','TetrahedronGeometry','ConeGeometry','TorusKnotGeometry'];
console.log('present:', need.filter(n=>Object.values(clean).includes(n)).join(' '));
console.log('MISSING:', need.filter(n=>!Object.values(clean).includes(n)).join(' '));
