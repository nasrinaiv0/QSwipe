const $=s=>document.querySelector(s);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
const stage=$('#stage'),connection=$('#connection'),message=$('#message');
let state=null,credential=null,busy=false,available=false,epoch=0,clockOffset=0,raf=0,interval=0,visual=null,renderedKey='',stageKey='',requestAction=null,pendingFlip=null;
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const colors=['#187953','#df9f2d','#397cb5','#cb7456','#8065b6','#369a91','#be5876','#6c7a39'];
const gameName={wheel:'Lucky wheel',race:'Duck race',trivia:'Team trivia',memory:'Memory match',bingo:'Team bingo',charades:'Charades',drawing:'Draw & guess',custom_trivia:'Custom trivia'};
const profileKey='qswipe.player.v1';
let profile=null,profileSecret=null,profileBusy=false;
try{const x=localStorage.getItem(profileKey);if(/^[0-9a-f]{64}$/.test(x??''))profileSecret=x;}catch{}

const sessionKey='qswipe.room.v2';
let resumeId=null,healthBusy=false,lastHealth=0;
const skins={classic:['#f1b936','#ffd55b','#bb8119','#e7a42e'],mint:['#65ba99','#a5e4c9','#287c61','#4fa385'],berry:['#c576a5','#f3b4d6','#99517d','#ae638f'],ocean:['#609cd4','#b4dbff','#416b9c','#5088b9']};
const symbols=['✦','☀','◆','☘','★','♥','☾','●'];
function saveSession(){try{if(credential&&state)sessionStorage.setItem(sessionKey,JSON.stringify({roomId:state.roomId,credential}));}catch{}}
function forgetSession(){try{sessionStorage.removeItem(sessionKey);}catch{}}
function readSession(){try{const v=JSON.parse(sessionStorage.getItem(sessionKey)||'null');if(v&&/^[0-9a-f]{32}$/.test(v.roomId)&&/^[0-9a-f]{64}$/.test(v.credential))return v;}catch{}return null;}

const say=t=>{message.textContent=t;};
const connected=t=>{connection.textContent=t;};
const control=(text,fn,cls='')=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
const now=()=>Date.now()+clockOffset;
const name=id=>state?.players.find(x=>x.id===id)?.name??'Player';
const safeErrors={HOST_MUST_CLOSE:'The host can close the room for everyone.',STROKE_UNAVAILABLE:'Drawing changed or the stroke limit was reached.',INVALID_QUESTION:'Enter a question and four different answers.',LOBBY_CHANGED:'Room changed; try again after synchronization.',ACCESSORY_LOCKED:'Unlock this accessory through games.',GUESS_UNAVAILABLE:'Wait a moment or check whether this round has ended.',PROFILE_DENIED:'Player profile is unavailable. Forget it and create a new one.',MASCOT_LOCKED:'Complete the milestone to unlock this mascot.',BINGO_UNAVAILABLE:'Only mark a called number on your own board.',PROFILE_LIMIT:'Player profile capacity reached.',TOURNAMENT_UNAVAILABLE:'The room changed or a tournament is already active. Wait for synchronization and try again.',CARD_UNAVAILABLE:'That card is no longer available. Wait for the board to refresh.',SKIN_UNAVAILABLE:'Choose a skin while in the lobby.',ROOM_STORE_UNAVAILABLE:'Room storage is temporarily unavailable. Reconnecting…',INVALID_PLAYER:'Use a display name of 1–24 characters.',INVITE_EXPIRED:'Invitation expired or not found.',ROOM_NOT_JOINABLE:'Room is full or a game is in progress.',NAME_TAKEN:'Choose a different display name.',HOST_ONLY:'Only the host can do that.',CANNOT_START:'The room changed. Wait for the latest state.',QUESTION_CLOSED:'This question has closed.',ALREADY_ANSWERED:'Your answer is already recorded.',ROOM_LIMIT:'The staging room limit has been reached.',SLOW_DOWN:'Too many requests. Try again shortly.'};
function syncControls(){
 for(const b of document.querySelectorAll('#profile-create button,#profile-content button'))b.disabled=busy||profileBusy||!available||b.dataset.locked==='true';for(const b of document.querySelectorAll('#entry button'))b.disabled=busy||profileBusy||!!resumeId||(!b.closest('.entry-selector')&&!available)||b.dataset.locked==='true';for(const b of document.querySelectorAll('#room button')){if(b.id==='exit')b.disabled=busy;else if(b.classList.contains('memory-card'))b.disabled=!!pendingFlip||(busy&&requestAction!=='state')||b.dataset.locked==='true';else b.disabled=busy||b.dataset.locked==='true';}}
