import fs from 'node:fs';
const s = fs.readFileSync(process.argv[2], 'utf8');
function matchFrom(str, start) {
  const open = str[start], close = open === '{' ? '}' : ']';
  let depth = 0, i = start;
  while (i < str.length) {
    const c = str[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < str.length) { if (str[i] === '\\') { i += 2; continue; } if (str[i] === q) break; i++; }
      i++; continue;
    }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}
// find `<ident>={` or `<ident>=[` at statement level, big literals only
const re = /(?:^|[;,{\s])((?:var |let |const )?)([A-Za-z_$][\w$]*)\s*=\s*([{[])/g;
let m, seen = [], lastEnd = 0;
while ((m = re.exec(s))) {
  const open = m.index + m[0].length - 1;
  if (open < lastEnd) continue;            // skip nested
  const end = matchFrom(s, open);
  if (end < 0) continue;
  const len = end - open + 1;
  if (len < 700) continue;
  const body = s.slice(open, end + 1);
  // data-ish: mostly quoted keys/values, few function tokens
  const fnHits = (body.match(/function|=>|return |this\./g) || []).length;
  const density = fnHits / (len / 1000);
  seen.push({ name: m[2], open, end, len, density: +density.toFixed(1), head: body.slice(0, 110).replace(/\s+/g, ' ') });
  lastEnd = end;
}
seen.sort((a, b) => b.len - a.len);
for (const x of seen) console.log(`${x.name.padEnd(6)} len=${String(x.len).padStart(7)} fn/kb=${String(x.density).padStart(6)} @${x.open}  ${x.head}`);
