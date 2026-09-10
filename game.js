import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $=id=>document.getElementById(id);
const canvas=$("game");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));
renderer.setSize(innerWidth,innerHeight,false);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9bb1ba);
scene.fog=new THREE.Fog(0x9bb1ba,28,74);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,120);
camera.rotation.order="YXZ";
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xddeef4,0x66533d,1.45));
const sun=new THREE.DirectionalLight(0xffe6c2,1.6);
sun.position.set(20,30,14);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;
scene.add(sun);

const clock=new THREE.Clock(),loader=new GLTFLoader();
const MANIFEST="https://3dassets.dev/api/v1/packs/tactical-shooter-hill-town";
let records=[],cache=new Map(),colliders=[],bots=[],rayTargets=[],viewWeapon=null;
let state="boot",paused=false,team="CT",ctScore=0,tScore=0,roundTime=95,roundEnding=false,lastShot=0;
let bombPlanted=false,bombTimer=0,bomb=null,player=null,joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;

function fail(text){$("boot").classList.add("hidden");$("loading").classList.add("hidden");$("fatalText").textContent=text;$("fatal").classList.remove("hidden")}
function collect(node,out=[]){
 if(!node)return out;
 if(Array.isArray(node)){for(const v of node)collect(v,out);return out}
 if(typeof node==="object"){
   const strings=Object.values(node).filter(v=>typeof v==="string");
   const glb=strings.find(s=>/\.glb(?:\?|$)/i.test(s));
   if(glb)out.push({label:strings.join(" ").toLowerCase(),url:glb,obj:node});
   for(const v of Object.values(node))if(v&&typeof v==="object")collect(v,out);
 }
 return out;
}
function findRec(...terms){
 const ts=terms.map(t=>t.toLowerCase());
 return records.find(r=>ts.every(t=>r.label.includes(t)))||null;
}
async function glbByTerms(key,...terms){
 if(cache.has(key))return cache.get(key).clone(true);
 const r=findRec(...terms);if(!r)throw new Error("Missing asset: "+terms.join(" "));
 const g=await loader.loadAsync(r.url);cache.set(key,g.scene);return g.scene.clone(true);
}
async function loadUrl(url){const g=await loader.loadAsync(url);return g.scene}
function setShadow(o){o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});return o}
function addCollider(x,z,w,d,h=3.5){colliders.push(new THREE.Box3(new THREE.Vector3(x-w/2,0,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)))}
function collides(pos,r=.28){const b=new THREE.Box3(new THREE.Vector3(pos.x-r,.1,pos.z-r),new THREE.Vector3(pos.x+r,1.9,pos.z+r));return colliders.some(c=>c.intersectsBox(b))}
function movePos(pos,dx,dz,r=.28){let p=pos.clone();p.x+=dx;if(!collides(p,r))pos.x=p.x;p=pos.clone();p.z+=dz;if(!collides(p,r))pos.z=p.z}
function place(model,x,y,z,ry=0,scale=1){model.position.set(x,y,z);model.rotation.y=ry;model.scale.setScalar(scale);setShadow(model);scene.add(model);return model}

