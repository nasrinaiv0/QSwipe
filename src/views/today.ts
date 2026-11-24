import { bus } from '../bus';
import { attendanceRate, commitmentOf, dailySeries, relativeTime, rosterStats, sessionDates, shiftLabel, statusOf } from '../core/model';
import type { Commitment } from '../core/types';
import { showPass } from '../qr/flows';
import * as S from '../state/store';
import { COMMIT_META, esc, firstName, fmtDate, fmtTime, haptic, icon, toast } from '../ui/kit';
import { kpi, pageHead, type View } from './common';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function choiceGrid(date: string) {
  const mine = commitmentOf(S.commitmentsFor(date)[S.me().id]);
  return `<div class="choice-grid" role="group" aria-label="Your availability for ${esc(fmtDate(date))}">${(Object.keys(COMMIT_META) as Commitment[]).map(c => {
    const m = COMMIT_META[c];
    return `<button class="choice ${m.cls}" type="button" data-action="commit" data-value="${c}" data-date="${date}" aria-pressed="${mine === c}"><span class="ci">${icon(m.icon)}</span><strong>${m.label}</strong><small>${m.blurb}</small></button>`;
  }).join('')}</div>`;
}

function checklist(): string {
  const w = S.ws();
  if (!S.isOwner(S.self()) || S.session.previewId) return '';
  const items: [boolean, string, string, string][] = [
    [w.people.length > 1, 'Invite your team', 'Show a “Join my team” QR code or add people manually.', '#/team/invites'],
    [w.announcements.length > 0, 'Post a welcome update', 'Announcements reach each person’s branch.', '#/updates'],
    [w.trivia.length > 0, 'Add trivia questions', 'Your own question bank for team huddles.', '#/play/trivia'],
  ];
  if (items.every(i => i[0]) || w.people.length > 6) return '';
  const done = items.filter(i => i[0]).length;
  return `<section class="card" aria-labelledby="setup-h"><div class="card-head"><h2 id="setup-h">${icon('sparkles')}Get set up</h2><span class="pill">${done}/${items.length}</span></div>
    <div class="list">${items.map(([ok, title, , href]) => `<a class="row interactive" href="${href}" style="text-decoration:none"><span class="pill ${ok ? 'good' : ''}">${icon(ok ? 'check' : 'arrowRight')}</span><span class="grow"><strong>${esc(title)}</strong></span>${icon('chevronRight')}</a>`).join('')}</div></section>`;
}

