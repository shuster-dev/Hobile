const fs=require('fs'),vm=require('vm'),assert=require('assert');
const sandbox={window:{}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('core.js','utf8'),sandbox);
const C=sandbox.window.HobileCore;
function ok(name,fn){fn();console.log('PASS',name)}
ok('CT spawn open',()=>assert(C.canStand(C.CT_SPAWN.x,C.CT_SPAWN.y)));
ok('T spawn open',()=>assert(C.canStand(C.T_SPAWN.x,C.T_SPAWN.y)));
ok('Site A open',()=>assert(C.site(19.5,20).label==='A'&&C.canStand(19.5,20)));
ok('Site B open',()=>assert(C.site(2.5,2.5).label==='B'&&C.canStand(2.5,2.5)));
ok('path CT to T',()=>assert(C.path(C.CT_SPAWN.x,C.CT_SPAWN.y,C.T_SPAWN.x,C.T_SPAWN.y).length>10));
ok('path T to A',()=>assert(C.path(C.T_SPAWN.x,C.T_SPAWN.y,19.5,20).length>10));
ok('player movement works',()=>{let p={x:C.CT_SPAWN.x,y:C.CT_SPAWN.y};let before={...p};for(let i=0;i<15;i++)C.move(p,0,-.06,.19);assert(Math.hypot(p.x-before.x,p.y-before.y)>.2)});
ok('wall blocks movement',()=>{let p={x:1.5,y:1.5};for(let i=0;i<20;i++)C.move(p,-.1,0,.19);assert(p.x>1.1)});
ok('nearby LOS works',()=>assert(C.los(2.5,21.5,4.5,21.5)));
console.log('9/9 core checks passed');
