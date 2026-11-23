/** Pure domain logic: no DOM, no storage. Unit-tested in tests/model.test.ts. */
import type {
  Announcement, AttendanceRecord, Commitment, CommitmentRecord, Level, Org, Person, Policy, Preset, Status, Titles, Workspace, WorkspaceConfig,
} from './types';

export const STATUSES: readonly Status[] = ['present', 'absent'];
export const COMMITMENTS: readonly Commitment[] = ['confirmed', 'risk', 'unavailable'];
export const LEVELS: readonly Level[] = [0, 1, 2, 3];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/* ------------------------------------------------------------------ */
/* Ids & text                                                          */
/* ------------------------------------------------------------------ */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export function uid(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 62];
  return out;
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase();
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export const hueOf = (id: string) => hashString(id) % 8;

/* ------------------------------------------------------------------ */
/* Terminology presets (defaults only; every field is editable)        */
/* ------------------------------------------------------------------ */

export const PRESETS: Record<Preset, { label: string; groupLabel: string; unitLabel: string; personLabel: string; titles: Titles; shiftStart: string; shiftEnd: string }> = {
  business: { label: 'Business / contact center', groupLabel: 'Team', unitLabel: 'Department', personLabel: 'Member', titles: ['Member', 'Team Leader', 'Manager', 'Director'], shiftStart: '09:00', shiftEnd: '18:00' },
  education: { label: 'School / training', groupLabel: 'Class', unitLabel: 'Department', personLabel: 'Student', titles: ['Student', 'Adviser', 'Coordinator', 'Principal'], shiftStart: '07:30', shiftEnd: '15:00' },
  government: { label: 'Government office', groupLabel: 'Section', unitLabel: 'Division', personLabel: 'Staff', titles: ['Staff', 'Section Head', 'Division Chief', 'Department Head'], shiftStart: '08:00', shiftEnd: '17:00' },
  custom: { label: 'Custom', groupLabel: 'Team', unitLabel: 'Group', personLabel: 'Member', titles: ['Member', 'Lead', 'Manager', 'Head'], shiftStart: '09:00', shiftEnd: '17:00' },
};

export function configFromPreset(preset: Preset, name: string): WorkspaceConfig {
  const p = PRESETS[preset];
  return { name, preset, groupLabel: p.groupLabel, unitLabel: p.unitLabel, personLabel: p.personLabel, titles: [...p.titles], shiftStart: p.shiftStart, shiftEnd: p.shiftEnd, targetPct: 80, days: [1, 2, 3, 4, 5] };
}

export function sanitizeConfig(input: unknown, fallback: WorkspaceConfig): WorkspaceConfig {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const text = (v: unknown, f: string, max = 40) => cleanText(v, max) || f;
  const titles = Array.isArray(o.titles) && o.titles.length === 4 ? (o.titles.map((t, i) => text(t, fallback.titles[i as Level], 32)) as Titles) : fallback.titles;
  const days = Array.isArray(o.days) ? [...new Set(o.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b) : [];
  return {
    name: cleanText(o.name, 60).length >= 2 ? cleanText(o.name, 60) : fallback.name,
    preset: typeof o.preset === 'string' && o.preset in PRESETS ? (o.preset as Preset) : fallback.preset,
    groupLabel: text(o.groupLabel, fallback.groupLabel, 24),
    unitLabel: text(o.unitLabel, fallback.unitLabel, 24),
    personLabel: text(o.personLabel, fallback.personLabel, 24),
    titles,
    shiftStart: typeof o.shiftStart === 'string' && HHMM.test(o.shiftStart) ? o.shiftStart : fallback.shiftStart,
    shiftEnd: typeof o.shiftEnd === 'string' && HHMM.test(o.shiftEnd) ? o.shiftEnd : fallback.shiftEnd,
    targetPct: Number.isInteger(o.targetPct) && (o.targetPct as number) >= 50 && (o.targetPct as number) <= 100 ? (o.targetPct as number) : fallback.targetPct,
    days: days.length ? days : fallback.days,
  };
}

export const shiftLabel = (c: Pick<WorkspaceConfig, 'shiftStart' | 'shiftEnd'>) => `${c.shiftStart}–${c.shiftEnd}${c.shiftEnd <= c.shiftStart ? ' (+1)' : ''}`;

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export function isoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO.test(v)) return false;
  const d = new Date(`${v}T12:00:00`);
  return !Number.isNaN(d.getTime()) && isoDate(d) === v;
}
export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
export const weekdayOf = (iso: string) => new Date(`${iso}T12:00:00`).getDay();

