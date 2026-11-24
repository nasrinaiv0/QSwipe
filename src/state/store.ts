import { addScore, type PlayScore } from '../core/engagement';
/** Application state: persisted AppData plus session UI state, selectors and permission-checked mutations. */
import { acceptReceipt, createInvite, joinFromInvite, verifyPass, type InviteCode, type PassCode, type ReceiptCode } from '../core/codes';
import { emptyAppData, sanitizeAppData, sanitizeSettings, STORAGE_KEY } from '../core/data';
import { sanitizeQuestion } from '../core/games';
import * as M from '../core/model';
import type { AppData, AuditEntry, Commitment, Invite, Level, Org, Person, Settings, Status, TriviaQuestion, Workspace, WorkspaceConfig } from '../core/types';

export interface Session {
  today: string;
  date: string;
  route: { page: string; sub: string };
  previewId: string | null;
  lastAction: { id: string; status: Status; at: number; date: string } | null;
  ui: {
    attTab: 'verify' | 'self'; rosterFilter: string; rosterQuery: string; queueOffset: number; deckEnter: 'promote' | 'return' | null; returnDir: number;
    reportRange: number; reportBranch: string; reportSort: { key: string; dir: number }; reportQuery: string;
    orgQuery: string; orgSelected: string | null; orgCollapsed: Set<string>; teamTab: string;
    feedFilter: string; commitDate: string | null; commitFilter: string;
  };
}

export let data: AppData = emptyAppData();
export const session: Session = {
  today: M.isoDate(),
  date: M.isoDate(),
  route: { page: 'today', sub: '' },
  previewId: null,
  lastAction: null,
  ui: {
    attTab: 'verify', rosterFilter: 'all', rosterQuery: '', queueOffset: 0, deckEnter: null, returnDir: 1,
    reportRange: 10, reportBranch: 'all', reportSort: { key: 'name', dir: 1 }, reportQuery: '',
    orgQuery: '', orgSelected: null, orgCollapsed: new Set(), teamTab: 'chart',
    feedFilter: 'all', commitDate: null, commitFilter: 'all',
  },
};

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

