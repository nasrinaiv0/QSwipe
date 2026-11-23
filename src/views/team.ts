/** Team: org chart, people management, "Join my team" invites and "Join the team" scanning. */
import { bus } from '../bus';
import { inviteState } from '../core/codes';
import { ancestors, canAccess, canManagePerson, commitmentOf, descendants, directReports, FEATURES, isDescendant, personSummary, requiredLevel, sessionDates, statusOf } from '../core/model';
import type { Level, Person } from '../core/types';
import { expiry, openJoinScanner, openTeamScanner, showInvite, showMyJoinCode } from '../qr/flows';
import * as S from '../state/store';
import { startPreview } from '../shell';
import { $, $$, avatar, closeDialog, commitPill, confirmDialog, dialogShell, emptyState, esc, icon, levelChip, openDialog, photoFromFile, plural, statusPill, toast } from '../ui/kit';
import { cbtn, field, options, pageHead, type View } from './common';

const TABS: [string, string][] = [['chart', 'Org chart'], ['people', 'People'], ['invites', 'Invites']];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const canSeeStatus = (p: Person) => p.id === S.me().id || S.visiblePeople().some(x => x.id === p.id);
const manageable = (id: string) => canManagePerson(S.ws(), S.org(), S.me(), id);
/** People the current user may place others under: themselves (if they can manage) and leaders in their branch. */
function managerCandidates(minLevelExclusive: number, excludeId?: string): Person[] {
  const me = S.me(), o = S.org();
  const pool = S.isOwner(me) ? o.people : S.can('people.manage') ? [me, ...descendants(o, me.id)] : [];
  return pool.filter(p => p.level > minLevelExclusive && p.id !== excludeId && !(excludeId && isDescendant(o, excludeId, p.id)));
}
const label = (p: Person) => `${p.name}${p.branch ? ` · ${p.branch}` : ''} (${S.levelTitle(p.level)})`;

/* ------------------------------------------------------------------ */
/* Org chart                                                           */
/* ------------------------------------------------------------------ */

function node(p: Person): string {
  const me = S.me(), selected = (S.session.ui.orgSelected ?? me.id) === p.id;
  const inScope = isDescendant(S.org(), me.id, p.id);
  const s = canSeeStatus(p) ? statusOf(S.records(S.session.today)[p.id]) ?? null : undefined;
  const kids = directReports(S.org(), p.id);
  return `<button class="org-node ${p.id === me.id ? 'is-me' : ''} ${inScope ? 'in-scope' : ''} ${selected ? 'selected' : ''}" type="button" data-action="org-select" data-id="${p.id}" data-name="${esc(`${p.name} ${p.position} ${p.branch}`.toLowerCase())}" aria-pressed="${selected}">
    ${p.id === me.id ? '<span class="you">YOU</span>' : ''}${avatar(p, 'sm', s === undefined ? {} : { status: s })}
    <span class="grow"><strong>${esc(p.name)}</strong><small>${esc(p.level > 0 ? (p.branch || S.levelTitle(p.level)) : (p.position || S.levelTitle(0)))}${kids.length ? ` · ${kids.length}` : ''}</small></span></button>`;
}

function tree(p: Person): string {
  const kids = directReports(S.org(), p.id);
  const collapsed = S.session.ui.orgCollapsed.has(p.id);
  const leafList = kids.length && kids.every(k => !directReports(S.org(), k.id).length && k.level === 0);
  const toggle = kids.length ? `<button class="org-toggle" type="button" data-action="org-toggle" data-id="${p.id}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${esc(p.name)}'s branch" aria-expanded="${!collapsed}">${collapsed ? kids.length : '−'}</button>` : '';
  return `<li class="${kids.length ? 'has-children' : ''} ${collapsed ? 'collapsed' : ''}"><div class="org-item">${node(p)}${toggle}</div>
    ${kids.length ? `<ul class="${leafList ? 'members' : ''}">${kids.map(tree).join('')}</ul>` : ''}</li>`;
}

