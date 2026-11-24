import {SecurityError,validUuid} from './security.js';
const fields={report:['fromDate','toDate'],repeat:['requestId','localStart','localEnd','startOffset','endOffset','weeks'],edit:['requestId','sessionId','expectedVersion','localStart','localEnd','startOffset','endOffset'],cancel:['requestId','sessionId','expectedVersion'],transfer:['requestId','rosterId','destinationUnitId'],leave:['requestId','sessionId','rosterId','expectedVersion','category'],cancel_leave:['requestId','sessionId','rosterId','expectedVersion'],holiday:['requestId','localDate','expectedVersion','category']};
const fail=()=>{throw new SecurityError(400,'INVALID_WORKFORCE_COMMAND');};
const bad=()=>{throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');};
const integer=(x,min=0,max=2147483647)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const local=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
export function workforceCommand(body){
 let d=body;if(typeof d==='string'){if(d.length>2048)fail();try{d=JSON.parse(d);}catch{fail();}}
 if(!d||Object.getPrototypeOf(d)!==Object.prototype||!Object.hasOwn(fields,d.action))fail();
 const keys=['workspaceId','unitId',...fields[d.action]];
 if(Object.keys(d).length!==keys.length+1||keys.some(k=>!Object.hasOwn(d,k)))fail();
 const result={action:d.action};
 for(const k of keys){const v=d[k];if(k.endsWith('Id'))result[k]=validUuid(v);else if(k.endsWith('Offset')){if(!integer(v,-840,840))fail();result[k]=v;}else if(k==='weeks'||k==='expectedVersion'){if(!integer(v,k==='weeks'?2:0,k==='weeks'?8:2147483647))fail();result[k]=v;}else if(k==='category'){if(!(d.action==='holiday'?['regular','special','other','none']:['approved_leave','authorized_excuse']).includes(v))fail();result[k]=v;}else{if(!(k.endsWith('Date')?date(v):local(v)))fail();result[k]=v;}}
 return result;
}
export async function executeWorkforce(config,jwt,command,fetchImpl=fetch){
 let r;try{r=await fetchImpl(config.origin+'/rest/v1/rpc/qs_stg_workforce_command',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json','Content-Profile':'public'},body:JSON.stringify({p_body:command})});}catch{throw new SecurityError(503,'WORKFORCE_UNAVAILABLE');}
 let d;try{d=await r.json();}catch{bad();}
 if(!r.ok){const errors={QS_INVALID:400,QS_FORBIDDEN:403,QS_DISABLED:503,QS_CONFLICT:409,QS_IDEMPOTENCY_CONFLICT:409};if(d?.code==='P0001'&&Object.hasOwn(errors,d.message))throw new SecurityError(errors[d.message],d.message);if([401,403].includes(r.status))throw new SecurityError(403,'WORKFORCE_FORBIDDEN');throw new SecurityError(502,'WORKFORCE_UPSTREAM_ERROR');}
 if(!d||d.action!==command.action||d.workspaceId!==command.workspaceId||d.unitId!==command.unitId)bad();
 const base={action:d.action,workspaceId:d.workspaceId,unitId:d.unitId};
 if(command.action==='report'){if(!Array.isArray(d.rows)||d.rows.length>100)bad();return {...base,rows:d.rows.map(x=>{if(!integer(x.version,1)||!['retired','upcoming','open','completed'].includes(x.state)||!['none','regular','special','other'].includes(x.holiday)||!local(x.localStart)||!local(x.localEnd)||typeof x.timezone!=='string'||x.timezone.length>80||!['planned','present','absent','excused','unmarked','mismatches'].every(k=>integer(x[k]))||x.planned!==x.present+x.absent+x.excused+x.unmarked)bad();return {sessionId:validUuid(x.sessionId),version:x.version,state:x.state,localStart:x.localStart,localEnd:x.localEnd,timezone:x.timezone,holiday:x.holiday,planned:x.planned,present:x.present,absent:x.absent,excused:x.excused,unmarked:x.unmarked,mismatches:x.mismatches};})};}
 if(typeof d.replayed!=='boolean')bad();
 // Do not return unneeded mutation metadata or arbitrary upstream fields.
 return {...base,replayed:d.replayed};
}
