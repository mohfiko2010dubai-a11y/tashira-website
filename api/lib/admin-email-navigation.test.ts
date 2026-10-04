import { expect, it } from 'vitest';
import { adminLoginDestination } from '../../contracts/admin-login-destination';

it.each(['/admin/approvals', '/admin/approvals#refund-case-42', '/admin/approvals#refund-failures', '/admin/company-settings', '/admin/applications/TSH-SYNTHETIC'])('preserves the internal email destination after MFA: %s', returnTo => {
  expect(adminLoginDestination('admin', { returnTo })).toBe(returnTo);
});
it.each(['https://evil.example', '//evil.example', '/admin/approvals?next=https://evil.example', '/admin/approvals/../../elsewhere', '/admin/approvals#unknown', null])('rejects an unapproved redirect: %s', returnTo => {
  expect(adminLoginDestination('admin', { returnTo })).toBe('/admin/applications');
});
it('does not send a staff account into an administrator destination', () => {
  expect(adminLoginDestination('staff', { returnTo: '/admin/approvals' })).toBe('/staff/operations/dashboard');
});