function outline(): string {
  const rows: string[] = [];
  const walk = (p: Person, depth: number) => {
    const s = canSeeStatus(p) ? statusOf(S.records(S.session.today)[p.id]) ?? null : undefined;
    rows.push(`<button class="o-row ${p.id === S.me().id ? 'is-me' : ''}" type="button" style="--depth:${depth}" data-action="org-select" data-id="${p.id}" data-name="${esc(`${p.name} ${p.position} ${p.branch}`.toLowerCase())}">${avatar(p, 'sm', s === undefined ? {} : { status: s })}<span class="grow"><strong>${esc(p.name)}</strong><small>${esc(S.levelTitle(p.level))}${p.branch ? ` · ${esc(p.branch)}` : ''}</small></span>${icon('chevronRight')}</button>`);
    directReports(S.org(), p.id).forEach(k => walk(k, depth + 1));
  };
  S.org().roots.forEach(r => walk(r, 0));
  return rows.join('');
}

function detail(p: Person): string {
  const o = S.org(), me = S.me(), kids = directReports(o, p.id), all = descendants(o, p.id);
  const visible = canSeeStatus(p);
  const dates = sessionDates(S.session.today, 10, S.cfg().days, S.startDate());
  const summary = visible ? personSummary(p, d => S.ws().attendance[d], dates) : null;
  const chain = ancestors(o, p.id).reverse();
  const canAddUnder = p.level > 0 && (p.id === me.id ? S.can('people.manage') : manageable(p.id));
  return `<section class="card"><div class="detail-head">${avatar(p, 'xl', { label: true })}<div class="grow"><h2>${esc(p.name)}</h2><p class="muted small">${esc(p.position || S.levelTitle(p.level))}</p><div class="cluster" style="margin-top:6px">${levelChip(p, S.cfg().titles)}${S.isOwner(p) ? '<span class="pill accent">Owner</span>' : ''}${p.joined === 'invite' ? `<span class="pill info">${icon('qr')}Joined via QR</span>` : ''}</div></div></div>
    ${chain.length ? `<div class="chain" style="margin-top:12px" aria-label="Reports to">${chain.map(a => `<button type="button" data-action="org-select" data-id="${a.id}">${esc(a.name)}</button>${icon('chevronRight')}`).join('')}<span>${esc(p.name)}</span></div>` : ''}
    <div class="facts" style="margin-top:12px">
      <div class="fact"><small>Direct reports</small><strong>${kids.length}</strong></div>
      <div class="fact"><small>Whole branch</small><strong>${all.length}</strong></div>
      <div class="fact"><small>Today</small>${visible ? statusPill(statusOf(S.records(S.session.today)[p.id])) : `<span class="pill">${icon('lock')}Outside scope</span>`}</div>
      <div class="fact"><small>Next session</small>${visible ? commitPill(commitmentOf(S.commitmentsFor()[p.id])) : '<span class="muted">—</span>'}</div>
    </div>
    ${summary && dates.length ? `<div style="margin-top:12px"><div class="between small"><span class="muted">Last ${plural(dates.length, 'session')}</span><b>${summary.rate === null ? '—' : `${summary.rate}%`} · streak ${summary.streak}</b></div><div class="mini-days" style="margin-top:6px">${dates.map(d => `<span class="${statusOf(S.ws().attendance[d]?.[p.id]) ?? ''}" title="${d}"></span>`).join('')}</div></div>` : ''}
    <div class="cluster" style="margin-top:14px">
      ${(p.id === S.self().id && !S.session.previewId) || manageable(p.id) ? `<button class="btn sm" type="button" data-action="person-edit" data-id="${p.id}">${icon('edit')}Edit</button>` : ''}
      ${canAddUnder ? `<button class="btn sm" type="button" data-action="person-add" data-parent="${p.id}">${icon('plus')}Add report</button><button class="btn sm soft" type="button" data-action="invite-quick" data-parent="${p.id}">${icon('qr')}Invite</button>` : ''}
      ${S.canPreview() && p.id !== S.self().id ? `<button class="btn sm ghost" type="button" data-action="person-preview" data-id="${p.id}">${icon('eye')}Preview as</button>` : ''}
      ${manageable(p.id) ? `<button class="btn sm ghost" type="button" data-action="person-remove" data-id="${p.id}">${icon('trash')}Remove</button>` : ''}
    </div></section>`;
}

