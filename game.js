import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const $=id=>document.getElementById(id);
const canvas=$("game");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.3));
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
camera.rotation.order="YXZ"; scene.add(camera);
scene.add(new THREE.HemisphereLight(0xe0eff3,0x62503e,1.5));
const sun=new THREE.DirectionalLight(0xffe7c6,1.55);
sun.position.set(19,29,13);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-32;sun.shadow.camera.right=32;sun.shadow.camera.top=32;sun.shadow.camera.bottom=-32;scene.add(sun);

const loader=new GLTFLoader(),clock=new THREE.Clock(),net=new window.HobileRoom(),NC=window.HobileNetCore;
let pack=null,nodeIndex=[],cache={},colliders=[],localBots=[],rayTargets=[],remoteActors=new Map(),viewWeapon=null,mapBuilt=false;
let mode="menu",paused=false,team="CT",ctScore=0,tScore=0,roundTime=95,roundEnding=false,lastShot=0;
let bombPlanted=false,bombTimer=0,bomb=null,player=null,joyX=0,joyY=0,joyId=null,lookId=null,lx=0,ly=0;
let online=false,hostRoundEndAt=0,hostBombEndAt=0,lastNetSend=0,lastHostRoundSend=0,peerStates=new Map(),authoritativeHp=new Map();

function fail(text){$("boot").classList.add("hidden");$("loading").classList.add("hidden");$("fatalText").textContent=text;$("fatal").classList.remove("hidden")}
async function loadGLB(url){return (await loader.loadAsync(url)).scene}
function shadowize(root){root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return root}
function indexPack(root){nodeIndex=[];root.traverse(o=>{const n=String(o.name||"").trim().toLowerCase();if(n)nodeIndex.push({name:n,obj:o})})}
function findNode(...terms){const t=terms.map(x=>x.toLowerCase());return nodeIndex.find(x=>t.every(k=>x.name.includes(k)))?.obj||null}
function cloneNamed(sets){for(const terms of sets){const n=findNode(...terms);if(n)return shadowize(n.clone(true))}return null}
function normalize(model,height=1.72){const b=new THREE.Box3().setFromObject(model),s=new THREE.Vector3();b.getSize(s);model.scale.multiplyScalar(height/Math.max(.001,s.y));const b2=new THREE.Box3().setFromObject(model);model.position.y-=b2.min.y;return model}
function place(model,x,y,z,ry=0,scale=1){if(!model)return null;model.position.set(x,y,z);model.rotation.y=ry;model.scale.multiplyScalar(scale);shadowize(model);scene.add(model);return model}
function addCollider(x,z,w,d,h=3.7){colliders.push(new THREE.Box3(new THREE.Vector3(x-w/2,0,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)))}
function collides(pos,r=.27){const p=new THREE.Box3(new THREE.Vector3(pos.x-r,.1,pos.z-r),new THREE.Vector3(pos.x+r,1.9,pos.z+r));return colliders.some(c=>c.intersectsBox(p))}
function movePos(pos,dx,dz,r=.27){let p=pos.clone();p.x+=dx;if(!collides(p,r))pos.x=p.x;p=pos.clone();p.z+=dz;if(!collides(p,r))pos.z=p.z}

