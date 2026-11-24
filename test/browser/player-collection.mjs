import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoomHttpServer} from '../../lib/rooms/http.mjs';
import {createPersistentRoomService,createFileStore} from '../../lib/rooms/persistence.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.QSWIPE_BROWSER_PACKAGE+'/node_modules/playwright');
const dir=await mkdtemp(join(tmpdir(),'qs-collection-')),store=createFileStore(join(dir,'rooms.json'));
let t=Date.now();const server=createRoomHttpServer({service:createPersistentRoomService(store,{now:()=>t,rand:n=>n-1})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,args:['--no-sandbox']});await mkdir('collection-previews',{recursive:true});
 const pages=[],errors=[];
 for(const [viewport,colorScheme,reducedMotion] of [[{width:1280,height:900},'light','no-preference'],[{width:390,height:844},'dark','reduce']]){
  const ctx=await browser.newContext({viewport,colorScheme,reducedMotion});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());pages.push(p);}
 const [host,guest]=pages;
 async function profile(p,name,invite=''){
  await p.goto(origin+'/rooms/'+(invite?'#join='+invite:''));await p.getByText('Staging room service',{exact:true}).waitFor();
  await p.locator('#profile-create input[name=name]').fill(name);await p.locator('#profile-create input[name=remember]').check();await p.getByRole('button',{name:'Create player profile'}).click();await p.locator('#profile-content .passport-head h2').filter({hasText:name}).waitFor();
  assert.equal(await p.locator('#profile-content .collectible').count(),17);assert.equal(await p.locator('#profile-content .collectible.unlocked').count(),1);
 }
 await profile(host,'Alex');await host.screenshot({path:'collection-previews/01-player-passport.png',fullPage:true,animations:'disabled'});await host.locator('#create button').click();await host.locator('#invite-panel').waitFor();const invite=await host.locator('#code').textContent();
 await profile(guest,'Jamie',invite);await guest.locator('#join button').click();await guest.locator('#room').waitFor();await host.waitForFunction(()=>document.querySelector('#count').textContent==='2 / 12');
 await host.getByRole('textbox',{name:'Tournament title'}).fill('Orion Team Cup');await host.getByRole('textbox',{name:'Custom trophy name'}).fill('Orion Champion');await host.getByRole('combobox',{name:'Trophy style'}).selectOption('Golden duck');await host.getByRole('button',{name:'Create tournament'}).click();await host.getByText('Orion Team Cup',{exact:true}).waitFor();
 await host.screenshot({path:'collection-previews/02-custom-tournament.png',fullPage:true,animations:'disabled'});
 for(let r=0;r<3;r++){
  await host.getByRole('button',{name:/Team bingo/}).click();for(const p of pages)await p.locator('.bingo-grid').waitFor();
  assert.equal(await host.locator('.bingo-cell').count(),25);assert.equal(await guest.locator('.bingo-cell').count(),25);
  t+=4500;await host.waitForFunction(()=>document.querySelectorAll('.bingo-cell.called:not([disabled])').length>=5);
  if(r===0){await host.screenshot({path:'collection-previews/03-bingo-desktop.png',fullPage:true,animations:'disabled'});await guest.screenshot({path:'collection-previews/04-bingo-mobile-dark.png',fullPage:true,animations:'disabled'});}
  for(let i=0;i<5;i++)await host.locator('.bingo-cell').nth(i).click();
  for(const p of pages)await p.getByText('Bingo! Alex wins!',{exact:true}).waitFor();
  if(r<2)await host.getByRole('button',{name:'Back to lobby'}).click();
 }
 await host.locator('#profile-room > summary').click();await guest.locator('#profile-room > summary').click();await host.locator('#profile-room .history-row').waitFor();assert.equal(await host.locator('#profile-room .collectible.unlocked').count(),8);assert.match(await host.locator('#profile-room .passport-head').textContent(),/145 lifetime points/);
 await host.screenshot({path:'collection-previews/05-bingo-tournament-result.png',fullPage:true,animations:'disabled'});await guest.screenshot({path:'collection-previews/06-participant-history-dark.png',fullPage:true,animations:'disabled'});
 await host.getByRole('button',{name:'Close room',exact:true}).click();await guest.getByText('Room closed or expired. Join a new room.',{exact:true}).waitFor();
 await host.reload();await host.locator('#profile-content .history-row').waitFor();assert.match(await host.locator('#profile-content .history-row').textContent(),/Orion Champion/);assert.equal(await host.locator('#profile-content .collectible.unlocked').count(),8);
 await host.locator('#profile-content .collectible').filter({hasText:'Nova'}).getByRole('button',{name:'Equip'}).click();await host.locator('#profile-content .collectible').filter({hasText:'Nova'}).getByRole('button',{name:'Selected'}).waitFor();
 await host.screenshot({path:'collection-previews/07-unlocked-mascots-history.png',fullPage:true,animations:'disabled'});
 for(const p of pages){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.evaluate(()=>sessionStorage.length),0);}
 assert.deepEqual(errors,[]);console.log('Player collection browser passed: two independent profiles, custom trophy, bingo, daily rewards, all mascots, history and reload.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
