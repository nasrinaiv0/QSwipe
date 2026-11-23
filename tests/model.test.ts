import { describe, expect, it } from 'vitest';
import {
  addDays, ancestors, attendanceRate, audienceOptions, branchOf, canAccess, canManagePerson, commitmentStats, coverageTarget, createWorkspace,
  dailySeries, defaultPolicy, descendants, FEATURES, indexOrg, isAnnouncementVisible, isDescendant, isIsoDate, markDecision, newPerson,
  pendingPeople, personSummary, placementError, removeFromOrg, requiredLevel, rosterStats, sanitizeAnnouncementText, sanitizeConfig, sanitizePolicy,
  sessionDates, shiftLabel, summarize, toCSV, upcomingSessions, validateCorrection, viewScope, configFromPreset, initialsOf,
} from '../src/core/model';
import type { Person, Workspace } from '../src/core/types';

/** Builds a small org entirely inside the test: director → manager → lead → 2 members, plus a second lead. */
function fixture() {
  const ws = createWorkspace({ name: 'Test Org', preset: 'business', ownerName: 'Owner Person', ownerLevel: 3 });
  const owner = ws.people[0]!;
  const manager = newPerson({ name: 'Manager One', level: 2, parentId: owner.id, branch: 'Ops' });
  const lead = newPerson({ name: 'Lead One', level: 1, parentId: manager.id, branch: 'Alpha' });
  const lead2 = newPerson({ name: 'Lead Two', level: 1, parentId: manager.id, branch: 'Beta' });
  const m1 = newPerson({ name: 'Member One', level: 0, parentId: lead.id });
  const m2 = newPerson({ name: 'Member Two', level: 0, parentId: lead.id });
  const m3 = newPerson({ name: 'Member Three', level: 0, parentId: lead2.id });
  ws.people.push(manager, lead, lead2, m1, m2, m3);
  return { ws, org: indexOrg(ws.people), owner, manager, lead, lead2, m1, m2, m3 };
}

describe('workspace factory', () => {
  it('creates a workspace containing only its owner — no sample data', () => {
    const ws = createWorkspace({ name: '  Acme  ', preset: 'education', ownerName: 'Ada Lovelace', ownerLevel: 2, ownerBranch: 'Science' });
    expect(ws.people).toHaveLength(1);
    expect(ws.config.name).toBe('Acme');
    expect(ws.config.titles[0]).toBe('Student');
    expect(ws.ownerId).toBe(ws.meId);
    expect(ws.people[0]!.branch).toBe('Science');
    expect(ws.announcements).toEqual([]);
    expect(ws.attendance).toEqual({});
    expect(ws.trivia).toEqual([]);
  });
  it('initials and config sanitising', () => {
    expect(initialsOf('ada king lovelace')).toBe('AL');
    expect(initialsOf('  ')).toBe('?');
    const c = sanitizeConfig({ name: ' X ', shiftStart: '25:00', days: [5, 1, 1, 9], targetPct: 49, titles: ['a', '', 'c'] }, configFromPreset('custom', 'Fallback'));
    expect(c.name).toBe('Fallback');
    expect(c.shiftStart).toBe('09:00');
    expect(c.days).toEqual([1, 5]);
    expect(c.targetPct).toBe(80);
    expect(c.titles).toEqual(['Member', 'Lead', 'Manager', 'Head']);
    expect(shiftLabel({ shiftStart: '22:00', shiftEnd: '06:00' })).toBe('22:00–06:00 (+1)');
  });
});

