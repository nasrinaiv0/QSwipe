import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoomHttpServer} from '../../lib/rooms/http.mjs';
import {createPersistentRoomService,createFileStore} from '../../lib/rooms/persistence.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.QSWIPE_BROWSER_PACKAGE+'/node_modules/playwright');
const dir=await mkdtemp(join(tmpdir(),'qs-consolidation-'));let t=Date.now();
const server=createRoomHttpServer({service:createPersistentRoomService(createFileStore(join(dir,'rooms.json')),{now:()=>t,rand:n=>n-1})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,args:['--no-sandbox']});await mkdir('consolidation-previews',{recursive:true});
 const errors=[],pages=[];
 for(const [viewport,colorScheme] of [[{width:1280,height:900},'light'],[{width:390,height:844},'dark']]){
  const ctx=await browser.newContext({viewport,colorScheme,reducedMotion:'reduce'}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());pages.push(p);
 }
 const [host,guest]=pages;
 const saved=p=>p.evaluate(()=>JSON.parse(sessionStorage.getItem('qswipe.room.v2')||'null'));
 const count=async n=>host.waitForFunction(n=>document.querySelector('#count').textContent===n+' / 12',n);
 await host.goto(origin+'/rooms/');await host.getByText('Staging room service',{exact:true}).waitFor();
 assert.equal(await host.locator('#profile-entry').evaluate(el=>el.open),false);
 assert.equal(await host.getByRole('navigation',{name:'Game mode'}).getByRole('link',{name:'Live rooms'}).getAttribute('aria-current'),'page');
 assert.equal(await host.getByRole('navigation',{name:'Game mode'}).getByRole('link',{name:'On this device'}).getAttribute('href'),'../#/play');
 await host.screenshot({path:'consolidation-previews/01-compact-entry-desktop.png',fullPage:true,animations:'disabled'});
 await host.locator('#create input[name=name]').fill('Alex');await host.locator('#create button').click();await host.locator('#invite-panel').waitFor();const invite=await host.locator('#code').textContent();
 await guest.goto(origin+'/rooms/#join='+invite);await guest.getByText('Staging room service',{exact:true}).waitFor();assert.equal(await guest.locator('#profile-entry').evaluate(el=>el.open),false);
 await guest.screenshot({path:'consolidation-previews/02-compact-join-mobile.png',fullPage:true,animations:'disabled'});
 const enter=async()=>{await guest.locator('#join input[name=name]').fill('Jamie');await guest.locator('#join button').click();await guest.locator('#room').waitFor();await count(2);};
 await enter();const old=await saved(guest);assert.ok(old?.credential);
 assert.equal(await guest.locator('#skin-panel').evaluate(el=>el.open),false);assert.equal(await guest.locator('#season-panel').evaluate(el=>el.open),false);
 await guest.screenshot({path:'consolidation-previews/03-collapsed-lobby-mobile.png',fullPage:true,animations:'disabled'});
 await guest.goto(origin+'/rooms/?reopen=1#join='+invite);await guest.locator('#room').waitFor();assert.deepEqual(await saved(guest),old);await count(2);
 await guest.getByRole('button',{name:'Leave room',exact:true}).click();await guest.locator('#entry').waitFor();await count(1);assert.equal(await saved(guest),null);
 const rejected=await guest.evaluate(async old=>{const r=await fetch('/api/rooms/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+old.credential},body:JSON.stringify({action:'state',roomId:old.roomId})});return r.status;},old);assert.equal(rejected,403);
 await enter();assert.notEqual((await saved(guest)).credential,old.credential);
 await host.locator('.tournament-setup > summary').click();await host.getByRole('textbox',{name:'Tournament title'}).fill('Friendly Cup');await host.getByRole('button',{name:'Create tournament'}).click();await host.getByText('Friendly Cup',{exact:true}).waitFor();
 await host.getByRole('button',{name:/Duck race/}).click();await guest.locator('.race-track').first().waitFor();await guest.getByRole('button',{name:'Leave room',exact:true}).click();await guest.locator('#entry').waitFor();await count(1);await host.getByText('Tournament cancelled because a player left.',{exact:true}).waitFor();
 assert.match(await host.locator('#players').textContent(),/Jamie · Left/);
 await host.screenshot({path:'consolidation-previews/04-departed-active-round.png',fullPage:true,animations:'disabled'});
 t+=6000;await host.locator('.podium').waitFor();await host.getByRole('button',{name:'Back to lobby'}).click();await count(1);await host.waitForFunction(()=>!document.querySelector('#players').textContent.includes('Jamie'));
 await enter();await guest.setViewportSize({width:320,height:780});assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await guest.locator('.game-grid .game').first().evaluate(el=>el.getBoundingClientRect().height>=44),true);
 await guest.screenshot({path:'consolidation-previews/05-reclaimed-seat-320.png',fullPage:true,animations:'disabled'});
 await host.getByRole('button',{name:'Close room',exact:true}).click();await guest.getByText('Room closed or expired. Join a new room.',{exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('Consolidation browser passed: unified modes, compact disclosures, QR resume, server-confirmed leave, revocation, active-round settlement, seat reclaim, 320px controls.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
