import test from 'node:test';
import assert from 'node:assert/strict';
import {workforceCommand,executeWorkforce} from '../lib/staging/workforce.js';
import {summarizeWorkforce} from '../public/staging/workforce.js';
import handler from '../api/staging/workforce.js';
const id=n=>String(n).repeat(8)+'-1111-4111-8111-111111111111';
const scope={workspaceId:id(1),unitId:id(2)},report={action:'report',...scope,fromDate:'2026-11-01',toDate:'2026-11-30'},cfg={origin:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',key:'fixture'};
const row={sessionId:id(3),version:2,state:'completed',localStart:'2026-11-25T22:00',localEnd:'2026-11-26T06:00',timezone:'Asia/Manila',holiday:'special',planned:12,present:9,absent:1,excused:1,unmarked:1,mismatches:0};
test('strict workforce commands reject extra fields, invalid version and recurrence',()=>{
 assert.deepEqual(workforceCommand(report),report);
 for(const x of [{...report,actor:'admin'},{...report,toDate:'bad'},{action:'cancel',...scope,requestId:id(4),sessionId:id(3),expectedVersion:-1},{action:'repeat',...scope,requestId:id(4),localStart:row.localStart,localEnd:row.localEnd,startOffset:480,endOffset:480,weeks:9}])assert.throws(()=>workforceCommand(x));
});
test('report transport pins caller scope and rejects broken partition',async()=>{
 const d=await executeWorkforce(cfg,'fixture',report,async(url,opt)=>{assert.equal(url,cfg.origin+'/rest/v1/rpc/qs_stg_workforce_command');assert.equal(opt.headers.Authorization,'Bearer fixture');assert.equal(opt.redirect,'error');assert.equal(opt.cache,'no-store');assert.deepEqual(JSON.parse(opt.body),{p_body:report});return {ok:true,json:async()=>({action:'report',...scope,rows:[{...row,private:'discard'}]})};});
 assert.deepEqual(d,{action:'report',...scope,rows:[row]});
 await assert.rejects(()=>executeWorkforce(cfg,'fixture',report,async()=>({ok:true,json:async()=>({action:'report',...scope,rows:[{...row,unmarked:2}]})})),{code:'INVALID_UPSTREAM_RESPONSE'});
 assert.deepEqual(summarizeWorkforce([row,{...row,state:'retired'},{...row,state:'upcoming'}]),{planned:12,present:9,absent:1,excused:1,unmarked:1,mismatches:0});
});
test('workforce fails closed in production and without new flag',async()=>{
 const keys=['VERCEL_ENV','QSWIPE_STAGING_ENABLED','QSWIPE_STAGING_PROJECT_REF','QSWIPE_PRODUCTION_PROJECT_REF','QSWIPE_STAGING_SUPABASE_URL','QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY',...['P3','P4','P5','P6','ADAPTER','ONBOARDING','WORKFORCE'].map(p=>'QSWIPE_STAGING_'+p+'_ENABLED')],saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const res=()=>({statusCode:0,setHeader(){},end(s){this.body=JSON.parse(s);}});
 try{Object.assign(process.env,{VERCEL_ENV:'production',QSWIPE_STAGING_ENABLED:'true'});for(const p of ['P3','P4','P5','P6','ADAPTER','ONBOARDING','WORKFORCE'])process.env['QSWIPE_STAGING_'+p+'_ENABLED']='true';const prod=res();await handler({method:'POST'},prod);assert.equal(prod.body.error,'STAGING_DISABLED');
 Object.assign(process.env,{VERCEL_ENV:'preview',QSWIPE_STAGING_PROJECT_REF:'aaaaaaaaaaaaaaaaaaaa',QSWIPE_PRODUCTION_PROJECT_REF:'bbbbbbbbbbbbbbbbbbbb',QSWIPE_STAGING_SUPABASE_URL:cfg.origin,QSWIPE_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictionalkey12345',QSWIPE_STAGING_WORKFORCE_ENABLED:'false'});const off=res();await handler({method:'POST'},off);assert.equal(off.body.error,'STAGING_WORKFORCE_DISABLED');
 }finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
