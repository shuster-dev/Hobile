(()=>{
"use strict";
if(!window.THREE){document.getElementById("boot").classList.add("hidden");document.getElementById("engineError").classList.remove("hidden");return;}

const $=id=>document.getElementById(id);
const canvas=$("game");
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x8da4ad);
scene.fog=new THREE.Fog(0x8da4ad,28,72);

const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.setSize(innerWidth,innerHeight,false);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;

const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,120);
camera.rotation.order="YXZ";
scene.add(camera);

const hemi=new THREE.HemisphereLight(0xd9eff8,0x5b4937,1.35);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe8c7,1.35);
sun.position.set(18,28,13);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;
scene.add(sun);

const clock=new THREE.Clock();
let gameState="menu",paused=false,selectedTeam="CT",roundEnding=false,ctScore=0,tScore=0,roundTime=95,bombPlanted=false,bombTimer=0,bomb=null,lastShot=0;
let player=null,bots=[],colliders=[],rayTargets=[],animTime=0;
let moveInput={x:0,y:0},lookPointer=null,joyPointer=null,joyX=0,joyY=0;

const materials={};
function seededNoise(ctx,w,h,base,noise=18){
 const img=ctx.createImageData(w,h);
 for(let i=0;i<img.data.length;i+=4){let n=(Math.random()-.5)*noise;img.data[i]=base[0]+n;img.data[i+1]=base[1]+n;img.data[i+2]=base[2]+n;img.data[i+3]=255}
 ctx.putImageData(img,0,0);
}
function canvasTexture(type){
 const c=document.createElement("canvas");c.width=c.height=256;const x=c.getContext("2d");
 if(type==="sand"){
   seededNoise(x,256,256,[171,146,104],24);x.strokeStyle="rgba(88,65,42,.42)";x.lineWidth=5;
   for(let y=0;y<256;y+=42){x.beginPath();x.moveTo(0,y);x.lineTo(256,y);x.stroke()}
   x.strokeStyle="rgba(219,194,147,.25)";x.lineWidth=2;for(let i=0;i<40;i++){x.beginPath();let sx=Math.random()*256,sy=Math.random()*256;x.moveTo(sx,sy);x.lineTo(sx+Math.random()*35-17,sy+Math.random()*30);x.stroke()}
 }else if(type==="concrete"){
   seededNoise(x,256,256,[105,111,108],30);x.strokeStyle="rgba(60,67,66,.45)";x.lineWidth=2;for(let i=0;i<18;i++){let sx=Math.random()*256,sy=Math.random()*256;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.random()*45-22,sy+Math.random()*55);x.stroke()}
 }else if(type==="brick"){
   seededNoise(x,256,256,[139,107,70],18);x.fillStyle="rgba(58,45,31,.65)";
   for(let y=0,row=0;y<256;y+=34,row++){x.fillRect(0,y,256,4);let off=row%2?34:0;for(let bx=-off;bx<256;bx+=68)x.fillRect(bx,y,4,34)}
 }else if(type==="metal"){
   x.fillStyle="#596467";x.fillRect(0,0,256,256);for(let i=0;i<256;i+=24){x.fillStyle=i%48===0?"#647175":"#4b5659";x.fillRect(i,0,12,256);x.fillStyle="#333b3d";x.fillRect(i+12,0,2,256)}
 }else if(type==="wood"){
   x.fillStyle="#7d5732";x.fillRect(0,0,256,256);for(let y=0;y<256;y+=26){x.fillStyle=y%52===0?"#91673c":"#694725";x.fillRect(0,y,256,3)}x.strokeStyle="#49311c";x.lineWidth=13;x.strokeRect(9,9,238,238);x.beginPath();x.moveTo(15,15);x.lineTo(241,241);x.moveTo(241,15);x.lineTo(15,241);x.stroke()
 }else if(type==="floor"){
   seededNoise(x,256,256,[111,91,68],18);x.strokeStyle="rgba(55,46,39,.25)";x.lineWidth=2;for(let i=0;i<256;i+=32){x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke()}
 }
 const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return tex;
}
materials.sand=new THREE.MeshStandardMaterial({map:canvasTexture("sand"),roughness:.92,metalness:0});
materials.concrete=new THREE.MeshStandardMaterial({map:canvasTexture("concrete"),roughness:.95});
materials.brick=new THREE.MeshStandardMaterial({map:canvasTexture("brick"),roughness:.93});
materials.metal=new THREE.MeshStandardMaterial({map:canvasTexture("metal"),roughness:.66,metalness:.28});
materials.wood=new THREE.MeshStandardMaterial({map:canvasTexture("wood"),roughness:.86});
materials.floor=new THREE.MeshStandardMaterial({map:canvasTexture("floor"),roughness:1});
materials.dark=new THREE.MeshStandardMaterial({color:0x1d2529,roughness:.7,metalness:.2});

