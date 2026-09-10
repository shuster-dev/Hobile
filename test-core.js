
const assert=require("assert");
const C=require("./core.js");

function log(name){console.log("PASS:",name)}
assert(C.canStand(C.CT_SPAWN.x,C.CT_SPAWN.y)); log("CT spawn is walkable");
assert(C.canStand(C.T_SPAWN.x,C.T_SPAWN.y)); log("T spawn is walkable");

let p={x:C.CT_SPAWN.x,y:C.CT_SPAWN.y};
for(let i=0;i<20;i++) C.moveEntity(p,0,-0.05,.20);
assert(Math.hypot(p.x-C.CT_SPAWN.x,p.y-C.CT_SPAWN.y)>.25); log("player movement changes position");

let path=C.pathfind(C.CT_SPAWN.x,C.CT_SPAWN.y,C.T_SPAWN.x,C.T_SPAWN.y);
assert(path.length>10); log("bot pathfinding connects both team areas");

let shooter={team:"CT",x:2.5,y:21.5,a:0};
let target={team:"T",x:3.5,y:21.5,alive:true};
let hit=C.findShot(shooter,[target],.1);
assert(hit && hit.bot===target); log("hitscan can detect an exposed enemy");

let actors=[{team:"CT",alive:true},{team:"CT",alive:true},{team:"CT",alive:true},{team:"T",alive:false},{team:"T",alive:false},{team:"T",alive:false}];
let w=C.roundWinner({actors,bombPlanted:false,bombTimer:0,roundTime:60,defused:false});
assert(w&&w.team==="CT"); log("Round 1 simulation: CT wins by elimination");

actors=[{team:"CT",alive:true},{team:"T",alive:true}];
w=C.roundWinner({actors,bombPlanted:true,bombTimer:0,roundTime:15,defused:false});
assert(w&&w.team==="T"&&/BOMB/.test(w.reason)); log("Round 2 simulation: T wins by bomb explosion");

w=C.roundWinner({actors,bombPlanted:true,bombTimer:12,roundTime:15,defused:true});
assert(w&&w.team==="CT"&&/DEFUSED/.test(w.reason)); log("Round 3 simulation: CT wins by defuse");

assert(C.currentSite((C.SITE_A.x1+C.SITE_A.x2)/2,(C.SITE_A.y1+C.SITE_A.y2)/2).label==="A"); log("Bomb Site A is valid");
assert(C.currentSite((C.SITE_B.x1+C.SITE_B.x2)/2,(C.SITE_B.y1+C.SITE_B.y2)/2).label==="B"); log("Bomb Site B is valid");

console.log("\\n9/9 automated gameplay checks passed.");