async function prepareAssets(){
 $("bootText").textContent="Loading Hobile 3D assets…";$("bootBar").style.width="20%";
 pack=await loadGLB("/api/asset?name=pack"); indexPack(pack); $("bootBar").style.width="50%";
 cache.floor=cloneNamed([["cobbled","ground"],["stone","floor"],["floor","tile"]]);
 cache.plaster=cloneNamed([["plaster","wall"],["wall","bay"]]);
 cache.ochre=cloneNamed([["ochre","wall"]])||cache.plaster?.clone(true);
 cache.arch=cloneNamed([["arched","passage"],["stone","archway"],["arch"]]);
 cache.low=cloneNamed([["low","garden","wall"],["garden","wall"]]);
 cache.fountain=cloneNamed([["fountain"]]);cache.stall=cloneNamed([["market","stall"],["stall"]]);
 cache.crates=cloneNamed([["timber","crate"],["crate","stack"],["crate"]]);cache.barrel=cloneNamed([["wine","barrel"],["barrel"]]);cache.tree=cloneNamed([["olive","tree"],["potted","olive"]]);
 cache.carbine=cloneNamed([["defender","carbine"],["carbine"]]);cache.rifle=cloneNamed([["attacker","assault","rifle"],["assault","rifle"]]);
 cache.ct=cloneNamed([["recon","operator","standing"],["assault","trooper","standing"]]);cache.t=cloneNamed([["desert","scout","standing"],["desert","scout","crouch"]]);
 if(!cache.ct)cache.ct=await loadGLB("/api/asset?name=ct"); if(!cache.t)cache.t=await loadGLB("/api/asset?name=t");
 $("bootBar").style.width="100%";
}
function mat(color){return new THREE.MeshStandardMaterial({color,roughness:.8,metalness:.05})}
function fallbackWall(color=0xb18d62){const g=new THREE.Group(),w=new THREE.Mesh(new THREE.BoxGeometry(4,3.5,.36),mat(color));g.add(w);return g}
function fallbackFloor(){return new THREE.Mesh(new THREE.BoxGeometry(4,.12,4),mat(0x796b5b))}
function fallbackCrate(){const g=new THREE.Group();for(let i=0;i<3;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.8,.9),mat(0x76502e));b.position.set((i%2)*.92,Math.floor(i/2)*.82,0);g.add(b)}return g}
function ensureFallbacks(){cache.floor||=fallbackFloor();cache.plaster||=fallbackWall(0xc2aa82);cache.ochre||=fallbackWall(0xc58b50);cache.arch||=fallbackWall(0xa98764);cache.low||=new THREE.Mesh(new THREE.BoxGeometry(4,.85,.42),mat(0x9c866a));cache.crates||=fallbackCrate()}
function mapPiece(model,x,y,z,ry=0,scale=1,box=null){const m=model?.clone(true);if(!m)return;m.userData.mapPiece=true;place(m,x,y,z,ry,scale);if(box)addCollider(x,z,box[0],box[1],box[2]||3.7)}
function buildMap(){
 if(mapBuilt)return;mapBuilt=true;ensureFallbacks();colliders=[];
 for(let x=-14;x<=14;x+=4)for(let z=-14;z<=14;z+=4)mapPiece(cache.floor,x,-.06,z);
 for(let x=-14;x<=14;x+=4){mapPiece((x/4)%2?cache.plaster:cache.ochre,x,1.75,-16,0,1,[4,.5]);mapPiece((x/4)%2?cache.ochre:cache.plaster,x,1.75,16,Math.PI,1,[4,.5])}
 for(let z=-12;z<=12;z+=4){mapPiece(cache.plaster,-16,1.75,z,Math.PI/2,1,[.5,4]);mapPiece(cache.ochre,16,1.75,z,-Math.PI/2,1,[.5,4])}
 mapPiece(cache.arch,-4,1.75,-7,0,1,[4,.5]);mapPiece(cache.arch,7,1.75,2,Math.PI/2,1,[.5,4]);mapPiece(cache.arch,-7,1.75,5,Math.PI/2,1,[.5,4]);
 mapPiece(cache.plaster,4,1.75,-7,0,1,[4,.5]);mapPiece(cache.ochre,4,1.75,8,Math.PI,1,[4,.5]);mapPiece(cache.plaster,-4,1.75,8,Math.PI,1,[4,.5]);
 mapPiece(cache.low,10,.44,-3,0,1,[4,.6,1]);mapPiece(cache.low,-10,.44,1,0,1,[4,.6,1]);
 mapPiece(cache.crates,8,0,8,0,1,[2,2,1.7]);mapPiece(cache.crates,-9,0,-9,Math.PI/2,1,[2,2,1.7]);
 mapPiece(cache.fountain,11,0,10,0,1,[3.6,3.6,2.5]);mapPiece(cache.stall,-11,0,9,Math.PI/2,1,[3,2,3]);mapPiece(cache.barrel,12,0,-5,0,1,[1,1,1.2]);mapPiece(cache.tree,-12,0,11,0,1,[2,2,2.5]);
 addCollider(-2,-7,8,.5);addCollider(3,8,8,.5);
}
const spawn={CT:new THREE.Vector3(-12,1.65,-12),T:new THREE.Vector3(12,1.65,12)},siteA=new THREE.Vector3(11,0,10),siteB=new THREE.Vector3(-11,0,9);
function cloneOperator(tm){const m=(tm==="CT"?cache.ct:cache.t).clone(true);normalize(m,tm==="CT"?1.76:1.72);shadowize(m);return m}
function fallbackWeapon(){const g=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.11,.12,.52),mat(0x39464a));g.add(body);const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.48,8),mat(0x172025));barrel.rotation.x=Math.PI/2;barrel.position.z=-.45;g.add(barrel);return g}
function setupViewWeapon(){if(viewWeapon)camera.remove(viewWeapon);const src=team==="CT"?cache.carbine:cache.rifle;viewWeapon=src?src.clone(true):fallbackWeapon();shadowize(viewWeapon);const b=new THREE.Box3().setFromObject(viewWeapon),s=new THREE.Vector3();b.getSize(s);viewWeapon.scale.multiplyScalar(.72/Math.max(.001,s.z,s.x,s.y));viewWeapon.rotation.y=Math.PI;viewWeapon.position.set(.30,-.28,-.58);camera.add(viewWeapon)}

