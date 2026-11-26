import { isIsoDate, addDays } from './model';
import { rollIndex } from './games';
import type { Person } from './types';
export interface PlayScore { id:string; playerId:string; day:string; correct:number; total:5 }
export const SCORE_LIMIT=2000;
export const points=(s:PlayScore)=>10+s.correct*10;
export function cleanScores(value:unknown,people:readonly Person[]):PlayScore[]{
 const ids=new Set(people.map(p=>p.id)),seen=new Set<string>(),days=new Set<string>(),out:PlayScore[]=[];
 if(!Array.isArray(value))return out;
 for(const raw of value.slice(0,SCORE_LIMIT)){
  if(!raw||typeof raw!=='object')continue;
  const {id,playerId,day,correct,total}=raw as PlayScore;
  if(typeof id!=='string'||!/^[A-Za-z0-9-]{8,64}$/.test(id)||!ids.has(playerId)||!isIsoDate(day)||total!==5||!Number.isInteger(correct)||correct<0||correct>5||seen.has(id)||days.has(playerId+':'+day))continue;
  seen.add(id);days.add(playerId+':'+day);out.push({id,playerId,day,correct,total});
 }
 return out;
}
export function addScore(scores:readonly PlayScore[],score:PlayScore,people:readonly Person[],today:string):PlayScore[]|null{
 if(score.day!==today||scores.some(s=>s.id===score.id||(s.playerId===score.playerId&&s.day===score.day))||cleanScores([score],people).length!==1)return null;
 return [score,...scores].slice(0,SCORE_LIMIT);
}
export function leaderboard(scores:readonly PlayScore[],people:readonly Person[],today:string,period:'week'|'all'){
 const floor=addDays(today,-6);
 return people.map(p=>{
  const rounds=scores.filter(s=>s.playerId===p.id&&s.day<=today&&(period==='all'||s.day>=floor));
  return {person:p,points:rounds.reduce((n,s)=>n+points(s),0),rounds:rounds.length,perfect:rounds.filter(s=>s.correct===5).length};
 }).filter(p=>p.rounds>0).sort((a,b)=>b.points-a.points||b.perfect-a.perfect||a.person.name.localeCompare(b.person.name)||a.person.id.localeCompare(b.person.id));
}
export const milestones=(rounds:number,perfect:number,score:number)=>[
 {label:'First round',detail:'Complete one scored round',unlocked:rounds>=1,symbol:'✦'},
 {label:'Perfect five',detail:'Answer all five correctly',unlocked:perfect>=1,symbol:'★'},
 {label:'Team regular',detail:'Complete five scored rounds',unlocked:rounds>=5,symbol:'◆'},
 {label:'Gold frame',detail:'Earn 200 points',unlocked:score>=200,symbol:'♛'},
];
export interface ChallengeQuestion{question:string;options:number[];answer:number}
export function challengeQuestion(rand:(n:number)=>number=rollIndex):ChallengeQuestion{
 const a=2+rand(18),b=2+rand(18),answer=a+b;
 const options=[answer,answer+1,answer-1,answer+2];
 for(let i=3;i>0;i--){const j=rand(i+1);[options[i],options[j]]=[options[j]!,options[i]!];}
 return {question:a+' + '+b+' = ?',options,answer:options.indexOf(answer)};
}
export interface TeamRound{players:string[];questions:ChallengeQuestion[];answers:number[];turn:number;id:string;day:string}
export function createTeamRound(players:string[],id:string,day:string,rand:(n:number)=>number=rollIndex):TeamRound{
 if(players.length<2||players.length>8||new Set(players).size!==players.length||!isIsoDate(day))throw Error('Invalid players');
 return {players:[...players],questions:Array.from({length:players.length*5},()=>challengeQuestion(rand)),answers:[],turn:0,id,day};
}
export function answerTurn(round:TeamRound,index:number):TeamRound{
 if(round.turn>=round.questions.length||!Number.isInteger(index)||index<0||index>3)return round;
 return {...round,answers:[...round.answers,index],turn:round.turn+1};
}
export function roundScores(round:TeamRound):PlayScore[]{
 if(round.turn!==round.questions.length||round.answers.length!==round.questions.length)return [];
 return round.players.map((playerId,p)=>({id:round.id+'-'+p,playerId,day:round.day,total:5,correct:round.questions.reduce((n,q,i)=>n+(i%round.players.length===p&&round.answers[i]===q.answer?1:0),0)}));
}
