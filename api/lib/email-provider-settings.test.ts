import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { transactionalEmailProvider } from './email-provider';

const request = vi.fn();
beforeEach(() => {
  vi.stubEnv('PUBLIC_APP_URL', 'https://staging.tashiraev.com');
  vi.stubEnv('EMAIL_MODE', 'resend');
  vi.stubEnv('APP_ID', 'tashira-staging');
  vi.stubEnv('FROM_EMAIL', 'admin@tashiraev.com');
  vi.stubEnv('RESEND_API_KEY', 're_' + randomBytes(16).toString('hex'));
  vi.stubEnv('STAGING_EMAIL_ALLOWED_RECIPIENTS', 'admin@tashiraev.com');
  vi.stubEnv('TRANSACTIONAL_EMAIL_SUBJECT_PREFIX', '[Template review] ');
  request.mockReset().mockResolvedValue(new Response(JSON.stringify({ id: 'synthetic-message' }), { status: 200 }));
  vi.stubGlobal('fetch', request);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const input = { recipient: 'admin@tashiraev.com', template: 'APPLICATION_RECEIVED' as const, variables: { referenceNumber: 'TSH-SYNTHETIC' } };
it('takes the staging prefix from transport settings and includes plain text', async () => {
  await transactionalEmailProvider().send(input);
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.subject).toBe('[Template review] Application received — TSH-SYNTHETIC');
  expect(body.text).toContain('We received application');
  expect(body.html).not.toContain('Template review');
});
it('cannot leak the staging prefix into an explicitly enabled production transport', async () => {
  vi.stubEnv('APP_ID', 'tashira-prod');
  vi.stubEnv('ENABLE_PRODUCTION_EMAIL', 'true');
  await transactionalEmailProvider().send(input);
  expect(JSON.parse(request.mock.calls[0][1].body).subject).toBe('Application received — TSH-SYNTHETIC');
});
it('retains staging recipient isolation', async () => {
  await expect(transactionalEmailProvider().send({ ...input, recipient: 'unapproved@example.invalid' })).rejects.toThrow('not approved');
  expect(request).not.toHaveBeenCalled();
});
it('allows only individually approved customer and company test recipients', async () => {
  vi.stubEnv('STAGING_EMAIL_ALLOWED_RECIPIENTS', 'admin@tashiraev.com, customer@example.invalid');
  await transactionalEmailProvider().send({ ...input, recipient: 'customer@example.invalid' });
  expect(JSON.parse(request.mock.calls[0][1].body).to).toEqual(['customer@example.invalid']);
  await expect(transactionalEmailProvider().send({ ...input, recipient: 'other@example.invalid' })).rejects.toThrow('not approved');
  expect(request).toHaveBeenCalledTimes(1);
});
it.each(['', '*', '*@example.invalid'])('rejects missing or wildcard staging recipients: %s', recipients => {
  vi.stubEnv('STAGING_EMAIL_ALLOWED_RECIPIENTS', recipients);
  expect(() => transactionalEmailProvider()).toThrow('explicit list');
  expect(request).not.toHaveBeenCalled();
});
it('can scope UAT to one order without replaying other customer jobs', async () => {
  vi.stubEnv('STAGING_EMAIL_ALLOWED_APPLICATION_REFERENCES', 'TSH-SYNTHETIC');
  await transactionalEmailProvider().send(input);
  await expect(transactionalEmailProvider().send({ ...input, variables: { referenceNumber: 'TSH-OLDER-ORDER' } })).rejects.toThrow('Application is not approved');
  expect(request).toHaveBeenCalledTimes(1);
});