function makeActorModel(tm,id,isRemote=true){
 const model=cloneOperator(tm);model.userData.playerId=id;model.userData.team=tm;scene.add(model);
 if(isRemote)model.traverse(o=>{if(o.isMesh){o.userData.playerId=id;o.userData.team=tm;rayTargets.push(o)}});
 return model;
}
function clearActors(){
 for(const b of localBots)scene.remove(b.model);localBots=[];for(const a of remoteActors.values())scene.remove(a.model);remoteActors.clear();rayTargets=[];
}
function spawnTrainingBot(tm,name,pos){const model=makeActorModel(tm,name,true);model.position.copy(pos);const b={team:tm,name,id:name,model,pos:model.position,hp:100,alive:true,shot:.55+Math.random()*.5};model.traverse(o=>{if(o.isMesh)o.userData.bot=b});localBots.push(b);return b}
function spawnLocalPlayer(){const base=spawn[team].clone();const n=online?Array.from(net.id).reduce((a,c)=>a+c.charCodeAt(0),0)%3:0;base.x+=(n-1)*.55;return {id:online?net.id:"local",team,pos:base,yaw:team==="CT"?0:Math.PI,pitch:0,hp:100,armor:100,ammo:30,reserve:90,alive:true,vy:0,onGround:true,reloading:false,bob:0}}
function resetRound(){
 clearActors();roundEnding=false;bombPlanted=false;bombTimer=0;roundTime=95;if(bomb?.model)scene.remove(bomb.model);bomb=null;player=spawnLocalPlayer();camera.position.copy(player.pos);setupViewWeapon();authoritativeHp.set(player.id,100);
 if(online){syncRemoteActors(net.players); if(net.isHost()){hostRoundEndAt=Date.now()+95000;hostBombEndAt=0}}
 else{spawnTrainingBot(team,"ALLY",spawn[team].clone().add(new THREE.Vector3(1.5,0,0)));const enemy=team==="CT"?"T":"CT";spawnTrainingBot(enemy,"ENEMY",spawn[enemy].clone().add(new THREE.Vector3(-1.5,0,0)))}
 $("msg").textContent="";updateHUD();
}
function syncRemoteActors(players){
 const ids=new Set(players.filter(p=>p.id!==net.id).map(p=>p.id));
 for(const [id,a] of remoteActors)if(!ids.has(id)){scene.remove(a.model);remoteActors.delete(id)}
 for(const p of players){if(p.id===net.id)continue;let a=remoteActors.get(p.id);if(!a){const model=makeActorModel(p.team,p.id,true);model.position.copy(spawn[p.team]);a={id:p.id,name:p.name,team:p.team,model,target:model.position.clone(),yaw:p.team==="CT"?0:Math.PI,hp:100,alive:true};remoteActors.set(p.id,a)}else if(a.team!==p.team){scene.remove(a.model);rayTargets=rayTargets.filter(x=>x.userData.playerId!==p.id);a.model=makeActorModel(p.team,p.id,true);a.team=p.team}a.name=p.name}
}
function addKill(t){const e=document.createElement("div");e.textContent=t;$("killfeed").prepend(e);setTimeout(()=>e.remove(),2200)}
function flash(id,cls){const e=$(id);e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls)}
function hurtPlayer(d,who){if(!player.alive)return;const a=Math.min(player.armor,d*.45);player.armor-=a;player.hp=d>=999?0:player.hp-(d-a*.4);flash("damage","on");if(player.hp<=0){player.hp=0;player.alive=false;addKill(who+" ▸ YOU");$("msg").textContent="ELIMINATED"}}
function hurtTrainingBot(b,d){if(!b.alive)return;b.hp-=d;flash("hit","on");if(b.hp<=0){b.hp=0;b.alive=false;addKill("YOU ▸ "+b.name);$("msg").textContent="ENEMY DOWN";b.model.rotation.z=Math.PI/2;b.model.position.y=.15}}

