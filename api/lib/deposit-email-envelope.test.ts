import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openDepositEmail, sealDepositEmail } from './deposit-email-envelope';

beforeEach(() => vi.stubEnv('ADMIN_SESSION_SECRET', 'synthetic-key-for-deposit-envelope-tests-12345'));
afterEach(() => vi.unstubAllEnvs());
const payload = { recipient: 'synthetic@example.invalid', variables: { depositUrl: 'synthetic-private-token' }, deliveryFingerprint: 'synthetic' };
it('encrypts sensitive retry data and authenticates its request identity', () => {
  const encrypted = sealDepositEmail('request-1', payload);
  expect(encrypted).not.toContain(payload.recipient);
  expect(encrypted).not.toContain('synthetic-private-token');
  expect(openDepositEmail('request-1', encrypted)).toEqual(payload);
  expect(() => openDepositEmail('request-2', encrypted)).toThrow();
  const parts = encrypted.split('.'); parts[2] = Buffer.from('tampered').toString('base64url');
  expect(() => openDepositEmail('request-1', parts.join('.'))).toThrow();
});
it('fails closed on missing or changed server encryption secret', () => {
  const encrypted = sealDepositEmail('request-1', payload);
  vi.stubEnv('ADMIN_SESSION_SECRET', 'another-synthetic-server-key-1234567890');
  expect(() => openDepositEmail('request-1', encrypted)).toThrow();
  vi.stubEnv('ADMIN_SESSION_SECRET', '');
  expect(() => sealDepositEmail('request-1', payload)).toThrow('not configured');
});