async function buildMap(){
 $("loadText").textContent="Loading Mediterranean map modules…";$("loadBar").style.width="18%";
 const floor=await glbByTerms("floor","cobbled","ground","tile");
 const plaster=await glbByTerms("plaster","plaster","wall","bay");
 const ochre=await glbByTerms("ochre","ochre","wall","bay");
 const arch=await glbByTerms("arch","arched","passage","bay");
 const low=await glbByTerms("lowwall","low","garden","wall");
 const fountain=await glbByTerms("fountain","octagonal","fountain");
 const stall=await glbByTerms("stall","market","stall");
 const crates=await glbByTerms("crates","timber","crate","stack");
 const barrel=await glbByTerms("barrel","oak","wine","barrel");
 const tree=await glbByTerms("tree","potted","olive");
 $("loadBar").style.width="45%";

 // floor: 8x8 4m tiles
 for(let gx=-3;gx<=4;gx++)for(let gz=-3;gz<=4;gz++)place(floor.clone(true),gx*4,-.04,gz*4,0,1);

 // perimeter and inner tactical lanes
 const wall=(m,x,z,rot=0)=>place(m.clone(true),x,1.75,z,rot,1);
 for(let x=-14;x<=14;x+=4){wall(plaster,x,-16,0);wall(ochre,x,16,Math.PI)}
 for(let z=-12;z<=12;z+=4){wall(plaster,-16,z,Math.PI/2);wall(ochre,16,z,-Math.PI/2)}
 // openings use arches
 wall(arch,0,-8,0);wall(arch,-8,0,Math.PI/2);wall(arch,8,4,Math.PI/2);wall(arch,0,8,0);
 wall(plaster,-8,-8,0);wall(plaster,8,-8,0);wall(ochre,-8,8,Math.PI);wall(ochre,8,8,Math.PI);
 wall(plaster,-4,0,Math.PI/2);wall(ochre,4,0,-Math.PI/2);
 // low cover
 for(const [x,z,r] of [[-10,-4,0],[10,-4,0],[-10,5,0],[10,7,0]])wall(low,x,z,r);
 // props and sites
 place(fountain.clone(true),10,0,10,0,1);
 place(stall.clone(true),-10,0,9,Math.PI/2,1);
 place(crates.clone(true),7,0,7,0,1);place(crates.clone(true),-7,0,-9,Math.PI/2,1);
 place(barrel.clone(true),12,0,5,0,1);place(barrel.clone(true),-12,0,-6,0,1);
 place(tree.clone(true),13,0,12,0,1);place(tree.clone(true),-13,0,11,0,1);

 // invisible gameplay collision that matches the visual wall grid
 addCollider(0,-16,32,1);addCollider(0,16,32,1);addCollider(-16,0,1,32);addCollider(16,0,1,32);
 addCollider(-8,-8,4,1);addCollider(8,-8,4,1);addCollider(-4,0,1,4);addCollider(4,0,1,4);addCollider(-8,8,4,1);addCollider(8,8,4,1);
 addCollider(7,7,1.5,1.5);addCollider(-7,-9,1.5,1.5);addCollider(10,10,3.5,3.5);addCollider(-10,9,2.8,2);
 $("loadBar").style.width="62%";
}

async function loadCombatAssets(){
 $("loadText").textContent="Loading operators and weapon models…";
 const ctStand=await glbByTerms("ctStand","recon","operator","standing","aim");
 const ctRun=await glbByTerms("ctRun","recon","operator","running","pose");
 const tStand=await glbByTerms("tStand","desert","scout","standing","aim");
 const tRun=await glbByTerms("tRun","desert","scout","running","pose");
 const carbine=await glbByTerms("carbine","defender","carbine");
 const rifle=await glbByTerms("rifle","attacker","assault","rifle");
 cache.set("ctStand",ctStand);cache.set("ctRun",ctRun);cache.set("tStand",tStand);cache.set("tRun",tRun);
 cache.set("carbine",carbine);cache.set("rifle",rifle);
 $("loadBar").style.width="82%";
}
function normalizeModel(model,targetHeight=1.75){
 const box=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();box.getSize(size);
 const s=targetHeight/Math.max(.001,size.y);model.scale.setScalar(s);
 const box2=new THREE.Box3().setFromObject(model);model.position.y-=box2.min.y;
 return model;
}
function cloneCombat(key){return normalizeModel(cache.get(key).clone(true),1.75)}
function attachHitData(model,bot){
 model.traverse(o=>{if(o.isMesh){o.userData.bot=bot;rayTargets.push(o);o.castShadow=true;o.receiveShadow=true}});
}
function setupViewWeapon(){
 if(viewWeapon)camera.remove(viewWeapon);
 const key=team==="CT"?"carbine":"rifle";viewWeapon=cache.get(key).clone(true);setShadow(viewWeapon);
 // Model long axis is +Z in this pack, rotate it to face camera forward (-Z)
 viewWeapon.rotation.y=Math.PI;viewWeapon.rotation.x=.03;
 const box=new THREE.Box3().setFromObject(viewWeapon),size=new THREE.Vector3();box.getSize(size);
 const s=.72/Math.max(size.z,size.x,size.y);viewWeapon.scale.setScalar(s);
 viewWeapon.position.set(.28,-.27,-.58);camera.add(viewWeapon);
}

