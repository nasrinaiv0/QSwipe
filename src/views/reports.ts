import { bus } from '../bus';
import { attendanceRate, dailySeries, descendants, directReports, isoDate, personSummary, relativeTime, requiredLevel, sessionDates, statusOf, summarize, toCSV, type RosterStats } from '../core/model';
import type { Person } from '../core/types';
import * as S from '../state/store';
import { $, $$, avatar, download, emptyState, esc, fmtDate, hideTooltip, icon, lockedPanel, plural, showTooltip, statusPill, toast } from '../ui/kit';
import { kpi, options, pageHead, type View } from './common';

type Day = RosterStats & { date: string };

function scopePeople(): Person[] {
  const all = S.visiblePeople(), sel = S.session.ui.reportBranch;
  if (sel === 'all') return all;
  const ids = new Set(descendants(S.org(), sel).map(p => p.id));
  return all.filter(p => ids.has(p.id));
}

function leaders(people: Person[]): Person[] {
  const ids = new Set(people.map(p => p.id));
  return [S.me(), ...people].filter(p => directReports(S.org(), p.id).some(r => ids.has(r.id)));
}

const W = 720, H = 220, PAD = { l: 30, r: 8, t: 10, b: 26 };
function roundedTop(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h, w / 2);
  return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
}