function accessCard(): string {
  const me = S.me(), w = S.ws();
  const allowed = FEATURES.filter(f => canAccess(w, me, f.key)).length;
  return `<details class="card disclosure"><summary class="card-head"><h2>Your access</h2><span class="cluster">${levelChip(me, S.cfg().titles)}<span class="pill">${allowed}/${FEATURES.length}</span>${icon('chevronDown', 'chev')}</span></summary><div class="access-list">${FEATURES.map(f => {
    const ok = canAccess(w, me, f.key), need = f.ownerOnly ? 'Owner only' : S.levelTitle(requiredLevel(w.policy, f.key));
    return `<div class="access-item ${ok ? 'yes' : 'no'}">${icon(ok ? 'check' : 'lock')}<span>${esc(f.label)}</span>${ok ? '' : `<span class="req pill outline">${esc(need)}</span>`}</div>`;
  }).join('')}</div>${S.can('settings.access') ? `<a class="btn sm block" href="#/settings/access" style="margin-top:12px">${icon('settings')}Edit policy</a>` : ''}</details>`;
}

/* ------------------------------------------------------------------ */
/* People table & invites                                              */
/* ------------------------------------------------------------------ */

function peopleTable(): string {
  const o = S.org(), today = S.records(S.session.today);
  return `<section class="card flush"><div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Title</th><th>Branch</th><th>Reports to</th><th>Joined</th><th>Today</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
    ${o.people.slice().sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)).map(p => `<tr><td><span class="person">${avatar(p, 'xs')}<button class="btn sm ghost" type="button" data-action="org-select" data-id="${p.id}" style="padding:0 4px">${esc(p.name)}</button></span></td>
      <td>${esc(S.levelTitle(p.level))}</td><td>${esc(S.branchName(p) || '—')}</td><td>${esc(o.byId.get(p.parentId ?? '')?.name ?? '—')}</td>
      <td>${p.joined === 'invite' ? `<span class="pill info">${icon('qr')}QR</span>` : p.joined === 'owner' ? '<span class="pill accent">Owner</span>' : '<span class="pill">Manual</span>'}</td>
      <td>${canSeeStatus(p) ? statusPill(statusOf(today[p.id])) : '<span class="muted">—</span>'}</td>
      <td class="num">${manageable(p.id) ? `<button class="btn sm ghost icon-only" type="button" data-action="person-edit" data-id="${p.id}" aria-label="Edit ${esc(p.name)}">${icon('edit')}</button><button class="btn sm ghost icon-only" type="button" data-action="person-remove" data-id="${p.id}" aria-label="Remove ${esc(p.name)}">${icon('trash')}</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div></section>`;
}

function invitesTab(): string {
  const me = S.me(), w = S.ws();
  const joinCard = `<section class="card"><div class="card-head"><h2>Join the team</h2></div>
    <div class="cluster"><button class="btn primary" type="button" data-action="join-team">${icon('camera')}Scan invite</button>${w.link ? `<button class="btn" type="button" data-action="show-join-code">${icon('userPlus')}My confirmation</button>` : ''}</div></section>`;
  if (!S.can('people.manage')) return `<div class="grid two">${joinCard}<section class="card">${emptyState({ icon: 'lock', title: 'Inviting is for leaders', body: `${S.levelTitle(requiredLevel(w.policy, 'people.manage'))} and above can show a “Join my team” code.` })}</section></div>`;
  const branches = managerCandidates(0);
  const first = branches[0] ?? me;
  const list = w.invites.filter(i => S.isOwner(me) || i.parentId === me.id || isDescendant(S.org(), me.id, i.parentId));
  return `<div class="grid main-side">
    <section class="card"><div class="card-head"><h2>Join my team</h2></div>
      <form class="form-grid" id="invite-form" data-submit="invite-create">
        ${field({ id: 'inv-parent', label: 'Joins under', control: `<select class="select" id="inv-parent" data-change="inv-parent">${options(branches.map(p => [p.id, label(p)]), first.id)}</select>` })}
        ${field({ id: 'inv-level', label: 'As', control: `<select class="select" id="inv-level">${levelOptions(first.level, 0)}</select>` })}
        ${field({ id: 'inv-hours', label: 'Expires after', control: `<select class="select" id="inv-hours">${options([[24, '24 hours'], [72, '3 days'], [168, '7 days']], 72)}</select>` })}
        ${field({ id: 'inv-uses', label: 'Maximum joins', control: `<select class="select" id="inv-uses">${options([[1, '1 person'], [5, '5 people'], [25, '25 people'], [100, '100 people']], 25)}</select>` })}
        <div class="span-2"><button class="btn primary block" type="submit">${icon('qr')}Show invite QR</button></div>
      </form></section>
    <div class="stack loose">${joinCard}
      <section class="card"><div class="card-head"><h2>Invites</h2><button class="btn sm" type="button" data-action="scan">${icon('scan')}Scan</button></div>
        ${list.length ? list.map(i => {
          const st = inviteState(i), parent = S.org().byId.get(i.parentId);
          return `<div class="invite-row"><span><strong>${esc(parent?.branch || parent?.name || 'Removed branch')} · ${esc(S.levelTitle(i.level))}</strong><small>${st === 'active' ? `Expires ${esc(expiry(i.expiresAt))}` : st} · ${i.uses}/${i.maxUses} joined</small></span>
            <span class="cluster">${st === 'active' ? `<button class="btn sm" type="button" data-action="invite-show" data-id="${i.id}">${icon('qr')}Show</button><button class="btn sm ghost" type="button" data-action="invite-revoke" data-id="${i.id}">Revoke</button>` : `<span class="pill ${st === 'used' ? 'good' : ''}">${st}</span>`}</span></div>`;
        }).join('') : '<p class="muted small">No invites yet.</p>'}</section></div></div>`;
}

const levelOptions = (parentLevel: number, selected: number) => options(([0, 1, 2] as Level[]).filter(l => l < parentLevel).map(l => [l, S.levelTitle(l)]), selected);

/* ------------------------------------------------------------------ */
/* Add / edit dialog                                                   */
/* ------------------------------------------------------------------ */

function personDialog(o: { id?: string; parentId?: string }) {
  const editing = o.id ? S.org().byId.get(o.id) : undefined;
  const isSelf = editing?.id === S.self().id;
  const canPlace = !editing || manageable(editing.id) || (isSelf && S.isOwner(editing));
  const parent = S.org().byId.get(o.parentId ?? editing?.parentId ?? '') ?? (editing ? undefined : S.me());
  let level: Level = editing?.level ?? (Math.max(0, (parent?.level ?? 1) - 1) as Level);
  let photo: string | null | undefined = undefined;
  const maxLevel = editing && !editing.parentId ? 3 : Math.max(0, (parent?.level ?? 1) - 1);
  const body = `<form class="stack" id="person-form" autocomplete="off">
    <div class="photo-input"><span id="pp-preview">${avatar(editing ?? ({ id: 'new', name: '?', level, parentId: null, position: '', branch: '', joined: 'manual', createdAt: 0 } as Person), 'lg')}</span>
      <div class="cluster"><label class="btn sm" for="pp-file">${icon('image')}Photo</label><input class="sr-only" type="file" id="pp-file" accept="image/*">${editing?.photo ? `<button class="btn sm ghost" type="button" id="pp-remove">Remove</button>` : ''}</div></div>
    <div class="form-grid">
      ${field({ id: 'pp-name', label: 'Full name', control: `<input class="input" id="pp-name" required maxlength="60" value="${esc(editing?.name ?? '')}">` })}
      ${field({ id: 'pp-pos', label: 'Position', control: `<input class="input" id="pp-pos" maxlength="60" value="${esc(editing?.position ?? '')}" placeholder="Optional">` })}
      ${canPlace ? `${field({ id: 'pp-level', label: 'Level', control: `<select class="select" id="pp-level">${options(([0, 1, 2, 3] as Level[]).filter(l => l <= maxLevel).map(l => [l, `L${l} · ${S.levelTitle(l)}`]), level)}</select>` })}
      ${editing && !editing.parentId ? '<div></div>' : field({ id: 'pp-parent', label: 'Reports to', control: `<select class="select" id="pp-parent"></select>` })}` : ''}
      ${field({ id: 'pp-branch', label: `${level === 1 ? S.cfg().groupLabel : S.cfg().unitLabel} they lead`, cls: 'span-2', control: `<input class="input" id="pp-branch" maxlength="40" value="${esc(editing?.branch ?? '')}" placeholder="e.g. Orion">` })}
    </div><p class="form-error" id="pp-error" role="alert"></p></form>`;
  openDialog({
    label: editing ? 'Edit person' : 'Add person', className: 'wide',
    html: dialogShell({ title: editing ? `Edit ${editing.name}` : 'Add a person', sub: editing ? '' : 'No check-in pass · use Join my team for QR', body, foot: `<button class="btn ghost" type="button" data-action="dialog-close">Cancel</button><button class="btn primary" type="submit" form="person-form">${editing ? 'Save' : 'Add person'}</button>` }),
    onOpen: d => {
      const levelSel = $<HTMLSelectElement>('#pp-level', d), parentSel = $<HTMLSelectElement>('#pp-parent', d), branchField = $('#pp-branch', d)!.closest<HTMLElement>('.field')!;
      const sync = () => {
        level = (levelSel ? Number(levelSel.value) : level) as Level;
        branchField.hidden = level === 0;
        branchField.querySelector('label')!.textContent = `${level === 1 ? S.cfg().groupLabel : S.cfg().unitLabel} they lead`;
        if (parentSel) {
          const current = parentSel.value || parent?.id || '';
          const cands = managerCandidates(level, editing?.id);
          parentSel.innerHTML = cands.length ? options(cands.map(p => [p.id, label(p)]), cands.some(c => c.id === current) ? current : cands[0]!.id) : '<option value="">No valid manager at a higher level</option>';
        }
      };
      levelSel?.addEventListener('change', sync);
      sync();
      $<HTMLInputElement>('#pp-name', d)!.focus();
      $<HTMLInputElement>('#pp-file', d)!.addEventListener('change', async e => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          photo = await photoFromFile(file);
          $('#pp-preview', d)!.innerHTML = `<span class="avatar lg"><img src="${photo}" alt=""></span>`;
        } catch (err) { $('#pp-error', d)!.textContent = (err as Error).message; }
      });
      $('#pp-remove', d)?.addEventListener('click', () => { photo = null; $('#pp-preview', d)!.innerHTML = avatar({ ...editing!, photo: undefined } as Person, 'lg'); });
      $('#person-form', d)!.addEventListener('submit', e => {
        e.preventDefault();
        const input = {
          name: $<HTMLInputElement>('#pp-name', d)!.value, position: $<HTMLInputElement>('#pp-pos', d)!.value, level,
          parentId: parentSel ? parentSel.value || null : editing?.parentId ?? parent?.id ?? null,
          branch: $<HTMLInputElement>('#pp-branch', d)!.value, ...(photo !== undefined ? { photo } : {}),
        };
        if (editing) {
          const res = S.updatePerson(editing.id, input);
          if (!res.ok) { $('#pp-error', d)!.textContent = res.error; return; }
        } else {
          const res = S.addPerson(input);
          if (!res.ok) { $('#pp-error', d)!.textContent = res.error; return; }
          S.session.ui.orgSelected = res.person.id;
        }
        closeDialog(true);
        bus.refresh({ shell: true });
        toast(editing ? 'Saved' : `${input.name.trim()} added`, { icon: 'check' });
      });
    },
  });
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

