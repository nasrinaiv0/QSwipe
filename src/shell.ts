/** App chrome: sidebar, topbar, tab bar, account/workspace menus, command palette and appearance. */
import { bus } from './bus';
import { descendants, requiredLevel } from './core/model';
import * as S from './state/store';
import { openJoinScanner, openTeamScanner, showMyJoinCode, showPass } from './qr/flows';
import { $, avatar, closeDialog, dialogShell, esc, firstName, icon, openDialog, plural, slideFrom, toast, withTransition } from './ui/kit';

export interface Page { id: string; label: string; icon: string; group: string; key: string; requires?: string }
export const PAGES: Page[] = [
  { id: 'today', label: 'Today', icon: 'today', group: 'Workspace', key: 't' },
  { id: 'attendance', label: 'Attendance', icon: 'attendance', group: 'Workspace', key: 'a' },
  { id: 'commitments', label: 'Commitments', icon: 'commitments', group: 'Workspace', key: 'c' },
  { id: 'reports', label: 'Reports', icon: 'reports', group: 'Workspace', key: 'r', requires: 'reports.view' },
  { id: 'team', label: 'Team', icon: 'hierarchy', group: 'People', key: 'h' },
  { id: 'updates', label: 'Updates', icon: 'updates', group: 'People', key: 'u' },
  { id: 'play', label: 'Play', icon: 'play', group: 'Engage', key: 'p' },
  { id: 'settings', label: 'Settings', icon: 'settings', group: 'System', key: 's' },
];
const TABBAR = ['today', 'attendance', 'team', 'play'];
export const modKey = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const badgeFor = (id: string) => (id === 'updates' ? S.unreadCount() : 0);
const isLocked = (p: Page) => !!p.requires && !S.can(p.requires);

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

export function renderShell() {
  const c = S.cfg(), me = S.self(), page = PAGES.find(p => p.id === S.session.route.page) ?? PAGES[0]!;
  const dark = document.documentElement.dataset.theme === 'dark';
  const groups = [...new Set(PAGES.map(p => p.group))];
  const nav = (p: Page) => {
    const badge = badgeFor(p.id), locked = isLocked(p);
    return `<a class="nav-item ${locked ? 'locked' : ''}" href="#/${p.id}" ${p.id === page.id ? 'aria-current="page"' : ''} ${locked ? `title="Requires ${esc(S.levelTitle(requiredLevel(S.ws().policy, p.requires!)))} access"` : ''}>
      ${icon(p.icon)}<span>${p.label}</span><span class="nav-tail">${badge ? `<span class="badge" aria-label="${badge} unread">${badge}</span>` : ''}${locked ? icon('lock', 'lock') : ''}</span></a>`;
  };
  $('#sidebar')!.innerHTML = `
    <a class="brand" href="#/today" aria-label="QSwipe home"><img src="./brand.svg" width="34" height="34" alt=""><span><strong>QSwipe</strong><small>People, present.</small></span></a>
    <button class="ws-switch" type="button" data-action="open-workspaces" aria-label="Workspace: ${esc(c.name)}. Switch workspace">
      <span class="ws-mark" aria-hidden="true">${esc(c.name.slice(0, 1).toUpperCase())}</span>
      <span class="grow"><strong class="truncate">${esc(c.name)}</strong><small>${plural(S.ws().people.length, 'person', 'people')}</small></span>${icon('chevrons')}
    </button>
    <nav class="nav" aria-label="Sections">${groups.map(g => `<div class="nav-label">${g}</div>${PAGES.filter(p => p.group === g).map(nav).join('')}`).join('')}</nav>
    <div class="sidebar-foot">
      <button class="me-card" type="button" data-action="open-account" aria-label="Account: ${esc(me.name)}">
        ${avatar(me, 'sm', { round: true })}<span class="grow"><strong class="truncate">${esc(me.name)}</strong><small class="truncate">${esc(S.levelTitle(me.level))}${S.isOwner(me) ? ' · Owner' : ''}</small></span>
      </button>
      <div class="demo-note"><span class="dot" aria-hidden="true"></span><span>Stored on this device only</span></div>
    </div>`;
  $('#topbar')!.innerHTML = `
    <a class="mobile-brand" href="#/today" aria-label="QSwipe home"><img src="./brand.svg" width="30" height="30" alt=""><strong>QSwipe</strong></a>
    <div class="crumbs"><span class="eyebrow">${esc(c.name)}</span><strong>${esc(page.label)}</strong></div>
    <div class="top-actions">
      <button class="search-btn" type="button" data-action="open-palette" aria-label="Search and commands (${modKey} K)">${icon('search')}<span class="label-text">Search…</span><kbd>${modKey} K</kbd></button>
      <button class="icon-btn" type="button" data-action="scan" aria-label="Scan a QR code" title="Scan QR">${icon('scan')}</button>
      <button class="icon-btn theme-toggle" type="button" data-action="toggle-theme" aria-label="Switch to ${dark ? 'light' : 'dark'} theme">${icon(dark ? 'sun' : 'moon')}</button>
      <a class="icon-btn settings-btn" href="#/settings" aria-label="Settings" title="Settings">${icon('settings')}</a>
      <button class="me-btn" type="button" data-action="open-account" aria-label="Account: ${esc(me.name)}" title="${esc(me.name)}">${avatar(me, 'sm', { round: true })}</button>
    </div>`;
  const moreActive = !TABBAR.includes(page.id), moreBadge = S.unreadCount();
  const prevTab = $('#tabbar .tab[aria-current]')?.getBoundingClientRect();
  $('#tabbar')!.innerHTML = TABBAR.map(id => PAGES.find(p => p.id === id)!).map(p => `<a class="tab" href="#/${p.id}" ${page.id === p.id ? 'aria-current="page"' : ''}>${icon(p.icon)}<span>${p.label}</span></a>`).join('')
    + `<button class="tab" type="button" data-action="open-more" ${moreActive ? 'aria-current="page"' : ''} aria-label="More${moreBadge ? `, ${moreBadge} unread` : ''}">${icon('grid')}<span>More</span>${moreBadge ? `<span class="badge">${moreBadge}</span>` : ''}</button>`;
  slideFrom(prevTab, $('#tabbar .tab[aria-current]'));
  document.title = `${page.label} · ${c.name} · QSwipe`;
}

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

