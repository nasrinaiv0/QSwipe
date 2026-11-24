import test from 'node:test';
import assert from 'node:assert/strict';
import {onboardingCommand,executeOnboarding} from '../lib/staging/onboarding.js';
import handler from '../api/staging/onboarding.js';
const id=n=>String(n).repeat(8)+'-1111-4111-8111-111111111111';
const scope={workspaceId:id(1),unitId:id(2)},invite={action:'invite',...scope,requestId:id(3),targetUserId:id(4),code:'a'.repeat(64),displayName:'Fictional Employee',position:'Support'};
const cfg={origin:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',key:'fixture'};
test('onboarding exact input fields reject roles, unexpected data and invalid offsets',()=>{
 assert.deepEqual(onboardingCommand(invite),invite);
 for(const x of [{...invite,role:'org_admin'},{...invite,code:'bad'},{...invite,displayName:''},{...invite,targetUserId:'bad'},{action:'schedule',...scope,requestId:id(3),localStart:'2026-11-24T22:00',localEnd:'2026-11-25T06:00',startOffset:841,endOffset:480}])assert.throws(()=>onboardingCommand(x));
 assert.equal(onboardingCommand({action:'schedule',...scope,requestId:id(3),localStart:'2026-11-24T22:00',localEnd:'2026-11-25T06:00',startOffset:480,endOffset:480}).endOffset,480);
});
test('invite transport is pinned and response never echoes secret or private fields',async()=>{
 const reply={...scope,action:'invite',replayed:false,inviteId:id(5),expiresAt:'2026-11-25T00:00:00Z'};
 const data=await executeOnboarding(cfg,'fixture',invite,async(url,opt)=>{assert.equal(url,cfg.origin+'/rest/v1/rpc/qs_stg_onboarding_command');assert.equal(opt.redirect,'error');assert.equal(opt.cache,'no-store');assert.equal(opt.headers.Authorization,'Bearer fixture');assert.deepEqual(JSON.parse(opt.body),{p_body:invite});return {ok:true,json:async()=>({...reply,code:invite.code,private:'discard'})};});
 assert.deepEqual(data,reply);
 await assert.rejects(()=>executeOnboarding(cfg,'fixture',invite,async()=>({ok:true,json:async()=>({...reply,unitId:id(6)})})),{code:'INVALID_UPSTREAM_RESPONSE'});
 await assert.rejects(()=>executeOnboarding(cfg,'fixture',invite,async()=>({ok:false,status:400,json:async()=>({code:'P0001',message:'QS_CONFLICT'})})),{status:409});
});
test('onboarding cannot run in production or without independent preview flags',async()=>{
 const keys=['VERCEL_ENV','QSWIPE_STAGING_ENABLED','QSWIPE_STAGING_PROJECT_REF','QSWIPE_PRODUCTION_PROJECT_REF','QSWIPE_STAGING_SUPABASE_URL','QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY',...['P3','P4','P5','P6','ADAPTER','ONBOARDING'].map(p=>'QSWIPE_STAGING_'+p+'_ENABLED')],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const res=()=>({statusCode:0,setHeader(){},end(s){this.body=JSON.parse(s);}});
 try{Object.assign(process.env,{VERCEL_ENV:'production',QSWIPE_STAGING_ENABLED:'true'});for(const p of ['P3','P4','P5','P6','ADAPTER','ONBOARDING'])process.env['QSWIPE_STAGING_'+p+'_ENABLED']='true';
 const prod=res();await handler({method:'POST'},prod);assert.equal(prod.body.error,'STAGING_DISABLED');
 Object.assign(process.env,{VERCEL_ENV:'preview',QSWIPE_STAGING_PROJECT_REF:'aaaaaaaaaaaaaaaaaaaa',QSWIPE_PRODUCTION_PROJECT_REF:'bbbbbbbbbbbbbbbbbbbb',QSWIPE_STAGING_SUPABASE_URL:cfg.origin,QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictionalkey12345',QSWIPE_STAGING_ONBOARDING_ENABLED:'false'});
 const off=res();await handler({method:'POST'},off);assert.equal(off.body.error,'STAGING_ONBOARDING_DISABLED');
 process.env.QSWIPE_STAGING_ONBOARDING_ENABLED='true';const unauth=res();await handler({method:'POST',headers:{'content-type':'application/json'},body:invite},unauth);assert.equal(unauth.statusCode,401);
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