function reset(text){epoch++;drawActive=false;pendingStroke=null;pendingFlip=null;requestAction=null;stageKey='';keyboardRound='';forgetSession();resumeId=null;state=null;credential=null;busy=false;renderedKey='';stopVisual();visual=null;$('#room').hidden=true;$('#profile-room').open=false;$('#skin-panel').open=false;$('#season-panel').open=false;$('#room-notice').hidden=true;$('#profile-room-content').replaceChildren();lastProfileKey='';lastBoardKey='';$('#entry').hidden=false;$('#qr').replaceChildren();$('#code').textContent='';stage.replaceChildren();$('#players').replaceChildren();$('#teams').replaceChildren();say(text);syncControls();if(profileSecret&&available)loadProfile();}
async function send(body,auth=credential){
 if(busy||!available)return;
 const e=epoch,started=Date.now();requestAction=body.action;busy=true;syncControls();
 try{
  const res=await fetch('/api/rooms/command',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},body:JSON.stringify(body)});
  let data;try{data=await res.json();}catch{throw Error('ROOM_UNAVAILABLE');}
  if(e!==epoch)return;
  if(!res.ok){if(data.error==='ROOM_ACCESS_DENIED'){reset('Room closed or expired. Join a new room.');return;}throw Error(data.error||'ROOM_UNAVAILABLE');}
  if(data.closed){reset('Room closed.');return;}
  if(data.left){reset('You left the room. Your profile rewards are retained.');return;}
  if(!data.state||typeof data.state.serverNow!=='number')throw Error('ROOM_UNAVAILABLE');
  if(data.credential)credential=data.credential;
  clockOffset=data.state.serverNow-Math.round((started+Date.now())/2);
  state=data.state;resumeId=state.roomId;saveSession();connected('Live · connected');
  if(body.action!=='state')say('');
  $('#room-notice').textContent=state.notice??'';$('#room-notice').hidden=!state.notice;
  render();
 }catch(err){if(e===epoch){connected('Connection interrupted');say(safeErrors[err.message]??'Connection interrupted. Reconnecting to the saved room; check the server state before retrying.');}}
 finally{if(e===epoch){busy=false;requestAction=null;syncControls();flushStroke();flushFlip();}}
}
const cmd=(action,rest={})=>state&&send({action,roomId:state.roomId,...rest});
function eligibleFlip(p){const q=state?.round;return state?.roomId===p.roomId&&state.phase==='playing'&&q?.game==='memory'&&q.id===p.roundId&&q.turn===p.turn&&!q.locked&&!q.complete&&q.cards[p.card]===null;}
function queueFlip(roundId,card){
 const q=state?.round;if(!q||pendingFlip||(busy&&requestAction!=='state'))return;
 const p={roomId:state.roomId,roundId,turn:q.turn,card};
 if(!eligibleFlip(p))return;
 pendingFlip=p;syncControls();flushFlip();
}
function flushFlip(){
 if(busy||!pendingFlip)return;
 const p=pendingFlip;pendingFlip=null;
 if(eligibleFlip(p))cmd('flip',{roundId:p.roundId,turn:p.turn,card:p.card});
 else{say('Your board changed. Choose an available card.');syncControls();}
}
function updateMemoryBoard(q,phase){
 const grid=stage.querySelector('.memory-grid');
 if(!grid||grid.dataset.round!==q.id)return false;
 grid.dataset.turn=String(q.turn);grid.dataset.matched=String(q.matched);
 stage.querySelector('.memory-progress').textContent=q.matched+' / 8 pairs matched · '+(q.complete?'Board complete':q.locked?'Remember the cards…':'Find matching symbols');
 for(const [i,b] of Array.from(grid.children).entries()){
  const v=q.cards[i],label=v===null?'?':symbols[v];
  if(b.textContent!==label)b.textContent=label;
  b.classList.toggle('revealed',v!==null);
  b.setAttribute('aria-label','Card '+(i+1)+(v===null?' hidden':', '+symbols[v]));
  b.dataset.locked=String(phase!=='playing'||q.complete||q.locked||v!==null);
 }
 return true;
}

