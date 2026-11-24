import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.QSWIPE_BROWSER_PACKAGE+'/node_modules/playwright');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:'inherit'});
let browser;
const origin='http://127.0.0.1:4173';
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,args:['--no-sandbox']});
 await mkdir('team-play-previews',{recursive:true});
 for(const [name,width,height,colorScheme] of [['desktop',1280,900,'light'],['mobile',390,844,'light'],['dark',320,780,'dark']]){
  const ctx=await browser.newContext({viewport:{width,height},colorScheme,reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(origin);await page.locator('#ws-name').fill('Orion Team');await page.locator('#owner-name').fill('Alex Rivera');await page.locator('#owner-level').selectOption('3');await page.locator('#create-form button[type=submit]').click();
  await page.waitForFunction(()=>{const d=JSON.parse(localStorage.getItem('qswipe-v3')||'null');return !!d?.activeId;});
  await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('qswipe-v3')),w=d.workspaces[d.activeId];w.people.push({id:'jamie123',name:'Jamie Cruz',level:0,parentId:w.ownerId,position:'Member',branch:'',joined:'manual',createdAt:Date.now()},{id:'morgan12',name:'Morgan Lee',level:0,parentId:w.ownerId,position:'Member',branch:'',joined:'manual',createdAt:Date.now()});w.gameEntries='Alex Rivera\nJamie Cruz\nMorgan Lee';d.settings.motion='reduced';d.settings.sound=false;localStorage.setItem('qswipe-v3',JSON.stringify(d));window.dispatchEvent(new StorageEvent('storage',{key:'qswipe-v3'}));});
  await page.reload();await page.locator('.engage-summary').waitFor();assert.equal(await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('qswipe-v3'));return d.workspaces[d.activeId].people.length;}),3);await page.screenshot({path:'team-play-previews/'+name+'-today.png',fullPage:true});
  await page.goto(origin+'/#/play/wheel');await page.locator('[data-action=spin]').first().click();await page.locator('.stage-result .winner').waitFor();await page.screenshot({path:'team-play-previews/'+name+'-wheel.png',fullPage:true});
  await page.locator('[data-game=race]').click();await page.locator('[data-action=race-start]').click();await page.locator('.podium').waitFor();await page.screenshot({path:'team-play-previews/'+name+'-race.png',fullPage:true});
  await page.locator('[data-game=cards]').click();await page.locator('[data-action=flip]').first().click();await page.locator('.stage-result .winner').waitFor();await page.screenshot({path:'team-play-previews/'+name+'-cards.png',fullPage:true});
  await page.locator('[data-game=trivia]').click();await page.locator('[data-action=trivia-start]').click();await page.locator('[data-action=trivia-answer]').first().click();await page.locator('[data-action=trivia-next]').click();await page.locator('.trivia-q').waitFor();
  await page.locator('[data-game=challenge]').click();await page.locator('.challenge-players').waitFor();await page.screenshot({path:'team-play-previews/'+name+'-challenge.png',fullPage:true});
  await page.locator('form[data-submit=challenge-start] button').click();for(let i=0;i<10;i++){
   const q=await page.locator('.challenge-turn h2').textContent();const match=q.match(/(\d+) \+ (\d+)/);assert.ok(match);const answer=Number(match[1])+Number(match[2]);const opts=page.locator('[data-action=challenge-answer]');const texts=await opts.allTextContents();const k=texts.findIndex((x,j)=>x===String(j+1)+String(answer));assert.ok(k>=0);await opts.nth(k).click();
  }
  await page.getByText('Team round complete!').waitFor();assert.equal(await page.locator('.engage-rank').count(),2);
  assert.equal(await page.locator('.achievement.unlocked').count(),2);await page.screenshot({path:'team-play-previews/'+name+'-results.png',fullPage:true});
  await page.reload();await page.locator('.challenge-players').waitFor();assert.equal(await page.locator('.engage-rank').count(),2);assert.equal(await page.locator('.achievement.unlocked').count(),2);
  assert.equal(await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('qswipe-v3'));return d.workspaces[d.activeId].playScores.length;}),2);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('form[data-submit=challenge-start] button').click();
  for(let i=0;i<10;i++)await page.locator('[data-action=challenge-answer]').first().click();
  await page.getByText('Team round complete!').waitFor();assert.match(await page.locator('.challenge-intro [role=status]').textContent(),/^0 scored/);
  // Historical eligibility is rendered from persisted, fictional local data after reload.
  await page.evaluate(()=>{
   const d=JSON.parse(localStorage.getItem('qswipe-v3')),w=d.workspaces[d.activeId],owner=w.people.find(p=>p.id===w.ownerId);
   const iso=offset=>{const n=new Date();n.setDate(n.getDate()+offset);return [n.getFullYear(),String(n.getMonth()+1).padStart(2,'0'),String(n.getDate()).padStart(2,'0')].join('-');};
   const old={id:'former12',name:'Former member',level:0,parentId:owner.id,position:'Member',branch:'',joined:'manual',createdAt:Date.now()-172800000};
   const fresh={id:'current12',name:'Current member',level:0,parentId:owner.id,position:'Member',branch:'',joined:'manual',createdAt:Date.now()-86400000};
   const days=[0,1,2,3,4,5,6];w.createdAt=new Date(iso(-2)+'T12:00:00').getTime();w.config.days=days;w.people=[owner,fresh];
   w.rosterHistory=[{date:iso(-2),days,people:[owner,old]},{date:iso(-1),days,people:[owner,fresh]}];
   w.attendance={[iso(-2)]:{[old.id]:{s:'present',at:Date.now()-172800000,by:owner.id}},[iso(-1)]:{[fresh.id]:{s:'absent',at:Date.now()-86400000,by:owner.id}}};
   localStorage.setItem('qswipe-v3',JSON.stringify(d));
  });
  await page.goto(origin+'/#/reports');await page.reload();await page.locator('#rep-body').waitFor();
  const oldRow=page.locator('#rep-body tr').filter({hasText:'Former member'}),newRow=page.locator('#rep-body tr').filter({hasText:'Current member'});
  assert.deepEqual((await oldRow.locator('td').allTextContents()).slice(2,5),['1','0','0']);
  assert.deepEqual((await newRow.locator('td').allTextContents()).slice(2,5),['0','1','1']);
  assert.equal(await page.locator('#rep-body tr').count(),2);
  const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=rep-export]').click();const csv=await downloadPromise;
  const csvText=await readFile(await csv.path(),'utf8');assert.equal(csvText.trim().split('\r\n').length,4);assert.equal(csvText.split('\n').filter(x=>x.includes('"Former member"')).length,1);assert.equal(csvText.split('\n').filter(x=>x.includes('"Current member"')).length,2);
  await page.screenshot({path:'team-play-previews/'+name+'-historical-reports.png',fullPage:true,animations:'disabled'});
  await page.goto(origin+'/#/play');await page.locator('.game-mode-nav').waitFor();assert.equal(await page.locator('.game-mode-nav a[aria-current=page]').textContent(),'On this device');assert.equal(await page.locator('.game-mode-nav a').last().getAttribute('href'),'./rooms/');
  await page.screenshot({path:'team-play-previews/'+name+'-unified-play.png',fullPage:true,animations:'disabled'});
  await page.goto(origin+'/#/welcome');await page.locator('#ws-name').fill('Other Team');await page.locator('#owner-name').fill('Taylor');await page.locator('#create-form button[type=submit]').click();
  await page.locator('.engage-summary').waitFor();await page.goto(origin+'/#/play/challenge');await page.locator('.challenge-players').waitFor();assert.equal(await page.locator('.engage-rank').count(),0);assert.equal(await page.locator('.achievement.unlocked').count(),0);
  assert.deepEqual(errors,[]);
  await ctx.close();console.log('Team play browser passed:',name);
 }
}finally{await browser?.close();server.kill();}
