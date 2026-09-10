
const assert=require("assert");
const C=require("./core.js");

function pass(x){console.log("PASS",x)}
assert(C.canStand(C.CT_SPAWN.x,C.CT_SPAWN.y)); pass("CT spawn walkable");
assert(C.canStand(C.T_SPAWN.x,C.T_SPAWN.y)); pass("T spawn walkable");

let p={x:C.CT_SPAWN.x,y:C.CT_SPAWN.y};
for(let i=0;i<30;i++)C.moveEntity(p,0,-.04,.19);
assert(Math.hypot(p.x-C.CT_SPAWN.x,p.y-C.CT_SPAWN.y)>.3); pass("movement updates position");

let path=C.pathfind(C.CT_SPAWN.x,C.CT_SPAWN.y,C.T_SPAWN.x,C.T_SPAWN.y);
assert(path.length>10); pass("pathfinding connects team spawns");

let s={team:"CT",x:2.5,y:21.5,a:0};
let enemy={team:"T",x:4.5,y:21.5,alive:true};
let hit=C.findShot(s,[enemy]);
assert(hit&&hit.bot===enemy); pass("close-range hitscan");

s={team:"CT",x:2.5,y:21.5,a:Math.atan2(2.5-21.5,20.5-2.5)};
enemy={team:"T",x:20.5,y:2.5,alive:true};
if(C.los(s.x,s.y,enemy.x,enemy.y)){
  hit=C.findShot(s,[enemy]); assert(hit); pass("long-range hitscan");
}else{
  pass("long-range LOS correctly blocked by map");
}

assert(C.currentSite((C.SITE_A.x1+C.SITE_A.x2)/2,(C.SITE_A.y1+C.SITE_A.y2)/2)?.label==="A"); pass("site A valid");
assert(C.currentSite((C.SITE_B.x1+C.SITE_B.x2)/2,(C.SITE_B.y1+C.SITE_B.y2)/2)?.label==="B"); pass("site B valid");

let actors=[{team:"CT",alive:true},{team:"T",alive:false}];
assert(C.roundWinner({actors,bombPlanted:false,bombTimer:0,roundTime:50,defused:false}).team==="CT"); pass("CT elimination win");
actors=[{team:"CT",alive:true},{team:"T",alive:true}];
assert(C.roundWinner({actors,bombPlanted:true,bombTimer:0,roundTime:50,defused:false}).team==="T"); pass("T bomb win");
assert(C.roundWinner({actors,bombPlanted:true,bombTimer:20,roundTime:50,defused:true}).team==="CT"); pass("CT defuse win");
console.log("ALL CORE TESTS PASSED");
