import fs from 'node:fs';
const s = fs.readFileSync('/tmp/claude-0/-home-claude/c1bfcc3c-235a-5d91-8bb1-095aaedf1642/scratchpad/recover/index.html', 'utf8');
function matchFrom(str, start) {
  const open = str[start];
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
const map = {
  ELEMENTS: 601675, MOVES: 603196, SPECIES: 609305, ITEMS: 621116, ZONES: 624337,
  DUNGEONS: 630605, QUESTS: 632239, GUILD: 641328, BUILDINGS: 643575, RECIPES: 645811,
  PART_BUILDERS: 674064, ELEMENT_KITS: 669719, DESIGN: 689871, NPCS: 771491,
  INTERIORS: 753118, DIALOGUE: 773542, ZONE_SKY: 821675, ELEMENT_FX: 873308,
  STRINGS: 884532, INTERIOR_TEXT: 960228, PROMPTS: 972813,
};
let report = [];
for (const [name, at] of Object.entries(map)) {
  const end = matchFrom(s, at);
  const body = s.slice(at, end + 1);
  fs.writeFileSync(`recovered/raw/${name}.txt`, body);
  report.push(`${name.padEnd(15)} ${String(body.length).padStart(7)} bytes`);
}
console.log(report.join('\n'));
