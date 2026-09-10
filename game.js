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
renderer.toneMappingExposure=1.05;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9fb4bc);
scene.fog=new THREE.Fog(0x9fb4bc,28,72);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,120);
camera.rotation.order="YXZ";
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xe0eff3,0x62503e,1.5));
const sun=new THREE.DirectionalLight(0xffe7c6,1.55);
sun.position.set(19,29,13);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;
scene.add(sun);

const loader=new GLTFLoader(), clock=new THREE.Clock();
let pack=null, nodeIndex=[], cache={};
let colliders=[], bots=[], rayTargets=[], viewWeapon=null;
let state="boot",paused=false,team="CT",ctScore=0,tScore=0,roundTime=95,roundEnding=false,lastShot=0;
let bombPlanted=false,bombTimer=0,bomb=null,player=null;
let joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;

function fail(text){
  $("boot").classList.add("hidden");
  $("loading").classList.add("hidden");
  $("fatalText").textContent=text;
  $("fatal").classList.remove("hidden");
}
async function loadGLB(url){
  return (await loader.loadAsync(url)).scene;
}
function shadowize(root){
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
  return root;
}
function indexPack(root){
  nodeIndex=[];
  root.traverse(o=>{
    const n=String(o.name||"").trim().toLowerCase();
    if(n) nodeIndex.push({name:n,obj:o});
  });
}
function findNode(...terms){
  const t=terms.map(x=>x.toLowerCase());
  let r=nodeIndex.find(x=>t.every(k=>x.name.includes(k)));
  return r?.obj || null;
}
function cloneNamed(termSets){
  for(const terms of termSets){
    const n=findNode(...terms);
    if(n) return shadowize(n.clone(true));
  }
  return null;
}
function normalize(model,height=1.72){
  const b=new THREE.Box3().setFromObject(model),s=new THREE.Vector3();
  b.getSize(s);
  const k=height/Math.max(.001,s.y);
  model.scale.multiplyScalar(k);
  const b2=new THREE.Box3().setFromObject(model);
  model.position.y-=b2.min.y;
  return model;
}
function place(model,x,y,z,ry=0,scale=1){
  if(!model)return null;
  model.position.set(x,y,z);model.rotation.y=ry;model.scale.multiplyScalar(scale);
  shadowize(model);scene.add(model);return model;
}
function addCollider(x,z,w,d,h=3.7){
  colliders.push(new THREE.Box3(
    new THREE.Vector3(x-w/2,0,z-d/2),
    new THREE.Vector3(x+w/2,h,z+d/2)
  ));
}
function collides(pos,r=.27){
  const p=new THREE.Box3(
    new THREE.Vector3(pos.x-r,.1,pos.z-r),
    new THREE.Vector3(pos.x+r,1.9,pos.z+r)
  );
  return colliders.some(c=>c.intersectsBox(p));
}
function movePos(pos,dx,dz,r=.27){
  let p=pos.clone();p.x+=dx;if(!collides(p,r))pos.x=p.x;
  p=pos.clone();p.z+=dz;if(!collides(p,r))pos.z=p.z;
}

