/** Verified admin workflows. No demo state, stored credentials or local writes. */
const $=s=>document.querySelector(s);
const hide=(s,v=true)=>$(s).classList.toggle('hidden',v);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn)=>{const b=node('button',text,'secondary');b.type='button';b.addEventListener('click',fn);return b;};
export function createOnboarding({getToken,refreshIdentity,onAuthExpired}){
 let who=null,enabled=false,epoch=0,busy=false,pending=null,loaded=false;
 const say=t=>{$('#onboarding-status').textContent=t;};
 const scope=()=>({workspaceId:$('#workspace').value,unitId:$('#onboarding-unit').value});
 function clearSecret(){hide('#invite-result');$('#invite-created-id').value='';$('#invite-created-code').value='';$('#invite-expires').textContent='';}
 function clearDetail(){loaded=false;hide('#onboarding-detail');$('#onboarding-zone').textContent='—';for(const id of ['#onboarding-employees','#onboarding-invitations','#onboarding-shifts'])$(id).replaceChildren();}
 function controls(){const lock=busy||!!pending||!navigator.onLine;for(const el of $('#onboarding-panel').querySelectorAll('form button,[data-onboarding-action],#onboarding-load'))el.disabled=lock;$('#onboarding-retry').disabled=busy||!navigator.onLine;hide('#onboarding-retry',!pending);$('#onboarding-unit').disabled=busy||!!pending;}
 function resetScope(){epoch++;busy=false;pending=null;clearSecret();clearDetail();$('#invite-code').value='';const ws=$('#workspace').value,ids=new Set((who?.memberships??[]).filter(m=>m.workspaceId===ws).map(m=>m.id));const units=[...new Set((who?.grants??[]).filter(g=>ids.has(g.membershipId)&&['level_3','org_admin'].includes(g.role)).map(g=>g.unitId))];$('#onboarding-unit').replaceChildren(...units.map(u=>new Option('Unit '+u.slice(0,8),u)));hide('#onboarding-admin',!units.length);controls();}
 function clear(){epoch++;who=null;enabled=false;pending=null;busy=false;clearSecret();clearDetail();for(const i of $('#onboarding-panel').querySelectorAll('input'))i.value='';$('#onboarding-unit').replaceChildren();say('');hide('#onboarding-panel');controls();}
 function bind(identity,active){clear();who=identity;enabled=active===true;hide('#onboarding-panel',!enabled);if(enabled)resetScope();}
 async function call(command,token){const r=await fetch('/api/staging/onboarding',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command)});let d;try{d=await r.json();}catch{throw Object.assign(Error('INVALID_RESPONSE'),{status:r.ok?502:r.status});}if(r.status===401&&token===getToken())onAuthExpired?.();if(!r.ok)throw Object.assign(Error('REQUEST_REJECTED'),{status:r.status});return d;}
 function row(name,state){const r=node('div',undefined,'p5-row'),pill=node('span',state,'p5-pill');pill.dataset.state=state;r.append(node('strong',name),pill);return r;}
 function action(label,command){const b=button(label,()=>{if(!confirm(label+'? This action is recorded in the audit ledger.'))return;mutate(command);});b.dataset.onboardingAction='1';return b;}
 function render(d){
  if(d.workspaceId!==scope().workspaceId||d.unitId!==scope().unitId||!Array.isArray(d.employees)||!Array.isArray(d.invitations)||!Array.isArray(d.shifts))throw Error('INVALID_RESPONSE');
  $('#onboarding-zone').textContent=d.timezone;
  const emp=$('#onboarding-employees'),inv=$('#onboarding-invitations'),sh=$('#onboarding-shifts');emp.replaceChildren();inv.replaceChildren();sh.replaceChildren();
  if(!d.employees.length)emp.append(node('p','No managed employees.'));if(!d.invitations.length)inv.append(node('p','No recent invitations.'));if(!d.shifts.length)sh.append(node('p','No managed shifts.'));
  for(const x of d.employees){const r=row(x.name,x.status),a=node('div',undefined,'p5-actions');if(x.status==='active')a.append(action('Suspend',{action:'suspend',rosterId:x.rosterId}));if(x.status==='suspended')a.append(action('Resume',{action:'resume',rosterId:x.rosterId}));if(['active','suspended'].includes(x.status))a.append(action('Revoke membership',{action:'revoke',rosterId:x.rosterId}));r.append(a);emp.append(r);}
  for(const x of d.invitations){const r=row(x.name,x.status);r.append(node('p','Expires '+new Date(x.expiresAt).toLocaleString(),'p5-small'));if(x.status==='pending')r.append(action('Cancel invitation',{action:'cancel_invite',inviteId:x.inviteId}));inv.append(r);}
  for(const x of d.shifts){const r=row(x.localStart.replace('T',' ')+' → '+x.localEnd.replace('T',' '),'Scheduled');r.append(node('p',x.timezone+' · '+x.eligibleCount+' eligible at creation'),node('p','UTC '+new Date(x.opensAt).toISOString().slice(0,16).replace('T',' ')+' → '+new Date(x.closesAt).toISOString().slice(0,16).replace('T',' '),'p5-small'));sh.append(r);}
  loaded=true;hide('#onboarding-detail',false);controls();
 }
 async function load(){if(!enabled||busy||pending||!navigator.onLine||!scope().unitId)return;const g=++epoch,t=getToken(),s=scope();busy=true;clearDetail();controls();try{const d=await call({action:'list',...s},t);if(g!==epoch||t!==getToken())return;render(d);say('Authorized unit loaded.');}catch{if(g===epoch)say('Unable to load assigned unit.');}finally{if(g===epoch){busy=false;controls();}}}
 async function mutate(input,retry=false){if(!enabled||busy||!navigator.onLine||(!retry&&pending))return;const t=getToken(),g=epoch;if(!t)return;
  if(!retry){const accept=input.action==='accept';if(!accept&&!loaded)return;pending=Object.freeze({...input,...(accept?{}:scope()),requestId:crypto.randomUUID()});}
  const command=pending;if(!command)return;busy=true;clearSecret();controls();
  try{const result=await call(command,t);if(g!==epoch||t!==getToken())return;if(result.action!==command.action||typeof result.replayed!=='boolean')throw Error('INVALID_RESPONSE');pending=null;
   if(command.action==='invite'){if(!uuid.test(result.inviteId)||!Number.isFinite(Date.parse(result.expiresAt)))throw Error('INVALID_RESPONSE');$('#invite-created-id').value=result.inviteId;$('#invite-created-code').value=command.code;$('#invite-expires').textContent='Expires '+new Date(result.expiresAt).toLocaleString();hide('#invite-result',false);$('#invite-target').value='';$('#invite-name').value='';$('#invite-position').value='';}
   if(command.action==='accept'){$('#invite-id').value='';$('#invite-code').value='';say('Invitation accepted. Refreshing verified membership.');await refreshIdentity();return;}
   say('Server command recorded.');busy=false;await load();
  }catch(e){if(g!==epoch)return;if([400,401,403,409,422].includes(e.status)){pending=null;say('Request rejected. Refresh assigned scope before another action.');busy=false;await load();}else{pending=command;say('Delivery uncertain. Retry the identical request; do not generate another code.');}}
  finally{if(g===epoch){busy=false;controls();}}
 }
 $('#onboarding-unit').addEventListener('change',()=>{epoch++;busy=false;pending=null;clearSecret();clearDetail();controls();});$('#onboarding-load').addEventListener('click',load);
 $('#onboarding-invite').addEventListener('submit',e=>{e.preventDefault();const targetUserId=$('#invite-target').value.trim();if(!uuid.test(targetUserId))return say('Enter a verified user UUID.');mutate({action:'invite',targetUserId,code:code(),displayName:$('#invite-name').value.trim(),position:$('#invite-position').value.trim()});});
 $('#onboarding-accept').addEventListener('submit',e=>{e.preventDefault();const inviteId=$('#invite-id').value.trim(),value=$('#invite-code').value.trim();$('#invite-code').value='';if(!uuid.test(inviteId)||!/^[a-f0-9]{64}$/.test(value))return say('Check invitation ID and code.');mutate({action:'accept',inviteId,code:value});});
 $('#onboarding-schedule').addEventListener('submit',e=>{e.preventDefault();mutate({action:'schedule',localStart:$('#shift-start').value,localEnd:$('#shift-end').value,startOffset:Number($('#shift-start-offset').value),endOffset:Number($('#shift-end-offset').value)});});
 $('#onboarding-retry').addEventListener('click',()=>mutate(null,true));$('#invite-hide').addEventListener('click',clearSecret);
 window.addEventListener('online',controls);window.addEventListener('offline',()=>{clearSecret();controls();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearSecret();$('#invite-code').value='';}});
 return {bind,clear,resetScope,hasPending:()=>!!pending};
}