let drawActive=false,drawColor='ink',pendingStroke=null,keyboardRound='',keyboardCursor=[500,500];
function flushStroke(){if(busy||drawActive||!pendingStroke)return;const p=pendingStroke;pendingStroke=null;if(state?.roomId===p.roomId&&state?.round?.id===p.roundId&&state.phase==='playing'&&state.round.strokes.length===p.index)cmd('draw_stroke',{roundId:p.roundId,index:p.index,color:p.color,points:p.points});else if(state){renderedKey='';render();}}
function mascot(id,accessory='none'){
 const zodiac={aries:['#d09b72','#f6d8bb','♈'],taurus:['#987a61','#eac5a1','♉'],gemini:['#6da5bd','#c9e8ef','♊'],cancer:['#dc827c','#f9c5bf','♋'],leo:['#dca13e','#ffdf83','♌'],virgo:['#86a66d','#dbe9b6','♍'],libra:['#9d91c4','#e2d9f4','♎'],scorpio:['#886c9f','#d9c1ea','♏'],sagittarius:['#be8364','#f3c6a7','♐'],capricorn:['#719a93','#c9e1d6','♑'],aquarius:['#6a9ec6','#c7e3f8','♒'],pisces:['#7c9ec7','#d4e5fa','♓']}[id];
 const palette={duck:['#f4c654','#ffdf83'],fox:['#e78a53','#ffceaa'],bunny:['#b6a2d9','#e5d9f6'],bear:['#b78a64','#e8c6a1'],star:['#edb84a','#ffe8a4']}[id]??zodiac??['#f4c654','#ffdf83'];
 const n=svg('svg',{viewBox:'0 0 100 100',class:'collectible-svg','aria-hidden':'true'});n.append(svg('ellipse',{cx:50,cy:88,rx:26,ry:5,fill:'currentColor',opacity:.12}));
 const g=svg('g',{class:'mascot-bob'});n.append(g);
 if(id==='star'){g.append(svg('path',{d:'M50 8L63 34L92 38L71 59L76 88L50 74L24 88L29 59L8 38L37 34Z',fill:palette[0],stroke:'#bd8d30','stroke-width':2,'stroke-linejoin':'round'}));}
 else{g.append(svg('ellipse',{cx:50,cy:70,rx:25,ry:18,fill:palette[0]}),svg('ellipse',{cx:36,cy:85,rx:10,ry:5,fill:palette[0]}),svg('ellipse',{cx:64,cy:85,rx:10,ry:5,fill:palette[0]}));
 if(id==='fox'){g.append(svg('path',{d:'M22 44L20 13L45 30M78 44L80 13L55 30',fill:palette[0],stroke:palette[0],'stroke-width':4,'stroke-linejoin':'round'}));}
 if(id==='bunny')for(const x of [36,64])g.append(svg('ellipse',{cx:x,cy:24,rx:10,ry:21,fill:palette[0]}),svg('ellipse',{cx:x,cy:24,rx:4,ry:13,fill:'#e9a3b5'}));
 if(id==='bear')for(const x of [27,73])g.append(svg('circle',{cx:x,cy:28,r:13,fill:palette[0]}),svg('circle',{cx:x,cy:28,r:7,fill:palette[1]}));
 if(['aries','taurus','capricorn'].includes(id)){for(const side of [-1,1])g.append(svg('path',{d:'M'+(50+side*20)+' 32 Q'+(50+side*42)+' 2 '+(50+side*12)+' 13 Q'+(50+side*32)+' 18 '+(50+side*20)+' 36',fill:palette[0],stroke:palette[0],'stroke-width':3}));}
 if(id==='leo')for(let i=0;i<12;i++){const a=i*Math.PI/6;g.append(svg('circle',{cx:50+29*Math.cos(a),cy:48+27*Math.sin(a),r:10,fill:palette[0]}));}
 if(id==='cancer')for(const side of [-1,1])g.append(svg('path',{d:'M'+(50+side*25)+' 60 Q'+(50+side*48)+' 48 '+(50+side*42)+' 32 L'+(50+side*30)+' 41 L'+(50+side*39)+' 48Z',fill:palette[0]}));
 if(id==='scorpio')g.append(svg('path',{d:'M70 75 Q97 63 80 43 L89 37',fill:'none',stroke:palette[0],'stroke-width':8,'stroke-linecap':'round'}));
 if(id==='pisces')g.append(svg('path',{d:'M26 69L6 58L8 80Z M74 69L94 58L92 80Z',fill:palette[0]}));
 g.append(svg('ellipse',{cx:50,cy:49,rx:31,ry:27,fill:palette[1]}));}
 for(const x of [39,61])g.append(svg('circle',{cx:x,cy:48,r:3.2,fill:'#202b25',class:'mascot-eye'}),svg('ellipse',{cx:x+(x<50?-8:8),cy:57,rx:5,ry:3,fill:'#eaa1a3',opacity:.8}));
 if(id==='duck')g.append(svg('ellipse',{cx:50,cy:58,rx:11,ry:5,fill:'#e59134'}));else g.append(svg('path',{d:'M44 59Q50 65 56 59',stroke:'#674e45','stroke-width':2,fill:'none','stroke-linecap':'round'}));
 if(id==='gemini'){g.append(svg('circle',{cx:15,cy:55,r:8,fill:palette[0]}),svg('circle',{cx:85,cy:55,r:8,fill:palette[0]}));}
 if(id==='virgo')g.append(svg('path',{d:'M50 23Q39 4 31 12Q32 27 50 23Q66 4 72 12Q67 27 50 23',fill:'#76a468'}));
 if(id==='libra')g.append(svg('path',{d:'M18 27H82 M28 27L20 43H36Z M72 27L64 43H80Z',stroke:'#8d7754','stroke-width':2,fill:'#e9ce88'}));
 if(id==='sagittarius')g.append(svg('path',{d:'M76 65Q95 45 76 25 M76 25V65 M69 45H94L88 39M94 45L88 51',stroke:'#9c6748','stroke-width':2.5,fill:'none','stroke-linecap':'round'}));
 if(id==='aquarius')g.append(svg('path',{d:'M15 30Q22 18 29 30T43 30 M57 30Q64 18 71 30T85 30',stroke:'#4d94c2','stroke-width':4,fill:'none','stroke-linecap':'round'}));
 if(zodiac){const badge=svg('text',{x:50,y:78,'text-anchor':'middle','font-size':15,fill:'#263c32','font-weight':700});badge.textContent=zodiac[2];g.append(badge);}
 if(['scarf','aurora'].includes(accessory))g.append(svg('path',{d:'M28 66Q50 75 72 66L70 75L58 79L62 89L52 87L48 77L30 74Z',fill:accessory==='aurora'?'#56b6aa':'#c75b62'}));
 if(accessory==='glasses'){for(const x of [39,61])g.append(svg('rect',{x:x-9,y:41,width:18,height:14,rx:5,fill:'none',stroke:'#33443d','stroke-width':2.5}));g.append(svg('path',{d:'M48 47H52',stroke:'#33443d','stroke-width':2.5}));}
 if(['crown','starlight'].includes(accessory))g.append(svg('path',{d:'M29 22L26 7L40 16L50 3L60 16L74 7L71 22Z',fill:accessory==='starlight'?'#c5adf5':'#f2c34a',stroke:'#a9771c','stroke-width':1.5}));
 if(accessory==='comet')g.append(svg('path',{d:'M68 66L72 73L80 74L74 79L75 87L68 83L61 87L62 79L56 74L64 73Z',fill:'#63b9ee',stroke:'#367ca6','stroke-width':1.5}));
 return n;
}
function profilePanel(target,p,editable=false){
 const wasZodiacOpen=target.querySelector('.zodiac-details')?.open??false;target.replaceChildren();const head=el('div',undefined,'passport-head'),info=el('div');info.append(el('h2',p.name),el('p',p.points+' lifetime points · '+p.rounds+' games','muted'));const celebrate=control('',()=>{const art=celebrate.querySelector('svg');if(!motion.matches){art.getAnimations().forEach(a=>a.cancel());art.animate([{transform:'scale(1)'},{transform:'translateY(-7px) rotate(-7deg) scale(1.08)'},{transform:'scale(1)'}],{duration:420,easing:'ease-out'});}feedback.textContent='✦ High five!';},'mascot-touch');celebrate.setAttribute('aria-label','High five mascot');celebrate.append(mascot(p.mascot,p.accessory));const feedback=el('span','','mascot-feedback');feedback.setAttribute('role','status');info.append(feedback);head.append(celebrate,info);target.append(head);
 const daily=el('div',undefined,'daily-card');daily.append(el('strong',p.daily.completed?'Daily challenge complete ✓':'Daily challenge · +25 points'),el('p',p.daily.completed?'Come back tomorrow (UTC).':'Complete a skill game with at least one valid answer, pair, bingo mark or charades guess.'));target.append(daily);
 const season=el('div',undefined,'daily-card');season.append(el('strong','Season '+p.season.month+' · '+p.season.points+' pts'),el('p','Skill-game points · monthly UTC competition'));target.append(season);if(p.season.previous.length)target.append(el('p',p.season.previous.map(x=>x.month+': '+x.points+' pts').join(' · '),'muted'));
 const acc=el('div',undefined,'accessories');target.append(el('h3','Accessories'));for(const a of p.accessories){const b=control(a.label+(a.id===p.accessory?' ✓':a.threshold&&!a.unlocked?' · '+a.threshold+' pts':''),()=>profileRequest({action:'profile_accessory',accessory:a.id}),'quiet');b.dataset.locked=String(!editable||!a.unlocked||a.id===p.accessory);b.disabled=b.dataset.locked==='true';b.setAttribute('aria-label',a.label+(a.unlocked?'':' locked'));acc.append(b);}target.append(acc);
 target.append(el('h3','Mascot collection'));const grid=el('div',undefined,'collectible-grid'),zg=el('div',undefined,'collectible-grid');const zodiacDetails=el('details',undefined,'zodiac-details');zodiacDetails.append(el('summary','Zodiac collection · '+p.collection.filter(m=>m.group==='zodiac'&&m.unlocked).length+'/12 unlocked'),zg);zodiacDetails.open=wasZodiacOpen;for(const m of p.collection){const tile=el('div',undefined,'collectible'+(m.unlocked?' unlocked':''));tile.append(mascot(m.id),el('strong',m.label),el('small',m.requirement),el('small',m.unlocked?'Unlocked':'Locked'));if(editable){const b=control(p.mascot===m.id?'Selected':'Equip',()=>profileRequest({action:'profile_mascot',mascot:m.id}));b.disabled=!m.unlocked||p.mascot===m.id;b.dataset.locked=String(b.disabled);tile.append(b);}(m.group==='zodiac'?zg:grid).append(tile);}target.append(grid,zodiacDetails);
 target.append(el('h3','Tournament history'));if(!p.history.length)target.append(el('p','Your completed tournaments will appear here.','muted'));for(const h of p.history){const row=el('div',undefined,'history-row');const text=el('div',undefined,'grow');text.append(el('strong',h.title),el('small',h.trophyName+' · '+h.completedAt.slice(0,10)));row.append(el('span',h.won?'🏆':'✦','history-icon'),text,el('strong',h.points+' pts'));target.append(row);}
 if(editable){const forget=control('Forget profile on this device',()=>{if(!confirm('Remove the saved profile credential? Without it, you cannot recover this profile.'))return;profileSecret=null;profile=null;try{localStorage.removeItem(profileKey);}catch{}drawEntryProfile();},'quiet');target.append(forget);}
}
function drawEntryProfile(){
 $('#passport-entry-label').textContent=profile?profile.name+' · '+profile.points+' pts':profileSecret?'Recover saved passport':'Optional';
 const content=$('#profile-content');if(!profile)content.replaceChildren();$('#profile-create').hidden=!!profileSecret;
 if(profile){$('#passport-entry-label').textContent=profile.name+' · '+profile.points+' pts';profilePanel(content,profile,true);}else if(profileSecret)content.append(el('p','Saved profile is unavailable. Retry or forget it.'),control('Retry profile',loadProfile,'quiet'),control('Forget profile',()=>{profileSecret=null;try{localStorage.removeItem(profileKey);}catch{}drawEntryProfile();},'quiet'));
 for(const form of [$('#create'),$('#join')]){const input=form.elements.name;input.readOnly=!!profile;if(profile)input.value=profile.name;}
 syncControls();
}
let lastProfileKey='',lastBoardKey='';
function drawRoomProfile(){const panel=$('#profile-room');panel.hidden=!state?.profile;if(state?.profile){profile=state.profile;$('#passport-points').textContent=profile.points+' pts';const key=state.roomId+JSON.stringify(profile);if(key!==lastProfileKey){lastProfileKey=key;profilePanel($('#profile-room-content'),profile);}}}
function drawSeason(){const list=$('#season-ranks');list.replaceChildren();$('#season-month').textContent=new Date(state.serverNow).toISOString().slice(0,7);for(const [i,p] of (state.season??[]).entries()){const row=el('div',undefined,'team-row');row.append(el('span',String(i+1),'rank'),el('span',name(p.id),'grow'),el('strong',String(p.points)+' pts'));list.append(row);}if(!list.children.length)list.append(el('p','No player passports in this room.','muted'));}
async function profileRequest(body){
 if(profileBusy||!available)return;profileBusy=true;syncControls();
 try{const res=await fetch('/api/rooms/command',{method:'POST',cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(6000),headers:{'Content-Type':'application/json',...(profileSecret?{Authorization:'Bearer '+profileSecret}:{})},body:JSON.stringify(body)});const d=await res.json();if(!res.ok||!d.profile)throw Error(d.error||'ROOM_UNAVAILABLE');if(d.profileCredential){profileSecret=d.profileCredential;try{localStorage.setItem(profileKey,profileSecret);}catch{say('Browser storage unavailable; this profile cannot be recovered after closing the page.');}}profile=d.profile;drawEntryProfile();}
 catch(e){say(safeErrors[e.message]??'Profile service unavailable.');drawEntryProfile();}finally{profileBusy=false;syncControls();}
}
const loadProfile=()=>profileRequest({action:'profile_state'});
$('#profile-create').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;if(!form.elements.remember.checked)return;profileRequest({action:'profile_create',name:form.elements.name.value});});

