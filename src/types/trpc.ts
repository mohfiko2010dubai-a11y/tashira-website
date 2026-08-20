import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../api/router';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type ApplicationListItem = RouterOutputs['application']['list'][number];
export type DocumentListItem = RouterOutputs['document']['listByApplication'][number];
export type StaffListItem = RouterOutputs['staff']['list'][number];
export type SupplierListItem = RouterOutputs['supplier']['list'][number];
export type ApplicationWithLegacyAmount = ApplicationListItem & {
  totalAmount?: string | null;
  supplierName?: string | null;
};
