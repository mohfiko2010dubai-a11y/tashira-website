import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { suppliers } from "@db/schema";
import { eq } from "drizzle-orm";

export const supplierRouter = createRouter({
  // List all suppliers
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(suppliers).orderBy(suppliers.name);
  }),

  // Get single supplier
  get: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [supplier] = await db.select().from(suppliers)
        .where(eq(suppliers.id, input.id))
        .limit(1);
      return supplier || null;
    }),

  // Create supplier
  create: publicQuery
    .input(z.object({
      name: z.string().min(1),
      contactPerson: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [supplier] = await db.insert(suppliers).values({
        name: input.name,
        contactPerson: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null,
      });
      return { id: supplier.insertId, success: true };
    }),

  // Update supplier
  update: publicQuery
    .input(z.object({
      id: z.number(),
      name: z.string().min(1),
      contactPerson: z.string().optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),
      notes: z.string().optional(),
      isActive: z.enum(["active", "inactive"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(suppliers).set({
        name: input.name,
        contactPerson: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        notes: input.notes || null,
        ...(input.isActive && { isActive: input.isActive }),
      }).where(eq(suppliers.id, input.id));
      return { success: true };
    }),

  // Delete supplier
  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(suppliers).where(eq(suppliers.id, input.id));
      return { success: true };
    }),
});