async function prepareAssets(){
  $("bootText").textContent="Loading tactical 3D pack through Hobile…";
  $("bootBar").style.width="20%";
  pack=await loadGLB("/api/asset?name=pack");
  indexPack(pack);
  $("bootBar").style.width="55%";

  cache.floor=cloneNamed([
    ["cobbled","ground"],["stone","floor"],["floor","tile"]
  ]);
  cache.plaster=cloneNamed([
    ["plaster","wall"],["wall","bay"]
  ]);
  cache.ochre=cloneNamed([
    ["ochre","wall"]
  ]) || cache.plaster?.clone(true);
  cache.arch=cloneNamed([
    ["arched","passage"],["stone","archway"],["arch"]
  ]);
  cache.low=cloneNamed([
    ["low","garden","wall"],["garden","wall"]
  ]);
  cache.fountain=cloneNamed([["fountain"]]);
  cache.stall=cloneNamed([["market","stall"],["stall"]]);
  cache.crates=cloneNamed([["timber","crate"],["crate","stack"],["crate"]]);
  cache.barrel=cloneNamed([["wine","barrel"],["barrel"]]);
  cache.tree=cloneNamed([["olive","tree"],["potted","olive"]]);

  cache.carbine=cloneNamed([["defender","carbine"],["carbine"]]);
  cache.rifle=cloneNamed([["attacker","assault","rifle"],["assault","rifle"]]);
  cache.ct=cloneNamed([["recon","operator","standing"],["assault","trooper","standing"]]);
  cache.t=cloneNamed([["desert","scout","standing"],["desert","scout","crouch"]]);

  // The pack scene may not preserve asset group names. These two direct models are
  // known permanent CDN assets and are proxied through the same Vercel origin.
  if(!cache.ct) cache.ct=await loadGLB("/api/asset?name=ct");
  if(!cache.t) cache.t=await loadGLB("/api/asset?name=t");

  $("bootBar").style.width="100%";
}

function fallbackMaterial(color){
  return new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.08});
}
function fallbackWall(color=0xb18d62){
  const g=new THREE.Group();
  const wall=new THREE.Mesh(new THREE.BoxGeometry(4,3.5,.36),fallbackMaterial(color));
  g.add(wall);
  const trim=new THREE.Mesh(new THREE.BoxGeometry(4.05,.15,.42),fallbackMaterial(0x6e5b48));
  trim.position.y=1.62;g.add(trim);
  return g;
}
function fallbackFloor(){
  const m=new THREE.Mesh(new THREE.BoxGeometry(4,.12,4),fallbackMaterial(0x796b5b));
  return m;
}
function fallbackCrate(){
  const g=new THREE.Group(),mat=fallbackMaterial(0x76502e);
  for(let i=0;i<3;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.8,.9),mat);
    b.position.set((i%2)*.92,Math.floor(i/2)*.82,0);g.add(b);
  }
  return g;
}
function ensureEnvironmentFallbacks(){
  cache.floor ||= fallbackFloor();
  cache.plaster ||= fallbackWall(0xc2aa82);
  cache.ochre ||= fallbackWall(0xc58b50);
  cache.arch ||= fallbackWall(0xa98764);
  cache.low ||= (()=>{const m=new THREE.Mesh(new THREE.BoxGeometry(4,.85,.42),fallbackMaterial(0x9c866a));return m})();
  cache.crates ||= fallbackCrate();
}

function clearMapObjects(){
  [...scene.children].forEach(o=>{
    if(o.userData.mapPiece) scene.remove(o);
  });
  colliders=[];
}
function mapPiece(model,x,y,z,ry=0,scale=1,collider=null){
  if(!model)return;
  const m=model.clone(true);m.userData.mapPiece=true;
  place(m,x,y,z,ry,scale);
  if(collider)addCollider(x,z,collider[0],collider[1],collider[2]||3.7);
}
function buildMap(){
  clearMapObjects();ensureEnvironmentFallbacks();

  for(let x=-14;x<=14;x+=4)for(let z=-14;z<=14;z+=4)
    mapPiece(cache.floor,x,-.06,z,0,1,null);

  // Perimeter, with actual modular wall assets.
  for(let x=-14;x<=14;x+=4){
    mapPiece((x/4)%2?cache.plaster:cache.ochre,x,1.75,-16,0,1,[4,.5]);
    mapPiece((x/4)%2?cache.ochre:cache.plaster,x,1.75,16,Math.PI,1,[4,.5]);
  }
  for(let z=-12;z<=12;z+=4){
    mapPiece(cache.plaster,-16,1.75,z,Math.PI/2,1,[.5,4]);
    mapPiece(cache.ochre,16,1.75,z,-Math.PI/2,1,[.5,4]);
  }

  // Tactical lanes / connectors.
  mapPiece(cache.arch,-4,1.75,-7,0,1,[4,.5]);
  mapPiece(cache.arch,7,1.75,2,Math.PI/2,1,[.5,4]);
  mapPiece(cache.arch,-7,1.75,5,Math.PI/2,1,[.5,4]);
  mapPiece(cache.plaster,4,1.75,-7,0,1,[4,.5]);
  mapPiece(cache.ochre,4,1.75,8,Math.PI,1,[4,.5]);
  mapPiece(cache.plaster,-4,1.75,8,Math.PI,1,[4,.5]);
  mapPiece(cache.low,10,.44,-3,0,1,[4,.6,1]);
  mapPiece(cache.low,-10,.44,1,0,1,[4,.6,1]);

  mapPiece(cache.crates,8,0,8,0,1,[2,2,1.7]);
  mapPiece(cache.crates,-9,0,-9,Math.PI/2,1,[2,2,1.7]);
  mapPiece(cache.fountain,11,0,10,0,1,[3.6,3.6,2.5]);
  mapPiece(cache.stall,-11,0,9,Math.PI/2,1,[3,2,3]);
  mapPiece(cache.barrel,12,0,-5,0,1,[1,1,1.2]);
  mapPiece(cache.tree,-12,0,11,0,1,[2,2,2.5]);

  // Invisible limits for the main lanes.
  addCollider(-2,-7,8,.5);addCollider(3,8,8,.5);
}

