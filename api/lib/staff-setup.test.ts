import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
const mocks = vi.hoisted(() => ({ execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(), hash: vi.fn() }));
vi.mock('./operations/mysql-query-client', () => ({ defaultOperationsPool: () => ({ getConnection: async () => mocks }) }));
vi.mock('./password', () => ({ hashPassword: mocks.hash }));
import { completeStaffSetup, staffSetupTokenHash, STAFF_SETUP_REQUIRED } from './staff-setup';
const token = randomBytes(32).toString('hex');
// Generated only in unit-test memory, never an account password or seed credential.
const unitInput = 'Test-only-A1-' + randomBytes(16).toString('hex');
beforeEach(() => { vi.resetAllMocks(); mocks.hash.mockResolvedValue('synthetic-hash'); });
describe('one-time owner password setup', () => {
  it('stores only a token hash and a password hash, consuming all outstanding setup links atomically', async () => {
    mocks.execute.mockResolvedValueOnce([[{ staff_id: 7 }]])
      .mockResolvedValueOnce([[{ username: 'synthetic-owner', password_hash: STAFF_SETUP_REQUIRED, is_active: 'inactive' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]).mockResolvedValueOnce([{}]);
    await expect(completeStaffSetup(token, unitInput)).resolves.toEqual({ username: 'synthetic-owner' });
    expect(mocks.execute).toHaveBeenNthCalledWith(1, expect.stringContaining('FOR UPDATE'), [staffSetupTokenHash(token)]);
    expect(mocks.execute).toHaveBeenNthCalledWith(3, expect.stringContaining("is_active='active'"), ['synthetic-hash', 7, STAFF_SETUP_REQUIRED]);
    expect(JSON.stringify(mocks.execute.mock.calls)).not.toContain(token);
    expect(JSON.stringify(mocks.execute.mock.calls)).not.toContain(unitInput);
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });
  it('rejects expired, consumed or unknown links without changing an account', async () => {
    mocks.execute.mockResolvedValueOnce([[]]);
    await expect(completeStaffSetup(token, unitInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.hash).not.toHaveBeenCalled(); expect(mocks.rollback).toHaveBeenCalled();
  });
  it.each([
    { password_hash: 'existing-hash', is_active: 'inactive' },
    { password_hash: STAFF_SETUP_REQUIRED, is_active: 'active' },
  ])('cannot reset an established or deactivated existing account through an invitation: %j', async state => {
    mocks.execute.mockResolvedValueOnce([[{ staff_id: 7 }]]).mockResolvedValueOnce([[state]]);
    await expect(completeStaffSetup(token, unitInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.hash).not.toHaveBeenCalled(); expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('rejects a malformed capability before opening a transaction', async () => {
    await expect(completeStaffSetup('bad', unitInput)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(mocks.beginTransaction).not.toHaveBeenCalled();
  });
});
