import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
import _generate from '@babel/generator';
const traverse = _traverse.default, generate = _generate.default;

const code = fs.readFileSync('recovered/bundle.pretty.js', 'utf8');
const threeAuto = JSON.parse(fs.readFileSync('recovered/three-map.json', 'utf8'));
const names = JSON.parse(fs.readFileSync('tools/names.json', 'utf8'));
const threeMap = { ...threeAuto, ...names.three };
// resolve alias chains: `var _t = ml` where ml is Matrix4 must map too
const resolveAliases = (scope) => {
  for (let pass = 0; pass < 5; pass++) {
    let grew = false;
    for (const [n, b] of Object.entries(scope.bindings)) {
      if (threeMap[n]) continue;
      const init = b.path.node.init;
      if (init && init.type === 'Identifier' && threeMap[init.name]) { threeMap[n] = threeMap[init.name]; grew = true; }
    }
    if (!grew) break;
  }
};
const gameMap = names.game;
const GAME_START = 22168;

const ast = parse(code, { sourceType: 'script', errorRecovery: true });
let topPath = null;
traverse(ast, { Function(p) { if (!topPath) { topPath = p; p.stop(); } } });
const topScope = topPath.scope;

resolveAliases(topScope);

// record original lines + kind BEFORE renaming
const meta = {};
for (const [n, b] of Object.entries(topScope.bindings)) {
  meta[n] = { line: b.path.node.loc.start.line, refs: b.references };
}

// rename by direct mutation of referencePaths (scope.rename is O(program) per call)
const used = new Set(Object.keys(topScope.bindings));
const newName = {};
const applyRename = (from, to, allowDup = false) => {
  const b = topScope.bindings[from];
  if (!b) return null;
  let final = to, i = 2;
  // vendor (three) aliases may share a name: the vendor bindings are dropped and
  // only the import name matters, so two aliases of Matrix4 both become Matrix4.
  if (!allowDup) { while (used.has(final) && final !== from) final = to + i++; }
  const touch = (node, parent) => {
    if (!node || node.type !== 'Identifier' || node.name !== from) return;
    if (parent && parent.type === 'ObjectProperty' && parent.shorthand && parent.key === node) {
      parent.shorthand = false;
      parent.key = { type: 'Identifier', name: from };
    }
    node.name = final;
  };
  const idNode = b.identifier;
  for (const rp of b.referencePaths) touch(rp.node, rp.parent);
  for (const cv of b.constantViolations) {
    if (cv.node.type === 'AssignmentExpression') touch(cv.node.left, cv.node);
    else if (cv.node.type === 'VariableDeclarator') touch(cv.node.id, cv.node);
    else if (cv.node.type === 'UpdateExpression') touch(cv.node.argument, cv.node);
  }
  touch(idNode, null);
  used.delete(from); used.add(final);
  topScope.bindings[final] = b;
  delete topScope.bindings[from];
  newName[from] = final;
  return final;
};
for (const [m, r] of Object.entries(threeMap)) applyRename(m, r, true);
for (const [m, r] of Object.entries(gameMap)) applyRename(m, r);
const lineOf = {}, refsOf = {};
for (const [m, v] of Object.entries(meta)) { const nn = newName[m] || m; lineOf[nn] = v.line; refsOf[nn] = v.refs; }
const threeNames = new Set(Object.entries(threeMap).map(([m, r]) => newName[m] || r));

// unescape \uXXXX in string literals so Hebrew is readable in the source
traverse(ast, {
  StringLiteral(p) { if (p.node.extra) delete p.node.extra; },
  TemplateElement(p) {
    const v = p.node.value;
    if (v && typeof v.cooked === 'string') v.raw = v.cooked.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  },
});