function box(x,y,z,w,h,d,mat=materials.sand,collide=true,cast=true){
 const g=new THREE.BoxGeometry(w,h,d);const m=new THREE.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;scene.add(m);
 if(collide)colliders.push(new THREE.Box3().setFromObject(m));return m;
}
function cylinder(x,y,z,r,h,mat=materials.metal,collide=true){
 const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);
 if(collide)colliders.push(new THREE.Box3().setFromObject(m));return m;
}
function planeSign(text,color,x,y,z,rotY=0){
 const c=document.createElement("canvas");c.width=256;c.height=128;const g=c.getContext("2d");g.fillStyle="rgba(17,23,26,.9)";g.fillRect(0,0,256,128);g.strokeStyle=color;g.lineWidth=8;g.strokeRect(8,8,240,112);g.fillStyle=color;g.font="900 72px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText(text,128,66);
 const tex=new THREE.CanvasTexture(c);const m=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.1),new THREE.MeshBasicMaterial({map:tex,transparent:true}));m.position.set(x,y,z);m.rotation.y=rotY;scene.add(m);
}

function buildMap(){
 colliders.length=0;
 const floorMat=materials.floor;floorMat.map.repeat.set(12,12);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(46,46),floorMat);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

 // perimeter
 box(0,2,-23,46,4,1,materials.sand);box(0,2,23,46,4,1,materials.sand);box(-23,2,0,1,4,46,materials.sand);box(23,2,0,1,4,46,materials.sand);

 // T spawn plaza and long route
 box(0,2,16,15,4,1,materials.brick);box(-7,2,11.5,1,4,10,materials.sand);box(7,2,12,1,4,9,materials.sand);
 box(-12,2,8,9,4,1,materials.sand);box(-16,2,3,1,4,11,materials.sand);
 // CT spawn / B warehouse
 box(0,2,-16,17,4,1,materials.concrete);box(8,2,-12,1,4,9,materials.concrete);box(-8,2,-12,1,4,9,materials.concrete);
 box(-13,2,-7,10,4,1,materials.concrete);
 // mid structures
 box(0,2,3.5,12,4,1,materials.sand);box(-5.5,2,-2,1,4,10,materials.brick);box(6,2,-2,1,4,10,materials.brick);
 box(0,2,-7,10,4,1,materials.concrete);
 // openings / arch-like lintels
 box(0,3.45,3.5,3.2,1.1,1,materials.sand,false);box(-4.7,1.5,3.5,1.7,3,1,materials.sand);box(4.7,1.5,3.5,1.7,3,1,materials.sand);
 box(0,3.35,-7,2.8,1.3,1,materials.concrete,false);box(-4.1,1.4,-7,1.8,2.8,1,materials.concrete);box(4.1,1.4,-7,1.8,2.8,1,materials.concrete);
 // A courtyard
 box(14,2,6,1,4,14,materials.sand);box(18,2,0,9,4,1,materials.sand);box(18,2,12,9,4,1,materials.sand);
 // B warehouse room
 box(-14,2,-15,1,4,13,materials.concrete);box(-18,2,-9,9,4,1,materials.concrete);box(-18,2,-21,9,4,1,materials.concrete);
 // crates
 [[11,0,8],[11,0,9.6],[18,0,8],[19.6,0,8],[-17,0,-13],[-18.6,0,-13],[-12,0,-18],[2,0,0],[3.6,0,0]].forEach(([x,y,z],i)=>box(x,.8,z,1.55,1.6,1.55,materials.wood,true));
 // barrels
 [[16,-4],[17,-4],[18,-4],[-19,-17],[-18,-17]].forEach(([x,z])=>cylinder(x,.65,z,.5,1.3,materials.metal,true));
 // stairs to A platform
 for(let i=0;i<6;i++)box(9+i*.55,.15+i*.16,10, .62,.3+i*.32,3.0,materials.concrete,true);
 box(12.6,1.1,10,4,0.35,5,materials.concrete,true);
 // low cover
 box(-2,.75,8,5,1.5,1,materials.brick,true);box(10,.65,2,1,1.3,5,materials.concrete,true);box(-11,.65,4,1,1.3,5,materials.concrete,true);
 // overhead awnings
 box(-18,4,-15,8,.3,11,materials.metal,false);box(18,4,6,8,.3,10,materials.metal,false);
 // distant skyline
 for(let i=0;i<10;i++){let x=-30+i*7;box(x,2.5,-31,4+Math.random()*3,5+Math.random()*4,5,materials.concrete,false,false)}
 planeSign("A","#f05252",19,2.3,11.45,Math.PI);planeSign("B","#e5bd59",-19,2.3,-9.45,0);
 // bomb site floor pads
 const a=new THREE.Mesh(new THREE.CircleGeometry(3,32),new THREE.MeshBasicMaterial({color:0x9a3030,transparent:true,opacity:.22,side:THREE.DoubleSide}));a.rotation.x=-Math.PI/2;a.position.set(18,.015,7);scene.add(a);
 const b=new THREE.Mesh(new THREE.CircleGeometry(3,32),new THREE.MeshBasicMaterial({color:0xc18a2d,transparent:true,opacity:.2,side:THREE.DoubleSide}));b.rotation.x=-Math.PI/2;b.position.set(-18,.015,-15);scene.add(b);
}
buildMap();