function drawQR(){
 const target=$('#qr');target.replaceChildren();
 if(!state.qr)return;
 const q=state.qr,n=svg('svg',{viewBox:'0 0 '+q.size+' '+q.size,role:'img','aria-label':'Room invitation QR code','shape-rendering':'crispEdges'});
 n.append(svg('rect',{width:q.size,height:q.size,fill:'#fff'}),svg('path',{d:q.path,fill:'#0b1711'}));target.append(n);$('#code').textContent=state.invite;
}
function drawBoard(){
 $('#count').textContent=state.players.filter(p=>!p.departed).length+' / 12';
 const teams=$('#teams');teams.replaceChildren();
 for(const t of [...state.teams].sort((a,b)=>(b.average??-1)-(a.average??-1))){
  const n=el('div',undefined,'team-row'),d=el('span',undefined,'dot '+t.team),info=el('div',undefined,'grow');
  info.append(el('strong',t.team==='jade'?'Jade team':'Amber team'),el('div',t.count+' players · '+t.total+' total pts','muted'));
  n.append(d,info,el('span',t.average===null?'—':String(t.average),'score'));teams.append(n);
 }
 const list=$('#players');list.replaceChildren();
 [...state.players].sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)).forEach((p,i)=>{
  const n=el('div',undefined,'player'+(p.badges.includes('Gold frame')?' gold':'')),info=el('div',undefined,'grow');
  info.append(el('strong',p.name+(p.id===state.me?' · You':'')+(p.departed?' · Left':'')),el('div',(p.team==='jade'?'Jade':'Amber')+' · '+p.rounds+' rounds','muted'));
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
 stage.append(el('p','Race world · '+(q.theme??'pond'),'world-label'));const tracks=[];
 for(const id of q.participants){
  stage.append(el('div',name(id),'track-label'));const track=el('div',undefined,'race-track theme-'+(q.theme??'pond')),duck=el('div',undefined,'duck');
  const palette=skins[state.players.find(p=>p.id===id)?.skin]??skins.classic;
  const sprite=svg('svg',{viewBox:'0 0 58 44',width:50,height:38,'aria-hidden':'true'});
  sprite.append(svg('ellipse',{cx:24,cy:27,rx:21,ry:13,fill:palette[0],stroke:palette[2],'stroke-width':1.3}),svg('path',{d:'M6 23L0 14L18 23',fill:palette[3],stroke:palette[2],'stroke-width':1.3}),svg('circle',{cx:40,cy:14,r:13,fill:palette[1],stroke:palette[2],'stroke-width':1.3}),svg('path',{d:'M48 16L58 19L48 23Z',fill:'#e57c28'}),svg('circle',{cx:44,cy:11,r:2.3,fill:'#16251b'}),svg('path',{d:'M14 27Q24 39 34 26Q24 29 14 27Z',fill:palette[3]}));
  const bob=el('span');bob.append(sprite);duck.append(bob);track.append(duck);stage.append(track);tracks.push({id,track,duck});
 }
 visual={type:'race',tracks};
}

const inkColors={ink:'#233d33',jade:'#14865f',rose:'#d65880',gold:'#d49328'};
function drawSurface(q,canDraw){
 const surface=svg('svg',{viewBox:'0 0 1000 1000',class:'drawing-surface',role:canDraw?'application':'img','aria-label':canDraw?'Drawing board. Use pointer or arrow keys, then Enter to draw.':'Shared drawing board'});surface.dataset.strokes=String(q.strokes.length);surface.append(svg('rect',{x:0,y:0,width:1000,height:1000,fill:'transparent','pointer-events':'all'}));
 const line=(points,color)=>svg('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:inkColors[color],'stroke-width':12,'stroke-linecap':'round','stroke-linejoin':'round'});
 for(const stroke of q.strokes)surface.append(line(stroke.points,stroke.color));stage.append(surface);
 if(!canDraw||q.strokes.length>=32)return;
 surface.setAttribute('tabindex','0');let pointer=null,points=[],preview=null;if(keyboardRound!==q.id){keyboardRound=q.id;keyboardCursor=[500,500];}let cursor=[...keyboardCursor];
 const marker=svg('circle',{cx:cursor[0],cy:cursor[1],r:12,fill:'none',stroke:'#a67e28','stroke-width':4,class:'drawing-cursor'});surface.append(marker);
 const palette=el('div',undefined,'ink-palette');for(const color of Object.keys(inkColors)){const b=control(color,()=>{drawColor=color;for(const x of palette.children)x.setAttribute('aria-pressed',String(x.dataset.ink===color));});b.dataset.ink=color;b.style.setProperty('--ink-color',inkColors[color]);b.setAttribute('aria-pressed',String(drawColor===color));palette.append(b);}stage.append(palette,el('p',q.strokes.length+'/32 strokes · draw with touch, mouse, or arrow keys + Enter','muted'));
 const getPoint=e=>{const box=surface.getBoundingClientRect();return [Math.max(0,Math.min(1000,Math.round((e.clientX-box.left)/box.width*1000))),Math.max(0,Math.min(1000,Math.round((e.clientY-box.top)/box.height*1000)))];};
 const sendStroke=pts=>{if(!pendingStroke&&state?.round?.id===q.id&&pts.length>=2){pendingStroke={roomId:state.roomId,roundId:q.id,index:q.strokes.length,color:drawColor,points:pts.map(p=>[...p])};flushStroke();}};
 surface.addEventListener('pointerdown',e=>{if(pendingStroke||drawActive||e.button!==0||state?.phase!=='playing'||state?.round?.id!==q.id)return;e.preventDefault();drawActive=true;pointer=e.pointerId;surface.setPointerCapture(pointer);points=[getPoint(e)];preview=line(points,drawColor);surface.append(preview);});
 surface.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||points.length>=32)return;const p=getPoint(e);const last=points.at(-1);if(Math.hypot(p[0]-last[0],p[1]-last[1])<8)return;points.push(p);preview.setAttribute('points',points.map(p=>p.join(',')).join(' '));});
 const end=(e,cancel)=>{if(e.pointerId!==pointer)return;pointer=null;drawActive=false;if(preview)preview.remove();if(!cancel){if(points.length<32)points.push(getPoint(e));sendStroke(points);}points=[];};
 surface.addEventListener('pointerup',e=>end(e,false));surface.addEventListener('pointercancel',e=>end(e,true));surface.addEventListener('lostpointercapture',e=>end(e,true));
 surface.addEventListener('keydown',e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter'].includes(e.key))return;e.preventDefault();if(pendingStroke||drawActive||state?.phase!=='playing'||state?.round?.id!==q.id)return;const old=[...cursor];if(e.key==='Enter'){sendStroke([old,[Math.min(1000,old[0]+25),old[1]]]);return;}cursor=[Math.max(0,Math.min(1000,cursor[0]+(e.key==='ArrowLeft'?-50:e.key==='ArrowRight'?50:0))),Math.max(0,Math.min(1000,cursor[1]+(e.key==='ArrowUp'?-50:e.key==='ArrowDown'?50:0)))];keyboardCursor=[...cursor];marker.setAttribute('cx',cursor[0]);marker.setAttribute('cy',cursor[1]);if(e.shiftKey)sendStroke([old,cursor]);});
}