/** The last `count` session dates up to and including `end`, ascending, never before `from`. */
export function sessionDates(end: string, count: number, days: number[], from = '0000-01-01'): string[] {
  const out: string[] = [];
  if (!days.length) return out;
  for (let cur = end, guard = 0; out.length < count && guard < count * 7 + 7 && cur >= from; guard++, cur = addDays(cur, -1)) {
    if (days.includes(weekdayOf(cur))) out.push(cur);
  }
  return out.reverse();
}

export function upcomingSessions(from: string, count: number, days: number[]): string[] {
  const out: string[] = [];
  if (!days.length) return out;
  for (let cur = from, guard = 0; out.length < count && guard < count * 7 + 7; guard++) {
    cur = addDays(cur, 1);
    if (days.includes(weekdayOf(cur))) out.push(cur);
  }
  return out;
}

export function relativeTime(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(ts));
}

/* ------------------------------------------------------------------ */
/* Hierarchy                                                           */
/* ------------------------------------------------------------------ */

export function indexOrg(people: Person[]): Org {
  const byId = new Map(people.map(p => [p.id, p]));
  const children = new Map<string, Person[]>();
  const roots: Person[] = [];
  for (const p of people) {
    if (p.parentId && byId.has(p.parentId)) {
      const list = children.get(p.parentId) ?? [];
      list.push(p);
      children.set(p.parentId, list);
    } else roots.push(p);
  }
  const order = (a: Person, b: Person) => b.level - a.level || a.name.localeCompare(b.name);
  for (const list of children.values()) list.sort(order);
  roots.sort(order);
  return { people, byId, children, roots };
}

export const directReports = (org: Org, id: string) => org.children.get(id) ?? [];

export function descendants(org: Org, id: string): Person[] {
  const out: Person[] = [];
  const stack = [...directReports(org, id)].reverse();
  while (stack.length) {
    const p = stack.pop()!;
    out.push(p);
    const kids = directReports(org, p.id);
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]!);
  }
  return out;
}

export function ancestors(org: Org, id: string): Person[] {
  const out: Person[] = [];
  const seen = new Set<string>([id]);
  let cur = org.byId.get(id);
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    cur = org.byId.get(cur.parentId);
    if (cur) out.push(cur);
  }
  return out;
}

export const isDescendant = (org: Org, actorId: string, subjectId: string) => ancestors(org, subjectId).some(p => p.id === actorId);

/** Display name of the team/unit a person belongs to (their own branch if they lead one). */
export function branchOf(org: Org, p: Person): string {
  if (p.level > 0 && p.branch) return p.branch;
  const parent = p.parentId ? org.byId.get(p.parentId) : undefined;
  return parent?.branch || '';
}

/** Validates placing a person (new or existing) at `level` under `parentId`. Returns an error or null. */
export function placementError(org: Org, { id, level, parentId }: { id?: string; level: Level; parentId: string | null }): string | null {
  if (!LEVELS.includes(level)) return 'Choose a valid level.';
  if (parentId) {
    const parent = org.byId.get(parentId);
    if (!parent) return 'That manager no longer exists.';
    if (parent.level <= level) return 'People must report to someone at a higher level.';
    if (id && (parentId === id || isDescendant(org, id, parentId))) return 'Someone cannot report to a person in their own branch.';
  }
  if (id) {
    const reports = directReports(org, id);
    if (reports.some(r => r.level >= level)) return 'This person has direct reports at the same or higher level.';
  }
  return null;
}