const spawn={CT:new THREE.Vector3(-18,1.65,-17),T:new THREE.Vector3(0,1.65,19)};
const siteA={pos:new THREE.Vector3(18,0,7),r:3.25,label:"A"},siteB={pos:new THREE.Vector3(-18,0,-15),r:3.25,label:"B"};

function capsuleMaterial(color){return new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.05});}
function addPart(group,geo,mat,pos,rot=[0,0,0],name=""){
 const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;m.receiveShadow=true;m.name=name;group.add(m);return m;
}
function makeRifleModel(scale=1){
 const g=new THREE.Group(),metal=capsuleMaterial(0x20282b),metal2=capsuleMaterial(0x394649),dark=capsuleMaterial(0x111719);
 addPart(g,new THREE.BoxGeometry(.16,.18,.75),metal,[0,0,0],"gunBody");
 addPart(g,new THREE.BoxGeometry(.12,.12,.55),metal2,[0,.01,-.58],"barrelHousing");
 addPart(g,new THREE.CylinderGeometry(.025,.025,.7,8),dark,[0,.02,-1.12],[Math.PI/2,0,0],"barrel");
 addPart(g,new THREE.BoxGeometry(.12,.32,.18),dark,[0,-.22,-.05],[-.18,0,0],"mag");
 addPart(g,new THREE.BoxGeometry(.11,.16,.22),metal2,[0,.16,-.17],[0,0,0],"sight");
 addPart(g,new THREE.BoxGeometry(.10,.09,.34),metal,[0,-.02,.54],"stock");
 g.scale.setScalar(scale);return g;
}
function makeSoldier(team){
 const g=new THREE.Group();g.userData.team=team;g.userData.hp=100;g.userData.alive=true;
 const uniform=capsuleMaterial(team==="CT"?0x294858:0x704237),vest=capsuleMaterial(team==="CT"?0x18282f:0x322b26),pants=capsuleMaterial(team==="CT"?0x25343a:0x3d3531),skin=capsuleMaterial(0xb78361),helmet=capsuleMaterial(team==="CT"?0x1d292e:0x473a32);
 const hips=addPart(g,new THREE.CapsuleGeometry(.27,.36,4,8),pants,[0,.95,0],"hips");
 const torso=addPart(g,new THREE.CapsuleGeometry(.38,.6,4,8),uniform,[0,1.55,0],"body");
 addPart(g,new THREE.BoxGeometry(.68,.62,.34),vest,[0,1.58,-.02],"body");
 const head=addPart(g,new THREE.SphereGeometry(.27,14,10),skin,[0,2.22,0],"head");
 addPart(g,new THREE.SphereGeometry(.29,14,8,0,Math.PI*2,0,Math.PI*.55),helmet,[0,2.30,0],"helmet");
 const lLeg=addPart(g,new THREE.CapsuleGeometry(.115,.58,4,8),pants,[-.18,.42,0],"lLeg");
 const rLeg=addPart(g,new THREE.CapsuleGeometry(.115,.58,4,8),pants,[.18,.42,0],"rLeg");
 const lArm=addPart(g,new THREE.CapsuleGeometry(.09,.48,4,8),uniform,[-.43,1.55,-.08],[.45,0,.25],"lArm");
 const rArm=addPart(g,new THREE.CapsuleGeometry(.09,.48,4,8),uniform,[.43,1.55,-.08],[.45,0,-.25],"rArm");
 const rifle=makeRifleModel(.75);rifle.position.set(.05,1.48,-.48);rifle.rotation.x=-.08;g.add(rifle);
 g.userData.parts={lLeg,rLeg,lArm,rArm,torso,head};g.userData.hitMeshes=[head,torso];head.userData.hitPart="head";torso.userData.hitPart="body";
 return g;
}