function renderStage(){
 if(drawActive)return;const keepDrawingFocus=document.activeElement?.classList.contains('drawing-surface');const oldGuess=stage.querySelector('input[name=guess]');const draftGuess=oldGuess?.value??'',hadFocus=document.activeElement===oldGuess;stopVisual();visual=null;stage.replaceChildren();const s=state,q=s.round;
 if(s.phase==='lobby'){
  heading('Ready for game time?',s.host?'Choose a game once at least two players are in the room.':'Waiting for your host to choose a game.');
  const grid=el('div',undefined,'game-grid');for(const [game,symbol] of [['wheel','✦'],['race','🦆'],['trivia','?'],['memory','◆'],['bingo','▦'],['charades','✋'],['drawing','✎'],['custom_trivia','✦']]){
   const b=control(gameName[game],()=>cmd('start',{game,version:state.version}),'game');b.prepend(el('span',symbol));b.dataset.locked=String(!s.host||s.players.length<2||(game==='custom_trivia'&&(s.customCount!==5||s.tournament?.status==='active')));b.disabled=b.dataset.locked==='true';grid.append(b);
  }stage.append(grid,el('p','Scores survive reconnects until the room closes or expires.','muted'));return;
 }
 heading(gameName[q.game],['trivia','custom_trivia'].includes(q.game)?'Question '+(q.index+1)+' of 5 · everyone answers independently':s.phase==='playing'?'One shared draw, one shared result.':'Round complete');
 if(q.game==='wheel')wheel(q);
 if(q.game==='race')race(q);
 if(['charades','drawing'].includes(q.game)){
  const actor=q.actor===s.me;stage.append(el('p',q.game==='drawing'?(actor?'Draw the secret word. Do not write the answer.':name(q.actor)+' is drawing. Guess the word.'):(actor?'You are the actor. Act out the prompt without speaking.':name(q.actor)+' is acting. Watch in person or on your team call.')));if(q.prompt)stage.append(el('div',q.prompt.toUpperCase(),'charades-prompt'));if(q.game==='drawing'){drawSurface(q,actor&&s.phase==='playing');if(keepDrawingFocus&&actor&&s.phase==='playing')stage.querySelector('.drawing-surface')?.focus({preventScroll:true});}
  const timer=el('div',undefined,'timer'),bar=el('span');timer.append(bar);stage.append(timer);visual={type:'timer',bar};
  if(!actor&&s.phase==='playing'){const form=el('form',undefined,'charades-form'),input=el('input');input.name='guess';input.maxLength=32;input.required=true;input.pattern='[A-Za-z ]{1,32}';input.autocomplete='off';input.placeholder='Your guess';input.setAttribute('aria-label','Your guess');input.value=draftGuess;const b=el('button','Guess');b.dataset.locked=String(q.guesses>=12);form.append(input,b);form.addEventListener('submit',e=>{e.preventDefault();const value=input.value.trim();if(value){input.value='';cmd('charades_guess',{roundId:q.id,guess:value});}});stage.append(form,el('p',q.guesses+' / 12 guesses · wait 1.2 seconds between guesses','muted'));if(hadFocus)input.focus();}
 }
 if(q.game==='bingo'){
  const calls=el('div',undefined,'bingo-calls');calls.append(el('span','LATEST CALL','eyebrow'),el('strong',q.calls.length?String(q.calls.at(-1)):'—','bingo-number'),el('span',q.calls.length+' / 75 numbers','muted'));stage.append(calls);
  const recent=el('div',undefined,'bingo-recent');for(const v of q.calls.slice(-12))recent.append(el('span',String(v)));stage.append(recent);
  const grid=el('div',undefined,'bingo-grid');q.board.forEach((v,i)=>{const marked=i===12||q.marks.includes(i),called=q.calls.includes(v);const b=control(i===12?'FREE':String(v),()=>cmd('bingo_mark',{roundId:q.id,card:i}),'bingo-cell'+(marked?' marked':called?' called':''));b.setAttribute('aria-label',i===12?'Free space':'Number '+v+(marked?' marked':called?' called':' not called'));b.dataset.locked=String(s.phase!=='playing'||marked||!called);grid.append(b);});stage.append(grid,el('p','Mark called numbers. Complete any row, column or diagonal.','muted'));
 }
 if(q.game==='memory'){
  stage.append(el('p','','memory-progress'));const grid=el('div',undefined,'memory-grid');grid.dataset.round=q.id;
  q.cards.forEach((_,i)=>{const b=control('?',()=>queueFlip(q.id,i),'memory-card');grid.append(b);});stage.append(grid);updateMemoryBoard(q,s.phase);const timer=el('div',undefined,'timer'),bar=el('span');timer.append(bar);stage.append(timer);visual={type:'timer',bar};
 }
 if(['trivia','custom_trivia'].includes(q.game)){
  if(q.game==='custom_trivia')stage.append(el('p','Practice only · no points or tournament credit','world-label'));
  stage.append(el('div',q.question,'question'));const timer=el('div',undefined,'timer'),bar=el('span');timer.append(bar);stage.append(timer);visual={type:'timer',bar};
  const answers=el('div',undefined,'answers');q.options.forEach((v,i)=>{const b=control(String(v),()=>cmd('answer',{roundId:q.id,index:q.index,choice:i}),s.phase!=='playing'&&q.answer===i?'correct':'');b.dataset.locked=String(s.phase!=='playing'||q.answered);b.disabled=b.dataset.locked==='true';answers.append(b);});stage.append(answers,el('p',q.answerCount+' / '+s.players.length+' answered'+(q.answered&&s.phase==='playing'?' · Answer saved':'')));
  if(s.phase!=='playing')stage.append(el('div','Correct answer: '+q.options[q.answer]+(q.selected===q.answer?' · Nice work!':''),'result'));
  if(s.phase==='reveal'&&s.host)stage.append(control('Next question',()=>cmd('next',{roundId:q.id,index:q.index}),'stage-action'));
 }
 if(s.phase==='finished'){
  stage.append(el('div',q.game==='custom_trivia'?'Custom trivia complete · practice only':q.game==='drawing'?(q.winner?'Draw & guess! '+name(q.winner)+' guessed correctly':'Drawing complete · time up'):q.game==='trivia'?'Trivia complete · scores updated':q.game==='memory'?'Memory match complete · scores updated':q.game==='charades'?(q.winner?'Charades! '+name(q.winner)+' guessed correctly':'Charades complete · time up'):q.game==='bingo'?(q.winner?'Bingo! '+name(q.winner)+' wins!':'Bingo complete · no winner'):'🏆 '+name(q.winner)+' wins!','result'));
  if(q.game==='race'){const podium=el('div',undefined,'podium');for(const [i,id] of q.order.slice(0,3).entries()){const p=el('div',undefined,'podium-step');p.append(el('strong',String(i+1)),el('span',name(id)));podium.append(p);}stage.append(podium);}
  if(s.host)stage.append(control('Back to lobby',()=>cmd('lobby',{version:state.version}),'stage-action'));
 }
 if(s.phase==='reveal'&&!s.host)stage.append(el('p','Waiting for the host to continue.','muted'));
 animate();
}
function stopVisual(){
 if(raf)cancelAnimationFrame(raf);raf=0;stage.classList.remove('motion-running');
}
function animate(){
 if(raf)cancelAnimationFrame(raf);raf=0;
 if(!visual||!state?.round||document.hidden){stage.classList.remove('motion-running');return;}
 const q=state.round,t=now(),progress=Math.max(0,Math.min(1,(t-q.startsAt)/(q.endsAt-q.startsAt))),done=state.phase!=='playing',reduced=motion.matches,running=!done&&progress<1&&!reduced;
 if(visual.type==='wheel'){const p=done?1:reduced?0:1-(1-progress)**4;visual.rotor.setAttribute('transform','rotate('+visual.target*p+' 150 150)');}
 if(visual.type==='race')for(const {id,duck} of visual.tracks){const p=done?1:reduced?0:Math.max(0,Math.min(1,(t-q.startsAt)/q.finish[id]));duck.style.transform='translateX('+p*100+'%)';}
 if(visual.type==='timer')visual.bar.style.transform='scaleX('+(done?0:1-progress)+')';
 if(stage.classList.contains('motion-running')!==running)stage.classList.toggle('motion-running',running);
 if(running)raf=requestAnimationFrame(animate);
}