const mqDark = matchMedia('(prefers-color-scheme: dark)');
const mqMotion = matchMedia('(prefers-reduced-motion: reduce)');
export function applyAppearance() {
  const s = S.settings(), root = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'system' && mqDark.matches);
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.accent = s.accent;
  s.density === 'comfortable' ? (root.dataset.density = 'comfortable') : delete root.dataset.density;
  s.textSize === 'large' ? (root.dataset.text = 'large') : delete root.dataset.text;
  s.glass !== 'regular' ? (root.dataset.glass = s.glass) : delete root.dataset.glass;
  root.dataset.ui = s.platform === 'android' || (s.platform !== 'ios' && root.dataset.os === 'android') ? 'material' : 'ios';
  s.motion === 'reduced' || (s.motion === 'system' && mqMotion.matches) ? (root.dataset.motion = 'reduce') : delete root.dataset.motion;
  $<HTMLMetaElement>('meta[name="theme-color"]')!.content = getComputedStyle(root).getPropertyValue('--bg').trim() || (dark ? '#000000' : '#f2f2f7');
}
mqDark.addEventListener('change', () => { applyAppearance(); if (S.hasWorkspace()) renderShell(); });
mqMotion.addEventListener('change', applyAppearance);

export function toggleTheme() {
  S.updateSettings({ theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' });
  const run = () => { applyAppearance(); bus.refresh({ shell: true }); };
  withTransition(run);
}

/* ------------------------------------------------------------------ */
/* Menus                                                               */
/* ------------------------------------------------------------------ */

function workspaceMenu() {
  const items = Object.values(S.data.workspaces).map(w => {
    const current = w.id === S.data.activeId;
    return `<button class="picker-item" type="button" data-action="pick-workspace" data-id="${w.id}" ${current ? 'aria-current="true"' : ''}>
      <span class="ws-mark" aria-hidden="true">${esc(w.config.name.slice(0, 1).toUpperCase())}</span>
      <span class="grow"><strong>${esc(w.config.name)}</strong><small>${plural(w.people.length, 'person', 'people')}${w.link ? ' · joined by invite' : ''}</small></span>${current ? icon('check', 'check') : icon('chevronRight')}</button>`;
  }).join('');
  openDialog({
    label: 'Workspaces',
    html: dialogShell({
      title: 'Workspaces', sub: 'Each workspace has its own people, schedule and records.',
      body: `<div class="picker-list">${items}<div class="divider"></div>
        <a class="picker-item" href="#/welcome" data-action="dialog-close-link">${icon('plus')}<span class="grow"><strong>Create a workspace</strong><small>Start a new organization or team</small></span></a>
        <button class="picker-item" type="button" data-action="join-team">${icon('scan')}<span class="grow"><strong>Join the team</strong><small>Scan an invite QR code</small></span></button></div>`,
    }),
  });
}

function accountMenu() {
  const me = S.self(), w = S.ws(), reports = descendants(S.org(), me.id).length;
  const previewable = S.canPreview() ? S.ws().people.filter(p => p.id !== me.id) : [];
  const row = (o: { href?: string; action?: string; ic: string; title: string; sub?: string; tail?: string; danger?: boolean }) =>
    `<${o.href ? `a href="${o.href}" data-action="dialog-close-link"` : `button type="button" data-action="${o.action}"`} class="picker-item ${o.danger ? 'danger' : ''}">${icon(o.ic)}<span class="grow"><strong>${esc(o.title)}</strong>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</span>${o.tail ?? ''}</${o.href ? 'a' : 'button'}>`;
  const profile = [
    `<a class="picker-item profile-row" href="#/team/${me.id}" data-action="dialog-close-link">${avatar(me, 'lg', { round: true })}<span class="grow"><strong>My profile</strong><small>${esc(S.levelTitle(me.level))}${S.branchName(me) ? ` · ${esc(S.branchName(me))}` : ''}${reports ? ` · manages ${plural(reports, 'person', 'people')}` : ''}</small></span>${icon('chevronRight')}</a>`,
    me.passKey ? row({ action: 'show-pass', ic: 'qr', title: 'My check-in pass', sub: 'Show to be marked present' }) : '',
    w.link ? row({ action: 'show-join-code', ic: 'userPlus', title: 'My join confirmation', sub: "Show again if it wasn't scanned" }) : '',
  ].join('');
  const workspace = [
    row({ action: 'open-workspaces', ic: 'building', title: 'Switch workspace', sub: w.config.name, tail: icon('chevrons') }),
    previewable.length ? row({ action: 'open-preview', ic: 'eye', title: 'Preview as…', sub: "See another level's view" }) : '',
  ].join('');
  const session = S.isDemo() ? row({ action: 'demo-exit', ic: 'logout', title: 'Exit demo', sub: 'Sample data is discarded', danger: true })
    : S.account() ? row({ action: 'sign-out', ic: 'logout', title: 'Sign out', sub: S.account()!.name, danger: true }) : '';
  openDialog({
    label: 'Account',
    html: dialogShell({
      title: 'Account',
      body: `<div class="picker-list"><div class="picker-group">Profile</div>${profile}<div class="picker-group">Workspace</div>${workspace}${session ? `<div class="picker-group">Session</div>${session}` : ''}</div>`,
    }),
  });
}

function previewList(q = '') {
  const o = S.org(), self = S.self(), needle = q.trim().toLowerCase();
  return [3, 2, 1, 0].map(level => {
    const people = o.people.filter(p => p.id !== self.id && p.level === level && (!needle || `${p.name} ${p.position} ${S.branchName(p)}`.toLowerCase().includes(needle)));
    if (!people.length) return '';
    return `<div class="picker-group">${esc(S.levelTitle(level))}</div>${people.map(p => `<button class="picker-item" type="button" data-action="pick-preview" data-id="${p.id}" ${S.session.previewId === p.id ? 'aria-current="true"' : ''}>${avatar(p, 'sm', { round: true })}<span class="grow"><strong>${esc(p.name)}</strong><small>${esc(S.branchName(p) || p.position || S.levelTitle(p.level))}</small></span></button>`).join('')}`;
  }).join('') || '<p class="muted" style="padding:14px">Nobody matches.</p>';
}

export function previewMenu() {
  openDialog({
    label: 'Preview as',
    html: dialogShell({
      title: 'Preview as…', sub: 'Check what each level and branch can see and do. Previewing never changes who you are.',
      body: `<div class="input-icon" style="margin-bottom:6px">${icon('search')}<input class="input" id="preview-q" type="search" placeholder="Search people" aria-label="Search people"></div><div class="picker-list" id="preview-list">${previewList()}</div>`,
    }),
    onOpen: d => { const q = $<HTMLInputElement>('#preview-q', d)!; q.addEventListener('input', () => { $('#preview-list', d)!.innerHTML = previewList(q.value); }); },
  });
}

function moreSheet() {
  const extra = PAGES.filter(p => !TABBAR.includes(p.id));
  const item = (p: Page) => `<a class="picker-item" href="#/${p.id}" data-action="dialog-close-link">${icon(p.icon)}<span class="grow"><strong>${p.label}</strong>${isLocked(p) ? '<small>Locked for your level</small>' : ''}</span>${badgeFor(p.id) ? `<span class="badge">${badgeFor(p.id)}</span>` : ''}${isLocked(p) ? icon('lock') : icon('chevronRight')}</a>`;
  const pages = extra.filter(p => p.id !== 'settings'), settings = extra.find(p => p.id === 'settings');
  openDialog({
    label: 'More',
    html: dialogShell({
      title: 'More',
      body: `<div class="picker-list">
        <div class="picker-group">Pages</div>${pages.map(item).join('')}
        <div class="picker-group">Tools</div>
        <button class="picker-item" type="button" data-action="scan">${icon('scan')}<span class="grow"><strong>Scan QR</strong><small>Invites, confirmations, passes</small></span></button>
        <button class="picker-item" type="button" data-action="toggle-theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}<span class="grow"><strong>${document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'}</strong></span></button>
        <div class="picker-group">Settings</div>${settings ? item(settings) : ''}
        <button class="picker-item" type="button" data-action="open-account">${avatar(S.self(), 'sm', { round: true })}<span class="grow"><strong>Account</strong><small>Profile, workspace, sign out</small></span>${icon('chevronRight')}</button></div>`,
    }),
  });
}

/* ------------------------------------------------------------------ */
/* Command palette                                                     */
/* ------------------------------------------------------------------ */

interface Entry { group: string; label: string; hint?: string; keys?: boolean; icon?: string; personId?: string; run: () => void }

function entries(): Entry[] {
  const out: Entry[] = PAGES.map(p => ({ group: 'Go to', label: p.label, hint: isLocked(p) ? 'Locked' : `G then ${p.key.toUpperCase()}`, keys: !isLocked(p), icon: p.icon, run: () => bus.navigate(p.id) }));
  out.push({ group: 'Actions', label: 'Scan QR code', icon: 'scan', run: openTeamScanner });
  if (S.can('people.manage')) out.push({ group: 'Actions', label: 'Join my team · show invite QR', icon: 'qr', run: () => bus.navigate('team', 'invites') });
  out.push({ group: 'Actions', label: 'Join the team · scan an invite', icon: 'userPlus', run: openJoinScanner });
  if (S.self().passKey) out.push({ group: 'Actions', label: 'My check-in pass', icon: 'qr', run: () => void showPass() });
  out.push({ group: 'Actions', label: 'Toggle dark mode', icon: 'moon', run: toggleTheme });
  out.push({ group: 'Actions', label: 'Keyboard shortcuts', icon: 'keyboard', hint: '?', keys: true, run: () => setTimeout(shortcutsDialog, 30) });
  for (const p of S.ws().people) out.push({ group: 'People', label: p.name, hint: `${S.levelTitle(p.level)}${S.branchName(p) ? ` · ${S.branchName(p)}` : ''}`, personId: p.id, run: () => bus.navigate('team', p.id) });
  for (const w of Object.values(S.data.workspaces)) if (w.id !== S.data.activeId) out.push({ group: 'Workspaces', label: w.config.name, icon: 'building', run: () => switchTo(w.id) });
  return out;
}

export function commandPalette() {
  const all = entries();
  let list = all, active = 0;
  const draw = () => {
    let i = 0;
    return [...new Set(list.map(e => e.group))].map(g => `<div class="picker-group">${esc(g)}</div>${list.filter(e => e.group === g).map(e => {
      const idx = i++, person = e.personId ? S.org().byId.get(e.personId) : undefined;
      return `<button class="picker-item" type="button" role="option" id="pal-${idx}" data-pal="${idx}" aria-selected="${idx === active}">${person ? avatar(person, 'xs', { round: true }) : icon(e.icon ?? 'arrowRight')}<span class="grow"><strong>${esc(e.label)}</strong>${e.hint ? `<small${e.keys ? ' class="keys"' : ''}>${esc(e.hint)}</small>` : ''}</span></button>`;
    }).join('')}`).join('') || '<p class="muted" style="padding:16px">No matches.</p>';
  };
  const ordered = (xs: Entry[]) => [...new Set(xs.map(e => e.group))].flatMap(g => xs.filter(e => e.group === g));
  list = ordered(all);
  openDialog({
    label: 'Command palette', className: 'palette',
    html: `<div class="palette-input">${icon('search')}<input id="pal-input" type="text" placeholder="Search pages, people, actions…" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant="pal-0"><kbd>Esc</kbd></div>
      <div class="palette-list" id="pal-list" role="listbox">${draw()}</div>
      <div class="palette-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>`,
    onOpen: d => {
      const input = $<HTMLInputElement>('#pal-input', d)!, el = $('#pal-list', d)!;
      const select = (i: number) => {
        active = Math.max(0, Math.min(list.length - 1, i));
        el.querySelectorAll<HTMLElement>('[data-pal]').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.pal) === active)));
        $(`#pal-${active}`, el)?.scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', `pal-${active}`);
      };
      const run = (i: number) => { const e = list[i]; if (e) { closeDialog(true); e.run(); } };
      input.focus();
      input.addEventListener('input', () => {
        const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
        list = ordered(all.filter(e => terms.every(t => `${e.label} ${e.hint ?? ''} ${e.group}`.toLowerCase().includes(t))));
        active = 0;
        el.innerHTML = draw();
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); select(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); select(active - 1); }
        else if (e.key === 'Enter') { e.preventDefault(); run(active); }
      });
      el.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pal]'); if (b) run(Number(b.dataset.pal)); });
    },
  });
}