function makeViewWeapon(){
 const root=new THREE.Group();root.position.set(.38,-.30,-.72);camera.add(root);
 const handsMat=capsuleMaterial(0x9d6e4f),glove=capsuleMaterial(0x252c2e);
 const rifle=makeRifleModel(.58);rifle.rotation.y=-.03;root.add(rifle);
 const lHand=addPart(root,new THREE.CapsuleGeometry(.06,.23,4,8),glove,[-.15,-.13,-.24],[1.1,0,.55]);
 const rHand=addPart(root,new THREE.CapsuleGeometry(.06,.23,4,8),glove,[.16,-.16,.1],[1.0,0,-.4]);
 const fore1=addPart(root,new THREE.CapsuleGeometry(.075,.42,4,8),handsMat,[-.20,-.30,.06],[1.2,0,.3]);
 const fore2=addPart(root,new THREE.CapsuleGeometry(.075,.42,4,8),handsMat,[.20,-.32,.22],[1.1,0,-.28]);
 root.userData={rifle,lHand,rHand,fore1,fore2,recoil:0,reloadT:0};return root;
}
const viewWeapon=makeViewWeapon();

function sphereVisible(pos,from){
 const dir=pos.clone().sub(from);const dist=dir.length();dir.normalize();
 const ray=new THREE.Raycaster(from,dir,0,dist-.15);const hits=ray.intersectObjects(scene.children,true);
 return hits.length===0||hits[0].object.userData.actor;
}
function collidesAt(pos,r=.32){
 const b=new THREE.Box3(new THREE.Vector3(pos.x-r,.1,pos.z-r),new THREE.Vector3(pos.x+r,2.0,pos.z+r));
 return colliders.some(c=>c.intersectsBox(b));
}
function tryMove(pos,dx,dz){
 let p=pos.clone();p.x+=dx;if(!collidesAt(p))pos.x=p.x;
 p=pos.clone();p.z+=dz;if(!collidesAt(p))pos.z=p.z;
}

