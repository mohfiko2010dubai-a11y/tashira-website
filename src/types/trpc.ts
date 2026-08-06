import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '../../api/router';

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type ApplicationListItem = RouterOutputs['application']['list'][number];
export type ApplicationWithLegacyAmount = ApplicationListItem & {
  totalAmount?: string | null;
};
