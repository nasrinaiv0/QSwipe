import test from 'node:test';
import assert from 'node:assert/strict';
import { stagingConfiguration, SecurityError, validUuid, verifiedUser, getBearer, activeMemberships } from '../lib/staging/security.js';
import config from '../api/staging/config.js';
import me from '../api/staging/me.js';
import roster from '../api/staging/roster.js';
const env={VERCEL_ENV:'preview',QSWIPE_STAGING_ENABLED:'true',QSWIPE_STAGING_SUPABASE_URL:'https://fictional-staging.supabase.co',QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fakekey1234567890123456789'};
const userId='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222',membership='33333333-3333-4333-8333-333333333333';
const token='a'.repeat(80);
function response(){return {statusCode:200,headers:{},setHeader(key,val){this.headers[key]=val;},end(data){this.body=JSON.parse(data);}};}
const original=Object.fromEntries(['VERCEL_ENV','QSWIPE_STAGING_ENABLED','QSWIPE_STAGING_SUPABASE_URL','QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY','NODE_ENV','QSWIPE_STAGING_LOCAL_TEST'].map(x=>[x,process.env[x]]));
function patchEnv(x){for(const key of Object.keys(original))delete process.env[key];Object.assign(process.env,x);}
function restore(){for(const key of Object.keys(original)){if(original[key]!==undefined)process.env[key]=original[key];else delete process.env[key];}}
function mockFetch(rows={}){const calls=[];return {calls,fetch:async (url,opt)=>{calls.push({url:String(url),authorization:opt.headers.Authorization});
  let value={};const u=String(url);
  if(u.endsWith('/auth/v1/user'))value={id:userId,role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false};
  else if(u.includes('qs_stg_memberships'))value=rows.memberships??[{id:membership,workspace_id:workspace,status:'active',starts_at:'2026-01-01T00:00:00Z',ends_at:null}];
  else if(u.includes('qs_stg_workspaces'))value=rows.workspaces??[{id:workspace,status:'active'}];
  else if(u.includes('qs_stg_role_assignments'))value=rows.grants??[{membership_id:membership,scope_unit_id:'44444444-4444-4444-8444-444444444444',role:'level_1'}];
  else if(u.includes('qs_stg_roster_assignments'))value=rows.roster??[{id:'55555555-5555-4555-8555-555555555555',workspace_id:workspace,unit_id:'44444444-4444-4444-8444-444444444444',display_name_snapshot:'Fictional Member',position_snapshot:'Agent'}];
  return {ok:true,status:200,json:async()=>value};}};}
const getReq=(path,auth=`Bearer ${token}`)=>({method:'GET',url:path,headers:{authorization:auth}});

test('production and unconfigured environments always fail closed',()=>{
  assert.throws(()=>stagingConfiguration({...env,VERCEL_ENV:'production'}),{code:'STAGING_DISABLED'});
  assert.throws(()=>stagingConfiguration({...env,QSWIPE_STAGING_ENABLED:'false'}),{code:'STAGING_DISABLED'});
  assert.throws(()=>stagingConfiguration({...env,QSWIPE_STAGING_SUPABASE_URL:'http://evil.com'}),{code:'STAGING_NOT_CONFIGURED'});
  assert.throws(()=>stagingConfiguration({...env,QSWIPE_STAGING_SUPABASE_URL:'https://example.com'}),{code:'STAGING_NOT_CONFIGURED'});
  assert.throws(()=>stagingConfiguration({...env,QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'service_role_secret'}),{code:'STAGING_NOT_CONFIGURED'});
});

test('bearer and UUID validation reject malformed identifiers and tokens',()=>{
  assert.equal(getBearer(getReq('/api/staging/me')),token);
  assert.throws(()=>getBearer(getReq('/api/staging/me','Basic admin')),SecurityError);
  assert.throws(()=>validUuid('00000000-0000-0000-0000-000000000000?other=1'),SecurityError);
  assert.equal(validUuid(workspace),workspace);
});

test('unverified and anonymous identities are rejected',async()=>{
  const conf=stagingConfiguration(env);
  for(const changed of [{email_confirmed_at:null},{is_anonymous:true},{role:'anon'}]){
    const fetchImpl=async()=>({ok:true,status:200,json:async()=>({id:userId,role:'authenticated',email_confirmed_at:'2026-01-01',is_anonymous:false,...changed})});
    await assert.rejects(()=>verifiedUser(conf,token,fetchImpl),{code:'VERIFIED_IDENTITY_REQUIRED'});
  }
});

test('expired or revoked memberships are excluded even after an RLS response',async()=>{
  const conf=stagingConfiguration(env);
  const m=mockFetch({memberships:[{id:membership,workspace_id:workspace,status:'active',ends_at:'2020-01-01',starts_at:'2019-01-01'}]});
  assert.deepEqual(await activeMemberships(conf,token,userId,m.fetch),[]);
});

test('suspended workspace is excluded even when membership is active',async()=>{
  const conf=stagingConfiguration(env);
  const m=mockFetch({workspaces:[{id:workspace,status:'suspended'}]});
  assert.deepEqual(await activeMemberships(conf,token,userId,m.fetch),[]);
});

test('all API endpoints remain disabled without preview configuration',async()=>{
  patchEnv({VERCEL_ENV:'production',...env,VERCEL_ENV:'production'});
  try{for(const fn of [config,me,roster]){
    const res=response();await fn(getReq('/api/staging/me'),res);assert.equal(res.statusCode,503);assert.equal(res.body.error,'STAGING_DISABLED');
  }}finally{restore();}
});

test('authorized identities receive only their database-derived grants, never a client role',async()=>{
  patchEnv({...env});const old=globalThis.fetch;const m=mockFetch();globalThis.fetch=m.fetch;
  try{
    const r=response();await me(getReq('/api/staging/me'),r);assert.equal(r.statusCode,200);
    assert.deepEqual(r.body.memberships,[{id:membership,workspaceId:workspace}]);
    assert.equal(r.body.grants[0].role,'level_1');
    assert.equal(m.calls.length,4);assert.ok(m.calls.every(c=>c.authorization===`Bearer ${token}`));
    assert.ok(!r.body.email && !r.body.user_metadata);
  }finally{globalThis.fetch=old;restore();}
});

test('cross-workspace roster request is denied without data lookup',async()=>{
  patchEnv({...env});const old=globalThis.fetch;const m=mockFetch();globalThis.fetch=m.fetch;
  try{const r=response();await roster(getReq('/api/staging/roster?workspace_id=66666666-6666-4666-8666-666666666666'),r);
    assert.equal(r.statusCode,403);assert.equal(r.body.error,'WORKSPACE_NOT_AUTHORIZED');
    assert.equal(m.calls.filter(x=>x.url.includes('qs_stg_roster_assignments')).length,0);
  }finally{globalThis.fetch=old;restore();}
});

test('roster uses RLS-enforced bearer and caps rows without exposing contact details',async()=>{
  patchEnv({...env});const old=globalThis.fetch;const m=mockFetch();globalThis.fetch=m.fetch;
  try{const r=response();await roster(getReq(`/api/staging/roster?workspace_id=${workspace}`),r);
    assert.equal(r.statusCode,200);assert.equal(r.body.rows.length,1);
    assert.ok(m.calls.some(x=>x.url.includes('qs_stg_roster_assignments') && x.url.includes('limit=100')));
  }finally{globalThis.fetch=old;restore();}
});
