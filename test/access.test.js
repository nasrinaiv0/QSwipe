import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_ACTORS,canManage,scopedPeople,canMarkPerson,canReviewRequest,canReassignPerson,countQueue,validateProfile,isInScope,WORKSPACE_TEAMS} from '../public/access.js';
import {PEOPLE} from '../public/lib.js';
const [member,lead,ops,director]=Object.values(DEMO_ACTORS);
test('member sees only own record and cannot access management operations',()=>{
 assert.deepEqual(scopedPeople(member,PEOPLE).map(p=>p.id),['p1']);
 for(const action of ['viewReports','exportReports','reviewRequests','markAttendance','reassignTeam']) assert.equal(canManage(member,action),false);
});
test('level 1 manager is limited to Orion; level 2 and 3 have organization scope',()=>{
 assert.equal(scopedPeople(lead,PEOPLE).length,5);
 assert.equal(isInScope(lead,PEOPLE[5]),false);
 assert.equal(scopedPeople(ops,PEOPLE).length,6);
 assert.equal(scopedPeople(director,PEOPLE).length,6);
 assert.equal(canManage(lead,'viewReports'),true);
 assert.equal(canManage(lead,'exportReports'),false);
 assert.equal(canManage(ops,'exportReports'),true);
 assert.equal(canManage(ops,'setCoverageTarget'),false);
 assert.equal(canManage(director,'setCoverageTarget'),true);
});
test('manager cannot mark out-of-scope, recorded or approved-leave attendance',()=>{
 assert.equal(canMarkPerson(lead,PEOPLE[5],{},{}),false);
 assert.equal(canMarkPerson(lead,PEOPLE[0],{p1:'present'},{}),false);
 assert.equal(canMarkPerson(lead,PEOPLE[0],{},{p1:{type:'leave'}}),false);
 assert.equal(canMarkPerson(lead,PEOPLE[0],{},{}),true);
 assert.deepEqual(countQueue(PEOPLE,{p1:'absent'},{p2:'leave'}).map(x=>x.id),['p3','p4','p5','p6']);
});
test('request review respects scoped pending requests',()=>{
 assert.equal(canReviewRequest(lead,{personId:'p1',status:'pending'},PEOPLE),true);
 assert.equal(canReviewRequest(lead,{personId:'p6',status:'pending'},PEOPLE),false);
 assert.equal(canReviewRequest(lead,{personId:'p1',status:'approved'},PEOPLE),false);
 assert.equal(canReviewRequest(member,{personId:'p1',status:'pending'},PEOPLE),false);
});
test('team reassignment is available only from level 2',()=>{
 assert.equal(canReassignPerson(lead,PEOPLE[0],'Nova',PEOPLE),false);
 assert.equal(canReassignPerson(ops,PEOPLE[0],'Nova',PEOPLE),true);
 assert.equal(canReassignPerson(ops,PEOPLE[0],'Orion',PEOPLE),false);
 assert.equal(canReassignPerson(ops,PEOPLE[0],'Unknown',PEOPLE),false);
});
test('profile edits are trimmed, bounded and reject malformed values',()=>{
 assert.deepEqual(validateProfile({name:'  Ada Example  ',title:' Agent ',about:' Welcome '}).value,{name:'Ada Example',title:'Agent',about:'Welcome'});
 assert.ok(validateProfile({name:'A',title:'Agent'}).error);
 assert.ok(validateProfile({name:'Valid Person',title:'A'}).error);
 assert.ok(validateProfile({name:'Valid Person',title:'Agent',about:'x'.repeat(241)}).error);
});
test('organization templates retain real team scope at every manager level',()=>{
  for(const [industry,teams] of Object.entries(WORKSPACE_TEAMS)){
  assert.equal(teams.length,2,industry);
  assert.notEqual(teams[0],teams[1],industry);
  const p=PEOPLE.map(x=>({...x,team:teams[x.team==='Nova'?1:0]}));
  assert.equal(scopedPeople({...lead,team:teams[0]},p).length,5,industry);
  assert.equal(canReassignPerson(ops,p[0],teams[1],p,teams),true,industry);
  assert.equal(canReassignPerson(ops,p[0],'Foreign Team',p,teams),false,industry);
 }
});
