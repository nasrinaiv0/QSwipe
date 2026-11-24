// Verified attendance UI only; no imports from the demo store or role model.
const $=s=>document.querySelector(s);
const hide=(s,v=true)=>$(s).classList.toggle('hidden',v);
const validToken=t=>typeof t==='string'&&/^[a-f0-9]{64}$/.test(t);
export function summarizeSessions(rows){
 if(!Array.isArray(rows)||rows.length>30)throw Error('INVALID_REPORT');
 const out={present:0,absent:0,unmarked:0,rate:null};
 const ids=new Set();
 for(const r of rows){if(!r||typeof r.sessionId!=='string'||ids.has(r.sessionId)||!['present','absent','unmarked'].includes(r.status))throw Error('INVALID_REPORT');ids.add(r.sessionId);out[r.status]++;}
 const marked=out.present+out.absent;if(marked)out.rate=Math.round(1000*out.present/marked)/10;
 return out;
}
export function qrMatrix(rows){
 if(!Array.isArray(rows)||rows.length<21||rows.length>81||(rows.length-21)%4!==0||!rows.every(r=>typeof r==='string'&&r.length===rows.length&&/^[01]+$/.test(r)))throw Error('INVALID_QR');
 return rows;
}
export function createAttendanceAdapter({call,context,refresh,refreshReport,notify}){
 let enabled=false,busy=false,generation=0,expiryTimer=null,stream=null,scanTimer=null,scanGeneration=0;
 const pending=new Map();
 const key=c=>c?c.sessionId+':'+c.rosterId:null;
 const tell=t=>{$('#adapter-attendance-status').textContent=t;};
 function stopCamera(){scanGeneration++;clearTimeout(scanTimer);stream?.getTracks().forEach(t=>t.stop());stream=null;$('#adapter-video').srcObject=null;hide('#adapter-video');hide('#adapter-stop');}
 function clearPass(){clearTimeout(expiryTimer);$('#adapter-qr').replaceChildren();$('#adapter-pass-token').value='';$('#adapter-expiry').textContent='';hide('#adapter-pass');}
 function selection(){generation++;busy=false;clearPass();stopCamera();$('#adapter-token').value='';tell('Select an open unmarked session.');update();}
 function clear(){enabled=false;pending.clear();selection();hide('#adapter-nav');hide('#adapter-report');hide('#adapter-attendance');report([]);}
 function bind(active){enabled=active===true;selection();hide('#adapter-nav',!enabled);hide('#adapter-report',!enabled);}
 function update(){
  const c=context(),active=enabled&&!!c,unmarked=active&&c.version===0,online=navigator.onLine!==false,wait=active&&pending.has(key(c));
  hide('#adapter-attendance',!active);hide('#adapter-own',!unmarked||!c?.own);hide('#adapter-manager',!unmarked||!c?.manager);
  hide('#adapter-retry',!wait);$('#adapter-retry').disabled=!online||busy||!c?.manager||c?.locked;
  for(const id of ['#adapter-issue','#adapter-present-btn','#adapter-absent-btn','#adapter-redeem button','#adapter-token','#adapter-scan'])$(id).disabled=!online||busy||!unmarked||wait||c?.locked;
  hide('#adapter-camera-controls',!unmarked||!c?.manager||typeof globalThis.BarcodeDetector!=='function'||!navigator.mediaDevices?.getUserMedia);
  $('#adapter-report-refresh').disabled=!enabled||!online||busy||c?.locked;
  if(!online){clearPass();stopCamera();}
 }
 function report(rows,loaded=false){
  const result=summarizeSessions(rows);
  for(const name of ['present','absent','unmarked'])$('#adapter-'+name).textContent=loaded?String(result[name]):'—';
  $('#adapter-rate').textContent=result.rate===null?'—':result.rate+'%';
  $('#adapter-report-summary').textContent=loaded?rows.length+' recent authorized sessions · unmarked is not absent.':'Choose an employee to load server records.';
  const target=$('#adapter-report-rows');target.replaceChildren();
  for(const r of rows){const tr=document.createElement('tr');for(const val of [new Date(r.opensAt).toLocaleString(),r.status[0].toUpperCase()+r.status.slice(1),'v'+r.version]){const td=document.createElement('td');td.textContent=val;tr.append(td);}target.append(tr);}
 }
 function drawPass(data){
  const matrix=qrMatrix(data.qr),n=matrix.length;
  if(!validToken(data.token)||!Number.isFinite(Date.parse(data.expiresAt))||Date.parse(data.expiresAt)<=Date.now())throw Error('INVALID_PASS');
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox',`-4 -4 ${n+8} ${n+8}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','One-time attendance QR code');svg.setAttribute('shape-rendering','crispEdges');
  let d='';matrix.forEach((row,y)=>{for(let x=0;x<n;x++)if(row[x]==='1')d+=`M${x} ${y}h1v1h-1z`;});path.setAttribute('d',d);path.setAttribute('fill','#101814');svg.append(path);
  $('#adapter-qr').replaceChildren(svg);$('#adapter-pass-token').value=data.token;$('#adapter-expiry').textContent='Expires '+new Date(data.expiresAt).toLocaleTimeString()+'. Show only to your authorized manager.';hide('#adapter-pass',false);
  expiryTimer=setTimeout(()=>{clearPass();tell('Pass expired. Generate a new pass.');},Math.min(60000,Math.max(0,Date.parse(data.expiresAt)-Date.now())));
 }
 async function issue(){
  const c=context();if(!enabled||!c?.own||c.version!==0||c.locked||busy||!navigator.onLine)return;
  const g=generation;clearPass();busy=true;update();
  try{const data=await call('attendance',{action:'issue',sessionId:c.sessionId,rosterId:c.rosterId});if(g!==generation||key(context())!==key(c))return;drawPass(data);tell('Pass issued by server. It is single-use.');}
  catch{if(g===generation)tell('Unable to issue pass. Check session, account and connection.');}
  finally{if(g===generation){busy=false;update();}}
 }
 async function mark(status,qrToken,retry=false){
  const c=context(),id=key(c);if(!enabled||!c?.manager||c.locked||busy||!navigator.onLine||(!retry&&c.version!==0))return;
  let command=pending.get(id);
  if(retry&&!command)return;if(!retry&&command)return;
  if(!retry){if(qrToken!==undefined&&!validToken(qrToken))return;if(pending.size>=20){tell('Resolve outstanding requests before marking more attendance.');return;}if(!confirm('Confirm '+status+' for the selected employee after in-person verification?'))return;
   command=Object.freeze({action:'mark',sessionId:c.sessionId,rosterId:c.rosterId,requestId:crypto.randomUUID(),expectedVersion:0,status,...(qrToken?{qrToken}:{reason:status==='present'?'in_person':'verified_absence'})});pending.set(id,command);
  }
  const g=generation;busy=true;$('#adapter-token').value='';stopCamera();update();
  try{const data=await call('attendance',command);if(g!==generation||key(context())!==id)return;
   if(data.sessionId!==c.sessionId||data.rosterId!==c.rosterId||data.version!==1||data.status!==command.status||typeof data.replayed!=='boolean')throw Error('INVALID_RECEIPT');
   pending.delete(id);tell('Attendance recorded. Refreshing server state.');await refresh();
  }catch(e){if(g!==generation)return;if([400,401,403,409,422].includes(e.status)){pending.delete(id);tell('Request denied or stale. Refresh the server record before another mark.');await refresh();}else tell('Delivery uncertain. Retry the identical request; do not create another mark.');}
  finally{if(g===generation){busy=false;update();}}
 }
 async function scan(){
  const c=context();if(!c?.manager||c.version!==0||c.locked||busy||!navigator.onLine||!globalThis.BarcodeDetector)return;
  stopCamera();const g=++scanGeneration;
  try{const next=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});if(g!==scanGeneration){next.getTracks().forEach(t=>t.stop());return;}stream=next;const video=$('#adapter-video');video.srcObject=stream;hide('#adapter-video',false);hide('#adapter-stop',false);await video.play();const detector=new BarcodeDetector({formats:['qr_code']});
   const tick=async()=>{if(g!==scanGeneration)return;try{const found=await detector.detect(video);if(g!==scanGeneration)return;const token=found.find(x=>validToken(x.rawValue))?.rawValue;if(token){$('#adapter-token').value=token;stopCamera();tell('Pass captured. Verify the employee and press Verify pass.');return;}}catch{stopCamera();tell('Camera scan unavailable. Enter the pass manually.');return;}scanTimer=setTimeout(tick,250);};tick();
  }catch{if(g===scanGeneration){stopCamera();tell('Camera unavailable. Enter the pass manually.');}}
 }
 $('#adapter-issue').addEventListener('click',issue);$('#adapter-hide').addEventListener('click',clearPass);
 $('#adapter-present-btn').addEventListener('click',()=>mark('present'));$('#adapter-absent-btn').addEventListener('click',()=>mark('absent'));
 $('#adapter-redeem').addEventListener('submit',e=>{e.preventDefault();mark('present',$('#adapter-token').value.trim());});
 $('#adapter-retry').addEventListener('click',()=>mark(null,undefined,true));
 $('#adapter-scan').addEventListener('click',scan);$('#adapter-stop').addEventListener('click',stopCamera);
 $('#adapter-report-refresh').addEventListener('click',refreshReport);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){clearPass();stopCamera();$('#adapter-token').value='';}});
 return {bind,clear,selection,update,report,hasPending:()=>pending.size>0};
}