let customKey='';
function drawCreative(){
 const panel=$('#creative-panel');panel.hidden=!(state.host&&state.phase==='lobby');if(panel.hidden){customKey='';return;}
 const key=state.roomId+':'+state.customCount+':'+state.raceTheme;if(key===customKey)return;customKey=key;
 const open=panel.querySelector('details.game-settings')?.open??false;panel.replaceChildren();const settings=el('details',undefined,'game-settings');settings.open=open;settings.append(el('summary','Game settings · '+state.raceTheme));panel.append(settings);const worlds=el('div',undefined,'world-grid');
 for(const theme of ['pond','space','garden']){const b=control(theme,()=>cmd('race_theme',{version:state.version,theme}),'world-choice theme-'+theme);b.setAttribute('aria-label',theme+' race world');b.setAttribute('aria-pressed',String(state.raceTheme===theme));worlds.append(b);}settings.append(worlds);
 const details=el('details',undefined,'custom-editor');details.append(el('summary','Custom trivia · '+state.customCount+'/5'));details.open=state.customCount>0&&state.customCount<5;
 const form=el('form');const question=el('input');question.required=true;question.maxLength=100;question.placeholder='Question';question.setAttribute('aria-label','Custom question');form.append(question);const options=[];
 for(let i=0;i<4;i++){const input=el('input');input.maxLength=48;input.required=true;input.placeholder='Answer '+(i+1);input.setAttribute('aria-label','Answer '+(i+1));options.push(input);form.append(input);}
 const answer=el('select');answer.setAttribute('aria-label','Correct answer');for(let i=0;i<4;i++)answer.append(new Option('Correct: '+(i+1),String(i)));form.append(answer);const save=el('button','Save question');save.dataset.locked=String(state.customCount>=5);form.append(save);form.addEventListener('submit',e=>{e.preventDefault();cmd('custom_question',{version:state.version,text:question.value,options:options.map(x=>x.value),answer:Number(answer.value)});});details.append(el('p','Five questions · practice only · no scores'),form,control('Clear question set',()=>cmd('custom_clear',{version:state.version}),'quiet'));settings.append(details);
}

