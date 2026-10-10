import { z } from "zod";
import { adminQuery, staffOrAdminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { suppliers } from "@db/schema";
import { eq } from "drizzle-orm";
import { supplierRateInput } from '../contracts/supplier-rates';
import { listSupplierRates, saveSupplierRate } from './lib/supplier-rates';

import { SUPPLIER_STAGES } from '../contracts/supplier-operations';
import { listSupplierOperations } from './lib/supplier-operations';
import { MysqlOperationsAccessProvider } from './lib/operations/mysql-access-provider';
import { defaultOperationsSqlClient } from './lib/operations/mysql-query-client';

export const supplierRouter = createRouter({
  operations: staffOrAdminQuery.input(z.object({ search: z.string().trim().max(100).default(''), stage: z.enum(SUPPLIER_STAGES).optional(), includeTest: z.boolean().default(false), offset: z.number().int().min(0).default(0), limit: z.number().int().min(1).max(100).default(30) }).strict()).query(async ({ input, ctx }) => listSupplierOperations(input, await new MysqlOperationsAccessProvider(defaultOperationsSqlClient()).actorForContext(ctx), Boolean(ctx.isAdmin || ctx.user?.role === 'admin'))),
  rates: adminQuery.input(z.object({ supplierId: z.number().int().positive() }).strict()).query(({ input }) => listSupplierRates(input.supplierId)),
  saveRate: adminQuery.input(supplierRateInput).mutation(({ input, ctx }) => saveSupplierRate(input,
    ctx.staffId ? `staff:${ctx.staffId}` : ctx.user?.id ? `user:${ctx.user.id}` : 'admin-session')),
  list: adminQuery.query(async () => {
    const db = getDb();
    return db.select().from(suppliers).orderBy(suppliers.name);
  }),

  get: adminQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [s] = await db.select().from(suppliers).where(eq(suppliers.id, input.id)).limit(1);
      return s || null;
    }),

  create: adminQuery
    .input(z.object({
      name: z.string().min(1),
      contactPerson: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [result] = await db.insert(suppliers).values({
        name: input.name,
        contactPerson: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null,
      });
      return { id: Number(result.insertId), success: true };
    }),

  update: adminQuery
    .input(z.object({
      id: z.number(),
      name: z.string().min(1),
      contactPerson: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.enum(["active", "inactive"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const update: Partial<typeof suppliers.$inferInsert> = {
        name: input.name,
        contactPerson: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null,
      };
      if (input.isActive) update.isActive = input.isActive;
      await db.update(suppliers).set(update).where(eq(suppliers.id, input.id));
      return { success: true };
    }),

  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(suppliers).where(eq(suppliers.id, input.id));
      return { success: true };
    }),
});
