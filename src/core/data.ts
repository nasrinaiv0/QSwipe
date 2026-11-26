import { historicalPerson, HISTORY_LIMIT, initializeHistory } from './history';
import { cleanScores } from './engagement';
/** Settings defaults and strict validation for everything read from storage or imported from a backup. */
import { sanitizeDucks } from './ducks';
import { sanitizeTypingBests } from './typing';
import { sanitizeQuestion } from './games';
import { cleanText, COMMITMENTS, configFromPreset, indexOrg, ancestors, isIsoDate, LEVELS, sanitizeAnnouncementText, sanitizeConfig, sanitizePolicy, statusOf } from './model';
import type { AppData, AttendanceRecord, AuditEntry, Commitment, CommitmentRecord, Invite, Level, Person, Settings, Workspace } from './types';

export const STORAGE_KEY = 'qswipe-v3';
const ID_RE = /^[A-Za-z0-9]{6,16}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,32}$/;
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export const SETTING_OPTIONS: { [K in keyof Settings]: readonly Settings[K][] } = {
  theme: ['system', 'light', 'dark'],
  accent: ['green', 'teal', 'blue', 'violet', 'rose', 'amber'],
  density: ['compact', 'comfortable'],
  textSize: ['default', 'large'],
  motion: ['system', 'full', 'reduced'],
  glass: ['regular', 'clear', 'tinted'],
  platform: ['auto', 'ios', 'android'],
  undoSeconds: [5, 10, 30],
  swipeSensitivity: ['gentle', 'balanced', 'quick'],
  triviaTimer: [0, 15, 30],
  sound: [false, true],
  haptics: [false, true],
  confirmAbsent: [false, true],
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system', accent: 'green', density: 'compact', textSize: 'default', motion: 'system', glass: 'regular', platform: 'auto',
  undoSeconds: 10, swipeSensitivity: 'balanced', triviaTimer: 0, sound: false, haptics: true, confirmAbsent: false,
};

export function sanitizeSettings(input: unknown): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS };
  if (!input || typeof input !== 'object') return out;
  const o = input as Record<string, unknown>;
  for (const key of Object.keys(SETTING_OPTIONS) as (keyof Settings)[]) {
    const allowed = SETTING_OPTIONS[key] as readonly unknown[];
    if (allowed.includes(o[key])) (out as unknown as Record<string, unknown>)[key] = o[key];
  }
  return out;
}

export const swipeThreshold = (s: Settings['swipeSensitivity']) => ({ gentle: 130, balanced: 95, quick: 65 })[s];

export const emptyAppData = (): AppData => ({ v: 3, activeId: null, workspaces: {}, settings: { ...DEFAULT_SETTINGS }, triviaBest: 0, typing: {} });

const num = (v: unknown, f = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : f);
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown) => (Array.isArray(v) ? v : []);

function sanitizePeople(input: unknown): Person[] {
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const raw of arr(input).slice(0, 2000)) {
    const o = obj(raw);
    const id = String(o.id);
    const name = cleanText(o.name, 60);
    if (!ID_RE.test(id) || seen.has(id) || !name || !LEVELS.includes(o.level as Level)) continue;
    seen.add(id);
    const level = o.level as Level;
    people.push({
      id, name, level,
      parentId: typeof o.parentId === 'string' ? o.parentId : null,
      position: cleanText(o.position, 60),
      branch: level > 0 ? cleanText(o.branch, 40) : '',
      joined: o.joined === 'owner' || o.joined === 'invite' ? o.joined : 'manual',
      createdAt: num(o.createdAt),
      ...(typeof o.photo === 'string' && o.photo.length < 80_000 && PHOTO_RE.test(o.photo) ? { photo: o.photo } : {}),
      ...(typeof o.passKey === 'string' && TOKEN_RE.test(o.passKey) ? { passKey: o.passKey } : {}),
    });
  }
  // Repair the tree: unknown or lower-level managers detach; cycles break.
  const byId = new Map(people.map(p => [p.id, p]));
  for (const p of people) {
    const parent = p.parentId ? byId.get(p.parentId) : undefined;
    if (!parent || parent.level <= p.level) p.parentId = null;
  }
  const org = indexOrg(people);
  for (const p of people) if (p.parentId && ancestors(org, p.id).length > 4) p.parentId = null;
  return people;
}

function dayMap<T>(input: unknown, ids: Set<string>, clean: (v: unknown) => T | null): Record<string, Record<string, T>> {
  const out: Record<string, Record<string, T>> = {};
  for (const [date, map] of Object.entries(obj(input))) {
    if (!isIsoDate(date)) continue;
    const day: Record<string, T> = {};
    for (const [id, rec] of Object.entries(obj(map))) {
      if (!ids.has(id)) continue;
      const c = clean(rec);
      if (c) day[id] = c;
    }
    if (Object.keys(day).length) out[date] = day;
  }
  return out;
}

