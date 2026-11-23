import test from 'node:test';
import assert from 'node:assert/strict';
import { PEOPLE,WORKSPACES,parseEntries,rollIndex,rosterStats,pendingPeople,commitmentStats,projectedCoverage,shouldAllowOverride,mathQuestion,triviaQuestion } from '../public/lib.js';

test('four industry templates are available',()=>assert.equal(Object.keys(WORKSPACES).length,4));
test('free text entry parser trims, deduplicates, caps and preserves display characters',()=>{
 assert.deepEqual(parseEntries(' Alex\nJamie \n alex \n\nPlan A'),['Alex','Jamie','Plan A']);
 assert.deepEqual(parseEntries(''),[]);assert.equal(parseEntries('x\n'.repeat(100)).length,1);
 assert.equal(parseEntries(Array.from({length:50},(_,i)=>String(i)).join('\n')).length,20);
});
test('uniform draw index is bounded',()=>{for(let n=1;n<30;n++)for(let i=0;i<100;i++)assert.ok(rollIndex(n,i)>=0&&rollIndex(n,i)<n);assert.throws(()=>rollIndex(0));});
test('status totals do not treat missing check-ins as absent',()=>{
 const s=rosterStats(PEOPLE,{p1:'present',p2:'absent'});
 assert.deepEqual(s,{scheduled:6,present:1,absent:1,pending:4});
 assert.equal(pendingPeople(PEOPLE,{p1:'present',p2:'absent'}).length,4);
});
test('manager cannot overwrite an already resolved status in the demo',()=>{
 assert.equal(shouldAllowOverride('member',PEOPLE[0],{}),false);
 assert.equal(shouldAllowOverride('manager',PEOPLE[0],{p1:'present'}),false);
 assert.equal(shouldAllowOverride('manager',PEOPLE[0],{}),true);
});
test('commitment forecast is based only on confirmed people',()=>{
 const c=commitmentStats(PEOPLE,{p1:'confirmed',p2:'risk',p3:'unavailable'});
 assert.deepEqual(c,{confirmed:1,atRisk:1,unavailable:1,pending:3});
 assert.equal(projectedCoverage(c),1);
});
test('math generator always marks a correct option',()=>{
 for(let seed=0;seed<500;seed++){const q=mathQuestion(seed);assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<4);}
});
test('trivia draws valid facts and generated math',()=>{
 for(let seed=0;seed<100;seed++){const q=triviaQuestion(seed);assert.equal(q.options.length,4);assert.ok(q.answer>=0&&q.answer<4);}
});
