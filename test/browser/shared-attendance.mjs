import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoomHttpServer} from '../../lib/rooms/http.mjs';
import {createFileStore,createPersistentRoomService} from '../../lib/rooms/persistence.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.QSWIPE_BROWSER_PACKAGE+'/node_modules/playwright');
const dir=await mkdtemp(join(tmpdir(),'qs-shared-')),store=createFileStore(join(dir,'rooms.json'));let t=Date.parse('2026-11-24T04:00:00Z');
const server=createRoomHttpServer({attendanceEnabled:true,service:createPersistentRoomService(store,{now:()=>t,attendanceEnabled:true})});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,args:['--no-sandbox']});await mkdir('shared-attendance-previews',{recursive:true});
 const pages=[],errors=[];
 for(const [viewport,colorScheme] of [[{width:1280,height:900},'light'],[{width:390,height:844},'dark']]){
  const ctx=await browser.newContext({viewport,colorScheme,reducedMotion:'reduce'}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());pages.push(p);
 }
 const [owner,member]=pages;
 const snap=(p,n)=>p.screenshot({path:'shared-attendance-previews/'+n+'.png',fullPage:true,animations:'disabled'});
 async function passport(p,name){await p.goto(origin+'/rooms/attendance.html');await p.locator('#passport-create').waitFor();await p.locator('#passport-create input[name=name]').fill(name);await p.locator('#passport-create input[name=remember]').check();await p.getByRole('button',{name:'Create passport'}).click();await p.locator('#team-entry').waitFor();}
 await passport(owner,'Alex');await owner.locator('#team-create-panel summary').click();await owner.locator('#team-create input[name=name]').fill('Orion Team');await owner.locator('#team-create input[name=timezone]').fill('Asia/Manila');await owner.getByRole('button',{name:'Create team',exact:true}).click();await owner.locator('#team-workspace').waitFor();
 await owner.locator('details[data-section=members] summary').click();const invite=await owner.locator('.att-invite').textContent();
 await passport(member,'Jamie');await member.locator('#team-join-panel summary').click();await member.locator('#team-join input[name=invite]').fill(invite);await member.getByRole('button',{name:'Join team',exact:true}).click();await member.locator('#team-workspace').waitFor();
 await owner.waitForFunction(()=>document.querySelector('details[data-section=members] summary').textContent.includes('2'));
 await owner.getByRole('button',{name:'Open today’s check-in'}).click();await member.getByRole('button',{name:'Check in',exact:true}).waitFor();
 assert.equal(await member.locator('#team-content .att-row').count(),1);assert.equal(await member.locator('.att-invite').count(),0);assert.equal(await member.locator('details[data-section=members]').count(),0);
 await snap(member,'01-member-check-in-mobile');
 await member.getByRole('button',{name:'Check in',exact:true}).click();await member.locator('.att-status.present').waitFor();
 await owner.locator('.att-row').filter({hasText:'Jamie'}).locator('.att-status.present').waitFor();
 await owner.getByRole('button',{name:'present Alex',exact:true}).click();await owner.locator('.att-row').filter({hasText:'Alex · You'}).locator('.att-status.present').waitFor();
 await owner.locator('details[data-section=members] summary').click();await snap(owner,'02-owner-register-desktop');
 await owner.getByRole('button',{name:'Close check-in',exact:true}).click();await owner.locator('.att-session-head .pill').filter({hasText:'Closed'}).waitFor();
 t+=86400000;await owner.getByRole('button',{name:'Open today’s check-in'}).waitFor();await owner.getByRole('button',{name:'Open today’s check-in'}).click();await owner.locator('details[data-section=history] summary').click();await snap(owner,'03-history-desktop');
 await member.reload();await member.getByRole('button',{name:'Orion Team · Member'}).click();await member.getByRole('button',{name:'Check in',exact:true}).waitFor();await member.setViewportSize({width:320,height:780});assert.equal(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await snap(member,'04-member-320');
 await member.getByRole('link',{name:'Live rooms',exact:true}).click();await member.locator('#passport-entry-label').filter({hasText:'Jamie'}).waitFor();
 assert.equal(await member.locator('#create').isVisible(),true);assert.equal(await member.locator('#join').isVisible(),false);
 await snap(member,'05-host-selector-mobile');await member.locator('#join-mode').click();assert.equal(await member.locator('#create').isVisible(),false);assert.equal(await member.locator('#join').isVisible(),true);await snap(member,'06-join-selector-mobile');
 await member.locator('#host-mode').click();await member.locator('#create button').click();await member.locator('#room').waitFor();assert.match(await member.locator('#players').textContent(),/Jamie/);
 await member.getByRole('button',{name:'Close room',exact:true}).click();
 await member.getByRole('link',{name:'Attendance',exact:true}).click();await member.getByRole('button',{name:'Orion Team · Member'}).waitFor();
 assert.deepEqual(errors,[]);console.log('Shared attendance browser passed: common passport, private own records, daily check-in, owner roster, session history, 320px controls, host/join selector and game identity.');
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