const siteA=new THREE.Vector3(10,0,10),siteB=new THREE.Vector3(-10,0,9);
const spawns={CT:new THREE.Vector3(-12,1.65,-12),T:new THREE.Vector3(12,1.65,12)};
function spawnBot(tm,name,pos){
 const key=tm==="CT"?"ctStand":"tStand",model=cloneCombat(key);model.position.copy(pos);model.rotation.y=tm==="CT"?0:Math.PI;scene.add(model);
 const bot={team:tm,name,pos:model.position,model,alive:true,hp:100,shot:.5+Math.random()*.5,target:null,moveT:0,running:false};
 attachHitData(model,bot);bots.push(bot);return bot;
}
function resetRound(){
 rayTargets=[];for(const b of bots)scene.remove(b.model);bots=[];roundEnding=false;bombPlanted=false;bombTimer=0;if(bomb?.model)scene.remove(bomb.model);bomb=null;roundTime=95;
 player={team,pos:spawns[team].clone(),yaw:team==="CT"?0:Math.PI,pitch:0,hp:100,armor:100,ammo:30,reserve:90,alive:true,vy:0,onGround:true,reloading:false,bob:0};
 camera.position.copy(player.pos);setupViewWeapon();
 spawnBot(team,"ALLY",spawns[team].clone().add(new THREE.Vector3(1.4,0,0)));
 const enemy=team==="CT"?"T":"CT";spawnBot(enemy,"ENEMY",spawns[enemy].clone().add(new THREE.Vector3(-1.4,0,0)));
 updateHUD();$("msg").textContent="";
}
function lineVisible(from,to){
 const d=to.clone().sub(from),dist=d.length();d.normalize();const ray=new THREE.Raycaster(from,d,0,dist-.25);
 const hits=ray.intersectObjects(scene.children,true).filter(h=>!h.object.userData.bot);
 return hits.length===0;
}
function showHit(){const h=$("hit");h.classList.remove("on");void h.offsetWidth;h.classList.add("on")}
function damageFlash(){const h=$("damage");h.classList.remove("on");void h.offsetWidth;h.classList.add("on")}
function killfeed(t){const e=document.createElement("div");e.textContent=t;$("killfeed").prepend(e);setTimeout(()=>e.remove(),2200)}
function hurtPlayer(d,who){if(!player.alive)return;const a=Math.min(player.armor,d*.45);player.armor-=a;player.hp-=d-a*.4;damageFlash();if(player.hp<=0){player.hp=0;player.alive=false;killfeed(who+" ▸ YOU");$("msg").textContent="ELIMINATED"}}
function hurtBot(b,d){if(!b.alive)return;b.hp-=d;showHit();if(b.hp<=0){b.hp=0;b.alive=false;killfeed("YOU ▸ "+b.name);$("msg").textContent="ENEMY DOWN";b.model.rotation.z=Math.PI/2;b.model.position.y=.15}}
function animateBotPose(bot,running){
 if(bot.running===running)return;bot.running=running;
 const old=bot.model,key=bot.team==="CT"?(running?"ctRun":"ctStand"):(running?"tRun":"tStand");
 const m=cloneCombat(key);m.position.copy(old.position);m.rotation.copy(old.rotation);scene.remove(old);bot.model=m;scene.add(m);
 rayTargets=rayTargets.filter(x=>x.userData.bot!==bot);attachHitData(m,bot);
}
function botAI(dt){
 for(const b of bots){if(!b.alive)continue;b.shot-=dt;const target=(player.alive&&player.team!==b.team)?player:null;
   if(target){
     const p=target.pos.clone(),dist=b.pos.distanceTo(p),vis=dist<15&&lineVisible(b.pos.clone().setY(1.35),p.clone().setY(1.35));
     const dir=p.clone().sub(b.pos);dir.y=0;
     if(vis&&dist<12){animateBotPose(b,false);b.model.rotation.y=Math.atan2(dir.x,dir.z);if(b.shot<=0){b.shot=.65+Math.random()*.45;hurtPlayer(9+Math.random()*8,b.name)}}
     else{animateBotPose(b,true);const goal=target.pos;dir.copy(goal).sub(b.pos);dir.y=0;if(dir.length()>.6){dir.normalize();movePos(b.pos,dir.x*dt*1.15,dir.z*dt*1.15,.24);b.model.rotation.y=Math.atan2(dir.x,dir.z)}}
   }else{
     const enemy=bots.find(o=>o!==b&&o.alive&&o.team!==b.team);if(enemy){const dir=enemy.pos.clone().sub(b.pos);dir.y=0;const dist=dir.length();if(dist>4){animateBotPose(b,true);dir.normalize();movePos(b.pos,dir.x*dt,dir.z*dt,.24);b.model.rotation.y=Math.atan2(dir.x,dir.z)}}
   }
 }
}
const shotRay=new THREE.Raycaster();
function shoot(){
 if(state!=="playing"||paused||!player.alive||player.reloading||roundEnding)return;
 const now=performance.now();if(now-lastShot<125)return;lastShot=now;if(player.ammo<=0)return reload();
 player.ammo--;if(viewWeapon)viewWeapon.userData.kick=1;
 shotRay.setFromCamera(new THREE.Vector2(0,0),camera);shotRay.far=40;
 const hits=shotRay.intersectObjects(rayTargets,false);
 if(hits.length){const bot=hits[0].object.userData.bot;if(bot&&bot.team!==player.team&&bot.alive)hurtBot(bot,38)}
 updateHUD();
}
function reload(){
 if(player.reloading||player.ammo===30||player.reserve<=0||!player.alive)return;player.reloading=true;$("msg").textContent="RELOADING";
 setTimeout(()=>{if(!player.reloading)return;const n=Math.min(30-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;player.reloading=false;$("msg").textContent="";updateHUD()},1050);
}
function plant(){
 bombPlanted=true;bombTimer=32;const g=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.30),new THREE.MeshStandardMaterial({color:0x28352d,roughness:.8}));g.add(body);const l=new THREE.PointLight(0xff342e,1,2);l.position.y=.2;g.add(l);g.position.copy(player.pos);g.position.y=.14;scene.add(g);bomb={pos:g.position.clone(),label:player.pos.distanceTo(siteA)<player.pos.distanceTo(siteB)?"A":"B",model:g};$("msg").textContent="BOMB PLANTED";
}
function useAction(){
 if(player.team==="T"&&!bombPlanted&&(player.pos.distanceTo(siteA)<3||player.pos.distanceTo(siteB)<3)){$("msg").textContent="PLANTING…";setTimeout(()=>{if(player.alive&&!bombPlanted)plant()},1700)}
 else if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3){$("msg").textContent="DEFUSING…";setTimeout(()=>{if(player.alive&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3)endRound("CT","BOMB DEFUSED")},3400)}
}
function alive(tm){return(player.alive&&player.team===tm?1:0)+bots.filter(b=>b.alive&&b.team===tm).length}
function endRound(tm,why){if(roundEnding)return;roundEnding=true;tm==="CT"?ctScore++:tScore++;$("msg").textContent=(tm==="CT"?"COUNTER-TERRORISTS":"TERRORISTS")+" WIN · "+why;setTimeout(resetRound,2000)}
function checkRound(){if(roundEnding)return;if(bombPlanted&&bombTimer<=0)return endRound("T","BOMB EXPLODED");if(!bombPlanted&&alive("T")===0)return endRound("CT","TEAM ELIMINATED");if(alive("CT")===0)return endRound("T","TEAM ELIMINATED");if(!bombPlanted&&roundTime<=0)return endRound("CT","TIME EXPIRED")}
function updateHUD(){
 $("hp").textContent=Math.max(0,Math.round(player.hp));$("armor").textContent=Math.max(0,Math.round(player.armor));$("ammo").textContent=player.ammo;$("reserve").textContent=player.reserve;$("ctScore").textContent=ctScore;$("tScore").textContent=tScore;
 const t=bombPlanted?bombTimer:roundTime,m=Math.max(0,Math.floor(t/60)),s=Math.max(0,Math.floor(t%60));$("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
 $("objective").textContent=bombPlanted?"BOMB PLANTED · SITE "+bomb.label:(player.team==="T"?"PLANT AT SITE A OR B":"DEFEND SITES A & B");
 let show=false;if(player.team==="T"&&!bombPlanted&&(player.pos.distanceTo(siteA)<3||player.pos.distanceTo(siteB)<3)){show=true;$("use").textContent="PLANT"}if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3){show=true;$("use").textContent="DEFUSE"}$("use").classList.toggle("hidden",!show);
}
function updateView(dt,moving){
 if(!viewWeapon)return;viewWeapon.userData.kick=Math.max(0,(viewWeapon.userData.kick||0)-dt*8);player.bob+=moving?dt*10:dt*2;
 const kick=viewWeapon.userData.kick||0;viewWeapon.position.x=.28+Math.sin(player.bob)*.009;viewWeapon.position.y=-.27-Math.abs(Math.cos(player.bob))*(moving?.01:0)+kick*.03;viewWeapon.position.z=-.58+kick*.08;
 viewWeapon.rotation.z=player.reloading?-.45*Math.sin(performance.now()/170):0;
}
function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener("resize",resize);

