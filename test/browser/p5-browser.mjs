// Browser regression against actual staging assets, with fictional intercepted Auth/API.
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,join} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {encode} from 'uqr';
const require=createRequire(join(process.env.QSWIPE_BROWSER_PACKAGE,'package.json'));
const {chromium}=require('playwright');
const onboarding=process.env.QSWIPE_ONBOARDING_BROWSER==='1';const adapter=process.env.QSWIPE_ADAPTER_BROWSER==='1';const root=resolve(adapter?'dist':'public');
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
const p6=process.env.QSWIPE_P6_BROWSER==='1';const dir=onboarding?'onboarding-previews':adapter?'adapter-previews':p6?'p6-previews':'p5-previews';await mkdir(dir,{recursive:true});
async function exercise(name,width,height,manager,colorScheme='light'){
 const ctx=await browser.newContext({viewport:{width,height},colorScheme,reducedMotion:'reduce',deviceScaleFactor:1});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 let requests=[makeRequest({madeByMe:!manager})],version=1,status='absent',sends=0;let markAttempts=0,firstMark=null;const passToken='c'.repeat(64);let accepted=!onboarding||manager,employeeState='active',invites=[],shifts=[];const inviteId=id(7);
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
  if(path==='/api/staging/config')return reply({staging:true,supabaseUrl:project,publishableKey:'sb_publishable_fictionalkey',workspaceEnabled:true,securityEnabled:p6,adapterEnabled:adapter,onboardingEnabled:onboarding});
  if(path==='/api/staging/me')return reply({userId:user,memberships:accepted?[{id:id(8),workspaceId:ws}]:[],grants:manager&&auth==='Bearer '+mfa?[{membershipId:id(8),unitId:unit,role:onboarding?'level_3':'level_1'}]:[]});
  if(path==='/api/staging/roster')return reply({workspaceId:ws,rows:manager&&auth==='Bearer '+mfa?[{id:person,workspace_id:ws,unit_id:unit,display_name_snapshot:'Jordan Lee',position_snapshot:'Support specialist',isOwn:false},{id:own,workspace_id:ws,unit_id:unit,display_name_snapshot:'Alex Rivera',position_snapshot:'Team lead',isOwn:true}]:[{id:person,workspace_id:ws,unit_id:unit,display_name_snapshot:'Jordan Lee',position_snapshot:'Support specialist',isOwn:true}]});
  if(path==='/api/staging/sessions')return reply({rosterId:u.searchParams.get('roster_id'),sessions:[{sessionId:slot,opensAt:at,closesAt:close,status,version}]});
  if(path==='/api/staging/inbox'){assert.equal(auth,'Bearer '+mfa);return reply({workspaceId:ws,rows:requests.filter(r=>r.outcome==='pending'&&!r.madeByMe).map(r=>({requestId:r.requestId,sessionId:slot,rosterId:person,employee:'Jordan Lee',baseVersion:r.baseVersion,currentVersion:version,originalStatus:r.originalStatus,proposedStatus:r.proposedStatus,reason:r.reason,createdAt:r.createdAt})),nextCursor:null});}
  if(path==='/api/staging/onboarding'){const d=req.postDataJSON();if(d.action==='accept'){assert.equal(manager,false);assert.equal(d.inviteId,inviteId);assert.equal(d.code,'d'.repeat(64));accepted=true;return reply({action:'accept',workspaceId:ws,unitId:unit,inviteId,membershipId:id(8),rosterId:person,replayed:false});}assert.equal(auth,'Bearer '+mfa);assert.equal(d.workspaceId,ws);assert.equal(d.unitId,unit);const base={action:d.action,workspaceId:ws,unitId:unit,replayed:false};if(d.action==='list')return reply({workspaceId:ws,unitId:unit,timezone:'Asia/Manila',employees:[{rosterId:person,name:'Jordan Lee',status:employeeState}],invitations:invites,shifts});if(d.action==='invite'){assert.match(d.code,/^[a-f0-9]{64}$/);invites=[{inviteId,name:d.displayName,status:'pending',expiresAt:'2026-11-25T00:00:00Z'}];return reply({...base,inviteId,expiresAt:invites[0].expiresAt});}if(d.action==='cancel_invite'){invites[0].status='revoked';return reply({...base,inviteId,status:'revoked'});}if(d.action==='suspend'||d.action==='resume'){employeeState=d.action==='suspend'?'suspended':'active';return reply({...base,rosterId:person,status:employeeState});}if(d.action==='schedule'){assert.equal(d.startOffset,480);assert.equal(d.endOffset,480);assert.equal(d.localStart,'2026-11-25T22:00');assert.equal(d.localEnd,'2026-11-26T06:00');const shift={sessionId:slot,opensAt:'2026-11-25T14:00:00Z',closesAt:'2026-11-25T22:00:00Z',timezone:'Asia/Manila',localStart:d.localStart,localEnd:d.localEnd,startOffset:480,endOffset:480,eligibleCount:3};shifts=[shift];return reply({...base,...shift});}return reply({error:'INVALID'},400);}
  if(path==='/api/staging/attendance'){const d=req.postDataJSON();assert.equal(d.sessionId,slot);assert.equal(d.rosterId,person);if(d.action==='issue'){assert.equal(manager,false);const qr=encode(passToken,{ecc:'M',border:0});return reply({sessionId:slot,rosterId:person,token:passToken,expiresAt:new Date(Date.now()+60000).toISOString(),qr:qr.data.map(r=>Array.from(r,x=>x?'1':'0').join(''))});}if(d.action==='mark'){assert.equal(auth,'Bearer '+mfa);assert.equal(d.expectedVersion,0);assert.equal(d.qrToken,passToken);markAttempts++;if(markAttempts===1){firstMark=d;return reply({error:'UPSTREAM_UNAVAILABLE'},503);}assert.deepEqual(d,firstMark);version=1;status='present';return reply({sessionId:slot,rosterId:person,status,version,eventId:own,recordedAt:at,replayed:false});}return reply({error:'INVALID'},400);}
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
  async function signIn(){await page.goto(origin+'/staging/');
  await page.locator('#email').fill('fictional@example.invalid');await page.locator('#otp-request button').click();
  await page.locator('#code').fill('123456');await page.locator('#otp-verify button').click();
  await page.locator('#workspace-panel').waitFor({state:'visible'});}
  if(adapter){await page.goto(origin+'/');const entry=page.getByRole('link',{name:'Sign in to staging'});await entry.waitFor();await page.locator('.onboard').screenshot({path:dir+'/'+name+'-entry.png',animations:'disabled'});await entry.click();assert.equal(new URL(page.url()).pathname,'/staging/');await page.evaluate(()=>localStorage.clear());}
  await signIn();const started=Date.now();
  if(manager){await page.locator('#mfa-verify').waitFor({state:'visible'});await page.locator('#mfa-code').fill('123456');await page.locator('#mfa-verify button').click();await page.waitForFunction(()=>document.querySelector('#mfa-status').textContent.includes('Authenticator verified'));}
  if(onboarding){await page.locator('#onboarding-panel').waitFor({state:'visible'});if(manager){await page.locator('#onboarding-load').click();await page.locator('#onboarding-detail').waitFor({state:'visible'});await page.locator('#invite-target').fill(own);await page.locator('#invite-name').fill('Fictional new employee');await page.locator('#invite-position').fill('Support');await page.locator('#onboarding-invite button').click();await page.locator('#invite-result').waitFor({state:'visible'});assert.match(await page.locator('#invite-created-code').inputValue(),/^[a-f0-9]{64}$/);await page.locator('#invite-hide').click();assert.equal(await page.locator('#invite-created-code').inputValue(),'');await page.getByRole('button',{name:'Cancel invitation',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#onboarding-invitations').textContent.includes('revoked'));await page.getByRole('button',{name:'Suspend',exact:true}).click();await page.getByRole('button',{name:'Resume',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#onboarding-employees').textContent.includes('active'));await page.locator('#shift-start').fill('2026-11-25T22:00');await page.locator('#shift-end').fill('2026-11-26T06:00');await page.locator('#shift-start-offset').fill('480');await page.locator('#shift-end-offset').fill('480');await page.locator('#onboarding-schedule button').click();await page.waitForFunction(()=>document.querySelector('#onboarding-shifts').textContent.includes('3 eligible'));await page.locator('#onboarding-panel').screenshot({path:dir+'/'+name+'-admin.png',animations:'disabled'});}else{assert.equal(await page.locator('#onboarding-admin').isVisible(),false);assert.equal(await page.locator('#workspace option').count(),0);await page.locator('#onboarding-panel').screenshot({path:dir+'/'+name+'-accept.png',animations:'disabled'});await page.locator('#invite-id').fill(inviteId);await page.locator('#invite-code').fill('d'.repeat(64));await page.locator('#onboarding-accept button').click();await page.locator('#workspace option[value="'+ws+'"]').waitFor({state:'attached'});assert.equal(await page.locator('#invite-code').inputValue(),'');}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.locator('#load-roster').click();await page.locator('#p5-person option[value="'+person+'"]').waitFor({state:'attached'});
  if(p6&&manager){await page.locator('#p6-inbox-load').click();await page.getByRole('button',{name:'Review Jordan Lee'}).waitFor();await page.getByRole('button',{name:'Review Jordan Lee'}).click();await page.locator('#p5-details').waitFor({state:'visible'});assert.equal(await page.locator('#p5-inbox-heading').evaluate(e=>e===document.activeElement),true);}
  await page.locator('#p5-person').selectOption(person);await page.locator('#p5-session option[value="'+slot+'"]').waitFor({state:'attached'});
  await page.locator('#p5-session').selectOption(slot);await page.locator('#p5-details').waitFor({state:'visible'});
  assert.equal(await page.locator('#p5-version').textContent(),'v1');
  assert.equal(await page.getByRole('button',{name:'Approve',exact:true}).count(),manager?1:0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#p5-person').focus();assert.equal(await page.locator('#p5-person').evaluate(e=>document.activeElement===e),true);
  assert.ok(Date.now()-started<15000,'Fixture UI budget exceeded');
  if(p6){const a=await page.evaluate(()=>{const panel=document.querySelector('#p5-workspace');const controls=[...panel.querySelectorAll('button,input,select')].filter(e=>e.getClientRects().length);return {targets:controls.every(e=>e.getBoundingClientRect().height>=44),labels:[...panel.querySelectorAll('input,select')].filter(e=>e.getClientRects().length).every(e=>e.labels?.length>0),motion:getComputedStyle(panel.querySelector('.p5-card')).animationName};});assert.equal(a.targets,true);assert.equal(a.labels,true);assert.equal(a.motion,'none');}
  await page.locator('#p5-workspace').screenshot({path:dir+'/'+name+'.png',animations:'disabled'});
  if(manager){await page.getByRole('button',{name:'Approve',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#p5-version').textContent==='v2');assert.equal(await page.locator('#p5-current').textContent(),'Present');}
  else{
   const pass='fictional random words for test only';
   if(p6){await page.locator('#p6-passphrase').fill(pass);await page.locator('#p6-unlock button').click();await page.waitForFunction(()=>document.querySelector('#p6-vault-status').textContent.includes('Encrypted vault saved'));}
   await ctx.setOffline(true);await page.waitForFunction(()=>document.querySelector('#p5-network').textContent.includes('Offline'));
   await page.locator('#p5-submit-button').click();await page.waitForFunction(()=>document.querySelector('#p5-queue-count').textContent==='1');assert.equal(sends,0);
   assert.equal(await page.locator('#p5-sync').isDisabled(),true);
   await page.locator('#p5-workspace').screenshot({path:dir+'/'+name+'-offline.png',animations:'disabled'});
   await ctx.setOffline(false);
   if(p6){const snapshot=await page.evaluate(()=>Object.entries(localStorage));assert.equal(snapshot.length,1);assert.ok(snapshot[0][0].startsWith('qswipe.p6.v1.'));assert.ok(!snapshot[0][1].includes('incorrect_mark')&&!snapshot[0][1].includes('fictional')&&!snapshot[0][1].includes('requestId'));
    await page.locator('#logout').click();await page.locator('#login-panel').waitFor({state:'visible'});await signIn();
    await page.locator('#p6-passphrase').fill('wrong passphrase test only');await page.locator('#p6-unlock button').click();await page.waitForFunction(()=>document.querySelector('#p6-vault-status').textContent.includes('could not be unlocked'));assert.deepEqual(await page.evaluate(()=>Object.entries(localStorage)),snapshot);
    await page.locator('#p6-passphrase').fill(pass);await page.locator('#p6-unlock button').click();await page.waitForFunction(()=>document.querySelector('#p5-queue-count').textContent==='1');
    await page.locator('#load-roster').click();await page.locator('#p5-person option[value="'+person+'"]').waitFor({state:'attached'});await page.locator('#p5-person').selectOption(person);await page.locator('#p5-session option[value="'+slot+'"]').waitFor({state:'attached'});await page.locator('#p5-session').selectOption(slot);await page.locator('#p5-details').waitFor({state:'visible'});
    await page.locator('#p5-workspace').screenshot({path:dir+'/'+name+'-restored.png',animations:'disabled'});
   }
   await page.waitForFunction(()=>!document.querySelector('#p5-sync').disabled);
   await page.locator('#p5-sync').click();await page.waitForFunction(()=>document.querySelector('#p5-queue-count').textContent==='0');
   assert.equal(sends,1);await page.waitForFunction(()=>document.querySelector('#p5-current').textContent==='Absent');
   if(p6){await page.waitForFunction(()=>!document.querySelector('#p6-delete').disabled);await page.locator('#p6-delete').click();await page.waitForFunction(()=>localStorage.length===0);}
  }
  if(adapter){version=0;status='unmarked';requests=[];await page.locator('#adapter-report-refresh').click();await page.waitForFunction(()=>document.querySelector('#adapter-unmarked').textContent==='1');await page.locator('#p5-session').selectOption(slot);await page.locator('#adapter-attendance').waitFor({state:'visible'});assert.equal(await page.locator('#adapter-rate').textContent(),'—');if(manager){await page.locator('#adapter-token').fill(passToken);await page.locator('#adapter-redeem button').click();await page.locator('#adapter-retry').waitFor({state:'visible'});await page.locator('#adapter-retry').click();await page.waitForFunction(()=>document.querySelector('#p5-version').textContent==='v1');assert.equal(markAttempts,2);assert.equal(await page.locator('#adapter-present').textContent(),'1');assert.match(await page.locator('#p5-session option:checked').textContent(),/Present$/);await page.locator('#p5-workspace').screenshot({path:dir+'/'+name+'-marked.png',animations:'disabled'});}else{await page.locator('#adapter-issue').click();await page.locator('#adapter-qr svg').waitFor();assert.equal(await page.locator('#adapter-pass-token').inputValue(),passToken);await page.locator('#adapter-attendance').screenshot({path:dir+'/'+name+'-pass.png',animations:'disabled'});await page.locator('#adapter-hide').click();assert.equal(await page.locator('#adapter-pass-token').inputValue(),'');}assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.locator('#logout').click();await page.locator('#login-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#p5-queue-count').textContent(),'0');
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  assert.deepEqual(errors,[]);
  console.log((onboarding?'Onboarding':adapter?'R01':p6?'P6':'P5')+' browser passed: '+name+' '+width+'x'+height);
 }finally{await ctx.close();}
}
try{await exercise('manager-desktop',1280,900,true);await exercise('employee-mobile',390,844,false);await exercise('manager-mobile-dark',320,780,true,'dark');}finally{await browser.close();await new Promise(r=>server.close(r));}
