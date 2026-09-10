
const { chromium } = require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true,isMobile:true});
 const errs=[];page.on("pageerror",e=>errs.push(e.message));
 await page.goto("http://127.0.0.1:8765",{waitUntil:"networkidle"});
 await page.evaluate(()=>window.__hobileDebug.startCT());
 await page.waitForTimeout(500);
 const botCount=await page.evaluate(()=>window.__hobileDebug.getBots().filter(b=>b.alive).length);
 if(botCount!==5) throw new Error("expected 5 bots, got "+botCount);
 const p1=await page.evaluate(()=>window.__hobileDebug.getPlayer());
 const joy=await page.locator("#joy").boundingBox();
 await page.mouse.move(joy.x+joy.width/2,joy.y+joy.height/2);await page.mouse.down();await page.mouse.move(joy.x+joy.width/2,joy.y+8,{steps:8});await page.waitForTimeout(500);await page.mouse.up();
 const p2=await page.evaluate(()=>window.__hobileDebug.getPlayer());
 if(Math.hypot(p2.x-p1.x,p2.y-p1.y)<.05) throw new Error("movement test failed");
 await page.evaluate(()=>{window.__hobileDebug.teleportNearEnemy();window.__hobileDebug.faceNearestEnemy()});
 await page.waitForTimeout(120);
 for(let i=0;i<4;i++){await page.evaluate(()=>window.__hobileDebug.shoot());await page.waitForTimeout(140)}
 const dead=await page.evaluate(()=>window.__hobileDebug.getBots().some(b=>!b.alive&&b.team==="T"));
 if(!dead) throw new Error("combat kill test failed");
 if(errs.length) throw new Error("page errors: "+errs.join(" | "));
 await page.screenshot({path:"browser_game.png"});
 console.log("PASS portal/game boot");
 console.log("PASS 5 bots spawned");
 console.log("PASS movement input changed player position");
 console.log("PASS combat shot killed enemy");
 console.log("PASS no page errors");
 await browser.close();
})();