// module assignment
const MODULES = [
  ['shared/gamedata.js', 22322, 24624],
  ['client/gfx/core.js', 24625, 25159],
  ['client/gfx/parts.js', 25160, 26776],
  ['client/gfx/creatures.js', 26777, 28316],
  ['shared/props.js', 28317, 28755],
  ['client/gfx/world.js', 28756, 32648],
  ['client/audio.js', 32649, 33043],
  ['client/gfx/battle.js', 33044, 35022],
  ['client/input.js', 35023, 35169],
  ['client/ui.js', 35170, 36749],
  ['client/game.js', 36750, 38115],
  ['server/game/combat.js', 38116, 39003],
  ['server/game/base.js', 39004, 99999],
  ['client/net.js', 22168, 22321],
];
const OVERRIDES = {
  'shared/npcs.js': ['NPCS', 'npcAt', 'npcList', 'questDone', 'questActive', 'DIALOGUE', 'npcLines'],
  'shared/gamedata.js': ['hashString', 'seededRandom'],
  'client/gfx/core.js': ['QUALITY'],
  'server/game/combat.js': ['Combatant', 'num', 'ownerKey', 'combatantId', 'combatantSeq',
    'SWITCH_COOLDOWN_MS', 'RALLY_ATK_BONUS', 'RALLY_DURATION_MS'],
};
const ownerOf = {};
for (const [mod, list] of Object.entries(OVERRIDES)) for (const n of list) ownerOf[n] = mod;
const moduleFor = (name) => {
  if (ownerOf[name]) return ownerOf[name];
  const l = lineOf[name];
  for (const [mod, a, b] of MODULES) if (l >= a && l <= b) return mod;
  return null;
};

// collect top-level statements of the game region, grouped by module
const body = topPath.node.body.body;
const buckets = new Map(MODULES.map(m => [m[0], []]));
buckets.set('shared/npcs.js', []);
const tail = [];
const nodeOwnerNames = new Map();

for (const stmt of body) {
  if (stmt.loc.start.line < GAME_START) continue;
  // which bindings does this statement declare?
  const declared = [];
  if (stmt.type === 'VariableDeclaration') {
    for (const d of stmt.declarations) { if (d.id.type === 'Identifier') declared.push(d.id.name); }
  } else if (stmt.type === 'FunctionDeclaration' && stmt.id) {
    declared.push(stmt.id.name);
  } else if (stmt.type === 'ClassDeclaration' && stmt.id) {
    declared.push(stmt.id.name);
  }
  if (!declared.length) { tail.push(stmt); continue; }
  // split multi-declarator var statements so each lands in its own module
  const groups = new Map();
  if (stmt.type === 'VariableDeclaration' && stmt.declarations.length > 1) {
    for (const d of stmt.declarations) {
      const nm = d.id.type === 'Identifier' ? d.id.name : null;
      if (nm && refsOf[nm] === 0 && !/^[A-Z]/.test(nm)) continue; // drop dead bindings
      const mod = (nm && moduleFor(nm)) || moduleFor(declared[0]) || 'client/game.js';
      if (!groups.has(mod)) groups.set(mod, []);
      groups.get(mod).push(d);
      if (nm) nodeOwnerNames.set(nm, mod);
    }
    for (const [mod, decls] of groups) {
      if (!buckets.has(mod)) buckets.set(mod, []);
      buckets.get(mod).push({ ...stmt, declarations: decls });
    }
  } else {
    const mod = moduleFor(declared[0]) || 'client/game.js';
    if (!buckets.has(mod)) buckets.set(mod, []);
    buckets.get(mod).push(stmt);
    for (const nm of declared) nodeOwnerNames.set(nm, mod);
  }
}

