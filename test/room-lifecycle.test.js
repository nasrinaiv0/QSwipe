import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoomService} from '../lib/rooms/service.mjs';
import {createFileStore,createPersistentRoomService} from '../lib/rooms/persistence.mjs';
test('lobby leave reclaims a name and invalidates the old bearer; host still must close',()=>{
 const s=createRoomService(),h=s.command({action:'create',name:'Host',team:'jade'}),roomId=h.state.roomId;
 const g=s.command({action:'join',invite:h.state.invite,name:'Guest',team:'amber'});
 assert.throws(()=>s.command({action:'leave',roomId},h.credential),{code:'HOST_MUST_CLOSE'});
 assert.throws(()=>s.command({action:'leave',roomId},'0'.repeat(64)),{code:'ROOM_ACCESS_DENIED'});
 assert.deepEqual(s.command({action:'leave',roomId},g.credential),{left:true});
 assert.deepEqual(s.command({action:'leave',roomId},g.credential),{left:true});
 assert.throws(()=>s.command({action:'state',roomId},g.credential),{code:'ROOM_ACCESS_DENIED'});
 const next=s.command({action:'join',invite:h.state.invite,name:'Guest',team:'amber'});
 assert.notEqual(next.credential,g.credential);assert.notEqual(next.state.me,g.state.me);assert.equal(next.state.players.length,2);
});
test('concurrent persisted leave during a round preserves settlement and cancels unfinished tournament',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qs-lifecycle-')),path=join(dir,'rooms.json');let t=100000;
 const options={now:()=>t,rand:n=>n-1};let s=createPersistentRoomService(createFileStore(path),options);
 try{
  const h=await s.command({action:'create',name:'Host',team:'jade'}),roomId=h.state.roomId;
  const a=await s.command({action:'join',invite:h.state.invite,name:'A',team:'amber'}),b=await s.command({action:'join',invite:h.state.invite,name:'B',team:'jade'});
  const run=async(action,extra={},who=h)=>(await s.command({action,roomId,...extra},who.credential)).state;
  let state=await run('tournament',{version:b.state.version,title:'Test cup',trophy:'Golden duck'});
  state=await run('start',{version:state.version,game:'memory'});
  const roundId=state.round.id;
  await Promise.all([s.command({action:'leave',roomId},a.credential),run('flip',{roundId,turn:0,card:0},b)]);
  await assert.rejects(()=>run('state',{},a),{code:'ROOM_ACCESS_DENIED'});
  await assert.rejects(()=>run('flip',{roundId,turn:0,card:0},a),{code:'ROOM_ACCESS_DENIED'});
  s=createPersistentRoomService(createFileStore(path),options);
  state=await run('state');assert.equal(state.players.find(x=>x.id===a.state.me).departed,true);assert.equal(state.tournament,null);
  assert.equal(state.round.participants.length,3);assert.equal((await run('state',{},b)).round.turn,1);
  await run('flip',{roundId,turn:1,card:8},b);t+=60001;
  state=await run('state');assert.equal(state.phase,'finished');assert.equal(state.players.find(x=>x.id===b.state.me).points,5);
  assert.equal((await run('state')).players.find(x=>x.id===b.state.me).points,5);
  state=await run('lobby',{version:state.version});assert.equal(state.players.length,2);
  const fresh=await s.command({action:'join',invite:h.state.invite,name:'A',team:'amber'});assert.equal(fresh.state.players.length,3);
  assert.deepEqual(await s.command({action:'leave',roomId},a.credential),{left:true});
  assert.equal((await run('state')).players.length,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});
