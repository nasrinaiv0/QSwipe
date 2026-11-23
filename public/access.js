/** QSwipe sample-only role policy. Real apps MUST re-check on the server. */
export const DEMO_ACTORS = Object.freeze({
  member: Object.freeze({ id:'member', label:'Member · Mika Santos', name:'Mika Santos', title:'Customer Support Specialist', level:0, memberId:'p1', team:'Orion' }),
  lead: Object.freeze({ id:'lead', label:'Level 1 · Team Leader', name:'Jordan Diaz', title:'Team Leader', level:1, team:'Orion' }),
  operations: Object.freeze({ id:'operations', label:'Level 2 · Operations Manager', name:'Alex Rivera', title:'Operations Manager', level:2, team:null }),
  director: Object.freeze({ id:'director', label:'Level 3 · Site Director', name:'Sam Valdez', title:'Site Director', level:3, team:null })
});

export const WORKSPACE_TEAMS = Object.freeze({
  bpo:['Orion','Nova'], school:['Class A','Class B'], government:['Citizen Services','Records'], custom:['Design Squad','Studio Ops']
});

export const MANAGER_ACTIONS = Object.freeze({
  viewTeam:1, markAttendance:1, reviewRequests:1, publishAnnouncement:1, viewReports:1,
  exportReports:2, reassignTeam:2, viewAudit:2, setCoverageTarget:3
});

export function canManage(actor,action){
  const minimum=MANAGER_ACTIONS[action];
  return Number.isInteger(minimum) && Number.isInteger(actor?.level) && actor.level>=minimum;
}

/** Scoping is applied to every demo manager workflow, including writes and exports. */
export function isInScope(actor,person){
  if(!actor||!person) return false;
  if(actor.level===0) return person.id===actor.memberId;
  if(actor.level===1) return person.team===actor.team;
  return actor.level===2 || actor.level===3;
}
export function scopedPeople(actor,people){return Array.isArray(people)?people.filter(person=>isInScope(actor,person)):[];}
export function canMarkPerson(actor,person,attendance,exceptions){
  return canManage(actor,'markAttendance')&&isInScope(actor,person)&&
    !['present','absent'].includes(attendance?.[person.id]) && !exceptions?.[person.id];
}
export function canReviewRequest(actor,request,people){
  if(!canManage(actor,'reviewRequests')||request?.status!=='pending')return false;
  const target=people.find(p=>p.id===request.personId);
  return !!target&&isInScope(actor,target);
}
export function canReassignPerson(actor,person,nextTeam,people,validTeams=WORKSPACE_TEAMS.bpo){
  return canManage(actor,'reassignTeam') && isInScope(actor,person) &&
    validTeams.includes(nextTeam) && people.some(p=>p.id===person.id) && person.team!==nextTeam;
}
export function countQueue(people,records,exceptions={}){
  return people.filter(p=>!['present','absent'].includes(records[p.id])&&!exceptions[p.id]);
}
export function validateProfile(values){
  const name=String(values?.name??'').trim();
  const title=String(values?.title??'').trim();
  const about=String(values?.about??'').trim();
  if(name.length<2||name.length>60) return {error:'Enter a name between 2 and 60 characters.'};
  if(title.length<2||title.length>80) return {error:'Enter a position between 2 and 80 characters.'};
  if(about.length>240) return {error:'About must be 240 characters or fewer.'};
  return {value:{name,title,about}};
}