export const today: View = {
  render() {
    const me = S.me(), c = S.cfg(), t = S.session.today, recs = S.records(t);
    const mine = recs[me.id];
    const sessionDay = S.isSessionDay(t);
    const team = S.branch();
    const verify = S.can('attendance.verify') && team.length > 0;
    const stats = rosterStats(team, recs);
    const next = S.commitDate();
    const posts = S.visibleAnnouncements().slice(0, 3);
    const unread = S.unreadCount();
    const status = statusOf(mine);

    const title = status === 'present' ? `Checked in${mine?.at ? ` · ${fmtTime(mine.at)}` : ''}` : status === 'absent' ? 'Marked absent' : sessionDay ? 'Not checked in' : 'No session today';
    const hero = `<section class="hero"><div>
      <h2>${esc(title)}</h2>
      <p>${sessionDay ? esc(shiftLabel(c)) : `Next: ${esc(fmtDate(next))}`}</p></div>
      <div class="cluster">
        ${!status && sessionDay ? `<button class="btn primary" type="button" data-action="self-checkin">${icon('login')}Check in</button>` : status === 'present' ? `<span class="checkin-state">${icon('check')}Present</span>` : ''}
        ${S.self().passKey && !S.session.previewId ? `<button class="btn outline" type="button" data-action="show-pass">${icon('qr')}My pass</button>` : ''}
      </div></section>`;

    const kpis = verify ? `<div class="kpis reveal">
      ${kpi({ label: 'Team', value: stats.scheduled, href: '#/team/people' })}
      ${kpi({ label: 'Present', value: stats.present, href: '#/attendance', attrs: 'data-action="kpi-filter" data-filter="present"' })}
      ${kpi({ label: 'Absent', value: stats.absent, href: '#/attendance', attrs: 'data-action="kpi-filter" data-filter="absent"' })}
      ${kpi({ label: 'Unmarked', value: stats.pending, accent: stats.pending > 0, href: '#/attendance', attrs: 'data-action="kpi-filter" data-filter="pending"' })}
    </div>` : '';

    const pulse = (() => {
      if (!S.can('reports.view') || !team.length) return '';
      const dates = sessionDates(t, 10, c.days, S.startDate());
      const series = dailySeries(team, d => S.ws().attendance[d], dates);
      if (!series.some(d => d.present + d.absent)) return '';
      const max = 100;
      return `<section class="card"><div class="card-head"><h2>Attendance</h2><a class="btn sm ghost" href="#/reports">Reports ${icon('arrowRight')}</a></div>
        <div class="spark" role="img" aria-label="Attendance rate over the last ${dates.length} sessions">${series.map((d, i) => {
          const rate = attendanceRate(d);
          return `<span class="${rate === null ? 'empty-bar' : ''} ${d.date === t ? 'today' : ''}" style="--i:${i};height:${rate === null ? 8 : Math.max(6, (rate / max) * 100)}%" title="${esc(fmtDate(d.date))}: ${rate === null ? 'no data' : `${rate}%`}"></span>`;
        }).join('')}</div></section>`;
    })();

    return `${pageHead({ title: `${greeting()}, ${firstName(me.name)}`, lede: fmtDate(t, { weekday: 'long', month: 'long', day: 'numeric' }) })}
      ${hero}
      ${kpis}
      <div class="grid two reveal">
        ${checklist()}
        <section class="card"><div class="card-head"><div><h2>Next session</h2><p class="sub">${esc(fmtDate(next))}</p></div><a class="btn sm ghost" href="#/commitments">Plan ${icon('arrowRight')}</a></div>${choiceGrid(next)}</section>
        <section class="card"><div class="card-head"><h2>Updates ${unread ? `<span class="badge">${unread}</span>` : ''}</h2><a class="btn sm ghost" href="#/updates">All ${icon('arrowRight')}</a></div>
          ${posts.length ? `<div class="list">${posts.map(a => {
            const author = S.org().byId.get(a.authorId);
            return `<a class="row interactive" href="#/updates" style="text-decoration:none"><span class="grow"><strong class="truncate">${a.priority === 'important' ? '⚑ ' : ''}${esc(a.text.split('\n')[0]!.slice(0, 90))}</strong><small>${esc(author?.name ?? 'Former member')} · ${relativeTime(a.at)}</small></span>${S.isRead(a) ? '' : '<span class="badge">New</span>'}</a>`;
          }).join('')}</div>` : '<p class="muted small">No updates yet.</p>'}
        </section>
        ${pulse}
      </div>`;
  },
  actions: {
    'kpi-filter': el => { S.session.ui.rosterFilter = el.dataset.filter!; },
    'self-checkin': () => {
      const res = S.mark(S.me().id, 'present', 'self', S.session.today);
      if (!res.ok) return void toast(res.error, { icon: 'alert' });
      haptic(15);
      bus.refresh();
      toast('Checked in. Have a great session!', { icon: 'check', action: { label: 'Undo', fn: () => { S.undo(); bus.refresh(); } }, duration: S.settings().undoSeconds * 1000 });
    },
    'show-pass': () => void showPass(),
    commit: el => {
      S.setCommitment(el.dataset.date!, el.dataset.value as Commitment);
      haptic(10);
      bus.refresh({ shell: true });
      toast(`Availability saved: ${COMMIT_META[el.dataset.value as Commitment].label}`, { icon: 'check' });
    },
  },
};
