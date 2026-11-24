import test from 'node:test';
import assert from 'node:assert/strict';
import {CorrectionQueue,correctionDraft} from '../public/staging/sync-queue.js';
import {listSessions} from '../lib/staging/workspace.js';
import handler from '../api/staging/sessions.js';
const id=n=>String(n).repeat(8)+'-1111-4111-8111-111111111111';
const draft={sessionId:id(1),rosterId:id(2),requestId:id(3),expectedVersion:2,status:'present',reason:'verified_attendance'};
const receipt=d=>({...d,baseVersion:d.expectedVersion,proposedStatus:d.status,madeByMe:true});
test('queue validates exact correction intent and never retains token or extra fields',()=>{
 const d=correctionDraft({...draft,token:'not stored'});assert.equal(Object.hasOwn(d,'token'),false);assert.ok(Object.isFrozen(d));assert.equal(d.action,'submit');
 for(const x of [{...draft,expectedVersion:0},{...draft,reason:'verified_absence'},{...draft,requestId:'bad'},{...draft,status:'unmarked'}])assert.throws(()=>correctionDraft(x));
 const q=new CorrectionQueue();assert.throws(()=>q.enqueue(draft));q.bind('project:actor');q.enqueue(draft);assert.throws(()=>q.enqueue({...draft,requestId:id(4)}),/DRAFT_ALREADY_QUEUED/);
});
test('offline does not send; ambiguous failure preserves identical request and version',async()=>{
 const q=new CorrectionQueue();q.bind('a');q.enqueue(draft);
 let sent=0;await q.sync('a',async()=>{sent++;},{online:false});assert.equal(sent,0);
 const first=await q.sync('a',async()=>{throw Error('timeout');});assert.equal(first.stopped,true);assert.equal(q.items[0].state,'retry');
 const second=await q.sync('a',async d=>{assert.deepEqual(d,correctionDraft(draft));return receipt(d);});assert.equal(second.sent,1);assert.equal(q.items.length,0);
});
test('conflict blocks automatic resend; explicit discard and owner changes clear drafts',async()=>{
 const q=new CorrectionQueue();q.bind('a');q.enqueue(draft);
 await q.sync('a',async()=>{throw Object.assign(Error('stale'),{status:409});});assert.equal(q.items[0].state,'blocked');
 let sent=0;await q.sync('a',async()=>{sent++;});assert.equal(sent,0);
 await q.sync('b',async()=>{sent++;});assert.equal(sent,0);q.bind('b');assert.equal(q.items.length,0);
 q.enqueue(draft);q.discard(draft.requestId);assert.equal(q.items.length,0);
});
test('concurrent sync and stale async completion cannot mutate another account queue',async()=>{
 const q=new CorrectionQueue();q.bind('a');q.enqueue(draft);let release;
 const first=q.sync('a',()=>new Promise(r=>{release=r;}));assert.equal(q.busy,true);
 assert.equal((await q.sync('a',async()=>{throw Error('should not run');})).stopped,true);
 q.bind('b');q.enqueue({...draft,requestId:id(4)});release(receipt(correctionDraft(draft)));await first;
 assert.equal(q.items[0].draft.requestId,id(4));assert.equal(q.busy,false);
});
test('session discovery validates bounded caller-scope response and strips extras',async()=>{
 const config={origin:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',key:'fixture'},jwt='a'.repeat(80);
 const item={sessionId:id(1),opensAt:'2026-01-01T00:00:00Z',closesAt:'2026-01-01T08:00:00Z',status:'present',version:2};
 const data=await listSessions(config,jwt,id(2),async(url,opt)=>{
  assert.equal(url,config.origin+'/rest/v1/rpc/qs_stg_p5_sessions');assert.equal(opt.headers.Authorization,'Bearer '+jwt);assert.equal(opt.redirect,'error');assert.equal(opt.cache,'no-store');assert.deepEqual(JSON.parse(opt.body),{p_roster:id(2)});
  return {ok:true,json:async()=>({rosterId:id(2),sessions:[{...item,private:'discard'}]})};
 });assert.deepEqual(data,{rosterId:id(2),sessions:[item]});
 await assert.rejects(()=>listSessions(config,jwt,id(2),async()=>({ok:true,json:async()=>({rosterId:id(3),sessions:[item]})})),{code:'INVALID_UPSTREAM_RESPONSE'});
 await assert.rejects(()=>listSessions(config,jwt,id(2),async()=>({ok:false,status:400,json:async()=>({code:'P0001',message:'QS_FORBIDDEN'})})),{status:403});
});
test('P5 discovery fails closed in production and when feature disabled',async()=>{
 const keys=['VERCEL_ENV','QSWIPE_STAGING_ENABLED','QSWIPE_STAGING_PROJECT_REF','QSWIPE_PRODUCTION_PROJECT_REF','QSWIPE_STAGING_SUPABASE_URL','QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY','QSWIPE_STAGING_P3_ENABLED','QSWIPE_STAGING_P4_ENABLED','QSWIPE_STAGING_P5_ENABLED'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const response=()=>({statusCode:0,setHeader(){},end(s){this.body=JSON.parse(s);}});
 try{
  Object.assign(process.env,{VERCEL_ENV:'production',QSWIPE_STAGING_ENABLED:'true',QSWIPE_STAGING_P3_ENABLED:'true',QSWIPE_STAGING_P4_ENABLED:'true',QSWIPE_STAGING_P5_ENABLED:'true'});
  const prod=response();await handler({method:'GET'},prod);assert.equal(prod.body.error,'STAGING_DISABLED');
  Object.assign(process.env,{VERCEL_ENV:'preview',QSWIPE_STAGING_PROJECT_REF:'aaaaaaaaaaaaaaaaaaaa',QSWIPE_PRODUCTION_PROJECT_REF:'bbbbbbbbbbbbbbbbbbbb',QSWIPE_STAGING_SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictionalkey12345',QSWIPE_STAGING_P5_ENABLED:'false'});
  const off=response();await handler({method:'GET'},off);assert.equal(off.body.error,'STAGING_P5_DISABLED');
  process.env.QSWIPE_STAGING_P5_ENABLED='true';const unauth=response();await handler({method:'GET'},unauth);assert.equal(unauth.statusCode,401);
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
