import {THEMES,validStroke,customQuestion} from './creative.mjs';
import {makeCharades,guessCharades,seasonView} from './seasonal.mjs';
import {createProfiles,profileView,bingoLine,bingoCalls,makeBingo} from './collection.mjs';
import {randomBytes,randomInt,createHash,timingSafeEqual} from 'node:crypto';
const digest=x=>createHash('sha256').update(x).digest('hex');
const matchSecret=(hash,secret)=>typeof secret==='string'&&/^[0-9a-f]{64}$/.test(secret)&&timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(digest(secret),'hex'));
const token=bytes=>randomBytes(bytes).toString('hex');
const boundedName=x=>typeof x==='string'?x.trim().replace(/\s+/g,' ').slice(0,24):'';
const error=(status,code)=>{throw Object.assign(new Error(code),{status,code});};
const shuffle=(a,rand)=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
const quiz=rand=>{const a=2+rand(18),b=2+rand(18),correct=a+b;const options=shuffle([correct,correct-1,correct+1,correct+2],rand);return {text:a+' + '+b+' = ?',options,answer:options.indexOf(correct)};};
export function createRoomService({now=Date.now,rand=randomInt,maxRooms=100,ttl=7200000,initial=[]}={}){
 const rooms=new Map(),invites=new Map();
 const meta=initial.filter(x=>x?.kind==='profiles-v1');if(meta.length>1||meta.some(x=>!Array.isArray(x.profiles)||x.profiles.length>250))error(503,'ROOM_STORE_UNAVAILABLE');
 const profiles=createProfiles(structuredClone(meta[0]?.profiles??[]),now);
 for(const raw of structuredClone(initial.filter(x=>x?.kind!=='profiles-v1'))){const q=raw.round;if(['trivia','custom_trivia'].includes(q?.game))for(const k of ['answers','correct','answered'])q[k]=new Map(q[k]);rooms.set(raw.id,raw);invites.set(raw.invite,raw.id);}
 const exportState=()=>{const records=[...rooms.values()].map(r=>{const q=r.round;return structuredClone({...r,round:['trivia','custom_trivia'].includes(q?.game)?{...q,answers:[...q.answers],correct:[...q.correct],answered:[...q.answered]}:q});});const saved=profiles.export();return saved.length?[...records,{kind:'profiles-v1',profiles:saved}]:records;};
 const bump=r=>r.version++;
 const sweep=()=>{for(const [id,r] of rooms)if(r.expiresAt<=now()){rooms.delete(id);invites.delete(r.invite);}profiles.expire(new Set([...rooms.values()].flatMap(r=>r.players.map(p=>p.profileId)).filter(Boolean)));};
 const member=(r,name,team,host=false)=>{const secret=token(32),p={id:token(8),secretHash:digest(secret),name,team,host,points:0,rounds:0,wins:0,perfect:0,skin:'classic'};r.players.push(p);return {p,secret};};
 const identity=(body)=>{const name=boundedName(body.name);if(!name||!['amber','jade'].includes(body.team)||typeof body.name!=='string'||body.name.length>24||/[\u0000-\u001f\u007f]/.test(body.name))error(400,'INVALID_PLAYER');return {name,team:body.team};};
 function finish(r,q){r.phase='finished';if(q.game!=='custom_trivia'){profiles.credit(r,q);completeTournament(r);}bump(r);}
 function settle(r){
  const q=r.round,t=now();if(!q||r.phase!=='playing')return;
  if(['charades','drawing'].includes(q.game)){if(!q.winner&&t<q.endsAt)return;for(const p of r.players){p.rounds++;if(q.winner&&p.id===q.winner)p.points+=30;if(q.winner&&p.id===q.actor)p.points+=20;}finish(r,q);return;}
  if(q.game==='bingo'){if(!q.winner&&t<q.endsAt)return;for(const p of r.players)p.rounds++;if(q.winner){const p=r.players.find(x=>x.id===q.winner);p.points+=40;p.wins++;}finish(r,q);return;}
  if(q.game==='memory'){
   if(t<q.endsAt&&!Object.values(q.boards).every(b=>b.matched.length===16))return;
   for(const p of r.players){const b=q.boards[p.id];p.points+=b.matched.length/2*5+(b.matched.length===16?10:0);p.rounds++;if(b.matched.length===16)p.memoryWins=(p.memoryWins||0)+1;}
   finish(r,q);return;
  }
  if(!['trivia','custom_trivia'].includes(q.game)){
   if(t<q.endsAt)return;
   const win=r.players.find(p=>p.id===q.order[0]);win.points+=20;win.wins++;
   for(const p of r.players)p.rounds++;
   finish(r,q);return;
  }
  if(t<q.endsAt&&q.answers.size<r.players.length)return;
  for(const p of r.players){
   const a=q.answers.get(p.id);if(a===q.questions[q.index].answer){q.correct.set(p.id,(q.correct.get(p.id)||0)+1);if(q.game==='trivia')p.points+=10;}
   if(a!==undefined)q.answered.set(p.id,(q.answered.get(p.id)||0)+1);
  }
  if(q.index===4){if(q.game==='trivia')for(const p of r.players){p.rounds++;if(q.answered.get(p.id)===5)p.points+=10;if(q.correct.get(p.id)===5)p.perfect++;}finish(r,q);return;}
  else r.phase='reveal';
  bump(r);
 }
 function completeTournament(r){
 const t=r.tournament;if(!t||t.status!=='active')return;
 t.completed++;if(t.completed===3){t.status='finished';const scores=r.players.map(p=>({id:p.id,points:p.points-t.baseline[p.id]}));const best=Math.max(...scores.map(p=>p.points));t.winners=scores.filter(p=>p.points===best).map(p=>p.id);t.scores=scores;profiles.history(r,t);}
 }
 function snapshot(r,p){
  settle(r);const q=r.round;
  const players=r.players.map(x=>({id:x.id,name:x.name,team:x.team,departed:!!x.departed,points:x.points,rounds:x.rounds,wins:x.wins,perfect:x.perfect,skin:x.skin??'classic',mascot:profiles.records.get(x.profileId)?.mascot??'duck',accessory:profiles.records.get(x.profileId)?.accessory??'none',badges:[...(x.rounds?['First round']:[]),...(x.wins?['Lucky star']:[]),...(x.perfect?['Perfect five']:[]),...(x.points>=100?['Gold frame']:[]),...(x.memoryWins?['Memory master']:[]),...(r.tournament?.winners?.includes(x.id)?[r.tournament.trophy]:[])]}));
  const teams=['jade','amber'].map(team=>{const a=players.filter(x=>x.team===team),total=a.reduce((n,x)=>n+x.points,0);return {team,count:a.length,total,average:a.length?Math.round(total*10/a.length)/10:null};});
  let round=null;
  if(q){round={id:q.id,game:q.game,startsAt:q.startsAt,endsAt:q.endsAt,participants:q.participants};
   if(['trivia','custom_trivia'].includes(q.game)){const item=q.questions[q.index];Object.assign(round,{index:q.index,question:item.text,options:item.options,answered:q.answers.has(p.id),answerCount:q.answers.size,...(r.phase!=='playing'?{answer:item.answer,selected:q.answers.get(p.id)??null}: {})});}
   else if(q.game==='memory'){const b=q.boards[p.id];Object.assign(round,{turn:b.turn,matched:b.matched.length/2,cards:b.deck.map((v,i)=>b.matched.includes(i)||b.open.includes(i)&&(b.hideAt===0||now()<b.hideAt)?v:null),locked:b.hideAt>now(),complete:b.matched.length===16});}
   else if(['charades','drawing'].includes(q.game))Object.assign(round,{actor:q.actor,guesses:q.guesses[p.id]??0,winner:q.winner,...(q.game==='drawing'?{strokes:q.strokes}:{}),...(p.id===q.actor||r.phase==='finished'?{prompt:q.prompt}:{})});
   else if(q.game==='bingo')Object.assign(round,{board:q.boards[p.id],marks:q.marks[p.id],calls:bingoCalls(q,now()),winner:q.winner});
   else Object.assign(round,{order:q.order,winner:q.order[0],finish:q.finish,theme:q.theme??'pond'});
  }
  return {roomId:r.id,version:r.version,serverNow:now(),expiresAt:r.expiresAt,phase:r.phase,me:p.id,host:p.host,...(p.host?{invite:r.invite}:{}),players,teams,round,notice:r.notice??'',raceTheme:r.raceTheme??'pond',customCount:r.customQuestions?.length??0,season:r.players.filter(x=>profiles.records.has(x.profileId)).map(x=>({id:x.id,points:seasonView(profiles.records.get(x.profileId),now()).points})).sort((a,b)=>b.points-a.points||a.id.localeCompare(b.id)),...(p.profileId&&profiles.records.has(p.profileId)?{profile:profileView(profiles.records.get(p.profileId),now())}:{}),tournament:r.tournament?{title:r.tournament.title,trophy:r.tournament.trophy,trophyName:r.tournament.trophyName??r.tournament.trophy,status:r.tournament.status,completed:r.tournament.completed,winners:r.tournament.winners??[],scores:r.players.map(x=>({id:x.id,points:r.tournament.status==='finished'?r.tournament.scores.find(y=>y.id===x.id)?.points??0:x.points-r.tournament.baseline[x.id]}))}:null};
 }
 function command(body,secret){
  sweep();if(!body||Object.getPrototypeOf(body)!==Object.prototype)error(400,'INVALID_COMMAND');
  const fields={leave:['action','roomId'],race_theme:['action','roomId','version','theme'],custom_question:['action','roomId','version','text','options','answer'],custom_clear:['action','roomId','version'],draw_stroke:['action','roomId','roundId','index','color','points'],profile_accessory:['action','accessory'],charades_guess:['action','roomId','roundId','guess'],profile_create:['action','name'],profile_state:['action'],profile_mascot:['action','mascot'],profile_rename:['action','name'],create_profile:['action','team'],join_profile:['action','invite','team'],bingo_mark:['action','roomId','roundId','card'],tournament_custom:['action','roomId','version','title','trophy','trophyName'],create:['action','name','team'],join:['action','invite','name','team'],state:['action','roomId'],start:['action','roomId','game','version'],answer:['action','roomId','roundId','index','choice'],next:['action','roomId','roundId','index'],lobby:['action','roomId','version'],close:['action','roomId'],skin:['action','roomId','skin'],tournament:['action','roomId','version','title','trophy'],flip:['action','roomId','roundId','turn','card']};
  if(!Object.hasOwn(fields,body.action)||Object.keys(body).length!==fields[body.action].length||fields[body.action].some(k=>!Object.hasOwn(body,k)))error(400,'INVALID_COMMAND');
  if(['profile_create','profile_state','profile_mascot','profile_rename','profile_accessory'].includes(body.action))return profiles.command(body,secret);
  const profile=['create_profile','join_profile'].includes(body.action)?profiles.get(secret):null;
  if(['create','create_profile'].includes(body.action)){
   const {name,team}=identity(profile?{...body,name:profile.name}:body);if(rooms.size>=Math.min(maxRooms,99))error(503,'ROOM_LIMIT');
   const r={id:token(16),invite:token(16),players:[],phase:'lobby',round:null,roundCount:0,version:1,expiresAt:now()+ttl};
   const {p,secret}=member(r,name,team,true);if(profile){p.profileId=profile.id;profile.lastSeen=now();}rooms.set(r.id,r);invites.set(r.invite,r.id);return {credential:secret,state:snapshot(r,p)};
  }
  if(['join','join_profile'].includes(body.action)){
   const {name,team}=identity(profile?{...body,name:profile.name}:body);const r=rooms.get(invites.get(body.invite));if(!r)error(404,'INVITE_EXPIRED');
   if(r.phase!=='lobby'||r.players.length>=12||r.tournament?.status==='active')error(409,'ROOM_NOT_JOINABLE');
   if(r.players.some(p=>p.name.toLowerCase()===name.toLowerCase()||(profile&&p.profileId===profile.id)))error(409,'NAME_TAKEN');
   const {p,secret}=member(r,name,team);if(profile){p.profileId=profile.id;profile.lastSeen=now();}bump(r);return {credential:secret,state:snapshot(r,p)};
  }
  const r=rooms.get(body.roomId);if(r&&body.action==='leave'&&(r.leftHashes??[]).some(h=>matchSecret(h,secret)))return {left:true};
  const p=r?.players.find(x=>!x.departed&&matchSecret(x.secretHash,secret));
  if(!r||!p)error(403,'ROOM_ACCESS_DENIED');
  settle(r);
  if(body.action==='state')return {state:snapshot(r,p)};
  if(body.action==='leave'){
   if(p.host)error(403,'HOST_MUST_CLOSE');
   r.leftHashes=[...(r.leftHashes??[]),p.secretHash].slice(-32);
   if(r.tournament?.status==='active'){r.tournament=null;r.notice='Tournament cancelled because a player left.';}
   if(['playing','reveal'].includes(r.phase))p.departed=true;
   else r.players=r.players.filter(x=>x.id!==p.id);
   bump(r);return {left:true};
  }
  if(body.action==='answer'){
   const q=r.round;
   if(r.phase!=='playing'||!['trivia','custom_trivia'].includes(q?.game)||body.roundId!==q.id||body.index!==q.index||now()<q.startsAt||!Number.isInteger(body.choice)||body.choice<0||body.choice>3)error(409,'QUESTION_CLOSED');
   if(q.answers.has(p.id)){if(q.answers.get(p.id)!==body.choice)error(409,'ALREADY_ANSWERED');return {state:snapshot(r,p)};}
   q.answers.set(p.id,body.choice);bump(r);return {state:snapshot(r,p)};
  }
  if(body.action==='charades_guess'){const q=r.round;if(r.phase!=='playing'||!['charades','drawing'].includes(q?.game)||q.id!==body.roundId||!guessCharades(q,p.id,body.guess,now()))error(409,'GUESS_UNAVAILABLE');bump(r);return {state:snapshot(r,p)};}
  if(body.action==='draw_stroke'){const q=r.round;if(r.phase!=='playing'||q?.game!=='drawing'||q.id!==body.roundId||q.actor!==p.id||body.index!==q.strokes.length||q.strokes.length>=32||!validStroke(body.points,body.color))error(409,'STROKE_UNAVAILABLE');q.strokes.push({color:body.color,points:structuredClone(body.points)});bump(r);return {state:snapshot(r,p)};}
  if(body.action==='bingo_mark'){const q=r.round,i=body.card;if(r.phase!=='playing'||q?.game!=='bingo'||q.id!==body.roundId||!Number.isInteger(i)||i<0||i>24||i===12||!bingoCalls(q,now()).includes(q.boards[p.id][i]))error(409,'BINGO_UNAVAILABLE');if(q.marks[p.id].includes(i))return {state:snapshot(r,p)};q.marks[p.id].push(i);if(bingoLine(q.marks[p.id]))q.winner=p.id;bump(r);return {state:snapshot(r,p)};}
  if(body.action==='skin'){if(r.phase!=='lobby'||!['classic','mint','berry','ocean'].includes(body.skin))error(409,'SKIN_UNAVAILABLE');p.skin=body.skin;bump(r);return {state:snapshot(r,p)};}
  if(body.action==='flip'){
   const q=r.round,b=q?.boards?.[p.id];if(r.phase!=='playing'||q?.game!=='memory'||q.id!==body.roundId||!b||body.turn!==b.turn||!Number.isInteger(body.card)||body.card<0||body.card>15||b.matched.includes(body.card)||b.hideAt>now()||b.matched.length===16)error(409,'CARD_UNAVAILABLE');
   if(b.hideAt){b.open=[];b.hideAt=0;}
   if(b.open.includes(body.card))error(409,'CARD_UNAVAILABLE');
   b.open.push(body.card);b.turn++;
   if(b.open.length===2){if(b.deck[b.open[0]]===b.deck[b.open[1]]){b.matched.push(...b.open);b.open=[];}else b.hideAt=now()+900;}
   bump(r);return {state:snapshot(r,p)};
  }
  if(!p.host)error(403,'HOST_ONLY');
  if(['race_theme','custom_question','custom_clear'].includes(body.action)){
   if(r.phase!=='lobby'||body.version!==r.version)error(409,'LOBBY_CHANGED');
   if(body.action==='race_theme'){if(!THEMES.includes(body.theme))error(400,'INVALID_THEME');r.raceTheme=body.theme;}
   else if(body.action==='custom_clear')r.customQuestions=[];
   else{const q=customQuestion(body.text,body.options,body.answer);if(!q||(r.customQuestions?.length??0)>=5)error(400,'INVALID_QUESTION');(r.customQuestions??=[]).push(q);}
   bump(r);return {state:snapshot(r,p)};
  }
  if(body.action==='close'){rooms.delete(r.id);invites.delete(r.invite);return {closed:true};}
  if(body.action==='lobby'){
   if(r.phase!=='finished'||body.version!==r.version)error(409,'ROUND_NOT_FINISHED');
   r.phase='lobby';r.round=null;r.players=r.players.filter(x=>!x.departed);bump(r);return {state:snapshot(r,p)};
  }
  if(['tournament','tournament_custom'].includes(body.action)){
   if(r.phase!=='lobby'||r.version!==body.version||r.players.length<2||r.roundCount>27||r.tournament?.status==='active'||typeof body.title!=='string'||!body.title.trim()||body.title.length>32||/[\u0000-\u001f\u007f]/.test(body.title)||!['Huddle cup','Star trophy','Golden duck'].includes(body.trophy))error(409,'TOURNAMENT_UNAVAILABLE');
   if(body.action==='tournament_custom'&&(typeof body.trophyName!=='string'||!body.trophyName.trim()||body.trophyName.length>32||/[\u0000-\u001f\u007f]/.test(body.trophyName)))error(400,'INVALID_COMMAND');
   r.notice='';r.tournament={id:token(12),title:body.title.trim(),trophy:body.trophy,trophyName:body.trophyName?.trim()??body.trophy,status:'active',completed:0,baseline:Object.fromEntries(r.players.map(x=>[x.id,x.points]))};bump(r);return {state:snapshot(r,p)};
  }
  if(body.action==='start'){
   if(r.phase!=='lobby'||body.version!==r.version||r.players.length<2||r.roundCount>=30||!['wheel','race','trivia','memory','bingo','charades','drawing','custom_trivia'].includes(body.game))error(409,'CANNOT_START');
   if(body.game==='custom_trivia'&&(r.customQuestions?.length!==5||r.tournament?.status==='active'))error(409,'CANNOT_START');
   const participants=r.players.map(x=>x.id),startsAt=now()+(['trivia','memory','bingo','charades','drawing','custom_trivia'].includes(body.game)?0:1000);
   const q={id:token(12),game:body.game,participants,baseline:Object.fromEntries(r.players.map(p=>[p.id,p.points])),startsAt,endsAt:startsAt+(body.game==='drawing'?60000:body.game==='charades'?45000:body.game==='bingo'?82500:body.game==='memory'?60000:['trivia','custom_trivia'].includes(body.game)?20000:4500)};
   if(['trivia','custom_trivia'].includes(body.game))Object.assign(q,{questions:body.game==='custom_trivia'?structuredClone(r.customQuestions):Array.from({length:5},()=>quiz(rand)),index:0,answers:new Map(),correct:new Map(),answered:new Map()});
   else if(body.game==='memory')q.boards=Object.fromEntries(participants.map(id=>[id,{deck:shuffle([...Array(8).keys(),...Array(8).keys()],rand),open:[],matched:[],hideAt:0,turn:0}]));
   else if(['charades','drawing'].includes(body.game))Object.assign(q,makeCharades(participants,rand),body.game==='drawing'?{strokes:[]}:{});
   else if(body.game==='bingo')Object.assign(q,makeBingo(participants,shuffle,rand));
   else{q.theme=r.raceTheme??'pond';q.order=shuffle(participants,rand);q.finish=Object.fromEntries(q.order.map((id,i)=>[id,3500+i*75]));}
   r.round=q;r.roundCount++;r.phase='playing';bump(r);return {state:snapshot(r,p)};
  }
  if(body.action==='next'){
   const q=r.round;if(r.phase!=='reveal'||!['trivia','custom_trivia'].includes(q?.game)||body.roundId!==q.id||body.index!==q.index)error(409,'CANNOT_ADVANCE');
   q.index++;q.answers=new Map();q.startsAt=now();q.endsAt=q.startsAt+20000;r.phase='playing';bump(r);return {state:snapshot(r,p)};
  }
  error(400,'INVALID_COMMAND');
 }
 return {command,exportState};
}
