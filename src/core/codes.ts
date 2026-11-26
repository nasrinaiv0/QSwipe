/**
 * QR payloads exchanged device-to-device (there is no server):
 *  - inv  "Join my team": workspace terms + the inviting branch + a one-time-ish secret token.
 *  - rcp  "Join confirmation": shown by the new member, scanned by the inviter to add them to the roster.
 *  - pass "Check-in pass": a member's daily pass, HMAC-signed with a key shared only during the join handshake.
 * Format: QS1.<base64url(JSON)>.<fnv32 checksum>, optionally inside an app URL (#/qr/<code>).
 */
import { addDays, cleanText, hashString, isIsoDate, LEVELS, newPerson, defaultPolicy, uid, PRESETS, configFromPreset, sanitizeConfig, placementError, indexOrg } from './model';
import type { Invite, Level, Person, Preset, Workspace, WorkspaceConfig } from './types';

export interface CompactConfig { n: string; p: Preset; g?: string; u?: string; m?: string; t?: string[]; s?: string; e?: string; d?: string; tp?: number }
export interface InviteCode { k: 'inv'; w: string; c: CompactConfig; i: string; t: string; p: { id: string; n: string; l: Level; b: string }; l: Level; e: number }
export interface ReceiptCode { k: 'rcp'; w: string; i: string; t: string; m: { id: string; n: string; pos: string }; pk: string; at: number }
export interface PassCode { k: 'pass'; w: string; m: string; d: string; s: string }
export type AnyCode = InviteCode | ReceiptCode | PassCode;

const PREFIX = 'QS1';
const CODE_RE = /QS1\.([A-Za-z0-9_-]+)\.([0-9a-z]+)/;
const ID_RE = /^[A-Za-z0-9]{6,16}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,32}$/;

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

export function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
export const randomToken = (bytes = 16) => toB64url(crypto.getRandomValues(new Uint8Array(bytes)));

export function encodeCode(code: AnyCode): string {
  const body = toB64url(new TextEncoder().encode(JSON.stringify(code)));
  return `${PREFIX}.${body}.${hashString(body).toString(36)}`;
}

export const codeUrl = (base: string, code: string) => `${base}#/qr/${code}`;

/** Accepts a raw code or any text/URL containing one. Throws a user-readable Error. */
export function decodeCode(text: string): AnyCode {
  const match = CODE_RE.exec(text.trim());
  if (!match) throw new Error('This is not a QSwipe code.');
  const [, body, sum] = match as unknown as [string, string, string];
  if (hashString(body).toString(36) !== sum) throw new Error('The code is damaged or incomplete. Try scanning again.');
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(fromB64url(body))); } catch { throw new Error('The code could not be read.'); }
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null);
  const level = (v: unknown): Level | null => (LEVELS.includes(v as Level) ? (v as Level) : null);
  if (!ID_RE.test(String(o.w))) throw new Error('The code is missing its workspace.');
  if (o.k === 'inv') {
    const p = (o.p ?? {}) as Record<string, unknown>;
    const c = (o.c ?? {}) as Record<string, unknown>;
    const lv = level(o.l), pl = level(p.l);
    if (!ID_RE.test(String(o.i)) || !TOKEN_RE.test(String(o.t)) || !ID_RE.test(String(p.id)) || lv === null || pl === null || pl <= lv || typeof o.e !== 'number') throw new Error('This invite is not valid.');
    if (!str(p.n, 60) || !str(c.n, 60)) throw new Error('This invite is not valid.');
    return { k: 'inv', w: o.w as string, i: o.i as string, t: o.t as string, l: lv, e: o.e, p: { id: p.id as string, n: p.n as string, l: pl, b: str(p.b, 40) ?? '' }, c: c as unknown as CompactConfig };
  }
  if (o.k === 'rcp') {
    const m = (o.m ?? {}) as Record<string, unknown>;
    if (!ID_RE.test(String(o.i)) || !TOKEN_RE.test(String(o.t)) || !ID_RE.test(String(m.id)) || !str(m.n, 60) || !TOKEN_RE.test(String(o.pk))) throw new Error('This join confirmation is not valid.');
    return { k: 'rcp', w: o.w as string, i: o.i as string, t: o.t as string, pk: o.pk as string, at: Number(o.at) || 0, m: { id: m.id as string, n: m.n as string, pos: str(m.pos, 60) ?? '' } };
  }
  if (o.k === 'pass') {
    if (!ID_RE.test(String(o.m)) || !isIsoDate(o.d) || !TOKEN_RE.test(String(o.s))) throw new Error('This check-in pass is not valid.');
    return { k: 'pass', w: o.w as string, m: o.m as string, d: o.d as string, s: o.s as string };
  }
  throw new Error('Unsupported QSwipe code.');
}

