import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomService} from '../lib/rooms/service.mjs';
import {zodiacCollection,seasonView,creditSeason} from '../lib/rooms/seasonal.mjs';
test('12 unique zodiac unlocks and monthly rollover',()=>{
 const z=zodiacCollection({rounds:12});assert.equal(z.length,12);assert.equal(new Set(z.map(x=>x.id)).size,12);assert.ok(z.every(x=>x.unlocked));assert.equal(zodiacCollection({rounds:3}).filter(x=>x.unlocked).length,3);
 const p={};creditSeason(p,Date.UTC(2026,10,30),30);assert.equal(seasonView(p,Date.UTC(2026,11,1)).points,0);creditSeason(p,Date.UTC(2026,11,1),20);assert.deepEqual(seasonView(p,Date.UTC(2026,11,2)),{month:'2026-12',points:20,previous:[{month:'2026-11',points:30}]});
});
test('private charades prompt, rate limits, daily and seasonal settlement, restart and cosmetic ownership',()=>{
 let t=Date.UTC(2026,10,24);let svc=createRoomService({now:()=>t,rand:n=>n-1});
 const a=svc.command({action:'profile_create',name:'Alex'}),b=svc.command({action:'profile_create',name:'Jamie'});
 assert.throws(()=>svc.command({action:'profile_accessory',accessory:'crown'},a.profileCredential),{code:'ACCESSORY_LOCKED'});
 const h=svc.command({action:'create_profile',team:'jade'},a.profileCredential),g=svc.command({action:'join_profile',team:'amber',invite:h.state.invite},b.profileCredential),roomId=h.state.roomId;
 const run=(action,x={},who=h)=>svc.command({action,roomId,...x},who.credential).state;
 let s=run('start',{game:'charades',version:g.state.version});const roundId=s.round.id;
 assert.equal(s.round.prompt,undefined);assert.equal(run('state',{},g).round.prompt,'teapot');
 assert.throws(()=>run('charades_guess',{roundId,guess:'teapot'},g),{code:'GUESS_UNAVAILABLE'});
 s=run('charades_guess',{roundId,guess:'robot'});assert.equal(s.round.guesses,1);assert.throws(()=>run('charades_guess',{roundId,guess:'teapot'}),{code:'GUESS_UNAVAILABLE'});
 t+=1201;s=run('charades_guess',{roundId,guess:'Teapot'});assert.equal(s.phase,'finished');assert.equal(s.profile.points,55);assert.equal(s.profile.season.points,30);assert.equal(run('state',{},g).profile.season.points,20);assert.equal(s.profile.daily.completed,true);
 assert.throws(()=>run('charades_guess',{roundId,guess:'teapot'}),{code:'GUESS_UNAVAILABLE'});
 svc=createRoomService({now:()=>t,rand:n=>n-1,initial:svc.exportState()});assert.equal(run('state').profile.points,55);
 assert.equal(svc.command({action:'profile_accessory',accessory:'scarf'},a.profileCredential).profile.accessory,'scarf');
 assert.equal(svc.command({action:'profile_mascot',mascot:'aries'},a.profileCredential).profile.mascot,'aries');
 s=run('lobby',{version:run('state').version});s=run('start',{game:'charades',version:s.version});t+=45001;s=run('state');assert.equal(s.phase,'finished');assert.equal(s.round.winner,null);assert.equal(s.profile.points,55);
 t=Date.UTC(2026,11,1);assert.equal(svc.command({action:'profile_state'},a.profileCredential).profile.season.points,0);
});
