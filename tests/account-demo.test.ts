import { describe, expect, it } from 'vitest';
import { createAccount, sanitizeAccount, verifyPassword } from '../src/core/account';
import { sanitizeAppData } from '../src/core/data';
import { createDemoData } from '../src/core/demo';

describe('local account', () => {
  it('hashes with a salt and verifies only the right password', async () => {
    const a = await createAccount('  Pat   Lee ', 'secret12', 100_000);
    expect(a.name).toBe('Pat Lee');
    expect(a.hash).not.toContain('secret');
    expect(await verifyPassword(a, 'secret12')).toBe(true);
    expect(await verifyPassword(a, 'secret13')).toBe(false);
    const b = await createAccount('Pat Lee', 'secret12', 100_000);
    expect(b.salt).not.toBe(a.salt);
    expect(b.hash).not.toBe(a.hash);
  });
  it('rejects weak input and invalid stored records', async () => {
    await expect(createAccount('P', 'secret12')).rejects.toThrow();
    await expect(createAccount('Pat', '123')).rejects.toThrow();
    const a = await createAccount('Pat Lee', 'secret12', 100_000);
    expect(sanitizeAccount(a)).toEqual(a);
    expect(sanitizeAccount({ ...a, iterations: 10 })).toBeUndefined();
    expect(sanitizeAccount({ ...a, hash: 'nope' })).toBeUndefined();
    expect(sanitizeAppData({ account: a }).account).toEqual(a);
    expect(sanitizeAppData({}).account).toBeUndefined();
  });
});

describe('demo data', () => {
  it('builds a complete fictional workspace that survives validation', () => {
    const d = createDemoData('2026-11-26');
    const ws = Object.values(d.workspaces)[0]!;
    expect(ws.people.length).toBe(9);
    expect(Object.keys(ws.attendance).length).toBeGreaterThan(5);
    expect(ws.announcements.length).toBe(2);
    const clean = sanitizeAppData(JSON.parse(JSON.stringify(d)));
    expect(Object.values(clean.workspaces)[0]!.people.length).toBe(9);
    expect(clean.account).toBeUndefined();
  });
});