/* ------------------------------------------------------------------ */
/* Config transport                                                    */
/* ------------------------------------------------------------------ */

/** Only fields that differ from the template defaults are sent, keeping QR codes small and easy to scan. */
export function compactConfig(c: WorkspaceConfig): CompactConfig {
  const d = configFromPreset(c.preset, c.name);
  const out: CompactConfig = { n: c.name, p: c.preset };
  if (c.groupLabel !== d.groupLabel) out.g = c.groupLabel;
  if (c.unitLabel !== d.unitLabel) out.u = c.unitLabel;
  if (c.personLabel !== d.personLabel) out.m = c.personLabel;
  if (c.titles.join('|') !== d.titles.join('|')) out.t = [...c.titles];
  if (c.shiftStart !== d.shiftStart) out.s = c.shiftStart;
  if (c.shiftEnd !== d.shiftEnd) out.e = c.shiftEnd;
  if (c.days.join('') !== d.days.join('')) out.d = c.days.join('');
  if (c.targetPct !== d.targetPct) out.tp = c.targetPct;
  return out;
}
export function expandConfig(c: CompactConfig): WorkspaceConfig {
  const preset = (c.p in PRESETS ? c.p : 'custom') as Preset;
  return sanitizeConfig({ name: c.n, preset, groupLabel: c.g, unitLabel: c.u, personLabel: c.m, titles: c.t, shiftStart: c.s, shiftEnd: c.e, targetPct: c.tp, days: c.d ? c.d.split('').map(Number) : undefined }, configFromPreset(preset, 'Team workspace'));
}

/* ------------------------------------------------------------------ */
/* Invites ("Join my team")                                            */
/* ------------------------------------------------------------------ */

export function createInvite(a: { parentId: string; level: Level; createdBy: string; hours?: number; maxUses?: number; now?: number }): Invite {
  const now = a.now ?? Date.now();
  return { id: uid(10), token: randomToken(), parentId: a.parentId, level: a.level, createdBy: a.createdBy, createdAt: now, expiresAt: now + (a.hours ?? 72) * 36e5, maxUses: a.maxUses ?? 25, uses: 0 };
}

export function inviteCode(ws: Workspace, inv: Invite): InviteCode {
  const parent = ws.people.find(p => p.id === inv.parentId);
  if (!parent) throw new Error('The inviting branch no longer exists.');
  return { k: 'inv', w: ws.id, c: compactConfig(ws.config), i: inv.id, t: inv.token, p: { id: parent.id, n: parent.name, l: parent.level, b: parent.branch }, l: inv.level, e: inv.expiresAt };
}

export function inviteState(inv: Invite, now = Date.now()): 'active' | 'expired' | 'revoked' | 'used' {
  if (inv.revoked) return 'revoked';
  if (inv.uses >= inv.maxUses) return 'used';
  return now > inv.expiresAt ? 'expired' : 'active';
}

/* ------------------------------------------------------------------ */
/* Joining ("Join the team")                                           */
/* ------------------------------------------------------------------ */

