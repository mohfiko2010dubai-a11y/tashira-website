import { expect, it, vi } from 'vitest';
import type { PoolConnection } from 'mysql2/promise';
import { captureSupplierCost, supplierTotals } from './supplier-cost-snapshot';
import { redactStaffFinancials } from './staff-financial-redaction';

it('computes family totals in fils and refuses missing travellers or overflow', () => {
  expect(supplierTotals('100.10', '5.01', 3)).toEqual({ cost: '300.30', vat: '15.03', total: '315.33' });
  expect(() => supplierTotals('100', '5', 0)).toThrow();
  expect(() => supplierTotals('999999', '999999', 1000)).toThrow();
});
it('does not invent a price or reuse a disabled latest rate', async () => {
  const execute = vi.fn().mockResolvedValueOnce([[{ active: 0, cost_aed: '100', vat_amount_aed: '0' }]]).mockResolvedValue([[]]);
  const connection = { execute } as unknown as PoolConnection;
  expect(await captureSupplierCost(connection, 4, 5, 'synthetic', 'regular', 1)).toBe('MISSING_RATE');
  expect(execute.mock.calls[1][0]).toContain('supplier_cost_aed=NULL');
  expect(execute.mock.calls[1][1]).toEqual([5, 4]);
});
it('operational readiness survives employee financial redaction, while actual costs do not', () => {
  expect(redactStaffFinancials({ saved: true, pricingReadiness: 'READY', supplierCostAed: '100.00', supplierTotalAed: '105.00' })).toEqual({ saved: true, pricingReadiness: 'READY' });
});
