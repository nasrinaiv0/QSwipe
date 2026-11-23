/** QR user flows: "Join my team" (invite), "Join the team" (scan + confirm), and daily check-in passes. */
import { bus } from '../bus';
import { codeUrl, createPass, decodeCode, encodeCode, expandConfig, inviteCode, inviteState, receiptFor, type AnyCode, type InviteCode, type ReceiptCode } from '../core/codes';
import { isoDate } from '../core/model';
import type { Invite } from '../core/types';
import * as S from '../state/store';
import { $, closeDialog, confetti, dialogShell, esc, fmtDate, fmtTime, firstName, icon, openDialog, plural, toast } from '../ui/kit';
import { codeSnippet, qrFrame } from './render';
import { openScanner, type ScanOutcome } from './scanner';

export const appBase = () => `${location.origin}${location.pathname}`;
export const expiry = (ts: number) => `${fmtDate(isoDate(new Date(ts)))}, ${fmtTime(ts)}`;

async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); toast('Link copied', { icon: 'copy' }); } catch { toast('Copy failed. Select the code text and copy it manually.'); }
}

function shareButtons(link: string) {
  const canShare = typeof navigator.share === 'function';
  return `<button class="btn sm" type="button" data-copy="${esc(link)}">${icon('copy')}Copy link</button>${canShare ? `<button class="btn sm" type="button" data-share="${esc(link)}">${icon('send')}Share</button>` : ''}`;
}

function wireShare(d: HTMLElement) {
  d.querySelectorAll<HTMLElement>('[data-copy]').forEach(b => b.addEventListener('click', () => void copyText(b.dataset.copy!)));
  d.querySelectorAll<HTMLElement>('[data-share]').forEach(b => b.addEventListener('click', () => void navigator.share({ title: 'QSwipe', url: b.dataset.share! }).catch(() => {})));
}

/* ------------------------------------------------------------------ */
/* Join my team (inviter)                                              */
/* ------------------------------------------------------------------ */

export function showInvite(invite: Invite) {
  const w = S.ws(), parent = S.org().byId.get(invite.parentId);
  const link = codeUrl(appBase(), encodeCode(inviteCode(w, invite)));
  const where = parent?.branch || `${parent?.name ?? 'your'}'s branch`;
  const state = inviteState(invite);
  openDialog({
    label: 'Join my team',
    className: 'wide',
    html: dialogShell({
      title: 'Join my team',
      sub: `Invite people into ${where} as ${S.levelTitle(invite.level)}.`,
      body: `<div class="grid two" style="align-items:center">
        <div class="qr-box">${qrFrame(link)}
          <div class="qr-meta"><strong>${esc(w.config.name)} · ${esc(where)}</strong><small>${state === 'active' ? `Expires ${expiry(invite.expiresAt)} · ${invite.uses}/${invite.maxUses} used` : `This invite is ${state}`}</small></div>
          <div class="cluster" style="justify-content:center">${shareButtons(link)}</div>
        </div>
        <div class="stack">
          <div class="steps">
            <div class="step active"><span>They scan this code with their phone camera, or open QSwipe → <b>Join the team</b>.</span></div>
            <div class="step"><span>They enter their name. Their screen shows a <b>join confirmation</b> code.</span></div>
            <div class="step"><span>You tap <b>Scan confirmation</b> and scan it to add them to your roster.</span></div>
          </div>
          <div class="notice">${icon('info')}<span>No server is involved: the codes carry the details between devices. Keep invites private and revoke them when you're done.</span></div>
          ${codeSnippet(link)}
        </div></div>`,
      foot: `<button class="btn ghost" type="button" data-action="dialog-close">Done</button><button class="btn primary" type="button" id="invite-scan">${icon('scan')}Scan confirmation</button>`,
    }),
    onOpen: d => { wireShare(d); $('#invite-scan', d)!.addEventListener('click', () => { closeDialog(true); openTeamScanner(); }); },
  });
}

/* ------------------------------------------------------------------ */
/* Join the team (new member)                                          */
/* ------------------------------------------------------------------ */

export function joinDialog(code: InviteCode) {
  const titles = expandConfig(code.c).titles;
  openDialog({
    label: 'Join the team',
    html: dialogShell({
      title: `Join ${code.p.b || `${code.p.n}'s team`}`,
      sub: `${code.c.n} · invited by ${code.p.n}`,
      body: `<form class="stack" id="join-form" autocomplete="off">
        <dl class="kv"><dt>Workspace</dt><dd>${esc(code.c.n)}</dd><dt>Reports to</dt><dd>${esc(code.p.n)} · ${esc(titles[code.p.l] ?? '')}</dd><dt>Your role</dt><dd>${esc(titles[code.l] ?? '')}</dd><dt>Invite expires</dt><dd>${esc(expiry(code.e))}</dd></dl>
        <div class="field"><label for="join-name">Your full name</label><input class="input" id="join-name" required minlength="2" maxlength="60" autocomplete="name"></div>
        <div class="field"><label for="join-pos">Position <span class="muted">(optional)</span></label><input class="input" id="join-pos" maxlength="60" autocomplete="organization-title"></div>
        <p class="form-error" id="join-error" role="alert"></p>
        <p class="privacy-note">${icon('shield')}<span>Your name and position are stored on this device and shared with ${esc(firstName(code.p.n))} only when they scan your confirmation code.</span></p>
      </form>`,
      foot: `<button class="btn ghost" type="button" data-action="dialog-close">Cancel</button><button class="btn primary" type="submit" form="join-form">${icon('userPlus')}Join the team</button>`,
    }),
    onOpen: d => {
      $<HTMLInputElement>('#join-name', d)!.focus();
      $('#join-form', d)!.addEventListener('submit', e => {
        e.preventDefault();
        const res = S.joinWithInvite(code, { name: $<HTMLInputElement>('#join-name', d)!.value, position: $<HTMLInputElement>('#join-pos', d)!.value });
        if (!res.ok) { $('#join-error', d)!.textContent = res.error; return; }
        closeDialog(true);
        bus.refresh({ shell: true, animate: true });
        if (res.local || !res.receipt) { toast('Added to the roster on this device', { icon: 'check' }); return; }
        confetti();
        showReceipt(res.receipt, code.p.n);
      });
    },
  });
}

