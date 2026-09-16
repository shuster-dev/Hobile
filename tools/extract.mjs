import fs from 'node:fs';
const src = fs.readFileSync(process.argv[2], 'utf8');

// Scan forward from an opening brace/bracket, respecting strings, template literals,
// regex-free (bundle has few top-level regexes inside data), and comments.
function matchFrom(s, start) {
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, i = start;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < s.length) {
        if (s[i] === '\\') { i += 2; continue; }
        if (s[i] === q) break;
        i++;
      }
      i++; continue;
    }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

// Walk back from a key marker to the start of the enclosing top-level object literal.
function objectStartBefore(s, idx) {
  let i = idx;
  let depth = 0;
  while (i >= 0) {
    const c = s[i];
    if (c === '}' || c === ']') depth++;
    else if (c === '{' || c === '[') {
      if (depth === 0) return i;
      depth--;
    }
    i--;
  }
  return -1;
}

const targets = JSON.parse(process.argv[3]);
const out = {};
for (const [name, marker] of Object.entries(targets)) {
  const idx = src.indexOf(marker);
  if (idx < 0) { out[name] = { error: 'marker not found' }; continue; }
  const st = objectStartBefore(src, idx);
  const en = matchFrom(src, st);
  if (st < 0 || en < 0) { out[name] = { error: 'unbalanced' }; continue; }
  out[name] = { start: st, end: en, len: en - st + 1, literal: src.slice(st, en + 1) };
}
fs.writeFileSync(process.argv[4], JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(14), v.error || `${v.len} bytes @${v.start}`);
