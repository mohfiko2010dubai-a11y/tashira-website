import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMfaChallenge, consumeMfaAttempt, revokeMfaChallenges, totpCode, verifyTotp } from './staff-mfa';
import { createStaffSession, getStaffSession, revokeStaffSessions, STAFF_IDLE_TIMEOUT_MS } from './staff-session';

afterEach(() => vi.useRealTimers());
describe('named staff authentication', () => {
  // RFC4226 reference secret "12345678901234567890" in base32.
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it('matches the published HOTP counter vectors', () => {
    expect([0,1,2,3].map(counter => totpCode(secret, counter))).toEqual(['755224','287082','359152','969429']);
  });
  it('rejects a used code, stale code and non-digits', () => {
    expect(verifyTotp(secret, totpCode(secret, 100), null, 3_000_000)).toBe(100);
    expect(verifyTotp(secret, totpCode(secret, 100), 100, 3_000_000)).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, 90), null, 3_000_000)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', null, 3_000_000)).toBeNull();
  });
  it('limits challenges to five attempts and revokes all on deactivation', () => {
    const token = createMfaChallenge({staffId: 901, secret, enrolling: true, passwordHash: 'synthetic'});
    for(let i=0;i<5;i++) expect(consumeMfaAttempt(token)).not.toBeNull();
    expect(consumeMfaAttempt(token)).toBeNull();
    const other = createMfaChallenge({staffId: 901, secret, enrolling: false, passwordHash: 'synthetic'});
    revokeMfaChallenges(901); expect(consumeMfaAttempt(other)).toBeNull();
  });
  it('expires challenges even without any failed attempts', () => {
    vi.useFakeTimers();
    const token = createMfaChallenge({staffId: 902, secret, enrolling: true, passwordHash: 'synthetic'});
    vi.advanceTimersByTime(5*60_000); expect(consumeMfaAttempt(token)).toBeNull();
  });
  it('expires idle sessions and preserves the absolute eight-hour ceiling', () => {
    vi.useFakeTimers();
    const idle = createStaffSession(903); vi.advanceTimersByTime(STAFF_IDLE_TIMEOUT_MS); expect(getStaffSession(idle)).toBeNull();
    const active = createStaffSession(903);
    for(let i=0;i<47;i++) { vi.advanceTimersByTime(10*60_000); expect(getStaffSession(active, true)).not.toBeNull(); }
    vi.advanceTimersByTime(10*60_000); expect(getStaffSession(active)).toBeNull();
  });
  it('background polling does not extend an idle session', () => {
    vi.useFakeTimers();
    const token = createStaffSession(906);
    for (let i = 0; i < 14; i++) { vi.advanceTimersByTime(60_000); expect(getStaffSession(token)).not.toBeNull(); }
    vi.advanceTimersByTime(60_000); expect(getStaffSession(token)).toBeNull();
  });
  it('revokes all sessions belonging to the deactivated person only', () => {
    const first = createStaffSession(904), second = createStaffSession(904), other = createStaffSession(905);
    revokeStaffSessions(904); expect(getStaffSession(first)).toBeNull(); expect(getStaffSession(second)).toBeNull(); expect(getStaffSession(other)).not.toBeNull(); revokeStaffSessions(905);
  });
});
