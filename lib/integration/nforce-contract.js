import {createHash} from 'node:crypto';
const keys=['schemaVersion','source','eventId','tenantId','employeeId','sessionId','revision','status','occurredAt','previousDigest'];
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export function validateAttendanceEvent(e){
 if(!e||Object.getPrototypeOf(e)!==Object.prototype||Object.keys(e).length!==keys.length||keys.some(k=>!Object.hasOwn(e,k))||e.schemaVersion!==1||e.source!=='qswipe'||!['eventId','tenantId','employeeId','sessionId'].every(k=>uuid(e[k]))||!Number.isSafeInteger(e.revision)||e.revision<1||e.revision>2147483647||!['present','absent','excused','unmarked'].includes(e.status)||typeof e.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.occurredAt)||!Number.isFinite(Date.parse(e.occurredAt))||new Date(e.occurredAt).toISOString()!==e.occurredAt||(e.revision===1?e.previousDigest!==null:!digest(e.previousDigest)))throw Error('INVALID_ATTENDANCE_EVENT');
 return Object.fromEntries(keys.map(k=>[k,e[k]]));
}
export function attendanceDigest(e){const v=validateAttendanceEvent(e);return createHash('sha256').update(JSON.stringify(keys.map(k=>v[k])),'utf8').digest('hex');}
// Pure offline decision helper; persistence, signatures and trusted mapping are deployment gates.
export function classifyAttendanceEvent(e,{tenantId,employeeId,sessionId,prior=null,eventReceipt=null}){
 const v=validateAttendanceEvent(e),hash=attendanceDigest(v);
 if(v.tenantId!==tenantId||v.employeeId!==employeeId||v.sessionId!==sessionId)return 'quarantine_scope';
 if(eventReceipt)return eventReceipt.eventId===v.eventId&&eventReceipt.digest===hash?'duplicate':'quarantine_event_conflict';
 if(!prior)return v.revision===1?'accept':'quarantine_gap';
 if(prior.tenantId!==tenantId||prior.employeeId!==employeeId||prior.sessionId!==sessionId||!Number.isSafeInteger(prior.revision)||prior.revision<1||!digest(prior.digest))return 'quarantine_scope';
 if(v.revision!==prior.revision+1||v.previousDigest!==prior.digest)return 'quarantine_revision';
 return 'accept';
}