export function load(): void {
  try { data = sanitizeAppData(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { data = emptyAppData(); }
}

let timer: ReturnType<typeof setTimeout> | undefined;
export const persist = () => { clearTimeout(timer); timer = setTimeout(flush, 120); };
export function flush(): boolean {
  clearTimeout(timer);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; } catch {
    document.dispatchEvent(new CustomEvent('qswipe:storage-error'));
    return false;
  }
}
export const storageBytes = () => new Blob([localStorage.getItem(STORAGE_KEY) ?? '']).size;

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export const hasWorkspace = () => !!data.activeId && !!data.workspaces[data.activeId];
export const ws = (): Workspace => data.workspaces[data.activeId!]!;
export const cfg = (): WorkspaceConfig => ws().config;
export const settings = (): Settings => data.settings;

let orgMemo: { people: Person[] | null; org: Org | null } = { people: null, org: null };
export function org(): Org {
  const people = ws().people;
  if (orgMemo.people !== people) orgMemo = { people, org: M.indexOrg(people) };
  return orgMemo.org!;
}
/** The signed-in person on this device. */
export const self = (): Person => org().byId.get(ws().meId) ?? org().byId.get(ws().ownerId) ?? ws().people[0]!;
/** The effective identity: the previewed person while previewing, otherwise self. */
export const me = (): Person => (session.previewId && org().byId.get(session.previewId)) || self();
export const can = (feature: string) => M.canAccess(ws(), me(), feature);
export const canPreview = () => M.canAccess(ws(), self(), 'settings.access');
export const isOwner = (p = me()) => p.id === ws().ownerId;
export const levelTitle = (level: number) => cfg().titles[level as Level] ?? `Level ${level}`;
export const records = (date = session.date) => ws().attendance[date] ?? {};
export const branch = () => M.descendants(org(), me().id);
export const visiblePeople = () => M.viewScope(ws(), org(), me());
export const isSessionDay = (date: string) => cfg().days.includes(M.weekdayOf(date));
export const branchName = (p: Person) => M.branchOf(org(), p);
export const startDate = () => M.isoDate(new Date(ws().createdAt));

export function commitDate(): string {
  const upcoming = M.upcomingSessions(session.today, 5, cfg().days);
  return session.ui.commitDate && upcoming.includes(session.ui.commitDate) ? session.ui.commitDate : upcoming[0] ?? M.addDays(session.today, 1);
}
export const commitmentsFor = (date = commitDate()) => ws().commitments[date] ?? {};

export function scopeLabel(p = me()): string {
  if (M.canAccess(ws(), p, 'scope.workspace')) return cfg().name;
  if (p.level === 0 || !M.directReports(org(), p.id).length) return 'Your own records';
  return p.branch || `${p.name}'s branch`;
}

export function audienceLabel(scopeId: string): string {
  if (scopeId === 'all') return 'Everyone';
  const p = org().byId.get(scopeId);
  return p ? p.branch || `${p.name}'s branch` : 'Everyone';
}

export function visibleAnnouncements() {
  const o = org(), id = me().id;
  return ws().announcements.filter(a => M.isAnnouncementVisible(o, id, a)).sort((a, b) => b.at - a.at);
}
export const isRead = (a: { id: string; authorId: string }) => a.authorId === me().id || !!ws().acked[a.id]?.[me().id];
export const unreadCount = () => (hasWorkspace() ? visibleAnnouncements().filter(a => !isRead(a)).length : 0);

/* ------------------------------------------------------------------ */
/* Workspaces                                                          */
/* ------------------------------------------------------------------ */

function resetSession() {
  session.previewId = null;
  session.lastAction = null;
  session.date = session.today;
  Object.assign(session.ui, { queueOffset: 0, orgSelected: null, reportBranch: 'all', commitDate: null, attTab: 'verify' });
}

export function addWorkspace(w: Workspace): void {
  data.workspaces[w.id] = w;
  data.activeId = w.id;
  resetSession();
  persist();
}

export function switchWorkspace(id: string): boolean {
  if (!data.workspaces[id] || id === data.activeId) return false;
  data.activeId = id;
  resetSession();
  persist();
  return true;
}

export function deleteWorkspace(id: string): void {
  delete data.workspaces[id];
  data.activeId = Object.keys(data.workspaces)[0] ?? null;
  resetSession();
  flush();
}

export function setPreview(id: string | null): boolean {
  if (id && (!canPreview() || !org().byId.has(id) || id === self().id)) return false;
  session.previewId = id;
  session.lastAction = null;
  session.ui.queueOffset = 0;
  session.ui.attTab = M.canAccess(ws(), me(), 'attendance.verify') && branch().length ? 'verify' : 'self';
  return true;
}

export function setDate(date: string): boolean {
  if (!M.isIsoDate(date)) return false;
  session.date = date;
  session.ui.queueOffset = 0;
  session.lastAction = null;
  return true;
}

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

function audit(entry: Omit<AuditEntry, 'at' | 'actor' | 'date'> & { date?: string }) {
  const w = ws();
  w.audit.unshift({ at: Date.now(), actor: me().id, date: session.date, ...entry });
  if (w.audit.length > 1000) w.audit.length = 1000;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export function mark(subjectId: string, status: Status, via: 'swipe' | 'pass' | 'self' = 'swipe', date = session.date): Result<{ subject: Person }> & { reason?: M.MarkReason } {
  const o = org(), subject = o.byId.get(subjectId);
  const decision = M.markDecision({ ws: ws(), org: o, actor: me(), subject, records: records(date), date, today: session.today });
  if (!decision.ok) return { ok: false, error: markError(decision.reason, subject), reason: decision.reason };
  const w = ws();
  (w.attendance[date] ??= {})[subjectId] = { s: status, at: Date.now(), by: me().id, via: decision.reason === 'self' ? 'self' : via };
  session.lastAction = { id: subjectId, status, at: Date.now(), date };
  audit({ kind: 'mark', subject: subjectId, from: null, to: status, date });
  persist();
  return { ok: true, subject: subject! };
}

export function markError(reason: M.MarkReason, subject?: Person): string {
  const name = subject?.name ?? 'This person';
  return ({
    missing: 'That person is no longer on the roster.',
    future: 'Attendance for future sessions opens on the day.',
    resolved: `${name} is already marked for this session.`,
    permission: `Your level cannot verify others. ${cfg().titles[M.requiredLevel(ws().policy, 'attendance.verify') as Level] ?? 'Higher levels'} and above can.`,
    scope: `${name} is outside your branch.`,
    self: '', verify: '',
  } as Record<M.MarkReason, string>)[reason];
}

export function canUndo(): boolean {
  const a = session.lastAction;
  return !!a && Date.now() - a.at <= settings().undoSeconds * 1000;
}

export function undo(): Result<{ id: string; status: Status }> {
  const a = session.lastAction;
  if (!a || !canUndo()) return { ok: false, error: 'Undo window has passed. Use a correction instead.' };
  delete ws().attendance[a.date]?.[a.id];
  audit({ kind: 'undo', subject: a.id, from: a.status, to: null, date: a.date });
  session.lastAction = null;
  persist();
  return { ok: true, id: a.id, status: a.status };
}

export function correct(subjectId: string, to: string, reason: string): Result {
  if (!can('attendance.correct')) return { ok: false, error: 'Your level cannot correct records.' };
  if (!M.isDescendant(org(), me().id, subjectId)) return { ok: false, error: 'This person is outside your branch.' };
  const from = M.statusOf(records()[subjectId]) ?? null;
  const error = M.validateCorrection({ from, to, reason });
  if (error) return { ok: false, error };
  const day = (ws().attendance[session.date] ??= {});
  if (to === 'clear') delete day[subjectId];
  else day[subjectId] = { s: to as Status, at: Date.now(), by: me().id, via: 'correction' };
  audit({ kind: 'correct', subject: subjectId, from, to: to === 'clear' ? null : (to as Status), reason: reason.trim() });
  if (session.lastAction?.id === subjectId) session.lastAction = null;
  persist();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* People & invites                                                    */
/* ------------------------------------------------------------------ */

export interface PersonInput { name: string; position: string; level: Level; parentId: string | null; branch: string; photo?: string | null }

export function addPerson(input: PersonInput): Result<{ person: Person }> {
  if (!input.parentId || !(input.parentId === me().id ? can('people.manage') : M.canManagePerson(ws(), org(), me(), input.parentId))) return { ok: false, error: 'You can only add people inside your own branch.' };
  if (M.cleanText(input.name, 60).length < 2) return { ok: false, error: 'Enter a name of at least 2 characters.' };
  const error = M.placementError(org(), { level: input.level, parentId: input.parentId });
  if (error) return { ok: false, error };
  const person = M.newPerson({ ...input, photo: input.photo ?? undefined, joined: 'manual' });
  ws().people = [...ws().people, person];
  audit({ kind: 'add', subject: person.id, from: null, to: null });
  persist();
  return { ok: true, person };
}

export function updatePerson(id: string, input: PersonInput): Result {
  const w = ws(), current = org().byId.get(id);
  if (!current) return { ok: false, error: 'That person no longer exists.' };
  const isSelf = id === self().id && !session.previewId;
  const manage = M.canManagePerson(w, org(), me(), id);
  if (!isSelf && !manage) return { ok: false, error: 'You can only edit people in your branch.' };
  if (M.cleanText(input.name, 60).length < 2) return { ok: false, error: 'Enter a name of at least 2 characters.' };
  // Placement changes need management rights; the owner's own placement stays at the root.
  const placementChanged = input.level !== current.level || input.parentId !== current.parentId;
  if (placementChanged) {
    if (!manage && !(isSelf && isOwner(current))) return { ok: false, error: 'Ask someone above you to change your level or manager.' };
    if (input.parentId && !(input.parentId === me().id || M.canManagePerson(w, org(), me(), input.parentId) || isOwner(me()))) return { ok: false, error: 'The new manager must be in your branch.' };
    const error = M.placementError(org(), { id, level: input.level, parentId: input.parentId });
    if (error) return { ok: false, error };
  }
  const updated: Person = { ...current, name: M.cleanText(input.name, 60), position: M.cleanText(input.position, 60), level: input.level, parentId: input.parentId, branch: input.level > 0 ? M.cleanText(input.branch, 40) : '' };
  if (input.photo === null) delete updated.photo; else if (input.photo) updated.photo = input.photo;
  w.people = w.people.map(p => (p.id === id ? updated : p));
  if (placementChanged) audit({ kind: 'move', subject: id, from: null, to: null });
  persist();
  return { ok: true };
}

export function removePerson(id: string): Result<{ snapshot: Person[] }> {
  if (!M.canManagePerson(ws(), org(), me(), id)) return { ok: false, error: 'You can only remove people in your branch.' };
  const snapshot = ws().people;
  ws().people = M.removeFromOrg(snapshot, id);
  audit({ kind: 'remove', subject: id, from: null, to: null });
  if (session.ui.orgSelected === id) session.ui.orgSelected = null;
  persist();
  return { ok: true, snapshot };
}

export function restorePeople(snapshot: Person[]) { ws().people = snapshot; persist(); }

export function newInvite(parentId: string, level: Level, hours: number, maxUses: number): Result<{ invite: Invite }> {
  if (!(parentId === me().id ? can('people.manage') : M.canManagePerson(ws(), org(), me(), parentId))) return { ok: false, error: 'You can only invite people into your own branch.' };
  const error = M.placementError(org(), { level, parentId });
  if (error) return { ok: false, error };
  const invite = createInvite({ parentId, level, createdBy: me().id, hours, maxUses });
  ws().invites = [invite, ...ws().invites].slice(0, 100);
  persist();
  return { ok: true, invite };
}

export function revokeInvite(id: string) {
  const inv = ws().invites.find(i => i.id === id);
  if (inv) { inv.revoked = true; persist(); }
}

/** "Join the team": scanned an invite on this device. */
export function joinWithInvite(code: InviteCode, member: { name: string; position: string }): Result<{ receipt?: ReceiptCode; local: boolean }> {
  try {
    const existing = data.workspaces[code.w];
    if (existing) {
      if (existing.link?.inviteId === code.i) return { ok: false, error: 'This device already joined with this invite. Open Team → My join code to show your confirmation again.' };
      // Same device already holds this workspace: if the invite was made here, add the person directly.
      const { receipt } = joinFromInvite(code, member);
      switchWorkspace(existing.id);
      const accepted = acceptReceipt(existing, receipt);
      existing.people = [...existing.people, accepted.person];
      accepted.invite.uses++;
      audit({ kind: 'join', subject: accepted.person.id, from: null, to: null });
      persist();
      return { ok: true, local: true };
    }
    const { ws: joined, receipt } = joinFromInvite(code, member);
    addWorkspace(joined);
    return { ok: true, receipt, local: false };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Inviter scans a member's join confirmation. */
export function acceptJoin(r: ReceiptCode): Result<{ person: Person }> {
  const target = data.workspaces[r.w];
  if (!target) return { ok: false, error: 'This confirmation is for a workspace that is not on this device.' };
  if (target !== ws()) switchWorkspace(target.id);
  try {
    const { person, invite } = acceptReceipt(target, r);
    if (!(invite.parentId === me().id ? can('people.manage') : M.canManagePerson(target, org(), me(), invite.parentId))) return { ok: false, error: 'Only someone above that branch can confirm this join.' };
    target.people = [...target.people, person];
    invite.uses++;
    audit({ kind: 'join', subject: person.id, from: null, to: null });
    persist();
    return { ok: true, person };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function checkInWithPass(pass: PassCode): Promise<Result<{ person: Person }>> {
  const target = data.workspaces[pass.w];
  if (!target) return { ok: false, error: 'This pass is for a workspace that is not on this device.' };
  if (target !== ws()) switchWorkspace(target.id);
  try {
    const person = await verifyPass(target, pass, session.today);
    const res = mark(person.id, 'present', 'pass', session.today);
    return res.ok ? { ok: true, person } : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/* ------------------------------------------------------------------ */
/* Commitments, updates, games, settings                               */
/* ------------------------------------------------------------------ */

export function setCommitment(date: string, value: Commitment, note?: string): void {
  const day = (ws().commitments[date] ??= {});
  const prev = day[me().id];
  const clean = M.cleanText(note ?? prev?.note ?? '', 140);
  day[me().id] = { c: value, at: Date.now(), ...(clean && value !== 'confirmed' ? { note: clean } : {}) };
  persist();
}

export function postAnnouncement(a: { text: string; scopeId: string; priority: string }): Result {
  if (!can('updates.post')) return { ok: false, error: 'Your level cannot post announcements.' };
  const text = M.sanitizeAnnouncementText(a.text);
  if (!text) return { ok: false, error: 'Write a message first.' };
  const allowed = M.audienceOptions(org(), me(), can('updates.broadcast'));
  const scopeId = allowed.includes(a.scopeId) ? a.scopeId : allowed[0];
  if (!scopeId) return { ok: false, error: 'You have nobody to post to yet.' };
  ws().announcements.unshift({ id: M.uid(), authorId: me().id, scopeId, text, priority: a.priority === 'important' ? 'important' : 'normal', at: Date.now() });
  ws().announcements.length = Math.min(ws().announcements.length, 300);
  persist();
  return { ok: true };
}

export function acknowledge(id: string, value = true) {
  const map = (ws().acked[id] ??= {});
  if (value) map[me().id] = Date.now(); else delete map[me().id];
  persist();
}
export const acknowledgeAll = () => visibleAnnouncements().forEach(a => { if (!isRead(a)) acknowledge(a.id); });

export function deleteAnnouncement(id: string) {
  const list = ws().announcements, i = list.findIndex(a => a.id === id && a.authorId === me().id);
  if (i < 0) return null;
  const [removed] = list.splice(i, 1);
  persist();
  return { removed: removed!, index: i };
}
export function restoreAnnouncement(r: { removed: Workspace['announcements'][number]; index: number }) {
  ws().announcements.splice(Math.min(r.index, ws().announcements.length), 0, r.removed);
  persist();
}
export function ackCount(a: { id: string; scopeId: string; authorId: string }) {
  const o = org();
  const audience = a.scopeId === 'all' ? o.people : [o.byId.get(a.scopeId), ...M.descendants(o, a.scopeId)].filter((p): p is Person => !!p);
  const acked = ws().acked[a.id] ?? {};
  const reach = audience.filter(p => p.id !== a.authorId);
  return { acked: reach.filter(p => acked[p.id]).length, reach: reach.length };
}

export function saveQuestion(input: unknown): Result<{ q: TriviaQuestion }> {
  const q = sanitizeQuestion(input);
  if (!q) return { ok: false, error: 'Add a question, four different options and pick the correct one.' };
  const bank = ws().trivia, i = bank.findIndex(x => x.id === q.id);
  if (i >= 0) bank[i] = q; else bank.unshift(q);
  persist();
  return { ok: true, q };
}
export function deleteQuestion(id: string) { ws().trivia = ws().trivia.filter(q => q.id !== id); persist(); }

export function updateSettings(patch: Partial<Settings>) { data.settings = sanitizeSettings({ ...data.settings, ...patch }); persist(); }

export function setPolicyLevel(feature: string, level: number): boolean {
  if (!can('settings.access')) return false;
  ws().policy = M.sanitizePolicy({ ...ws().policy, [feature]: level });
  persist();
  return true;
}
export function resetPolicy() { if (can('settings.access')) { ws().policy = M.defaultPolicy(); persist(); } }

export function updateConfig(patch: Partial<WorkspaceConfig>): boolean {
  if (!can('settings.workspace')) return false;
  ws().config = M.sanitizeConfig({ ...ws().config, ...patch }, ws().config);
  persist();
  return true;
}

export function recordPlayScores(scores: PlayScore[]): number {
  if (session.previewId) return 0;
  const allowed=new Set([me(),...visiblePeople()].map(p=>p.id));
  let ledger=ws().playScores??[],count=0;
  for(const score of scores){if(!allowed.has(score.playerId))continue;const next=addScore(ledger,score,ws().people,M.isoDate());if(next){ledger=next;count++;}}
  if(count){ws().playScores=ledger;flush();}return count;
}
export function setGameEntries(text: string) { ws().gameEntries = text.slice(0, 2000); persist(); }
export function setTriviaBest(pct: number) { if (pct > data.triviaBest) { data.triviaBest = pct; persist(); } }

export function replaceData(next: AppData) { data = next; resetSession(); flush(); }
export function clearWorkspaceRecords() {
  const w = ws();
  Object.assign(w, { attendance: {}, commitments: {}, announcements: [], acked: {}, audit: [] });
  session.lastAction = null;
  persist();
}
