import test from 'node:test';
import assert from 'node:assert/strict';
import {inboxParams,listInbox} from '../lib/staging/inbox.js';
import handler from '../api/staging/inbox.js';
const id=n=>String(n).repeat(8)+'-1111-4111-8111-111111111111';
const at='2026-11-24T01:00:00Z',params={p_workspace:id(1),p_before_at:null,p_before_id:null},cfg={origin:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',key:'fixture'},jwt='a'.repeat(80);
const row={requestId:id(2),sessionId:id(3),rosterId:id(4),employee:'Fictional employee',baseVersion:1,currentVersion:2,originalStatus:'absent',proposedStatus:'present',reason:'incorrect_mark',createdAt:at};
test('inbox cursor is bounded and paired; duplicate or unexpected query fields fail',()=>{
 assert.deepEqual(inboxParams('/api/staging/inbox?workspace_id='+id(1)),params);
 assert.deepEqual(inboxParams('/?workspace_id='+id(1)+'&before_at='+encodeURIComponent(at)+'&before_id='+id(2)),{...params,p_before_at:at,p_before_id:id(2)});
 for(const x of ['&before_id='+id(2),'&workspace_id='+id(2),'&actor=admin','&before_at=bad&before_id='+id(2)])assert.throws(()=>inboxParams('/?workspace_id='+id(1)+x));
});
test('inbox transport forwards caller identity, strips extras and rejects inconsistent cursor',async()=>{
 const d=await listInbox(cfg,jwt,params,async(url,opt)=>{assert.equal(url,cfg.origin+'/rest/v1/rpc/qs_stg_p6_inbox');assert.equal(opt.headers.Authorization,'Bearer '+jwt);assert.equal(opt.redirect,'error');assert.equal(opt.cache,'no-store');assert.deepEqual(JSON.parse(opt.body),params);return {ok:true,json:async()=>({workspaceId:id(1),rows:[{...row,email:'not returned'}],nextCursor:null})};});
 assert.deepEqual(d,{workspaceId:id(1),rows:[row],nextCursor:null});
 for(const v of [{workspaceId:id(2),rows:[row],nextCursor:null},{workspaceId:id(1),rows:[row],nextCursor:{at,id:id(2)}},{workspaceId:id(1),rows:Array(21).fill(row),nextCursor:null}])await assert.rejects(()=>listInbox(cfg,jwt,params,async()=>({ok:true,json:async()=>v})),{code:'INVALID_UPSTREAM_RESPONSE'});
 await assert.rejects(()=>listInbox(cfg,jwt,params,async()=>({ok:false,status:400,json:async()=>({code:'P0001',message:'QS_FORBIDDEN'})})),{status:403});
});
test('P6 fails closed in production and without all preview flags',async()=>{
 const keys=['VERCEL_ENV','QSWIPE_STAGING_ENABLED','QSWIPE_STAGING_PROJECT_REF','QSWIPE_PRODUCTION_PROJECT_REF','QSWIPE_STAGING_SUPABASE_URL','QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY','QSWIPE_STAGING_P3_ENABLED','QSWIPE_STAGING_P4_ENABLED','QSWIPE_STAGING_P5_ENABLED','QSWIPE_STAGING_P6_ENABLED'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const res=()=>({statusCode:0,setHeader(){},end(s){this.body=JSON.parse(s);}});
 try{
  Object.assign(process.env,{VERCEL_ENV:'production',QSWIPE_STAGING_ENABLED:'true',QSWIPE_STAGING_P3_ENABLED:'true',QSWIPE_STAGING_P4_ENABLED:'true',QSWIPE_STAGING_P5_ENABLED:'true',QSWIPE_STAGING_P6_ENABLED:'true'});
  const p=res();await handler({method:'GET'},p);assert.equal(p.body.error,'STAGING_DISABLED');
  Object.assign(process.env,{VERCEL_ENV:'preview',QSWIPE_STAGING_PROJECT_REF:'aaaaaaaaaaaaaaaaaaaa',QSWIPE_PRODUCTION_PROJECT_REF:'bbbbbbbbbbbbbbbbbbbb',QSWIPE_STAGING_SUPABASE_URL:cfg.origin,QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictionalkey12345',QSWIPE_STAGING_P6_ENABLED:'false'});
  const off=res();await handler({method:'GET'},off);assert.equal(off.body.error,'STAGING_P6_DISABLED');
  process.env.QSWIPE_STAGING_P6_ENABLED='true';const no=res();await handler({method:'GET'},no);assert.equal(no.statusCode,401);
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
