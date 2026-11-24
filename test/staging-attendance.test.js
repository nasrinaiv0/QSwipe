import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceCommand, executeAttendance } from '../lib/staging/attendance.js';
import handler from '../api/staging/attendance.js';
const sessionId='11111111-1111-4111-8111-111111111111',rosterId='22222222-2222-4222-8222-222222222222',requestId='33333333-3333-4333-8333-333333333333';
const read={action:'read',sessionId,rosterId};
const mark={action:'mark',sessionId,rosterId,requestId,expectedVersion:0,status:'present',reason:'roll_call'};
const config={origin:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',key:'fictional-publishable'},jwt='a'.repeat(80);
test('attendance input allows only exact operation fields and validates version, reason and token',()=>{
  assert.deepEqual(attendanceCommand(read),{p_action:'read',p_session:sessionId,p_roster:rosterId,p_request:null,p_expected:null,p_status:null,p_qr:null,p_reason:null});
  assert.equal(attendanceCommand(mark).p_expected,0);
  assert.equal(attendanceCommand({...mark,reason:'in_person'}).p_reason,'in_person');
  for(const invalid of [{...read,role:'admin'},{...read,expectedVersion:0},{...mark,expectedVersion:'0'},{...mark,expectedVersion:2},{...mark,reason:'private free text'},{...mark,qrToken:'a'.repeat(64)},{...mark,status:'absent'},null,[],'{bad']) assert.throws(()=>attendanceCommand(invalid));
  assert.throws(()=>attendanceCommand('x'.repeat(2049)),{code:'PAYLOAD_TOO_LARGE'});
  const {reason,...rest}=mark;
  assert.equal(attendanceCommand({...rest,qrToken:'a'.repeat(64)}).p_qr,'a'.repeat(64));
});
test('caller token is forwarded only to pinned RPC, response is projected and uncached',async()=>{
  const command=attendanceCommand(read);
  const result=await executeAttendance(config,jwt,command,async(url,opt)=>{
    assert.equal(url,config.origin+'/rest/v1/rpc/qs_stg_p3_command');
    assert.equal(opt.headers.Authorization,'Bearer '+jwt);assert.equal(opt.redirect,'error');assert.equal(opt.cache,'no-store');
    assert.deepEqual(JSON.parse(opt.body),command);
    return {ok:true,json:async()=>({sessionId,rosterId,version:0,status:'unmarked',recordedAt:null,private:'discard'})};
  });
  assert.deepEqual(result,{sessionId,rosterId,version:0,status:'unmarked',recordedAt:null});
});
test('stale version and idempotency conflicts are mapped without leaking upstream error details',async()=>{
  for(const message of ['QS_VERSION_CONFLICT','QS_IDEMPOTENCY_CONFLICT','QS_INVALID_PASS']){
    await assert.rejects(()=>executeAttendance(config,jwt,attendanceCommand(mark),async()=>({ok:false,status:400,json:async()=>({code:'P0001',message,details:'private'})})),{status:409,code:message});
  }
  await assert.rejects(()=>executeAttendance(config,jwt,attendanceCommand(mark),async()=>({ok:false,status:400,json:async()=>({code:'P0001',message:'unexpected detail'})})),{code:'ATTENDANCE_UPSTREAM_ERROR'});
  await assert.rejects(()=>executeAttendance(config,jwt,attendanceCommand(read),async()=>({ok:true,json:async()=>({sessionId,rosterId:'wrong'})})),{code:'INVALID_UPSTREAM_RESPONSE'});
});
test('P3 API is disabled in production and without explicit preview flag',async()=>{
  const names=['VERCEL_ENV','QSWIPE_STAGING_ENABLED','QSWIPE_STAGING_PROJECT_REF','QSWIPE_PRODUCTION_PROJECT_REF','QSWIPE_STAGING_SUPABASE_URL','QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY','QSWIPE_STAGING_P3_ENABLED'];
  const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
  const response=()=>({statusCode:0,headers:{},setHeader(k,v){this.headers[k]=v;},end(s){this.body=JSON.parse(s);}});
  try{
    Object.assign(process.env,{VERCEL_ENV:'production',QSWIPE_STAGING_ENABLED:'true',QSWIPE_STAGING_P3_ENABLED:'true'});
    const prod=response();await handler({method:'POST'},prod);assert.equal(prod.body.error,'STAGING_DISABLED');
    Object.assign(process.env,{VERCEL_ENV:'preview',QSWIPE_STAGING_PROJECT_REF:'aaaaaaaaaaaaaaaaaaaa',QSWIPE_PRODUCTION_PROJECT_REF:'bbbbbbbbbbbbbbbbbbbb',QSWIPE_STAGING_SUPABASE_URL:config.origin,QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictionalkey12345',QSWIPE_STAGING_P3_ENABLED:'false'});
    const off=response();await handler({method:'POST'},off);assert.equal(off.body.error,'STAGING_P3_DISABLED');
    process.env.QSWIPE_STAGING_P3_ENABLED='true';
    const get=response();await handler({method:'GET'},get);assert.equal(get.statusCode,405);
    const noAuth=response();await handler({method:'POST',headers:{'content-type':'application/json'},body:read},noAuth);assert.equal(noAuth.statusCode,401);
  }finally{for(const k of names){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
