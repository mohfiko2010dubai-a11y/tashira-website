import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { applicationTimelineEvents, outboundEmailEvents, securityDepositEmailAttempts, securityDepositRequests } from '@db/schema';
import { getDb } from '../queries/connection';
import { transactionalEmailProvider } from './email-provider';
import { recipientHash } from './resend-email';
import { depositDeliveryFingerprint, openDepositEmail } from './deposit-email-envelope';

// Resend remembers idempotency keys for 24h. Stop at 23h; never silently rotate a link
// after an uncertain outcome. https://resend.com/changelog/idempotency-keys
const SAFE_RETRY_MS = 23 * 60 * 60 * 1000;
const LEASE_MS = 60_000; // Provider request timeout is 15 seconds.

export async function deliverDepositEmail(requestId: string, actor: string) {
  const db = getDb(), leaseId = crypto.randomUUID();
  const claimed = await db.transaction(async tx => {
    const [request] = await tx.select().from(securityDepositRequests).where(eq(securityDepositRequests.id, requestId)).limit(1).for('update');
    if (!request) throw new TRPCError({ code: 'NOT_FOUND', message: 'طلب التأمين غير موجود. حدّث القائمة.' });
    if (request.status !== 'DRAFT') return { send: false as const, status: request.status };
    const [attempt] = await tx.select().from(securityDepositEmailAttempts).where(eq(securityDepositEmailAttempts.requestId, requestId)).limit(1).for('update');
    if (!attempt?.encryptedPayload) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'هذا الطلب يحتاج مراجعة سجل البريد قبل إعادة الإرسال؛ لا يمكن تأكيد نتيجة المحاولة القديمة.' });
    const now = new Date();
    if (attempt.leaseUntil && attempt.leaseUntil > now) throw new TRPCError({ code: 'CONFLICT', message: 'جارٍ إرسال نفس الطلب. انتظر دقيقة ثم حدّث القائمة.' });
    if (request.expiresAt <= now || (attempt.firstAttemptAt && now.getTime() - attempt.firstAttemptAt.getTime() >= SAFE_RETRY_MS))
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'انتهت مهلة إعادة المحاولة الآمنة. راجع سجل مزود البريد قبل إرسال طلب آخر.' });
    const envelope = openDepositEmail(requestId, attempt.encryptedPayload);
    if (envelope.deliveryFingerprint !== depositDeliveryFingerprint(envelope.variables))
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'تغير إعداد البريد أو القالب. راجع نتيجة الإرسال السابقة قبل إعادة المحاولة.' });
    await tx.update(securityDepositEmailAttempts).set({ leaseId, leaseUntil: new Date(now.getTime() + LEASE_MS), firstAttemptAt: attempt.firstAttemptAt || now })
      .where(eq(securityDepositEmailAttempts.requestId, requestId));
    return { send: true as const, applicationId: request.applicationId, envelope };
  });
  if (!claimed.send) return { requestId, status: claimed.status };

  let providerName = 'unavailable';
  let sent: { reference: string };
  try {
    const provider = transactionalEmailProvider(); providerName = provider.name;
    sent = await provider.send({ recipient: claimed.envelope.recipient, template: 'SECURITY_DEPOSIT_REQUEST',
      variables: claimed.envelope.variables, idempotencyKey: `security-deposit/${requestId}` });
  } catch {
    await db.transaction(async tx => {
      const result = await tx.update(securityDepositEmailAttempts).set({ leaseId: null, leaseUntil: null })
        .where(and(eq(securityDepositEmailAttempts.requestId, requestId), eq(securityDepositEmailAttempts.leaseId, leaseId)));
      if (Number(result[0].affectedRows) !== 1) return;
      await tx.insert(outboundEmailEvents).values({ id: crypto.randomUUID(), applicationId: claimed.applicationId,
        template: 'SECURITY_DEPOSIT_REQUEST', recipientHash: recipientHash(claimed.envelope.recipient),
        provider: providerName, status: 'FAILED', failureCategory: 'delivery_unconfirmed' });
    });
    return { requestId, status: 'DRAFT' as const };
  }
  // A database failure after provider acceptance leaves the identical retry envelope.
  // Status, provider evidence and timeline either all commit or all roll back.
  return db.transaction(async tx => {
    const [request] = await tx.select({ status: securityDepositRequests.status }).from(securityDepositRequests)
      .where(eq(securityDepositRequests.id, requestId)).limit(1).for('update');
    if (!request) throw new Error('Deposit disappeared before delivery recording');
    if (request.status !== 'DRAFT') return { requestId, status: request.status };
    await tx.update(securityDepositRequests).set({ status: 'SENT', sentAt: new Date() }).where(eq(securityDepositRequests.id, requestId));
    await tx.update(securityDepositEmailAttempts).set({ providerReference: sent.reference, encryptedPayload: null, leaseId: null, leaseUntil: null })
      .where(eq(securityDepositEmailAttempts.requestId, requestId));
    await tx.insert(outboundEmailEvents).values({ id: crypto.randomUUID(), applicationId: claimed.applicationId,
      template: 'SECURITY_DEPOSIT_REQUEST', recipientHash: recipientHash(claimed.envelope.recipient), provider: providerName,
      status: 'SENT', providerReference: sent.reference });
    await tx.insert(applicationTimelineEvents).values({ id: crypto.randomUUID(), applicationId: claimed.applicationId,
      eventName: 'SECURITY_DEPOSIT_REQUESTED', eventSource: 'ADMIN_DASHBOARD', actorType: 'ADMIN', actorReference: actor,
      resultingState: 'SENT', summary: 'Security-deposit email accepted by provider; secure request link preserved' });
    return { requestId, status: 'SENT' as const };
  });
}