describe('hierarchy', () => {
  it('walks descendants and ancestors', () => {
    const { org, owner, manager, lead, m1, m3 } = fixture();
    expect(descendants(org, owner.id)).toHaveLength(6);
    expect(descendants(org, lead.id).map(p => p.name)).toEqual(['Member One', 'Member Two']);
    expect(ancestors(org, m1.id).map(p => p.id)).toEqual([lead.id, manager.id, owner.id]);
    expect(isDescendant(org, lead.id, m3.id)).toBe(false);
    expect(branchOf(org, m1)).toBe('Alpha');
    expect(branchOf(org, lead)).toBe('Alpha');
  });
  it('validates placement: level order, cycles and existing reports', () => {
    const { org, manager, lead, m1 } = fixture();
    expect(placementError(org, { level: 0, parentId: lead.id })).toBeNull();
    expect(placementError(org, { level: 1, parentId: lead.id })).toMatch(/higher level/);
    expect(placementError(org, { id: manager.id, level: 2, parentId: m1.id })).toMatch(/higher level/);
    expect(placementError(org, { id: lead.id, level: 0, parentId: manager.id })).toMatch(/direct reports/);
    expect(placementError(org, { level: 0, parentId: 'missing' })).toMatch(/no longer exists/);
  });
  it('removing a person moves their reports up', () => {
    const { ws, lead, manager } = fixture();
    const people = removeFromOrg(ws.people, lead.id);
    expect(people.find(p => p.id === lead.id)).toBeUndefined();
    expect(people.filter(p => p.parentId === manager.id)).toHaveLength(3);
  });
});

describe('access policy', () => {
  it('applies per-level defaults and an all-powerful owner', () => {
    const { ws, owner, lead, m1, manager } = fixture();
    expect(canAccess(ws, lead, 'attendance.verify')).toBe(true);
    expect(canAccess(ws, m1, 'attendance.verify')).toBe(false);
    expect(canAccess(ws, lead, 'reports.export')).toBe(false);
    expect(canAccess(ws, manager, 'reports.export')).toBe(true);
    expect(canAccess(ws, manager, 'settings.access')).toBe(false);
    expect(canAccess(ws, owner, 'settings.access')).toBe(true);
    expect(canAccess(ws, owner, 'nope')).toBe(false);
    expect(canAccess(ws, undefined, 'reports.view')).toBe(false);
  });
  it('sanitises policies and keeps owner-only features locked', () => {
    const p = sanitizePolicy({ 'reports.export': 1, 'reports.view': 7, 'settings.access': 0, bogus: 1 });
    expect(p['reports.export']).toBe(1);
    expect(p['reports.view']).toBe(1);
    expect(requiredLevel(p, 'settings.access')).toBe(Infinity);
    expect(Object.keys(defaultPolicy())).toHaveLength(FEATURES.length);
  });
  it('view scope widens only with the workspace permission; management stays in-branch', () => {
    const { ws, org, manager, lead, m1, m3, owner } = fixture();
    expect(viewScope(ws, org, manager)).toHaveLength(5);
    expect(viewScope({ ...ws, policy: { ...ws.policy, 'scope.workspace': 2 } }, org, manager)).toHaveLength(6);
    expect(canManagePerson(ws, org, lead, m1.id)).toBe(true);
    expect(canManagePerson(ws, org, lead, m3.id)).toBe(false);
    expect(canManagePerson(ws, org, m1, m1.id)).toBe(false);
    expect(canManagePerson(ws, org, owner, owner.id)).toBe(false);
    expect(canManagePerson(ws, org, owner, m3.id)).toBe(true);
  });
});

describe('attendance', () => {
  const today = '2026-11-23';
  it('never treats missing check-ins as absent', () => {
    const { ws, m1, m2, m3 } = fixture();
    const people = [m1, m2, m3];
    expect(rosterStats(people, { [m1.id]: { s: 'present' }, [m2.id]: 'absent', [m3.id]: { s: 'late' } })).toEqual({ scheduled: 3, present: 1, absent: 1, pending: 1 });
    expect(pendingPeople(people, { [m1.id]: 'present' })).toHaveLength(2);
    expect(ws.people).toHaveLength(7);
  });
  it('decides who may mark whom', () => {
    const { ws, org, lead, m1, m3 } = fixture();
    const base = { ws, org, date: today, today, records: {} };
    expect(markDecision({ ...base, actor: lead, subject: m1 }).reason).toBe('verify');
    expect(markDecision({ ...base, actor: lead, subject: m3 }).reason).toBe('scope');
    expect(markDecision({ ...base, actor: m1, subject: m1 }).reason).toBe('self');
    expect(markDecision({ ...base, actor: m1, subject: lead }).reason).toBe('permission');
    expect(markDecision({ ...base, actor: lead, subject: m1, records: { [m1.id]: 'present' } }).reason).toBe('resolved');
    expect(markDecision({ ...base, date: addDays(today, 1), actor: lead, subject: m1 }).reason).toBe('future');
  });
  it('requires a real reason for corrections', () => {
    expect(validateCorrection({ from: 'present', to: 'present', reason: 'typo fix' })).toMatch(/matches/);
    expect(validateCorrection({ from: 'present', to: 'absent', reason: 'no' })).toMatch(/reason/);
    expect(validateCorrection({ from: null, to: 'present', reason: 'Badge reader down' })).toBeNull();
  });
});

