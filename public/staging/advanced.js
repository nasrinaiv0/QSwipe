const $=s=>document.querySelector(s);
const hide=(s,v=true)=>$(s).classList.toggle('hidden',v);
const node=(t,x,c)=>{const n=document.createElement(t);if(x!==undefined)n.textContent=x;if(c)n.className=c;return n;};
const uuid=x=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x);
export function createAdvanced({getToken,onAuthExpired}){
 let enabled=false,identity=null,roster=[],epoch=0,busy=false,pending=null,view=null,scope=null;
 const say=t=>{$('#adv-status').textContent=t;};
 const unit=()=>$('#onboarding-unit').value;
 const ws=()=>$('#workspace').value;
 function controls(){for(const e of $('#advanced-panel').querySelectorAll('button,input,select'))e.disabled=busy||!!pending||!navigator.onLine;$('#adv-retry').disabled=busy||!navigator.onLine;hide('#adv-retry',!pending);}
 function clearView(){view=null;scope=null;hide('#adv-own');hide('#adv-admin');for(const k of ['#adv-requests','#adv-transfers','#adv-holidays','#adv-shift'])$(k).replaceChildren();}
 function reset(){epoch++;busy=false;pending=null;roster=[];clearView();for(const x of $('#advanced-panel').querySelectorAll('input'))x.value=x.id==='adv-version'?'0':'';say('Load the authorized roster, or select your assigned unit.');controls();}
 function bind(who,active){identity=who;enabled=active===true;reset();hide('#advanced-panel',!enabled);refreshGrant();}
 function refreshGrant(){const memberships=new Set((identity?.memberships??[]).filter(m=>m.workspaceId===ws()).map(m=>m.id));hide('#adv-inbox',!enabled||!(identity?.grants??[]).some(g=>memberships.has(g.membershipId)&&['level_3','org_admin'].includes(g.role)));}
 function setRoster(rows){roster=rows.filter(r=>r.isOwn&&r.workspace_id===ws());}
 function clear(){bind(null,false);}
 async function call(c,t){const r=await fetch('/api/staging/advanced',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:JSON.stringify(c)});let d;try{d=await r.json();}catch{throw Object.assign(Error('INVALID_RESPONSE'),{status:r.ok?502:r.status});}if(r.status===401&&t===getToken())onAuthExpired();if(!r.ok)throw Object.assign(Error('REJECTED'),{status:r.status});return d;}
 function row(title,status){const n=node('div',undefined,'p5-row'),pill=node('span',status,'p5-pill');pill.dataset.state=status;n.append(node('strong',title),pill);return n;}
 function action(label,c){const b=node('button',label,'secondary');b.type='button';b.onclick=()=>{if(confirm(label+'? The server records this action.'))send(c);};return b;}
 function render(d){view=d.action;scope={workspaceId:d.workspaceId,unitId:d.unitId};hide('#adv-own',view!=='mine');hide('#adv-admin',view!=='inbox');const req=$('#adv-requests'),tr=$('#adv-transfers'),hol=$('#adv-holidays');req.replaceChildren();tr.replaceChildren();hol.replaceChildren();$('#adv-shift').replaceChildren(...d.eligible.map(x=>new Option(x.localStart.replace('T',' ')+' → '+x.localEnd.replace('T',' '),x.sessionId)));
 if(!d.requests.length)req.append(node('p','No recent leave requests.'));
 for(const x of d.requests){const n=row(x.localStart.replace('T',' ')+' · '+x.category.replaceAll('_',' '),x.status);n.append(node('p','Roster '+x.rosterId,'p5-small'));if(x.status==='pending'){if(view==='mine')n.append(action('Withdraw request',{action:'withdraw_leave',targetId:x.id,rosterId:x.rosterId}));else if(!x.madeByMe){n.append(action('Approve leave',{action:'decide_leave',targetId:x.id,outcome:'approved'}),action('Reject leave',{action:'decide_leave',targetId:x.id,outcome:'rejected'}));}}req.append(n);}
 for(const x of d.transfers){const n=row('Effective '+new Date(x.effectiveAt).toISOString().replace('T',' ').slice(0,16)+' UTC',x.status);n.append(node('p','Destination '+x.destinationUnitId,'p5-small'));if(x.status==='pending'){if(Date.parse(x.effectiveAt)<=Date.now())n.append(action('Activate transfer',{action:'activate_transfer',targetId:x.id}));n.append(action('Cancel transfer',{action:'cancel_transfer',targetId:x.id}));}tr.append(n);}
 for(const x of d.holidays){const n=row(x.localDate+' · '+x.classification,'v'+x.version);n.append(node('p',x.region+' · '+x.sourceRef));hol.append(n);}
 say('Authorized '+(view==='mine'?'employee requests':'unit inbox')+' loaded.');}
 async function send(c,retry=false){if(!enabled||busy||!navigator.onLine||(!retry&&pending))return;const t=getToken(),g=epoch;if(!t)return;const read=c&&['mine','inbox'].includes(c.action);const command=retry?pending:read?c:{...c,...scope,requestId:crypto.randomUUID()};if(!command||!command.workspaceId)return;if(!read)pending=command;busy=true;controls();try{const d=await call(command,t);if(g!==epoch||t!==getToken())return;if(d.action!==command.action||d.workspaceId!==command.workspaceId||(command.unitId&&d.unitId!==command.unitId))throw Error('INVALID_RESPONSE');if(read)render(d);else{if(typeof d.replayed!=='boolean')throw Error('INVALID_RESPONSE');pending=null;clearView();say('Command recorded. Reload requests or inbox to see the current state.');}}catch(e){if(g!==epoch)return;if(!read&&![400,401,403,409,422].includes(e.status))say('Delivery uncertain. Retry the identical command.');else{pending=null;clearView();say('Request rejected. Check your scope, date and version.');}}finally{if(g===epoch){busy=false;controls();}}}
 $('#adv-mine').onclick=()=>{if(roster.length!==1)return say('Load your authorized roster first. Exactly one active own roster is required.');send({action:'mine',workspaceId:ws(),rosterId:roster[0].id});};
 $('#adv-inbox').onclick=()=>{if(!unit())return say('Choose an assigned administration unit first.');send({action:'inbox',workspaceId:ws(),unitId:unit()});};
 $('#adv-leave').onsubmit=e=>{e.preventDefault();if(view==='mine'&&roster.length===1&&$('#adv-shift').value)send({action:'request_leave',sessionId:$('#adv-shift').value,rosterId:roster[0].id,category:$('#adv-category').value});};
 $('#adv-transfer').onsubmit=e=>{e.preventDefault();if(view!=='inbox'||!uuid($('#adv-roster').value)||!uuid($('#adv-dest').value))return say('Enter valid roster and destination UUIDs.');send({action:'plan_transfer',rosterId:$('#adv-roster').value,destinationUnitId:$('#adv-dest').value,effectiveAt:$('#adv-effective').value+':00Z'});};
 $('#adv-holiday').onsubmit=e=>{e.preventDefault();if(view==='inbox')send({action:'regional_holiday',localDate:$('#adv-date').value,region:$('#adv-region').value,sourceRef:$('#adv-source').value,category:$('#adv-class').value,expectedVersion:Number($('#adv-version').value)});};
 $('#adv-retry').onclick=()=>send(null,true);window.addEventListener('online',controls);window.addEventListener('offline',controls);
 return {bind,clear,setRoster,resetScope:()=>{reset();refreshGrant();},hasPending:()=>!!pending};
}
