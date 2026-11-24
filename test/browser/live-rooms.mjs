import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createRoomHttpServer} from '../../lib/rooms/http.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.QSWIPE_BROWSER_PACKAGE+'/node_modules/playwright');
const server=createRoomHttpServer();
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const errors=[];
try{
 browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,args:['--no-sandbox']});
 await mkdir('live-room-previews',{recursive:true});
 const pages=[];
 for(const [viewport,colorScheme,reducedMotion] of [[{width:1280,height:900},'light','no-preference'],[{width:390,height:844},'light','no-preference'],[{width:320,height:780},'dark','reduce']]){
  const context=await browser.newContext({viewport,colorScheme,reducedMotion});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());pages.push(page);
 }
 const [host,guest,third]=pages;
 await host.goto(origin+'/rooms/');await host.getByText('Staging room service',{exact:true}).waitFor();
 await host.screenshot({path:'live-room-previews/01-room-entry-desktop.png',fullPage:true,animations:'disabled'});
 await host.locator('#create input[name=name]').fill('Alex');await host.locator('#create button').click();await host.locator('#invite-panel').waitFor();
 const invite=await host.locator('#code').textContent();assert.match(invite,/^[0-9a-f]{32}$/);assert.equal(await host.locator('#qr svg').count(),1);
 for(const [page,name,team] of [[guest,'Jamie','amber'],[third,'Morgan','jade']]){
  await page.goto(origin+'/rooms/#join='+invite);await page.getByText('Staging room service',{exact:true}).waitFor();assert.equal(await page.locator('#join input[name=invite]').inputValue(),invite);assert.equal(await page.evaluate(()=>location.hash),'');
  await page.locator('#join input[name=name]').fill(name);await page.locator('#join select').selectOption(team);await page.locator('#join button').click();await page.locator('#room').waitFor();assert.equal(await page.locator('#invite-panel').isVisible(),false);
 }
 for(const p of pages)await p.waitForFunction(()=>document.querySelector('#count').textContent==='3 / 12');
 await host.screenshot({path:'live-room-previews/02-host-lobby-qr.png',fullPage:true,animations:'disabled'});
 await guest.screenshot({path:'live-room-previews/03-guest-mobile-lobby.png',fullPage:true,animations:'disabled'});
 assert.equal(await guest.getByRole('button',{name:/Lucky wheel/}).isDisabled(),true);
 await host.getByRole('button',{name:/Lucky wheel/}).click();
 for(const p of pages)await p.locator('.wheel-box').waitFor();
 await host.screenshot({path:'live-room-previews/04-wheel-desktop.png',fullPage:true,animations:'disabled'});
 await guest.screenshot({path:'live-room-previews/05-wheel-mobile.png',fullPage:true,animations:'disabled'});
 for(const p of pages)await p.locator('#stage .result').waitFor();
 const wheel=await host.locator('#stage .result').textContent();
 for(const p of pages)assert.equal(await p.locator('#stage .result').textContent(),wheel);
 await host.getByRole('button',{name:'Back to lobby'}).click();await host.getByRole('button',{name:/Duck race/}).click();
 for(const p of pages)await p.locator('.race-track').first().waitFor();
 await host.screenshot({path:'live-room-previews/06-duck-race-desktop.png',fullPage:true,animations:'disabled'});
 await third.screenshot({path:'live-room-previews/07-duck-race-dark.png',fullPage:true,animations:'disabled'});
 for(const p of pages)await p.locator('.podium').waitFor();
 const podium=await host.locator('.podium').textContent();
 for(const p of pages)assert.equal(await p.locator('.podium').textContent(),podium);
 await host.screenshot({path:'live-room-previews/08-race-results.png',fullPage:true,animations:'disabled'});
 await host.getByRole('button',{name:'Back to lobby'}).click();await host.getByRole('button',{name:/Team trivia/}).click();
 for(let i=0;i<5;i++){
  for(const p of pages)await p.waitForFunction(index=>document.querySelector('#stage p')?.textContent.startsWith('Question '+(index+1)+' of 5')&&document.querySelector('.answers button:not([disabled])'),i);
  const q=await host.locator('.question').textContent();const match=q.match(/(\d+) \+ (\d+)/);assert.ok(match);const correct=String(Number(match[1])+Number(match[2]));
  for(const p of pages)assert.equal(await p.locator('.question').textContent(),q);
  if(i===0){await guest.screenshot({path:'live-room-previews/09-trivia-mobile.png',fullPage:true,animations:'disabled'});await third.screenshot({path:'live-room-previews/10-trivia-dark.png',fullPage:true,animations:'disabled'});}
  for(const p of pages)await p.locator('.answers').getByRole('button',{name:correct,exact:true}).click();
  for(const p of pages)await p.getByText('Correct answer: '+correct+' · Nice work!',{exact:true}).waitFor();
  if(i<4){assert.equal(await guest.getByRole('button',{name:'Next question'}).count(),0);await host.getByRole('button',{name:'Next question'}).click();}
 }
 for(const p of pages)await p.getByText('Trivia complete · scores updated',{exact:true}).waitFor();
 const scoreMap=async p=>p.locator('#players .player').evaluateAll(rows=>rows.map(r=>[r.querySelector('.grow strong').textContent.replace(' · You',''),Number(r.querySelector('.score').textContent)]));
 const scores=await scoreMap(host);assert.equal(scores.reduce((n,x)=>n+x[1],0),220);
 for(const p of pages){assert.deepEqual(await scoreMap(p),scores);assert.equal(await p.locator('#players .badge-line').count(),3);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.evaluate(()=>localStorage.length+sessionStorage.length),0);}
 await host.screenshot({path:'live-room-previews/11-final-leaderboard.png',fullPage:true,animations:'disabled'});
 await guest.screenshot({path:'live-room-previews/12-mobile-leaderboard.png',fullPage:true,animations:'disabled'});
 await third.screenshot({path:'live-room-previews/13-dark-leaderboard.png',fullPage:true,animations:'disabled'});
 await host.getByRole('button',{name:'Close room',exact:true}).click();
 for(const p of [guest,third])await p.getByText('Room closed or expired. Join a new room.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('Live rooms browser passed: 3 independent sessions, QR link, wheel, race, trivia, teams, close and responsive layouts.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
