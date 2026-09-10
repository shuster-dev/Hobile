(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  root.HobileNetCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  function makeRoomCode(rand=Math.random){
    const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out="";
    for(let i=0;i<5;i++) out+=chars[Math.floor(rand()*chars.length)];
    return out;
  }
  function flattenPresence(state){
    const players=[];
    for(const list of Object.values(state||{})){
      for(const p of list||[]){
        if(p && p.id) players.push(p);
      }
    }
    const seen=new Set();
    return players.filter(p=>!seen.has(p.id) && seen.add(p.id));
  }
  function electHost(players){
    if(!players?.length) return null;
    const creators=players.filter(p=>p.creator);
    const pool=creators.length?creators:players;
    return [...pool].sort((a,b)=>
      (Number(a.joinedAt||0)-Number(b.joinedAt||0)) ||
      String(a.id).localeCompare(String(b.id))
    )[0]?.id || null;
  }
  function validateHit(shooter,target,req){
    if(!shooter||!target||!req) return false;
    if(!shooter.alive||!target.alive) return false;
    if(shooter.team===target.team) return false;
    const dx=target.x-shooter.x,dz=target.z-shooter.z;
    const dist=Math.hypot(dx,dz);
    if(dist>42) return false;
    const desired=Math.atan2(-dx,-dz);
    let da=desired-Number(req.yaw||0);
    while(da>Math.PI) da-=Math.PI*2;
    while(da<-Math.PI) da+=Math.PI*2;
    const allowed=Math.max(.055,.018+1.05/Math.max(8,dist*18));
    return Math.abs(da)<allowed;
  }
  function teamAlive(players,team){
    return players.filter(p=>p.team===team && p.alive!==false).length;
  }
  return {makeRoomCode,flattenPresence,electHost,validateHit,teamAlive};
});