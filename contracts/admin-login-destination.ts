/** Preserve an internal email destination through sign-in, never an external redirect. */
export function adminLoginDestination(role: string, state: unknown): string {
  if (role !== 'admin') return '/staff/dashboard';
  const fallback = '/admin/applications';
  if (!state || typeof state !== 'object' || !('returnTo' in state) || typeof state.returnTo !== 'string') return fallback;
  const path = state.returnTo;
  return /^\/admin\/(?:approvals(?:#(?:refund-case-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|refund-failures|processing-guarantee))?|company-settings|applications\/[A-Za-z0-9_-]+)$/.test(path) ? path : fallback;
}