function drawExtras(){
 drawCreative();
 const panel=$('#tournament-panel'),t=state.tournament;const setupOpen=panel.querySelector('.tournament-setup')?.open??false;const draftTitle=panel.querySelector('input')?.value??'',draftTrophyName=panel.querySelector('[aria-label="Custom trophy name"]')?.value??'',draftTrophy=panel.querySelector('select')?.value??'Huddle cup';panel.hidden=!(t||state.host&&state.phase==='lobby');panel.replaceChildren();if(!panel.hidden){panel.append(el('h2',t?t.title:'Start a tournament'),el('p',t?t.completed+' / 3 rounds · '+(t.trophyName??t.trophy):'Three games. One friendly competition.'));if(t){for(const x of [...t.scores].sort((a,b)=>b.points-a.points)){const r=el('div',undefined,'team-row');r.append(el('span',name(x.id),'grow'),el('strong',String(x.points)));panel.append(r);}if(t.status==='finished')panel.append(el('div','🏆 '+t.winners.map(name).join(' & ')+' · '+(t.trophyName??t.trophy),'result'));}if(state.host&&state.phase==='lobby'&&t?.status!=='active'){const form=el('form'),title=el('input');title.maxLength=32;title.required=true;title.value=draftTitle;title.placeholder='Friday team cup';title.setAttribute('aria-label','Tournament title');const trophy=el('select');trophy.setAttribute('aria-label','Trophy style');for(const label of ['Huddle cup','Star trophy','Golden duck'])trophy.append(new Option(label,label));trophy.value=draftTrophy;const custom=el('input');custom.maxLength=32;custom.placeholder='Optional trophy name';custom.value=draftTrophyName;custom.setAttribute('aria-label','Custom trophy name');const b=el('button','Create tournament');form.append(title,trophy,custom,b);form.addEventListener('submit',e=>{e.preventDefault();cmd(custom.value.trim()?'tournament_custom':'tournament',{version:state.version,title:title.value,trophy:trophy.value,...(custom.value.trim()?{trophyName:custom.value.trim()}:{})});});const setup=el('details',undefined,'tournament-setup');setup.open=setupOpen;setup.append(el('summary','Tournament setup'),form);panel.append(setup);}}
 const skinPanel=$('#skin-panel'),grid=$('#skins');skinPanel.hidden=state.phase!=='lobby';grid.replaceChildren();if(!skinPanel.hidden){for(const [key,palette] of Object.entries(skins)){const b=control(key,()=>cmd('skin',{skin:key}),'skin-choice');const dot=el('span','🦆');dot.style.background=palette[1];dot.setAttribute('aria-hidden','true');b.setAttribute('aria-label',key);b.prepend(dot);b.setAttribute('aria-pressed',String(state.players.find(p=>p.id===state.me)?.skin===key));grid.append(b);}}
}
function render(){
 $('#room').dataset.version=String(state.version);
 $('#entry').hidden=true;$('#room').hidden=false;$('#role').textContent=state.host?'Host':'Player';$('#heading').textContent='Live room';$('#subheading').textContent=state.players.filter(p=>!p.departed).length+' teammates · '+(state.phase==='lobby'?'Lobby open':state.phase==='playing'?'Game in progress':'Round results');
 $('#exit').textContent=state.host?'Close room':'Leave room';
 const show=state.host&&state.phase==='lobby';
 $('#invite-panel').hidden=!show;
 const key=state.roomId+':'+state.version+':'+state.me+':'+JSON.stringify(state.season??[])+':'+(state.round?.game==='memory'?JSON.stringify(state.round.cards)+state.round.locked:state.round?.game==='bingo'?state.round.calls.length:'')+':'+(state.profile?JSON.stringify(state.profile):'');
 if(key!==renderedKey){
  renderedKey=key;const boardKey=state.roomId+':'+state.version+':'+JSON.stringify(state.season??[]);
  if(boardKey!==lastBoardKey){lastBoardKey=boardKey;drawBoard();drawSeason();if(show)drawQR();drawExtras();}
  const q=state.round,localKey=q?.game==='memory'?JSON.stringify([state.roomId,q.id,state.phase,q.turn,q.cards,q.locked,q.complete]):key;
  if(q?.game!=='memory'||localKey!==stageKey){
   const sameMemory=q?.game==='memory'&&state.phase==='playing'&&stage.querySelector('.memory-grid')?.dataset.round===q.id&&!stage.querySelector('.result');
   if(sameMemory)updateMemoryBoard(q,state.phase);else renderStage();
   stageKey=localKey;
  }
  drawRoomProfile();
 }
 if(motion.matches&&visual)animate();
 syncControls();

}