/** Removes a person; their direct reports move up to the removed person's manager. */
export function removeFromOrg(people: Person[], id: string): Person[] {
  const target = people.find(p => p.id === id);
  if (!target) return people;
  return people.filter(p => p.id !== id).map(p => (p.parentId === id ? { ...p, parentId: target.parentId } : p));
}

/* ------------------------------------------------------------------ */
/* Access policy                                                       */
/* ------------------------------------------------------------------ */

export interface Feature { key: string; area: string; label: string; min: Level; ownerOnly?: boolean }
export const FEATURES: readonly Feature[] = [
  { key: 'attendance.verify', area: 'Attendance', label: 'Verify attendance for their branch', min: 1 },
  { key: 'attendance.correct', area: 'Attendance', label: 'Correct resolved records with a reason', min: 2 },
  { key: 'commitments.projection', area: 'Commitments', label: 'See the staffing projection', min: 1 },
  { key: 'reports.view', area: 'Reports', label: 'View reports and the audit log', min: 1 },
  { key: 'reports.export', area: 'Reports', label: 'Export CSV', min: 2 },
  { key: 'scope.workspace', area: 'Visibility', label: 'See the whole workspace, not only their branch', min: 3 },
  { key: 'people.manage', area: 'People', label: 'Add, edit, invite and remove people in their branch', min: 1 },
  { key: 'updates.post', area: 'Updates', label: 'Post announcements to their branch', min: 1 },
  { key: 'updates.broadcast', area: 'Updates', label: 'Broadcast to the entire workspace', min: 3 },
  { key: 'settings.workspace', area: 'Settings', label: 'Edit schedule, labels and coverage target', min: 2 },
  { key: 'settings.access', area: 'Settings', label: 'Manage this access policy', min: 3, ownerOnly: true },
];
const FEATURE_MAP = new Map(FEATURES.map(f => [f.key, f]));

export const defaultPolicy = (): Policy => Object.fromEntries(FEATURES.map(f => [f.key, f.min]));

export function sanitizePolicy(input: unknown): Policy {
  const policy = defaultPolicy();
  if (!input || typeof input !== 'object') return policy;
  for (const f of FEATURES) {
    const v = (input as Record<string, unknown>)[f.key];
    if (!f.ownerOnly && Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 3) policy[f.key] = v as number;
  }
  return policy;
}

export function requiredLevel(policy: Policy, feature: string): number {
  const f = FEATURE_MAP.get(feature);
  if (!f) return Infinity;
  return f.ownerOnly ? Infinity : policy[feature] ?? f.min;
}

/** The workspace owner can do everything; everyone else is checked against the per-level policy. */
export function canAccess(ws: Pick<Workspace, 'policy' | 'ownerId'>, person: Person | undefined, feature: string): boolean {
  if (!person || !FEATURE_MAP.has(feature)) return false;
  return person.id === ws.ownerId || person.level >= requiredLevel(ws.policy, feature);
}

export function viewScope(ws: Pick<Workspace, 'policy' | 'ownerId'>, org: Org, actor: Person | undefined): Person[] {
  if (!actor) return [];
  if (canAccess(ws, actor, 'scope.workspace')) return org.people.filter(p => p.id !== actor.id);
  return descendants(org, actor.id);
}