describe('dates and reports', () => {
  it('session dates respect weekdays and a lower bound', () => {
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(sessionDates('2026-11-23', 3, [1, 2, 3, 4, 5])).toEqual(['2026-11-19', '2026-11-20', '2026-11-23']);
    expect(sessionDates('2026-11-23', 10, [1, 2, 3, 4, 5], '2026-11-20')).toEqual(['2026-11-20', '2026-11-23']);
    expect(upcomingSessions('2026-11-20', 2, [1, 2, 3, 4, 5])).toEqual(['2026-11-23', '2026-11-24']);
    expect(sessionDates('2026-11-23', 3, [])).toEqual([]);
  });
  it('aggregates series, people and streaks', () => {
    const { m1, m2 } = fixture();
    const recs: Record<string, Record<string, string>> = { d1: { [m1.id]: 'absent', [m2.id]: 'present' }, d2: { [m1.id]: 'present' }, d3: { [m1.id]: 'present' }, d4: {} };
    const dates = ['d1', 'd2', 'd3', 'd4'];
    const total = summarize(dailySeries([m1, m2], d => recs[d], dates));
    expect(total).toMatchObject({ scheduled: 8, present: 3, absent: 1, pending: 4, rate: 75, completion: 50 });
    expect(personSummary(m1, d => recs[d], dates)).toEqual({ present: 2, absent: 1, pending: 1, rate: 67, streak: 2 });
    expect(attendanceRate({ present: 0, absent: 0 })).toBeNull();
  });
  it('CSV neutralises formulas', () => {
    expect(toCSV([['=HYPERLINK("x")', 'say "hi"', '-1']])).toBe('"\'=HYPERLINK(""x"")","say ""hi""","\'-1"');
  });
  it('commitments forecast counts confirmed only', () => {
    const { m1, m2, m3 } = fixture();
    expect(commitmentStats([m1, m2, m3], { [m1.id]: { c: 'confirmed' }, [m2.id]: 'risk' })).toEqual({ confirmed: 1, atRisk: 1, unavailable: 0, pending: 1 });
    expect(coverageTarget(5, 80)).toBe(4);
  });
});

describe('announcements', () => {
  it('audiences and visibility follow the hierarchy', () => {
    const { org, owner, manager, lead, m1, m3 } = fixture();
    expect(audienceOptions(org, lead, false)).toEqual([lead.id]);
    expect(audienceOptions(org, manager, false)).toEqual([manager.id, lead.id, expect.any(String)]);
    expect(audienceOptions(org, owner, true)[0]).toBe('all');
    expect(audienceOptions(org, m1, false)).toEqual([]);
    const post = { scopeId: lead.id, authorId: lead.id };
    expect(isAnnouncementVisible(org, m1.id, post)).toBe(true);
    expect(isAnnouncementVisible(org, manager.id, post)).toBe(true);
    expect(isAnnouncementVisible(org, m3.id, post)).toBe(false);
    expect(sanitizeAnnouncementText('  hi\r\n\r\n\r\n\r\nthere ')).toBe('hi\n\nthere');
  });
});

// Type-only guard so the fixture stays in sync with the model.
const _check: (p: Person, w: Workspace) => void = () => {};
void _check;
