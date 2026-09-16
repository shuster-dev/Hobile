import fs from 'node:fs';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default;

const code = fs.readFileSync('recovered/bundle.pretty.js', 'utf8');
const ast = parse(code, { sourceType: 'script', errorRecovery: true });

let topScope = null;
traverse(ast, {
  Function(path) {
    if (!topScope) { topScope = path.scope; path.stop(); }
  },
});

const rows = [];
for (const [name, binding] of Object.entries(topScope.bindings)) {
  const n = binding.path.node;
  let kind = n.type, head = '';
  const init = n.init || n;
  if (init.type === 'ClassExpression' || init.type === 'ClassDeclaration') kind = 'class';
  else if (init.type === 'ObjectExpression') kind = 'object';
  else if (init.type === 'ArrayExpression') kind = 'array';
  else if (init.type === 'ArrowFunctionExpression') kind = 'arrow';
  else if (init.type === 'FunctionDeclaration') kind = 'function';
  else kind = init.type;
  const loc = n.loc ? n.loc.start.line : 0;
  head = code.slice(n.start, Math.min(n.end, n.start + 90)).replace(/\s+/g, ' ');
  rows.push({ name, kind, line: loc, refs: binding.references, head });
}
rows.sort((a, b) => a.line - b.line);
const game = rows.filter(r => r.line > 20000);
console.log(`top-level bindings: ${rows.length} (game region: ${game.length})`);
fs.writeFileSync('recovered/bindings.json', JSON.stringify(rows, null, 1));
for (const r of game) console.log(`L${String(r.line).padStart(5)} ${r.kind.padEnd(10)} refs=${String(r.refs).padStart(4)}  ${r.name.padEnd(5)} ${r.head.slice(0, 95)}`);
