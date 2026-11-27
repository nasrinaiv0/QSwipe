import { bus } from '../bus';
import { audienceOptions, relativeTime } from '../core/model';
import * as S from '../state/store';
import { $, avatar, emptyState, esc, icon, toast } from '../ui/kit';
import { modKey } from '../shell';
import { cbtn, options, pageHead, type View } from './common';

function composer(): string {
  if (!S.can('updates.post')) return '';
  const audiences = audienceOptions(S.org(), S.me(), S.can('updates.broadcast'));
  if (!audiences.length) return `<section class="card"><p class="muted small">${icon('info')} Add teammates to post branch updates.</p></section>`;
  return `<section class="card composer"><form id="post-form" data-submit="post">
    <label class="sr-only" for="post-text">Announcement</label>
    <textarea class="input" id="post-text" maxlength="700" placeholder="Write an update…" data-input="post-count"></textarea>
    <div class="composer-foot">
      <select class="select" id="post-scope" aria-label="Audience">${options(audiences.map(id => [id, S.audienceLabel(id)]), audiences[0]!)}</select>
      <label class="cluster small" style="gap:6px"><span class="switch"><input type="checkbox" id="post-important"><span></span></span>Important</label>
      <span class="char-count" id="post-count" style="margin-left:auto">0 / 700</span>
      <button class="btn primary" type="submit">${icon('send')}Post <kbd style="margin-left:4px">${modKey}↵</kbd></button>
    </div></form></section>`;
}

export const updates: View = {
  render() {
    const all = S.visibleAnnouncements(), f = S.session.ui.feedFilter;
    const unread = all.filter(a => !S.isRead(a)).length;
    const list = all.filter(a => f === 'all' || (f === 'unread' ? !S.isRead(a) : a.priority === 'important'));
    const posts = list.map(a => {
      const author = S.org().byId.get(a.authorId), mine = a.authorId === S.me().id, read = S.isRead(a);
      const { acked, reach } = S.ackCount(a);
      return `<article class="post ${read ? '' : 'unread'} ${a.priority === 'important' ? 'important' : ''}">
        ${author ? avatar(author, 'sm', { round: true }) : '<span class="avatar sm round">?</span>'}
        <div><div class="post-head"><strong class="post-title">${esc(author?.name ?? 'Former member')}</strong><span class="pill">${icon('users')}${esc(S.audienceLabel(a.scopeId))}</span>${a.priority === 'important' ? `<span class="pill warn">${icon('alert')}Important</span>` : ''}<small>${relativeTime(a.at)}</small></div>
          <p class="post-body">${esc(a.text)}</p>
          <div class="post-foot">${mine ? `<span class="pill ${acked === reach && reach ? 'good' : ''}">${icon('eye')}${acked}/${reach} acknowledged</span><button class="btn sm ghost" type="button" data-action="post-delete" data-id="${a.id}">${icon('trash')}Delete</button>`
            : `<button class="btn sm ${read ? 'ghost' : 'soft'}" type="button" data-action="post-ack" data-id="${a.id}" aria-pressed="${read}">${icon('check')}${read ? 'Acknowledged' : 'Acknowledge'}</button>`}</div></div></article>`;
    }).join('');
    return `${pageHead({ title: 'Updates', actions: `
      <div class="seg" role="tablist" aria-label="Filter">${[['all', 'All', all.length], ['unread', 'Unread', unread], ['important', 'Important', all.filter(a => a.priority === 'important').length]].map(([id, l, n]) => `<button type="button" role="tab" data-action="feed-filter" data-filter="${id}" aria-selected="${f === id}">${l} <span class="count">${n}</span></button>`).join('')}</div>
      ${unread ? cbtn({ label: 'Mark all read', icon: 'check', action: 'post-ack-all' }) : ''}` })}
      <div class="stack" style="max-width:820px">${composer()}
        <section class="card">${posts || emptyState({ icon: 'updates', title: f === 'all' ? 'No updates yet' : 'No matching updates' })}</section></div>`;
  },
  onKey(e) { return e.key === 'n' && S.can('updates.post') ? ($<HTMLTextAreaElement>('#post-text')?.focus(), true) : false; },
  mount(root) {
    $<HTMLTextAreaElement>('#post-text', root)?.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); $<HTMLFormElement>('#post-form')!.requestSubmit(); }
    });
  },
  actions: {
    post: form => {
      const res = S.postAnnouncement({ text: $<HTMLTextAreaElement>('#post-text', form)!.value, scopeId: $<HTMLSelectElement>('#post-scope', form)!.value, priority: $<HTMLInputElement>('#post-important', form)!.checked ? 'important' : 'normal' });
      if (!res.ok) return void toast(res.error, { icon: 'alert' });
      bus.refresh({ shell: true });
      toast('Posted', { icon: 'send' });
    },
    'post-ack': el => { const on = el.getAttribute('aria-pressed') !== 'true'; S.acknowledge(el.dataset.id!, on); bus.refresh({ shell: true }); },
    'post-ack-all': () => { S.acknowledgeAll(); bus.refresh({ shell: true }); },
    'post-delete': el => {
      const removed = S.deleteAnnouncement(el.dataset.id!);
      if (!removed) return;
      bus.refresh({ shell: true });
      toast('Announcement deleted', { icon: 'trash', action: { label: 'Undo', fn: () => { S.restoreAnnouncement(removed); bus.refresh({ shell: true }); } }, duration: 6000 });
    },
    'feed-filter': el => { S.session.ui.feedFilter = el.dataset.filter!; bus.refresh(); },
  },
  inputs: { 'post-count': el => { const c = $('#post-count'); if (c) c.textContent = `${(el as HTMLTextAreaElement).value.length} / 700`; } },
};
