import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoomService} from '../lib/rooms/service.mjs';
import {createFileStore,createPersistentRoomService} from '../lib/rooms/persistence.mjs';
import {bingoLine} from '../lib/rooms/collection.mjs';
test('profile isolation, bingo, daily reward, custom tournament history and restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qs-passport-')),path=join(dir,'state.json');let t=Date.UTC(2026,10,24,1);const opt={now:()=>t,rand:n=>n-1};
 try{let svc=createPersistentRoomService(createFileStore(path),opt);
 const a=await svc.command({action:'profile_create',name:'Alex'}),b=await svc.command({action:'profile_create',name:'Jamie'});
 await assert.rejects(()=>svc.command({action:'profile_state'},'0'.repeat(64)),{code:'PROFILE_DENIED'});
 await assert.rejects(()=>svc.command({action:'profile_mascot',mascot:'star'},a.profileCredential),{code:'MASCOT_LOCKED'});
 const host=await svc.command({action:'create_profile',team:'jade'},a.profileCredential),roomId=host.state.roomId;
 const guest=await svc.command({action:'join_profile',team:'amber',invite:host.state.invite},b.profileCredential);
 await assert.rejects(()=>svc.command({action:'join_profile',team:'amber',invite:host.state.invite},a.profileCredential),{code:'NAME_TAKEN'});
 const run=async(action,extra={},who=host)=>(await svc.command({action,roomId,...extra},who.credential)).state;
 let s=await run('tournament_custom',{version:guest.state.version,title:'Team Cup',trophy:'Golden duck',trophyName:'Orion Champion'});
 for(let i=0;i<3;i++){
  s=await run('start',{version:s.version,game:'bingo'});const roundId=s.round.id;
  assert.equal(s.round.board.length,25);assert.equal(s.round.boards,undefined);assert.equal(s.round.draw,undefined);
  assert.equal(s.players[0].profileId,undefined);assert.equal(s.players[1].profile,undefined);
  await assert.rejects(()=>run('bingo_mark',{roundId,card:4}),{code:'BINGO_UNAVAILABLE'});
  t+=4500;
  for(let j=0;j<5;j++){s=await run('bingo_mark',{roundId,card:j});if(j===0){const replay=await run('bingo_mark',{roundId,card:j});assert.equal(replay.version,s.version);}}
  assert.equal(s.phase,'finished');assert.equal(s.profile.points,40*(i+1)+25);assert.equal(s.players[0].points,40*(i+1));assert.equal(s.profile.daily.completed,true);
  await assert.rejects(()=>run('bingo_mark',{roundId,card:4}),{code:'BINGO_UNAVAILABLE'});
  if(i<2)s=await run('lobby',{version:s.version});
 }
 assert.equal(s.profile.history.length,1);assert.equal(s.profile.history[0].trophyName,'Orion Champion');assert.equal(s.profile.history[0].points,120);
 assert.equal(s.profile.collection.filter(x=>x.unlocked).length,8);
 assert.equal((await run('state',{},guest)).profile.points,0);
 await svc.command({action:'close',roomId},host.credential);
 svc=createPersistentRoomService(createFileStore(path),opt);
 const p=(await svc.command({action:'profile_state'},a.profileCredential)).profile;
 assert.equal(p.points,145);assert.equal(p.history.length,1);assert.equal(p.history[0].won,true);
 assert.equal((await svc.command({action:'profile_mascot',mascot:'star'},a.profileCredential)).profile.mascot,'star');
 assert.equal((await svc.command({action:'profile_state'},b.profileCredential)).profile.history[0].won,false);
 t+=86400000;assert.equal((await svc.command({action:'profile_state'},a.profileCredential)).profile.daily.completed,false);
 const raw=await readFile(path,'utf8');assert.ok(!raw.includes(a.profileCredential));assert.ok(!raw.includes(b.profileCredential));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('bingo line includes free center, rejects incomplete lines',()=>{assert.equal(bingoLine([0,6,18,24]),true);assert.equal(bingoLine([0,6,18]),false);assert.equal(bingoLine([0,1,2,3,4]),true);assert.equal(bingoLine([2,7,17,22]),true);});
test('legacy room snapshots and profile expiry stay bounded',()=>{
 let t=100000;let svc=createRoomService({now:()=>t});const a=svc.command({action:'profile_create',name:'A'});const old=svc.exportState();svc=createRoomService({now:()=>t,initial:old});assert.equal(svc.command({action:'profile_state'},a.profileCredential).profile.name,'A');t+=91*86400000;assert.throws(()=>svc.command({action:'profile_state'},a.profileCredential),{code:'PROFILE_DENIED'});assert.deepEqual(svc.exportState(),[]);
});
