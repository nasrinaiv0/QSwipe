import {SecurityError,validUuid} from './security.js';
const fields={mine:['workspaceId','rosterId'],inbox:['workspaceId','unitId'],request_leave:['workspaceId','unitId','requestId','sessionId','rosterId','category'],withdraw_leave:['workspaceId','unitId','requestId','targetId','rosterId'],decide_leave:['workspaceId','unitId','requestId','targetId','outcome'],plan_transfer:['workspaceId','unitId','requestId','rosterId','destinationUnitId','effectiveAt'],activate_transfer:['workspaceId','unitId','requestId','targetId'],cancel_transfer:['workspaceId','unitId','requestId','targetId'],regional_holiday:['workspaceId','unitId','requestId','localDate','expectedVersion','category','region','sourceRef']};
const invalid=()=>{throw new SecurityError(400,'INVALID_ADVANCED_COMMAND');};
const bad=()=>{throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');};
const local=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const instant=x=>typeof x==='string'&&x.length<=40&&Number.isFinite(Date.parse(x));
const region=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,79}$/.test(x);
const source=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9 ._:/-]{2,159}$/.test(x);
const leave=['approved_leave','authorized_excuse'],holiday=['regular','special','other','none'];
export function advancedCommand(body){
 let d=body;if(typeof d==='string'){if(d.length>2048)invalid();try{d=JSON.parse(d);}catch{invalid();}}
 if(!d||Object.getPrototypeOf(d)!==Object.prototype||!Object.hasOwn(fields,d.action))invalid();
 const keys=fields[d.action];if(Object.keys(d).length!==keys.length+1||keys.some(k=>!Object.hasOwn(d,k)))invalid();
 const out={action:d.action};for(const k of keys){const v=d[k];if(k.endsWith('Id'))out[k]=validUuid(v);else{if(!(k==='category'?(d.action==='regional_holiday'?holiday:leave).includes(v):k==='outcome'?['approved','rejected'].includes(v):k==='region'?region(v):k==='sourceRef'?source(v):k==='localDate'?date(v):k==='effectiveAt'?instant(v)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v):Number.isSafeInteger(v)&&v>=0&&v<2147483647))invalid();out[k]=v;}}
 return out;
}
export async function executeAdvanced(config,jwt,command,fetchImpl=fetch){
 let r;try{r=await fetchImpl(config.origin+'/rest/v1/rpc/qs_stg_advanced_command',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json','Content-Profile':'public'},body:JSON.stringify({p_body:command})});}catch{throw new SecurityError(503,'ADVANCED_UNAVAILABLE');}
 let d;try{d=await r.json();}catch{bad();}
 if(!r.ok){const codes={QS_INVALID:400,QS_FORBIDDEN:403,QS_DISABLED:503,QS_CONFLICT:409,QS_IDEMPOTENCY_CONFLICT:409};if(d?.code==='P0001'&&Object.hasOwn(codes,d.message))throw new SecurityError(codes[d.message],d.message);if([401,403].includes(r.status))throw new SecurityError(403,'ADVANCED_FORBIDDEN');throw new SecurityError(502,'ADVANCED_UPSTREAM_ERROR');}
 if(!d||d.action!==command.action||d.workspaceId!==command.workspaceId||(command.unitId&&d.unitId!==command.unitId))bad();
 const base={action:d.action,workspaceId:d.workspaceId,unitId:validUuid(d.unitId)};
 if(['mine','inbox'].includes(command.action)){
  for(const [k,max] of [['requests',50],['eligible',30],['transfers',50],['holidays',50]])if(!Array.isArray(d[k])||d[k].length>max)bad();
  return {...base,requests:d.requests.map(x=>{if(!leave.includes(x.category)||!['pending','approved','rejected','withdrawn'].includes(x.status)||!local(x.localStart)||typeof x.madeByMe!=='boolean'||(command.action==='mine'&&(!x.madeByMe||x.rosterId!==command.rosterId)))bad();return {id:validUuid(x.id),sessionId:validUuid(x.sessionId),rosterId:validUuid(x.rosterId),category:x.category,status:x.status,localStart:x.localStart,madeByMe:x.madeByMe};}),eligible:d.eligible.map(x=>{if(!local(x.localStart)||!local(x.localEnd))bad();return {sessionId:validUuid(x.sessionId),localStart:x.localStart,localEnd:x.localEnd};}),transfers:d.transfers.map(x=>{if(!instant(x.effectiveAt)||!['pending','activated','cancelled'].includes(x.status))bad();return {id:validUuid(x.id),rosterId:validUuid(x.rosterId),destinationUnitId:validUuid(x.destinationUnitId),effectiveAt:x.effectiveAt,status:x.status};}),holidays:d.holidays.map(x=>{if(!date(x.localDate)||!Number.isSafeInteger(x.version)||x.version<1||!region(x.region)||!source(x.sourceRef)||!holiday.includes(x.classification))bad();return {localDate:x.localDate,version:x.version,region:x.region,sourceRef:x.sourceRef,classification:x.classification};})};
 }
 if(typeof d.replayed!=='boolean'||!['pending','approved','rejected','withdrawn','activated','cancelled','recorded'].includes(d.status))bad();return {...base,status:d.status,replayed:d.replayed};
}
