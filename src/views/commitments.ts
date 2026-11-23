import { bus } from '../bus';
import { commitmentOf, commitmentStats, coverageTarget, directReports, descendants, percent, projectedCoverage, requiredLevel, shiftLabel, upcomingSessions } from '../core/model';
import type { Commitment, Person } from '../core/types';
import * as S from '../state/store';
import { $, avatar, commitPill, emptyState, esc, fmtDate, icon, plural, ring, toast } from '../ui/kit';
import { pageHead, type View } from './common';
import { choiceGrid } from './today';

function projection(date: string, people: Person[]): string {
  const recs = S.commitmentsFor(date), c = commitmentStats(people, recs), cfg = S.cfg();
  const target = coverageTarget(people.length, cfg.targetPct), confirmed = projectedCoverage(c);
  const leads = [S.me(), ...descendants(S.org(), S.me().id)].filter(p => directReports(S.org(), p.id).some(r => people.includes(r)));
  const bars = leads.length > 1 ? `<div class="divider"></div><div class="hbars">${leads.map(l => {
    const members = directReports(S.org(), l.id).filter(p => people.includes(p));
    const s = commitmentStats(members, recs), t = coverageTarget(members.length, cfg.targetPct);
    const pct = percent(s.confirmed, members.length) ?? 0;
    return `<div class="hbar"><span class="name" title="${esc(l.branch || l.name)}">${esc(l.branch || l.name)}</span><span class="track"><span class="fill" data-width="${pct}%"></span><span class="target" style="left:${cfg.targetPct}%" title="Target ${cfg.targetPct}%"></span></span><span class="val">${s.confirmed}/${t}</span></div>`;
  }).join('')}</div>` : '';
  return `<section class="card"><div class="card-head"><div><h2>${icon('target')}Staffing projection</h2><p class="sub">Confirmed replies only. Target ${cfg.targetPct}% of ${plural(people.length, 'person', 'people')}.</p></div>
      <span class="pill ${confirmed >= target ? 'good' : 'warn'}">${confirmed >= target ? 'Target met' : `${target - confirmed} more needed`}</span></div>
    <div class="cluster" style="gap:18px;align-items:center">${ring(Math.min(100, Math.round((100 * confirmed) / Math.max(1, target))), { value: `${confirmed}/${target}`, sub: 'confirmed' })}
      <div class="stack tight">${(['confirmed', 'risk', 'unavailable'] as Commitment[]).map(k => `<span class="cluster">${commitPill(k)}<b class="num">${k === 'confirmed' ? c.confirmed : k === 'risk' ? c.atRisk : c.unavailable}</b></span>`).join('')}<span class="cluster">${commitPill(undefined)}<b class="num">${c.pending}</b></span></div></div>
    ${bars}
    ${c.pending ? `<div class="divider"></div><button class="btn block" type="button" data-action="nudge" data-n="${c.pending}">${icon('bell')}Remind ${plural(c.pending, 'person', 'people')} without a reply</button>` : ''}</section>`;
}

function replies(date: string, people: Person[]): string {
  const recs = S.commitmentsFor(date), f = S.session.ui.commitFilter;
  const list = people.filter(p => {
    const c = commitmentOf(recs[p.id]);
    return f === 'all' || (f === 'none' ? !c : c === f);
  });
  const chip = (id: string, label: string) => `<button class="chip" type="button" data-action="commit-filter" data-filter="${id}" aria-pressed="${f === id}">${label}</button>`;
  return `<section class="card"><div class="card-head"><h2>${icon('users')}Replies</h2></div>
    <div class="cluster" style="margin-bottom:8px">${chip('all', 'All')}${chip('none', 'No reply')}${chip('risk', 'At risk')}${chip('unavailable', 'Unavailable')}${chip('confirmed', 'Confirmed')}</div>
    <div class="list list-scroll">${list.map(p => {
      const r = recs[p.id];
      return `<div class="row">${avatar(p, 'sm')}<span class="grow"><strong class="truncate">${esc(p.name)}</strong><small class="truncate">${r?.note ? `“${esc(r.note)}”` : esc(S.branchName(p) || S.levelTitle(p.level))}</small></span>${commitPill(commitmentOf(r))}</div>`;
    }).join('') || '<p class="muted small" style="padding:12px 0">Nobody in this filter.</p>'}</div></section>`;
}

export const commitments: View = {
  render() {
    const cfg = S.cfg(), date = S.commitDate(), upcoming = upcomingSessions(S.session.today, 5, cfg.days);
    const mine = S.commitmentsFor(date)[S.me().id];
    const people = S.visiblePeople();
    const canProject = S.can('commitments.projection');
    const myCard = `<section class="card"><div class="card-head"><div><h2>${icon('user')}Your availability</h2><p class="sub">${esc(fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' }))} · ${esc(shiftLabel(cfg))}</p></div>${mine ? `<span class="pill">Saved</span>` : ''}</div>
      ${choiceGrid(date)}
      ${mine && mine.c !== 'confirmed' ? `<div class="field" style="margin-top:12px"><label for="commit-note">Note for your ${esc(S.levelTitle(Math.min(3, S.me().level + 1)))} <span class="muted">(optional)</span></label><input class="input" id="commit-note" maxlength="140" value="${esc(mine.note ?? '')}" placeholder="e.g. Doctor's appointment until 11:00" data-change="commit-note"></div>` : ''}</section>`;
    const side = !canProject
      ? `<section class="card">${emptyState({ icon: 'lock', title: 'Projection is for leaders', body: `${cfg.titles[Math.min(3, requiredLevel(S.ws().policy, 'commitments.projection')) as 0]} and above see who has confirmed.` })}</section>`
      : people.length ? projection(date, people) : `<section class="card">${emptyState({ icon: 'userPlus', title: 'No one to project yet', body: 'Once people join your branch, their replies appear here.', actions: S.can('people.manage') ? `<a class="btn primary" href="#/team/invites">${icon('qr')}Join my team</a>` : '' })}</section>`;
    return `${pageHead({ title: 'Commitments', lede: 'Plan coverage before the session starts. Forecasts count confirmed replies only.', actions: `<div class="seg" role="tablist" aria-label="Session">${upcoming.map(d => `<button type="button" role="tab" data-action="commit-date" data-date="${d}" aria-selected="${d === date}">${esc(fmtDate(d))}</button>`).join('')}</div>` })}
      <div class="grid main-side reveal"><div class="stack loose">${myCard}${canProject && people.length ? replies(date, people) : ''}</div>${side}</div>`;
  },
  actions: {
    'commit-date': el => { S.session.ui.commitDate = el.dataset.date!; bus.refresh(); },
    'commit-filter': el => { S.session.ui.commitFilter = el.dataset.filter!; bus.refresh(); },
    nudge: el => toast(`Reminder noted for ${plural(Number(el.dataset.n), 'person', 'people')}. Share it in your next huddle or post an update.`, { icon: 'bell', action: { label: 'Post update', fn: () => bus.navigate('updates') }, duration: 5000 }),
  },
  inputs: {
    'commit-note': el => {
      const date = S.commitDate(), rec = S.commitmentsFor(date)[S.me().id];
      if (!rec) return;
      S.setCommitment(date, rec.c, (el as HTMLInputElement).value);
      const status = $('#commit-note')?.closest('.card')?.querySelector('.pill');
      if (status) status.textContent = 'Saved';
      toast('Note saved', { icon: 'check' });
    },
  },
};