function spawnRound(){
 bots.forEach(b=>scene.remove(b.model));bots.length=0;rayTargets.length=0;
 player={team:selectedTeam,pos:spawn[selectedTeam].clone(),yaw:selectedTeam==="CT"?0:Math.PI,pitch:0,hp:100,armor:100,ammo:30,reserve:90,alive:true,vy:0,onGround:true,bob:0,reloading:false,kills:0,weapon:0};
 camera.position.copy(player.pos);player.yaw=selectedTeam==="CT"?0:Math.PI;
 const enemyTeam=selectedTeam==="CT"?"T":"CT";
 const friendlySpawn=spawn[selectedTeam].clone().add(new THREE.Vector3(1.5,0,0));
 const enemySpawn=spawn[enemyTeam].clone().add(new THREE.Vector3(enemyTeam==="T"?1.5:-1.5,0,0));
 addBot(selectedTeam,"ALLY",friendlySpawn);
 addBot(enemyTeam,"ENEMY",enemySpawn);
 roundTime=95;bombPlanted=false;bombTimer=0;bomb=null;roundEnding=false;
 $("centerMessage").textContent="";$("useBtn").classList.add("hidden");updateHUD();
}
function addBot(team,name,pos){
 const model=makeSoldier(team);model.position.copy(pos);scene.add(model);
 model.traverse(o=>{if(o.isMesh){o.userData.actor=model;if(o.userData.hitPart)rayTargets.push(o)}});
 const b={team,name,model,pos:model.position,hp:100,alive:true,path:[],wp:0,shootCooldown:.5+Math.random()*.5,think:0,walkT:0,target:null};bots.push(b);
}
const waypoints=[
 new THREE.Vector3(-18,0,-17),new THREE.Vector3(-11,0,-12),new THREE.Vector3(-4,0,-10),new THREE.Vector3(0,0,-5),
 new THREE.Vector3(0,0,0),new THREE.Vector3(8,0,4),new THREE.Vector3(12,0,8),new THREE.Vector3(18,0,7),
 new THREE.Vector3(-8,0,4),new THREE.Vector3(-14,0,-1),new THREE.Vector3(-18,0,-9),new THREE.Vector3(-18,0,-15),
 new THREE.Vector3(0,0,12),new THREE.Vector3(0,0,19),new THREE.Vector3(8,0,13)
];
const links=[[1],[0,2,10],[1,3,8],[2,4],[3,5,8,12],[4,6,14],[5,7],[6],[2,4,9],[8,10],[9,11,1],[10],[4,13,14],[12,14],[12,13,5]];
function nearestWP(v){let bi=0,bd=1e9;waypoints.forEach((w,i)=>{let d=w.distanceToSquared(v);if(d<bd){bd=d;bi=i}});return bi}
function route(from,to){
 let s=nearestWP(from),g=nearestWP(to),q=[s],prev=new Map([[s,-1]]);
 for(let qi=0;qi<q.length;qi++){let n=q[qi];if(n===g)break;for(let nb of links[n])if(!prev.has(nb)){prev.set(nb,n);q.push(nb)}}
 if(!prev.has(g))return [to.clone()];let r=[],n=g;while(n!==-1){r.push(waypoints[n].clone());n=prev.get(n)}r.reverse();r.push(to.clone());return r;
}
function animateSoldier(bot,dt,moving){
 bot.walkT+=dt*(moving?8:2);const p=bot.model.userData.parts;
 let swing=moving?Math.sin(bot.walkT)*.45:0;
 p.lLeg.rotation.x=swing;p.rLeg.rotation.x=-swing;p.lArm.rotation.x=.45-swing*.35;p.rArm.rotation.x=.45+swing*.35;
}
function botTarget(bot){
 if(player.alive&&player.team!==bot.team)return {pos:player.pos,hp:player.hp,isPlayer:true,name:"YOU"};
 const e=bots.find(o=>o!==bot&&o.alive&&o.team!==bot.team);return e?{pos:e.pos,hp:e.hp,isPlayer:false,ref:e,name:e.name}:null;
}
function damagePlayer(d,who){
 if(!player.alive)return;let absorbed=Math.min(player.armor,d*.42);player.armor-=absorbed;player.hp-=d-absorbed*.45;
 const f=$("damageFlash");f.classList.remove("show");void f.offsetWidth;f.classList.add("show");
 if(player.hp<=0){player.hp=0;player.alive=false;addKill(who+" ▸ YOU");$("centerMessage").textContent="ELIMINATED";}
}
function damageBot(bot,d,head){
 if(!bot.alive)return;bot.hp-=d;showHit();if(bot.hp<=0){bot.hp=0;bot.alive=false;bot.model.userData.alive=false;addKill("YOU ▸ "+bot.name+(head?" · HEADSHOT":""));$("centerMessage").textContent=head?"HEADSHOT":"ENEMY DOWN";bot.model.userData.dying=0;}
}
function updateBots(dt){
 for(const b of bots){
  if(!b.alive){if(b.model.userData.dying!==undefined){b.model.userData.dying+=dt;b.model.rotation.z=Math.min(Math.PI/2,b.model.userData.dying*2.5);b.model.position.y=Math.max(-.55,-b.model.userData.dying*.32)}continue}
  b.shootCooldown-=dt;b.think-=dt;let t=botTarget(b);
  if(t){
   const dist=b.pos.distanceTo(t.pos),dir=t.pos.clone().sub(b.pos);dir.y=0;
   const visible=dist<16&&sphereVisible(t.pos.clone().setY(1.5),b.pos.clone().setY(1.5));
   if(visible&&dist<13){
    b.model.rotation.y=Math.atan2(dir.x,dir.z);
    animateSoldier(b,dt,false);
    if(b.shootCooldown<=0){b.shootCooldown=.65+Math.random()*.45;if(t.isPlayer)damagePlayer(10+Math.random()*8,b.name);else{t.ref.hp-=12+Math.random()*10;if(t.ref.hp<=0){t.ref.alive=false;t.ref.model.userData.dying=0;addKill(b.name+" ▸ "+t.ref.name)}}}
   }else{
    if(b.think<=0||!b.path.length){let goal;
      if(b.team==="T"&&!bombPlanted)goal=siteA.pos;else if(b.team==="CT"&&bombPlanted)goal=bomb.pos;else goal=t.pos;
      b.path=route(b.pos,goal);b.wp=1;b.think=.7;
    }
    const wp=b.path[Math.min(b.wp,b.path.length-1)];if(wp){let v=wp.clone().sub(b.pos);v.y=0;if(v.length()<.55)b.wp++;else{v.normalize();let dx=v.x*dt*1.6,dz=v.z*dt*1.6;tryMove(b.pos,dx,dz);b.model.rotation.y=Math.atan2(v.x,v.z);animateSoldier(b,dt,true)}}
   }
  }
  if(b.team==="T"&&!bombPlanted&&b.pos.distanceTo(siteA.pos)<siteA.r*.7){b.userPlant=(b.userPlant||0)+dt;if(b.userPlant>2.2){plantBomb(b.pos,siteA.label,b.name);b.userPlant=0}}
  if(b.team==="CT"&&bombPlanted&&b.pos.distanceTo(bomb.pos)<1.15){b.userDefuse=(b.userDefuse||0)+dt;if(b.userDefuse>4.2)endRound("CT","BOMB DEFUSED")}else b.userDefuse=0;
 }
}
function plantBomb(pos,label,who="YOU"){
 bombPlanted=true;bombTimer=32;bomb={pos:pos.clone(),label};$("centerMessage").textContent="BOMB PLANTED";addKill(who+" PLANTED");
 const group=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.45,.22,.30),new THREE.MeshStandardMaterial({color:0x27352c,roughness:.8}));body.castShadow=true;group.add(body);
 const led=new THREE.PointLight(0xff342e,.8,2);led.position.set(0,.18,0);group.add(led);group.position.copy(pos);group.position.y=.15;scene.add(group);bomb.model=group;
}
function endRound(team,reason){
 if(roundEnding)return;roundEnding=true;team==="CT"?ctScore++:tScore++;$("centerMessage").textContent=(team==="CT"?"COUNTER-TERRORISTS":"TERRORISTS")+" WIN · "+reason;
 setTimeout(()=>{if(bomb?.model)scene.remove(bomb.model);spawnRound()},2100);
}
function checkRound(){
 if(roundEnding)return;
 const ct=(player.alive&&player.team==="CT"?1:0)+bots.filter(b=>b.alive&&b.team==="CT").length;
 const tt=(player.alive&&player.team==="T"?1:0)+bots.filter(b=>b.alive&&b.team==="T").length;
 if(bombPlanted&&bombTimer<=0)return endRound("T","BOMB EXPLODED");
 if(!bombPlanted&&tt===0)return endRound("CT","TEAM ELIMINATED");
 if(ct===0)return endRound("T","TEAM ELIMINATED");
 if(!bombPlanted&&roundTime<=0)return endRound("CT","TIME EXPIRED");
}
function showHit(){const h=$("hitmarker");h.classList.remove("show");void h.offsetWidth;h.classList.add("show")}
function addKill(text){const e=document.createElement("div");e.textContent=text;$("killfeed").prepend(e);setTimeout(()=>e.remove(),2400)}
const shootRay=new THREE.Raycaster();
function shoot(){
 if(gameState!=="playing"||paused||!player.alive||player.reloading||roundEnding)return;
 const now=performance.now();if(now-lastShot<125)return;lastShot=now;if(player.ammo<=0)return reload();
 player.ammo--;viewWeapon.userData.recoil=1;
 shootRay.setFromCamera(new THREE.Vector2(0,0),camera);shootRay.far=40;
 const hits=shootRay.intersectObjects(rayTargets,false);
 if(hits.length){
  const mesh=hits[0].object,actor=mesh.userData.actor;if(actor&&actor.userData.team!==player.team&&actor.userData.alive){
   const bot=bots.find(b=>b.model===actor);if(bot)damageBot(bot,mesh.userData.hitPart==="head"?100:38,mesh.userData.hitPart==="head");
  }
 }
 updateHUD();
}
function reload(){
 if(player.reloading||player.ammo===30||player.reserve<=0||!player.alive)return;player.reloading=true;viewWeapon.userData.reloadT=.001;$("centerMessage").textContent="RELOADING";
 setTimeout(()=>{if(!player.reloading)return;let n=Math.min(30-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;player.reloading=false;viewWeapon.userData.reloadT=0;$("centerMessage").textContent="";updateHUD()},1100);
}
function playerUse(){
 if(!player.alive)return;
 if(player.team==="T"&&!bombPlanted){
  const nearA=player.pos.distanceTo(siteA.pos)<siteA.r,nearB=player.pos.distanceTo(siteB.pos)<siteB.r,site=nearA?siteA:(nearB?siteB:null);
  if(site){$("centerMessage").textContent="PLANTING…";setTimeout(()=>{if(player.alive&&!bombPlanted&&player.pos.distanceTo(site.pos)<site.r)plantBomb(player.pos,site.label)},1700)}
 }else if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.25){
  $("centerMessage").textContent="DEFUSING…";setTimeout(()=>{if(player.alive&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.25)endRound("CT","BOMB DEFUSED")},3500);
 }
}
function updateHUD(){
 $("hp").textContent=Math.max(0,Math.round(player.hp));$("armor").textContent=Math.max(0,Math.round(player.armor));$("ammo").textContent=player.ammo;$("reserve").textContent=player.reserve;$("ctScore").textContent=ctScore;$("tScore").textContent=tScore;
 const t=bombPlanted?bombTimer:roundTime,m=Math.max(0,Math.floor(t/60)),s=Math.max(0,Math.floor(t%60));$("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
 $("objective").textContent=bombPlanted?"BOMB PLANTED · SITE "+bomb.label:(player.team==="T"?"PLANT AT SITE A OR B":"DEFEND SITES A & B");
 const u=$("useBtn");let show=false;
 if(player.team==="T"&&!bombPlanted&&(player.pos.distanceTo(siteA.pos)<siteA.r||player.pos.distanceTo(siteB.pos)<siteB.r)){u.textContent="PLANT";show=true}
 if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3){u.textContent="DEFUSE";show=true}
 u.classList.toggle("hidden",!show);
}
function updateViewWeapon(dt,moving){
 animTime+=dt;player.bob+=moving?dt*10:dt*2;let ud=viewWeapon.userData;
 ud.recoil=Math.max(0,ud.recoil-dt*8);let bobX=moving?Math.sin(player.bob)*.012:0,bobY=moving?Math.abs(Math.cos(player.bob))*-.014:0;
 viewWeapon.position.x=.38+bobX;viewWeapon.position.y=-.30+bobY+ud.recoil*.035;viewWeapon.position.z=-.72+ud.recoil*.10;
 if(player.reloading){ud.reloadT+=dt;let p=Math.min(1,ud.reloadT/1.1);viewWeapon.rotation.z=Math.sin(p*Math.PI)*-.55;viewWeapon.rotation.x=Math.sin(p*Math.PI)*.24}else{viewWeapon.rotation.z=0;viewWeapon.rotation.x=0}
}
function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener("resize",resize);

