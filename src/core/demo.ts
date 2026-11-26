/**
 * Trial mode: builds a fictional workspace so people can explore QSwipe without entering real data.
 * This is the only place sample people and records exist; it runs only when someone taps "Try the demo",
 * and the result lives in session storage, separate from real data.
 */
import { createInvite } from './codes';
import { emptyAppData } from './data';
import { createWorkspace, isoDate, newPerson, sessionDates, upcomingSessions } from './model';
import type { AppData } from './types';

export function createDemoData(today = isoDate()): AppData {
  const ws = createWorkspace({ name: 'Demo team', preset: 'business', ownerName: 'Alex Demo', ownerLevel: 2, ownerBranch: 'Support' });
  const owner = ws.people[0]!;
  const lead = newPerson({ name: 'Jordan Lee', level: 1, parentId: owner.id, branch: 'Orion' });
  const lead2 = newPerson({ name: 'Sam Patel', level: 1, parentId: owner.id, branch: 'Nova' });
  ws.people.push(lead, lead2);
  const names = ['Ava Lim', 'Ben Cruz', 'Cara Diaz', 'Dev Rao', 'Mia Chen', 'Noah Reyes'];
  names.forEach((name, i) => ws.people.push(newPerson({ name, level: 0, parentId: i < 3 ? lead.id : lead2.id, position: 'Support agent' })));
  const days = sessionDates(today, 10, [1, 2, 3, 4, 5]);
  ws.createdAt = new Date(`${days[0]}T08:00:00`).getTime();
  days.forEach((d, k) => {
    ws.attendance[d] = {};
    ws.people.forEach((p, i) => {
      if (d === today && i % 3 === 0) return; // leave a few unmarked today so the swipe queue has work
      ws.attendance[d]![p.id] = { s: (i + k) % 6 ? 'present' : 'absent', at: Date.now(), by: owner.id };
    });
  });
  const next = upcomingSessions(today, 1, [1, 2, 3, 4, 5])[0]!;
  ws.commitments[next] = {
    [lead.id]: { c: 'confirmed', at: Date.now() },
    [ws.people[3]!.id]: { c: 'risk', at: Date.now(), note: 'Dentist until 10:30' },
    [ws.people[5]!.id]: { c: 'confirmed', at: Date.now() },
  };
  ws.announcements.push(
    { id: 'demo1', authorId: owner.id, scopeId: 'all', text: 'Welcome to the demo! Everything here is sample data — explore freely.', priority: 'important', at: Date.now() - 3_600_000 },
    { id: 'demo2', authorId: lead.id, scopeId: lead.id, text: 'Stand-up at 9:05 in the small room.', priority: 'normal', at: Date.now() - 600_000 },
  );
  ws.trivia.push({ id: 'demoq1', category: 'Team', question: 'Which team handles escalations?', options: ['Orion', 'Nova', 'Support', 'Everyone'], answer: 1 });
  ws.invites.push(createInvite({ parentId: lead.id, level: 0, createdBy: owner.id }));
  ws.gameEntries = ws.people.map(p => p.name.split(' ')[0]).join('\n');
  return { ...emptyAppData(), activeId: ws.id, workspaces: { [ws.id]: ws } };
}
