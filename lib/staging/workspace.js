import {SecurityError,validUuid} from './security.js';
export async function listSessions(config,jwt,rosterId,fetchImpl=fetch){
 const id=validUuid(rosterId);
 let r;
 try{r=await fetchImpl(config.origin+'/rest/v1/rpc/qs_stg_p5_sessions',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{apikey:config.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json','Content-Profile':'public'},body:JSON.stringify({p_roster:id})});}
 catch{throw new SecurityError(503,'WORKSPACE_UPSTREAM_UNAVAILABLE');}
 let data;try{data=await r.json();}catch{throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');}
 if(!r.ok){
   if(data?.code==='P0001'&&data.message==='QS_DISABLED')throw new SecurityError(503,'QS_DISABLED');
   if(r.status===401||r.status===403||(data?.code==='P0001'&&data.message==='QS_FORBIDDEN'))throw new SecurityError(403,'WORKSPACE_FORBIDDEN');
   throw new SecurityError(502,'WORKSPACE_UPSTREAM_ERROR');
 }
 if(data?.rosterId!==id||!Array.isArray(data.sessions)||data.sessions.length>30)throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');
 return {rosterId:id,sessions:data.sessions.map(s=>{
   if(!Number.isFinite(Date.parse(s.opensAt))||!Number.isFinite(Date.parse(s.closesAt))||Date.parse(s.closesAt)<=Date.parse(s.opensAt)||!((s.version===0&&s.status==='unmarked')||(Number.isSafeInteger(s.version)&&s.version>=1&&['present','absent'].includes(s.status))))throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');
   return {sessionId:validUuid(s.sessionId),opensAt:s.opensAt,closesAt:s.closesAt,status:s.status,version:s.version};
 })};
}
