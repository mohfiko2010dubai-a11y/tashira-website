import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { suppliers } from "@db/schema";
import { eq } from "drizzle-orm";

export const supplierRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(suppliers).orderBy(suppliers.name);
  }),

  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [s] = await db.select().from(suppliers).where(eq(suppliers.id, input.id)).limit(1);
      return s || null;
    }),

  create: publicQuery
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

  update: publicQuery
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
      const update: any = {
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

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(suppliers).where(eq(suppliers.id, input.id));
      return { success: true };
    }),
});
