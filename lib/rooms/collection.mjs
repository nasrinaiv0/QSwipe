import {rewardOptions,grantSeasonRewards} from './creative.mjs';
import {zodiacCollection,accessories,seasonView,creditSeason} from './seasonal.mjs';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
const hash=x=>createHash('sha256').update(x).digest('hex');
const token=n=>randomBytes(n).toString('hex');
const fail=(status,code)=>{throw Object.assign(Error(code),{status,code});};
const day=t=>new Date(t).toISOString().slice(0,10);
export const MASCOTS=['duck','fox','bunny','bear','star'];
const safeName=x=>typeof x==='string'&&x.trim().length>0&&x.length<=24&&!/[\u0000-\u001f\u007f]/.test(x);
export function collection(p){
 return [...[{id:'duck',label:'Sunny',unlocked:true,requirement:'Starter mascot'},{id:'fox',label:'Ember',unlocked:p.rounds>=3,requirement:'Complete 3 games'},{id:'bunny',label:'Sprout',unlocked:p.points>=100,requirement:'Earn 100 lifetime points'},{id:'bear',label:'Mochi',unlocked:p.bingoWins>=1,requirement:'Win a bingo round'},{id:'star',label:'Nova',unlocked:p.tournamentWins>=1,requirement:'Win a tournament'}],...zodiacCollection(p)];
}
export function profileView(p,now){return {name:p.name,mascot:p.mascot,points:p.points,rounds:p.rounds,bingoWins:p.bingoWins,tournamentWins:p.tournamentWins,collection:collection(p),accessory:p.accessory??'none',accessories:[...accessories(p),...rewardOptions(p)],season:seasonView(p,now),daily:{date:day(now),completed:p.daily===day(now),reward:25},history:structuredClone(p.history)};}
export function createProfiles(initial,now){
 const records=new Map(initial.map(p=>[p.id,p]));
 function get(secret){if(typeof secret!=='string'||!/^[0-9a-f]{64}$/.test(secret))fail(403,'PROFILE_DENIED');const d=Buffer.from(hash(secret),'hex');const p=[...records.values()].find(p=>timingSafeEqual(Buffer.from(p.secretHash,'hex'),d));if(!p)fail(403,'PROFILE_DENIED');return p;}
 function create(name){if(!safeName(name))fail(400,'INVALID_PLAYER');if(records.size>=250)fail(503,'PROFILE_LIMIT');const credential=token(32),p={id:token(16),secretHash:hash(credential),name:name.trim(),mascot:'duck',points:0,rounds:0,bingoWins:0,tournamentWins:0,daily:null,history:[],lastSeen:now()};records.set(p.id,p);return {profileCredential:credential,profile:profileView(p,now())};}
 function command(body,secret){if(body.action==='profile_create')return create(body.name);const p=get(secret);if(body.action==='profile_mascot'){if(!collection(p).some(m=>m.id===body.mascot&&m.unlocked))fail(409,'MASCOT_LOCKED');p.mascot=body.mascot;p.lastSeen=now();}else if(body.action==='profile_accessory'){if(![...accessories(p),...rewardOptions(p)].some(a=>a.id===body.accessory&&a.unlocked))fail(409,'ACCESSORY_LOCKED');p.accessory=body.accessory;p.lastSeen=now();}else if(body.action==='profile_rename'){if(!safeName(body.name))fail(400,'INVALID_PLAYER');p.name=body.name.trim();p.lastSeen=now();}return {profile:profileView(p,now())};}
 function expire(active){for(const [id,p] of records)if(!active.has(id)&&p.lastSeen<now()-90*86400000)records.delete(id);}
 function credit(r,q){for(const seat of r.players){const p=records.get(seat.profileId);if(!p)continue;
  const delta=Math.max(0,seat.points-(q.baseline?.[seat.id]??seat.points));p.points+=delta;p.rounds++;p.lastSeen=now();
  if(q.game==='bingo'&&q.winner===seat.id)p.bingoWins++;
  const eligible=q.game==='trivia'?(q.answered.get(seat.id)||0)>0:q.game==='memory'?q.boards[seat.id].matched.length>0:q.game==='bingo'?q.marks[seat.id].length>0:['charades','drawing'].includes(q.game)?((q.guesses[seat.id]??0)>0||(q.actor===seat.id&&!!q.winner)):false;
  if(['trivia','memory','bingo','charades','drawing'].includes(q.game)){creditSeason(p,now(),delta);grantSeasonRewards(p);}
  if(eligible&&p.daily!==day(now())){p.daily=day(now());p.points+=25;}
 }}
 function history(r,t){for(const seat of r.players){const p=records.get(seat.profileId);if(!p)continue;const won=t.winners.includes(seat.id);if(won)p.tournamentWins++;p.history.unshift({id:t.id,title:t.title,trophy:t.trophy,trophyName:t.trophyName??t.trophy,points:t.scores.find(s=>s.id===seat.id).points,won,completedAt:new Date(now()).toISOString()});p.history=p.history.slice(0,20);p.lastSeen=now();}}
 return {records,get,command,expire,credit,history,export:()=>structuredClone([...records.values()])};
}
const lines=[...Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r*5+c)),...Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>r*5+c)),[0,6,12,18,24],[4,8,12,16,20]];
export const bingoLine=marks=>lines.some(line=>line.every(i=>i===12||marks.includes(i)));
export function bingoCalls(q,t){return q.draw.slice(0,Math.max(0,Math.min(75,Math.floor((t-q.startsAt)/900)+1)));}
export function makeBingo(participants,shuffle,rand){return {draw:shuffle(Array.from({length:75},(_,i)=>i+1),rand),boards:Object.fromEntries(participants.map(id=>{const nums=shuffle(Array.from({length:75},(_,i)=>i+1),rand).slice(0,25);nums[12]=0;return [id,nums];})),marks:Object.fromEntries(participants.map(id=>[id,[]])),winner:null};}
