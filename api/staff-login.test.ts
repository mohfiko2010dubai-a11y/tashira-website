import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rows: vi.fn(), password: vi.fn(), upgrade: vi.fn(), update: vi.fn(), audit: vi.fn(), verified: vi.fn() }));
vi.mock('./queries/connection', () => ({ getDb: () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: mocks.rows }) }) }),
  update: () => ({ set: () => ({ where: mocks.update }) }),
}) }));
vi.mock('./lib/password', () => ({ verifyPassword: mocks.password, hashPassword: mocks.upgrade }));
vi.mock('./lib/audit-log', () => ({ auditLog: mocks.audit }));
vi.mock('./lib/staff-auth-transition', () => ({ recordNamedAdminVerification: mocks.verified }));
import { staffRouter } from './staff-router';
import { getStaffSession, revokeStaffSessions } from './lib/staff-session';
import { resetRateLimitsForTests } from './lib/rate-limit';
const staff = { id: 123, username: 'synthetic-unit', name: 'Unit Account', email: 'unit@example.invalid', phone: null, role: 'staff', isActive: 'active', passwordHash: 'unit-hash', mfaSecret: null };
function context() { return { req: new Request('https://staging.tashiraev.com/api/trpc/staff.login', { headers: { host: 'staging.tashiraev.com' } }), resHeaders: new Headers(), isAdmin: false, customerApplicationReferences: new Set<string>() }; }
beforeEach(() => { vi.resetAllMocks(); resetRateLimitsForTests(); revokeStaffSessions(staff.id); mocks.password.mockResolvedValue({ valid: true, needsUpgrade: false }); mocks.rows.mockResolvedValue([staff]); });
describe('owner-approved password-only named login', () => {
  it.each([null, 'existing-encrypted-secret'])('issues a named secure cookie without an MFA challenge, including previously enrolled accounts', async mfaSecret => {
    mocks.rows.mockResolvedValue([{ ...staff, mfaSecret }]);
    const ctx = context(); const result = await staffRouter.createCaller(ctx).login({ username: staff.username, password: 'unit-test-input' });
    expect(result.staff.id).toBe(staff.id); expect(result).not.toHaveProperty('challenge'); expect(result).not.toHaveProperty('setupSecret');
    const cookie = ctx.resHeaders.get('set-cookie')!;
    expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toContain('SameSite=Lax');
    const token = cookie.match(/tashira_staff_session=([^;]+)/)![1];
    expect(getStaffSession(token)).toEqual({ staffId: staff.id });
    expect(mocks.audit).toHaveBeenCalledWith('staff.login', 'success', 'staff:123');
  });
  it.each(['wrong-password', 'inactive', 'missing', 'changed-during-login'])('rejects %s without issuing a cookie', async mode => {
    if (mode === 'wrong-password') mocks.password.mockResolvedValue({ valid: false });
    if (mode === 'inactive') mocks.rows.mockResolvedValue([{ ...staff, isActive: 'inactive' }]);
    if (mode === 'missing') mocks.rows.mockResolvedValue([]);
    if (mode === 'changed-during-login') mocks.rows.mockResolvedValueOnce([staff]).mockResolvedValueOnce([]);
    const ctx = context(); await expect(staffRouter.createCaller(ctx).login({ username: staff.username, password: 'unit-test-input' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(ctx.resHeaders.has('set-cookie')).toBe(false);
  });
  it('retains the login attempt limit', async () => {
    mocks.rows.mockResolvedValue([]); const caller = staffRouter.createCaller(context());
    for (let i = 0; i < 10; i++) await expect(caller.login({ username: staff.username, password: 'bad' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller.login({ username: staff.username, password: 'bad' })).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });
    expect(mocks.rows).toHaveBeenCalledTimes(10);
  });
});
