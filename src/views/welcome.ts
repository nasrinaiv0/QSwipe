/** First run: create a workspace or join one by scanning an invite. */
import { bus } from '../bus';
import { createWorkspace, PRESETS } from '../core/model';
import type { Level, Preset } from '../core/types';
import * as S from '../state/store';
import { $, $$, esc, icon, toast } from '../ui/kit';
import { mascot } from '../ui/mascot';
import { field, options, type View } from './common';

let preset: Preset = 'business';

function roleOptions(level: Level) {
  const t = PRESETS[preset].titles;
  return options([[3, `${t[3]} (whole organization)`], [2, `${t[2]}`], [1, `${t[1]}`]], level);
}

function branchLabel(level: number) {
  const p = PRESETS[preset];
  return level === 1 ? `${p.groupLabel} name` : `${p.unitLabel} name`;
}

export const welcome: View = {
  render() {
    const back = S.hasWorkspace();
    return `<div class="onboard-inner page-enter">
      <div class="between">
        <div class="onboard-brand">${mascot('hi', { size: 44 })}<strong>QSwipe</strong></div>
        ${back ? `<a class="btn ghost" href="#/today">${icon('chevronLeft')}Back to ${esc(S.cfg().name)}</a>` : ''}
      </div>
      <div class="onboard-grid">
        <section class="card" aria-labelledby="create-h">
          <div class="card-head"><div><h2 id="create-h">Create a workspace</h2></div></div>
          <form class="stack" id="create-form" autocomplete="off" novalidate>
            ${field({ id: 'ws-name', label: 'Workspace name', control: '<input class="input" id="ws-name" required minlength="2" maxlength="60">' })}
            <div class="field"><span class="label">Type</span><div class="preset-grid" role="group" aria-label="Workspace type">${(Object.keys(PRESETS) as Preset[]).map(k => `<button class="preset" type="button" data-preset="${k}" aria-pressed="${k === preset}"><strong>${esc(PRESETS[k].label)}</strong></button>`).join('')}</div></div>
            <div class="form-grid">
              ${field({ id: 'owner-name', label: 'Your name', control: `<input class="input" id="owner-name" required minlength="2" maxlength="60" autocomplete="name" value="${esc(S.account()?.name ?? '')}">` })}
              ${field({ id: 'owner-level', label: 'Your role', control: `<select class="select" id="owner-level">${roleOptions(1)}</select>` })}
              ${field({ id: 'owner-branch', label: branchLabel(1), cls: 'span-2', control: '<input class="input" id="owner-branch" maxlength="40" placeholder="Optional">', })}
            </div>
            <p class="form-error" id="create-error" role="alert"></p>
            <button class="btn primary lg block" type="submit">${icon('arrowRight')}Create workspace</button>
          </form>
        </section>
        <div class="stack">
          <section class="card" aria-labelledby="join-h">
            <div class="card-head"><div><h2 id="join-h">Join a team</h2></div></div>
            <button class="btn primary block" type="button" data-action="join-team">${icon('camera')}Scan invite QR</button>
          </section>
          <p class="privacy-note">${icon('shield')}<span>Workspace data stays in this browser.</span></p>
        </div>
      </div>
    </div>`;
  },
  mount(root) {
    const levelSel = $<HTMLSelectElement>('#owner-level', root)!;
    const sync = () => {
      const lv = Number(levelSel.value);
      const label = $('label[for="owner-branch"]', root)!;
      label.textContent = lv === 3 ? 'Organization unit (optional)' : branchLabel(lv);
    };
    levelSel.addEventListener('change', sync);
    $$('[data-preset]', root).forEach(b => b.addEventListener('click', () => {
      preset = b.dataset.preset as Preset;
      $$('[data-preset]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      const lv = Number(levelSel.value) as Level;
      levelSel.innerHTML = roleOptions(lv);
      sync();
    }));
    $('#create-form', root)!.addEventListener('submit', e => {
      e.preventDefault();
      const val = (id: string) => $<HTMLInputElement>(id, root)!.value.trim();
      const err = $('#create-error', root)!;
      if (val('#ws-name').length < 2) { err.textContent = 'Enter a workspace name (at least 2 characters).'; $<HTMLInputElement>('#ws-name', root)!.focus(); return; }
      if (val('#owner-name').length < 2) { err.textContent = 'Enter your name (at least 2 characters).'; $<HTMLInputElement>('#owner-name', root)!.focus(); return; }
      const ws = createWorkspace({ name: val('#ws-name'), preset, ownerName: val('#owner-name'), ownerLevel: Number(levelSel.value) as Level, ownerBranch: val('#owner-branch') });
      S.addWorkspace(ws);
      bus.navigate('today');
      toast('Workspace created.', { icon: 'check', duration: 4500 });
    });
    if (matchMedia('(hover: hover)').matches) $<HTMLInputElement>('#ws-name', root)!.focus();
  },
};
