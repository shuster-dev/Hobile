import fs from 'node:fs';
const rd = f => fs.readFileSync(f, 'utf8');
const wr = (f, s) => fs.writeFileSync(f, s);

// gamedata: zone quest chains + materials merge belong with the data
let gd = rd('src/shared/gamedata.js');
if (!gd.includes('// derived tables')) {
  const exp = gd.lastIndexOf('\nexport {');
  gd = gd.slice(0, exp) + `
// derived tables (were bundle bootstrap side effects)
for (let z of Object.values(ZONES)) if (z.capturable) Object.assign(QUESTS, zoneQuestChain(z));
Object.assign(ITEMS, MATERIALS);
` + gd.slice(exp);
  wr('src/shared/gamedata.js', gd);
}

// battle fx defaults
let bt = rd('src/client/gfx/battle.js');
if (!bt.includes('// fx defaults')) {
  const exp = bt.lastIndexOf('\nexport {');
  bt = bt.slice(0, exp) + `
// fx defaults (were bundle bootstrap side effects)
for (let k of Object.keys(ELEMENT_FX)) ELEMENT_FX[k] = { ...FX_DEFAULT, ...ELEMENT_FX[k] };
` + bt.slice(exp);
  wr('src/client/gfx/battle.js', bt);
}

// base.js must not import the client — move soloGame out
let base = rd('src/server/game/base.js');
base = base.replace(/import \{[^}]*\} from '\.\.\/\.\.\/client\/game\.js';\n/, '');
base = base.replace(/\nvar soloGame = new Game\(new LocalStore\(\)\);\n/, '\n');
base = base.replace(/export \{([^}]*)\};/, (m, g) => `export {${g.split(',').map(s => s.trim()).filter(s => s && s !== 'soloGame').join(', ')}};`);
wr('src/server/game/base.js', base);

wr('src/client/main.js', `import { Game } from './game.js';

const game = new Game();
game.boot();
window.__hobile = game;
`);

wr('src/client/solo.js', `// Single-player build: the same client driven by the in-process simulation.
import { Game } from './game.js';
import { LocalStore } from '../server/game/base.js';

const game = new Game(new LocalStore());
game.boot();
window.__hobile = game;
`);
// net.js: use the colyseus.js module instead of a global
let net = rd('src/client/net.js');
if (!net.includes("from 'colyseus.js'")) {
  net = "import { Client } from 'colyseus.js';\n\n" + net.replace('new Colyseus.Client(this.wsBase)', 'new Client(this.wsBase)');
  wr('src/client/net.js', net);
}
fs.copyFileSync('recovered/shell.html', 'src/client/index.html');
console.log('finalized');