function startGame(team){
 selectedTeam=team;$("teamSelect").classList.add("hidden");$("loading").classList.remove("hidden");$("matchBar").style.width="15%";
 const steps=[["Creating map lighting…",40],["Spawning 3D soldiers…",72],["Preparing weapon animations…",92],["Deploying…",100]];let i=0;
 const iv=setInterval(()=>{let s=steps[i++];$("loadingText").textContent=s[0];$("matchBar").style.width=s[1]+"%";if(i===steps.length){clearInterval(iv);setTimeout(()=>{$("loading").classList.add("hidden");$("hud").classList.remove("hidden");$("controls").classList.remove("hidden");gameState="playing";paused=false;ctScore=tScore=0;spawnRound();clock.start()},300)}},230);
}
$("playBtn").onclick=()=>{$("menu").classList.add("hidden");$("teamSelect").classList.remove("hidden")};
$("trainingBtn").onclick=()=>{$("menu").classList.add("hidden");startGame("CT")};
document.querySelectorAll("[data-team]").forEach(b=>b.onclick=()=>startGame(b.dataset.team));
$("pauseBtn").onclick=()=>{paused=true;$("pauseOverlay").classList.remove("hidden")};
$("resumeBtn").onclick=()=>{paused=false;$("pauseOverlay").classList.add("hidden");clock.getDelta()};
$("leaveBtn").onclick=()=>{paused=false;gameState="menu";$("pauseOverlay").classList.add("hidden");$("hud").classList.add("hidden");$("controls").classList.add("hidden");$("menu").classList.remove("hidden")};
$("reloadBtn").onpointerdown=e=>{e.preventDefault();reload()};$("useBtn").onpointerdown=e=>{e.preventDefault();playerUse()};$("jumpBtn").onpointerdown=e=>{e.preventDefault();if(player.onGround){player.vy=4.7;player.onGround=false}};
$("weaponBtn").onpointerdown=e=>{e.preventDefault();$("centerMessage").textContent="AR-4 RIFLE · PISTOL/KNIFE IN NEXT COMBAT PASS";setTimeout(()=>{if(!roundEnding)$("centerMessage").textContent=""},900)};
$("fireBtn").onpointerdown=e=>{e.preventDefault();shoot();const id=setInterval(shoot,125);const stop=()=>{clearInterval(id);$("fireBtn").removeEventListener("pointerup",stop);$("fireBtn").removeEventListener("pointercancel",stop)};$("fireBtn").addEventListener("pointerup",stop);$("fireBtn").addEventListener("pointercancel",stop)};