export function showReceipt(receipt: ReceiptCode, inviterName: string) {
  const link = codeUrl(appBase(), encodeCode(receipt));
  openDialog({
    label: 'Join confirmation',
    html: dialogShell({
      title: 'Show this to finish joining',
      sub: `Ask ${firstName(inviterName)} to scan this code with QSwipe → Scan.`,
      body: `<div class="stack"><div class="qr-box">${qrFrame(link)}<div class="qr-meta"><strong>${esc(receipt.m.n)}</strong><small>Join confirmation · ${esc(S.cfg().name)}</small></div><div class="cluster" style="justify-content:center">${shareButtons(link)}</div></div>
        <div class="steps"><div class="step done"><span>You joined on this device.</span></div><div class="step active"><span>${esc(firstName(inviterName))} scans this code (or opens the shared link) to add you to the roster.</span></div><div class="step"><span>Afterwards, check in daily with your pass from the Today page.</span></div></div>${codeSnippet(link)}</div>`,
      foot: `<button class="btn primary" type="button" data-action="dialog-close">Done</button>`,
    }),
    onOpen: wireShare,
  });
}

export function showMyJoinCode() {
  try { showReceipt(receiptFor(S.ws(), S.self()), S.org().byId.get(S.self().parentId ?? '')?.name ?? 'your manager'); } catch (e) { toast((e as Error).message); }
}

/* ------------------------------------------------------------------ */
/* Check-in pass (member)                                              */
/* ------------------------------------------------------------------ */

export async function showPass() {
  const me = S.self();
  try {
    const pass = await createPass(S.ws().id, me, S.session.today);
    const link = codeUrl(appBase(), encodeCode(pass));
    openDialog({
      label: 'Check-in pass',
      html: dialogShell({
        title: 'My check-in pass',
        sub: `Valid today only · ${fmtDate(S.session.today, { weekday: 'long', month: 'long', day: 'numeric' })}`,
        body: `<div class="qr-box">${qrFrame(link)}<div class="qr-meta"><strong>${esc(me.name)}</strong><small>${esc(S.levelTitle(me.level))}${S.branchName(me) ? ` · ${esc(S.branchName(me))}` : ''}</small></div><p class="hint">Show this to your ${esc(S.levelTitle(Math.min(3, me.level + 1)))} to be marked present. It is signed for you and works only today.</p>${codeSnippet(link)}</div>`,
        foot: `<button class="btn primary" type="button" data-action="dialog-close">Done</button>`,
      }),
    });
  } catch (e) { toast((e as Error).message, { icon: 'alert' }); }
}

/* ------------------------------------------------------------------ */
/* Scanning                                                            */
/* ------------------------------------------------------------------ */

/** Routes any scanned or opened code. Used by every scanner and by #/qr/<code> links. */
export async function handleCode(text: string, { continuous = false } = {}): Promise<ScanOutcome> {
  let code: AnyCode;
  try { code = decodeCode(text); } catch (e) { return { result: 'retry', message: (e as Error).message }; }
  if (code.k === 'inv') {
    closeDialog(true);
    setTimeout(() => joinDialog(code as InviteCode), 30);
    return { result: 'close' };
  }
  if (!S.hasWorkspace()) return { result: 'retry', message: 'Create or join a workspace first.' };
  if (code.k === 'rcp') {
    const res = S.acceptJoin(code);
    if (!res.ok) return { result: 'retry', message: res.error };
    bus.refresh({ shell: true });
    toast(`${res.person.name} joined ${S.branchName(res.person) || S.cfg().name}`, { icon: 'userPlus' });
    confetti({ count: 60 });
    return continuous ? { result: 'continue', message: `✓ ${res.person.name} added` } : { result: 'close' };
  }
  const res = await S.checkInWithPass(code);
  if (!res.ok) return { result: 'retry', message: res.error };
  bus.refresh();
  toast(`${res.person.name} checked in`, { icon: 'check' });
  return continuous ? { result: 'continue', message: `✓ ${res.person.name} · present` } : { result: 'close' };
}

/** "Join the team": for people joining someone else's team. */
export function openJoinScanner() {
  openScanner({ title: 'Join the team', sub: "Scan the invite QR code on your leader's screen.", hint: 'Tip: you can also scan an invite with your phone camera; it opens QSwipe directly.', onCode: text => handleCode(text) });
}

/** For leads: scan join confirmations and check-in passes back-to-back. */
export function openTeamScanner() {
  const pending = S.ws().invites.filter(i => inviteState(i) === 'active').length;
  openScanner({
    title: 'Scan QR',
    sub: `Join confirmations and check-in passes · ${plural(pending, 'active invite')}`,
    hint: 'The scanner stays open so you can check in a queue of people one after another.',
    onCode: text => handleCode(text, { continuous: true }),
  });
}
