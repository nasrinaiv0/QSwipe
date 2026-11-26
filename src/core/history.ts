import { addDays, branchOf, canAccess, descendants, indexOrg, isoDate, statusOf, viewScope, weekdayOf, rosterStats } from './model';
import type { Person, RosterSnapshot, Workspace } from './types';

export const HISTORY_LIMIT = 90;
export function historicalPerson(p: Person): Person {
  const { photo: _photo, passKey: _key, ...rest } = p;
  return rest;
}
function put(w: Workspace, date: string, people: Person[], days: number[]) {
  const snapshot: RosterSnapshot = { date, days: [...days], people: people.map(historicalPerson) };
  w.rosterHistory = [...(w.rosterHistory ?? []).filter(x => x.date !== date), snapshot]
    .sort((a,b) => a.date.localeCompare(b.date)).slice(-HISTORY_LIMIT);
}
export function initializeHistory(w: Workspace, today = isoDate()) {
  if (!w.rosterHistory?.length) put(w, today, w.people, w.config.days);
}
export function recordRosterChange(w: Workspace, today = isoDate()) {
  initializeHistory(w, today);
  put(w, addDays(today, 1), w.people, w.config.days);
}
export function snapshotAt(w: Workspace, date: string): RosterSnapshot | undefined {
  return (w.rosterHistory ?? []).filter(x => x.date <= date).at(-1);
}
export function rosterAt(w: Workspace, date: string): Person[] {
  const snap = snapshotAt(w, date);
  if (snap) return snap.people;
  // Legacy dates: count only identifiable marked people, not invented eligibility.
  return w.people.filter(p => !!statusOf(w.attendance[date]?.[p.id])).map(historicalPerson);
}
export function recordSameDayEligibility(w: Workspace, p: Person, date: string, today = isoDate()) {
  initializeHistory(w, today);
  if (date !== today) return;
  const snap = snapshotAt(w, today);
  if (!snap || snap.people.some(x => x.id === p.id)) return;
  put(w, today, [...snap.people, p], snap.days);
}
export function reportDates(w: Workspace, end: string, count: number): string[] {
  const dates: string[] = [], start = isoDate(new Date(w.createdAt));
  // Bounded recent history; old recorded days still qualify even when schedule is unknown.
  for (let date = end, i = 0; date >= start && i < 730 && dates.length < count; date = addDays(date,-1), i++) {
    const snap = snapshotAt(w,date);
    if (snap?.days.includes(weekdayOf(date)) || Object.values(w.attendance[date] ?? {}).some(statusOf)) dates.push(date);
  }
  return dates.reverse();
}
export function historicalScope(w: Workspace, actor: Person, date: string, branch = 'all'): Person[] {
  if (!canAccess(w,actor,'reports.view')) return [];
  const people = rosterAt(w,date), org = indexOrg(people);
  if (!org.byId.has(actor.id) && !canAccess(w,actor,'scope.workspace')) return [];
  const visible = viewScope(w,org,actor);
  if (branch === 'all') return visible;
  const ids = new Set(descendants(org,branch).map(p=>p.id));
  return visible.filter(p=>ids.has(p.id));
}
export function historicalPeople(w: Workspace, actor: Person, dates: string[], branch = 'all'): Person[] {
  const map = new Map<string,Person>();
  for (const d of dates) for (const p of historicalScope(w,actor,d,branch)) map.set(p.id,p);
  return [...map.values()];
}
export function historicalSeries(w: Workspace, actor: Person, dates: string[], branch = 'all') {
  return dates.map(date => ({date,...rosterStats(historicalScope(w,actor,date,branch),w.attendance[date])}));
}
export function historicalBranch(w: Workspace, p: Person, date: string) {
  return branchOf(indexOrg(rosterAt(w,date)),p);
}
