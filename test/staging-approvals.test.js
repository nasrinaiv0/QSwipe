import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalCommand,executeApproval} from '../lib/staging/approvals.js';
import {attendanceCommand,executeAttendance} from '../lib/staging/attendance.js';
import handler from '../api/staging/approvals.js';
const sessionId='11111111-1111-4111-8111-111111111111',rosterId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333';
const list={action:'list',sessionId,rosterId};
const submit={...list,action:'submit',requestId,expectedVersion:1,status:'absent',reason:'incorrect_mark'};
const decide={...list,action:'decide',requestId,outcome:'approved',reason:'verified'};
const config={origin:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',key:'fictional-publishable'},jwt='a'.repeat(80);
const receipt={sessionId,rosterId,requestId,baseVersion:1,originalStatus:'present',proposedStatus:'absent',reason:'incorrect_mark',createdAt:'2026-01-01T00:00:00Z',madeByMe:true,outcome:'pending',decisionReason:null,resultingVersion:null,decidedAt:null,replayed:false};
test('P4 accepts only exact operation fields and enumerated reasons',()=>{
 assert.equal(approvalCommand(list).p_action,'list');
 assert.equal(approvalCommand(submit).p_expected,1);
 assert.equal(approvalCommand(decide).p_outcome,'approved');
 for(const invalid of [{...list,actor:'admin'},{...submit,expectedVersion:0},{...submit,expectedVersion:2147483648},{...submit,reason:'private free text'},{...submit,reason:'verified_attendance'},{...decide,expectedVersion:1},{...decide,reason:'incorrect_request'},null,[],'{bad']) assert.throws(()=>approvalCommand(invalid));
 assert.throws(()=>approvalCommand('x'.repeat(2049)),{code:'PAYLOAD_TOO_LARGE'});
});
test('P4 forwards caller JWT to exact RPC and projects response fields',async()=>{
 const command=approvalCommand(submit);
 const result=await executeApproval(config,jwt,command,async(url,opt)=>{
  assert.equal(url,config.origin+'/rest/v1/rpc/qs_stg_p4_command');assert.equal(opt.headers.Authorization,'Bearer '+jwt);
  assert.equal(opt.redirect,'error');assert.equal(opt.cache,'no-store');assert.deepEqual(JSON.parse(opt.body),command);
  return {ok:true,json:async()=>({...receipt,private:'discard'})};
 });
 assert.deepEqual(result,receipt);
 await assert.rejects(()=>executeApproval(config,jwt,command,async()=>({ok:true,json:async()=>({...receipt,requestId:rosterId})})),{code:'INVALID_UPSTREAM_RESPONSE'});
});
test('P4 maps expected conflicts and rejects malformed approval receipts',async()=>{
 for(const message of ['QS_VERSION_CONFLICT','QS_IDEMPOTENCY_CONFLICT','QS_CORRECTION_WINDOW']) await assert.rejects(()=>executeApproval(config,jwt,approvalCommand(decide),async()=>({ok:false,status:400,json:async()=>({code:'P0001',message,details:'private'})})),{status:409,code:message});
 await assert.rejects(()=>executeApproval(config,jwt,approvalCommand(decide),async()=>({ok:true,json:async()=>({...receipt,madeByMe:false,outcome:'approved',decisionReason:'verified',resultingVersion:3,decidedAt:'2026-01-01T00:00:00Z'})})),{code:'INVALID_UPSTREAM_RESPONSE'});
 const result=await executeApproval(config,jwt,approvalCommand(list),async()=>({ok:true,json:async()=>({sessionId,rosterId,currentVersion:1,currentStatus:'present',requests:[receipt]})}));
 assert.equal(result.requests.length,1);assert.equal(Object.hasOwn(result.requests[0],'replayed'),false);
});
test('P3 reads corrected versions without treating historical original mark as current',async()=>{
 const result=await executeAttendance(config,jwt,attendanceCommand({action:'read',sessionId,rosterId}),async()=>({ok:true,json:async()=>({sessionId,rosterId,status:'absent',version:3,recordedAt:'2026-01-01T00:00:00Z'})}));
 assert.equal(result.version,3);
});
test('P4 endpoint fails closed in production and requires both preview flags',async()=>{
 const names=['VERCEL_ENV','QSWIPE_STAGING_ENABLED','QSWIPE_STAGING_PROJECT_REF','QSWIPE_PRODUCTION_PROJECT_REF','QSWIPE_STAGING_SUPABASE_URL','QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY','QSWIPE_STAGING_P3_ENABLED','QSWIPE_STAGING_P4_ENABLED'];
 const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 const response=()=>({statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}});
 try{
  Object.assign(process.env,{VERCEL_ENV:'production',QSWIPE_STAGING_ENABLED:'true',QSWIPE_STAGING_P3_ENABLED:'true',QSWIPE_STAGING_P4_ENABLED:'true'});
  const prod=response();await handler({method:'POST'},prod);assert.equal(prod.body.error,'STAGING_DISABLED');
  Object.assign(process.env,{VERCEL_ENV:'preview',QSWIPE_STAGING_PROJECT_REF:'aaaaaaaaaaaaaaaaaaaa',QSWIPE_PRODUCTION_PROJECT_REF:'bbbbbbbbbbbbbbbbbbbb',QSWIPE_STAGING_SUPABASE_URL:config.origin,QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictionalkey12345',QSWIPE_STAGING_P4_ENABLED:'false'});
  const off=response();await handler({method:'POST'},off);assert.equal(off.body.error,'STAGING_P4_DISABLED');
  process.env.QSWIPE_STAGING_P4_ENABLED='true';process.env.QSWIPE_STAGING_P3_ENABLED='false';
  const p3off=response();await handler({method:'POST'},p3off);assert.equal(p3off.body.error,'STAGING_P4_DISABLED');
  process.env.QSWIPE_STAGING_P3_ENABLED='true';
  const get=response();await handler({method:'GET'},get);assert.equal(get.statusCode,405);
  const noAuth=response();await handler({method:'POST',headers:{'content-type':'application/json'},body:list},noAuth);assert.equal(noAuth.statusCode,401);
 }finally{for(const k of names){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