const spawn={CT:new THREE.Vector3(-12,1.65,-12),T:new THREE.Vector3(12,1.65,12)};
const siteA=new THREE.Vector3(11,0,10),siteB=new THREE.Vector3(-11,0,9);

function cloneOperator(tm){
  const source=tm==="CT"?cache.ct:cache.t;
  const m=source.clone(true);
  normalize(m,tm==="CT"?1.76:1.72);
  shadowize(m);
  return m;
}
function makeFallbackWeapon(){
  const g=new THREE.Group(),dark=fallbackMaterial(0x192125),metal=fallbackMaterial(0x39464a);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.11,.12,.52),metal);g.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.48,10),dark);barrel.rotation.x=Math.PI/2;barrel.position.z=-.45;g.add(barrel);
  const mag=new THREE.Mesh(new THREE.BoxGeometry(.09,.24,.12),dark);mag.position.set(0,-.16,-.02);mag.rotation.x=-.15;g.add(mag);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,.15),dark);sight.position.set(0,.10,-.08);g.add(sight);
  return g;
}
function setupViewWeapon(){
  if(viewWeapon)camera.remove(viewWeapon);
  let src=team==="CT"?cache.carbine:cache.rifle;
  viewWeapon=(src?src.clone(true):makeFallbackWeapon());
  shadowize(viewWeapon);
  const b=new THREE.Box3().setFromObject(viewWeapon),s=new THREE.Vector3();b.getSize(s);
  const k=.72/Math.max(.001,s.z,s.x,s.y);
  viewWeapon.scale.multiplyScalar(k);
  viewWeapon.rotation.y=Math.PI;
  viewWeapon.position.set(.30,-.28,-.58);
  camera.add(viewWeapon);
}

