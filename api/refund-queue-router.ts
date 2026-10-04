import crypto from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { applications, applicationTimelineEvents, payments, refundCases, refundItems, staffUsers } from '@db/schema';
import { getDb } from './queries/connection';
import { adminQuery, createRouter } from './middleware';
import { refundChargeSummary, stripeBalanceSummary } from './lib/refund-provider-summary';

const queued = ['PENDING_APPROVAL', 'APPROVED', 'FAILED', 'PROCESSING', 'PARTIALLY_REFUNDED'] as const;
export const refundQueueRouter = createRouter({
  count: adminQuery.query(async () => {
    const [row] = await getDb().select({ count: sql<number>`COUNT(*)` }).from(refundCases).where(inArray(refundCases.status, [...queued]));
    return Number(row.count);
  }),
  list: adminQuery.query(async () => {
    const db = getDb();
    const selectRows = () => db.select({ refundCase: refundCases, reference: applications.referenceNumber, customer: applications.contactEmail,
      requester: staffUsers.name }).from(refundCases).innerJoin(applications, eq(applications.id, refundCases.applicationId))
      .leftJoin(staffUsers, sql`${refundCases.requestedBy}=CONCAT('staff:',${staffUsers.id})`);
    const rows = await selectRows().where(inArray(refundCases.status, [...queued])).orderBy(asc(refundCases.createdAt));
    const completed = await selectRows().where(eq(refundCases.status, 'REFUNDED')).orderBy(desc(refundCases.completedAt)).limit(20);
    const items = await Promise.all([...rows, ...completed].map(async row => ({ ...row, waitingHours: Math.max(0, Math.floor((Date.now() - new Date(row.refundCase.createdAt).getTime()) / 3_600_000)), items: await db.select().from(refundItems).where(eq(refundItems.refundCaseId, row.refundCase.id)) })));
    const balance = await stripeBalanceSummary().then(available => ({ available, error: null })).catch((error: unknown) => ({ available: [], error: error instanceof Error ? error.message : 'Stripe balance unavailable' }));
    return { rows: items, balance };
  }),
  charge: adminQuery.input(z.object({ paymentId: z.number().int().positive() })).query(async ({ input }) => {
    const [payment] = await getDb().select().from(payments).where(eq(payments.id, input.paymentId)).limit(1);
    if (!payment?.stripePaymentIntentId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Payment reference missing. Reconcile this order before refunding.' });
    return refundChargeSummary(payment.stripePaymentIntentId);
  }),
  reject: adminQuery.input(z.object({ refundCaseId: z.string().uuid(), reason: z.string().trim().min(5).max(500) }).strict()).mutation(async ({ ctx, input }) => {
    if (!ctx.staffId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Use your named administrator account.' });
    await getDb().transaction(async tx => {
      const [entry] = await tx.select().from(refundCases).where(eq(refundCases.id, input.refundCaseId)).limit(1).for('update');
      if (!entry || !['PENDING_APPROVAL', 'FAILED'].includes(entry.status)) throw new TRPCError({ code: 'CONFLICT', message: 'This refund cannot be rejected now. Refresh its status.' });
      if (entry.requestedBy === `staff:${ctx.staffId}`) throw new TRPCError({ code: 'FORBIDDEN', message: 'A different named administrator must decide this request.' });
      await tx.update(refundCases).set({ status: 'CANCELLED', completedAt: new Date() }).where(eq(refundCases.id, entry.id));
      await tx.update(refundItems).set({ status: 'CANCELLED' }).where(and(eq(refundItems.refundCaseId, entry.id), inArray(refundItems.status, ['PENDING','FAILED'])));
      await tx.insert(applicationTimelineEvents).values({ id: crypto.randomUUID(), applicationId: entry.applicationId, eventName: 'REFUND_FAILED', eventSource: 'APPROVAL_QUEUE', actorType: 'ADMIN', actorReference: `staff:${ctx.staffId}`, resultingState: 'CANCELLED', summary: `Refund rejected: ${input.reason}` });
    });
    return { success: true };
  }),
  retry: adminQuery.input(z.object({ refundCaseId: z.string().uuid() })).mutation(async ({ input }) => {
    await getDb().transaction(async tx => {
      const [identity] = await tx.select({ applicationId: refundCases.applicationId }).from(refundCases).where(eq(refundCases.id, input.refundCaseId)).limit(1);
      if (!identity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Refund not found. Refresh the queue.' });
      await tx.select({ id: applications.id }).from(applications).where(eq(applications.id, identity.applicationId)).for('update');
      const [entry] = await tx.select().from(refundCases).where(eq(refundCases.id, input.refundCaseId)).limit(1).for('update');
      if (!entry || !['FAILED','PARTIALLY_REFUNDED'].includes(entry.status)) throw new TRPCError({ code: 'CONFLICT', message: 'Only a refund with failed items can be queued again. Refresh its status.' });
      const items = await tx.select().from(refundItems).where(and(eq(refundItems.refundCaseId, entry.id), eq(refundItems.status, 'FAILED')));
      if (!items.length) throw new TRPCError({ code: 'CONFLICT', message: 'No failed refund items remain. Refresh its status.' });
      for (const item of items) {
        if (!item.paymentId) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Only visa-service refunds are available in this launch phase.' });
        const [payment] = await tx.select().from(payments).where(eq(payments.id, item.paymentId)).limit(1);
        const [reserved] = await tx.select({ total: sql<string>`COALESCE(SUM(${refundItems.refundAmount}),0)` }).from(refundItems).where(and(eq(refundItems.paymentId, item.paymentId), inArray(refundItems.status, ['PENDING','PROCESSING','SUCCEEDED'])));
        if (!payment || Math.round((Number(payment.amount) - Number(reserved.total)) * 100) < Math.round(Number(item.refundAmount) * 100)) throw new TRPCError({ code: 'CONFLICT', message: 'Other refunds already reserve this balance. Review them before retrying.' });
        // Reserve each item inside this transaction before checking the next one.
        await tx.update(refundItems).set({ status: 'PENDING' }).where(and(eq(refundItems.id, item.id), eq(refundItems.status, 'FAILED')));
      }
      await tx.update(refundCases).set({ status: 'PENDING_APPROVAL', approvedAt: null, approvedBy: null }).where(eq(refundCases.id, entry.id));
    });
    return { success: true };
  }),
});
