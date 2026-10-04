import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('./operations/mysql-query-client', () => ({ defaultOperationsPool: () => mocks }));
import { legacyAdminLoginEnabled, recordNamedAdminVerification } from './staff-auth-transition';
beforeEach(() => vi.resetAllMocks());
it.each([{ rows: [] }, { rows: [{ legacy_enabled: 0 }] }])('keeps shared access disabled unless explicitly enabled: %j', async ({ rows }) => {
  mocks.execute.mockResolvedValue([rows]); expect(await legacyAdminLoginEnabled()).toBe(false);
});
it('honours only the explicit migration record while existing access must be retained', async () => {
  mocks.execute.mockResolvedValue([[{ legacy_enabled: 1 }]]); expect(await legacyAdminLoginEnabled()).toBe(true);
});
it('does not let an agent complete the administrator cutover prerequisite', async () => {
  await recordNamedAdminVerification(12, 'staff'); expect(mocks.execute).not.toHaveBeenCalled();
});
it('records named administrator MFA proof only for the nominated owner without disabling access automatically', async () => {
  await recordNamedAdminVerification(13, 'admin');
  expect(mocks.execute).toHaveBeenCalledWith(expect.stringContaining('owner_staff_id=?'), [13]);
  expect(mocks.execute.mock.calls[0][0]).not.toContain('legacy_enabled=');
});