function spawnBot(tm,name,pos){
  const model=cloneOperator(tm);
  model.position.copy(pos);model.rotation.y=tm==="CT"?0:Math.PI;
  scene.add(model);
  const b={team:tm,name,model,pos:model.position,hp:100,alive:true,shot:.55+Math.random()*.5};
  model.traverse(o=>{if(o.isMesh){o.userData.bot=b;rayTargets.push(o)}});
  bots.push(b);
}
function resetRound(){
  for(const b of bots)scene.remove(b.model);
  bots=[];rayTargets=[];roundEnding=false;bombPlanted=false;bombTimer=0;roundTime=95;
  if(bomb?.model)scene.remove(bomb.model);bomb=null;
  player={team,pos:spawn[team].clone(),yaw:team==="CT"?0:Math.PI,pitch:0,hp:100,armor:100,ammo:30,reserve:90,alive:true,vy:0,onGround:true,reloading:false,bob:0};
  camera.position.copy(player.pos);setupViewWeapon();
  spawnBot(team,"ALLY",spawn[team].clone().add(new THREE.Vector3(1.6,0,0)));
  const enemy=team==="CT"?"T":"CT";
  spawnBot(enemy,"ENEMY",spawn[enemy].clone().add(new THREE.Vector3(-1.6,0,0)));
  $("msg").textContent="";updateHUD();
}
function visible(from,to){
  const dir=to.clone().sub(from),dist=dir.length();dir.normalize();
  const ray=new THREE.Raycaster(from,dir,0,dist-.2);
  const h=ray.intersectObjects(scene.children,true).filter(x=>!x.object.userData.bot);
  return h.length===0;
}
function addKill(t){const e=document.createElement("div");e.textContent=t;$("killfeed").prepend(e);setTimeout(()=>e.remove(),2200)}
function flash(id,cls){const e=$(id);e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls)}
function hurtPlayer(d,who){
  if(!player.alive)return;
  const a=Math.min(player.armor,d*.45);player.armor-=a;player.hp-=d-a*.4;flash("damage","on");
  if(player.hp<=0){player.hp=0;player.alive=false;addKill(who+" ▸ YOU");$("msg").textContent="ELIMINATED"}
}
function hurtBot(b,d){
  if(!b.alive)return;b.hp-=d;flash("hit","on");
  if(b.hp<=0){b.hp=0;b.alive=false;addKill("YOU ▸ "+b.name);$("msg").textContent="ENEMY DOWN";b.model.rotation.z=Math.PI/2;b.model.position.y=.15}
}
function botAI(dt){
  for(const b of bots){
    if(!b.alive)continue;b.shot-=dt;
    const target=(player.alive&&player.team!==b.team)?player:null;
    if(!target)continue;
    const d=b.pos.distanceTo(target.pos),dir=target.pos.clone().sub(b.pos);dir.y=0;
    const vis=d<14&&visible(b.pos.clone().setY(1.35),target.pos.clone().setY(1.35));
    if(vis&&d<11){
      b.model.rotation.y=Math.atan2(dir.x,dir.z);
      if(b.shot<=0){b.shot=.65+Math.random()*.45;hurtPlayer(8+Math.random()*8,b.name)}
    }else if(d>.8){
      dir.normalize();movePos(b.pos,dir.x*dt*1.05,dir.z*dt*1.05,.24);b.model.rotation.y=Math.atan2(dir.x,dir.z);
    }
  }
}