function chart(series: Day[]): string {
  const max = Math.max(1, ...series.map(d => d.scheduled));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b, band = iw / Math.max(1, series.length), bw = Math.min(30, band * 0.62);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const every = series.length > 14 ? 3 : series.length > 8 ? 2 : 1;
  const cols = series.map((d, i) => {
    const x = PAD.l + band * i + (band - bw) / 2;
    const segs: [string, number][] = [['present', d.present], ['absent', d.absent], ['pending', d.pending]];
    let base = PAD.t + ih;
    const last = [...segs].reverse().find(s => s[1] > 0)?.[0];
    const shapes = segs.filter(s => s[1] > 0).map(([k, v], si, arr) => {
      const h = (v / max) * ih - (si < arr.length - 1 ? 2 : 0);
      base -= (v / max) * ih;
      const top = base + (si < arr.length - 1 ? 2 : 0);
      return k === last ? `<path class="seg-${k}" d="${roundedTop(x, base, bw, Math.max(1, h))}"/>` : `<rect class="seg-${k}" x="${x}" y="${top}" width="${bw}" height="${Math.max(1, h)}"/>`;
    }).join('');
    const label = i % every === 0 || i === series.length - 1 ? `<text class="tick tick-label" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(fmtDate(d.date, { day: 'numeric', month: 'short' }))}</text>` : '';
    return `<g class="col ${d.date === S.session.today ? 'col-today' : ''}" data-i="${i}"><g class="grow-in" style="--i:${i}">${shapes}</g>${label}<rect class="col-hit" x="${PAD.l + band * i}" y="${PAD.t}" width="${band}" height="${ih}" data-i="${i}"/></g>`;
  }).join('');
  return `<div class="chart" id="trend-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily attendance: present, absent and unmarked per session. The register below has the same data as a table.">
    <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="hatch-bg" width="6" height="6"/><line class="hatch-line" x1="0" y1="0" x2="0" y2="6"/></pattern></defs>
    ${ticks.map(v => `<line class="${v ? 'grid-line' : 'axis-line'}" x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${PAD.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('')}
    ${cols}</svg></div>`;
}

function register(people: Person[], dates: string[]): string {
  const { reportSort: sort, reportQuery } = S.session.ui;
  const recordsFor = (d: string) => S.ws().attendance[d];
  const q = reportQuery.trim().toLowerCase();
  const rows = people.filter(p => !q || `${p.name} ${S.branchName(p)}`.toLowerCase().includes(q)).map(p => ({ p, branch: S.branchName(p), ...personSummary(p, recordsFor, dates), today: statusOf(S.records(S.session.today)[p.id]) }));
  type Row = (typeof rows)[number];
  const get = (r: Row): string | number => {
    const k = sort.key;
    if (k === 'name') return r.p.name;
    if (k === 'branch') return r.branch;
    if (k === 'today') return r.today ?? '';
    return r[k as 'present' | 'absent' | 'pending' | 'rate' | 'streak'] ?? -1;
  };
  rows.sort((a, b) => {
    const av = get(a), bv = get(b);
    return (typeof av === 'string' ? av.localeCompare(String(bv)) : av - Number(bv)) * sort.dir;
  });
  return rows.map(r => `<tr><td><span class="person">${avatar(r.p, 'xs')}<span>${esc(r.p.name)}</span></span></td><td>${esc(r.branch || '—')}</td><td class="num">${r.present}</td><td class="num">${r.absent}</td><td class="num">${r.pending}</td><td class="num">${r.rate === null ? '—' : `${r.rate}%`}</td><td class="num">${r.streak}</td><td>${statusPill(r.today)}</td></tr>`).join('')
    || '<tr><td colspan="8" class="muted">Nobody matches.</td></tr>';
}

const COLS: [string, string, boolean][] = [['name', 'Name', false], ['branch', 'Branch', false], ['present', 'Present', true], ['absent', 'Absent', true], ['pending', 'Unmarked', true], ['rate', 'Rate', true], ['streak', 'Streak', true], ['today', 'Today', false]];

export const reports: View = {
  render() {
    const cfg = S.cfg();
    if (!S.can('reports.view')) return `${pageHead({ title: 'Reports' })}<section class="card">${lockedPanel({ title: 'Reports are locked for your level', need: cfg.titles[Math.min(3, requiredLevel(S.ws().policy, 'reports.view')) as 0] })}</section>`;
    const ui = S.session.ui, people = scopePeople(), lead = leaders(S.visiblePeople());
    const all = sessionDates(S.session.today, ui.reportRange * 2, cfg.days, S.startDate());
    const dates = all.slice(-ui.reportRange), prev = all.slice(0, Math.max(0, all.length - ui.reportRange));
    const recordsFor = (d: string) => S.ws().attendance[d];
    const series = dailySeries(people, recordsFor, dates), total = summarize(series), before = summarize(dailySeries(people, recordsFor, prev));
    const delta = total.rate !== null && before.rate !== null ? total.rate - before.rate : null;
    const perfect = people.filter(p => { const s = personSummary(p, recordsFor, dates); return s.present > 0 && s.absent === 0; }).length;
    const canExport = S.can('reports.export');
    const head = pageHead({ title: 'Reports', lede: `${S.scopeLabel()} · ${plural(people.length, 'person', 'people')} · last ${plural(dates.length, 'session')}`, actions: `
      <div class="seg" role="tablist" aria-label="Range">${[5, 10, 20].map(n => `<button type="button" role="tab" data-action="rep-range" data-n="${n}" aria-selected="${ui.reportRange === n}">${n} sessions</button>`).join('')}</div>
      ${lead.length > 1 ? `<select class="select" style="width:auto" data-change="rep-branch" aria-label="Branch">${options([['all', 'All branches'], ...lead.map(p => [p.id, p.branch || p.name] as [string, string])], ui.reportBranch)}</select>` : ''}
      <button class="btn sm ${canExport ? '' : 'ghost'}" type="button" data-action="rep-export" ${canExport ? '' : `disabled title="Requires ${esc(S.levelTitle(requiredLevel(S.ws().policy, 'reports.export')))}"`}>${icon(canExport ? 'download' : 'lock')}CSV</button>` });
    if (!people.length) return `${head}<section class="card">${emptyState({ icon: 'users', title: 'Nobody to report on yet', body: 'Reports cover the people in your branch. Invite or add people to get started.', actions: S.can('people.manage') ? `<a class="btn primary" href="#/team/invites">${icon('qr')}Join my team</a>` : '' })}</section>`;
    const audit = S.ws().audit.filter(e => people.some(p => p.id === e.subject) || e.actor === S.me().id).slice(0, 12);
    const branchRows = lead.map(l => {
      const members = directReports(S.org(), l.id).filter(p => people.includes(p));
      const t = summarize(dailySeries(members, recordsFor, dates));
      return { name: l.branch || l.name, rate: t.rate, n: members.length };
    }).filter(r => r.n);
    return `${head}
      <div class="kpis reveal">
        ${kpi({ label: 'Attendance rate', value: total.rate ?? '—', suffix: total.rate === null ? '' : '%', icon: 'target', key: 'rep-rate', foot: delta === null ? 'Present ÷ marked' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} pts vs previous`, accent: true })}
        ${kpi({ label: 'Completion', value: total.completion ?? '—', suffix: total.completion === null ? '' : '%', icon: 'check', key: 'rep-comp', foot: `${total.pending} unmarked` })}
        ${kpi({ label: 'Absences', value: total.absent, icon: 'x', key: 'rep-abs', foot: `Across ${plural(dates.length, 'session')}` })}
        ${kpi({ label: 'Perfect attendance', value: perfect, icon: 'trophy', key: 'rep-perfect', foot: `of ${plural(people.length, 'person', 'people')}` })}
      </div>
      <section class="card"><div class="card-head"><h2>${icon('reports')}Daily attendance</h2><div class="legend"><span><i class="present"></i>Present</span><span><i class="absent"></i>Absent</span><span><i class="pending"></i>Unmarked</span></div></div>
        ${dates.length ? chart(series) : '<p class="muted small">No scheduled sessions since this workspace was created.</p>'}
        <p class="hint">Unmarked records are never counted as absences. Sessions before ${esc(fmtDate(S.startDate()))} (workspace creation) are not shown.</p></section>
      <div class="grid two section">
        <section class="card"><div class="card-head"><h2>${icon('hierarchy')}By branch</h2><span class="pill">Rate</span></div>
          ${branchRows.length ? `<div class="hbars">${branchRows.map(r => `<div class="hbar"><span class="name" title="${esc(r.name)}">${esc(r.name)}</span><span class="track"><span class="fill" data-width="${r.rate ?? 0}%"></span><span class="target" style="left:${cfg.targetPct}%" title="Target ${cfg.targetPct}%"></span></span><span class="val">${r.rate === null ? '—' : `${r.rate}%`}</span></div>`).join('')}</div><p class="hint" style="margin-top:10px">Marker shows the ${cfg.targetPct}% coverage target.</p>` : '<p class="muted small">Branch rates appear once leaders have people reporting to them.</p>'}
        </section>
        <section class="card"><div class="card-head"><h2>${icon('history')}Audit log</h2><span class="pill">${S.ws().audit.length} events</span></div>
          ${audit.length ? `<div class="list">${audit.map(e => {
            const actor = S.org().byId.get(e.actor)?.name ?? 'Former member', subject = S.org().byId.get(e.subject)?.name ?? 'Former member';
            const what = e.kind === 'mark' ? `marked ${subject} ${e.to}` : e.kind === 'undo' ? `undid ${subject}` : e.kind === 'correct' ? `corrected ${subject} → ${e.to ?? 'unmarked'}` : e.kind === 'join' ? `added ${subject} via QR` : e.kind === 'add' ? `added ${subject}` : e.kind === 'remove' ? `removed ${subject}` : `moved ${subject}`;
            return `<div class="row"><span class="grow"><strong class="truncate">${esc(actor)} ${esc(what)}</strong><small class="truncate">${esc(fmtDate(e.date))} · ${relativeTime(e.at)}${e.reason ? ` · “${esc(e.reason)}”` : ''}</small></span></div>`;
          }).join('')}</div>` : '<p class="muted small">Every mark, undo, correction and roster change will appear here.</p>'}
        </section>
      </div>
      <section class="card section"><div class="card-head"><h2>${icon('list')}Register</h2><div class="input-icon">${icon('search')}<input class="input" type="search" id="rep-q" placeholder="Search" value="${esc(ui.reportQuery)}" data-input="rep-q" aria-label="Search register"></div></div>
        <div class="table-wrap"><table class="table"><thead><tr>${COLS.map(([k, l, num]) => `<th ${num ? 'class="num"' : ''} aria-sort="${ui.reportSort.key === k ? (ui.reportSort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-action="rep-sort" data-key="${k}">${l}</button></th>`).join('')}</tr></thead><tbody id="rep-body">${register(people, dates)}</tbody></table></div></section>`;
  },
  mount(root) {
    const el = $('#trend-chart', root);
    if (!el) return;
    const ui = S.session.ui, cfg = S.cfg();
    const dates = sessionDates(S.session.today, ui.reportRange * 2, cfg.days, S.startDate()).slice(-ui.reportRange);
    const series = dailySeries(scopePeople(), d => S.ws().attendance[d], dates);
    const cols = $$('.col', el);
    const clear = () => { el.classList.remove('hovering'); cols.forEach(c => c.classList.remove('active')); hideTooltip(); };
    el.addEventListener('pointermove', e => {
      const hit = (e.target as Element).closest<SVGElement>('[data-i]');
      if (!hit) return clear();
      const i = Number(hit.dataset.i), d = series[i];
      if (!d) return;
      el.classList.add('hovering');
      cols.forEach((c, j) => c.classList.toggle('active', j === i));
      const rate = attendanceRate(d);
      showTooltip(`<strong>${esc(fmtDate(d.date, { weekday: 'long', month: 'short', day: 'numeric' }))}</strong>
        <div class="tt-row"><span><i class="legend-i" style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--viz-present)"></i>Present</span><b>${d.present}</b></div>
        <div class="tt-row"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--viz-absent)"></i>Absent</span><b>${d.absent}</b></div>
        <div class="tt-row"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--viz-pending)"></i>Unmarked</span><b>${d.pending}</b></div>
        <div class="tt-row"><span>Rate</span><b>${rate === null ? '—' : `${rate}%`}</b></div>`, e.clientX, (e.target as Element).getBoundingClientRect().top + 20);
    });
    el.addEventListener('pointerleave', clear);
  },
  actions: {
    'rep-range': el => { S.session.ui.reportRange = Number(el.dataset.n); bus.refresh(); },
    'rep-sort': el => {
      const s = S.session.ui.reportSort, k = el.dataset.key!;
      S.session.ui.reportSort = { key: k, dir: s.key === k ? -s.dir : k === 'name' || k === 'branch' ? 1 : -1 };
      bus.refresh();
    },
    'rep-export': () => {
      if (!S.can('reports.export')) return;
      const cfg = S.cfg(), people = scopePeople();
      const dates = sessionDates(S.session.today, S.session.ui.reportRange, cfg.days, S.startDate());
      const rows: unknown[][] = [['Name', 'Title', 'Branch', 'Date', 'Status', 'Marked at', 'Marked by', 'Method']];
      for (const d of dates) for (const p of people) {
        const r = S.ws().attendance[d]?.[p.id];
        rows.push([p.name, S.levelTitle(p.level), S.branchName(p), d, statusOf(r) ?? 'unmarked', r ? new Date(r.at).toISOString() : '', r ? S.org().byId.get(r.by)?.name ?? '' : '', r?.via ?? '']);
      }
      download(`qswipe-${cfg.name.replace(/\W+/g, '-').toLowerCase()}-${isoDate()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      toast(`Exported ${plural(rows.length - 1, 'row')}`, { icon: 'download' });
    },
  },
  inputs: {
    'rep-branch': el => { S.session.ui.reportBranch = (el as HTMLSelectElement).value; bus.refresh(); },
    'rep-q': el => {
      S.session.ui.reportQuery = (el as HTMLInputElement).value;
      const cfg = S.cfg();
      $('#rep-body')!.innerHTML = register(scopePeople(), sessionDates(S.session.today, S.session.ui.reportRange, cfg.days, S.startDate()));
    },
  },
};
