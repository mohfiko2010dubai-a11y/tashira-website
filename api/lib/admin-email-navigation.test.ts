import { expect, it } from 'vitest';
import { adminLoginDestination } from '../../contracts/admin-login-destination';

it.each(['/admin/approvals', '/admin/approvals#refund-case-00000000-0000-4000-8000-000000000042', '/admin/approvals#refund-failures', '/admin/company-settings', '/admin/applications/TSH-SYNTHETIC'])('preserves the internal email destination after MFA: %s', returnTo => {
  expect(adminLoginDestination('admin', { returnTo })).toBe(returnTo);
});
it.each(['https://evil.example', '//evil.example', '/admin/approvals?next=https://evil.example', '/admin/approvals/../../elsewhere', '/admin/approvals#unknown', null])('rejects an unapproved redirect: %s', returnTo => {
  expect(adminLoginDestination('admin', { returnTo })).toBe('/admin/applications');
});
it('does not send a staff account into an administrator destination', () => {
  expect(adminLoginDestination('staff', { returnTo: '/admin/approvals' })).toBe('/staff/dashboard');
});
it('lands agents on applications without requiring manager analytics access', () => {
  expect(adminLoginDestination('staff', null)).toBe('/staff/dashboard');
});
