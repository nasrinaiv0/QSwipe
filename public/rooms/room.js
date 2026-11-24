const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const stage=$('#stage'),connection=$('#connection'),message=$('#message');
let state=null,credential=null,busy=false,available=false,epoch=0,clockOffset=0,raf=0,interval=0,visual=null,renderedKey='';
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const colors=['#187953','#df9f2d','#397cb5','#cb7456','#8065b6','#369a91','#be5876','#6c7a39'];
const gameName={wheel:'Lucky wheel',race:'Duck race',trivia:'Team trivia'};
const say=t=>{message.textContent=t;};
const connected=t=>{connection.textContent=t;};
const control=(text,fn,cls='')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
const now=()=>Date.now()+clockOffset;
const name=id=>state?.players.find(x=>x.id===id)?.name??'Player';
const safeErrors={INVALID_PLAYER:'Use a display name of 1–24 characters.',INVITE_EXPIRED:'Invitation expired or not found.',ROOM_NOT_JOINABLE:'Room is full or a game is in progress.',NAME_TAKEN:'Choose a different display name.',HOST_ONLY:'Only the host can do that.',CANNOT_START:'The room changed. Wait for the latest state.',QUESTION_CLOSED:'This question has closed.',ALREADY_ANSWERED:'Your answer is already recorded.',ROOM_LIMIT:'The staging room limit has been reached.',SLOW_DOWN:'Too many requests. Try again shortly.'};
function syncControls(){for(const b of document.querySelectorAll('#entry button'))b.disabled=busy||!available;for(const b of document.querySelectorAll('#room button')){if(b.id==='exit')b.disabled=busy;else b.disabled=busy||b.dataset.locked==='true';}}
function reset(text){epoch++;state=null;credential=null;busy=false;renderedKey='';cancelAnimationFrame(raf);visual=null;$('#room').hidden=true;$('#entry').hidden=false;$('#qr').replaceChildren();$('#code').textContent='';stage.replaceChildren();$('#players').replaceChildren();$('#teams').replaceChildren();say(text);syncControls();}
async function send(body){
 if(busy||!available)return;
 const e=epoch,started=Date.now();busy=true;syncControls();
 try{
  const res=await fetch('/api/rooms/command',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json',...(credential?{Authorization:'Bearer '+credential}:{})},body:JSON.stringify(body)});
  let data;try{data=await res.json();}catch{throw Error('ROOM_UNAVAILABLE');}
  if(e!==epoch)return;
  if(!res.ok){if(data.error==='ROOM_ACCESS_DENIED'){reset('Room closed or expired. Join a new room.');return;}throw Error(data.error||'ROOM_UNAVAILABLE');}
  if(data.closed){reset('Room closed.');return;}
  if(!data.state||typeof data.state.serverNow!=='number')throw Error('ROOM_UNAVAILABLE');
  if(data.credential)credential=data.credential;
  clockOffset=data.state.serverNow-Math.round((started+Date.now())/2);
  state=data.state;connected('Live · connected');
  if(body.action!=='state')say('');
  render();
 }catch(err){if(e===epoch){connected('Connection interrupted');say(safeErrors[err.message]??'Room service unavailable. Your previous scores have not been changed by this screen.');}}
 finally{if(e===epoch){busy=false;syncControls();}}
}
const cmd=(action,rest={})=>state&&send({action,roomId:state.roomId,...rest});
function drawQR(){
 const target=$('#qr');target.replaceChildren();
 if(!state.qr)return;
 const q=state.qr,n=svg('svg',{viewBox:'0 0 '+q.size+' '+q.size,role:'img','aria-label':'Room invitation QR code','shape-rendering':'crispEdges'});
 n.append(svg('rect',{width:q.size,height:q.size,fill:'#fff'}),svg('path',{d:q.path,fill:'#0b1711'}));target.append(n);$('#code').textContent=state.invite;
}
function drawBoard(){
 $('#count').textContent=state.players.length+' / 12';
 const teams=$('#teams');teams.replaceChildren();
 for(const t of [...state.teams].sort((a,b)=>(b.average??-1)-(a.average??-1))){
  const n=el('div',undefined,'team-row'),d=el('span',undefined,'dot '+t.team),info=el('div',undefined,'grow');
  info.append(el('strong',t.team==='jade'?'Jade team':'Amber team'),el('div',t.count+' players · '+t.total+' total pts','muted'));
  n.append(d,info,el('span',t.average===null?'—':String(t.average),'score'));teams.append(n);
 }
 const list=$('#players');list.replaceChildren();
 [...state.players].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).forEach((p,i)=>{
  const n=el('div',undefined,'player'+(p.badges.includes('Gold frame')?' gold':'')),info=el('div',undefined,'grow');
  info.append(el('strong',p.name+(p.id===state.me?' · You':'')),el('div',(p.team==='jade'?'Jade':'Amber')+' · '+p.rounds+' rounds','muted'));
  if(p.badges.length)info.append(el('div','✦ '+p.badges.join(' · '),'badge-line'));
  n.append(el('span',String(i+1),'rank'),el('span',undefined,'dot '+p.team),info,el('span',String(p.points),'score'));list.append(n);
 });
}
function heading(title,sub){stage.append(el('h2',title),el('p',sub));}
function wheel(q){
 const box=el('div',undefined,'wheel-box');box.append(el('span','▼','wheel-pointer'));
 const n=svg('svg',{viewBox:'0 0 300 300',role:'img','aria-label':'Synchronized lucky wheel'}),rotor=svg('g'),count=q.participants.length;
 for(let i=0;i<count;i++){
  const a=i*2*Math.PI/count-Math.PI/2,b=(i+1)*2*Math.PI/count-Math.PI/2,m=(a+b)/2;
  const point=x=>[150+140*Math.cos(x),150+140*Math.sin(x)].map(v=>v.toFixed(3)).join(' ');
  rotor.append(svg('path',{d:'M150 150L'+point(a)+'A140 140 0 '+(b-a>Math.PI?1:0)+' 1 '+point(b)+'Z',fill:colors[i%colors.length],stroke:'#fff','stroke-width':1.5}));
  const text=svg('text',{x:150+98*Math.cos(m),y:150+98*Math.sin(m),'font-size':count>8?10:12,'font-weight':700,fill:'#fff','text-anchor':'middle','dominant-baseline':'middle'});text.textContent=name(q.participants[i]).slice(0,11);rotor.append(text);
 }
 rotor.append(svg('circle',{cx:150,cy:150,r:24,fill:'#12271e',stroke:'#fff','stroke-width':3}));
 n.append(rotor);box.append(n);stage.append(box);visual={type:'wheel',rotor,target:360*5+(360-(q.participants.indexOf(q.winner)+.5)*360/count)%360};
}
function race(q){
 const tracks=[];
 for(const id of q.participants){
  stage.append(el('div',name(id),'track-label'));const track=el('div',undefined,'race-track'),duck=el('div',undefined,'duck');
  const sprite=svg('svg',{viewBox:'0 0 58 44',width:50,height:38,'aria-hidden':'true'});
  sprite.append(svg('ellipse',{cx:24,cy:27,rx:21,ry:13,fill:'#f1b936',stroke:'#bb8119','stroke-width':1.3}),svg('path',{d:'M6 23L0 14L18 23',fill:'#e8a629',stroke:'#bb8119','stroke-width':1.3}),svg('circle',{cx:40,cy:14,r:13,fill:'#ffd55b',stroke:'#bb8119','stroke-width':1.3}),svg('path',{d:'M48 16L58 19L48 23Z',fill:'#e57c28'}),svg('circle',{cx:44,cy:11,r:2.3,fill:'#16251b'}),svg('path',{d:'M14 27Q24 39 34 26Q24 29 14 27Z',fill:'#e7a42e'}));
  const bob=el('span');bob.append(sprite);duck.append(bob);track.append(duck);stage.append(track);tracks.push({id,track,duck});
 }
 visual={type:'race',tracks};
}
function renderStage(){
 cancelAnimationFrame(raf);visual=null;stage.replaceChildren();const s=state,q=s.round;
 if(s.phase==='lobby'){
  heading('Ready for game time?',s.host?'Choose a game once at least two players are in the room.':'Waiting for your host to choose a game.');
  const grid=el('div',undefined,'game-grid');for(const [game,symbol] of [['wheel','✦'],['race','🦆'],['trivia','?']]){
   const b=control(gameName[game],()=>cmd('start',{game,version:state.version}),'game');b.prepend(el('span',symbol));b.dataset.locked=String(!s.host||s.players.length<2);b.disabled=b.dataset.locked==='true';grid.append(b);
  }stage.append(grid,el('p','Room scores reset when the temporary room closes.','muted'));return;
 }
 heading(gameName[q.game],q.game==='trivia'?'Question '+(q.index+1)+' of 5 · everyone answers independently':s.phase==='playing'?'One shared draw, one shared result.':'Round complete');
 if(q.game==='wheel')wheel(q);
 if(q.game==='race')race(q);
 if(q.game==='trivia'){
  stage.append(el('div',q.question,'question'));const timer=el('div',undefined,'timer'),bar=el('span');timer.append(bar);stage.append(timer);visual={type:'timer',bar};
  const answers=el('div',undefined,'answers');q.options.forEach((v,i)=>{const b=control(String(v),()=>cmd('answer',{roundId:q.id,index:q.index,choice:i}),s.phase!=='playing'&&q.answer===i?'correct':'');b.dataset.locked=String(s.phase!=='playing'||q.answered);b.disabled=b.dataset.locked==='true';answers.append(b);});stage.append(answers,el('p',q.answerCount+' / '+s.players.length+' answered'+(q.answered&&s.phase==='playing'?' · Answer saved':'')));
  if(s.phase!=='playing')stage.append(el('div','Correct answer: '+q.options[q.answer]+(q.selected===q.answer?' · Nice work!':''),'result'));
  if(s.phase==='reveal'&&s.host)stage.append(control('Next question',()=>cmd('next',{roundId:q.id,index:q.index}),'stage-action'));
 }
 if(s.phase==='finished'){
  stage.append(el('div',q.game==='trivia'?'Trivia complete · scores updated':'🏆 '+name(q.winner)+' wins!','result'));
  if(q.game==='race'){const podium=el('div',undefined,'podium');for(const [i,id] of q.order.slice(0,3).entries()){const p=el('div',undefined,'podium-step');p.append(el('strong',String(i+1)),el('span',name(id)));podium.append(p);}stage.append(podium);}
  if(s.host)stage.append(control('Back to lobby',()=>cmd('lobby',{version:state.version}),'stage-action'));
 }
 if(s.phase==='reveal'&&!s.host)stage.append(el('p','Waiting for the host to continue.','muted'));
 animate();
}
function animate(){
 cancelAnimationFrame(raf);if(!visual||!state?.round)return;
 const q=state.round,t=now(),progress=Math.max(0,Math.min(1,(t-q.startsAt)/(q.endsAt-q.startsAt))),done=state.phase!=='playing',reduced=motion.matches;
 if(visual.type==='wheel'){const p=done?1:reduced?0:1-(1-progress)**4;visual.rotor.setAttribute('transform','rotate('+visual.target*p+' 150 150)');}
 if(visual.type==='race')for(const {id,track,duck} of visual.tracks){const p=done?1:reduced?0:Math.max(0,Math.min(1,(t-q.startsAt)/q.finish[id]));duck.style.transform='translateX('+p*Math.max(0,track.clientWidth-58)+'px)';}
 if(visual.type==='timer')visual.bar.style.transform='scaleX('+(done?0:1-progress)+')';
 if(!done&&progress<1&&!document.hidden)raf=requestAnimationFrame(animate);
}
function render(){
 $('#entry').hidden=true;$('#room').hidden=false;$('#role').textContent=state.host?'HOST · TEMPORARY ROOM':'PLAYER · TEMPORARY ROOM';$('#heading').textContent='Live room';$('#subheading').textContent=state.players.length+' teammates · '+(state.phase==='lobby'?'Lobby open':state.phase==='playing'?'Game in progress':'Round results');
 $('#exit').textContent=state.host?'Close room':'Leave room';
 const show=state.host&&state.phase==='lobby';
 $('#invite-panel').hidden=!show;
 const key=state.roomId+':'+state.version+':'+state.me;
 if(key!==renderedKey){renderedKey=key;drawBoard();if(show)drawQR();renderStage();}
 syncControls();

}

