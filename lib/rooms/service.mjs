import {randomBytes,randomInt} from 'node:crypto';
const token=bytes=>randomBytes(bytes).toString('hex');
const boundedName=x=>typeof x==='string'?x.trim().replace(/\s+/g,' ').slice(0,24):'';
const error=(status,code)=>{throw Object.assign(new Error(code),{status,code});};
const shuffle=(a,rand)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const quiz=rand=>{const a=2+rand(18),b=2+rand(18),correct=a+b;const options=shuffle([correct,correct-1,correct+1,correct+2],rand);return {text:a+' + '+b+' = ?',options,answer:options.indexOf(correct)};};
export function createRoomService({now=Date.now,rand=randomInt,maxRooms=100,ttl=7200000}={}){
 const rooms=new Map(),invites=new Map();
 const bump=r=>r.version++;
 const sweep=()=>{for(const [id,r] of rooms)if(r.expiresAt<=now()){rooms.delete(id);invites.delete(r.invite);}};
 const member=(r,name,team,host=false)=>{const p={id:token(8),secret:token(32),name,team,host,points:0,rounds:0,wins:0,perfect:0};r.players.push(p);return p;};
 const identity=(body)=>{const name=boundedName(body.name);if(!name||!['amber','jade'].includes(body.team)||typeof body.name!=='string'||body.name.length>24||/[\u0000-\u001f\u007f]/.test(body.name))error(400,'INVALID_PLAYER');return {name,team:body.team};};
 function settle(r){
  const q=r.round,t=now();if(!q||r.phase!=='playing')return;
  if(q.game!=='trivia'){
   if(t<q.endsAt)return;
   const win=r.players.find(p=>p.id===q.order[0]);win.points+=20;win.wins++;
   for(const p of r.players)p.rounds++;
   r.phase='finished';bump(r);return;
  }
  if(t<q.endsAt&&q.answers.size<r.players.length)return;
  for(const p of r.players){
   const a=q.answers.get(p.id);if(a===q.questions[q.index].answer){q.correct.set(p.id,(q.correct.get(p.id)||0)+1);p.points+=10;}
   if(a!==undefined)q.answered.set(p.id,(q.answered.get(p.id)||0)+1);
  }
  if(q.index===4){for(const p of r.players){p.rounds++;if(q.answered.get(p.id)===5)p.points+=10;if(q.correct.get(p.id)===5)p.perfect++;}r.phase='finished';}
  else r.phase='reveal';
  bump(r);
 }
 function snapshot(r,p){
  settle(r);const q=r.round;
  const players=r.players.map(x=>({id:x.id,name:x.name,team:x.team,points:x.points,rounds:x.rounds,wins:x.wins,perfect:x.perfect,badges:[...(x.rounds?['First round']:[]),...(x.wins?['Lucky star']:[]),...(x.perfect?['Perfect five']:[]),...(x.points>=100?['Gold frame']:[])]}));
  const teams=['jade','amber'].map(team=>{const a=players.filter(x=>x.team===team),total=a.reduce((n,x)=>n+x.points,0);return {team,count:a.length,total,average:a.length?Math.round(total*10/a.length)/10:null};});
  let round=null;
  if(q){round={id:q.id,game:q.game,startsAt:q.startsAt,endsAt:q.endsAt,participants:q.participants};
   if(q.game==='trivia'){const item=q.questions[q.index];Object.assign(round,{index:q.index,question:item.text,options:item.options,answered:q.answers.has(p.id),answerCount:q.answers.size,...(r.phase!=='playing'?{answer:item.answer,selected:q.answers.get(p.id)??null}: {})});}
   else Object.assign(round,{order:q.order,winner:q.order[0],finish:q.finish});
  }
  return {roomId:r.id,version:r.version,serverNow:now(),expiresAt:r.expiresAt,phase:r.phase,me:p.id,host:p.host,...(p.host?{invite:r.invite}:{}),players,teams,round};
 }
 function command(body,secret){
  sweep();if(!body||Object.getPrototypeOf(body)!==Object.prototype)error(400,'INVALID_COMMAND');
  const fields={create:['action','name','team'],join:['action','invite','name','team'],state:['action','roomId'],start:['action','roomId','game','version'],answer:['action','roomId','roundId','index','choice'],next:['action','roomId','roundId','index'],lobby:['action','roomId','version'],close:['action','roomId']};
  if(!Object.hasOwn(fields,body.action)||Object.keys(body).length!==fields[body.action].length||fields[body.action].some(k=>!Object.hasOwn(body,k)))error(400,'INVALID_COMMAND');
  if(body.action==='create'){
   const {name,team}=identity(body);if(rooms.size>=maxRooms)error(503,'ROOM_LIMIT');
   const r={id:token(16),invite:token(16),players:[],phase:'lobby',round:null,roundCount:0,version:1,expiresAt:now()+ttl};
   const p=member(r,name,team,true);rooms.set(r.id,r);invites.set(r.invite,r.id);return {credential:p.secret,state:snapshot(r,p)};
  }
  if(body.action==='join'){
   const {name,team}=identity(body);const r=rooms.get(invites.get(body.invite));if(!r)error(404,'INVITE_EXPIRED');
   if(r.phase!=='lobby'||r.players.length>=12)error(409,'ROOM_NOT_JOINABLE');
   if(r.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))error(409,'NAME_TAKEN');
   const p=member(r,name,team);bump(r);return {credential:p.secret,state:snapshot(r,p)};
  }
  const r=rooms.get(body.roomId);const p=r?.players.find(x=>x.secret===secret);
  if(!r||!p)error(403,'ROOM_ACCESS_DENIED');
  settle(r);
  if(body.action==='state')return {state:snapshot(r,p)};
  if(body.action==='answer'){
   const q=r.round;
   if(r.phase!=='playing'||q?.game!=='trivia'||body.roundId!==q.id||body.index!==q.index||now()<q.startsAt||!Number.isInteger(body.choice)||body.choice<0||body.choice>3)error(409,'QUESTION_CLOSED');
   if(q.answers.has(p.id)){if(q.answers.get(p.id)!==body.choice)error(409,'ALREADY_ANSWERED');return {state:snapshot(r,p)};}
   q.answers.set(p.id,body.choice);bump(r);return {state:snapshot(r,p)};
  }
  if(!p.host)error(403,'HOST_ONLY');
  if(body.action==='close'){rooms.delete(r.id);invites.delete(r.invite);return {closed:true};}
  if(body.action==='lobby'){
   if(r.phase!=='finished'||body.version!==r.version)error(409,'ROUND_NOT_FINISHED');
   r.phase='lobby';r.round=null;bump(r);return {state:snapshot(r,p)};
  }
  if(body.action==='start'){
   if(r.phase!=='lobby'||body.version!==r.version||r.players.length<2||r.roundCount>=30||!['wheel','race','trivia'].includes(body.game))error(409,'CANNOT_START');
   const participants=r.players.map(x=>x.id),startsAt=now()+(body.game==='trivia'?0:1000);
   const q={id:token(12),game:body.game,participants,startsAt,endsAt:startsAt+(body.game==='trivia'?20000:4500)};
   if(body.game==='trivia')Object.assign(q,{questions:Array.from({length:5},()=>quiz(rand)),index:0,answers:new Map(),correct:new Map(),answered:new Map()});
   else{q.order=shuffle(participants,rand);q.finish=Object.fromEntries(q.order.map((id,i)=>[id,3500+i*75]));}
   r.round=q;r.roundCount++;r.phase='playing';bump(r);return {state:snapshot(r,p)};
  }
  if(body.action==='next'){
   const q=r.round;if(r.phase!=='reveal'||q?.game!=='trivia'||body.roundId!==q.id||body.index!==q.index)error(409,'CANNOT_ADVANCE');
   q.index++;q.answers=new Map();q.startsAt=now();q.endsAt=q.startsAt+20000;r.phase='playing';bump(r);return {state:snapshot(r,p)};
  }
  error(400,'INVALID_COMMAND');
 }
 return {command};
}
