/** Preview-only auth UI: no localStorage, sessionStorage, role picker or service-role secret. */
const $ = selector => document.querySelector(selector);
let config = null;
let bearer = null;
let accountEmail = '';
let workspaceIds = new Set();
let rosterRequest = 0;
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
async function authRequest(path, body) {
  return result(await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    method:'POST',redirect:'error',cache:'no-store',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }));
}
async function api(path) {
  if (!bearer) throw new Error('Session expired. Sign in again.');
  return result(await fetch(`/api/staging/${path}`, {redirect:'error',cache:'no-store',headers:{Authorization:`Bearer ${bearer}`}}));
}
async function init() {
  try {
    config = await result(await fetch('/api/staging/config',{cache:'no-store'}));
    if (!config?.staging || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl)) throw Error('Invalid staging configuration.');
    show('login-panel');
  } catch { $('#setup-panel').replaceChildren();const h=document.createElement('h2');h.textContent='Staging is safely disabled';const p=document.createElement('p');p.textContent='Connect a dedicated QSwipe staging project and enable preview-only settings to test authentication. The existing demo remains available.';$('#setup-panel').append(h,p); }
}
$('#otp-request').addEventListener('submit',async e => {
  e.preventDefault();
  const email = $('#email').value.trim();
  if (!email || email.length > 254) return;
  say('#login-status','Requesting a code…');
  try {
    // Invitation-only; do not auto-register arbitrary users.
    await authRequest('otp',{email,create_user:false});
    accountEmail=email;$('#otp-verify').classList.remove('hidden');
    say('#login-status','If this staging account exists, check its email for your code.');
  } catch { say('#login-status','Code request unavailable. Confirm your staging invitation and provider configuration.'); }
});
$('#otp-verify').addEventListener('submit',async e => {
  e.preventDefault();
  say('#login-status','Verifying your code…');
  try {
    const code=$('#code').value.trim();
    if (!/^\d{6,12}$/.test(code)) throw new Error('Invalid code format.');
    const verified = await authRequest('verify',{type:'email',email:accountEmail,token:code});
    if (!verified?.access_token) throw new Error('No access token.');
    bearer=verified.access_token; // memory only; never persist.
    const who=await api('me');
    workspaceIds=new Set(who.memberships.map(m=>m.workspaceId));
    const select=$('#workspace');select.replaceChildren();
    for (const id of workspaceIds) { const opt=document.createElement('option');opt.value=id;opt.textContent=`Workspace ${id.slice(0,8)}`;select.append(opt); }
    $('#grants').replaceChildren();
    for(const g of who.grants){const b=document.createElement('span');b.textContent=`${g.role.replaceAll('_',' ')} · ${g.unitId.slice(0,8)}`;$('#grants').append(b);}
    show('workspace-panel');
    say('#roster-status',workspaceIds.size?'Select a workspace to view authorized roster entries.':'No active workspace membership. Contact the staging administrator.');
  } catch (e) { bearer=null;say('#login-status',`Sign-in was not accepted: ${e.message}`); }
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
  const token=bearer;bearer=null;workspaceIds.clear();$('#code').value='';clearRoster();$('#grants').replaceChildren();$('#workspace').replaceChildren();accountEmail='';
  show('login-panel');say('#login-status','Signed out from this preview.');
  if(token){try{await fetch(`${config.supabaseUrl}/auth/v1/logout`,{method:'POST',cache:'no-store',headers:{apikey:config.publishableKey,Authorization:`Bearer ${token}`}});}catch{}}
});
init();
