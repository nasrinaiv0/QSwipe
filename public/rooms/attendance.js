const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls='quiet')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
const profileKey='qswipe.player.v1';let secret=null,enabled=false,busy=false,selected=null,team=null,profile=null,teamKey='',epoch=0;
try{const saved=localStorage.getItem(profileKey);if(/^[0-9a-f]{64}$/.test(saved??''))secret=saved;}catch{}
const say=t=>$('#attendance-message').textContent=t;
const errors={PROFILE_DENIED:'Saved passport is unavailable. Manage it in Games.',ATTENDANCE_DISABLED:'Shared attendance is disabled in this preview.',ATTENDANCE_DENIED:'This team or check-in is unavailable to your passport.',ATTENDANCE_CONFLICT:'The mark changed. Refresh and try again.',ATTENDANCE_OWNER_ONLY:'Only the team owner can do this.',ATTENDANCE_CLOSED:'This daily session is closed or has expired.',ATTENDANCE_LIMIT:'Team capacity reached.',ATTENDANCE_TIMEZONE:'Enter a valid IANA time zone, such as Asia/Manila.'};
function controls(){for(const b of document.querySelectorAll('main button'))b.disabled=busy||!enabled||b.dataset.locked==='true';}
async function request(body){
 if(busy||!enabled)return;busy=true;const e=epoch;controls();
 try{
  const res=await fetch('/api/rooms/command',{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json',...(secret?{Authorization:'Bearer '+secret}:{})},body:JSON.stringify(body)});
  const d=await res.json();if(e!==epoch)return;
  if(!res.ok)throw Error(d.error||'UNAVAILABLE');
  if(d.profileCredential){secret=d.profileCredential;try{localStorage.setItem(profileKey,secret);}catch{say('Cannot save this passport. Keep this page open.');}}
  if(d.profile){profile=d.profile;$('#identity-status').textContent=profile.name;$('#identity-copy').textContent='Passport verified.';$('#passport-create').hidden=true;$('#recover').hidden=true;}
  if(d.teams){selected=null;team=null;teamKey='';$('#team-entry').hidden=false;$('#team-workspace').hidden=true;const list=$('#team-list');list.replaceChildren();for(const t of d.teams)list.append(button(t.name+' · '+(t.owner?'Owner':'Member'),()=>request({action:'attendance_state',teamId:t.id}),'team-choice'));if(!d.teams.length)list.append(el('p','Create or join a team to get started.'));}
  if(d.team){selected=d.team.id;team=d.team;renderTeam();}
  $('#connection').textContent='Staging · connected';
  if(body.action!=='attendance_state')say('');
  if(body.action==='profile_create')queueMicrotask(()=>request({action:'attendance_list'}));
 }catch(err){if(e!==epoch)return;say(errors[err.message]??'Connection interrupted. Refresh before retrying.');if(err.message==='PROFILE_DENIED')$('#recover').hidden=false;if(err.message==='ATTENDANCE_DENIED'&&body.action==='attendance_state'){selected=null;team=null;$('#team-workspace').hidden=true;$('#team-entry').hidden=false;teamKey='';queueMicrotask(()=>request({action:'attendance_list'}));}}
 finally{if(e===epoch){busy=false;controls();}}
}
const run=(action,rest={})=>request({action,teamId:selected,...rest});
function markRow(m,s,owner){
 const row=el('div',undefined,'att-row'),info=el('div',undefined,'grow');info.append(el('strong',m.name+(m.id===team.me?' · You':'')),el('span',m.status,'att-status '+m.status));row.append(info);
 if(s.open&&owner&&team.members.some(x=>x.id===m.id)){const actions=el('div',undefined,'att-actions');for(const status of ['present','absent']){const b=button(status==='present'?'Present':'Absent',()=>run('attendance_mark',{sessionId:s.id,memberId:m.id,status,revision:m.revision}),status==='present'?'':'quiet');b.setAttribute('aria-label',status+' '+m.name);b.dataset.locked=String(m.status===status);actions.append(b);}row.append(actions);}
 else if(s.open&&!owner&&m.status==='unmarked')row.append(button('Check in',()=>run('attendance_mark',{sessionId:s.id,memberId:m.id,status:'present',revision:m.revision}),''));
 return row;
}
function renderTeam(){
 $('#team-entry').hidden=true;$('#team-workspace').hidden=false;$('#team-role').textContent=team.owner?'TEAM OWNER':'TEAM MEMBER';$('#team-title').textContent=team.name;$('#team-date').textContent=team.today+' · '+team.timezone;
 const key=JSON.stringify(team);if(key===teamKey)return;teamKey=key;
 const root=$('#team-content'),expanded=new Set([...root.querySelectorAll('details[open]')].map(x=>x.dataset.section));root.replaceChildren();
 const s=team.sessions[0],today=team.sessions.find(x=>x.date===team.today);
 if(team.owner&&(!s||s.date!==team.today))root.append(button('Open today’s check-in',()=>run('attendance_open'),''));
 if(today){
  const head=el('div',undefined,'section-head att-session-head');head.append(el('h2','Today’s check-in'),el('span',today.open?'Open':'Closed','pill'));root.append(head);
  if(team.owner){const stats=el('div',undefined,'att-stats');for(const status of ['present','absent','unmarked']){const n=el('div',undefined,'att-stat');n.append(el('strong',String(today.roster.filter(x=>x.status===status).length)),el('span',status));stats.append(n);}root.append(stats);}
  for(const m of today.roster)root.append(markRow(m,today,team.owner));
  if(team.owner&&today.open)root.append(button('Close check-in',()=>{if(confirm('Close today’s attendance? Marks cannot be edited afterward.'))run('attendance_close',{sessionId:today.id});}));
 }else root.append(el('p',team.owner?'Start a check-in to capture today’s roster.':'No eligible check-in today. If you joined after it opened, wait for the next session.'));
 const history=el('details');history.dataset.section='history';history.open=expanded.has('history');history.append(el('summary','Previous sessions · '+team.sessions.filter(x=>x.date!==team.today).length));for(const old of team.sessions.filter(x=>x.date!==team.today)){history.append(el('h3',old.date));for(const m of old.roster)history.append(markRow(m,old,false));}root.append(history);
 if(team.owner){const management=el('details');management.dataset.section='members';management.open=expanded.has('members');management.append(el('summary','Team members · '+team.members.length),el('p','Invitation code · share privately'),el('output',team.invite,'att-invite'),button('Rotate invitation',()=>run('attendance_rotate')));for(const m of team.members){const row=el('div',undefined,'att-row');row.append(el('strong',m.name,'grow'));if(m.id!==team.me)row.append(button('Remove',()=>{if(confirm('Remove '+m.name+'? The invitation will rotate.'))run('attendance_remove',{memberId:m.id});}));management.append(row);}root.append(management);}
 else root.append(button('Leave team',()=>{if(confirm('Leave this team?'))run('attendance_leave');}));
}
$('#passport-create').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(f.elements.remember.checked)request({action:'profile_create',name:f.elements.name.value});});
$('#team-create').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;request({action:'attendance_create',name:f.elements.name.value,timezone:f.elements.timezone.value});});
$('#team-join').addEventListener('submit',e=>{e.preventDefault();request({action:'attendance_join',invite:e.currentTarget.elements.invite.value.trim()});});
$('#refresh').addEventListener('click',()=>request({action:'attendance_list'}));$('#recover').addEventListener('click',()=>request({action:'attendance_list'}));$('#back-teams').addEventListener('click',()=>request({action:'attendance_list'}));
$('#team-create').elements.timezone.value=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
async function boot(){try{const r=await fetch('/api/rooms/health',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(3000)}),d=await r.json();if(!r.ok||!d.available||!d.attendanceEnabled)throw Error();enabled=true;$('#connection').textContent='Staging · connected';if(secret)await request({action:'attendance_list'});else $('#passport-create').hidden=false;}catch{say('Shared attendance is disabled. Local attendance is still available.');$('#connection').textContent='Preview only';}controls();}
const timer=setInterval(()=>{if(selected&&!busy&&!document.hidden)run('attendance_state');},2500);
window.addEventListener('pagehide',()=>{epoch++;clearInterval(timer);secret=null;});window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});controls();boot();
