import { describe, expect, it, vi } from 'vitest';
import { wizardRouter } from './wizard-router';
import { getCanonicalApplicationByReference } from './lib/application-projection';
vi.mock('./lib/application-projection', () => ({ getCanonicalApplicationByReference: vi.fn() }));

describe('legacy wizard reference ownership', () => {
  const caller = (references: string[]) => wizardRouter.createCaller({
    req: new Request('https://staging.example/api/trpc'), resHeaders: new Headers(),
    isAdmin: false, customerApplicationReferences: new Set(references),
  });
  it('returns 401 for anonymous callers and 403 for a different owner without querying order details', async () => {
    await expect(caller([]).getByReference({ referenceNumber: 'TSH-OTHER' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller(['TSH-OWNED']).getByReference({ referenceNumber: 'TSH-OTHER' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(getCanonicalApplicationByReference).not.toHaveBeenCalled();
  });
});