const joy=$("joystick"),stick=$("stick"),look=$("lookZone");
function joySet(x,y){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=x-cx,dy=y-cy,max=r.width*.33,l=Math.hypot(dx,dy)||1,k=Math.min(1,max/l);dx*=k;dy*=k;joyX=dx/max;joyY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
function joyStop(){joyPointer=null;joyX=joyY=0;stick.style.transform="translate(0,0)"}
joy.onpointerdown=e=>{joyPointer=e.pointerId;joy.setPointerCapture?.(e.pointerId);joySet(e.clientX,e.clientY)};joy.onpointermove=e=>{if(e.pointerId===joyPointer)joySet(e.clientX,e.clientY)};joy.onpointerup=joyStop;joy.onpointercancel=joyStop;
look.onpointerdown=e=>{lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};look.setPointerCapture?.(e.pointerId)};look.onpointermove=e=>{if(!lookPointer||lookPointer.id!==e.pointerId)return;let dx=e.clientX-lookPointer.x,dy=e.clientY-lookPointer.y;lookPointer.x=e.clientX;lookPointer.y=e.clientY;player.yaw-=dx*.004;player.pitch-=dy*.003;player.pitch=Math.max(-1.12,Math.min(1.0,player.pitch))};look.onpointerup=()=>lookPointer=null;look.onpointercancel=()=>lookPointer=null;

