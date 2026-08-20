import { randomUUID } from "crypto";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { deletionAuditEvents, legalHoldEvents, retentionPolicies, retentionRecords } from "@db/schema";
import { adminQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";

const categories = ["IDENTITY_DOCUMENTS", "APPLICATION_RECORDS", "PAYMENT_RECORDS", "CHARGEBACK_EVIDENCE", "AUDIT_LOGS"] as const;

function actor(ctx: { user?: { id: number }; staffId?: number }) {
  return ctx.user?.id ? `user:${ctx.user.id}` : ctx.staffId ? `staff:${ctx.staffId}` : "admin-session";
}

export const retentionRouter = createRouter({
  policies: adminQuery.query(() => getDb().select().from(retentionPolicies).orderBy(desc(retentionPolicies.createdAt))),

  createPolicyVersion: adminQuery.input(z.object({
    category: z.enum(categories),
    durationDays: z.number().int().positive().optional(),
    effectiveAt: z.coerce.date(),
  })).mutation(async ({ input, ctx }) => {
    const [latest] = await getDb().select({ version: retentionPolicies.version }).from(retentionPolicies)
      .where(eq(retentionPolicies.category, input.category)).orderBy(desc(retentionPolicies.version)).limit(1);
    const version = (latest?.version ?? 0) + 1;
    await getDb().insert(retentionPolicies).values({ ...input, version, createdBy: actor(ctx) });
    return { version };
  }),

  registerRecord: adminQuery.input(z.object({
    category: z.enum(categories),
    subjectType: z.string().min(1).max(50),
    subjectReference: z.string().min(1).max(100),
    retentionStart: z.coerce.date(),
    scheduledDeletionAt: z.coerce.date().optional(),
  })).mutation(async ({ input }) => {
    const id = randomUUID();
    await getDb().insert(retentionRecords).values({ ...input, id });
    return { id };
  }),

  placeLegalHold: adminQuery.input(z.object({ recordId: z.string().uuid(), reason: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      await getDb().transaction(async (tx) => {
        const [record] = await tx.select().from(retentionRecords).where(eq(retentionRecords.id, input.recordId)).limit(1);
        if (!record) throw new Error("Retention record not found");
        if (record.legalHoldActive === "yes") throw new Error("Legal hold is already active");
        await tx.update(retentionRecords).set({ legalHoldActive: "yes" }).where(eq(retentionRecords.id, input.recordId));
        await tx.insert(legalHoldEvents).values({
          id: randomUUID(), retentionRecordId: input.recordId, action: "PLACED",
          reason: input.reason, authorizedActor: actor(ctx),
        });
      });
      return { success: true };
    }),

  releaseLegalHold: adminQuery.input(z.object({ recordId: z.string().uuid(), reason: z.string().min(1).max(255) }))
    .mutation(async ({ input, ctx }) => {
      await getDb().transaction(async (tx) => {
        const [record] = await tx.select().from(retentionRecords).where(eq(retentionRecords.id, input.recordId)).limit(1);
        if (!record) throw new Error("Retention record not found");
        if (record.legalHoldActive !== "yes") throw new Error("No active legal hold exists");
        await tx.update(retentionRecords).set({ legalHoldActive: "no" }).where(eq(retentionRecords.id, input.recordId));
        await tx.insert(legalHoldEvents).values({
          id: randomUUID(), retentionRecordId: input.recordId, action: "RELEASED",
          reason: input.reason, authorizedActor: actor(ctx),
        });
      });
      return { success: true };
    }),

  evaluateDeletion: adminQuery.input(z.object({ recordId: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const [record] = await getDb().select().from(retentionRecords).where(eq(retentionRecords.id, input.recordId)).limit(1);
      if (!record) throw new Error("Retention record not found");
      const blocked = record.legalHoldActive === "yes";
      const due = Boolean(record.scheduledDeletionAt && record.scheduledDeletionAt <= new Date());
      const outcome = blocked ? "BLOCKED_LEGAL_HOLD" as const : due ? "ELIGIBLE" as const : "FAILED" as const;
      await getDb().insert(deletionAuditEvents).values({
        id: randomUUID(), retentionRecordId: input.recordId, outcome,
        actorReference: actor(ctx), details: blocked ? "Active legal hold blocks deletion" : due ? "Eligible for separately authorized deletion" : "Retention date has not been reached",
      });
      return { outcome, deletionPerformed: false };
    }),
});
