export type ClientStripeMode = 'TEST' | 'LIVE';

const placeholderPattern = /(dummy|example|placeholder|replace|your[_-]?key)/i;

export function validatedStripePublishableKey(
  mode: string | undefined,
  publishableKey: string | undefined,
): string | null {
  if (mode !== 'TEST' && mode !== 'LIVE') return null;
  if (!publishableKey || publishableKey !== publishableKey.trim() || /\s/.test(publishableKey)) return null;
  if (placeholderPattern.test(publishableKey)) return null;

  const expectedPrefix = mode === 'LIVE' ? 'pk_live_' : 'pk_test_';
  const unexpectedPrefix = mode === 'LIVE' ? 'pk_test_' : 'pk_live_';
  if (publishableKey.startsWith(unexpectedPrefix)) return null;
  if (!publishableKey.startsWith(expectedPrefix)) return null;

  const credentialBody = publishableKey.slice(expectedPrefix.length);
  return /^[A-Za-z0-9]{8,}$/.test(credentialBody) ? publishableKey : null;
}
