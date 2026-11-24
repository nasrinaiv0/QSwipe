import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomService} from '../lib/rooms/service.mjs';
import {createRoomHttpServer} from '../lib/rooms/http.mjs';
function fixture(options={}){
 let t=100000;const service=createRoomService({now:()=>t,rand:n=>n-1,...options});
 const host=service.command({action:'create',name:'Alex',team:'jade'}),id=host.state.roomId;
 const guest=service.command({action:'join',invite:host.state.invite,name:'Jamie',team:'amber'});
 const run=(action,extra={},who=host)=>service.command({action,roomId:id,...extra},who.credential).state;
 return {service,host,guest,run,advance:n=>{t+=n;}};
}
const rejected=(f,code)=>assert.throws(f,e=>e.code===code);
test('room credentials, invitations, capacity and host-only actions',()=>{
 const {service,host,guest,run}=fixture();
 assert.equal(guest.state.invite,undefined);assert.equal(guest.state.host,false);
 assert.notEqual(host.credential,guest.credential);
 assert.equal(run('state',{},guest).players.length,2);
 rejected(()=>service.command({action:'state',roomId:host.state.roomId},'0'.repeat(64)),'ROOM_ACCESS_DENIED');
 rejected(()=>run('start',{game:'wheel',version:run('state').version},guest),'HOST_ONLY');
 rejected(()=>service.command({action:'join',invite:host.state.invite,name:'Jamie',team:'jade'}),'NAME_TAKEN');
 rejected(()=>service.command({action:'join',invite:'a'.repeat(32),name:'Unknown',team:'jade'}),'INVITE_EXPIRED');
 const other=service.command({action:'create',name:'Other',team:'jade'});
 rejected(()=>service.command({action:'state',roomId:other.state.roomId},host.credential),'ROOM_ACCESS_DENIED');
 for(let i=0;i<10;i++)service.command({action:'join',invite:host.state.invite,name:'Player '+i,team:'jade'});
 rejected(()=>service.command({action:'join',invite:host.state.invite,name:'Overflow',team:'jade'}),'ROOM_NOT_JOINABLE');
});
test('synchronized wheel and race settle exactly once and share rankings',()=>{
 const {host,guest,run,advance}=fixture();
 let s=run('start',{game:'wheel',version:run('state').version});
 assert.equal(s.phase,'playing');assert.deepEqual(run('state',{},guest).round,s.round);
 advance(5501);s=run('state');assert.equal(s.phase,'finished');assert.equal(s.players.reduce((n,p)=>n+p.points,0),20);
 assert.equal(run('state',{},guest).players.reduce((n,p)=>n+p.points,0),20);
 assert.equal(s.players.find(p=>p.id===s.round.winner).wins,1);
 s=run('lobby',{version:s.version});s=run('start',{game:'race',version:s.version});
 assert.deepEqual(run('state',{},guest).round.order,s.round.order);
 assert.equal(s.round.finish[s.round.order[0]],3500);
 advance(5501);s=run('state');assert.equal(s.players.reduce((n,p)=>n+p.points,0),40);
 assert.equal(s.players.reduce((n,p)=>n+p.rounds,0),4);
 assert.ok(s.players.find(p=>p.id===host.state.me).badges.includes('Lucky star'));
});
test('trivia answer key is withheld, duplicate and stale answers cannot award extra points',()=>{
 const {run,guest}=fixture();let s=run('start',{game:'trivia',version:run('state').version});
 for(let i=0;i<5;i++){
  assert.equal(s.round.answer,undefined);assert.equal(s.round.index,i);
  const q=s.round,correct=q.options.indexOf(38),wrong=(correct+1)%4;
  s=run('answer',{roundId:q.id,index:i,choice:correct});
  assert.equal(s.round.answered,true);assert.equal(s.round.answer,undefined);
  assert.equal(run('answer',{roundId:q.id,index:i,choice:correct}).version,s.version);
  rejected(()=>run('answer',{roundId:q.id,index:i,choice:wrong}),'ALREADY_ANSWERED');
  const g=run('answer',{roundId:q.id,index:i,choice:wrong},guest);
  assert.equal(g.round.answer,correct);s=run('state');assert.equal(s.phase,i===4?'finished':'reveal');
  rejected(()=>run('answer',{roundId:q.id,index:i,choice:correct}),'QUESTION_CLOSED');
  if(i<4){rejected(()=>run('next',{roundId:q.id,index:i},guest),'HOST_ONLY');s=run('next',{roundId:q.id,index:i});}
 }
 assert.deepEqual(s.players.map(p=>p.points),[60,10]);assert.equal(s.players[0].perfect,1);
 assert.deepEqual(s.teams.map(x=>x.average),[60,10]);
 assert.equal(run('state').players[0].points,60);
});
test('deadlines, expiry and room limits fail closed',()=>{
 const {service,host,guest,run,advance}=fixture({maxRooms:1,ttl:100000});
 rejected(()=>service.command({action:'create',name:'Other',team:'jade'}),'ROOM_LIMIT');
 let s=run('start',{game:'trivia',version:run('state').version});advance(20001);
 s=run('state');assert.equal(s.phase,'reveal');assert.equal(s.players.reduce((n,p)=>n+p.points,0),0);
 rejected(()=>run('answer',{roundId:s.round.id,index:0,choice:0},guest),'QUESTION_CLOSED');
 advance(100000);rejected(()=>run('state'),'ROOM_ACCESS_DENIED');
 rejected(()=>service.command({action:'join',invite:host.state.invite,name:'New',team:'jade'}),'INVITE_EXPIRED');
});
test('HTTP validates same-origin JSON and returns host-only QR, no-store credentials',async()=>{
 const server=createRoomHttpServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 try{
  const post=(body,extra={})=>fetch(origin+'/api/rooms/command',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
  assert.equal((await fetch(origin+'/api/rooms/health')).status,200);
  assert.equal((await post({action:'create',name:'Host',team:'jade'},{Origin:'https://invalid.example'})).status,403);
  const response=await post({action:'create',name:'Host',team:'jade'});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const host=await response.json();assert.match(host.credential,/^[0-9a-f]{64}$/);assert.ok(host.state.qr.path.length>100);
  const g=await(await post({action:'join',invite:host.state.invite,name:'Guest',team:'amber'})).json();
  assert.equal(g.state.qr,undefined);assert.equal(g.state.invite,undefined);
  assert.equal((await post({action:'state',roomId:host.state.roomId})).status,403);
  assert.equal((await post({action:'close',roomId:host.state.roomId},{Authorization:'Bearer '+g.credential})).status,403);
  assert.equal((await post({action:'close',roomId:host.state.roomId},{Authorization:'Bearer '+host.credential})).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
