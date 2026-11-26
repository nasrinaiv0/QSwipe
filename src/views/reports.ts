import { historicalBranch, historicalPeople, historicalScope, historicalSeries, reportDates, rosterAt, snapshotAt } from '../core/history';
import { bus } from '../bus';
import { attendanceRate, directReports, isoDate, personSummary, relativeTime, requiredLevel, statusOf, summarize, toCSV, type RosterStats } from '../core/model';
import type { Person } from '../core/types';
import * as S from '../state/store';
import { $, $$, avatar, download, emptyState, esc, fmtDate, hideTooltip, icon, lockedPanel, plural, showTooltip, statusPill, toast } from '../ui/kit';
import { kpi, options, pageHead, type View } from './common';

type Day = RosterStats & { date: string };

let dateCache = new Map<string,Person[]>(), eligibleCache = new Map<string,Set<string>>();
const clearReportCache = () => { dateCache=new Map();eligibleCache=new Map(); };
const dateScope = (date: string) => {
  if(!dateCache.has(date))dateCache.set(date,historicalScope(S.ws(),S.me(),date,S.session.ui.reportBranch));
  return dateCache.get(date)!;
};
const eligibleIds = (date: string) => {
  if(!eligibleCache.has(date))eligibleCache.set(date,new Set(dateScope(date).map(p=>p.id)));
  return eligibleCache.get(date)!;
};
const datesFor = (count: number) => reportDates(S.ws(), S.session.today, count);
const scopePeople = (dates: string[]) => historicalPeople(S.ws(), S.me(), dates, S.session.ui.reportBranch);
const seriesFor = (dates: string[]) => historicalSeries(S.ws(), S.me(), dates, S.session.ui.reportBranch);
const eligibleDates = (p: Person, dates: string[]) => dates.filter(d=>eligibleIds(d).has(p.id));
const reportBranch = (p: Person, dates: string[]) => { const d=eligibleDates(p,dates).at(-1);return d?historicalBranch(S.ws(),p,d):''; };

function leaders(people: Person[]): Person[] {
  const ids = new Set(people.map(p => p.id));
  return [S.me(), ...people].filter(p => directReports(S.org(), p.id).some(r => ids.has(r.id)));
}

const H = 210, PAD = { l: 28, r: 6, t: 10, b: 26 };
/** Chart width follows the page so text stays at its real size on phones. */
const chartWidth = () => Math.max(280, Math.min(760, (document.getElementById('main')?.clientWidth ?? 760) - 48));
function roundedTop(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h, w / 2);
  return `M${x} ${y + h}V${y + rr}Q${x} ${y} ${x + rr} ${y}H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}V${y + h}Z`;
}

function chart(series: Day[]): string {
  const W = chartWidth();
  const max = Math.max(1, ...series.map(d => d.scheduled));
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b, band = iw / Math.max(1, series.length), bw = Math.min(30, band * 0.62);
  const y = (v: number) => PAD.t + ih - (v / max) * ih;
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const every = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor((W - PAD.l) / 46))));
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
  const rows = people.filter(p => !q || `${p.name} ${reportBranch(p,dates)}`.toLowerCase().includes(q)).map(p => ({ p, branch: reportBranch(p,dates), ...personSummary(p, recordsFor, eligibleDates(p,dates)), today: eligibleIds(S.session.today).has(p.id)?statusOf(S.records(S.session.today)[p.id]):undefined }));
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
  return rows.map(r => `<tr><td><span class="person">${avatar(r.p, 'xs')}<span>${esc(r.p.name)}</span></span></td><td class="opt">${esc(r.branch || '—')}</td><td class="num">${r.present}</td><td class="num">${r.absent}</td><td class="num opt">${r.pending}</td><td class="num">${r.rate === null ? '—' : `${r.rate}%`}</td><td class="num opt">${r.streak}</td><td>${statusPill(r.today)}</td></tr>`).join('')
    || '<tr><td colspan="8" class="muted">Nobody matches.</td></tr>';
}

/** key, label, numeric, optional (hidden on phones) */
const COLS: [string, string, boolean, boolean][] = [['name', 'Name', false, false], ['branch', 'Branch', false, true], ['present', 'In', true, false], ['absent', 'Out', true, false], ['pending', 'Unmarked', true, true], ['rate', 'Rate', true, false], ['streak', 'Streak', true, true], ['today', 'Today', false, false]];