// emit
const outRoot = 'src';
fs.rmSync(outRoot, { recursive: true, force: true });
const summary = [];
const unresolved = [];
for (const [mod, stmts] of buckets) {
  if (!stmts.length) continue;
  const chunk = stmts.map(s => generate(s, { comments: true, jsescOption: { minimal: true } }).code).join('\n\n');
  // find free identifiers used here that belong elsewhere
  const declaredHere = new Set();
  for (const [n, m] of nodeOwnerNames) if (m === mod) declaredHere.add(n);
  const needThree = new Set(), needLocal = new Map();
  // free identifiers via Babel scope, not regex (a string "profile" is not a reference)
  let freeIds = [];
  try {
    const sub = parse(chunk, { sourceType: 'module', errorRecovery: true });
    let progPath = null;
    traverse(sub, { Program(p) { progPath = p; p.stop(); } });
    freeIds = Object.keys(progPath.scope.globals || {});
  } catch { freeIds = []; }
  for (const id of new Set(freeIds)) {
    if (declaredHere.has(id)) continue;
    if (threeNames.has(id)) { needThree.add(id); continue; }
    const owner = nodeOwnerNames.get(id);
    if (owner && owner !== mod) {
      if (!needLocal.has(owner)) needLocal.set(owner, new Set());
      needLocal.get(owner).add(id);
    }
  }
  const rel = (to) => {
    let p = path.relative(path.dirname(mod), to).replace(/\\/g, '/');
    if (!p.startsWith('.')) p = './' + p;
    return p;
  };
  const header = [];
  if (needThree.size) header.push(`import { ${[...needThree].sort().join(', ')} } from 'three';`);
  for (const [owner, set] of [...needLocal].sort()) header.push(`import { ${[...set].sort().join(', ')} } from '${rel(owner)}';`);
  const BROWSER = new Set(['window','document','navigator','location','localStorage','sessionStorage','console','Math','JSON','Date','Object','Array','String','Number','Boolean','Set','Map','WeakMap','WeakSet','Promise','Error','Symbol','RegExp','Infinity','NaN','undefined','globalThis','fetch','setTimeout','setInterval','clearTimeout','clearInterval','requestAnimationFrame','cancelAnimationFrame','performance','crypto','Float32Array','Uint8Array','Uint16Array','Uint32Array','Int32Array','Int16Array','Int8Array','Uint8ClampedArray','Float64Array','ArrayBuffer','DataView','TextEncoder','TextDecoder','Intl','URL','URLSearchParams','Blob','Image','AudioContext','webkitAudioContext','WebSocket','CustomEvent','Event','structuredClone','atob','btoa','process','Colyseus','Client','isNaN','isFinite','parseInt','parseFloat','Proxy','Reflect','BigInt','queueMicrotask','reportError','HTMLElement','Node','DOMParser','matchMedia','screen','history','alert','indexedDB','module','require','exports','__dirname','__filename','Buffer','global']);
  for (const id of new Set(freeIds)) {
    if (declaredHere.has(id) || threeNames.has(id) || nodeOwnerNames.has(id) || BROWSER.has(id)) continue;
    unresolved.push(`${mod}: ${id}`);
  }
  const exported = [...declaredHere].filter(n => refsOf[n] > 0).sort();
  const footer = exported.length ? `\nexport { ${exported.join(', ')} };\n` : '';
  const file = path.join(outRoot, mod);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${header.join('\n')}${header.length ? '\n\n' : ''}${chunk}\n${footer}`);
  summary.push(`${mod.padEnd(26)} ${String(stmts.length).padStart(4)} stmts  ${String(Math.round(chunk.length / 1024)).padStart(4)}KB  imports:${needThree.size + [...needLocal.values()].reduce((a, s) => a + s.size, 0)}  exports:${exported.length}`);
}
fs.writeFileSync('recovered/tail.js', tail.map(s => generate(s, { jsescOption: { minimal: true } }).code).join('\n\n'));
console.log(summary.join('\n'));
if (unresolved.length) { console.log('\nUNRESOLVED REFERENCES (' + unresolved.length + '):'); console.log([...new Set(unresolved)].join('\n')); }
console.log(`\ntail (bootstrap) statements: ${tail.length}, ${fs.statSync('recovered/tail.js').size} bytes`);
