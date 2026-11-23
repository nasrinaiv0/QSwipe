import * as S from '../state/store';
import { esc, icon } from '../ui/kit';

export type Handler = (el: HTMLElement, e: Event) => void;
export interface View {
  render(sub: string): string;
  /** Called after render; `initial` is true on navigation (vs. an in-place refresh). */
  mount?(root: HTMLElement, o: { initial: boolean }): void;
  unmount?(): void;
  onKey?(e: KeyboardEvent): boolean;
  /** data-action click handlers (and data-submit form handlers). */
  actions?: Record<string, Handler>;
  /** data-input / data-change handlers. */
  inputs?: Record<string, Handler>;
}

export const pageHead = (o: { title: string; lede?: string; eyebrow?: string; actions?: string }) =>
  `<header class="page-head"><div>${o.eyebrow ? `<span class="eyebrow">${esc(o.eyebrow)}</span>` : ''}<h1>${esc(o.title)}</h1>${o.lede ? `<p class="lede">${esc(o.lede)}</p>` : ''}</div>${o.actions ? `<div class="head-actions">${o.actions}</div>` : ''}</header>`;

export const kpi = (o: { label: string; value: number | string; key?: string; suffix?: string; foot?: string; icon?: string; accent?: boolean }) =>
  `<div class="kpi ${o.accent ? 'accent' : ''}"><span class="label">${o.icon ? icon(o.icon) : ''}${esc(o.label)}</span>
  <strong class="value num" ${typeof o.value === 'number' ? `data-count="${o.value}" data-count-key="${esc(o.key ?? o.label)}" ${o.suffix ? `data-suffix="${esc(o.suffix)}"` : ''}` : ''}>${esc(o.value)}${o.suffix && typeof o.value === 'number' ? esc(o.suffix) : ''}</strong>${o.foot ? `<span class="foot">${esc(o.foot)}</span>` : ''}</div>`;

export function previewBanner(): string {
  if (!S.session.previewId) return '';
  const p = S.me();
  return `<div class="preview-banner" role="status">${icon('eye')}<span>Previewing as <b>${esc(p.name)}</b> · ${esc(S.levelTitle(p.level))}. Actions you take are recorded as them.</span><button class="btn sm" type="button" data-action="exit-preview">Exit preview</button></div>`;
}

export const field = (o: { id: string; label: string; control: string; hint?: string; cls?: string }) =>
  `<div class="field ${o.cls ?? ''}"><label for="${o.id}">${esc(o.label)}</label>${o.control}${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}</div>`;

export const options = (items: [string | number, string][], selected: string | number) =>
  items.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`).join('');
