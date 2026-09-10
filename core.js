
const MAP=[
"111111111111111111111111",
"100000000000100000000001",
"100022220000100033330001",
"100020020000000030030001",
"100020022220111130030001",
"100000000000100000000001",
"101111011111110111110001",
"100001000000010000000001",
"100001001111010044411101",
"100000001001000040000001",
"101111101001111140111101",
"100000001000000000000001",
"100022221011111111100001",
"100020000010000001100001",
"100020111110111101100001",
"100000100000100001000001",
"101110100111100111011101",
"100000000000000000000001",
"100033331111000111110001",
"100030000000000000000001",
"100030111100000111000001",
"100000000000000000000001",
"100000000000000000000001",
"111111111111111111111111"];
const CT_SPAWN={x:2.5,y:21.5},T_SPAWN={x:21.5,y:1.5};
const SITE_A={x1:18.0,y1:19.0,x2:21.7,y2:21.7,label:"A"};
const SITE_B={x1:1.2,y1:1.2,x2:3.8,y2:3.8,label:"B"};
const W=MAP[0].length,H=MAP.length;
function cell(x,y){let ix=Math.floor(x),iy=Math.floor(y);return iy<0||ix<0||iy>=H||ix>=W?"1":MAP[iy][ix]}
function wall(x,y){return cell(x,y)!=="0"}
function canStand(x,y,r=.2){return !wall(x,y)&&!wall(x-r,y-r)&&!wall(x+r,y-r)&&!wall(x-r,y+r)&&!wall(x+r,y+r)}
function move(e,dx,dy,r=.2){let nx=e.x+dx,ny=e.y+dy;if(canStand(nx,e.y,r))e.x=nx;if(canStand(e.x,ny,r))e.y=ny;return e}
function norm(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a}
function los(x1,y1,x2,y2){let d=Math.hypot(x2-x1,y2-y1),n=Math.max(2,Math.ceil(d/.05));for(let i=1;i<n;i++){let t=i/n;if(wall(x1+(x2-x1)*t,y1+(y2-y1)*t))return false}return true}
function site(x,y){if(x>=SITE_A.x1&&x<=SITE_A.x2&&y>=SITE_A.y1&&y<=SITE_A.y2)return SITE_A;if(x>=SITE_B.x1&&x<=SITE_B.x2&&y>=SITE_B.y1&&y<=SITE_B.y2)return SITE_B;return null}
function nearestOpen(x,y){let sx=Math.floor(x),sy=Math.floor(y);if(MAP[sy]&&MAP[sy][sx]==="0")return{x:sx,y:sy};for(let r=1;r<10;r++)for(let yy=sy-r;yy<=sy+r;yy++)for(let xx=sx-r;xx<=sx+r;xx++)if(MAP[yy]&&MAP[yy][xx]==="0")return{x:xx,y:yy};return{x:1,y:1}}
function path(sx,sy,gx,gy){let s=nearestOpen(sx,sy),g=nearestOpen(gx,gy),q=[s],key=(x,y)=>y*W+x,prev=new Map([[key(s.x,s.y),null]]);for(let i=0;i<q.length;i++){let c=q[i];if(c.x===g.x&&c.y===g.y)break;for(let [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let nx=c.x+dx,ny=c.y+dy,k=key(nx,ny);if(ny>=0&&ny<H&&nx>=0&&nx<W&&MAP[ny][nx]==="0"&&!prev.has(k)){prev.set(k,c);q.push({x:nx,y:ny})}}}if(!prev.has(key(g.x,g.y)))return[];let p=[],c=g;while(c){p.push({x:c.x+.5,y:c.y+.5});c=prev.get(key(c.x,c.y))}return p.reverse()}
window.HobileCore={MAP,CT_SPAWN,T_SPAWN,SITE_A,SITE_B,W,H,cell,wall,canStand,move,norm,los,site,path};