for(const form of [$('#create'),$('#join')])form.addEventListener('submit',e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));if(profileSecret&&!profile){say('Recover or forget your saved profile first.');return;}if(profile&&profileSecret){const {name:ignored,...rest}=data;send({action:form.id+'_profile',...rest},profileSecret);}else send({action:form.id,...data});});
$('#exit').addEventListener('click',()=>{if(!state)return;if(state.host){if(confirm('Close this room for everyone?'))cmd('close');}else if(confirm('Leave this room? Your seat will be released now or after the active round. Completed profile rewards are retained.'))cmd('leave');});
$('#copy').addEventListener('click',async()=>{if(!state?.invite)return;const link=location.origin+'/rooms/#join='+state.invite;try{await navigator.clipboard.writeText(link);say('Invitation copied.');}catch{say('Copy the invitation code shown above, or scan the QR.');}});
function entryMode(mode){
 const host=mode==='host';$('#create').hidden=!host;$('#join').hidden=host;$('#host-mode').setAttribute('aria-pressed',String(host));$('#join-mode').setAttribute('aria-pressed',String(!host));
}
$('#host-mode').addEventListener('click',()=>entryMode('host'));$('#join-mode').addEventListener('click',()=>entryMode('join'));
const invite=/^#join=([a-f0-9]{32})$/.exec(location.hash)?.[1];
const savedAtEntry=readSession();if(savedAtEntry){credential=savedAtEntry.credential;resumeId=savedAtEntry.roomId;}
if(invite){entryMode('join');$('#join input[name=invite]').value=invite;history.replaceState(null,'',location.pathname);if(!savedAtEntry)$('#join input[name=name]').focus();}
async function health(){if(healthBusy)return;healthBusy=true;lastHealth=Date.now();try{const res=await fetch('/api/rooms/health',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(3000)});const d=await res.json();if(!res.ok||d.available!==true)throw Error();available=true;connected('Staging room service');say('');}catch{available=false;connected('Preview only');say('Room service is unavailable in this preview.');}healthBusy=false;syncControls();if(available&&profileSecret)await loadProfile();if(available&&resumeId&&credential&&!state)await send({action:'state',roomId:resumeId});}
interval=setInterval(()=>{if(!busy&&!drawActive&&!pendingStroke&&!pendingFlip&&!document.hidden){if(state)cmd('state');else if(resumeId&&available)send({action:'state',roomId:resumeId});else if(!available&&Date.now()-lastHealth>5000)health();}},1000);
document.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('motion-paused',document.hidden);if(document.hidden)stopVisual();else if(state){if(!drawActive)cmd('state');animate();}});
motion.addEventListener('change',()=>animate());
window.addEventListener('pagehide',()=>{clearInterval(interval);epoch++;drawActive=false;pendingStroke=null;pendingFlip=null;requestAction=null;stopVisual();credential=null;state=null;});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
drawEntryProfile();health();
