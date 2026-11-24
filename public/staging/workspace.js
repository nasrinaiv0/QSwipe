import {createAttendanceAdapter} from './attendance-adapter.js';
import {CorrectionQueue} from './sync-queue.js';
import {DraftVault,validateVaultItems} from './draft-vault.js';
const $=s=>document.querySelector(s);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const fmt=t=>new Date(t).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
const pretty=t=>String(t).replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const status=(t)=>{const n=node('span',pretty(t),'p5-pill');n.dataset.state=t;return n;};
const button=(text,action,secondary=false)=>{const b=node('button',text,secondary?'secondary':'');b.type='button';b.addEventListener('click',action);return b;};
const empty=t=>node('div',t,'p5-empty');
export function createWorkspace({getToken,getProject,onAuthExpired}){
 const queue=new CorrectionQueue();
 let vault=null;try{vault=new DraftVault();}catch{}
 let p6=false,vaultDirty=false,vaultBusy=false,identityEpoch=0,inboxCursor=null,inboxRows=[],inboxEpoch=0,inboxBusy=false;
 const vaultSay=t=>{$('#p6-vault-status').textContent=t;};
 const inboxSay=t=>{$('#p6-inbox-status').textContent=t;};
 let owner=null,grants=[],people=[],sessions=[],current=null,epoch=0,busy=false,enabled=false;
 const ambiguous=new Map();
 const say=t=>{$('#p5-status').textContent=t;};
 const person=()=>people.find(p=>p.id===$('#p5-person').value);
 const selected=()=>sessions.find(s=>s.sessionId===$('#p5-session').value);
 const same=e=>e===epoch&&!!owner;
 const canCheck=()=>{const p=person();return !!p&&!p.isOwn&&grants.some(g=>g.unitId===p.unit_id);};
 const online=()=>navigator.onLine!==false;
 const validContext=()=>!!current&&person()?.id===current.rosterId&&selected()?.sessionId===current.sessionId;
 const adapter=createAttendanceAdapter({call,context:()=>validContext()?{sessionId:current.sessionId,rosterId:current.rosterId,version:current.currentVersion,own:person().isOwn===true,manager:canCheck(),locked:busy||queue.busy||vaultBusy}:null,refresh:async()=>{const p=person(),s=selected();await loadDetails();if(p&&s&&validContext()){sessions=sessions.map(x=>x.sessionId===s.sessionId?{...x,status:current.currentStatus,version:current.currentVersion}:x);adapter.report(sessions,true);}},refreshReport:loadSessions,notify:say});
 async function call(path,body,token=getToken()){
  if(!token)throw Object.assign(Error('AUTH_REQUIRED'),{status:401});
  const r=await fetch('/api/staging/'+path,{method:body?'POST':'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let data;try{data=await r.json();}catch{throw Object.assign(Error('INVALID_RESPONSE'),{status:r.ok?502:r.status});}
  if(r.status===401&&token===getToken())onAuthExpired?.();
  if(!r.ok)throw Object.assign(Error(typeof data?.error==='string'?data.error:'REQUEST_REJECTED'),{status:r.status});
  return data;
 }
 function network(){
  adapter.update();
  const n=$('#p5-network');n.textContent=online()?'Online':'Offline · drafts only';n.dataset.state=online()?'online':'offline';
  $('#p5-sync').disabled=!online()||queue.busy||busy||vaultBusy||vaultDirty||!queue.items.some(i=>i.state!=='blocked');
  $('#p5-refresh').disabled=!online()||busy||!person();
  $('#p5-submit-button').disabled=busy||queue.busy||vaultBusy||!validContext()||current.currentVersion<1||current.currentStatus===$('#p5-proposed').value;
  for(const b of document.querySelectorAll('[data-p5-decision]'))b.disabled=busy||!online()||queue.busy||vaultBusy;
  $('#p6-unlock button').disabled=!vault||vaultBusy||queue.busy||!!queue.items.length||!!vault?.unlocked;
  $('#p6-delete').disabled=vaultBusy||queue.busy;
  $('#p6-save').classList.toggle('hidden',!vaultDirty||!vault?.unlocked);
  $('#p6-save').disabled=vaultBusy||queue.busy;
  $('#p6-inbox-load').disabled=!online()||inboxBusy||busy||queue.busy;
  $('#p6-inbox-more').disabled=!online()||inboxBusy||busy||queue.busy;
  $('#p6-inbox-more').classList.toggle('hidden',!inboxCursor);
  for(const b of document.querySelectorAll('[data-p6-open]'))b.disabled=!online()||inboxBusy||busy||queue.busy||vaultBusy;
 }
 function drawQueue(){
  const box=$('#p5-queue');box.replaceChildren();$('#p5-queue-count').textContent=String(queue.items.length);
  if(!queue.items.length)box.append(empty('No unsynced corrections.'));
  for(const item of queue.items){
   const d=item.draft, r=node('div',undefined,'p5-row');
   r.append(node('strong',pretty(d.status)+' · version '+d.expectedVersion),status(item.state),node('p','Session '+d.sessionId.slice(0,8)+' · record '+d.rosterId.slice(0,8),'p5-small'));
   const discard=button('Discard draft',async()=>{if(queue.busy||vaultBusy)return;if(confirm('Discard this local draft? A previous timed-out submission may already have reached the server.')){queue.discard(d.requestId);await persistVault();drawQueue();}},true);
   discard.disabled=queue.busy||vaultBusy;r.append(discard);box.append(r);
  }
  network();
 }
 async function persistVault(){
  if(!vault?.unlocked)return true;
  const g=identityEpoch;vaultDirty=true;vaultBusy=true;network();
  try{await vault.save(queue.items,()=>g===identityEpoch&&!!owner);if(g!==identityEpoch)return false;vaultDirty=false;vaultSay('Encrypted vault saved · sign out to lock.');return true;}
  catch{if(g===identityEpoch)vaultSay('Vault save failed. Drafts remain in memory; synchronization is blocked until saved.');return false;}
  finally{if(g===identityEpoch){vaultBusy=false;network();}}
 }
 function resetInbox(){inboxEpoch++;inboxBusy=false;inboxCursor=null;inboxRows=[];$('#p6-inbox-rows').replaceChildren();inboxSay('Load pending requests in the selected workspace.');}
 function clearDetails(){current=null;adapter.selection();$('#p5-details').classList.add('hidden');$('#p5-inbox').replaceChildren();$('#p5-history').replaceChildren();$('#p5-current').textContent='—';$('#p5-version').textContent='—';$('#p5-pending').textContent='—';}
 function resetSelection(){adapter.report([]);resetInbox();epoch++;busy=false;people=[];sessions=[];clearDetails();$('#p5-person').replaceChildren(new Option('Choose employee',''));$('#p5-session').replaceChildren(new Option('Choose session',''));$('#p5-session').disabled=true;say('Load the authorized roster to begin.');network();}
 function clear(){adapter.clear();identityEpoch++;vault?.lock();vaultDirty=false;vaultBusy=false;p6=false;$('#p6-passphrase').value='';$('#p6-unlock').classList.remove('hidden');$('#p6-delete').classList.add('hidden');vaultSay('Vault locked · memory-only queue.');$('#p6-vault').classList.add('hidden');$('#p6-inbox').classList.add('hidden');owner=null;grants=[];enabled=false;queue.clear();ambiguous.clear();resetSelection();drawQueue();$('#p5-workspace').classList.add('hidden');}
 function bind(who,active,securityEnabled=false,adapterEnabled=false){
  const key=getProject()+':'+who.userId;
  if(key!==owner){clear();}
  owner=key;queue.bind(key);grants=Array.isArray(who.grants)?who.grants:[];enabled=active===true;p6=enabled&&securityEnabled===true;resetSelection();$('#p5-workspace').classList.toggle('hidden',!enabled);$('#p6-vault').classList.toggle('hidden',!p6);$('#p6-inbox').classList.toggle('hidden',!p6||!grants.length);adapter.bind(enabled&&p6&&adapterEnabled);drawQueue();
 }
 async function loadInbox(more=false){
  if(!p6||!owner||!online()||inboxBusy||!grants.length)return;
  const workspace=$('#workspace').value;if(!workspace)return;
  const e=++inboxEpoch,token=getToken();inboxBusy=true;network();inboxSay('Loading authorized pending requests…');
  try{
   const p=new URLSearchParams({workspace_id:workspace});if(more&&inboxCursor){p.set('before_at',inboxCursor.at);p.set('before_id',inboxCursor.id);}
   const d=await call('inbox?'+p.toString(),null,token);
   if(e!==inboxEpoch||token!==getToken()||workspace!==$('#workspace').value)return;
   if(d.workspaceId!==workspace||!Array.isArray(d.rows)||d.rows.length>20)throw Error('INVALID_RESPONSE');
   inboxRows=more?[...inboxRows,...d.rows.filter(r=>!inboxRows.some(x=>x.requestId===r.requestId))].slice(0,100):d.rows;
   inboxCursor=inboxRows.length>=100?null:d.nextCursor;
   const box=$('#p6-inbox-rows');box.replaceChildren();
   if(!inboxRows.length)box.append(empty('No pending requests in your assigned units.'));
   for(const r of inboxRows){const row=node('div',undefined,'p5-row');row.append(node('strong',r.employee),node('p',pretty(r.originalStatus)+' → '+pretty(r.proposedStatus)+' · v'+r.baseVersion+' · '+pretty(r.reason)),status(r.currentVersion===r.baseVersion?'pending':'stale'),node('p',fmt(r.createdAt),'p5-small'));const open=button('Review '+r.employee,()=>openInbox(r),true);open.dataset.p6Open='1';row.append(open);box.append(row);}
   inboxSay(inboxRows.length+' pending request(s) loaded.'+(inboxRows.length>=100?' Refresh to review newer items.':''));
  }catch{if(e===inboxEpoch){inboxRows=[];inboxCursor=null;$('#p6-inbox-rows').replaceChildren();inboxSay('Inbox unavailable. Verify MFA, scope and connection.');}}
  finally{if(e===inboxEpoch){inboxBusy=false;network();}}
 }
 async function openInbox(r){
  if(!p6||!online()||busy||queue.busy||vaultBusy)return;
  if(!people.some(p=>p.id===r.rosterId)){say('Load the authorized roster and select this employee before reviewing.');$('#load-roster').focus();return;}
  const g=identityEpoch;$('#p5-person').value=r.rosterId;await loadSessions();
  if(g!==identityEpoch||person()?.id!==r.rosterId||!sessions.some(s=>s.sessionId===r.sessionId))return;
  $('#p5-session').value=r.sessionId;await loadDetails();
  if(validContext()){$('#p5-inbox-heading').setAttribute('tabindex','-1');$('#p5-inbox-heading').focus();}
 }
 $('#p6-inbox-load').addEventListener('click',()=>loadInbox());$('#p6-inbox-more').addEventListener('click',()=>loadInbox(true));
 $('#p6-unlock').addEventListener('submit',async e=>{
  e.preventDefault();if(!p6||!owner||!vault||vaultBusy||queue.busy||queue.items.length)return;
  const g=identityEpoch,key=owner,pass=$('#p6-passphrase').value;$('#p6-passphrase').value='';vaultBusy=true;network();vaultSay('Unlocking encrypted vault…');
  try{const restored=await vault.unlock(key,pass,()=>g===identityEpoch&&owner===key);if(g!==identityEpoch)return;queue.restore(restored);$('#p6-unlock').classList.add('hidden');$('#p6-delete').classList.remove('hidden');vaultBusy=false;await persistVault();drawQueue();}
  catch{if(g===identityEpoch){vault?.lock();vaultSay('Vault could not be unlocked. Check passphrase, browser storage or another open tab. Existing ciphertext was not overwritten.');}}
  finally{if(g===identityEpoch){vaultBusy=false;network();}}
 });
 $('#p6-save').addEventListener('click',async()=>{if(!vaultBusy&&!queue.busy){await persistVault();drawQueue();}});
 $('#p6-delete').addEventListener('click',()=>{if(!vault?.unlocked||vaultBusy||queue.busy)return;if(!confirm('Delete encrypted drafts from this device? A previously submitted correction may still exist on the server.'))return;try{vault.delete();queue.clear();queue.bind(owner);vaultDirty=false;$('#p6-unlock').classList.remove('hidden');$('#p6-delete').classList.add('hidden');vaultSay('Vault deleted · memory-only queue.');drawQueue();}catch{vaultSay('Unable to delete vault.');}});
 function roster(rows){if(!enabled||!owner)return;resetSelection();people=rows.filter(p=>p&&typeof p.id==='string');for(const p of people)$('#p5-person').append(new Option(p.display_name_snapshot+(p.isOwn?' (you)':''),p.id));say(people.length?'Choose a person to load attendance sessions.':'No authorized people.');network();}
 async function loadSessions(){
  const e=++epoch,p=person();busy=true;current=null;sessions=[];adapter.report([]);clearDetails();$('#p5-session').replaceChildren(new Option('Choose session',''));$('#p5-session').disabled=true;network();
  if(!p||!online()){busy=false;say('Connect to load authorized sessions.');network();return;}
  try{
   const d=await call('sessions?roster_id='+encodeURIComponent(p.id));
   if(!same(e)||person()?.id!==p.id)return;
   if(d.rosterId!==p.id||!Array.isArray(d.sessions))throw Error('INVALID_RESPONSE');
   sessions=d.sessions;adapter.report(sessions,true);for(const s of sessions)$('#p5-session').append(new Option(fmt(s.opensAt)+' · '+pretty(s.status),s.sessionId));
   $('#p5-session').disabled=!sessions.length;say(sessions.length?'Select an attendance session.':'No recent authorized sessions.');
  }catch(err){if(same(e))say('Unable to load sessions. Check staging access and connectivity.');}
  finally{if(same(e)){busy=false;network();}}
 }
 function draw(data){
  current=data;$('#p5-details').classList.remove('hidden');$('#p5-current').textContent=pretty(data.currentStatus);$('#p5-version').textContent='v'+data.currentVersion;
  const pending=data.requests.filter(r=>r.outcome==='pending');$('#p5-pending').textContent=String(pending.length);
  $('#p5-proposed').value=data.currentStatus==='present'?'absent':'present';
  const inbox=$('#p5-inbox'), history=$('#p5-history');inbox.replaceChildren();history.replaceChildren();
  if(!pending.length)inbox.append(empty('No pending corrections for this session.'));
  for(const r of pending){
   const row=node('div',undefined,'p5-row');row.append(node('strong',pretty(r.originalStatus)+' → '+pretty(r.proposedStatus)),status('pending'),node('p','Version '+r.baseVersion+' · '+pretty(r.reason)+' · '+fmt(r.createdAt)));
   const possible=canCheck()&&!r.madeByMe;const stale=r.baseVersion!==data.currentVersion;
   if(possible){
    const actions=node('div',undefined,'p5-actions');const previous=ambiguous.get(r.requestId);
    if(previous){
     const retry=button('Retry '+previous.outcome,()=>decide(r,previous));retry.dataset.p5Decision='1';actions.append(retry);
    }else{
     if(!stale){const approve=button('Approve',()=>decide(r,{outcome:'approved',reason:'verified'}));approve.dataset.p5Decision='1';actions.append(approve);}
     const reject=button('Reject',()=>decide(r,{outcome:'rejected',reason:'incorrect_request'}),true);reject.dataset.p5Decision='1';actions.append(reject);
    }
    row.append(actions);if(stale)row.append(node('p','Stale version: approval unavailable.','p5-small'));
   }else row.append(node('p',r.madeByMe?'Your request awaits an independent checker.':'Independent manager review required.','p5-small'));
   inbox.append(row);
  }
  if(!data.requests.length)history.append(node('li','No correction history yet.'));
  for(const r of data.requests){
   const row=node('li');row.append(node('strong','v'+r.baseVersion+' · '+pretty(r.originalStatus)+' → '+pretty(r.proposedStatus)),node('p',fmt(r.createdAt)+' · '+pretty(r.reason)),status(r.outcome));
   if(r.outcome!=='pending')row.append(node('p',fmt(r.decidedAt)+' · '+pretty(r.decisionReason)+' · resulting v'+r.resultingVersion,'p5-small'));
   history.append(row);
  }
  sessions=sessions.map(s=>s.sessionId===data.sessionId?{...s,status:data.currentStatus,version:data.currentVersion}:s);adapter.report(sessions,true);drawQueue();network();
 }
 async function loadDetails(){
  const e=++epoch,p=person(),s=selected();busy=true;clearDetails();network();
  if(!p||!s||!online()){busy=false;say('Connect to refresh attendance.');network();return;}
  try{
   const data=await call('approvals',{action:'list',sessionId:s.sessionId,rosterId:p.id});
   if(!same(e)||selected()?.sessionId!==s.sessionId||person()?.id!==p.id)return;
   if(data.sessionId!==s.sessionId||data.rosterId!==p.id||!Array.isArray(data.requests))throw Error('INVALID_RESPONSE');
   draw(data);say('Server record loaded. Corrections require independent approval.');
  }catch{if(same(e))say('Unable to load attendance. Check your assigned scope.');}
  finally{if(same(e)){busy=false;network();}}
 }
 async function decide(r,d){
  if(!online()||busy||queue.busy||!validContext()||!canCheck()||r.madeByMe)return;
  if(!confirm(pretty(d.outcome)+' this correction? This creates an immutable decision.'))return;
  const e=epoch,token=getToken(),body={action:'decide',sessionId:current.sessionId,rosterId:current.rosterId,requestId:r.requestId,outcome:d.outcome,reason:d.reason};
  busy=true;ambiguous.set(r.requestId,d);network();
  try{
   await call('approvals',body,token);if(!same(e))return;ambiguous.delete(r.requestId);say('Decision recorded. Refreshing server state.');await loadDetails();
  }catch(err){
   if(!same(e))return;
   if([400,401,403,409,422].includes(err.status)){ambiguous.delete(r.requestId);say('Decision rejected or stale. Refresh before another decision.');await loadDetails();}
   else{say('Delivery uncertain. Retry the identical decision when connected.');if(current)draw(current);}
  }finally{if(same(e)){busy=false;network();}}
 }
 $('#p5-person').addEventListener('change',loadSessions);
 $('#p5-session').addEventListener('change',loadDetails);
 $('#p5-refresh').addEventListener('click',()=>selected()?loadDetails():loadSessions());
 $('#p5-proposed').addEventListener('change',network);
 $('#p5-submit').addEventListener('submit',async e=>{
  e.preventDefault();if(busy||queue.busy||vaultBusy||!validContext()||current.currentVersion<1)return;
  try{queue.enqueue({sessionId:current.sessionId,rosterId:current.rosterId,requestId:crypto.randomUUID(),expectedVersion:current.currentVersion,status:$('#p5-proposed').value,reason:$('#p5-reason').value});await persistVault();drawQueue();say(vaultDirty?'Correction in memory; encrypted save failed.':'Correction queued locally. Sync explicitly when connected.');}
  catch(err){say('Draft not queued: '+pretty(err.message));}
 });
 $('#p5-sync').addEventListener('click',async()=>{
  if(!online()||!owner||busy||queue.busy||vaultBusy||vaultDirty)return;
  const e=epoch,key=owner,token=getToken(),g=identityEpoch;
  if(vault?.unlocked){const fresh=validateVaultItems(queue.items);if(fresh.length!==queue.items.length){queue.clear();queue.bind(key);queue.restore(fresh);if(!await persistVault())return;drawQueue();}}
  if(g!==identityEpoch||!same(e)||token!==getToken())return;
  if(!token||!confirm('Sync queued corrections for this signed-in account?'))return;
  const task=queue.sync(key,d=>call('approvals',d,token),{online:online(),current:()=>same(e)&&owner===key&&getToken()===token});
  drawQueue();const result=await task;
  if(g!==identityEpoch||owner!==key)return;
  await persistVault();if(!same(e))return;
  drawQueue();say(result.stopped?'Sync paused. Review blocked drafts or retry uncertain delivery.':result.sent+' correction(s) synchronized.');
  if(result.sent&&selected())await loadDetails();
 });
 window.addEventListener('online',network);window.addEventListener('offline',network);
 window.addEventListener('beforeunload',e=>{if((queue.items.length&&(!vault?.unlocked||vaultDirty||vaultBusy))||ambiguous.size||adapter.hasPending()){e.preventDefault();e.returnValue='';}});
 window.addEventListener('pagehide',()=>{clear();});
 return {bind,roster,resetSelection,clear,hasDrafts:()=>(queue.items.length>0&&(!vault?.unlocked||vaultDirty||vaultBusy))||ambiguous.size>0||adapter.hasPending()};
}