$("play").onclick=()=>{$("portal").classList.add("hidden");$("teamSelect").classList.remove("hidden")};
$("training").onclick=()=>{$("portal").classList.add("hidden");startMatch("CT")};
document.querySelectorAll("[data-team]").forEach(b=>b.onclick=()=>startMatch(b.dataset.team));
async function startMatch(tm){
 team=tm;$("teamSelect").classList.add("hidden");$("loading").classList.remove("hidden");$("loadBar").style.width="6%";
 try{
   if(!records.length){const res=await fetch(MANIFEST,{cache:"force-cache"});if(!res.ok)throw new Error("Manifest HTTP "+res.status);records=collect(await res.json())}
   await buildMap();await loadCombatAssets();
   $("loadBar").style.width="100%";$("loadText").textContent="Deploying…";
   setTimeout(()=>{$("loading").classList.add("hidden");$("hud").classList.remove("hidden");$("controls").classList.remove("hidden");state="playing";paused=false;ctScore=tScore=0;resetRound();clock.start()},250);
 }catch(e){console.error(e);fail("Could not load the tactical asset pack: "+e.message)}
}
$("reload").onpointerdown=e=>{e.preventDefault();reload()};$("jump").onpointerdown=e=>{e.preventDefault();if(player.onGround){player.vy=4.7;player.onGround=false}};$("use").onpointerdown=e=>{e.preventDefault();useAction()};
$("fire").onpointerdown=e=>{e.preventDefault();shoot();const iv=setInterval(shoot,125);const stop=()=>{clearInterval(iv);$("fire").removeEventListener("pointerup",stop);$("fire").removeEventListener("pointercancel",stop)};$("fire").addEventListener("pointerup",stop);$("fire").addEventListener("pointercancel",stop)};
$("menuBtn").onclick=()=>{paused=true;$("pause").classList.remove("hidden")};$("resume").onclick=()=>{paused=false;$("pause").classList.add("hidden");clock.getDelta()};$("leave").onclick=()=>{paused=false;state="menu";$("pause").classList.add("hidden");$("hud").classList.add("hidden");$("controls").classList.add("hidden");$("portal").classList.remove("hidden")};