for(const form of [$('#create'),$('#join')])form.addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));send({action:form.id,...data});});
$('#exit').addEventListener('click',()=>{if(!state)return;if(state.host){if(confirm('Close this room for everyone?'))cmd('close');}else if(confirm('Leave this temporary room? Scores cannot be recovered on this device.'))reset('You left the room.');});
$('#copy').addEventListener('click',async()=>{if(!state?.invite)return;const link=location.origin+'/rooms/#join='+state.invite;try{await navigator.clipboard.writeText(link);say('Invitation copied.');}catch{say('Copy the invitation code shown above, or scan the QR.');}});
const invite=/^#join=([a-f0-9]{32})$/.exec(location.hash)?.[1];
if(invite){$('#join input[name=invite]').value=invite;history.replaceState(null,'',location.pathname);$('#join input[name=name]').focus();}
async function health(){try{const res=await fetch('/api/rooms/health',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(3000)});const d=await res.json();if(!res.ok||d.available!==true)throw Error();available=true;connected('Staging room service');say('');}catch{available=false;connected('Preview only');say('Shared rooms require the isolated room server. This static preview does not connect to a live backend.');}syncControls();}
interval=setInterval(()=>{if(state&&!busy&&!document.hidden)cmd('state');},1000);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAnimationFrame(raf);else if(state){cmd('state');animate();}});
window.addEventListener('pagehide',()=>{clearInterval(interval);reset('Session ended.');});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
health();
