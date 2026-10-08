import { z } from 'zod';
import { adminQuery, createRouter, staffOrAdminQuery } from './middleware';
import { MysqlOperationsAccessProvider } from './lib/operations/mysql-access-provider';
import { MysqlControlledWriteExecutor } from './lib/operations/mysql-controlled-write-executor';
import { defaultOperationsPool, defaultOperationsSqlClient } from './lib/operations/mysql-query-client';
import { MysqlWorkQueue, workCommand } from './lib/operations/mysql-work-queue';

let queue: MysqlWorkQueue | undefined;
function service() {
  if (!queue) {
    const access = new MysqlOperationsAccessProvider(defaultOperationsSqlClient());
    queue = new MysqlWorkQueue(defaultOperationsPool(), access, new MysqlControlledWriteExecutor(defaultOperationsPool(), access));
  }
  return queue;
}
export const operationsWorkRouter = createRouter({
  managerReport: adminQuery.query(({ ctx }) => service().managerReport(ctx)),
  overview: staffOrAdminQuery.input(z.object({ includeTest: z.boolean() }).strict()).query(({ ctx, input }) => service().overview(ctx, input.includeTest)),
  command: staffOrAdminQuery.input(workCommand).mutation(({ ctx, input }) => service().command(ctx, input)),
});