const joy=$("joy"),stick=$("stick"),look=$("look");
function setJoy(x,y){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=x-cx,dy=y-cy,max=r.width*.33,l=Math.hypot(dx,dy)||1,k=Math.min(1,max/l);dx*=k;dy*=k;joyX=dx/max;joyY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
function stopJoy(){joyId=null;joyX=joyY=0;stick.style.transform="translate(0,0)"}
joy.onpointerdown=e=>{joyId=e.pointerId;joy.setPointerCapture?.(e.pointerId);setJoy(e.clientX,e.clientY)};joy.onpointermove=e=>{if(e.pointerId===joyId)setJoy(e.clientX,e.clientY)};joy.onpointerup=stopJoy;joy.onpointercancel=stopJoy;
look.onpointerdown=e=>{lookId=e.pointerId;lx=e.clientX;ly=e.clientY;look.setPointerCapture?.(e.pointerId)};look.onpointermove=e=>{if(e.pointerId!==lookId)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;player.yaw-=dx*.004;player.pitch-=dy*.003;player.pitch=Math.max(-1.1,Math.min(1,player.pitch))};look.onpointerup=()=>lookId=null;look.onpointercancel=()=>lookId=null;

["contextmenu","selectstart","dragstart","gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
document.addEventListener("touchmove",e=>{if(state==="playing")e.preventDefault()},{passive:false});
document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});

function loop(){
 requestAnimationFrame(loop);const dt=Math.min(.035,clock.getDelta()||.016);
 if(state==="playing"&&!paused&&!roundEnding){
   const moving=Math.abs(joyX)+Math.abs(joyY)>.06;
   if(player.alive){
     const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)),right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
     const d=forward.multiplyScalar(-joyY*3.4*dt).add(right.multiplyScalar(joyX*3.4*dt));movePos(player.pos,d.x,d.z,.28);
     player.vy-=11.5*dt;player.pos.y+=player.vy*dt;if(player.pos.y<=1.65){player.pos.y=1.65;player.vy=0;player.onGround=true}
   }
   camera.position.copy(player.pos);camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
   if(bombPlanted)bombTimer-=dt;else roundTime-=dt;botAI(dt);checkRound();updateView(dt,moving);updateHUD();
 }
 renderer.render(scene,camera);
}
loop();

async function boot(){
 try{
   $("bootBar").style.width="20%";$("bootText").textContent="Connecting to tactical asset library…";
   const res=await fetch(MANIFEST,{cache:"force-cache"});if(!res.ok)throw new Error("Manifest HTTP "+res.status);
   records=collect(await res.json());if(records.length<20)throw new Error("Asset manifest did not contain enough GLB models.");
   $("bootBar").style.width="100%";$("bootText").textContent="Ready";
   setTimeout(()=>{$("boot").classList.add("hidden");$("portal").classList.remove("hidden");state="menu"},220);
 }catch(e){console.error(e);fail("Could not initialize Hobile assets: "+e.message)}
}
boot();
