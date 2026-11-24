import { SecurityError, validUuid } from './security.js';

const errors = Object.freeze({
  QS_INVALID:400, QS_DISABLED:503, QS_FORBIDDEN:403, QS_SESSION_CLOSED:409,
  QS_VERSION_CONFLICT:409, QS_IDEMPOTENCY_CONFLICT:409, QS_INVALID_PASS:409
});
export function attendanceCommand(body) {
  let value=body;
  if(typeof body==='string'){
    if(body.length>2048)throw new SecurityError(413,'PAYLOAD_TOO_LARGE');
    try{value=JSON.parse(body);}catch{throw new SecurityError(400,'INVALID_COMMAND');}
  }
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.getPrototypeOf(value)!==Object.prototype)
    throw new SecurityError(400,'INVALID_COMMAND');
  const allowed=['action','sessionId','rosterId','requestId','expectedVersion','status','qrToken','reason'];
  if(Object.keys(value).some(k=>!allowed.includes(k)) || !['read','issue','mark'].includes(value.action))
    throw new SecurityError(400,'INVALID_COMMAND');
  const out={p_action:value.action,p_session:validUuid(value.sessionId),p_roster:validUuid(value.rosterId),
    p_request:null,p_expected:null,p_status:null,p_qr:null,p_reason:null};
  if(value.action!=='mark'){
    if(Object.keys(value).some(k=>!['action','sessionId','rosterId'].includes(k)))throw new SecurityError(400,'INVALID_COMMAND');
    return out;
  }
  if(![0,1].includes(value.expectedVersion) || !['present','absent'].includes(value.status))
    throw new SecurityError(400,'INVALID_COMMAND');
  Object.assign(out,{p_request:validUuid(value.requestId),p_expected:value.expectedVersion,p_status:value.status});
  if(Object.hasOwn(value,'qrToken')){
    if(typeof value.qrToken!=='string' || !/^[a-f0-9]{64}$/.test(value.qrToken) || value.status!=='present' || Object.hasOwn(value,'reason'))
      throw new SecurityError(400,'INVALID_COMMAND');
    out.p_qr=value.qrToken;
  }else{
    const reasons=value.status==='present'?['in_person','roll_call']:['verified_absence'];
    if(!reasons.includes(value.reason))throw new SecurityError(400,'INVALID_COMMAND');
    out.p_reason=value.reason;
  }
  return out;
}
export async function executeAttendance(config,jwt,command,fetchImpl=fetch){
  let res;
  try{
    res=await fetchImpl(config.origin+'/rest/v1/rpc/qs_stg_p3_command',{
      method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),
      headers:{apikey:config.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',Accept:'application/json','Content-Profile':'public'},
      body:JSON.stringify(command)
    });
  }catch{throw new SecurityError(503,'ATTENDANCE_UPSTREAM_UNAVAILABLE');}
  let data;
  try{data=await res.json();}catch{throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');}
  if(!res.ok){
    if(data?.code==='P0001' && Object.hasOwn(errors,data.message))throw new SecurityError(errors[data.message],data.message);
    if(res.status===401 || res.status===403)throw new SecurityError(403,'ATTENDANCE_FORBIDDEN');
    throw new SecurityError(502,'ATTENDANCE_UPSTREAM_ERROR');
  }
  if(data?.sessionId!==command.p_session || data?.rosterId!==command.p_roster)
    throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');
  const base={sessionId:data.sessionId,rosterId:data.rosterId};
  if(command.p_action==='issue'){
    if(typeof data.token!=='string' || !/^[a-f0-9]{64}$/.test(data.token) || !Number.isFinite(Date.parse(data.expiresAt)))
      throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');
    return {...base,token:data.token,expiresAt:data.expiresAt};
  }
  if(!((data.version===0 && data.status==='unmarked' && data.recordedAt===null) ||
    (data.version===1 && ['present','absent'].includes(data.status) && Number.isFinite(Date.parse(data.recordedAt)))))
    throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');
  const snapshot={...base,status:data.status,version:data.version,recordedAt:data.recordedAt};
  if(command.p_action==='read')return snapshot;
  if(data.version!==1 || data.status!==command.p_status || typeof data.replayed!=='boolean')
    throw new SecurityError(502,'INVALID_UPSTREAM_RESPONSE');
  return {...snapshot,eventId:validUuid(data.eventId),replayed:data.replayed};
}
