import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createRoomHttpServer} from '../../lib/rooms/http.mjs';
import {createRoomService} from '../../lib/rooms/service.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.QSWIPE_BROWSER_PACKAGE+'/node_modules/playwright');
const server=createRoomHttpServer({service:createRoomService({rand:n=>n-1})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,args:['--no-sandbox']});await mkdir('seasonal-previews',{recursive:true});
 const pages=[],errors=[];
 for(const [viewport,colorScheme,reducedMotion] of [[{width:1280,height:900},'light','no-preference'],[{width:390,height:844},'dark','reduce']]){
  const ctx=await browser.newContext({viewport,colorScheme,reducedMotion});const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());pages.push(p);
 }
 const [host,guest]=pages;
 async function profile(p,name,invite=''){
  await p.goto(origin+'/rooms/'+(invite?'#join='+invite:''));await p.getByText('Staging room service',{exact:true}).waitFor();
  await p.locator('#profile-entry > summary').click();
  await p.locator('#profile-create input[name=name]').fill(name);await p.locator('#profile-create input[name=remember]').check();await p.getByRole('button',{name:'Create player profile'}).click();await p.locator('#profile-content .passport-head h2').filter({hasText:name}).waitFor();
 }
 await profile(host,'Alex');await host.locator('#profile-content .zodiac-details summary').click();assert.equal(await host.locator('.zodiac-details .collectible:visible').count(),12);
 await host.screenshot({path:'seasonal-previews/01-zodiac-collection.png',fullPage:true,animations:'disabled'});
 await host.locator('#profile-entry > summary').click();await host.locator('#create button').click();await host.locator('#invite-panel').waitFor();const invite=await host.locator('#code').textContent();
 await profile(guest,'Jamie',invite);await guest.locator('#join button').click();await guest.locator('#room').waitFor();await host.waitForFunction(()=>document.querySelector('#count').textContent==='2 / 12');
 assert.equal(await host.locator('#profile-room').getAttribute('open'),null);assert.equal(await host.locator('.game-grid .game').count(),8);
 await host.screenshot({path:'seasonal-previews/02-game-first-desktop.png',fullPage:true,animations:'disabled'});await guest.screenshot({path:'seasonal-previews/03-compact-mobile-dark.png',fullPage:true,animations:'disabled'});
 await host.getByRole('button',{name:/Charades/}).click();await guest.locator('.charades-prompt').waitFor();assert.equal(await guest.locator('.charades-prompt').textContent(),'TEAPOT');await host.getByRole('textbox',{name:'Your guess'}).waitFor();assert.equal(await host.locator('.charades-prompt').count(),0);
 await host.screenshot({path:'seasonal-previews/04-charades-guesser.png',fullPage:true,animations:'disabled'});await guest.screenshot({path:'seasonal-previews/05-charades-actor-mobile.png',fullPage:true,animations:'disabled'});
 await host.getByRole('textbox',{name:'Your guess'}).fill('teapot');await host.getByRole('button',{name:'Guess',exact:true}).click();
 for(const p of pages)await p.getByText('Charades! Alex guessed correctly',{exact:true}).waitFor();
 assert.match(await host.locator('#season-ranks').textContent(),/30 pts/);assert.match(await guest.locator('#season-ranks').textContent(),/20 pts/);
 await host.locator('#profile-room > summary').click();assert.match(await host.locator('#profile-room .passport-head').textContent(),/55 lifetime points/);
 await host.screenshot({path:'seasonal-previews/06-season-results-passport.png',fullPage:true,animations:'disabled'});
 await host.getByRole('button',{name:'Close room',exact:true}).click();await host.reload();await host.locator('#profile-entry > summary').click();await host.locator('#profile-content .passport-head').waitFor();
 await host.locator('#profile-content .zodiac-details summary').click();await host.locator('#profile-content .collectible').filter({hasText:'Aries'}).getByRole('button',{name:'Equip'}).click();
 await host.locator('#profile-content .collectible').filter({hasText:'Aries'}).getByRole('button',{name:'Selected'}).waitFor();
 await host.locator('#profile-content').getByRole('button',{name:'Scarf',exact:true}).click();await host.getByText('Scarf ✓',{exact:true}).waitFor();
 await host.screenshot({path:'seasonal-previews/07-equipped-zodiac-accessory.png',fullPage:true,animations:'disabled'});
 for(const p of pages)assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Seasonal games browser passed: compact layouts, 12 zodiac collectibles, private charades roles, accessory and season points.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
