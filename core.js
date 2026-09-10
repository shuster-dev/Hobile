
(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined" && module.exports) module.exports=api;
  root.HobileCore=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  const MAP=[
    "111111111111111111111111",
    "100000000002000000000001",
    "100033300002000011110001",
    "100030000000000010010001",
    "100030011112222210010001",
    "100000010000000000010001",
    "101111110033311111110001",
    "100000000030000000000001",
    "100222220030222211111101",
    "100200000000200000000001",
    "100200111110200111110001",
    "100000100000000100000001",
    "101110100222220101111001",
    "100010100200000100001001",
    "100010000200333300001001",
    "100011110200300011111001",
    "100000000000300000000001",
    "101111033330333011110001",
    "100001030000000010000001",
    "100001030111111110000001",
    "100000030000000000000001",
    "100000000000000000000001",
    "100000000000000000000001",
    "111111111111111111111111"
  ];
  const CT_SPAWN={x:2.5,y:21.5}, T_SPAWN={x:20.5,y:2.5};
  const SITE_A={x1:18.0,y1:18.0,x2:21.7,y2:21.7,label:"A"};
  const SITE_B={x1:2.0,y1:2.0,x2:5.8,y2:5.8,label:"B"};

  function tile(x,y){
    const ix=Math.floor(x),iy=Math.floor(y);
    if(iy<0||ix<0||iy>=MAP.length||ix>=MAP[0].length) return "1";
    return MAP[iy][ix];
  }
  function isWall(x,y){ return tile(x,y)!=="0"; }
  function canStand(x,y,r=.20){
    return !isWall(x,y)&&!isWall(x-r,y-r)&&!isWall(x+r,y-r)&&!isWall(x-r,y+r)&&!isWall(x+r,y+r);
  }
  function moveEntity(ent,dx,dy,r=.20){
    const nx=ent.x+dx, ny=ent.y+dy;
    if(canStand(nx,ent.y,r)) ent.x=nx;
    if(canStand(ent.x,ny,r)) ent.y=ny;
    return ent;
  }
  function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
  function los(x1,y1,x2,y2){
    const d=Math.hypot(x2-x1,y2-y1),n=Math.max(2,Math.ceil(d/.045));
    for(let i=1;i<n;i++){const t=i/n;if(isWall(x1+(x2-x1)*t,y1+(y2-y1)*t))return false}
    return true;
  }
  function currentSite(x,y){
    if(x>=SITE_A.x1&&x<=SITE_A.x2&&y>=SITE_A.y1&&y<=SITE_A.y2)return SITE_A;
    if(x>=SITE_B.x1&&x<=SITE_B.x2&&y>=SITE_B.y1&&y<=SITE_B.y2)return SITE_B;
    return null;
  }
  function openCell(x,y){return y>=0&&x>=0&&y<MAP.length&&x<MAP[0].length&&MAP[y][x]==="0"}
  function nearestOpenCell(x,y){
    const sx=Math.floor(x),sy=Math.floor(y);
    if(openCell(sx,sy))return{x:sx,y:sy};
    for(let r=1;r<10;r++)for(let yy=sy-r;yy<=sy+r;yy++)for(let xx=sx-r;xx<=sx+r;xx++)if(openCell(xx,yy))return{x:xx,y:yy};
    return{x:1,y:1};
  }
  function pathfind(sx,sy,gx,gy){
    const s=nearestOpenCell(sx,sy),g=nearestOpenCell(gx,gy),W=MAP[0].length,H=MAP.length;
    const key=(x,y)=>y*W+x,q=[s],prev=new Map([[key(s.x,s.y),null]]);
    for(let qi=0;qi<q.length;qi++){
      const c=q[qi];if(c.x===g.x&&c.y===g.y)break;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=c.x+dx,ny=c.y+dy,k=key(nx,ny);
        if(nx>=0&&ny>=0&&nx<W&&ny<H&&openCell(nx,ny)&&!prev.has(k)){prev.set(k,c);q.push({x:nx,y:ny})}
      }
    }
    if(!prev.has(key(g.x,g.y)))return[];
    const p=[];let c=g;while(c){p.push({x:c.x+.5,y:c.y+.5});c=prev.get(key(c.x,c.y))}return p.reverse();
  }
  function shotConeForDistance(d){
    // Makes the clickable angular hitbox match the rendered player's body size.
    return Math.max(.022,Math.min(.16,Math.atan2(.32,Math.max(.4,d))));
  }
  function findShot(player,bots){
    let best=null,dist=Infinity,head=false,angle=Infinity;
    for(const b of bots){
      if(!b.alive||b.team===player.team)continue;
      const dx=b.x-player.x,dy=b.y-player.y,d=Math.hypot(dx,dy);
      const a=Math.abs(norm(Math.atan2(dy,dx)-player.a)),cone=shotConeForDistance(d);
      if(a<cone&&d<dist&&los(player.x,player.y,b.x,b.y)){best=b;dist=d;angle=a;head=a<cone*.34}
    }
    return best?{bot:best,dist,head,angle,cone:shotConeForDistance(dist)}:null;
  }
  function roundWinner(state){
    const ctAlive=state.actors.filter(a=>a.alive&&a.team==="CT").length;
    const tAlive=state.actors.filter(a=>a.alive&&a.team==="T").length;
    if(state.defused)return{team:"CT",reason:"BOMB DEFUSED"};
    if(state.bombPlanted&&state.bombTimer<=0)return{team:"T",reason:"BOMB EXPLODED"};
    if(!state.bombPlanted&&tAlive===0)return{team:"CT",reason:"TEAM ELIMINATED"};
    if(ctAlive===0)return{team:"T",reason:"TEAM ELIMINATED"};
    if(!state.bombPlanted&&state.roundTime<=0)return{team:"CT",reason:"TIME EXPIRED"};
    return null;
  }
  return{MAP,CT_SPAWN,T_SPAWN,SITE_A,SITE_B,tile,isWall,canStand,moveEntity,norm,los,currentSite,pathfind,shotConeForDistance,findShot,roundWinner};
});
