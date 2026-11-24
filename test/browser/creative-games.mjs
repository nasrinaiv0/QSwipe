import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {createRoomHttpServer} from '../../lib/rooms/http.mjs';
import {createRoomService} from '../../lib/rooms/service.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.QSWIPE_BROWSER_PACKAGE+'/node_modules/playwright');
const server=createRoomHttpServer({service:createRoomService({rand:n=>n-1})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,args:['--no-sandbox']});await mkdir('creative-previews',{recursive:true});
 const pages=[],errors=[];
 for(const [viewport,colorScheme,reducedMotion] of [[{width:1280,height:900},'light','no-preference'],[{width:390,height:844},'dark','reduce']]){
  const ctx=await browser.newContext({viewport,colorScheme,reducedMotion});const p=await ctx.newPage();await p.addInitScript(()=>{window.__roomFrames=0;window.__raceLayoutReads=0;const raf=window.requestAnimationFrame;window.requestAnimationFrame=function(fn){window.__roomFrames++;return raf.call(window,fn);};const width=Object.getOwnPropertyDescriptor(Element.prototype,'clientWidth');Object.defineProperty(Element.prototype,'clientWidth',{...width,get(){if(this.classList?.contains('race-track'))window.__raceLayoutReads++;return width.get.call(this);}});});p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());pages.push(p);
 }
 const [host,guest]=pages;
 async function profile(p,name,invite=''){
  await p.goto(origin+'/rooms/'+(invite?'#join='+invite:''));await p.getByText('Staging room service',{exact:true}).waitFor();
  await p.locator('#profile-entry > summary').click();
  await p.locator('#profile-create input[name=name]').fill(name);await p.locator('#profile-create input[name=remember]').check();await p.getByRole('button',{name:'Create player profile'}).click();await p.locator('#profile-content .passport-head h2').filter({hasText:name}).waitFor();
 }
 await profile(host,'Alex');await host.getByRole('button',{name:'High five mascot'}).click();await host.getByText('✦ High five!',{exact:true}).waitFor();
 await host.screenshot({path:'creative-previews/01-interactive-mascot.png',fullPage:true,animations:'disabled'});
 await host.locator('#create button').click();await host.locator('#invite-panel').waitFor();const invite=await host.locator('#code').textContent();
 await profile(guest,'Jamie',invite);await guest.locator('#join button').click();await guest.locator('#room').waitFor();await host.waitForFunction(()=>document.querySelector('#count').textContent==='2 / 12');
 await host.locator('.game-settings > summary').click();
 await host.getByRole('button',{name:'space race world'}).click();await host.locator('[aria-label="space race world"][aria-pressed=true]').waitFor();
 await host.screenshot({path:'creative-previews/02-game-settings.png',fullPage:true,animations:'disabled'});
 await host.getByRole('button',{name:/Duck race/}).click();for(const p of pages)await p.locator('.race-track.theme-space').first().waitFor();
 await host.waitForFunction(()=>document.querySelector('#stage').classList.contains('motion-running'));
 const sample=p=>p.evaluate(async()=>{const frames=window.__roomFrames,reads=window.__raceLayoutReads;await new Promise(r=>setTimeout(r,250));return {frames:window.__roomFrames-frames,reads:window.__raceLayoutReads-reads};});
 const normal=await sample(host),reduced=await sample(guest);
 assert.ok(normal.frames>0,'normal-motion race must animate');assert.equal(normal.reads,0,'race loop must not measure track width');assert.equal(reduced.frames,0,'reduced motion must not schedule a continuous frame loop');assert.equal(reduced.reads,0);
 await host.screenshot({path:'creative-previews/03-space-race.png',fullPage:true,animations:'disabled'});
 for(const p of pages)await p.locator('.podium').waitFor();
 for(const p of pages){assert.equal(await p.locator('#stage').evaluate(el=>el.classList.contains('motion-running')),false);assert.equal(await p.locator('.duck span').first().evaluate(el=>getComputedStyle(el).animationName),'none');assert.equal(await p.locator('.duck').first().evaluate(el=>getComputedStyle(el).willChange),'auto');}
 const geometry=()=>host.locator('.race-track').first().evaluate(el=>{const t=el.getBoundingClientRect(),d=el.querySelector('.duck').getBoundingClientRect();return Math.abs(d.left-t.left-Math.max(0,t.width-58));});
 assert.ok(await geometry()<2,'desktop finish position');await host.setViewportSize({width:320,height:780});assert.ok(await geometry()<2,'responsive finish position');assert.equal(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await host.screenshot({path:'creative-previews/08-race-finished-320.png',fullPage:true,animations:'disabled'});await host.setViewportSize({width:1280,height:900});
 console.log('Motion acceptance: zero per-frame track reads, reduced-motion frame loop stopped, idle duck animation stopped, finish geometry responsive.');
 await host.getByRole('button',{name:'Back to lobby'}).click();
 for(let i=0;i<2;i++){
  await host.getByRole('button',{name:/Draw & guess/}).click();await guest.locator('.drawing-surface[role="application"][data-strokes="0"]').waitFor();await host.locator('.drawing-surface[data-strokes="0"]').waitFor();assert.equal(await host.locator('.charades-prompt').count(),0);
  const surface=guest.locator('.drawing-surface[role="application"]');await surface.scrollIntoViewIfNeeded();const box=await surface.boundingBox();
  await guest.mouse.move(box.x+box.width*.2,box.y+box.height*.6);await guest.mouse.down();await guest.mouse.move(box.x+box.width*.5,box.y+box.height*.2,{steps:8});await guest.mouse.move(box.x+box.width*.8,box.y+box.height*.6,{steps:8});await guest.mouse.up();
  await host.locator('.drawing-surface[data-strokes="1"]').waitFor();
  await guest.locator('.drawing-surface[data-strokes="1"]').focus();await guest.keyboard.press('Enter');await host.locator('.drawing-surface[data-strokes="2"]').waitFor();
  if(i===0){await host.screenshot({path:'creative-previews/04-drawing-guesser.png',fullPage:true,animations:'disabled'});await guest.screenshot({path:'creative-previews/05-drawing-artist-mobile.png',fullPage:true,animations:'disabled'});}
  await host.getByRole('textbox',{name:'Your guess'}).fill('teapot');await host.getByRole('button',{name:'Guess',exact:true}).click();
  for(const p of pages)await p.getByText('Draw & guess! Alex guessed correctly',{exact:true}).waitFor();await host.getByRole('button',{name:'Back to lobby'}).click();
 }
 if(!await host.locator('.game-settings').evaluate(el=>el.open))await host.locator('.game-settings > summary').click();
 await host.locator('.custom-editor summary').click();
 for(let i=0;i<5;i++){
  await host.getByRole('textbox',{name:'Custom question',exact:true}).fill('Team question '+(i+1)+'?');
  for(let j=0;j<4;j++)await host.getByRole('textbox',{name:'Answer '+(j+1),exact:true}).fill(['Red','Blue','Green','Gold'][j]);
  await host.getByRole('combobox',{name:'Correct answer'}).selectOption('2');await host.getByRole('button',{name:'Save question'}).click();await host.locator('.custom-editor summary').filter({hasText:(i+1)+'/5'}).waitFor();
 }
 await host.getByRole('button',{name:/Custom trivia/}).click();
 for(let i=0;i<5;i++){
  for(const p of pages){await p.locator('.question').filter({hasText:'Team question '+(i+1)+'?'}).waitFor();await p.getByRole('button',{name:'Green',exact:true}).click();}
  await host.getByText('Correct answer: Green · Nice work!',{exact:true}).waitFor();
  if(i===0)await host.screenshot({path:'creative-previews/06-custom-trivia.png',fullPage:true,animations:'disabled'});
  if(i<4)await host.getByRole('button',{name:'Next question'}).click();
 }
 await host.getByText('Custom trivia complete · practice only',{exact:true}).waitFor();await host.getByRole('button',{name:'Close room',exact:true}).click();await host.reload();await host.locator('#profile-entry > summary').click();await host.locator('#profile-content .passport-head').waitFor();
 await host.getByRole('button',{name:'Comet pin',exact:true}).click();await host.getByText('Comet pin ✓',{exact:true}).waitFor();await host.screenshot({path:'creative-previews/07-seasonal-reward.png',fullPage:true,animations:'disabled'});
 for(const p of pages)assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('Creative games browser passed: mascot reaction, race worlds, pointer/keyboard drawing, practice trivia and seasonal reward.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