function tabFor(sub: string) {
  if (TABS.some(t => t[0] === sub)) return sub;
  if (sub && S.org().byId.has(sub)) { S.session.ui.orgSelected = sub; return 'chart'; }
  return S.session.ui.teamTab || 'chart';
}

export const team: View = {
  render(sub) {
    const tab = (S.session.ui.teamTab = tabFor(sub));
    const w = S.ws(), me = S.me();
    const active = w.invites.filter(i => inviteState(i) === 'active').length;
    const selected = S.org().byId.get(S.session.ui.orgSelected ?? '') ?? me;
    const head = pageHead({ title: 'Team', lede: plural(w.people.length, 'person', 'people'), actions: `
      ${cbtn({ label: 'Scan QR', icon: 'scan', action: 'scan' })}
      ${S.can('people.manage') ? `${cbtn({ label: 'Add person', icon: 'plus', action: 'person-add', attrs: `data-parent="${me.id}"` })}<button class="btn primary" type="button" data-action="invite-quick" data-parent="${me.id}">${icon('qr')}Join my team</button>` : `<button class="btn primary" type="button" data-action="join-team">${icon('camera')}Join the team</button>`}` });
    const tabs = `<div class="seg" role="tablist" aria-label="Team views" style="margin-bottom:var(--gap)">${TABS.map(([id, l]) => `<button type="button" role="tab" data-action="team-tab" data-tab="${id}" aria-selected="${tab === id}">${l}${id === 'invites' && active ? ` <span class="count">${active}</span>` : ''}</button>`).join('')}</div>`;
    if (tab === 'people') return `${head}${tabs}${peopleTable()}`;
    if (tab === 'invites') return `${head}${tabs}${invitesTab()}`;
    const solo = w.people.length === 1;
    return `${head}${tabs}<div class="grid main-side">
      <section class="card"><div class="org-toolbar"><div class="input-icon">${icon('search')}<input class="input" type="search" id="team-q" placeholder="Find someone" data-input="team-q" value="${esc(S.session.ui.orgQuery)}" aria-label="Find someone"></div>
        <button class="btn sm ghost" type="button" data-action="org-expand">${icon('chevrons')}Expand</button><button class="btn sm ghost" type="button" data-action="org-collapse">${icon('collapse')}Collapse</button></div>
        <div class="org-scroll hide-sm"><div class="org"><ul>${S.org().roots.map(tree).join('')}</ul></div></div>
        <div class="outline show-sm">${outline()}</div>
        ${solo ? `<div class="divider"></div>${emptyState({ icon: 'userPlus', title: 'Build your team', body: 'Show a “Join my team” QR code to onboard people from their own phones, or add people manually.', actions: S.can('people.manage') ? `<button class="btn primary" type="button" data-action="invite-quick" data-parent="${me.id}">${icon('qr')}Join my team</button><button class="btn" type="button" data-action="person-add" data-parent="${me.id}">${icon('plus')}Add manually</button>` : '' })}` : ''}
      </section>
      <div class="stack loose">${detail(selected)}${accessCard()}</div></div>`;
  },
  mount(root) {
    if (S.session.ui.orgQuery) team.inputs!['team-q']!($('#team-q', root)!, new Event('input'));
    $('.org-node.selected', root)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  },
  actions: {
    'team-tab': el => { S.session.ui.teamTab = el.dataset.tab!; bus.navigate('team', el.dataset.tab!); },
    'org-select': el => { S.session.ui.orgSelected = el.dataset.id!; S.session.ui.teamTab = 'chart'; if (S.session.route.sub && S.session.route.sub !== 'chart') bus.navigate('team', 'chart'); else bus.refresh(); },
    'org-toggle': el => { const c = S.session.ui.orgCollapsed, id = el.dataset.id!; c.has(id) ? c.delete(id) : c.add(id); bus.refresh(); },
    'org-expand': () => { S.session.ui.orgCollapsed.clear(); bus.refresh(); },
    'org-collapse': () => { S.ws().people.forEach(p => { if (p.level === 1 && directReports(S.org(), p.id).length) S.session.ui.orgCollapsed.add(p.id); }); bus.refresh(); },
    'person-add': el => personDialog({ parentId: el.dataset.parent! }),
    'person-edit': el => personDialog({ id: el.dataset.id! }),
    'person-preview': el => startPreview(el.dataset.id!),
    'person-remove': async el => {
      const p = S.org().byId.get(el.dataset.id!);
      if (!p) return;
      const kids = directReports(S.org(), p.id).length;
      if (!(await confirmDialog({ title: `Remove ${p.name}?`, body: `${kids ? `Their ${plural(kids, 'direct report')} will move up to ${S.org().byId.get(p.parentId ?? '')?.name ?? 'the top level'}. ` : ''}Past attendance stays in reports as “Former member”.`, confirmLabel: 'Remove', danger: true }))) return;
      const res = S.removePerson(p.id);
      if (!res.ok) return void toast(res.error, { icon: 'alert' });
      bus.refresh({ shell: true });
      toast(`${p.name} removed`, { icon: 'trash', action: { label: 'Undo', fn: () => { S.restorePeople(res.snapshot); bus.refresh({ shell: true }); } }, duration: 6000 });
    },
    'invite-quick': el => {
      const parent = S.org().byId.get(el.dataset.parent!) ?? S.me();
      if (parent.level === 0) return void toast('Members cannot have people reporting to them.');
      const res = S.newInvite(parent.id, 0, 72, 25);
      if (!res.ok) return void toast(res.error, { icon: 'alert' });
      showInvite(res.invite);
    },
    'invite-create': form => {
      const val = (id: string) => $<HTMLSelectElement>(id, form)!.value;
      const res = S.newInvite(val('#inv-parent'), Number(val('#inv-level')) as Level, Number(val('#inv-hours')), Number(val('#inv-uses')));
      if (!res.ok) return void toast(res.error, { icon: 'alert' });
      bus.refresh();
      showInvite(res.invite);
    },
    'invite-show': el => { const inv = S.ws().invites.find(i => i.id === el.dataset.id); if (inv) showInvite(inv); },
    'invite-revoke': el => { S.revokeInvite(el.dataset.id!); bus.refresh(); toast('Invite revoked. Its QR code no longer adds people.', { icon: 'ban' }); },
    'join-team': () => openJoinScanner(),
    'show-join-code': () => showMyJoinCode(),
    scan: () => openTeamScanner(),
  },
  inputs: {
    'team-q': el => {
      const q = (el as HTMLInputElement).value.trim().toLowerCase();
      S.session.ui.orgQuery = q;
      $$('[data-name]').forEach(n => { n.classList.toggle('dim', !!q && !n.dataset.name!.includes(q)); n.classList.toggle('match', !!q && n.dataset.name!.includes(q)); });
    },
    'inv-parent': el => {
      const p = S.org().byId.get((el as HTMLSelectElement).value);
      const lv = $<HTMLSelectElement>('#inv-level');
      if (p && lv) lv.innerHTML = levelOptions(p.level, 0);
    },
  },
};
