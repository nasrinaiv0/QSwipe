import {SecurityError,validUuid} from './security.js';
const date=v=>typeof v==='string'&&v.length<=40&&Number.isFinite(Date.parse(v));
const status=v=>['present','absent'].includes(v);
const version=v=>Number.isSafeInteger(v)&&v>=1&&v<=2147483647;
const bad=()=>{throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');};
export function inboxParams(url){
 const u=new URL(url,'https://qswipe.invalid'),p=u.searchParams;
 if([...p.keys()].some(k=>!['workspace_id','before_at','before_id'].includes(k))||[...new Set(p.keys())].some(k=>p.getAll(k).length!==1))throw new SecurityError(400,'INVALID_CURSOR');
 const at=p.get('before_at'),id=p.get('before_id');
 if((at===null)!==(id===null)||(at!==null&&!date(at)))throw new SecurityError(400,'INVALID_CURSOR');
 return {p_workspace:validUuid(p.get('workspace_id')),p_before_at:at,p_before_id:id===null?null:validUuid(id)};
}
export async function listInbox(config,jwt,params,fetchImpl=fetch){
 let r;try{r=await fetchImpl(config.origin+'/rest/v1/rpc/qs_stg_p6_inbox',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json','Content-Profile':'public'},body:JSON.stringify(params)});}catch{throw new SecurityError(503,'INBOX_UNAVAILABLE');}
 let d;try{d=await r.json();}catch{bad();}
 if(!r.ok){if(d?.code==='P0001'&&d.message==='QS_DISABLED')throw new SecurityError(503,'QS_DISABLED');if(r.status===401||r.status===403||(d?.code==='P0001'&&d.message==='QS_FORBIDDEN'))throw new SecurityError(403,'INBOX_FORBIDDEN');throw new SecurityError(502,'INBOX_UPSTREAM_ERROR');}
 if(d?.workspaceId!==params.p_workspace||!Array.isArray(d.rows)||d.rows.length>20)bad();
 const rows=d.rows.map(x=>{
  if(!x||typeof x.employee!=='string'||x.employee.length>60||!date(x.createdAt)||!version(x.baseVersion)||!version(x.currentVersion)||!status(x.originalStatus)||!status(x.proposedStatus)||x.originalStatus===x.proposedStatus||!['incorrect_mark','verified_attendance','verified_absence'].includes(x.reason))bad();
  return {requestId:validUuid(x.requestId),sessionId:validUuid(x.sessionId),rosterId:validUuid(x.rosterId),employee:x.employee,baseVersion:x.baseVersion,currentVersion:x.currentVersion,originalStatus:x.originalStatus,proposedStatus:x.proposedStatus,reason:x.reason,createdAt:x.createdAt};
 });
 let nextCursor=null;
 if(d.nextCursor!==null){const last=rows.at(-1);if(!last||rows.length!==20||!date(d.nextCursor?.at)||d.nextCursor.at!==last.createdAt||d.nextCursor.id!==last.requestId)bad();nextCursor={at:d.nextCursor.at,id:validUuid(d.nextCursor.id)};}
 return {workspaceId:params.p_workspace,rows,nextCursor};
}
