import { publicAppOrigin } from './public-app-url';

// Classify by template, never by caller-provided recipient flags.
export const ADMIN_EMAIL_PATHS = {
  APPROVAL_PENDING: '/admin/approvals',
  GUARANTEE_BREACHED: '/admin/approvals#processing-guarantee',
  CONNECTION_BROKEN: '/admin/approvals#refund-failures',
  SUPPLIER_OVERRIDE: '/admin/suppliers',
  LICENCE_EXPIRY: '/admin/company-settings',
} as const;

export function isAdminEmail(template: string): template is keyof typeof ADMIN_EMAIL_PATHS {
  return Object.hasOwn(ADMIN_EMAIL_PATHS, template);
}

export function adminEmailActionUrl(template: string, variables: Record<string, string> = {}): string {
  if (!isAdminEmail(template)) throw new Error('Not an administrator email template');
  if (['APPROVAL_PENDING', 'GUARANTEE_BREACHED', 'CONNECTION_BROKEN'].includes(template) && /^\d+$/.test(variables.refundCaseId || '')) {
    return `${publicAppOrigin()}/admin/approvals#refund-case-${variables.refundCaseId}`;
  }
  if (template === 'SUPPLIER_OVERRIDE' && variables.referenceNumber) {
    return `${publicAppOrigin()}/admin/applications/${encodeURIComponent(variables.referenceNumber)}`;
  }
  return publicAppOrigin() + ADMIN_EMAIL_PATHS[template];
}