export function sanitizeWorkspace(input: unknown): Workspace | null {
  const o = obj(input);
  const id = String(o.id);
  if (!ID_RE.test(id)) return null;
  const people = sanitizePeople(o.people);
  if (!people.length) return null;
  const ids = new Set(people.map(p => p.id));
  const ownerId = ids.has(String(o.ownerId)) ? String(o.ownerId) : people.find(p => !p.parentId)!.id;
  const meId = ids.has(String(o.meId)) ? String(o.meId) : ownerId;
  const historyMap = new Map<string, NonNullable<Workspace['rosterHistory']>[number]>();
  for (const raw of arr(o.rosterHistory).slice(-HISTORY_LIMIT)) {
    const snap = obj(raw);
    if (!isIsoDate(snap.date)) continue;
    const members = sanitizePeople(snap.people).map(historicalPerson);
    if (!members.length) continue;
    const days = [...new Set(arr(snap.days).filter((d): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6))];
    if (!days.length) continue;
    historyMap.set(snap.date as string, { date: snap.date as string, days, people: members });
  }
  const rosterHistory = [...historyMap.values()].sort((a,b)=>a.date.localeCompare(b.date)).slice(-HISTORY_LIMIT);
  const historicalIds = new Set([...ids,...rosterHistory.flatMap(s=>s.people.map(p=>p.id))]);
  const attendance = dayMap<AttendanceRecord>(o.attendance, historicalIds, rec => {
    const s = statusOf(rec);
    if (!s) return null;
    const r = obj(rec);
    const via = ['swipe', 'pass', 'self', 'correction'].includes(String(r.via)) ? (r.via as AttendanceRecord['via']) : undefined;
    return { s, at: num(r.at), by: historicalIds.has(String(r.by)) ? String(r.by) : meId, ...(via ? { via } : {}) };
  });
  const commitments = dayMap<CommitmentRecord>(o.commitments, ids, rec => {
    const r = obj(rec);
    if (!COMMITMENTS.includes(r.c as Commitment)) return null;
    const note = cleanText(r.note, 140);
    return { c: r.c as Commitment, at: num(r.at), ...(note ? { note } : {}) };
  });
  const announcements = arr(o.announcements).slice(0, 300).flatMap(raw => {
    const a = obj(raw);
    const text = sanitizeAnnouncementText(a.text);
    if (!text || !ids.has(String(a.authorId))) return [];
    return [{ id: cleanText(a.id, 32) || `a${num(a.at)}`, authorId: String(a.authorId), scopeId: a.scopeId === 'all' || ids.has(String(a.scopeId)) ? String(a.scopeId) : 'all', text, priority: a.priority === 'important' ? 'important' as const : 'normal' as const, at: num(a.at) }];
  });
  const acked: Workspace['acked'] = {};
  for (const [annId, who] of Object.entries(obj(o.acked))) {
    const clean = Object.fromEntries(Object.entries(obj(who)).filter(([pid, ts]) => ids.has(pid) && typeof ts === 'number'));
    if (Object.keys(clean).length) acked[annId.slice(0, 32)] = clean as Record<string, number>;
  }
  const kinds = ['mark', 'undo', 'correct', 'join', 'add', 'remove', 'move'];
  const audit: AuditEntry[] = arr(o.audit).slice(0, 1000).flatMap(raw => {
    const e = obj(raw);
    if (!isIsoDate(e.date) || !kinds.includes(String(e.kind)) || typeof e.actor !== 'string' || typeof e.subject !== 'string') return [];
    return [{ at: num(e.at), date: e.date, actor: e.actor, subject: e.subject, kind: e.kind as AuditEntry['kind'], from: statusOf(e.from) ?? null, to: statusOf(e.to) ?? null, ...(typeof e.reason === 'string' ? { reason: e.reason.slice(0, 200) } : {}) }];
  });
  const invites: Invite[] = arr(o.invites).slice(0, 100).flatMap(raw => {
    const i = obj(raw);
    if (!ID_RE.test(String(i.id)) || !TOKEN_RE.test(String(i.token)) || !ids.has(String(i.parentId)) || !LEVELS.includes(i.level as Level)) return [];
    return [{ id: String(i.id), token: String(i.token), parentId: String(i.parentId), level: i.level as Level, createdBy: String(i.createdBy), createdAt: num(i.createdAt), expiresAt: num(i.expiresAt), maxUses: Math.max(1, Math.min(500, num(i.maxUses, 25))), uses: Math.max(0, num(i.uses)), ...(i.revoked === true ? { revoked: true } : {}) }];
  });
  const link = obj(o.link);
  const workspace: Workspace = {
    id, createdAt: num(o.createdAt, Date.now()), config: sanitizeConfig(o.config, configFromPreset('custom', 'Workspace')),
    ownerId, meId, people, policy: sanitizePolicy(o.policy), attendance, rosterHistory, commitments, announcements, acked, audit, invites,
    trivia: arr(o.trivia).slice(0, 500).map(sanitizeQuestion).filter((q): q is NonNullable<typeof q> => !!q),
    playScores: cleanScores(o.playScores, people),
    gameEntries: typeof o.gameEntries === 'string' ? o.gameEntries.slice(0, 2000) : '',
    ducks: sanitizeDucks(o.ducks),
    ...(ID_RE.test(String(link.inviteId)) && TOKEN_RE.test(String(link.token)) ? { link: { inviteId: String(link.inviteId), token: String(link.token), joinedAt: num(link.joinedAt) } } : {}),
  };
  initializeHistory(workspace);
  return workspace;
}

export function sanitizeAppData(input: unknown): AppData {
  const o = obj(input);
  const workspaces: AppData['workspaces'] = {};
  for (const raw of Object.values(obj(o.workspaces)).slice(0, 20)) {
    const ws = sanitizeWorkspace(raw);
    if (ws) workspaces[ws.id] = ws;
  }
  const activeId = typeof o.activeId === 'string' && workspaces[o.activeId] ? o.activeId : Object.keys(workspaces)[0] ?? null;
  const best = num(o.triviaBest);
  return { v: 3, activeId, workspaces, settings: sanitizeSettings(o.settings), triviaBest: best >= 0 && best <= 100 ? Math.round(best) : 0, typing: sanitizeTypingBests(o.typing) };
}

export function parseBackup(text: string): AppData {
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  const o = obj(data);
  if (o.app !== 'qswipe' || o.v !== 3) throw new Error('This file is not a QSwipe backup (v3).');
  return sanitizeAppData(o);
}
