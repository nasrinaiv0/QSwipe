import { bus } from '../bus';
import { parseBackup } from '../core/data';
import { canAccess, FEATURES, isoDate, PRESETS, requiredLevel, shiftLabel } from '../core/model';
import type { Preset, Settings, Titles } from '../core/types';
import { applyAppearance, modKey, SHORTCUTS } from '../shell';
import * as S from '../state/store';
import { $, confirmDialog, download, esc, icon, lockedPanel, plural, toast, withTransition } from '../ui/kit';
import { field, options, pageHead, type View } from './common';

const SECTIONS: [string, string, string, string?][] = [
  ['appearance', 'Appearance', 'palette'], ['attendance', 'Attendance & feedback', 'hand'], ['workspace', 'Workspace', 'building', 'settings.workspace'],
  ['access', 'Access & hierarchy', 'shield'], ['data', 'Data & privacy', 'database'], ['about', 'Shortcuts & about', 'keyboard'],
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ACCENTS: Record<Settings['accent'], string> = { green: '#17714f', teal: '#0e7470', blue: '#2860c4', violet: '#6448cf', rose: '#bf3a63', amber: '#a35f07' };

const setting = (label: string, sub: string, control: string, stacked = false) =>
  `<div class="setting ${stacked ? 'stacked' : ''}"><div class="s-label"><strong>${esc(label)}</strong><small>${esc(sub)}</small></div><div>${control}</div></div>`;

function seg<K extends keyof Settings>(key: K, items: [Settings[K], string][]) {
  return `<div class="seg" role="group">${items.map(([v, l]) => `<button type="button" data-action="set" data-key="${key}" data-value="${String(v)}" aria-pressed="${S.settings()[key] === v}">${esc(l)}</button>`).join('')}</div>`;
}
const toggle = (key: keyof Settings, label: string) => `<label class="switch"><input type="checkbox" data-change="set-bool" data-key="${key}" ${S.settings()[key] ? 'checked' : ''} aria-label="${esc(label)}"><span></span></label>`;

function appearance() {
  const s = S.settings();
  return `<section class="card"><div class="card-head"><h2>${icon('palette')}Appearance</h2><span class="pill">This device</span></div>
    ${setting('Theme', 'System follows your device setting.', `<div class="theme-cards">${(['system', 'light', 'dark'] as const).map(t => `<button class="theme-card" type="button" data-action="set" data-key="theme" data-value="${t}" aria-pressed="${s.theme === t}"><span class="preview ${t}"><i></i><i></i></span><span>${icon(t === 'system' ? 'monitor' : t === 'light' ? 'sun' : 'moon')}${t[0]!.toUpperCase() + t.slice(1)}</span></button>`).join('')}</div>`, true)}
    ${setting('Accent colour', 'Used for primary actions and highlights.', `<div class="swatches">${(Object.keys(ACCENTS) as Settings['accent'][]).map(a => `<button class="swatch" type="button" style="background:${ACCENTS[a]}" data-action="set" data-key="accent" data-value="${a}" aria-pressed="${s.accent === a}" aria-label="${a}">${icon('check')}</button>`).join('')}</div>`)}
    ${setting('Density', 'Compact fits more on screen.', seg('density', [['compact', 'Compact'], ['comfortable', 'Comfortable']]))}
    ${setting('Text size', 'Scales all text.', seg('textSize', [['default', 'Default'], ['large', 'Large']]))}
    ${setting('Motion', 'Reduced turns off animations and confetti.', seg('motion', [['system', 'System'], ['full', 'Full'], ['reduced', 'Reduced']]))}</section>`;
}

function attendanceSec() {
  return `<section class="card"><div class="card-head"><h2>${icon('hand')}Attendance & feedback</h2><span class="pill">This device</span></div>
    ${setting('Undo window', 'How long the Undo button stays available after a swipe.', seg('undoSeconds', [[5, '5s'], [10, '10s'], [30, '30s']]))}
    ${setting('Swipe sensitivity', 'Distance needed to commit a swipe. Fast flicks always count.', seg('swipeSensitivity', [['gentle', 'Gentle'], ['balanced', 'Balanced'], ['quick', 'Quick']]))}
    ${setting('Confirm before absent', 'Ask before marking someone absent.', toggle('confirmAbsent', 'Confirm before absent'))}
    ${setting('Haptics', 'Vibrate on supported phones.', toggle('haptics', 'Haptics'))}
    ${setting('Sounds', 'Soft clicks for swipes, wheel ticks and results.', toggle('sound', 'Sounds'))}</section>`;
}

function workspace() {
  const c = S.cfg();
  if (!S.can('settings.workspace')) return `<section class="card">${lockedPanel({ title: 'Workspace settings are locked', need: S.levelTitle(requiredLevel(S.ws().policy, 'settings.workspace')) })}<dl class="kv"><dt>Name</dt><dd>${esc(c.name)}</dd><dt>Shift</dt><dd>${esc(shiftLabel(c))}</dd><dt>Days</dt><dd>${c.days.map(d => DAYS[d]).join(', ')}</dd><dt>Target</dt><dd>${c.targetPct}%</dd></dl></section>`;
  return `<section class="card"><div class="card-head"><h2>${icon('building')}Workspace</h2><span class="pill">${esc(c.name)}</span></div>
    <form class="stack" id="ws-form" data-submit="ws-save">
      <div class="form-grid">
        ${field({ id: 'ws-name', label: 'Name', control: `<input class="input" id="ws-name" maxlength="60" value="${esc(c.name)}">` })}
        ${field({ id: 'ws-preset', label: 'Template', control: `<select class="select" id="ws-preset">${options((Object.keys(PRESETS) as Preset[]).map(k => [k, PRESETS[k].label]), c.preset)}</select>`, hint: 'Changing it does not overwrite your custom labels.' })}
        ${field({ id: 'ws-start', label: 'Shift starts', control: `<input class="input" type="time" id="ws-start" value="${c.shiftStart}">` })}
        ${field({ id: 'ws-end', label: 'Shift ends', control: `<input class="input" type="time" id="ws-end" value="${c.shiftEnd}">`, hint: 'An end before the start means an overnight shift.' })}
        <div class="field span-2"><span class="label">Session days</span><div class="weekday-toggle" role="group" aria-label="Session days">${DAYS.map((d, i) => `<button type="button" data-action="ws-day" data-day="${i}" aria-pressed="${c.days.includes(i)}">${d}</button>`).join('')}</div></div>
        <div class="field span-2"><label for="ws-target">Coverage target · <b id="ws-target-v">${c.targetPct}%</b></label><input type="range" id="ws-target" min="50" max="100" step="5" value="${c.targetPct}" data-input="ws-target"></div>
      </div>
      <div class="divider"></div><h3>Labels & titles</h3>
      <div class="form-grid">
        ${field({ id: 'ws-group', label: 'Group label', control: `<input class="input" id="ws-group" maxlength="24" value="${esc(c.groupLabel)}">`, hint: 'e.g. Team, Class, Section' })}
        ${field({ id: 'ws-unit', label: 'Unit label', control: `<input class="input" id="ws-unit" maxlength="24" value="${esc(c.unitLabel)}">`, hint: 'e.g. Department, Division' })}
        ${([3, 2, 1, 0] as const).map(l => field({ id: `ws-t${l}`, label: `Level ${l} title`, control: `<input class="input" id="ws-t${l}" maxlength="32" value="${esc(c.titles[l])}">` })).join('')}
      </div>
      <div class="cluster"><button class="btn primary" type="submit">${icon('check')}Save workspace</button></div>
    </form></section>`;
}

function access() {
  const w = S.ws(), me = S.me(), editable = S.can('settings.access'), titles = S.cfg().titles;
  const counts = [0, 1, 2, 3].map(l => w.people.filter(p => p.level === l).length);
  return `<section class="card"><div class="card-head"><div><h2>${icon('shield')}Access & hierarchy</h2><p class="sub">Each feature is available from a minimum level upward. Everyone acts only inside their own branch. The owner can do everything.</p></div>
      ${editable ? `<button class="btn sm ghost" type="button" data-action="policy-reset">${icon('refresh')}Defaults</button>` : `<span class="pill">${icon('lock')}Read only</span>`}</div>
    <div class="table-wrap"><table class="matrix"><thead><tr><th>Feature</th>${[0, 1, 2, 3].map(l => `<th class="${me.level === l ? 'current' : ''}">L${l}<br>${esc(titles[l as 0])}<br><span class="muted">${plural(counts[l]!, 'person', 'people')}</span></th>`).join('')}</tr></thead><tbody>
      ${FEATURES.map(f => {
        const min = requiredLevel(w.policy, f.key);
        if (f.ownerOnly) return `<tr><td><span class="area">${esc(f.area)}</span>${esc(f.label)}</td><td colspan="4"><span class="pill accent">${icon('crown')}Workspace owner only</span></td></tr>`;
        return `<tr><td><span class="area">${esc(f.area)}</span>${esc(f.label)}</td>${[0, 1, 2, 3].map(l => {
          const on = l >= min;
          return `<td class="${me.level === l ? 'current' : ''}"><button class="cell-btn ${on ? 'on' : ''} ${l === min ? 'min' : ''}" type="button" ${editable ? `data-action="policy-set" data-feature="${f.key}" data-level="${l}"` : 'disabled'} aria-label="${esc(f.label)}: ${on ? 'allowed' : 'not allowed'} for ${esc(titles[l as 0])}${editable ? `. Set minimum to level ${l}` : ''}">${icon(on ? 'check' : 'minus')}</button></td>`;
        }).join('')}</tr>`;
      }).join('')}</tbody></table></div>
    <p class="hint" style="margin-top:10px">${editable ? 'Tap a cell to make that level the minimum for the feature.' : `Only the workspace owner can change this policy.`} You (${esc(me.name)}) can use ${FEATURES.filter(f => canAccess(w, me, f.key)).length} of ${FEATURES.length} features.</p></section>`;
}

function data() {
  const bytes = S.storageBytes(), w = S.ws();
  return `<section class="card"><div class="card-head"><h2>${icon('database')}Data & privacy</h2></div>
    <div class="notice" style="margin-bottom:12px">${icon('shield')}<span>Everything is stored only in this browser's local storage. There is no account or server. QR codes carry details between devices only when someone scans them.</span></div>
    ${setting('Storage used', `${(bytes / 1024).toFixed(1)} KB across ${plural(Object.keys(S.data.workspaces).length, 'workspace')}. Browsers allow roughly 5 MB.`, `<div class="meter" style="width:160px"><span data-width="${Math.min(100, (bytes / 5e6) * 100).toFixed(1)}%"></span></div>`)}
    ${setting('Export backup', 'Download all workspaces and settings as JSON.', `<button class="btn" type="button" data-action="backup-export">${icon('download')}Export</button>`)}
    ${setting('Import backup', 'Replaces everything on this device with the file’s contents.', `<label class="btn" for="backup-file">${icon('upload')}Import</label><input class="sr-only" type="file" id="backup-file" accept="application/json,.json" data-change="backup-import">`)}
    ${S.isOwner(S.self()) ? setting('Clear records', `Remove attendance, commitments, updates and audit for ${w.config.name}. People stay.`, `<button class="btn warn" type="button" data-action="clear-records">${icon('trash')}Clear</button>`) : ''}
    ${setting(w.link ? 'Leave workspace' : 'Delete workspace', w.link ? 'Remove this workspace from this device. Your leader’s roster is not affected.' : `Permanently remove ${w.config.name} from this device.`, `<button class="btn bad" type="button" data-action="ws-delete">${icon(w.link ? 'logout' : 'trash')}${w.link ? 'Leave' : 'Delete'}</button>`)}
  </section>`;
}

const about = () => `<section class="card"><div class="card-head"><h2>${icon('keyboard')}Keyboard shortcuts</h2></div><div class="shortcut-grid">${SHORTCUTS.map(([k, d]) => `<div class="shortcut"><span>${esc(d)}</span><span><kbd>${esc(k)}</kbd></span></div>`).join('')}</div>
  <div class="divider"></div><dl class="kv"><dt>Version</dt><dd>${esc(__APP_VERSION__)}</dd><dt>Search</dt><dd>${modKey} K</dd><dt>Storage</dt><dd>Local only</dd></dl></section>`;

let days: number[] | null = null;

export const settingsView: View = {
  render(sub) {
    const id = SECTIONS.some(s => s[0] === sub) ? sub : 'appearance';
    if (id !== 'workspace') days = null;
    const body = id === 'appearance' ? appearance() : id === 'attendance' ? attendanceSec() : id === 'workspace' ? workspace() : id === 'access' ? access() : id === 'data' ? data() : about();
    return `${pageHead({ title: 'Settings', lede: 'Device preferences apply only here. Workspace and access settings follow the hierarchy.' })}
      <div class="settings-layout"><nav class="settings-nav" aria-label="Settings sections">${SECTIONS.map(([k, l, ic, req]) => `<a href="#/settings/${k}" ${k === id ? 'aria-current="true"' : ''}>${icon(ic)}${l}${req && !S.can(req) ? icon('lock', 'lock') : ''}</a>`).join('')}</nav><div class="stack loose">${body}</div></div>`;
  },
  actions: {
    set: el => {
      const key = el.dataset.key as keyof Settings, raw = el.dataset.value!;
      S.updateSettings({ [key]: /^\d+$/.test(raw) ? Number(raw) : raw } as Partial<Settings>);
      const run = () => { applyAppearance(); bus.refresh({ shell: true }); };
      if (key === 'theme') withTransition(run); else run();
    },
    'ws-day': el => {
      days ??= [...S.cfg().days];
      const d = Number(el.dataset.day), on = days.includes(d);
      if (on && days.length === 1) return void toast('Keep at least one session day.');
      days = on ? days.filter(x => x !== d) : [...days, d].sort();
      el.setAttribute('aria-pressed', String(!on));
    },
    'ws-save': form => {
      const v = (id: string) => $<HTMLInputElement>(id, form)!.value;
      const ok = S.updateConfig({
        name: v('#ws-name'), preset: v('#ws-preset') as Preset, shiftStart: v('#ws-start'), shiftEnd: v('#ws-end'), targetPct: Number(v('#ws-target')),
        days: days ?? S.cfg().days, groupLabel: v('#ws-group'), unitLabel: v('#ws-unit'), titles: [0, 1, 2, 3].map(l => v(`#ws-t${l}`)) as Titles,
      });
      days = null;
      bus.refresh({ shell: true });
      toast(ok ? 'Workspace saved' : 'You cannot edit workspace settings.', { icon: ok ? 'check' : 'lock' });
    },
    'policy-set': el => { S.setPolicyLevel(el.dataset.feature!, Number(el.dataset.level)); bus.refresh({ shell: true }); },
    'policy-reset': () => { S.resetPolicy(); bus.refresh({ shell: true }); toast('Access policy reset to defaults'); },
    'backup-export': () => {
      download(`qswipe-backup-${isoDate()}.json`, JSON.stringify({ app: 'qswipe', exportedAt: new Date().toISOString(), ...S.data }, null, 1), 'application/json');
      toast('Backup downloaded. It contains personal data; store it safely.', { icon: 'download', duration: 4500 });
    },
    'clear-records': async () => {
      if (!(await confirmDialog({ title: 'Clear all records?', body: `Attendance, commitments, updates and the audit log for ${S.cfg().name} will be removed from this device. People and invites stay.`, confirmLabel: 'Clear records', danger: true }))) return;
      S.clearWorkspaceRecords();
      bus.refresh({ shell: true });
      toast('Records cleared');
    },
    'ws-delete': async () => {
      const w = S.ws();
      if (!(await confirmDialog({ title: `${w.link ? 'Leave' : 'Delete'} ${w.config.name}?`, body: 'This removes it from this device and cannot be undone. Export a backup first if you might need it.', confirmLabel: w.link ? 'Leave workspace' : 'Delete workspace', danger: true }))) return;
      S.deleteWorkspace(w.id);
      bus.navigate(S.hasWorkspace() ? 'today' : 'welcome');
      toast(`${w.config.name} removed from this device`);
    },
  },
  inputs: {
    'set-bool': el => { S.updateSettings({ [el.dataset.key!]: (el as HTMLInputElement).checked } as Partial<Settings>); },
    'ws-target': el => { const o = $('#ws-target-v'); if (o) o.textContent = `${(el as HTMLInputElement).value}%`; },
    'backup-import': async el => {
      const file = (el as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const next = parseBackup(await file.text());
        const n = Object.keys(next.workspaces).length;
        if (!(await confirmDialog({ title: 'Replace data on this device?', body: `The backup contains ${plural(n, 'workspace')}. Everything currently on this device will be replaced.`, confirmLabel: 'Import', danger: true }))) return;
        S.replaceData(next);
        applyAppearance();
        bus.navigate(S.hasWorkspace() ? 'today' : 'welcome');
        toast('Backup imported', { icon: 'upload' });
      } catch (e) { toast((e as Error).message, { icon: 'alert', duration: 5000 }); }
      (el as HTMLInputElement).value = '';
    },
  },
};