const shotRay=new THREE.Raycaster();
function shoot(){
  if(state!=="playing"||paused||!player.alive||player.reloading||roundEnding)return;
  const now=performance.now();if(now-lastShot<125)return;lastShot=now;
  if(player.ammo<=0)return reload();
  player.ammo--;
  if(viewWeapon)viewWeapon.userData.kick=1;
  shotRay.setFromCamera(new THREE.Vector2(0,0),camera);shotRay.far=40;
  const hits=shotRay.intersectObjects(rayTargets,false);
  if(hits.length){
    const b=hits[0].object.userData.bot;
    if(b&&b.team!==player.team&&b.alive)hurtBot(b,38);
  }
  updateHUD();
}
function reload(){
  if(player.reloading||player.ammo===30||player.reserve<=0||!player.alive)return;
  player.reloading=true;$("msg").textContent="RELOADING";
  setTimeout(()=>{
    if(!player.reloading)return;
    const n=Math.min(30-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;player.reloading=false;$("msg").textContent="";updateHUD();
  },1050);
}
function plant(){
  bombPlanted=true;bombTimer=32;
  const m=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.30),new THREE.MeshStandardMaterial({color:0x26352d,roughness:.8}));
  m.position.copy(player.pos);m.position.y=.15;scene.add(m);
  bomb={pos:m.position.clone(),label:player.pos.distanceTo(siteA)<player.pos.distanceTo(siteB)?"A":"B",model:m};
  $("msg").textContent="BOMB PLANTED";
}
function useAction(){
  if(player.team==="T"&&!bombPlanted&&(player.pos.distanceTo(siteA)<3||player.pos.distanceTo(siteB)<3)){
    $("msg").textContent="PLANTING…";
    setTimeout(()=>{if(player.alive&&!bombPlanted)plant()},1700);
  }else if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3){
    $("msg").textContent="DEFUSING…";
    setTimeout(()=>{if(player.alive&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3)endRound("CT","BOMB DEFUSED")},3400);
  }
}
function alive(tm){return(player.alive&&player.team===tm?1:0)+bots.filter(b=>b.alive&&b.team===tm).length}
function endRound(tm,why){
  if(roundEnding)return;roundEnding=true;tm==="CT"?ctScore++:tScore++;
  $("msg").textContent=(tm==="CT"?"COUNTER-TERRORISTS":"TERRORISTS")+" WIN · "+why;
  setTimeout(resetRound,2000);
}
function checkRound(){
  if(roundEnding)return;
  if(bombPlanted&&bombTimer<=0)return endRound("T","BOMB EXPLODED");
  if(!bombPlanted&&alive("T")===0)return endRound("CT","TEAM ELIMINATED");
  if(alive("CT")===0)return endRound("T","TEAM ELIMINATED");
  if(!bombPlanted&&roundTime<=0)return endRound("CT","TIME EXPIRED");
}
function updateHUD(){
  $("hp").textContent=Math.max(0,Math.round(player.hp));$("armor").textContent=Math.max(0,Math.round(player.armor));
  $("ammo").textContent=player.ammo;$("reserve").textContent=player.reserve;$("ctScore").textContent=ctScore;$("tScore").textContent=tScore;
  const t=bombPlanted?bombTimer:roundTime,m=Math.max(0,Math.floor(t/60)),s=Math.max(0,Math.floor(t%60));
  $("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
  $("objective").textContent=bombPlanted?"BOMB PLANTED · SITE "+bomb.label:(player.team==="T"?"PLANT AT SITE A OR B":"DEFEND SITES A & B");
  let show=false;
  if(player.team==="T"&&!bombPlanted&&(player.pos.distanceTo(siteA)<3||player.pos.distanceTo(siteB)<3)){show=true;$("use").textContent="PLANT"}
  if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3){show=true;$("use").textContent="DEFUSE"}
  $("use").classList.toggle("hidden",!show);
}
function updateView(dt,moving){
  if(!viewWeapon)return;
  viewWeapon.userData.kick=Math.max(0,(viewWeapon.userData.kick||0)-dt*8);
  player.bob+=moving?dt*10:dt*2;
  const k=viewWeapon.userData.kick||0;
  viewWeapon.position.x=.30+Math.sin(player.bob)*.009;
  viewWeapon.position.y=-.28-Math.abs(Math.cos(player.bob))*(moving?.01:0)+k*.03;
  viewWeapon.position.z=-.58+k*.08;
  viewWeapon.rotation.z=player.reloading?-.4*Math.sin(performance.now()/170):0;
}
function resize(){
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.35));renderer.setSize(innerWidth,innerHeight,false);
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
}
addEventListener("resize",resize);

async function boot(){
  try{
    await prepareAssets();
    $("bootText").textContent="Ready";
    setTimeout(()=>{$("boot").classList.add("hidden");$("portal").classList.remove("hidden");state="menu"},180);
  }catch(e){
    console.error(e);
    fail("Hobile could not load the local asset proxy: "+e.message);
  }
}
async function startMatch(tm){
  team=tm;$("teamSelect").classList.add("hidden");$("loading").classList.remove("hidden");
  $("loadText").textContent="Building Hill Town…";$("loadBar").style.width="20%";
  try{
    buildMap();$("loadBar").style.width="80%";$("loadText").textContent="Spawning operators…";
    setTimeout(()=>{$("loadBar").style.width="100%";setTimeout(()=>{
      $("loading").classList.add("hidden");$("hud").classList.remove("hidden");$("controls").classList.remove("hidden");
      state="playing";paused=false;ctScore=tScore=0;resetRound();clock.start();
    },180)},180);
  }catch(e){console.error(e);fail("Map build failed: "+e.message)}
}

