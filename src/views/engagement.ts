import {bus} from '../bus';
import {answerTurn,createTeamRound,leaderboard,milestones,roundScores,points,type TeamRound} from '../core/engagement';
import {isoDate} from '../core/model';
import * as S from '../state/store';
import {$,avatar,esc,icon,toast,confetti,sound} from '../ui/kit';
import type {Handler} from './common';
let round:TeamRound|null=null,period:'week'|'all'='week',saved=0;
const players=()=>[S.me(),...S.visiblePeople()].filter((p,i,a)=>a.findIndex(x=>x.id===p.id)===i);
const name=(id:string)=>S.org().byId.get(id)?.name??'Former player';
export function clearChallenge(){round=null;saved=0;period='week';}
function stats(){return leaderboard(S.ws().playScores??[],players(),isoDate(),'all');}
export function engagementSummary(){
 const mine=stats().find(x=>x.person.id===S.me().id);
 return `<section class="card engage-summary"><div class="card-head"><div><span class="eyebrow">Team huddle</span><h2>Play together</h2><p class="sub">Quick games and friendly challenges.</p></div><span class="engage-emblem" aria-hidden="true">✦</span></div><div class="engage-summary-foot"><span><strong>${mine?.points??0}</strong> local points</span><a class="btn primary" href="#/play/challenge">${icon('play')}Team challenge</a></div></section>`;
}
export function challengeView(){
 const all=stats(),mine=all.find(x=>x.person.id===S.me().id),leaders=leaderboard(S.ws().playScores??[],players(),isoDate(),period);
 const badges=milestones(mine?.rounds??0,mine?.perfect??0,mine?.points??0);
 let stage='';
 if(!round){
  stage=`<div class="challenge-intro"><span class="eyebrow">Shared-device multiplayer</span><h2>Five answers. One team.</h2><p>Choose 2–8 teammates. Pass the device after each answer. Every player gets five addition questions with no speed bonus.</p></div>
  <form data-submit="challenge-start"><fieldset class="challenge-players"><legend>Choose players</legend>${players().map((p,i)=>`<label class="challenge-player">${avatar(p,'sm',{round:true})}<span class="grow"><strong>${esc(p.name)}</strong><small>${(S.ws().playScores??[]).some(s=>s.playerId===p.id&&s.day===isoDate())?'Practice only today':'Eligible for points'}</small></span><input type="checkbox" name="challenge-player" value="${esc(p.id)}" ${i<2?'checked':''}></label>`).join('')}</fieldset>
  <button class="btn primary lg block" type="submit" ${players().length<2?'disabled':''}>Start team challenge</button><p class="hint">One scored round per player per day. Extra rounds are practice.</p></form>`;
 }else if(round.turn<round.questions.length){
  const q=round.questions[round.turn]!,p=round.players[round.turn%round.players.length]!,n=Math.floor(round.turn/round.players.length)+1;
  stage=`<div class="challenge-turn" aria-live="polite"><span class="pill good">Round ${n} of 5</span><span class="eyebrow">Pass to ${esc(name(p))}</span><h2>${esc(q.question)}</h2><div class="challenge-progress" role="progressbar" aria-label="Challenge progress" aria-valuemin="0" aria-valuemax="${round.questions.length}" aria-valuenow="${round.turn}"><span style="width:${round.turn/round.questions.length*100}%"></span></div><div class="options challenge-options">${q.options.map((o,i)=>`<button class="option" type="button" data-action="challenge-answer" data-i="${i}" data-turn="${round!.turn}"><span class="key">${i+1}</span>${o}</button>`).join('')}</div><button class="btn ghost" type="button" data-action="challenge-reset">End round</button></div>`;
 }else{
  stage=`<div class="challenge-intro"><span class="engage-emblem" aria-hidden="true">★</span><h2>Team round complete!</h2><p role="status">${saved} scored results saved. Other results are practice only.</p></div><div class="list">${roundScores(round).sort((a,b)=>b.correct-a.correct).map(s=>`<div class="row"><span class="grow"><strong>${esc(name(s.playerId))}</strong><small>${s.correct}/5 correct</small></span><span class="pill good">${points(s)} possible pts</span></div>`).join('')}</div><button class="btn primary block" type="button" data-action="challenge-reset">Play again</button>`;
 }
 return `<div class="engage-layout"><section class="card challenge-stage">${stage}${S.session.previewId?'<p class="notice">Role preview is practice only. No scores saved.</p>':''}</section><aside class="stack"><section class="card"><div class="card-head"><div><h2>Team leaderboard</h2><p class="sub">This device · visible teammates</p></div><span class="engage-emblem small" aria-hidden="true">♛</span></div><div class="seg" role="group" aria-label="Leaderboard period"><button type="button" data-action="score-period" data-period="week" aria-pressed="${period==='week'}">Last 7 days</button><button type="button" data-action="score-period" data-period="all" aria-pressed="${period==='all'}">Recorded history</button></div><div class="engage-ranks">${leaders.length?leaders.map((x,i)=>`<div class="engage-rank"><span class="rank-number">${i+1}</span>${avatar(x.person,'sm',{round:true})}<span class="grow"><strong>${esc(x.person.name)}</strong><small>${x.rounds} scored rounds</small></span><strong class="score-num">${x.points}<small> pts</small></strong></div>`).join(''):'<p class="muted small">No scores yet. Complete a team challenge to start.</p>'}</div></section><section class="card"><div class="card-head"><div><h2>Your achievements</h2><p class="sub">${badges.filter(x=>x.unlocked).length}/${badges.length} unlocked · ${mine?.points??0} points</p></div></div><div class="achievement-grid">${badges.map(b=>`<div class="achievement ${b.unlocked?'unlocked':''}"><span aria-hidden="true">${b.symbol}</span><strong>${esc(b.label)}</strong><small>${esc(b.detail)}</small><small>${b.unlocked?'Unlocked':'Locked'}</small></div>`).join('')}</div>${badges[3]?.unlocked?'<div class="reward-frame">♛ Gold frame unlocked</div>':''}<p class="hint">Cosmetic rewards only. No cash value, attendance penalties or work-performance scoring.</p></section></aside></div>`;
}
export const challengeActions:Record<string,Handler>={
 'challenge-start':()=>{const selected=$$<HTMLInputElement>('input[name="challenge-player"]:checked').map(x=>x.value),allowed=new Set(players().map(p=>p.id));if(selected.length<2||selected.length>8||selected.some(x=>!allowed.has(x)))return void toast('Choose 2–8 visible teammates.');round=createTeamRound(selected,crypto.randomUUID(),isoDate());saved=0;bus.refresh();},
 'challenge-answer':el=>{if(!round||Number(el.dataset.turn)!==round.turn)return;const next=answerTurn(round,Number(el.dataset.i));if(next===round)return;round=next;sound.pop();if(round.turn===round.questions.length){saved=S.recordPlayScores(roundScores(round));confetti();}bus.refresh();},
 'challenge-reset':()=>{if(round&&round.turn<round.questions.length&&!confirm('End this round? Unfinished scores are not saved.'))return;round=null;saved=0;bus.refresh();},
 'score-period':el=>{period=el.dataset.period==='all'?'all':'week';bus.refresh();}
};
