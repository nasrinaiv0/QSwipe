import test from 'node:test';
import assert from 'node:assert/strict';
import {advancedCommand,executeAdvanced} from '../lib/staging/advanced.js';
import {attendanceDigest,classifyAttendanceEvent,validateAttendanceEvent} from '../lib/integration/nforce-contract.js';
import {workforceRates} from '../public/staging/workforce.js';
const id=n=>String(n).repeat(8)+'-1111-4111-8111-111111111111';
const mine={action:'mine',workspaceId:id(1),rosterId:id(2)},cfg={origin:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',key:'fixture'};
test('advanced scope, schema and transport',async()=>{
 assert.deepEqual(advancedCommand(mine),mine);assert.throws(()=>advancedCommand({...mine,role:'org_admin'}));
 const response={action:'mine',workspaceId:id(1),unitId:id(3),requests:[],eligible:[],transfers:[],holidays:[]};
 assert.deepEqual(await executeAdvanced(cfg,'fictional',mine,async(url,opt)=>{assert.equal(url,cfg.origin+'/rest/v1/rpc/qs_stg_advanced_command');assert.equal(opt.redirect,'error');assert.equal(opt.headers.Authorization,'Bearer fictional');return {ok:true,json:async()=>({...response,private:'strip'})};}),response);
 await assert.rejects(()=>executeAdvanced(cfg,'fictional',mine,async()=>({ok:true,json:async()=>({...response,workspaceId:id(4)})})),{code:'INVALID_UPSTREAM_RESPONSE'});
});
test('NForce offline contract rejects gaps, wrong mappings, duplicate conflict and extra payroll fields',()=>{
 const e={schemaVersion:1,source:'qswipe',eventId:id(1),tenantId:id(2),employeeId:id(3),sessionId:id(4),revision:1,status:'present',occurredAt:'2026-11-24T01:00:00.000Z',previousDigest:null};
 const scope={tenantId:e.tenantId,employeeId:e.employeeId,sessionId:e.sessionId};
 const digest=attendanceDigest(e);assert.equal(digest.length,64);
 assert.equal(classifyAttendanceEvent(e,scope),'accept');
 assert.equal(classifyAttendanceEvent(e,{...scope,eventReceipt:{eventId:e.eventId,digest}}),'duplicate');
 assert.equal(classifyAttendanceEvent({...e,status:'absent'},{...scope,eventReceipt:{eventId:e.eventId,digest}}),'quarantine_event_conflict');
 assert.equal(classifyAttendanceEvent(e,{...scope,tenantId:id(6)}),'quarantine_scope');
 const correction={...e,eventId:id(5),revision:2,status:'excused',previousDigest:digest};
 assert.equal(classifyAttendanceEvent(correction,scope),'quarantine_gap');
 assert.equal(classifyAttendanceEvent(correction,{...scope,prior:{...scope,revision:1,digest}}),'accept');
 assert.equal(classifyAttendanceEvent({...correction,revision:3},{...scope,prior:{...scope,revision:1,digest}}),'quarantine_revision');
 assert.throws(()=>validateAttendanceEvent({...e,hours:8}));assert.throws(()=>validateAttendanceEvent({...e,occurredAt:'2026-02-30T00:00:00.000Z'}));
});
test('rates use only completed shifts; zero denominators remain unknown',()=>{
 const row={state:'completed',planned:12,present:9,absent:1,excused:1,unmarked:1,mismatches:0};
 assert.deepEqual(workforceRates([row,{...row,state:'upcoming'},{...row,state:'retired'}]),{attendance:90,completion:90.9,excused:8.3,completed:1,upcoming:1,retired:1});
 assert.equal(workforceRates([]).attendance,null);
});
