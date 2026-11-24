import { describe, it, expect } from 'vitest';
import { createWorkspace, newPerson, summarize } from '../src/core/model';
import { initializeHistory, recordRosterChange, recordSameDayEligibility, rosterAt, historicalScope, historicalSeries, historicalPeople, reportDates } from '../src/core/history';
import { sanitizeWorkspace } from '../src/core/data';
function fixture(){
 const w=createWorkspace({name:'Orion',preset:'business',ownerName:'Alex',ownerLevel:3});
 w.createdAt=new Date('2026-11-20T12:00:00').getTime();w.config.days=[0,1,2,3,4,5,6];
 const owner=w.people[0]!;
 const a=newPerson({name:'Lead A',level:2,parentId:owner.id,branch:'Alpha'});
 const b=newPerson({name:'Lead B',level:2,parentId:owner.id,branch:'Beta'});
 const p=newPerson({name:'Jamie',level:0,parentId:a.id,passKey:'fictionalkey1234567890'});
 w.people.push(a,b,p);return {w,owner,a,b,p};
}
describe('historical local roster eligibility',()=>{
 it('preserves previous scope and marks after transfer, removal and reload',()=>{
  const {w,owner,a,b,p}=fixture();initializeHistory(w,'2026-11-20');
  w.attendance['2026-11-20']={[p.id]:{s:'present',at:1,by:a.id}};
  w.people=w.people.map(x=>x.id===p.id?{...x,parentId:b.id}:x);recordRosterChange(w,'2026-11-20');
  expect(historicalScope(w,a,'2026-11-20').map(x=>x.id)).toContain(p.id);
  expect(historicalScope(w,b,'2026-11-20').map(x=>x.id)).not.toContain(p.id);
  expect(historicalScope(w,b,'2026-11-21').map(x=>x.id)).toContain(p.id);
  w.people=w.people.filter(x=>x.id!==p.id);recordRosterChange(w,'2026-11-21');
  const restored=sanitizeWorkspace(JSON.parse(JSON.stringify(w)))!;
  expect(restored.attendance['2026-11-20']?.[p.id]?.s).toBe('present');
  expect(rosterAt(restored,'2026-11-20').find(x=>x.id===p.id)?.passKey).toBeUndefined();
  expect(historicalPeople(restored,owner,['2026-11-20','2026-11-22']).map(x=>x.id)).toContain(p.id);
  expect(historicalScope(restored,owner,'2026-11-22').map(x=>x.id)).not.toContain(p.id);
  expect(summarize(historicalSeries(restored,owner,['2026-11-20','2026-11-21','2026-11-22']))).toMatchObject({scheduled:8,present:1,absent:0,pending:7});
 });
 it('does not invent prebaseline eligibility and includes a marked same-day hire',()=>{
  const {w,owner,a,p}=fixture();
  w.attendance['2026-11-20']={[p.id]:{s:'absent',at:1,by:a.id}};
  initializeHistory(w,'2026-11-22');
  expect(rosterAt(w,'2026-11-20').map(x=>x.id)).toEqual([p.id]);
  expect(reportDates(w,'2026-11-23',10)).toEqual(['2026-11-20','2026-11-22','2026-11-23']);
  const n=newPerson({name:'New member',level:0,parentId:a.id});w.people.push(n);recordRosterChange(w,'2026-11-22');
  expect(historicalScope(w,owner,'2026-11-22').map(x=>x.id)).not.toContain(n.id);
  recordSameDayEligibility(w,n,'2026-11-22','2026-11-22');w.attendance['2026-11-22']={[n.id]:{s:'present',at:2,by:a.id}};
  expect(historicalScope(w,owner,'2026-11-22').map(x=>x.id)).toContain(n.id);
  expect(historicalScope(w,owner,'2026-11-20').map(x=>x.id)).not.toContain(n.id);
  expect(historicalScope(w,owner,'2026-11-23').map(x=>x.id)).toContain(n.id);
 });
 it('preserves the previous weekly schedule and uses the next effective day',()=>{
  const {w}=fixture();initializeHistory(w,'2026-11-20');w.config.days=[1];recordRosterChange(w,'2026-11-20');
  expect(reportDates(w,'2026-11-23',10)).toEqual(['2026-11-20','2026-11-23']);
 });
});
