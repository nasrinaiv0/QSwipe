import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRoomService} from '../lib/rooms/service.mjs';
import {createFileStore,createPersistentRoomService,createSupabaseStore} from '../lib/rooms/persistence.mjs';
import {onlineConfig,makeOnlineHandler} from '../lib/rooms/online.mjs';
test('restart restores credentials and scores without plaintext bearer; CAS protects concurrent joins',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qs-room-')),path=join(dir,'state.json');let t=100000;
 try{const store=createFileStore(path),options={now:()=>t,rand:n=>n-1};let svc=createPersistentRoomService(store,options);
 const h=await svc.command({action:'create',name:'Host',team:'jade'}),roomId=h.state.roomId;
 const [a,b]=await Promise.all(['A','B'].map(name=>svc.command({action:'join',invite:h.state.invite,name,team:'amber'})));
 let state=(await svc.command({action:'state',roomId},h.credential)).state;assert.equal(state.players.length,3);
 await svc.command({action:'start',roomId,version:state.version,game:'wheel'},h.credential);t+=6000;
 svc=createPersistentRoomService(createFileStore(path),options);state=(await svc.command({action:'state',roomId},a.credential)).state;
 assert.equal(state.phase,'finished');assert.equal(state.players.reduce((n,p)=>n+p.points,0),20);
 assert.deepEqual((await svc.command({action:'state',roomId},b.credential)).state.players,state.players);
 const raw=await readFile(path,'utf8');for(const x of [h,a,b])assert.ok(!raw.includes(x.credential));
 await assert.rejects(()=>svc.command({action:'state',roomId},'0'.repeat(64)),{code:'ROOM_ACCESS_DENIED'});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('memory boards conceal values, reject duplicate flips and award once; tournament tracks delta and ties',()=>{
 let t=1000;const svc=createRoomService({now:()=>t,rand:n=>n-1});
 const a=svc.command({action:'create',name:'A',team:'jade'}),b=svc.command({action:'join',invite:a.state.invite,name:'B',team:'amber'}),roomId=a.state.roomId;
 const run=(action,extra={},who=a)=>svc.command({action,roomId,...extra},who.credential).state;
 let s=run('skin',{skin:'mint'});assert.equal(s.players[0].skin,'mint');
 s=run('tournament',{version:s.version,title:'Friday cup',trophy:'Golden duck'});
 assert.throws(()=>svc.command({action:'join',invite:a.state.invite,name:'C',team:'jade'}),{code:'ROOM_NOT_JOINABLE'});
 for(let k=0;k<3;k++){
  s=run('start',{version:s.version,game:'memory'});assert.deepEqual(s.round.cards,Array(16).fill(null));assert.equal(s.round.boards,undefined);
  const roundId=s.round.id;
  for(const who of [a,b]){
   let q=run('state',{},who).round;
   for(let i=0;i<8;i++){
    const turn=q.turn;q=run('flip',{roundId,turn,card:i},who).round;
    assert.throws(()=>run('flip',{roundId,turn,card:i+8},who),{code:'CARD_UNAVAILABLE'});
    q=run('flip',{roundId,turn:q.turn,card:i+8},who).round;
   }
  }
  s=run('state');assert.equal(s.phase,'finished');assert.equal(s.players[0].points,50*(k+1));assert.equal(s.players[1].points,50*(k+1));
  if(k<2)s=run('lobby',{version:s.version});
 }
 assert.equal(s.tournament.status,'finished');assert.equal(s.tournament.winners.length,2);assert.equal(s.tournament.scores[0].points,150);assert.ok(s.players[0].badges.includes('Golden duck'));
 assert.equal(run('state').players[0].points,150);
});
test('memory mismatch locks, conceals and stale turns fail',()=>{
 let t=1000;const svc=createRoomService({now:()=>t,rand:n=>n-1});const a=svc.command({action:'create',name:'A',team:'jade'}),b=svc.command({action:'join',invite:a.state.invite,name:'B',team:'amber'}),roomId=a.state.roomId;
 const run=(action,extra={})=>svc.command({action,roomId,...extra},a.credential).state;
 let s=run('start',{version:b.state.version,game:'memory'}),roundId=s.round.id;
 s=run('flip',{roundId,turn:0,card:0});s=run('flip',{roundId,turn:1,card:1});assert.equal(s.round.locked,true);
 assert.throws(()=>run('flip',{roundId,turn:2,card:2}),{code:'CARD_UNAVAILABLE'});
 t+=901;s=run('state');assert.equal(s.round.locked,false);assert.deepEqual(s.round.cards,Array(16).fill(null));
 s=run('flip',{roundId,turn:2,card:2});assert.equal(s.round.cards[2],2);
 t+=61000;s=run('state');assert.equal(s.phase,'finished');assert.equal(s.players[0].points,0);
});
test('online adapter fails closed in production and pins distinct staging origin',async()=>{
 const env={VERCEL_ENV:'preview',QSWIPE_ROOMS_ONLINE:'true',QSWIPE_ROOMS_STAGING_REF:'aaaaaaaaaaaaaaaaaaaa',QSWIPE_ROOMS_PRODUCTION_REF:'bbbbbbbbbbbbbbbbbbbb',QSWIPE_ROOMS_SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',QSWIPE_ROOMS_PUBLISHABLE_KEY:'sb_publishable_fictionalkey123456',QSWIPE_ROOMS_STORE_SECRET:'a'.repeat(64),QSWIPE_ROOMS_PREVIEW_ORIGIN:'https://fixture.vercel.app'};
 assert.ok(onlineConfig(env));assert.equal(onlineConfig({...env,VERCEL_ENV:'production'}),null);assert.equal(onlineConfig({...env,QSWIPE_ROOMS_PRODUCTION_REF:env.QSWIPE_ROOMS_STAGING_REF}),null);
 let calls=0;const store=createSupabaseStore(onlineConfig(env),async(url,opt)=>{calls++;assert.equal(url,env.QSWIPE_ROOMS_SUPABASE_URL+'/rest/v1/rpc/qs_room_snapshot');assert.equal(opt.redirect,'error');assert.equal(opt.headers.apikey,env.QSWIPE_ROOMS_PUBLISHABLE_KEY);return {ok:true,json:async()=>({version:0,rooms:[]})};});assert.deepEqual(await store.load(),{version:0,rooms:[]});assert.equal(calls,1);
 const res={setHeader(){},status(n){this.code=n;return this;},json(d){this.data=d;}};
 await makeOnlineHandler({env:{...env,VERCEL_ENV:'production'},fetchImpl:()=>{throw Error('must not fetch');}})({},res);assert.equal(res.code,503);
});

test('three independent memory boards persist simultaneous flips without lost turns or duplicate rewards',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qs-memory-cas-')),path=join(dir,'rooms.json');
 let t=100000;const store=createFileStore(path),opt={now:()=>t,rand:n=>n-1};
 let svc=createPersistentRoomService(store,opt);
 try{
  const h=await svc.command({action:'create',name:'Host',team:'jade'}),roomId=h.state.roomId;
  const a=await svc.command({action:'join',invite:h.state.invite,name:'A',team:'amber'});
  const b=await svc.command({action:'join',invite:h.state.invite,name:'B',team:'jade'});
  const players=[h,a,b],run=async(who,action,extra={})=>(await svc.command({action,roomId,...extra},who.credential)).state;
  const s=await run(h,'start',{version:b.state.version,game:'memory'}),roundId=s.round.id;
  for(let i=0;i<8;i++){
   const first=await Promise.all(players.map(p=>run(p,'flip',{roundId,turn:2*i,card:i})));
   assert.ok(first.every(x=>x.round.turn===2*i+1&&x.round.matched===i));
   const second=await Promise.all(players.map(p=>run(p,'flip',{roundId,turn:2*i+1,card:i+8})));
   assert.ok(second.every(x=>x.round.turn===2*i+2&&x.round.matched===i+1));
   if(i<7)await assert.rejects(()=>run(h,'flip',{roundId,turn:2*i+1,card:i+8}),{code:'CARD_UNAVAILABLE'});
  }
  svc=createPersistentRoomService(createFileStore(path),opt);
  for(const p of players){const x=await run(p,'state');assert.equal(x.phase,'finished');assert.equal(x.round.matched,8);assert.equal(x.players.reduce((sum,seat)=>sum+seat.points,0),150);}
 }finally{await rm(dir,{recursive:true,force:true});}
});