["contextmenu","selectstart","dragstart","gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
document.addEventListener("touchmove",e=>{if(gameState==="playing")e.preventDefault()},{passive:false});
document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});

const keys={};addEventListener("keydown",e=>{keys[e.key.toLowerCase()]=true;if(e.key.toLowerCase()==="r")reload();if(e.code==="Space")shoot()});addEventListener("keyup",e=>keys[e.key.toLowerCase()]=false);

function loop(){
 requestAnimationFrame(loop);const dt=Math.min(.035,clock.getDelta()||.016);
 if(gameState==="playing"&&!paused&&!roundEnding){
  const kx=(keys.d?1:0)-(keys.a?1:0),ky=(keys.s?1:0)-(keys.w?1:0),mx=Math.max(-1,Math.min(1,joyX+kx)),my=Math.max(-1,Math.min(1,joyY+ky)),moving=Math.abs(mx)+Math.abs(my)>.06;
  if(player.alive){
   const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)),right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
   const delta=forward.multiplyScalar(-my*3.5*dt).add(right.multiplyScalar(mx*3.5*dt));tryMove(player.pos,delta.x,delta.z);
   player.vy-=11.5*dt;player.pos.y+=player.vy*dt;if(player.pos.y<=1.65){player.pos.y=1.65;player.vy=0;player.onGround=true}
  }
  camera.position.copy(player.pos);camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
  if(bombPlanted)bombTimer-=dt;else roundTime-=dt;
  updateBots(dt);checkRound();updateViewWeapon(dt,moving);updateHUD();
 }
 renderer.render(scene,camera);
}
camera.position.copy(spawn.CT);loop();

// boot
$("bootBar").style.width="35%";$("bootStatus").textContent="Building materials and tactical map…";
setTimeout(()=>{$("bootBar").style.width="72%";$("bootStatus").textContent="Preparing 3D character rigs and weapon model…"},250);
setTimeout(()=>{$("bootBar").style.width="100%";$("bootStatus").textContent="Ready";setTimeout(()=>{$("boot").classList.add("hidden");$("menu").classList.remove("hidden")},220)},650);

// test/debug surface
window.__hobileV4={
 getState:()=>({gameState,selectedTeam,ctScore,tScore,roundTime,bombPlanted,player:player?{x:player.pos.x,y:player.pos.y,z:player.pos.z,hp:player.hp,ammo:player.ammo,alive:player.alive}:null,bots:bots.map(b=>({team:b.team,hp:b.hp,alive:b.alive,x:b.pos.x,z:b.pos.z}))}),
 startCT:()=>{document.getElementById("menu").classList.add("hidden");startGame("CT")},
 shoot,collidesAt,siteA,siteB
};
})();