/** On the new member's device: builds their local copy of the workspace and the confirmation code to show the inviter. */
export function joinFromInvite(code: InviteCode, member: { name: string; position?: string }, now = Date.now()): { ws: Workspace; receipt: ReceiptCode } {
  if (now > code.e) throw new Error('This invite has expired. Ask for a new QR code.');
  const name = cleanText(member.name, 60);
  if (name.length < 2) throw new Error('Enter your name (at least 2 characters).');
  const parent = newPerson({ id: code.p.id, name: code.p.n, level: code.p.l, parentId: null, branch: code.p.b, joined: 'owner', createdAt: now });
  const me = newPerson({ name, level: code.l, parentId: parent.id, position: member.position ?? '', joined: 'invite', passKey: randomToken(), createdAt: now });
  const ws: Workspace = {
    id: code.w, createdAt: now, config: expandConfig(code.c), ownerId: parent.id, meId: me.id, people: [parent, me], policy: defaultPolicy(),
    attendance: {}, commitments: {}, announcements: [], acked: {}, audit: [], invites: [], trivia: [], gameEntries: '', ducks: {},
    link: { inviteId: code.i, token: code.t, joinedAt: now },
  };
  return { ws, receipt: receiptFor(ws, me) };
}

export function receiptFor(ws: Workspace, me: Person): ReceiptCode {
  if (!ws.link || !me.passKey) throw new Error('This device did not join by invite.');
  return { k: 'rcp', w: ws.id, i: ws.link.inviteId, t: ws.link.token, pk: me.passKey, at: ws.link.joinedAt, m: { id: me.id, n: me.name, pos: me.position } };
}

/** On the inviter's device: validates a confirmation and returns the person to add. */
export function acceptReceipt(ws: Workspace, r: ReceiptCode, now = Date.now()): { person: Person; invite: Invite } {
  if (r.w !== ws.id) throw new Error('This confirmation belongs to a different workspace.');
  const invite = ws.invites.find(i => i.id === r.i);
  if (!invite || invite.token !== r.t) throw new Error('No matching invite was created on this device.');
  if (invite.revoked) throw new Error('That invite was revoked.');
  // Allow a short grace period: the member may have joined just before expiry.
  if (now > invite.expiresAt + 24 * 36e5) throw new Error('That invite expired. Create a new one.');
  if (invite.uses >= invite.maxUses) throw new Error('That invite has no uses left.');
  if (ws.people.some(p => p.id === r.m.id)) throw new Error(`${r.m.n} is already on the roster.`);
  const error = placementError(indexOrg(ws.people), { level: invite.level, parentId: invite.parentId });
  if (error) throw new Error(error);
  const person = newPerson({ id: r.m.id, name: r.m.n, position: r.m.pos, level: invite.level, parentId: invite.parentId, joined: 'invite', passKey: r.pk, createdAt: now });
  return { person, invite };
}

/* ------------------------------------------------------------------ */
/* Check-in passes                                                     */
/* ------------------------------------------------------------------ */

async function hmac(key: string, message: string): Promise<string> {
  if (!crypto.subtle) throw new Error('Check-in passes need a secure (HTTPS) connection.');
  const k = await crypto.subtle.importKey('raw', fromB64url(key) as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(message)));
  return toB64url(sig.slice(0, 18));
}

export async function createPass(wsId: string, me: Person, date: string): Promise<PassCode> {
  if (!me.passKey) throw new Error('Your device has no check-in key. Join through an invite first.');
  return { k: 'pass', w: wsId, m: me.id, d: date, s: await hmac(me.passKey, `${wsId}|${me.id}|${date}`) };
}

/** On the verifier's device. Throws a user-readable Error, returns the person on success. */
export async function verifyPass(ws: Workspace, pass: PassCode, today: string): Promise<Person> {
  if (pass.w !== ws.id) throw new Error('This pass belongs to a different workspace.');
  const person = ws.people.find(p => p.id === pass.m);
  if (!person) throw new Error('This person is not on your roster yet. Scan their join confirmation first.');
  if (pass.d !== today) throw new Error(`This pass is for ${pass.d < today ? 'an earlier' : 'a later'} day (${pass.d}).`);
  if (!person.passKey) throw new Error(`${person.name} was added manually and has no pass key.`);
  if ((await hmac(person.passKey, `${ws.id}|${person.id}|${pass.d}`)) !== pass.s) throw new Error('The pass signature does not match. It may be forged or from another device.');
  return person;
}

export const passValidUntil = (date: string) => addDays(date, 1);