$("play").onclick=()=>{$("portal").classList.add("hidden");$("teamSelect").classList.remove("hidden")};
$("training").onclick=()=>{$("portal").classList.add("hidden");startMatch("CT")};
document.querySelectorAll("[data-team]").forEach(b=>b.onclick=()=>startMatch(b.dataset.team));
$("reload").onpointerdown=e=>{e.preventDefault();reload()};
$("jump").onpointerdown=e=>{e.preventDefault();if(player.onGround){player.vy=4.7;player.onGround=false}};
$("use").onpointerdown=e=>{e.preventDefault();useAction()};
$("fire").onpointerdown=e=>{
  e.preventDefault();shoot();const iv=setInterval(shoot,125);
  const stop=()=>{clearInterval(iv);$("fire").removeEventListener("pointerup",stop);$("fire").removeEventListener("pointercancel",stop)};
  $("fire").addEventListener("pointerup",stop);$("fire").addEventListener("pointercancel",stop);
};
$("menuBtn").onclick=()=>{paused=true;$("pause").classList.remove("hidden")};
$("resume").onclick=()=>{paused=false;$("pause").classList.add("hidden");clock.getDelta()};
$("leave").onclick=()=>{paused=false;state="menu";$("pause").classList.add("hidden");$("hud").classList.add("hidden");$("controls").classList.add("hidden");$("portal").classList.remove("hidden")};

const joy=$("joy"),stick=$("stick"),look=$("look");
function setJoy(x,y){
  const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=x-cx,dy=y-cy,max=r.width*.33,l=Math.hypot(dx,dy)||1,k=Math.min(1,max/l);dx*=k;dy*=k;
  joyX=dx/max;joyY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`;
}
function stopJoy(){joyId=null;joyX=joyY=0;stick.style.transform="translate(0,0)"}
joy.onpointerdown=e=>{joyId=e.pointerId;joy.setPointerCapture?.(e.pointerId);setJoy(e.clientX,e.clientY)};
joy.onpointermove=e=>{if(e.pointerId===joyId)setJoy(e.clientX,e.clientY)};
joy.onpointerup=stopJoy;joy.onpointercancel=stopJoy;

look.onpointerdown=e=>{lookId=e.pointerId;lx=e.clientX;ly=e.clientY;look.setPointerCapture?.(e.pointerId)};
look.onpointermove=e=>{
  if(e.pointerId!==lookId)return;
  const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;
  player.yaw-=dx*.004;player.pitch-=dy*.003;player.pitch=Math.max(-1.1,Math.min(1,player.pitch));
};
look.onpointerup=()=>lookId=null;look.onpointercancel=()=>lookId=null;

["contextmenu","selectstart","dragstart","gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));
document.addEventListener("touchmove",e=>{if(state==="playing")e.preventDefault()},{passive:false});
document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});

function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(.035,clock.getDelta()||.016);
  if(state==="playing"&&!paused&&!roundEnding){
    const moving=Math.abs(joyX)+Math.abs(joyY)>.06;
    if(player.alive){
      const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
      const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
      const d=forward.multiplyScalar(-joyY*3.4*dt).add(right.multiplyScalar(joyX*3.4*dt));
      movePos(player.pos,d.x,d.z,.27);
      player.vy-=11.5*dt;player.pos.y+=player.vy*dt;
      if(player.pos.y<=1.65){player.pos.y=1.65;player.vy=0;player.onGround=true}
    }
    camera.position.copy(player.pos);camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
    if(bombPlanted)bombTimer-=dt;else roundTime-=dt;
    botAI(dt);checkRound();updateView(dt,moving);updateHUD();
  }
  renderer.render(scene,camera);
}
loop();
boot();

window.__hobileDebug={
  assetNames:()=>nodeIndex.slice(0,200).map(x=>x.name),
  state:()=>({state,team,ctScore,tScore,player:player?{x:player.pos.x,z:player.pos.z,hp:player.hp,ammo:player.ammo}:null,bots:bots.map(b=>({team:b.team,hp:b.hp,alive:b.alive,x:b.pos.x,z:b.pos.z}))})
};