/** Whether `actor` may add, edit, move or remove `subjectId` (always within their own branch). */
export function canManagePerson(ws: Pick<Workspace, 'policy' | 'ownerId'>, org: Org, actor: Person | undefined, subjectId: string): boolean {
  if (!actor || !canAccess(ws, actor, 'people.manage') || subjectId === ws.ownerId) return false;
  return actor.id === ws.ownerId ? subjectId !== actor.id : isDescendant(org, actor.id, subjectId);
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

export function statusOf(rec: unknown): Status | undefined {
  const s = typeof rec === 'string' ? rec : rec && typeof rec === 'object' ? (rec as AttendanceRecord).s : undefined;
  return s === 'present' || s === 'absent' ? s : undefined;
}

export interface RosterStats { scheduled: number; present: number; absent: number; pending: number }
export function rosterStats(people: Person[], records: Record<string, unknown> = {}): RosterStats {
  const c = { scheduled: people.length, present: 0, absent: 0, pending: 0 };
  for (const p of people) {
    const s = statusOf(records[p.id]);
    if (s === 'present') c.present++;
    else if (s === 'absent') c.absent++;
    else c.pending++;
  }
  return c;
}

export const pendingPeople = (people: Person[], records: Record<string, unknown> = {}) => people.filter(p => !statusOf(records[p.id]));

export type MarkReason = 'missing' | 'future' | 'resolved' | 'self' | 'permission' | 'scope' | 'verify';
export function markDecision(a: { ws: Pick<Workspace, 'policy' | 'ownerId'>; org: Org; actor?: Person; subject?: Person; records?: Record<string, unknown>; date: string; today: string }): { ok: boolean; reason: MarkReason } {
  const { ws, org, actor, subject, records = {}, date, today } = a;
  if (!actor || !subject) return { ok: false, reason: 'missing' };
  if (date > today) return { ok: false, reason: 'future' };
  if (statusOf(records[subject.id])) return { ok: false, reason: 'resolved' };
  if (actor.id === subject.id) return { ok: true, reason: 'self' };
  if (!canAccess(ws, actor, 'attendance.verify')) return { ok: false, reason: 'permission' };
  if (!isDescendant(org, actor.id, subject.id)) return { ok: false, reason: 'scope' };
  return { ok: true, reason: 'verify' };
}

export function validateCorrection({ from, to, reason }: { from?: Status | null; to: string; reason: string }): string | null {
  if (!['present', 'absent', 'clear'].includes(to)) return 'Choose a valid status.';
  if ((from ?? 'clear') === to) return 'The new status matches the current one.';
  const text = reason.trim();
  if (text.length < 5) return 'Add a reason of at least 5 characters.';
  if (text.length > 200) return 'Keep the reason under 200 characters.';
  return null;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export const percent = (n: number, d: number): number | null => (d > 0 ? Math.round((100 * n) / d) : null);
/** Attendance rate counts resolved records only; unmarked is never treated as an absence. */
export const attendanceRate = (s: Pick<RosterStats, 'present' | 'absent'>) => percent(s.present, s.present + s.absent);

export type RecordsFor = (date: string) => Record<string, unknown> | undefined;
export const dailySeries = (people: Person[], recordsFor: RecordsFor, dates: string[]) => dates.map(date => ({ date, ...rosterStats(people, recordsFor(date) ?? {}) }));

export function summarize(series: RosterStats[]) {
  const t = series.reduce((a, d) => ({ scheduled: a.scheduled + d.scheduled, present: a.present + d.present, absent: a.absent + d.absent, pending: a.pending + d.pending }), { scheduled: 0, present: 0, absent: 0, pending: 0 });
  return { ...t, rate: attendanceRate(t), completion: percent(t.present + t.absent, t.scheduled) };
}

export function personSummary(person: Person, recordsFor: RecordsFor, dates: string[]) {
  let present = 0, absent = 0, pending = 0, streak = 0, open = true;
  for (let i = dates.length - 1; i >= 0; i--) {
    const s = statusOf((recordsFor(dates[i]!) ?? {})[person.id]);
    if (s === 'present') { present++; if (open) streak++; }
    else if (s === 'absent') { absent++; open = false; }
    else { pending++; if (i !== dates.length - 1) open = false; }
  }
  return { present, absent, pending, rate: percent(present, present + absent), streak };
}

export function csvCell(value: unknown): string {
  const text = String(value ?? '').replace(/^([=+\-@\t\r])/, "'$1");
  return `"${text.replaceAll('"', '""')}"`;
}
export const toCSV = (rows: unknown[][]) => rows.map(r => r.map(csvCell).join(',')).join('\r\n');

/* ------------------------------------------------------------------ */
/* Commitments                                                         */
/* ------------------------------------------------------------------ */

export function commitmentOf(rec: unknown): Commitment | undefined {
  const c = typeof rec === 'string' ? rec : rec && typeof rec === 'object' ? (rec as CommitmentRecord).c : undefined;
  return COMMITMENTS.includes(c as Commitment) ? (c as Commitment) : undefined;
}

export function commitmentStats(people: Person[], commitments: Record<string, unknown> = {}) {
  const c = { confirmed: 0, atRisk: 0, unavailable: 0, pending: 0 };
  for (const p of people) {
    const v = commitmentOf(commitments[p.id]);
    if (v === 'confirmed') c.confirmed++;
    else if (v === 'risk') c.atRisk++;
    else if (v === 'unavailable') c.unavailable++;
    else c.pending++;
  }
  return c;
}

/** Conservative forecast: only confirmed people count. */
export const projectedCoverage = (c: { confirmed: number }) => c.confirmed;
export const coverageTarget = (headcount: number, pct: number) => Math.ceil((headcount * pct) / 100);

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export function sanitizeAnnouncementText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 700);
}