function visible(from,to){const dir=to.clone().sub(from),dist=dir.length();dir.normalize();const ray=new THREE.Raycaster(from,dir,0,dist-.2);const h=ray.intersectObjects(scene.children,true).filter(x=>!x.object.userData.playerId&&!x.object.userData.bot);return h.length===0}
function botAI(dt){for(const b of localBots){if(!b.alive)continue;b.shot-=dt;const target=(player.alive&&player.team!==b.team)?player:null;if(!target)continue;const d=b.pos.distanceTo(target.pos),dir=target.pos.clone().sub(b.pos);dir.y=0;if(d<11&&visible(b.pos.clone().setY(1.35),target.pos.clone().setY(1.35))){b.model.rotation.y=Math.atan2(dir.x,dir.z);if(b.shot<=0){b.shot=.7+Math.random()*.45;hurtPlayer(8+Math.random()*8,b.name)}}else if(d>.8){dir.normalize();movePos(b.pos,dir.x*dt,dir.z*dt,.24);b.model.rotation.y=Math.atan2(dir.x,dir.z)}}}

const shotRay=new THREE.Raycaster();
function shoot(){
 if(mode!=="playing"||paused||!player.alive||player.reloading||roundEnding)return;
 const now=performance.now();if(now-lastShot<125)return;lastShot=now;if(player.ammo<=0)return reload();player.ammo--;if(viewWeapon)viewWeapon.userData.kick=1;
 shotRay.setFromCamera(new THREE.Vector2(0,0),camera);shotRay.far=40;const hits=shotRay.intersectObjects(rayTargets,false);
 if(hits.length){
   const h=hits[0],remoteId=h.object.userData.playerId;
   if(online&&remoteId&&remoteId!==net.id){
     const target=remoteActors.get(remoteId);if(target&&target.team!==team&&target.alive){
       net.send("hit_request",{targetId:remoteId,damage:38,yaw:player.yaw,x:player.pos.x,z:player.pos.z});
     }
   }else{
     const b=h.object.userData.bot;if(b&&b.team!==team&&b.alive)hurtTrainingBot(b,38);
   }
 }
 updateHUD();
}
function reload(){if(player.reloading||player.ammo===30||player.reserve<=0||!player.alive)return;player.reloading=true;$("msg").textContent="RELOADING";setTimeout(()=>{if(!player.reloading)return;const n=Math.min(30-player.ammo,player.reserve);player.ammo+=n;player.reserve-=n;player.reloading=false;$("msg").textContent="";updateHUD()},1050)}
function placeBomb(pos,label){
 if(bomb?.model)scene.remove(bomb.model);const m=new THREE.Mesh(new THREE.BoxGeometry(.42,.18,.30),new THREE.MeshStandardMaterial({color:0x26352d,roughness:.8}));m.position.copy(pos);m.position.y=.15;scene.add(m);bomb={pos:m.position.clone(),label,model:m};bombPlanted=true;$("msg").textContent="BOMB PLANTED"
}
function useAction(){
 if(!player.alive)return;
 if(player.team==="T"&&!bombPlanted&&(player.pos.distanceTo(siteA)<3||player.pos.distanceTo(siteB)<3)){
   $("msg").textContent="PLANTING…";const site=player.pos.distanceTo(siteA)<player.pos.distanceTo(siteB)?"A":"B";
   setTimeout(()=>{if(!player.alive||bombPlanted)return;if(online)net.send("plant_request",{site,x:player.pos.x,z:player.pos.z});else{placeBomb(player.pos,site);bombTimer=32}},1700);
 }else if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3){
   $("msg").textContent="DEFUSING…";setTimeout(()=>{if(!player.alive||!bombPlanted)return;if(online)net.send("defuse_request",{x:player.pos.x,z:player.pos.z});else endRound("CT","BOMB DEFUSED")},3400);
 }
}
function aliveTraining(tm){return(player.alive&&player.team===tm?1:0)+localBots.filter(b=>b.alive&&b.team===tm).length}
function endRound(tm,why){
 if(roundEnding)return;roundEnding=true;tm==="CT"?ctScore++:tScore++;$("msg").textContent=(tm==="CT"?"COUNTER-TERRORISTS":"TERRORISTS")+" WIN · "+why;
 if(online&&net.isHost())net.send("round_end",{winner:tm,reason:why,ctScore,tScore});
 setTimeout(()=>{if(online){if(net.isHost())net.send("round_reset",{ctScore,tScore,at:Date.now()+300});resetRound()}else resetRound()},2000);
}
function checkTraining(){if(roundEnding)return;if(bombPlanted&&bombTimer<=0)return endRound("T","BOMB EXPLODED");if(!bombPlanted&&aliveTraining("T")===0)return endRound("CT","TEAM ELIMINATED");if(aliveTraining("CT")===0)return endRound("T","TEAM ELIMINATED");if(!bombPlanted&&roundTime<=0)return endRound("CT","TIME EXPIRED")}

