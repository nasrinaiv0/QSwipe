import {randomBytes} from 'node:crypto';
const token=()=>randomBytes(16).toString('hex');
const fail=(status,code)=>{throw Object.assign(Error(code),{status,code});};
const DAY=86400000;
const fields={attendance_list:[],attendance_create:['name','timezone'],attendance_join:['invite'],attendance_state:['teamId'],attendance_open:['teamId'],attendance_mark:['teamId','sessionId','memberId','status','revision'],attendance_close:['teamId','sessionId'],attendance_rotate:['teamId'],attendance_leave:['teamId'],attendance_remove:['teamId','memberId']};
const hex=x=>typeof x==='string'&&/^[0-9a-f]{32}$/.test(x);
const label=x=>typeof x==='string'&&x.trim().length>0&&x.length<=40&&!/[\u0000-\u001f\u007f]/.test(x);
function formatter(zone){if(typeof zone!=='string'||zone.length>64||!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(zone))fail(400,'ATTENDANCE_TIMEZONE');try{return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{fail(400,'ATTENDANCE_TIMEZONE');}}
function date(t,zone){const parts=Object.fromEntries(formatter(zone).formatToParts(t).map(x=>[x.type,x.value]));return parts.year+'-'+parts.month+'-'+parts.day;}
export function createAttendance(initial,profiles,now,enabled=false){
 if(!Array.isArray(initial)||initial.length>12)fail(503,'ROOM_STORE_UNAVAILABLE');
 const teams=structuredClone(initial);
 const current=t=>t.sessions.at(-1);
 const open=t=>{const s=current(t);return s&&!s.closedAt&&s.date===date(now(),t.timezone)?s:null;};
 const touch=(t,p)=>{t.updatedAt=now();p.lastSeen=now();};
 function expire(){if(!enabled)return;for(let i=teams.length-1;i>=0;i--)if(teams[i].updatedAt<now()-90*DAY)teams.splice(i,1);}
 function activeIds(){return teams.flatMap(t=>t.members.map(m=>m.id));}
 function sessionView(s,t,p){const owner=t.owner===p.id;const roster=s.roster.filter(m=>owner||m.id===p.id);return {id:s.id,date:s.date,open:open(t)?.id===s.id,roster:roster.map(m=>({id:m.id,name:m.name,status:s.marks[m.id]?.status??'unmarked',revision:s.marks[m.id]?.revision??0}))};}
 function view(t,p){const owner=t.owner===p.id;return {id:t.id,name:t.name,timezone:t.timezone,owner,me:p.id,today:date(now(),t.timezone),...(owner?{invite:t.invite,members:t.members.map(m=>({id:m.id,name:profiles.records.get(m.id)?.name??m.name}))}:{}),sessions:t.sessions.slice().reverse().map(s=>sessionView(s,t,p)).filter(s=>owner||s.roster.length)};}
 function list(p){return teams.filter(t=>t.members.some(m=>m.id===p.id)).map(t=>({id:t.id,name:t.name,owner:t.owner===p.id}));}
 function command(body,secret){
  if(!enabled)fail(503,'ATTENDANCE_DISABLED');
  const keys=fields[body.action];if(!keys||Object.keys(body).length!==keys.length+1||keys.some(k=>!Object.hasOwn(body,k)))fail(400,'INVALID_COMMAND');
  const p=profiles.get(secret);expire();
  if(body.action==='attendance_list')return {teams:list(p),profile:{name:p.name,mascot:p.mascot}};
  if(body.action==='attendance_create'){
   if(!label(body.name))fail(400,'INVALID_COMMAND');formatter(body.timezone);
   if(teams.length>=12||teams.filter(t=>t.owner===p.id).length>=3)fail(409,'ATTENDANCE_LIMIT');
   const t={id:token(),name:body.name.trim(),timezone:body.timezone,owner:p.id,invite:token(),members:[{id:p.id,name:p.name}],sessions:[],updatedAt:now()};teams.push(t);touch(t,p);return {team:view(t,p)};
  }
  if(body.action==='attendance_join'){
   const t=hex(body.invite)&&teams.find(t=>t.invite===body.invite);if(!t)fail(403,'ATTENDANCE_DENIED');
   if(!t.members.some(m=>m.id===p.id)){if(t.members.length>=32)fail(409,'ATTENDANCE_LIMIT');t.members.push({id:p.id,name:p.name});touch(t,p);}
   return {team:view(t,p)};
  }
  const t=hex(body.teamId)&&teams.find(t=>t.id===body.teamId&&t.members.some(m=>m.id===p.id));
  if(!t)fail(403,'ATTENDANCE_DENIED');const owner=t.owner===p.id;
  if(body.action==='attendance_state')return {team:view(t,p)};
  if(body.action==='attendance_leave'){if(owner)fail(403,'ATTENDANCE_OWNER_ONLY');t.members=t.members.filter(m=>m.id!==p.id);touch(t,p);return {teams:list(p)};}
  if(!owner&&body.action!=='attendance_mark')fail(403,'ATTENDANCE_OWNER_ONLY');
  if(body.action==='attendance_rotate'){t.invite=token();touch(t,p);return {team:view(t,p)};}
  if(body.action==='attendance_remove'){if(!hex(body.memberId)||body.memberId===t.owner||!t.members.some(m=>m.id===body.memberId))fail(400,'INVALID_COMMAND');t.members=t.members.filter(m=>m.id!==body.memberId);t.invite=token();touch(t,p);return {team:view(t,p)};}
  if(body.action==='attendance_open'){
   const today=date(now(),t.timezone);const previous=current(t);
   if(previous?.date===today){if(!open(t))fail(409,'ATTENDANCE_CLOSED');return {team:view(t,p)};}
   if(previous&&!previous.closedAt)previous.closedAt=now();
   t.sessions.push({id:token(),date:today,closedAt:null,roster:t.members.map(m=>({id:m.id,name:profiles.records.get(m.id)?.name??m.name})),marks:{}});
   t.sessions=t.sessions.slice(-30);touch(t,p);return {team:view(t,p)};
  }
  const s=open(t);if(!s||s.id!==body.sessionId)fail(409,'ATTENDANCE_CLOSED');
  if(body.action==='attendance_close'){s.closedAt=now();touch(t,p);return {team:view(t,p)};}
  if(body.action==='attendance_mark'){
   if(!hex(body.memberId)||!s.roster.some(m=>m.id===body.memberId)||!t.members.some(m=>m.id===body.memberId)||!['present','absent'].includes(body.status)||!Number.isSafeInteger(body.revision)||body.revision<0)fail(400,'INVALID_COMMAND');
   if(!owner&&(body.memberId!==p.id||body.status!=='present'))fail(403,'ATTENDANCE_DENIED');
   const old=s.marks[body.memberId];if(old?.status===body.status)return {team:view(t,p)};
   if(!owner&&old)fail(409,'ATTENDANCE_CONFLICT');
   if((old?.revision??0)!==body.revision)fail(409,'ATTENDANCE_CONFLICT');
   s.marks[body.memberId]={status:body.status,revision:(old?.revision??0)+1,at:now(),by:p.id};touch(t,p);return {team:view(t,p)};
  }
  fail(400,'INVALID_COMMAND');
 }
 return {command,expire,activeIds,export:()=>structuredClone(teams)};
}
