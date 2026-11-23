import { describe, expect, it } from 'vitest';
import { acceptReceipt, codeUrl, createInvite, createPass, decodeCode, encodeCode, inviteCode, inviteState, joinFromInvite, receiptFor, verifyPass, type InviteCode } from '../src/core/codes';
import { createWorkspace, newPerson } from '../src/core/model';

function leaderSetup() {
  const ws = createWorkspace({ name: 'Northwind Ops', preset: 'business', ownerName: 'Lea Lead', ownerLevel: 1, ownerBranch: 'Orion' });
  const invite = createInvite({ parentId: ws.ownerId, level: 0, createdBy: ws.ownerId, hours: 24, maxUses: 2 });
  ws.invites.push(invite);
  return { ws, invite };
}

describe('code encoding', () => {
  it('round-trips through raw text and app URLs', () => {
    const { ws, invite } = leaderSetup();
    const code = encodeCode(inviteCode(ws, invite));
    expect(code.startsWith('QS1.')).toBe(true);
    const url = codeUrl('https://example.test/app/', code);
    const decoded = decodeCode(url) as InviteCode;
    expect(decoded.k).toBe('inv');
    expect(decoded.p.n).toBe('Lea Lead');
    expect(decoded.c.n).toBe('Northwind Ops');
    expect(code.length).toBeLessThan(700);
  });
  it('sends only non-default workspace terms, and they survive the round trip', () => {
    const { ws, invite } = leaderSetup();
    const plain = inviteCode(ws, invite);
    expect(Object.keys(plain.c)).toEqual(['n', 'p']);
    ws.config = { ...ws.config, groupLabel: 'Pod', titles: ['Agent', 'Pod Lead', 'Manager', 'Director'], days: [1, 2, 3, 4, 5, 6], shiftEnd: '17:30' };
    const custom = decodeCode(encodeCode(inviteCode(ws, invite))) as InviteCode;
    const { ws: joined } = joinFromInvite(custom, { name: 'Kim Lee' });
    expect(joined.config).toMatchObject({ groupLabel: 'Pod', titles: ['Agent', 'Pod Lead', 'Manager', 'Director'], days: [1, 2, 3, 4, 5, 6], shiftEnd: '17:30', shiftStart: '09:00', name: 'Northwind Ops' });
  });
  it('rejects tampering, junk and malformed payloads', () => {
    const { ws, invite } = leaderSetup();
    const code = encodeCode(inviteCode(ws, invite));
    const tampered = code.replace(/\.(.)/, (_m, c: string) => `.${c === 'A' ? 'B' : 'A'}`);
    expect(() => decodeCode(tampered)).toThrow(/damaged/);
    expect(() => decodeCode('https://example.com')).toThrow(/not a QSwipe code/);
    const bad = encodeCode({ ...inviteCode(ws, invite), l: 2 } as InviteCode);
    expect(() => decodeCode(bad)).toThrow(/not valid/);
  });
});

describe('join handshake', () => {
  it('member joins from an invite, leader accepts the confirmation', () => {
    const { ws, invite } = leaderSetup();
    const inv = decodeCode(encodeCode(inviteCode(ws, invite))) as InviteCode;
    const { ws: memberWs, receipt } = joinFromInvite(inv, { name: '  Sam Rivera ', position: 'Agent' });
    expect(memberWs.id).toBe(ws.id);
    expect(memberWs.people).toHaveLength(2);
    const me = memberWs.people.find(p => p.id === memberWs.meId)!;
    expect(me.name).toBe('Sam Rivera');
    expect(me.parentId).toBe(ws.ownerId);
    expect(memberWs.config.groupLabel).toBe('Team');

    const r = decodeCode(encodeCode(receipt));
    if (r.k !== 'rcp') throw new Error('expected receipt');
    const { person } = acceptReceipt(ws, r);
    expect(person.id).toBe(me.id);
    expect(person.parentId).toBe(ws.ownerId);
    expect(person.passKey).toBe(me.passKey);
    ws.people.push(person);
    invite.uses++;
    expect(() => acceptReceipt(ws, r)).toThrow(/already on the roster/);
    expect(receiptFor(memberWs, me).m.id).toBe(me.id);
  });
  it('enforces expiry, revocation, tokens and use limits', () => {
    const { ws, invite } = leaderSetup();
    const inv = inviteCode(ws, invite);
    expect(() => joinFromInvite(inv, { name: 'X' })).toThrow(/name/);
    expect(() => joinFromInvite(inv, { name: 'Late Person' }, invite.expiresAt + 1)).toThrow(/expired/);
    const { receipt } = joinFromInvite(inv, { name: 'Pat Doe' });
    expect(() => acceptReceipt(ws, { ...receipt, t: 'x'.repeat(22) })).toThrow(/No matching invite/);
    expect(() => acceptReceipt({ ...ws, id: 'otherWS123' }, receipt)).toThrow(/different workspace/);
    invite.revoked = true;
    expect(() => acceptReceipt(ws, receipt)).toThrow(/revoked/);
    invite.revoked = false;
    invite.uses = invite.maxUses;
    expect(inviteState(invite)).toBe('used');
    expect(() => acceptReceipt(ws, receipt)).toThrow(/no uses left/);
    expect(inviteState({ ...invite, uses: 0 }, invite.expiresAt + 1)).toBe('expired');
  });
});

describe('check-in passes', () => {
  it('verifies signed passes for today only and rejects forgeries', async () => {
    const { ws, invite } = leaderSetup();
    const { ws: memberWs, receipt } = joinFromInvite(inviteCode(ws, invite), { name: 'Jo Park' });
    ws.people.push(acceptReceipt(ws, receipt).person);
    const me = memberWs.people.find(p => p.id === memberWs.meId)!;
    const pass = await createPass(memberWs.id, me, '2026-11-23');
    const decoded = decodeCode(encodeCode(pass));
    if (decoded.k !== 'pass') throw new Error('expected pass');
    expect((await verifyPass(ws, decoded, '2026-11-23')).id).toBe(me.id);
    await expect(verifyPass(ws, decoded, '2026-11-24')).rejects.toThrow(/earlier day/);
    await expect(verifyPass(ws, { ...decoded, s: decoded.s.replace(/^./, c => (c === 'a' ? 'b' : 'a')) }, '2026-11-23')).rejects.toThrow(/signature/);
    const manual = newPerson({ name: 'No Key', level: 0, parentId: ws.ownerId });
    ws.people.push(manual);
    await expect(verifyPass(ws, { ...decoded, m: manual.id }, '2026-11-23')).rejects.toThrow(/no pass key/);
  });
});
