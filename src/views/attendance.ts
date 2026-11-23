import { bus } from '../bus';
import { swipeThreshold } from '../core/data';
import { addDays, isIsoDate, markDecision, pendingPeople, percent, rosterStats, shiftLabel, statusOf, validateCorrection } from '../core/model';
import type { Person, Status } from '../core/types';
import { showPass } from '../qr/flows';
import * as S from '../state/store';
import { $, $$, avatar, closeDialog, confirmDialog, dialogShell, emptyState, esc, fmtDate, fmtTime, haptic, icon, openDialog, reducedMotion, ring, sound, statusPill, toast, wait } from '../ui/kit';
import { cbtn, pageHead, type View } from './common';

let busy = false;

function queue(): Person[] {
  const { ui, date } = S.session;
  if (ui.attTab === 'self') return statusOf(S.records(date)[S.me().id]) ? [] : [S.me()];
  const pending = pendingPeople(S.branch(), S.records(date));
  if (!pending.length) return [];
  const k = ui.queueOffset % pending.length;
  return [...pending.slice(k), ...pending.slice(0, k)];
}

function card(p: Person, pos: number): string {
  const cls = pos === 0 ? `top ${S.session.ui.deckEnter === 'promote' ? 'enter' : S.session.ui.deckEnter === 'return' ? 'returning' : ''}` : `behind-${pos}`;
  const branchName = S.branchName(p);
  return `<article class="swipe-card ${cls}" data-id="${p.id}" ${pos === 0 ? `tabindex="0" role="group" aria-roledescription="swipe card" aria-label="${esc(p.name)}. Swipe right or press → for present, left or ← for absent."` : 'aria-hidden="true"'} style="--from-x:${S.session.ui.returnDir * 120}%;--from-r:${S.session.ui.returnDir * 18}deg">
    <span class="stamp present">PRESENT</span><span class="stamp absent">ABSENT</span>
    <div class="sc-photo">${avatar(p, '', { label: pos === 0 })}<div class="sc-tags">${branchName ? `<span class="pill">${esc(branchName)}</span>` : '<span></span>'}<span class="pill">${esc(S.levelTitle(p.level))}</span></div></div>
    <div class="sc-body"><h3>${esc(p.name)}</h3><span class="meta">${esc(p.position || S.levelTitle(p.level))}</span></div>
  </article>`;
}

