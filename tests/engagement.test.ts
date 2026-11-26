import {describe,it,expect} from 'vitest';
import {addScore,answerTurn,cleanScores,createTeamRound,leaderboard,milestones,roundScores,type PlayScore} from '../src/core/engagement';
import {newPerson} from '../src/core/model';
import {parseEntries} from '../src/core/games';
const a=newPerson({name:'Alex',level:1,parentId:null}),b=newPerson({name:'Jamie',level:0,parentId:a.id}),people=[a,b],day='2026-11-24';
describe('team challenge',()=>{
 it('gives each player five turns and cannot score unfinished rounds',()=>{
  let r=createTeamRound([a.id,b.id],'round123',day,n=>n-1);
  expect(roundScores(r)).toEqual([]);expect(answerTurn(r,-1)).toBe(r);
  for(let i=0;i<10;i++)r=answerTurn(r,i%2===0?r.questions[i]!.answer:(r.questions[i]!.answer+1)%4);
  expect(roundScores(r).map(s=>s.correct)).toEqual([5,0]);expect(answerTurn(r,0)).toBe(r);
  expect(()=>createTeamRound([a.id,a.id],'round123',day)).toThrow();
 });
 it('daily scoring is bounded and cannot reward duplicate or foreign identity',()=>{
  const s:PlayScore={id:'round123-0',playerId:a.id,day,correct:5,total:5};
  const first=addScore([],s,people,day)!;expect(first).toHaveLength(1);
  expect(addScore(first,{...s,id:'round124-0'},people,day)).toBeNull();
  expect(addScore(first,{...s,playerId:'foreign',id:'round125-0'},people,day)).toBeNull();
  expect(addScore([],s,people,'2026-11-25')).toBeNull();
  expect(cleanScores([s,{...s,id:'round124-0'},{...s,playerId:'foreign'},{...s,correct:6}],people)).toEqual([s]);
 });
 it('ranks only scoped members and uses calendar period and milestones',()=>{
  const scores:PlayScore[]=[{id:'round123-0',playerId:a.id,day,correct:5,total:5},{id:'round456-0',playerId:b.id,day:'2026-11-01',correct:4,total:5}];
  expect(leaderboard(scores,people,day,'week').map(x=>x.points)).toEqual([60]);
  expect(leaderboard(scores,[b],day,'all').map(x=>x.points)).toEqual([50]);
  expect(milestones(1,1,60).map(x=>x.unlocked)).toEqual([true,true,false,false]);
 });
 it('deduplicates names that become identical after display truncation',()=>{
  expect(parseEntries('a'.repeat(60)+'1\n'+'a'.repeat(60)+'2')).toEqual(['a'.repeat(60)]);
 });
});
