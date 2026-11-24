import { SecurityError, validUuid } from './security.js';
const statuses=['present','absent'];
const reasons=['incorrect_mark','verified_attendance','verified_absence'];
const decisionReasons={approved:['verified'],rejected:['insufficient_evidence','incorrect_request']};
const errors=Object.freeze({QS_INVALID:400,QS_DISABLED:503,QS_FORBIDDEN:403,QS_VERSION_CONFLICT:409,QS_IDEMPOTENCY_CONFLICT:409,QS_CORRECTION_WINDOW:409});
const fail=()=>{throw new SecurityError(400,'INVALID_CORRECTION_COMMAND');};
const badResponse=()=>{throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');};
const validVersion=v=>Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
export function approvalCommand(body){
 let v=body;
 if(typeof v==='string'){if(v.length>2048)throw new SecurityError(413,'PAYLOAD_TOO_LARGE');try{v=JSON.parse(v);}catch{fail();}}
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)fail();
 const common=['action','sessionId','rosterId'];
 const extras={list:[],submit:['requestId','expectedVersion','status','reason'],decide:['requestId','outcome','reason']};
 if(!Object.hasOwn(extras,v.action)||Object.keys(v).some(k=>!common.includes(k)&&!extras[v.action].includes(k)))fail();
 const out={p_action:v.action,p_session:validUuid(v.sessionId),p_roster:validUuid(v.rosterId),p_request:null,p_expected:null,p_status:null,p_outcome:null,p_reason:null};
 if(v.action==='list')return out;
 out.p_request=validUuid(v.requestId);
 if(v.action==='submit'){
   if(!validVersion(v.expectedVersion)||!statuses.includes(v.status)||!reasons.includes(v.reason)||
    (v.reason==='verified_attendance'&&v.status!=='present')||(v.reason==='verified_absence'&&v.status!=='absent'))fail();
   return {...out,p_expected:v.expectedVersion,p_status:v.status,p_reason:v.reason};
 }
 if(!Object.hasOwn(decisionReasons,v.outcome)||!decisionReasons[v.outcome].includes(v.reason))fail();
 return {...out,p_outcome:v.outcome,p_reason:v.reason};
}
function project(r){
 if(!r||!validVersion(r.baseVersion)||!statuses.includes(r.originalStatus)||!statuses.includes(r.proposedStatus)||r.originalStatus===r.proposedStatus||
   !reasons.includes(r.reason)||typeof r.madeByMe!=='boolean'||!Number.isFinite(Date.parse(r.createdAt)))badResponse();
 if(r.outcome==='pending'){
   if(r.decisionReason!==null||r.resultingVersion!==null||r.decidedAt!==null)badResponse();
 }else{
   if(!Object.hasOwn(decisionReasons,r.outcome)||!decisionReasons[r.outcome].includes(r.decisionReason)||
     r.resultingVersion!==r.baseVersion+(r.outcome==='approved'?1:0)||!Number.isFinite(Date.parse(r.decidedAt)))badResponse();
 }
 return {requestId:validUuid(r.requestId),baseVersion:r.baseVersion,originalStatus:r.originalStatus,proposedStatus:r.proposedStatus,
 reason:r.reason,createdAt:r.createdAt,madeByMe:r.madeByMe,outcome:r.outcome,decisionReason:r.decisionReason,resultingVersion:r.resultingVersion,decidedAt:r.decidedAt};
}
export async function executeApproval(config,jwt,command,fetchImpl=fetch){
 let res;
 try{res=await fetchImpl(config.origin+'/rest/v1/rpc/qs_stg_p4_command',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
 headers:{apikey:config.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json','Content-Profile':'public'},body:JSON.stringify(command)});}
 catch{throw new SecurityError(503,'APPROVAL_UPSTREAM_UNAVAILABLE');}
 let d;try{d=await res.json();}catch{badResponse();}
 if(!res.ok){
   if(d?.code==='P0001'&&Object.hasOwn(errors,d.message))throw new SecurityError(errors[d.message],d.message);
   if(res.status===401||res.status===403)throw new SecurityError(403,'APPROVAL_FORBIDDEN');
   throw new SecurityError(502,'APPROVAL_UPSTREAM_ERROR');
 }
 if(d?.sessionId!==command.p_session||d?.rosterId!==command.p_roster)badResponse();
 const base={sessionId:d.sessionId,rosterId:d.rosterId};
 if(command.p_action==='list'){
   if(!Array.isArray(d.requests)||d.requests.length>50||!((d.currentVersion===0&&d.currentStatus==='unmarked')||(validVersion(d.currentVersion)&&statuses.includes(d.currentStatus))))badResponse();
   return {...base,currentVersion:d.currentVersion,currentStatus:d.currentStatus,requests:d.requests.map(project)};
 }
 if(d.requestId!==command.p_request||typeof d.replayed!=='boolean')badResponse();
 if(command.p_action==='submit'&&(d.baseVersion!==command.p_expected||d.proposedStatus!==command.p_status||d.reason!==command.p_reason||d.madeByMe!==true))badResponse();
 if(command.p_action==='decide'&&(d.outcome!==command.p_outcome||d.decisionReason!==command.p_reason||d.madeByMe!==false))badResponse();
 return {...base,...project(d),replayed:d.replayed};
}
