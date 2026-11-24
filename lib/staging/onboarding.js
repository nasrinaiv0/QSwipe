import {SecurityError,validUuid} from './security.js';
const fields={list:['workspaceId','unitId'],invite:['workspaceId','unitId','requestId','targetUserId','code','displayName','position'],accept:['requestId','inviteId','code'],cancel_invite:['workspaceId','unitId','requestId','inviteId'],suspend:['workspaceId','unitId','requestId','rosterId'],resume:['workspaceId','unitId','requestId','rosterId'],revoke:['workspaceId','unitId','requestId','rosterId'],schedule:['workspaceId','unitId','requestId','localStart','localEnd','startOffset','endOffset']};
const invalid=()=>{throw new SecurityError(400,'INVALID_ONBOARDING_COMMAND');};
const bad=()=>{throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');};
const timestamp=x=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x));
const local=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x);
export function onboardingCommand(body){
 let v=body;if(typeof v==='string'){if(v.length>2048)throw new SecurityError(413,'PAYLOAD_TOO_LARGE');try{v=JSON.parse(v);}catch{invalid();}}
 if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype||!Object.hasOwn(fields,v.action))invalid();
 const keys=fields[v.action];if(Object.keys(v).length!==keys.length+1||keys.some(k=>!Object.hasOwn(v,k)))invalid();
 const out={action:v.action};for(const k of keys){const x=v[k];if(k.endsWith('Id'))out[k]=validUuid(x);else if(k==='code'){if(typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))invalid();out[k]=x;}else if(k==='displayName'||k==='position'){if(typeof x!=='string'||x.trim().length<2||x.trim().length>(k==='displayName'?60:80))invalid();out[k]=x.trim();}else if(k.endsWith('Offset')){if(!Number.isInteger(x)||Math.abs(x)>840)invalid();out[k]=x;}else{if(!local(x))invalid();out[k]=x;}}
 return out;
}
const safeName=x=>typeof x==='string'&&x.length>=2&&x.length<=60;
export async function executeOnboarding(config,jwt,command,fetchImpl=fetch){
 let r;try{r=await fetchImpl(config.origin+'/rest/v1/rpc/qs_stg_onboarding_command',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json','Content-Profile':'public'},body:JSON.stringify({p_body:command})});}catch{throw new SecurityError(503,'ONBOARDING_UNAVAILABLE');}
 let d;try{d=await r.json();}catch{bad();}
 if(!r.ok){const errors={QS_INVALID:400,QS_FORBIDDEN:403,QS_DISABLED:503,QS_CONFLICT:409,QS_IDEMPOTENCY_CONFLICT:409};if(d?.code==='P0001'&&Object.hasOwn(errors,d.message))throw new SecurityError(errors[d.message],d.message);if([401,403].includes(r.status))throw new SecurityError(403,'ONBOARDING_FORBIDDEN');throw new SecurityError(502,'ONBOARDING_UPSTREAM_ERROR');}
 if(!d||(command.action!=='accept'&&(d.workspaceId!==command.workspaceId||d.unitId!==command.unitId)))bad();
 const scope={workspaceId:validUuid(d.workspaceId),unitId:validUuid(d.unitId)};
 if(command.action==='list'){
  if(typeof d.timezone!=='string'||d.timezone.length>80||!Array.isArray(d.employees)||d.employees.length>100||!Array.isArray(d.invitations)||d.invitations.length>30||!Array.isArray(d.shifts)||d.shifts.length>30)bad();
  return {...scope,timezone:d.timezone,employees:d.employees.map(x=>{if(!safeName(x.name)||!['active','suspended','revoked','invited'].includes(x.status))bad();return {rosterId:validUuid(x.rosterId),name:x.name,status:x.status};}),invitations:d.invitations.map(x=>{if(!safeName(x.name)||!['pending','accepted','revoked','expired'].includes(x.status)||!timestamp(x.expiresAt))bad();return {inviteId:validUuid(x.inviteId),name:x.name,status:x.status,expiresAt:x.expiresAt};}),shifts:d.shifts.map(x=>{if(!timestamp(x.opensAt)||!timestamp(x.closesAt)||Date.parse(x.closesAt)<=Date.parse(x.opensAt)||!local(x.localStart)||!local(x.localEnd)||typeof x.timezone!=='string'||x.timezone.length>80||!Number.isInteger(x.startOffset)||!Number.isInteger(x.endOffset)||Math.abs(x.startOffset)>840||Math.abs(x.endOffset)>840||!Number.isSafeInteger(x.eligibleCount)||x.eligibleCount<1)bad();return {sessionId:validUuid(x.sessionId),opensAt:x.opensAt,closesAt:x.closesAt,timezone:x.timezone,localStart:x.localStart,localEnd:x.localEnd,startOffset:x.startOffset,endOffset:x.endOffset,eligibleCount:x.eligibleCount};})};
 }
 if(d.action!==command.action||typeof d.replayed!=='boolean')bad();
 const base={...scope,action:d.action,replayed:d.replayed};
 if(command.action==='invite'){if(!timestamp(d.expiresAt))bad();return {...base,inviteId:validUuid(d.inviteId),expiresAt:d.expiresAt};}
 if(command.action==='accept'){if(d.inviteId!==command.inviteId)bad();return {...base,inviteId:d.inviteId,membershipId:validUuid(d.membershipId),rosterId:validUuid(d.rosterId)};}
 if(command.action==='cancel_invite'){if(d.inviteId!==command.inviteId||d.status!=='revoked')bad();return {...base,inviteId:d.inviteId,status:d.status};}
 if(command.action==='schedule'){if(!timestamp(d.opensAt)||!timestamp(d.closesAt)||Date.parse(d.closesAt)<=Date.parse(d.opensAt)||!Number.isSafeInteger(d.eligibleCount)||d.eligibleCount<1)bad();return {...base,sessionId:validUuid(d.sessionId),opensAt:d.opensAt,closesAt:d.closesAt,eligibleCount:d.eligibleCount};}
 if(d.rosterId!==command.rosterId||d.status!==({suspend:'suspended',resume:'active',revoke:'revoked'}[command.action]))bad();
 return {...base,rosterId:d.rosterId,status:d.status};
}
