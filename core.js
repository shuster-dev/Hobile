
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  root.HobileCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const MAP=[
    "111111111111111111111111",
    "100000000000000000000001",
    "100011111011111011110001",
    "100010000010000010000001",
    "100010111110111110111101",
    "100010000000100000000001",
    "100011111100101111110001",
    "100000000000100000010001",
    "101111011111101111010001",
    "100001000000000001010001",
    "100001011111111001010001",
    "100000010000001000000001",
    "101110010111101111110001",
    "100010010100000000010001",
    "100010000101111110010001",
    "100011110100000010000001",
    "100000000111110011111101",
    "101111000000000000000001",
    "100001111011111111110001",
    "100000000010000000000001",
    "101111110010111111110001",
    "100000000000000000000001",
    "100000000000000000000001",
    "111111111111111111111111"
  ];
  const CT_SPAWN={x:2.5,y:21.5}, T_SPAWN={x:20.5,y:2.5};
  const SITE_A={x1:18,y1:18,x2:21.5,y2:21.5,label:"A"};
  const SITE_B={x1:2,y1:2,x2:5.5,y2:5.5,label:"B"};

  function isWall(x,y){
    const ix=Math.floor(x),iy=Math.floor(y);
    return iy<0||ix<0||iy>=MAP.length||ix>=MAP[0].length||MAP[iy][ix]==="1";
  }
  function canStand(x,y,r=.20){
    return !isWall(x,y)&&!isWall(x-r,y-r)&&!isWall(x+r,y-r)&&!isWall(x-r,y+r)&&!isWall(x+r,y+r);
  }
  function moveEntity(ent,dx,dy,r=.20){
    const nx=ent.x+dx,ny=ent.y+dy;
    if(canStand(nx,ent.y,r)) ent.x=nx;
    if(canStand(ent.x,ny,r)) ent.y=ny;
    return ent;
  }
  function norm(a){ while(a>Math.PI)a-=Math.PI*2; while(a<-Math.PI)a+=Math.PI*2; return a; }
  function los(x1,y1,x2,y2){
    const d=Math.hypot(x2-x1,y2-y1),n=Math.max(2,Math.ceil(d/.06));
    for(let i=1;i<n;i++){const t=i/n;if(isWall(x1+(x2-x1)*t,y1+(y2-y1)*t))return false}
    return true;
  }
  function currentSite(x,y){
    if(x>=SITE_A.x1&&x<=SITE_A.x2&&y>=SITE_A.y1&&y<=SITE_A.y2)return SITE_A;
    if(x>=SITE_B.x1&&x<=SITE_B.x2&&y>=SITE_B.y1&&y<=SITE_B.y2)return SITE_B;
    return null;
  }
  function nearestOpenCell(x,y){
    const sx=Math.floor(x),sy=Math.floor(y);
    if(MAP[sy]&&MAP[sy][sx]==="0") return {x:sx,y:sy};
    for(let r=1;r<8;r++) for(let yy=sy-r;yy<=sy+r;yy++) for(let xx=sx-r;xx<=sx+r;xx++)
      if(MAP[yy]&&MAP[yy][xx]==="0") return {x:xx,y:yy};
    return {x:1,y:1};
  }
  function pathfind(sx,sy,gx,gy){
    const s=nearestOpenCell(sx,sy),g=nearestOpenCell(gx,gy),W=MAP[0].length,H=MAP.length;
    const q=[s],key=(x,y)=>y*W+x,prev=new Map([[key(s.x,s.y),null]]);
    for(let qi=0;qi<q.length;qi++){
      const c=q[qi]; if(c.x===g.x&&c.y===g.y)break;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=c.x+dx,ny=c.y+dy,k=key(nx,ny);
        if(ny>=0&&ny<H&&nx>=0&&nx<W&&MAP[ny][nx]==="0"&&!prev.has(k)){prev.set(k,c);q.push({x:nx,y:ny})}
      }
    }
    if(!prev.has(key(g.x,g.y)))return [];
    const p=[];let c=g;
    while(c){p.push({x:c.x+.5,y:c.y+.5});c=prev.get(key(c.x,c.y))}
    return p.reverse();
  }
  function findShot(player,bots,fov=.065){
    let best=null,dist=Infinity,head=false;
    for(const b of bots){
      if(!b.alive||b.team===player.team)continue;
      const dx=b.x-player.x,dy=b.y-player.y,d=Math.hypot(dx,dy),ang=Math.abs(norm(Math.atan2(dy,dx)-player.a));
      if(ang<fov&&d<dist&&los(player.x,player.y,b.x,b.y)){best=b;dist=d;head=ang<fov*.36}
    }
    return best?{bot:best,dist,head}:null;
  }
  function roundWinner(state){
    const ctAlive=state.actors.filter(a=>a.alive&&a.team==="CT").length;
    const tAlive=state.actors.filter(a=>a.alive&&a.team==="T").length;
    if(state.bombPlanted && state.bombTimer<=0)return {team:"T",reason:"BOMB EXPLODED"};
    if(state.defused)return {team:"CT",reason:"BOMB DEFUSED"};
    if(!state.bombPlanted&&tAlive===0)return {team:"CT",reason:"TEAM ELIMINATED"};
    if(ctAlive===0)return {team:"T",reason:"TEAM ELIMINATED"};
    if(!state.bombPlanted&&state.roundTime<=0)return {team:"CT",reason:"TIME EXPIRED"};
    return null;
  }
  return {MAP,CT_SPAWN,T_SPAWN,SITE_A,SITE_B,isWall,canStand,moveEntity,norm,los,currentSite,pathfind,findShot,roundWinner};
});
