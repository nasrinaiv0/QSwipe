/** Preview-only auth UI: no localStorage, sessionStorage, role picker or service-role secret. */
import { listTotp, enrollTotp, verifyTotp } from './mfa.js';
const $ = selector => document.querySelector(selector);
let config = null;
let bearer = null;
let accountEmail = '';
let workspaceIds = new Set();
let rosterRequest = 0;
let mfaBusy = false;
let loginBusy = false;
let pendingFactor = null;
let sessionVersion = 0;
function clearRoster() { rosterRequest++; $('#roster').replaceChildren(); }

function show(which) {
  for (const id of ['setup-panel','login-panel','workspace-panel']) $(`#${id}`).classList.toggle('hidden', id !== which);
}
function say(id, message) { $(id).textContent = message; }
async function result(response) {
  let json;
  try { json = await response.json(); } catch { throw new Error('Invalid server response.'); }
  if (!response.ok) throw new Error(json?.error || json?.msg || 'Request rejected.');
  return json;
}
async function authRequest(path, body, token = null, method = 'POST') {
  return result(await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    ...(body===null?{}:{body:JSON.stringify(body)})
  }));
}
async function api(path, token = bearer) {
  if (!token) throw new Error('Session expired. Sign in again.');
  return result(await fetch(`/api/staging/${path}`, {redirect:'error',cache:'no-store',headers:{Authorization:`Bearer ${token}`}}));
}
async function init() {
  try {
    config = await result(await fetch('/api/staging/config',{cache:'no-store'}));
    if (!config?.staging || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl)) throw Error('Invalid staging configuration.');
    show('login-panel');
  } catch { $('#setup-panel').replaceChildren();const h=document.createElement('h2');h.textContent='Staging is safely disabled';const p=document.createElement('p');p.textContent='Connect a dedicated QSwipe staging project and enable preview-only settings to test authentication. The existing demo remains available.';$('#setup-panel').append(h,p); }
}
function clearMfa() {
  pendingFactor=null;$('#mfa-secret').textContent='';$('#mfa-secret-box').classList.add('hidden');
  $('#mfa-code').value='';$('#mfa-factor').replaceChildren();$('#mfa-verify').classList.add('hidden');$('#mfa-enroll').classList.add('hidden');
}
function showFactors(factors) {
  const select=$('#mfa-factor');select.replaceChildren();
  for(const factor of factors){const opt=document.createElement('option');opt.value=factor.id;opt.textContent=factor.label||'New authenticator';select.append(opt);}
  $('#mfa-verify').classList.toggle('hidden',!factors.length);
  $('#mfa-enroll').classList.toggle('hidden',!!factors.length);
}
async function mfaAction(action) {
  if(!bearer || mfaBusy) return;
  mfaBusy=true;const version=sessionVersion;const token=bearer;
  const controls=[$('#mfa-refresh'),$('#mfa-enroll'),$('#mfa-verify button')];
  for(const c of controls)c.disabled=true;
  const current=()=>version===sessionVersion && bearer===token;
  try{await action(token,current);}catch{if(current())say('#mfa-status','Authenticator request was not accepted. Try again or contact the staging administrator.');}
  finally{mfaBusy=false;for(const c of controls)c.disabled=false;}
}
async function refreshMfa(token,current) {
  const factors=await listTotp(authRequest,token);
  if(!current())return;
  clearMfa();showFactors(factors);
  say('#mfa-status',factors.length?'Enter a code from your registered authenticator.':'No verified authenticator. Set one up for manager access.');
}
async function refreshWorkspace(token, version) {
  const who=await api('me',token);
  if(version!==sessionVersion || bearer!==token)return false;
  workspaceIds=new Set(who.memberships.map(m=>m.workspaceId));
  const select=$('#workspace');select.replaceChildren();
  for(const id of workspaceIds){const opt=document.createElement('option');opt.value=id;opt.textContent='Workspace '+id.slice(0,8);select.append(opt);}
  $('#grants').replaceChildren();
  for(const g of who.grants){const b=document.createElement('span');b.textContent=g.role.replaceAll('_',' ')+' · '+g.unitId.slice(0,8);$('#grants').append(b);}
  clearRoster();
  say('#roster-status',workspaceIds.size?'Select a workspace to view authorized roster entries.':'No active workspace membership. Contact the staging administrator.');
  return true;
}
$('#mfa-refresh').addEventListener('click',()=>mfaAction(refreshMfa));
$('#mfa-enroll').addEventListener('click',()=>mfaAction(async(token,current)=>{
  // Recheck existing factors before enrollment; never silently replace a verified factor.
  const factors=await listTotp(authRequest,token);
  if(!current())return;
  if(factors.length){clearMfa();showFactors(factors);say('#mfa-status','Verify your existing authenticator.');return;}
  const factor=await enrollTotp(authRequest,token);
  if(!current())return;
  clearMfa();pendingFactor=factor.id;
  showFactors([{id:factor.id,label:'New authenticator'}]);
  $('#mfa-secret').textContent=factor.secret;$('#mfa-secret-box').classList.remove('hidden');
  say('#mfa-status','Add the manual key to your authenticator, then verify its code.');
}));
$('#mfa-verify').addEventListener('submit',e=>{
  e.preventDefault();mfaAction(async(token,current)=>{
    const factor=$('#mfa-factor').value;const code=$('#mfa-code').value.trim();$('#mfa-code').value='';
    if(pendingFactor && factor!==pendingFactor)throw new Error('Factor changed.');
    const upgraded=await verifyTotp(authRequest,token,factor,code);
    if(!current())return;
    // No client-derived privileges. Reauthorize via the server using the new token.
    bearer=upgraded;clearMfa();clearRoster();workspaceIds.clear();$('#workspace').replaceChildren();$('#grants').replaceChildren();
    const version=sessionVersion;
    try{
      if(await refreshWorkspace(upgraded,version))say('#mfa-status','Authenticator verified. Access is determined by the server.');
    }catch{
      if(version===sessionVersion && bearer===upgraded){bearer=null;sessionVersion++;show('login-panel');say('#login-status','Session revalidation failed. Sign in again.');}
    }
  });
});
$('#otp-request').addEventListener('submit',async e => {
  e.preventDefault();
  const email = $('#email').value.trim();
  if (!email || email.length > 254 || loginBusy) return;
  loginBusy=true;
  say('#login-status','Requesting a code…');
  try {
    // Invitation-only; do not auto-register arbitrary users.
    await authRequest('otp',{email,create_user:false});
    accountEmail=email;$('#otp-verify').classList.remove('hidden');
    say('#login-status','If this staging account exists, check its email for your code.');
  } catch { say('#login-status','Code request unavailable. Confirm your staging invitation and provider configuration.'); } finally {loginBusy=false;}
});
$('#otp-verify').addEventListener('submit',async e => {
  e.preventDefault();
  if(loginBusy)return;loginBusy=true;const version=++sessionVersion;
  say('#login-status','Verifying your code…');
  try {
    const code=$('#code').value.trim();
    if (!/^\d{6,12}$/.test(code)) throw new Error('Invalid code format.');
    const verified = await authRequest('verify',{type:'email',email:accountEmail,token:code});
    if (!verified?.access_token) throw new Error('No access token.');
    if(version!==sessionVersion)return;
    bearer=verified.access_token; // memory only; never persist.
    const token=bearer;
    if(!await refreshWorkspace(token,version))return;
    show('workspace-panel');
    await mfaAction(refreshMfa);
  } catch { if(version===sessionVersion){bearer=null;clearMfa();say('#login-status','Sign-in was not accepted. Try again.');} } finally {loginBusy=false;}
});
$('#workspace').addEventListener('change',()=>{clearRoster();say('#roster-status','Load the selected workspace roster.');});
$('#load-roster').addEventListener('click',async()=>{
  const id=$('#workspace').value;
  if(!workspaceIds.has(id)) return say('#roster-status','Workspace not authorized.');
  clearRoster();
  const request = rosterRequest;
  const session = bearer;
  say('#roster-status','Loading…');
  try{
    const data=await api(`roster?workspace_id=${encodeURIComponent(id)}`);
    if(request!==rosterRequest || session!==bearer || id!==$('#workspace').value) return;
    const body=$('#roster');body.replaceChildren();
    for(const row of data.rows){const tr=document.createElement('tr');
      for(const text of [row.display_name_snapshot,row.position_snapshot,row.unit_id.slice(0,8)]){
        const td=document.createElement('td');td.textContent=text;tr.append(td);
      }body.append(tr);
    }
    say('#roster-status',`${data.rows.length} authorized roster entr${data.rows.length===1?'y':'ies'}.`);
  }catch(e){if(request===rosterRequest && session===bearer) say('#roster-status',`Roster request denied: ${e.message}`);}
});
$('#logout').addEventListener('click',async()=>{
  sessionVersion++;const token=bearer;bearer=null;clearMfa();workspaceIds.clear();$('#code').value='';clearRoster();$('#grants').replaceChildren();$('#workspace').replaceChildren();accountEmail='';
  show('login-panel');say('#login-status','Signed out from this preview.');
  if(token){try{await fetch(`${config.supabaseUrl}/auth/v1/logout`,{method:'POST',cache:'no-store',headers:{apikey:config.publishableKey,Authorization:`Bearer ${token}`}});}catch{}}
});
init();
