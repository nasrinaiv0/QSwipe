// Browser regression against actual staging assets, with fictional intercepted Auth/API.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(join(process.env.QSWIPE_BROWSER_PACKAGE,'package.json'));
const {chromium}=require('playwright');
const root=resolve('public');
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const path=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
  if(!path.startsWith(root+'/')){res.writeHead(403);return res.end();}
  const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(path)]??'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(await readFile(path));
 }catch{res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.QSWIPE_CHROME,headless:true,args:['--no-sandbox']});
const id=n=>String(n).repeat(8)+'-1111-4111-8111-111111111111';
const user=id(1),ws=id(2),unit=id(3),person=id(4),slot=id(5),request=id(6),factor=id(7),challenge=id(8),own=id(9);
const token='a'.repeat(80),mfa='b'.repeat(80),project='https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
const at='2026-11-24T01:00:00Z',close='2026-11-24T09:00:00Z';
const makeRequest=(over={})=>({requestId:request,baseVersion:1,originalStatus:'absent',proposedStatus:'present',reason:'incorrect_mark',createdAt:at,madeByMe:false,outcome:'pending',decisionReason:null,resultingVersion:null,decidedAt:null,...over});
await mkdir('p5-previews',{recursive:true});
async function exercise(name,width,height,manager,colorScheme='light'){
 const ctx=await browser.newContext({viewport:{width,height},colorScheme,reducedMotion:'reduce',deviceScaleFactor:1});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 let requests=[makeRequest({madeByMe:!manager})],version=1,status='absent',sends=0;
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url()),path=u.pathname,auth=req.headers().authorization;
  const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:JSON.stringify(body)});
  if(req.method()==='OPTIONS')return reply({});
  if(u.origin===project){
   if(path.endsWith('/otp'))return reply({});
   if(path.endsWith('/challenge'))return reply({id:challenge});
   if(path.includes('/factors/')&&path.endsWith('/verify'))return reply({access_token:mfa});
   if(path.endsWith('/verify'))return reply({access_token:token});
   if(path.endsWith('/user'))return reply({id:user,role:'authenticated',email_confirmed_at:at,factors:[{id:factor,factor_type:'totp',status:'verified',friendly_name:'Test authenticator'}]});
   if(path.endsWith('/logout'))return reply({});
   return route.abort();
  }
  if(u.origin!==origin)return route.abort();
  if(path==='/api/staging/config')return reply({staging:true,supabaseUrl:project,publishableKey:'sb_publishable_fictionalkey',workspaceEnabled:true});
  if(path==='/api/staging/me')return reply({userId:user,memberships:[{id:id(8),workspaceId:ws}],grants:manager&&auth==='Bearer '+mfa?[{unitId:unit,role:'level_1'}]:[]});
  if(path==='/api/staging/roster')return reply({workspaceId:ws,rows:manager&&auth==='Bearer '+mfa?[{id:person,workspace_id:ws,unit_id:unit,display_name_snapshot:'Jordan Lee',position_snapshot:'Support specialist',isOwn:false},{id:own,workspace_id:ws,unit_id:unit,display_name_snapshot:'Alex Rivera',position_snapshot:'Team lead',isOwn:true}]:[{id:person,workspace_id:ws,unit_id:unit,display_name_snapshot:'Jordan Lee',position_snapshot:'Support specialist',isOwn:true}]});
  if(path==='/api/staging/sessions')return reply({rosterId:u.searchParams.get('roster_id'),sessions:[{sessionId:slot,opensAt:at,closesAt:close,status,version}]});
  if(path==='/api/staging/approvals'){
   const d=req.postDataJSON();
   if(d.action==='list')return reply({sessionId:d.sessionId,rosterId:d.rosterId,currentVersion:version,currentStatus:status,requests});
   if(d.action==='submit'){sends++;const r=makeRequest({requestId:d.requestId,baseVersion:d.expectedVersion,originalStatus:status,proposedStatus:d.status,reason:d.reason,madeByMe:true});requests=[r,...requests];return reply({...r,sessionId:d.sessionId,rosterId:d.rosterId,replayed:false});}
   if(d.action==='decide'){assert.equal(auth,'Bearer '+mfa);requests=requests.map(r=>r.requestId===d.requestId?{...r,outcome:d.outcome,decisionReason:d.reason,decidedAt:close,resultingVersion:d.outcome==='approved'?2:1}:r);if(d.outcome==='approved'){version=2;status='present';}return reply({...requests.find(r=>r.requestId===d.requestId),sessionId:d.sessionId,rosterId:d.rosterId,replayed:false});}
   return reply({error:'INVALID'},400);
  }
  if(path.startsWith('/api/'))return reply({error:'UNKNOWN'},404);
  return route.continue();
 });
 try{
  await page.goto(origin+'/staging/');
  await page.locator('#email').fill('fictional@example.invalid');await page.locator('#otp-request button').click();
  await page.locator('#code').fill('123456');await page.locator('#otp-verify button').click();
  await page.locator('#workspace-panel').waitFor({state:'visible'});
  if(manager){await page.locator('#mfa-verify').waitFor({state:'visible'});await page.locator('#mfa-code').fill('123456');await page.locator('#mfa-verify button').click();await page.waitForFunction(()=>document.querySelector('#mfa-status').textContent.includes('Authenticator verified'));}
  await page.locator('#load-roster').click();await page.locator('#p5-person option[value="'+person+'"]').waitFor({state:'attached'});
  await page.locator('#p5-person').selectOption(person);await page.locator('#p5-session option[value="'+slot+'"]').waitFor({state:'attached'});
  await page.locator('#p5-session').selectOption(slot);await page.locator('#p5-details').waitFor({state:'visible'});
  assert.equal(await page.locator('#p5-version').textContent(),'v1');
  assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),manager?1:0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#p5-person').focus();assert.equal(await page.locator('#p5-person').evaluate(e=>document.activeElement===e),true);
  await page.locator('#p5-workspace').screenshot({path:'p5-previews/'+name+'.png',animations:'disabled'});
  if(manager){await page.getByRole('button',{name:'Approve',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#p5-version').textContent==='v2');assert.equal(await page.locator('#p5-current').textContent(),'Present');}
  else{
   await ctx.setOffline(true);await page.waitForFunction(()=>document.querySelector('#p5-network').textContent.includes('Offline'));
   await page.locator('#p5-submit-button').click();assert.equal(await page.locator('#p5-queue-count').textContent(),'1');assert.equal(sends,0);
   assert.equal(await page.locator('#p5-sync').isDisabled(),true);
   await page.locator('#p5-workspace').screenshot({path:'p5-previews/'+name+'-offline.png',animations:'disabled'});
   await ctx.setOffline(false);await page.waitForFunction(()=>!document.querySelector('#p5-sync').disabled);
   await page.locator('#p5-sync').click();await page.waitForFunction(()=>document.querySelector('#p5-queue-count').textContent==='0');
   assert.equal(sends,1);assert.equal(await page.locator('#p5-current').textContent(),'Absent');
  }
  await page.locator('#logout').click();await page.locator('#login-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#p5-queue-count').textContent(),'0');
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  assert.deepEqual(errors,[]);
  console.log('P5 browser passed: '+name+' '+width+'x'+height);
 }finally{await ctx.close();}
}
try{await exercise('manager-desktop',1280,900,true);await exercise('employee-mobile',390,844,false);await exercise('manager-mobile-dark',320,780,true,'dark');}finally{await browser.close();await new Promise(r=>server.close(r));}
