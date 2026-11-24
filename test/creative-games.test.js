import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomService} from '../lib/rooms/service.mjs';
import {validStroke,customQuestion,grantSeasonRewards} from '../lib/rooms/creative.mjs';
test('drawing coordinates and custom questions are bounded',()=>{
 assert.equal(validStroke([[0,0],[1000,1000]],'ink'),true);
 for(const p of [[[0,0],[1001,0]],[[0,0],[0,NaN]],Array(33).fill([1,1]),[[1,1]]])assert.equal(validStroke(p,'ink'),false);
 assert.equal(validStroke([[0,0],[1,1]],'red'),false);
 assert.equal(customQuestion('Q',['a','A','b','c'],0),null);
 assert.equal(customQuestion('Q',['a','b','c','d'],4),null);
});
test('shared drawing authorization, sequence, private prompt, score and persistent rewards',()=>{
 let t=Date.UTC(2026,10,24);let svc=createRoomService({now:()=>t,rand:n=>n-1});
 const a=svc.command({action:'profile_create',name:'Alex'}),b=svc.command({action:'profile_create',name:'Jamie'});
 const h=svc.command({action:'create_profile',team:'jade'},a.profileCredential),g=svc.command({action:'join_profile',team:'amber',invite:h.state.invite},b.profileCredential),roomId=h.state.roomId;
 const run=(action,x={},who=h)=>svc.command({action,roomId,...x},who.credential).state;
 let s=run('state');assert.throws(()=>run('race_theme',{version:s.version,theme:'space'},g),{code:'HOST_ONLY'});
 s=run('race_theme',{version:s.version,theme:'space'});
 assert.throws(()=>svc.command({action:'profile_accessory',accessory:'comet'},a.profileCredential),{code:'ACCESSORY_LOCKED'});
 for(let i=0;i<2;i++){
  s=run('start',{game:'drawing',version:s.version});const roundId=s.round.id;assert.equal(s.round.prompt,undefined);assert.equal(run('state',{},g).round.prompt,'teapot');
  const stroke={roundId,index:0,color:'jade',points:[[10,10],[30,40]]};
  assert.throws(()=>run('draw_stroke',stroke),{code:'STROKE_UNAVAILABLE'});
  run('draw_stroke',stroke,g);assert.deepEqual(run('state').round.strokes,[{color:'jade',points:stroke.points}]);
  assert.throws(()=>run('draw_stroke',stroke,g),{code:'STROKE_UNAVAILABLE'});
  assert.throws(()=>run('draw_stroke',{...stroke,index:1,points:[[0,0],[1001,2]]},g),{code:'STROKE_UNAVAILABLE'});
  s=run('charades_guess',{roundId,guess:'teapot'});assert.equal(s.phase,'finished');assert.equal(s.profile.season.points,30*(i+1));assert.equal(run('state',{},g).profile.season.points,20*(i+1));s=run('lobby',{version:s.version});
 }
 assert.equal(s.profile.points,85);assert.equal(s.profile.accessories.find(x=>x.id==='comet').unlocked,true);
 svc=createRoomService({now:()=>t,rand:n=>n-1,initial:svc.exportState()});
 assert.equal(svc.command({action:'profile_accessory',accessory:'comet'},a.profileCredential).profile.accessory,'comet');
 t=Date.UTC(2026,11,1);assert.equal(svc.command({action:'profile_state'},a.profileCredential).profile.accessories.find(x=>x.id==='comet').unlocked,true);
 s=run('start',{game:'race',version:run('state').version});assert.equal(s.round.theme,'space');assert.equal(run('state',{},g).round.theme,'space');
 const p={season:{points:300}};grantSeasonRewards(p);assert.deepEqual(p.seasonRewards,['comet','aurora','starlight']);
});
test('custom trivia is host-only, five questions and practice-only across restart',()=>{
 let t=100000;let svc=createRoomService({now:()=>t,rand:n=>n-1});
 const a=svc.command({action:'profile_create',name:'Host'}),h=svc.command({action:'create_profile',team:'jade'},a.profileCredential),g=svc.command({action:'join',invite:h.state.invite,name:'Guest',team:'amber'}),roomId=h.state.roomId;
 const run=(action,x={},who=h)=>svc.command({action,roomId,...x},who.credential).state;
 let s=run('state');const q={text:'Team color?',options:['Red','Blue','Green','Gold'],answer:2};
 assert.throws(()=>run('custom_question',{version:s.version,...q},g),{code:'HOST_ONLY'});
 assert.throws(()=>run('start',{game:'custom_trivia',version:s.version}),{code:'CANNOT_START'});
 for(let i=0;i<5;i++)s=run('custom_question',{version:s.version,...q,text:q.text+' '+i});
 assert.equal(s.customCount,5);assert.equal(s.customQuestions,undefined);
 s=run('start',{game:'custom_trivia',version:s.version});
 for(let i=0;i<5;i++){
  assert.equal(s.round.answer,undefined);const roundId=s.round.id;
  run('answer',{roundId,index:i,choice:2});s=run('answer',{roundId,index:i,choice:2},g);
  assert.equal(s.round.answer,2);assert.equal(s.players.reduce((n,p)=>n+p.points,0),0);
  svc=createRoomService({now:()=>t,rand:n=>n-1,initial:svc.exportState()});
  if(i<4)s=run('next',{roundId,index:i});
 }
 s=run('state');assert.equal(s.phase,'finished');assert.equal(s.profile.points,0);assert.equal(s.profile.rounds,0);assert.equal(s.profile.daily.completed,false);assert.equal(s.profile.season.points,0);
});