export const reports: View = {
  render() {
    clearReportCache();
    const cfg = S.cfg();
    if (!S.can('reports.view')) return `${pageHead({ title: 'Reports' })}<section class="card">${lockedPanel({ title: 'Reports are locked for your level', need: cfg.titles[Math.min(3, requiredLevel(S.ws().policy, 'reports.view')) as 0] })}</section>`;
    const ui = S.session.ui, lead = leaders(S.visiblePeople());
    const all = datesFor(ui.reportRange * 2);
    const dates = all.slice(-ui.reportRange), prev = all.slice(0, Math.max(0, all.length - ui.reportRange)), people=scopePeople(dates);
    const recordsFor = (d: string) => S.ws().attendance[d];
    const series = seriesFor(dates), total = summarize(series), before = summarize(seriesFor(prev));
    const delta = total.rate !== null && before.rate !== null ? total.rate - before.rate : null;
    const perfect = people.filter(p => { const s = personSummary(p, recordsFor, eligibleDates(p,dates)); return s.present > 0 && s.absent === 0 && s.pending === 0; }).length;
    const canExport = S.can('reports.export');
    const head = pageHead({ title: 'Reports', lede: `${plural(people.length, 'person', 'people')} · ${plural(dates.length, 'session')}`, actions: `
      <div class="seg" role="tablist" aria-label="Sessions">${[5, 10, 20].map(n => `<button type="button" role="tab" data-action="rep-range" data-n="${n}" aria-selected="${ui.reportRange === n}" aria-label="Last ${n} sessions">${n}</button>`).join('')}</div>
      ${lead.length > 1 ? `<select class="select" style="width:auto" data-change="rep-branch" aria-label="Branch">${options([['all', 'All branches'], ...lead.map(p => [p.id, p.branch || p.name] as [string, string])], ui.reportBranch)}</select>` : ''}
      <button class="btn sm ${canExport ? '' : 'ghost'}" type="button" data-action="rep-export" ${canExport ? '' : `disabled title="Requires ${esc(S.levelTitle(requiredLevel(S.ws().policy, 'reports.export')))}"`}>${icon(canExport ? 'download' : 'lock')}CSV</button>` });
    if (!people.length) return `${head}<section class="card">${emptyState({ icon: 'users', title: 'Nobody to report on yet', body: 'Invite people to your branch first.', actions: S.can('people.manage') ? `<a class="btn primary" href="#/team/invites">${icon('qr')}Join my team</a>` : '' })}</section>`;
    const audit = S.ws().audit.filter(e => people.some(p => p.id === e.subject) || e.actor === S.me().id).slice(0, 12);
    const groups = new Map<string,{name:string;present:number;absent:number;n:number}>();
    for(const d of dates){const roster=rosterAt(S.ws(),d);for(const p of dateScope(d)){const leader=roster.find(x=>x.id===p.parentId);const key=leader?.id??'unassigned';const g=groups.get(key)??{name:leader?(leader.branch||leader.name):'Unassigned',present:0,absent:0,n:0};const st=statusOf(recordsFor(d)?.[p.id]);if(st==='present')g.present++;if(st==='absent')g.absent++;g.n++;groups.set(key,g);}}
    const branchRows=[...groups.values()].map(g=>({...g,rate:attendanceRate(g)}));
    return `${head}
      <div class="kpis reveal">
        ${kpi({ label: 'Attendance rate', value: total.rate ?? '—', suffix: total.rate === null ? '' : '%', icon: 'target', key: 'rep-rate', foot: delta === null ? 'Present ÷ marked' : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} pts vs previous`, accent: true })}
        ${kpi({ label: 'Completion', value: total.completion ?? '—', suffix: total.completion === null ? '' : '%', icon: 'check', key: 'rep-comp', foot: `${total.pending} unmarked` })}
        ${kpi({ label: 'Absences', value: total.absent, icon: 'x', key: 'rep-abs' })}
        ${kpi({ label: 'Perfect', value: perfect, icon: 'trophy', key: 'rep-perfect', foot: `of ${people.length}` })}
      </div>
      <section class="card"><div class="card-head"><h2>Daily</h2><div class="legend"><span><i class="present"></i>Present</span><span><i class="absent"></i>Absent</span><span><i class="pending"></i>Unmarked</span></div></div>
        ${dates.length ? chart(series) : '<p class="muted small">No scheduled sessions since this workspace was created.</p>'}
        <p class="hint">Unmarked records are never counted as absences. Roster changes apply from the next local date. ${dates.some(d=>!snapshotAt(S.ws(),d))?'Older dates show identifiable marked records only; eligibility was not recorded.':''}</p></section>
      <div class="grid two section">
        <section class="card"><div class="card-head"><h2>${icon('hierarchy')}By branch</h2><span class="pill">Rate</span></div>
          ${branchRows.length ? `<div class="hbars">${branchRows.map(r => `<div class="hbar"><span class="name" title="${esc(r.name)}">${esc(r.name)}</span><span class="track"><span class="fill" data-width="${r.rate ?? 0}%"></span><span class="target" style="left:${cfg.targetPct}%" title="Target ${cfg.targetPct}%"></span></span><span class="val">${r.rate === null ? '—' : `${r.rate}%`}</span></div>`).join('')}</div>` : '<p class="muted small">Branch rates appear once leaders have people reporting to them.</p>'}
        </section>
        <section class="card"><div class="card-head"><h2>${icon('history')}Audit log</h2><span class="pill">${S.ws().audit.length} events</span></div>
          ${audit.length ? `<div class="list">${audit.map(e => {
            const actor = S.org().byId.get(e.actor)?.name ?? 'Former member', subject = S.org().byId.get(e.subject)?.name ?? 'Former member';
            const what = e.kind === 'mark' ? `marked ${subject} ${e.to}` : e.kind === 'undo' ? `undid ${subject}` : e.kind === 'correct' ? `corrected ${subject} → ${e.to ?? 'unmarked'}` : e.kind === 'join' ? `added ${subject} via QR` : e.kind === 'add' ? `added ${subject}` : e.kind === 'remove' ? `removed ${subject}` : `moved ${subject}`;
            return `<div class="row"><span class="grow"><strong class="truncate">${esc(actor)} ${esc(what)}</strong><small class="truncate">${esc(fmtDate(e.date))} · ${relativeTime(e.at)}${e.reason ? ` · “${esc(e.reason)}”` : ''}</small></span></div>`;
          }).join('')}</div>` : '<p class="muted small">No activity yet.</p>'}
        </section>
      </div>
      <section class="card section"><div class="card-head"><h2>${icon('list')}Register</h2><div class="input-icon">${icon('search')}<input class="input" type="search" id="rep-q" placeholder="Search" value="${esc(ui.reportQuery)}" data-input="rep-q" aria-label="Search register"></div></div>
        <div class="table-wrap"><table class="table"><thead><tr>${COLS.map(([k, l, num, opt]) => `<th class="${num ? 'num' : ''} ${opt ? 'opt' : ''}" aria-sort="${ui.reportSort.key === k ? (ui.reportSort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-action="rep-sort" data-key="${k}">${l}</button></th>`).join('')}</tr></thead><tbody id="rep-body">${register(people, dates)}</tbody></table></div></section>`;
  },
  mount(root) {
    clearReportCache();
    const el = $('#trend-chart', root);
    if (!el) return;
    const ui = S.session.ui;
    const dates = datesFor(ui.reportRange);
    const series = seriesFor(dates);
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
      clearReportCache();
      if (!S.can('reports.export')) return;
      const cfg = S.cfg();
      const dates = datesFor(S.session.ui.reportRange);
      const rows: unknown[][] = [['Name', 'Title', 'Branch', 'Date', 'Status', 'Marked at', 'Marked by', 'Method']];
      for (const d of dates) for (const p of dateScope(d)) {
        const r = S.ws().attendance[d]?.[p.id];
        rows.push([p.name, S.levelTitle(p.level), historicalBranch(S.ws(),p,d), d, statusOf(r) ?? 'unmarked', r ? new Date(r.at).toISOString() : '', r ? rosterAt(S.ws(),d).find(x=>x.id===r.by)?.name ?? S.org().byId.get(r.by)?.name ?? '' : '', r?.via ?? '']);
      }
      download(`qswipe-${cfg.name.replace(/\W+/g, '-').toLowerCase()}-${isoDate()}.csv`, toCSV(rows), 'text/csv;charset=utf-8');
      toast(`Exported ${plural(rows.length - 1, 'row')}`, { icon: 'download' });
    },
  },
  inputs: {
    'rep-branch': el => { S.session.ui.reportBranch = (el as HTMLSelectElement).value; bus.refresh(); },
    'rep-q': el => {
      clearReportCache();
      S.session.ui.reportQuery = (el as HTMLInputElement).value;
      $('#rep-body')!.innerHTML = register(scopePeople(datesFor(S.session.ui.reportRange)), datesFor(S.session.ui.reportRange));
    },
  },
};