function localSnapshot(){return{id:player.id,name:net.name,team:player.team,x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch,hp:player.hp,armor:player.armor,ammo:player.ammo,alive:player.alive,t:Date.now()}}
function sendState(now){
 if(!online||!net.channel||now-lastNetSend<80)return;lastNetSend=now;const s=localSnapshot();peerStates.set(net.id,s);net.send("player_state",s);
}
function updateRemoteActors(dt){
 for(const [id,a] of remoteActors){const s=peerStates.get(id);if(!s)continue;a.target.set(s.x,s.y||1.65,s.z);a.model.position.lerp(a.target,Math.min(1,dt*12));a.model.rotation.y=s.yaw;a.hp=s.hp;a.alive=s.alive!==false;a.model.visible=a.alive}
}
function hostPlayers(){
 const out=[];for(const p of net.players){const s=p.id===net.id?localSnapshot():peerStates.get(p.id);if(s)out.push({...s,team:p.team,name:p.name})}return out
}
function hostCheckRound(now){
 if(!online||!net.isHost()||roundEnding)return;
 const ps=hostPlayers(),ct=NC.teamAlive(ps,"CT"),tt=NC.teamAlive(ps,"T");
 if(bombPlanted&&hostBombEndAt&&now>=hostBombEndAt)return endRound("T","BOMB EXPLODED");
 if(!bombPlanted&&tt===0&&ps.length>1)return endRound("CT","TEAM ELIMINATED");
 if(ct===0&&ps.length>1)return endRound("T","TEAM ELIMINATED");
 if(!bombPlanted&&hostRoundEndAt&&now>=hostRoundEndAt)return endRound("CT","TIME EXPIRED");
 if(now-lastHostRoundSend>250){lastHostRoundSend=now;net.send("round_state",{ctScore,tScore,roundEndAt:hostRoundEndAt,bombPlanted,bombEndAt:hostBombEndAt,bomb:bomb?{x:bomb.pos.x,z:bomb.pos.z,label:bomb.label}:null})}
}
function updateHUD(){
 $("hp").textContent=Math.max(0,Math.round(player.hp));$("armor").textContent=Math.max(0,Math.round(player.armor));$("ammo").textContent=player.ammo;$("reserve").textContent=player.reserve;$("ctScore").textContent=ctScore;$("tScore").textContent=tScore;
 const t=online?(bombPlanted&&hostBombEndAt?Math.max(0,(hostBombEndAt-Date.now())/1000):hostRoundEndAt?Math.max(0,(hostRoundEndAt-Date.now())/1000):roundTime):(bombPlanted?bombTimer:roundTime);
 const m=Math.floor(t/60),s=Math.floor(t%60);$("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
 $("objective").textContent=bombPlanted?"BOMB PLANTED · SITE "+bomb.label:(player.team==="T"?"PLANT AT SITE A OR B":"DEFEND SITES A & B");
 let show=false;if(player.team==="T"&&!bombPlanted&&(player.pos.distanceTo(siteA)<3||player.pos.distanceTo(siteB)<3)){show=true;$("use").textContent="PLANT"}if(player.team==="CT"&&bombPlanted&&player.pos.distanceTo(bomb.pos)<1.3){show=true;$("use").textContent="DEFUSE"}$("use").classList.toggle("hidden",!show);
}
function updateView(dt,moving){if(!viewWeapon)return;viewWeapon.userData.kick=Math.max(0,(viewWeapon.userData.kick||0)-dt*8);player.bob+=moving?dt*10:dt*2;const k=viewWeapon.userData.kick||0;viewWeapon.position.x=.30+Math.sin(player.bob)*.009;viewWeapon.position.y=-.28-Math.abs(Math.cos(player.bob))*(moving?.01:0)+k*.03;viewWeapon.position.z=-.58+k*.08;viewWeapon.rotation.z=player.reloading?-.4*Math.sin(performance.now()/170):0}

// ---------- Supabase events ----------
net.on("presence",({players,hostId})=>{renderLobby(players,hostId);if(online&&mode==="playing")syncRemoteActors(players)})
.on("player_state",s=>{if(!s?.id||s.id===net.id)return;peerStates.set(s.id,s);const a=remoteActors.get(s.id);if(a){a.hp=s.hp;a.alive=s.alive!==false}})
.on("hit_request",req=>{
 if(!net.isHost())return;const shooter=req.from===net.id?localSnapshot():peerStates.get(req.from);const target=req.targetId===net.id?localSnapshot():peerStates.get(req.targetId);
 if(!NC.validateHit(shooter,target,req))return;const hp=Math.max(0,(authoritativeHp.get(req.targetId)??target.hp??100)-Math.min(60,Math.max(1,req.damage||38)));authoritativeHp.set(req.targetId,hp);
 net.send("damage",{targetId:req.targetId,attackerId:req.from,hp,dead:hp<=0});
})
.on("damage",d=>{
 if(!d)return;if(d.targetId===net.id){player.hp=d.hp;flash("damage","on");if(d.dead){player.alive=false;player.hp=0;$("msg").textContent="ELIMINATED";addKill("YOU WERE ELIMINATED")}}
 else{const a=remoteActors.get(d.targetId);if(a){a.hp=d.hp;a.alive=!d.dead;a.model.visible=!d.dead}if(d.attackerId===net.id)flash("hit","on")}
})
.on("match_start",m=>{if(mode!=="playing")beginOnlineMatch(m?.at||Date.now()+300)})
.on("round_state",r=>{if(net.isHost())return;ctScore=r.ctScore??ctScore;tScore=r.tScore??tScore;hostRoundEndAt=r.roundEndAt||hostRoundEndAt;hostBombEndAt=r.bombEndAt||0;if(r.bombPlanted&&r.bomb){if(!bombPlanted)placeBomb(new THREE.Vector3(r.bomb.x,.15,r.bomb.z),r.bomb.label);bombPlanted=true}else if(!r.bombPlanted&&bombPlanted){if(bomb?.model)scene.remove(bomb.model);bomb=null;bombPlanted=false}})
.on("round_end",r=>{if(net.isHost())return;roundEnding=true;ctScore=r.ctScore;tScore=r.tScore;$("msg").textContent=(r.winner==="CT"?"COUNTER-TERRORISTS":"TERRORISTS")+" WIN · "+r.reason})
.on("round_reset",r=>{if(net.isHost())return;ctScore=r.ctScore??ctScore;tScore=r.tScore??tScore;resetRound()})
.on("plant_request",r=>{
 if(!net.isHost()||bombPlanted)return;const s=r.from===net.id?localSnapshot():peerStates.get(r.from);if(!s||s.team!=="T"||s.alive===false)return;const site=r.site==="B"?siteB:siteA;if(new THREE.Vector3(s.x,0,s.z).distanceTo(site)>3.4)return;hostBombEndAt=Date.now()+32000;placeBomb(new THREE.Vector3(r.x,.15,r.z),r.site);net.send("bomb_state",{planted:true,bombEndAt:hostBombEndAt,x:r.x,z:r.z,label:r.site})
})
.on("defuse_request",r=>{
 if(!net.isHost()||!bombPlanted)return;const s=r.from===net.id?localSnapshot():peerStates.get(r.from);if(!s||s.team!=="CT"||s.alive===false)return;if(new THREE.Vector3(s.x,0,s.z).distanceTo(bomb.pos)>1.6)return;endRound("CT","BOMB DEFUSED")
})
.on("bomb_state",r=>{if(net.isHost())return;if(r.planted){hostBombEndAt=r.bombEndAt;placeBomb(new THREE.Vector3(r.x,.15,r.z),r.label)}});

// ---------- Lobby ----------
function roomLink(){const u=new URL(location.href);u.searchParams.set("room",net.room);u.hash="";return u.toString()}
function renderLobby(players=net.players,hostId=net.hostId){
 $("lobbyCode").textContent=net.room||"-----";$("netStatus").textContent=net.channel?"CONNECTED":"CONNECTING";$("playerName").value=net.name;
 const ct=$("ctPlayers"),tt=$("tPlayers");ct.innerHTML="";tt.innerHTML="";
 for(const p of players){const row=document.createElement("div");row.className="player-row"+(p.id===net.id?" me":"");row.innerHTML="<span>"+escapeHtml(p.name||"Player")+"</span>"+(p.id===hostId?'<span class="host">HOST</span>':"");(p.team==="T"?tt:ct).appendChild(row)}
 const hasCT=players.some(p=>p.team==="CT"),hasT=players.some(p=>p.team==="T"),ready=players.length>=2&&hasCT&&hasT;
 $("startOnline").disabled=!(net.isHost()&&ready);$("startOnline").textContent=net.isHost()?"START ONLINE MATCH":"WAITING FOR HOST";
 $("lobbyHint").textContent=players.length<2?"Waiting for another player to open the room link…":!hasCT||!hasT?"Choose opposite teams before starting.":net.isHost()?"Both teams ready. Start the match.":"Connected. Waiting for host to start.";
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
async function connectRoom(code,creator=false){
 $("portal").classList.add("hidden");$("joinDialog").classList.add("hidden");$("lobby").classList.remove("hidden");$("netStatus").textContent="CONNECTING";
 try{await net.connect(code,{creator,team:creator?"CT":"T"});team=net.team;renderLobby();history.replaceState(null,"",roomLink())}catch(e){$("lobby").classList.add("hidden");$("portal").classList.remove("hidden");alert("Could not connect to the online room: "+e.message)}
}
$("createOnline").onclick=()=>connectRoom(NC.makeRoomCode(),true);
$("joinOnline").onclick=()=>{$("joinDialog").classList.remove("hidden")};
$("joinCancel").onclick=()=>$("joinDialog").classList.add("hidden");
$("joinCodeBtn").onclick=()=>{const c=$("joinCodeInput").value.trim().toUpperCase();if(c)connectRoom(c,false)};
$("pickCT").onclick=async()=>{team="CT";await net.updateProfile({team});renderLobby()};
$("pickT").onclick=async()=>{team="T";await net.updateProfile({team});renderLobby()};
$("saveName").onclick=async()=>{const n=$("playerName").value.trim();if(n)await net.updateProfile({name:n});renderLobby()};
$("shareRoom").onclick=async()=>{const url=roomLink();if(navigator.share)try{await navigator.share({title:"Hobile",text:"Join my Hobile room "+net.room,url})}catch{}else try{await navigator.clipboard.writeText(url)}catch{}};
$("copyRoom").onclick=async()=>{try{await navigator.clipboard.writeText(roomLink());$("copyRoom").textContent="COPIED";setTimeout(()=>$("copyRoom").textContent="COPY LINK",800)}catch{}};
$("startOnline").onclick=()=>{if(!net.isHost()||$("startOnline").disabled)return;const at=Date.now()+500;net.send("match_start",{at});beginOnlineMatch(at)};
$("leaveLobby").onclick=async()=>{await net.disconnect();$("lobby").classList.add("hidden");$("portal").classList.remove("hidden");const u=new URL(location.href);u.searchParams.delete("room");history.replaceState(null,"",u.pathname)};

async function beginOnlineMatch(at){
 online=true;team=net.team;mode="loading";$("lobby").classList.add("hidden");$("portal").classList.add("hidden");$("loading").classList.remove("hidden");$("loadText").textContent="Synchronizing online match…";$("loadBar").style.width="45%";
 const delay=Math.max(0,at-Date.now());setTimeout(()=>{$("loadBar").style.width="100%";setTimeout(()=>{$("loading").classList.add("hidden");$("hud").classList.remove("hidden");$("controls").classList.remove("hidden");mode="playing";paused=false;ctScore=tScore=0;buildMap();resetRound();hostRoundEndAt=Date.now()+95000;clock.start()},160)},delay)
}
async function beginTraining(){
 online=false;await net.disconnect();team="CT";$("portal").classList.add("hidden");$("loading").classList.remove("hidden");$("loadText").textContent="Starting local training…";$("loadBar").style.width="70%";
 setTimeout(()=>{$("loadBar").style.width="100%";setTimeout(()=>{$("loading").classList.add("hidden");$("hud").classList.remove("hidden");$("controls").classList.remove("hidden");mode="playing";paused=false;ctScore=tScore=0;buildMap();resetRound();clock.start()},140)},180)
}
$("training").onclick=()=>beginTraining();

$("reload").onpointerdown=e=>{e.preventDefault();reload()};$("jump").onpointerdown=e=>{e.preventDefault();if(player?.onGround){player.vy=4.7;player.onGround=false}};$("use").onpointerdown=e=>{e.preventDefault();useAction()};
$("fire").onpointerdown=e=>{e.preventDefault();shoot();const iv=setInterval(shoot,125);const stop=()=>{clearInterval(iv);$("fire").removeEventListener("pointerup",stop);$("fire").removeEventListener("pointercancel",stop)};$("fire").addEventListener("pointerup",stop);$("fire").addEventListener("pointercancel",stop)};
$("menuBtn").onclick=()=>{paused=true;$("pause").classList.remove("hidden")};$("resume").onclick=()=>{paused=false;$("pause").classList.add("hidden");clock.getDelta()};
$("leave").onclick=async()=>{paused=false;mode="menu";$("pause").classList.add("hidden");$("hud").classList.add("hidden");$("controls").classList.add("hidden");if(online){await net.disconnect();online=false;$("lobby").classList.add("hidden")} $("portal").classList.remove("hidden")};

const joy=$("joy"),stick=$("stick"),look=$("look");
function setJoy(x,y){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=x-cx,dy=y-cy,max=r.width*.33,l=Math.hypot(dx,dy)||1,k=Math.min(1,max/l);dx*=k;dy*=k;joyX=dx/max;joyY=dy/max;stick.style.transform=`translate(${dx}px,${dy}px)`}
function stopJoy(){joyId=null;joyX=joyY=0;stick.style.transform="translate(0,0)"}joy.onpointerdown=e=>{joyId=e.pointerId;joy.setPointerCapture?.(e.pointerId);setJoy(e.clientX,e.clientY)};joy.onpointermove=e=>{if(e.pointerId===joyId)setJoy(e.clientX,e.clientY)};joy.onpointerup=stopJoy;joy.onpointercancel=stopJoy;
look.onpointerdown=e=>{lookId=e.pointerId;lx=e.clientX;ly=e.clientY;look.setPointerCapture?.(e.pointerId)};look.onpointermove=e=>{if(e.pointerId!==lookId||!player)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;player.yaw-=dx*.004;player.pitch-=dy*.003;player.pitch=Math.max(-1.1,Math.min(1,player.pitch))};look.onpointerup=()=>lookId=null;look.onpointercancel=()=>lookId=null;
["contextmenu","selectstart","dragstart","gesturestart","gesturechange","gestureend"].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault(),{passive:false}));document.addEventListener("touchmove",e=>{if(mode==="playing")e.preventDefault()},{passive:false});document.addEventListener("dblclick",e=>e.preventDefault(),{passive:false});