export function audienceOptions(org: Org, actor: Person | undefined, broadcast: boolean): string[] {
  if (!actor) return [];
  const opts: string[] = broadcast ? ['all'] : [];
  if (directReports(org, actor.id).length) opts.push(actor.id);
  for (const p of descendants(org, actor.id)) if (directReports(org, p.id).length) opts.push(p.id);
  return [...new Set(opts)];
}

export function isAnnouncementVisible(org: Org, personId: string, a: Pick<Announcement, 'scopeId' | 'authorId'>): boolean {
  if (a.scopeId === 'all' || a.authorId === personId || a.scopeId === personId) return true;
  return isDescendant(org, a.scopeId, personId) || isDescendant(org, personId, a.scopeId);
}

/* ------------------------------------------------------------------ */
/* Workspace factory                                                   */
/* ------------------------------------------------------------------ */

export function newPerson(fields: Pick<Person, 'name' | 'level' | 'parentId'> & Partial<Person>): Person {
  return {
    id: fields.id ?? uid(),
    name: cleanText(fields.name, 60),
    level: fields.level,
    parentId: fields.parentId,
    position: cleanText(fields.position ?? '', 60),
    branch: fields.level > 0 ? cleanText(fields.branch ?? '', 40) : '',
    joined: fields.joined ?? 'manual',
    createdAt: fields.createdAt ?? Date.now(),
    ...(fields.photo ? { photo: fields.photo } : {}),
    ...(fields.passKey ? { passKey: fields.passKey } : {}),
  };
}

export function createWorkspace(a: { name: string; preset: Preset; ownerName: string; ownerLevel: Level; ownerBranch?: string; ownerPosition?: string }): Workspace {
  const config = configFromPreset(a.preset, cleanText(a.name, 60) || 'My workspace');
  const owner = newPerson({ name: a.ownerName, level: a.ownerLevel, parentId: null, branch: a.ownerBranch ?? '', position: a.ownerPosition ?? config.titles[a.ownerLevel], joined: 'owner' });
  return {
    id: uid(12), createdAt: Date.now(), config, ownerId: owner.id, meId: owner.id, people: [owner], policy: defaultPolicy(),
    attendance: {}, commitments: {}, announcements: [], acked: {}, audit: [], invites: [], trivia: [], gameEntries: '',
  };
}