export const SHORTCUTS: [string, string][] = [
  [`${modKey} K`, 'Search & commands'], ['/', 'Search & commands'], ['?', 'Keyboard shortcuts'], ['G then T A C R H U P S', 'Go to a section'],
  ['Q', 'Scan a QR code'], ['→ / ←', 'Mark present / absent'], ['S', 'Skip card'], ['Z', 'Undo last swipe'],
  ['Space', 'Spin / start the current game'], ['1 – 4', 'Answer trivia'], [`${modKey} Enter`, 'Post announcement'], ['Esc', 'Close dialogs'],
];

export function shortcutsDialog() {
  openDialog({
    label: 'Keyboard shortcuts', className: 'wide',
    html: dialogShell({ title: 'Keyboard shortcuts', sub: 'Ignored while typing in a field.', body: `<div class="shortcut-grid">${SHORTCUTS.map(([k, d]) => `<div class="shortcut"><span>${esc(d)}</span><span><kbd>${esc(k)}</kbd></span></div>`).join('')}</div>` }),
  });
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

function switchTo(id: string) {
  if (!S.switchWorkspace(id)) return closeDialog();
  closeDialog(true);
  bus.refresh({ shell: true, animate: true });
  toast(`Switched to ${S.cfg().name}`, { icon: 'building' });
}

export function startPreview(id: string | null) {
  if (!S.setPreview(id)) return;
  closeDialog(true);
  bus.refresh({ shell: true });
  if (id) toast(`Previewing as ${firstName(S.me().name)} · ${S.levelTitle(S.me().level)}`, { icon: 'eye' });
}

export const actions: Record<string, (el: HTMLElement) => void> = {
  'open-workspaces': workspaceMenu,
  'open-account': accountMenu,
  'open-preview': previewMenu,
  'open-palette': commandPalette,
  'open-more': moreSheet,
  'sign-out': () => { closeDialog(true); S.signOut(); S.goHome(); bus.refresh({ animate: true }); },
  'demo-exit': () => { closeDialog(true); S.endDemo(); S.goHome(); bus.refresh({ animate: true }); },
  'open-shortcuts': shortcutsDialog,
  'toggle-theme': () => { closeDialog(true); toggleTheme(); },
  'pick-workspace': el => switchTo(el.dataset.id!),
  'pick-preview': el => startPreview(el.dataset.id!),
  'exit-preview': () => startPreview(null),
  'scan': () => { closeDialog(true); openTeamScanner(); },
  'join-team': () => { closeDialog(true); openJoinScanner(); },
  'show-pass': () => { closeDialog(true); void showPass(); },
  'show-join-code': () => { closeDialog(true); showMyJoinCode(); },
  'dialog-close': () => closeDialog(),
  'dialog-close-link': () => closeDialog(true),
};