function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.3));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener("resize",resize);
function loop(){
 requestAnimationFrame(loop);const dt=Math.min(.035,clock.getDelta()||.016),now=Date.now();
 if(mode==="playing"&&!paused&&!roundEnding&&player){
   const moving=Math.abs(joyX)+Math.abs(joyY)>.06;if(player.alive){const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)),right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));const d=forward.multiplyScalar(-joyY*3.4*dt).add(right.multiplyScalar(joyX*3.4*dt));movePos(player.pos,d.x,d.z,.27);player.vy-=11.5*dt;player.pos.y+=player.vy*dt;if(player.pos.y<=1.65){player.pos.y=1.65;player.vy=0;player.onGround=true}}
   camera.position.copy(player.pos);camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
   if(online){sendState(now);updateRemoteActors(dt);hostCheckRound(now)}else{if(bombPlanted)bombTimer-=dt;else roundTime-=dt;botAI(dt);checkTraining()}
   updateView(dt,moving);updateHUD();
 }
 renderer.render(scene,camera);
}
loop();

async function boot(){
 try{await prepareAssets();$("bootText").textContent="Ready";setTimeout(()=>{$("boot").classList.add("hidden");$("portal").classList.remove("hidden");mode="menu";const room=new URL(location.href).searchParams.get("room");if(room)setTimeout(()=>connectRoom(room,false),220)},180)}
 catch(e){console.error(e);fail("Hobile could not load its 3D assets: "+e.message)}
}
boot();

window.__hobileV6={net,state:()=>({mode,online,room:net.room,host:net.hostId,me:net.id,players:net.players,team,player:player?localSnapshot():null,remotes:[...remoteActors.keys()]})};
