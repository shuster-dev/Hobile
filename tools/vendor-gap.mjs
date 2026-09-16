import fs from 'node:fs';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default;
const code = fs.readFileSync('recovered/bundle.pretty.js', 'utf8');
const tmap = JSON.parse(fs.readFileSync('recovered/three-map.json', 'utf8'));
const ast = parse(code, { sourceType: 'script', errorRecovery: true });
let topScope = null;
traverse(ast, { Function(p) { if (!topScope) { topScope = p.scope; p.stop(); } } });
const GAME_START = 22168;
const rows = [];
for (const [name, b] of Object.entries(topScope.bindings)) {
  const line = b.path.node.loc.start.line;
  if (line >= GAME_START) continue;
  const usedInGame = b.referencePaths.filter(p => p.node.loc.start.line >= GAME_START).length;
  if (!usedInGame) continue;
  const init = b.path.node.init || b.path.node;
  rows.push({ name, line, usedInGame, mapped: tmap[name] || '', kind: init.type,
    head: code.slice(init.start, Math.min(init.end, init.start + 80)).replace(/\s+/g, ' ') });
}
rows.sort((a, b) => b.usedInGame - a.usedInGame);
console.log(`vendor symbols used by game: ${rows.length} (unmapped: ${rows.filter(r => !r.mapped).length})`);
for (const r of rows) console.log(`${String(r.usedInGame).padStart(4)}x ${r.name.padEnd(5)} ${(r.mapped || '???').padEnd(24)} ${r.head.slice(0, 78)}`);
