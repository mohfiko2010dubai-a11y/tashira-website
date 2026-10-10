import { expect, it, vi } from 'vitest';
import { aedAmount, aedMinorUnits, supplierRateInput } from '../../contracts/supplier-rates';
vi.mock('./operations/mysql-query-client', () => ({ defaultOperationsPool: vi.fn(() => { throw new Error('Must not access database'); }) }));
import { supplierRouter } from '../supplier-router';
const input = { supplierId: 1, serviceCode: '30days-single', processingType: 'regular' as const, expectedVersion: 0,
  costAed: '100.10', vatAmountAed: '5.01', vatStatus: 'standard' as const, placeOfSupply: 'within_uae' as const, active: true, reason: 'Approved supplier offer' };

it('uses exact minor-unit addition and requires explicit VAT classification', () => {
  expect(aedAmount(aedMinorUnits('100.10') + aedMinorUnits('5.01'))).toBe('105.11');
  expect(supplierRateInput.safeParse({ ...input, vatStatus: '' }).success).toBe(false);
  expect(supplierRateInput.safeParse({ ...input, vatStatus: 'exempt', vatAmountAed: '1' }).success).toBe(false);
  expect(supplierRateInput.safeParse({ ...input, vatStatus: 'exempt', vatAmountAed: '0' }).success).toBe(true);
});
it.each(['-1', '1.001', 'NaN', '1e3', '1000000'])('rejects malformed or oversized money %s', costAed => {
  expect(supplierRateInput.safeParse({ ...input, costAed }).success).toBe(false);
});
it('denies public and ordinary staff reads and writes of supplier prices', async () => {
  for (const staffId of [undefined, 4]) {
    const caller = supplierRouter.createCaller({ staffId, isAdmin: false, req: new Request('https://example.invalid'), resHeaders: new Headers(), customerApplicationReferences: new Set() });
    await expect(caller.rates({ supplierId: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller.saveRate(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  }
});