function deck(): string {
  const { date, today, ui } = S.session;
  if (date > today) return emptyState({ icon: 'clock', title: 'This session has not started', body: `Attendance for ${fmtDate(date)} opens on the day. Use Commitments to plan ahead.`, actions: `<a class="btn" href="#/commitments">${icon('commitments')}Open commitments</a>` });
  const people = S.branch();
  if (ui.attTab === 'verify' && !people.length) {
    return emptyState({ icon: 'userPlus', title: 'No one reports to you yet', body: 'Invite people with a “Join my team” QR code, or add them manually.', actions: S.can('people.manage') ? `<a class="btn primary" href="#/team/invites">${icon('qr')}Join my team</a><a class="btn" href="#/team">${icon('plus')}Add people</a>` : '' });
  }
  const q = queue();
  if (!q.length) {
    const s = rosterStats(ui.attTab === 'self' ? [S.me()] : people, S.records(date));
    return `<div class="done-card">${ring(percent(s.present + s.absent, s.scheduled), { sub: 'complete' })}<strong>All caught up</strong><p class="muted small">${ui.attTab === 'self' ? `You're marked ${esc(statusOf(S.records(date)[S.me().id]) ?? '')} for ${esc(fmtDate(date))}.` : `${s.present} present · ${s.absent} absent for ${esc(fmtDate(date))}.`}</p>
      <div class="cluster" style="justify-content:center">${S.can('reports.view') ? `<a class="btn sm" href="#/reports">${icon('reports')}Report</a>` : ''}${canUndoBtn()}</div></div>`;
  }
  const visible = q.slice(0, 3);
  return `<div class="deck-wrap">
    <div class="deck-count" aria-live="polite">${ui.attTab === 'self' ? '' : `${q.length} left`}</div>
    <div class="deck" id="deck">${visible.map((p, i) => card(p, i)).reverse().join('')}</div>
    <div class="deck-actions">
      <button class="round-btn bad" type="button" data-action="deck-mark" data-status="absent" aria-label="Mark absent (←)">${icon('x')}</button>
      <button class="round-btn small" type="button" data-action="deck-undo" aria-label="Undo (Z)" ${S.canUndo() ? '' : 'disabled'}>${icon('undo')}</button>
      ${ui.attTab === 'verify' ? `<button class="round-btn small" type="button" data-action="deck-skip" aria-label="Skip (S)" ${q.length < 2 ? 'disabled' : ''}>${icon('skip')}</button>` : ''}
      <button class="round-btn good" type="button" data-action="deck-mark" data-status="present" aria-label="Mark present (→)">${icon('check')}</button>
    </div>
    <div class="deck-hint"><span><kbd>←</kbd> absent</span><span><kbd>→</kbd> present</span>${ui.attTab === 'verify' ? '<span><kbd>S</kbd> skip</span>' : ''}<span><kbd>Z</kbd> undo</span></div>
  </div>`;
}

const canUndoBtn = () => (S.canUndo() ? `<button class="btn sm ghost" type="button" data-action="deck-undo">${icon('undo')}Undo last</button>` : '');

function rosterPeople() {
  return [S.me(), ...S.visiblePeople()];
}

function rosterRows(): string {
  const { ui, date, today } = S.session;
  const o = S.org(), me = S.me(), recs = S.records(date), branchIds = new Set(S.branch().map(p => p.id));
  const q = ui.rosterQuery.trim().toLowerCase();
  const canCorrect = S.can('attendance.correct');
  const rows = rosterPeople().filter(p => {
    const s = statusOf(recs[p.id]);
    if (ui.rosterFilter === 'pending' ? !!s : ui.rosterFilter !== 'all' && s !== ui.rosterFilter) return false;
    return !q || `${p.name} ${p.position} ${S.branchName(p)}`.toLowerCase().includes(q);
  }).map(p => {
    const rec = recs[p.id], s = statusOf(rec);
    const decision = markDecision({ ws: S.ws(), org: o, actor: me, subject: p, records: recs, date, today });
    const by = rec ? o.byId.get(rec.by) : undefined;
    return `<div class="row ${p.id === me.id ? 'me' : ''}">${avatar(p, 'sm', { status: s ?? null })}
      <span class="grow"><strong class="truncate">${esc(p.name)}${p.id === me.id ? ' <span class="muted">(you)</span>' : ''}</strong><small class="truncate">${rec ? `${fmtTime(rec.at)}${by && by.id !== p.id ? ` · by ${esc(by.name)}` : ''}${rec.via === 'pass' ? ' · QR pass' : rec.via === 'correction' ? ' · corrected' : ''}` : esc(S.branchName(p) || p.position || S.levelTitle(p.level))}</small></span>
      ${statusPill(s)}
      <span class="row-actions">${decision.ok ? `<button class="btn sm icon-only good" type="button" data-action="att-quick" data-id="${p.id}" data-status="present" aria-label="Mark ${esc(p.name)} present">${icon('check')}</button><button class="btn sm icon-only bad" type="button" data-action="att-quick" data-id="${p.id}" data-status="absent" aria-label="Mark ${esc(p.name)} absent">${icon('x')}</button>`
        : s && canCorrect && branchIds.has(p.id) ? `<button class="btn sm ghost icon-only" type="button" data-action="att-correct" data-id="${p.id}" aria-label="Correct ${esc(p.name)}" title="Correct">${icon('edit')}</button>` : ''}</span></div>`;
  }).join('');
  return rows || '<p class="muted small" style="padding:14px 0">Nobody matches this filter.</p>';
}

function roster(): string {
  const { ui, date } = S.session;
  const stats = rosterStats(rosterPeople(), S.records(date));
  const chip = (id: string, label: string, n: number) => `<button class="chip" type="button" data-action="att-filter" data-filter="${id}" aria-pressed="${ui.rosterFilter === id}">${label} <span class="count">${n}</span></button>`;
  const w = (n: number) => (stats.scheduled ? n : 0);
  return `<section class="card"><div class="card-head"><h2>Roster</h2><span class="pill">${stats.scheduled}</span></div>
    <div class="stackbar" role="img" aria-label="${stats.present} present, ${stats.absent} absent, ${stats.pending} unmarked" style="margin-bottom:8px"><span class="present" style="flex-grow:${w(stats.present)}"></span><span class="absent" style="flex-grow:${w(stats.absent)}"></span><span class="pending" style="flex-grow:${w(stats.pending)}"></span></div>
    <div class="legend" style="margin-bottom:12px"><span><i class="present"></i>Present ${stats.present}</span><span><i class="absent"></i>Absent ${stats.absent}</span><span><i class="pending"></i>Unmarked ${stats.pending}</span></div>
    <div class="input-icon" style="margin-bottom:8px">${icon('search')}<input class="input" id="att-search" type="search" placeholder="Search" value="${esc(ui.rosterQuery)}" data-input="att-search" aria-label="Search roster"></div>
    <div class="cluster chips-row" style="margin-bottom:6px">${chip('all', 'All', stats.scheduled)}${chip('pending', 'Unmarked', stats.pending)}${chip('present', 'Present', stats.present)}${chip('absent', 'Absent', stats.absent)}</div>
    <div class="list list-scroll" id="roster-list">${rosterRows()}</div></section>`;
}

/* ------------------------------------------------------------------ */
/* Swipe physics                                                       */
/* ------------------------------------------------------------------ */

async function decide(status: Status, o: { dy?: number } = {}) {
  const el = $('#deck .swipe-card.top');
  if (!el || busy) return;
  const id = el.dataset.id!;
  if (status === 'absent' && S.settings().confirmAbsent) {
    const p = S.org().byId.get(id);
    if (!(await confirmDialog({ title: 'Mark absent?', body: `${p?.name ?? 'This person'} will be marked absent for ${fmtDate(S.session.date)}.`, confirmLabel: 'Mark absent', danger: true }))) { springBack(el); return; }
  }
  busy = true;
  const res = S.mark(id, status, 'swipe');
  if (!res.ok) { springBack(el); busy = false; return void toast(res.error, { icon: 'alert' }); }
  haptic(14);
  sound.pop();
  el.classList.remove('dragging');
  el.classList.add('fly', `decided-${status}`);
  const dir = status === 'present' ? 1 : -1;
  el.style.transform = `translate(${dir * (innerWidth * 0.9 + 200)}px, ${o.dy ?? 0}px) rotate(${dir * 28}deg)`;
  el.style.opacity = '0';
  const next = $('#deck .behind-1');
  if (next) { next.style.transform = 'none'; next.style.opacity = '1'; }
  await wait(reducedMotion() ? 0 : 280);
  busy = false;
  S.session.ui.deckEnter = 'promote';
  bus.refresh({ shell: true });
  S.session.ui.deckEnter = null;
  toast(`${res.subject.name} · ${status}`, { key: 'mark', icon: status === 'present' ? 'check' : 'x', action: { label: 'Undo', fn: undo }, duration: S.settings().undoSeconds * 1000 });
}

function springBack(el: HTMLElement) {
  el.classList.remove('dragging', 'decided-present', 'decided-absent');
  el.style.transform = '';
  $$('.stamp', el).forEach(s => { s.style.opacity = ''; });
  const next = $('#deck .behind-1');
  if (next) { next.style.transform = ''; next.style.opacity = ''; }
}

function undo() {
  const res = S.undo();
  if (!res.ok) return void toast(res.error);
  S.session.ui.deckEnter = 'return';
  S.session.ui.returnDir = res.status === 'present' ? 1 : -1;
  if (S.session.ui.attTab === 'verify') S.session.ui.queueOffset = 0;
  bus.refresh({ shell: true });
  S.session.ui.deckEnter = null;
  toast('Change undone', { icon: 'undo' });
}

async function skip() {
  const el = $('#deck .swipe-card.top');
  if (!el || busy || S.session.ui.attTab !== 'verify' || queue().length < 2) return;
  busy = true;
  el.classList.add('fly');
  el.style.transform = 'translateY(40px) scale(.9)';
  el.style.opacity = '0';
  await wait(reducedMotion() ? 0 : 220);
  busy = false;
  S.session.ui.queueOffset++;
  S.session.ui.deckEnter = 'promote';
  bus.refresh();
  S.session.ui.deckEnter = null;
}

function mountDeck(root: HTMLElement) {
  const el = $('#deck .swipe-card.top', root);
  if (!el) return;
  const threshold = swipeThreshold(S.settings().swipeSensitivity);
  const stamps = { present: $('.stamp.present', el)!, absent: $('.stamp.absent', el)! };
  const next = $('#deck .behind-1', root);
  let start: { x: number; y: number } | null = null, axis: 'x' | 'y' | null = null, dx = 0, dy = 0, vx = 0, lastX = 0, lastT = 0, pid = -1;

  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || busy) return;
    start = { x: e.clientX, y: e.clientY }; axis = null; dx = dy = vx = 0; lastX = e.clientX; lastT = performance.now(); pid = e.pointerId;
  });
  el.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== pid) return;
    dx = e.clientX - start.x; dy = e.clientY - start.y;
    if (!axis) {
      if (Math.hypot(dx, dy) < 6) return;
      axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis === 'y') { start = null; return; }
      el.setPointerCapture(pid);
      el.classList.add('dragging');
    }
    const now = performance.now();
    vx = (e.clientX - lastX) / Math.max(1, now - lastT);
    lastX = e.clientX; lastT = now;
    const p = Math.min(1, Math.abs(dx) / threshold);
    el.style.transform = `translate(${dx}px, ${dy * 0.18}px) rotate(${dx / 18}deg)`;
    stamps.present.style.opacity = String(dx > 0 ? p : 0);
    stamps.absent.style.opacity = String(dx < 0 ? p : 0);
    if (next) next.style.transform = `translateY(${14 - 14 * p}px) scale(${0.95 + 0.05 * p})`;
  });
  const end = () => {
    if (!start || axis !== 'x') { start = null; return; }
    start = null;
    if (Math.abs(dx) > threshold || (Math.abs(vx) > 0.6 && Math.abs(dx) > 30)) void decide(dx > 0 ? 'present' : 'absent', { dy: dy * 0.18 });
    else springBack(el);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => { start = null; springBack(el); });
  el.addEventListener('lostpointercapture', () => { if (start) end(); });
}

/* ------------------------------------------------------------------ */
/* Corrections                                                         */
/* ------------------------------------------------------------------ */

function correctionDialog(id: string) {
  const p = S.org().byId.get(id);
  if (!p) return;
  const from = statusOf(S.records()[id]);
  let to = from === 'present' ? 'absent' : 'present';
  openDialog({
    label: 'Correct record',
    html: dialogShell({
      title: `Correct ${p.name}`, sub: `${fmtDate(S.session.date)} · currently ${from ?? 'unmarked'}. Corrections are kept in the audit log.`,
      body: `<form class="stack" id="corr-form"><div class="seg block" role="group" aria-label="New status">${[['present', 'Present'], ['absent', 'Absent'], ['clear', 'Unmarked']].map(([v, l]) => `<button type="button" data-to="${v}" aria-pressed="${v === to}" ${v === (from ?? 'clear') ? 'disabled' : ''}>${l}</button>`).join('')}</div>
        <div class="field"><label for="corr-reason">Reason</label><textarea class="input" id="corr-reason" maxlength="200" required placeholder="e.g. Approved leave was filed late"></textarea></div>
        <p class="form-error" id="corr-error" role="alert"></p></form>`,
      foot: `<button class="btn ghost" type="button" data-action="dialog-close">Cancel</button><button class="btn primary" type="submit" form="corr-form">Save correction</button>`,
    }),
    onOpen: d => {
      $$('[data-to]', d).forEach(b => b.addEventListener('click', () => { to = b.dataset.to!; $$('[data-to]', d).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
      $('#corr-reason', d)!.focus();
      $('#corr-form', d)!.addEventListener('submit', e => {
        e.preventDefault();
        const reason = $<HTMLTextAreaElement>('#corr-reason', d)!.value;
        const err = validateCorrection({ from, to, reason });
        if (err) { $('#corr-error', d)!.textContent = err; return; }
        const res = S.correct(id, to, reason);
        if (!res.ok) { $('#corr-error', d)!.textContent = res.error; return; }
        closeDialog(true);
        bus.refresh();
        toast(`${p.name} corrected`, { icon: 'check' });
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

function prevSession(dir: number) {
  let d = S.session.date;
  for (let i = 0; i < 14; i++) { d = addDays(d, dir); if (S.isSessionDay(d)) return d; }
  return addDays(S.session.date, dir);
}

export const attendance: View = {
  render() {
    const { ui, date, today } = S.session;
    const canVerify = S.can('attendance.verify');
    if (!canVerify) ui.attTab = 'self';
    const past = date < today;
    const pending = canVerify ? pendingPeople(S.branch(), S.records(date)).length : 0;
    return `${pageHead({ title: 'Attendance', lede: `${shiftLabel(S.cfg())}${S.isSessionDay(date) ? '' : ' · no session'}`, actions: `
        <div class="date-nav"><button class="btn sm ghost icon-only" type="button" data-action="att-day" data-dir="-1" aria-label="Previous session">${icon('chevronLeft')}</button>
        <input type="date" id="att-date" value="${date}" max="${addDays(today, 14)}" data-change="att-date" aria-label="Session date">
        <button class="btn sm ghost icon-only" type="button" data-action="att-day" data-dir="1" aria-label="Next session">${icon('chevronRight')}</button></div>
        ${date !== today ? `<button class="btn sm" type="button" data-action="att-today">Today</button>` : ''}
        ${canVerify ? cbtn({ label: 'Scan passes', icon: 'scan', action: 'scan' }) : S.self().passKey ? cbtn({ label: 'My pass', icon: 'qr', action: 'att-pass' }) : ''}` })}
      ${past ? `<div class="notice warn" style="margin-bottom:var(--gap)">${icon('history')}<span>Past session · changes are logged</span></div>` : ''}
      <div class="grid main-side">
        <section class="card"><div class="card-head"><h2>${ui.attTab === 'self' ? 'My check-in' : 'Queue'}</h2>
          ${canVerify ? `<div class="seg" role="tablist" aria-label="Queue"><button type="button" role="tab" data-action="att-tab" data-tab="verify" aria-selected="${ui.attTab === 'verify'}">Branch <span class="count">${pending}</span></button><button type="button" role="tab" data-action="att-tab" data-tab="self" aria-selected="${ui.attTab === 'self'}">Me</button></div>` : ''}</div>
          ${deck()}</section>
        ${roster()}
      </div>`;
  },
  mount(root) { mountDeck(root); },
  onKey(e) {
    if (S.session.route.page !== 'attendance') return false;
    if (e.key === 'ArrowRight') { void decide('present'); return true; }
    if (e.key === 'ArrowLeft') { void decide('absent'); return true; }
    if (e.key === 's') { void skip(); return true; }
    if (e.key === 'z') { undo(); return true; }
    return false;
  },
  actions: {
    'deck-mark': el => void decide(el.dataset.status as Status),
    'deck-skip': () => void skip(),
    'deck-undo': undo,
    'att-pass': () => void showPass(),
    'att-tab': el => { S.session.ui.attTab = el.dataset.tab as 'verify' | 'self'; S.session.ui.queueOffset = 0; bus.refresh(); },
    'att-filter': el => { S.session.ui.rosterFilter = el.dataset.filter!; bus.refresh(); },
    'att-day': el => { S.setDate(prevSession(Number(el.dataset.dir))); bus.refresh(); },
    'att-today': () => { S.setDate(S.session.today); bus.refresh(); },
    'att-quick': el => {
      const res = S.mark(el.dataset.id!, el.dataset.status as Status, 'swipe');
      if (!res.ok) return void toast(res.error, { icon: 'alert' });
      haptic(10);
      bus.refresh({ shell: true });
      toast(`${res.subject.name} · ${el.dataset.status}`, { key: 'mark', action: { label: 'Undo', fn: undo }, duration: S.settings().undoSeconds * 1000 });
    },
    'att-correct': el => correctionDialog(el.dataset.id!),
  },
  inputs: {
    'att-date': el => { const v = (el as HTMLInputElement).value; if (isIsoDate(v)) { S.setDate(v); bus.refresh(); } },
    'att-search': el => {
      S.session.ui.rosterQuery = (el as HTMLInputElement).value;
      $('#roster-list')!.innerHTML = rosterRows();
    },
  },
};
