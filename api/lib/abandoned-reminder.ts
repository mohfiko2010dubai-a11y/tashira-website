import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { applications, applicationTimelineEvents, customerRecoveryChallenges, outboundEmailEvents } from "../../db/schema";
import { getDb } from "../queries/connection";
import { createRecoveryChallenge, recoveryExpiry } from "./customer-recovery";
import { getApplicationReadiness } from "./application-readiness";
import { transactionalEmailProvider } from "./email-provider";
import { recipientHash } from "./resend-email";
import { recordTimelineEvent, type TimelineEventName } from "./application-timeline";
import { abandonedReminderStage, type AbandonedReminderStage } from "./abandoned-reminder-decision";

const eventNames: Record<AbandonedReminderStage, TimelineEventName> = {
  APPLICATION: "ABANDONED_APPLICATION_REMINDER",
  DOCUMENTS: "ABANDONED_DOCUMENTS_REMINDER",
  PAYMENT: "ABANDONED_PAYMENT_REMINDER",
};

export async function sendAbandonedApplicationReminder(applicationId: number) {
  const db = getDb();
  const [application] = await db.select({
    id: applications.id,
    referenceNumber: applications.referenceNumber,
    contactEmail: applications.contactEmail,
    paymentStatus: applications.paymentStatus,
  }).from(applications).where(eq(applications.id, applicationId)).limit(1);
  if (!application) return { status: "INELIGIBLE" as const, reason: "NOT_FOUND" as const };

  const [checkout] = await db.select({ id: applicationTimelineEvents.id }).from(applicationTimelineEvents)
    .where(and(
      eq(applicationTimelineEvents.applicationId, application.id),
      eq(applicationTimelineEvents.eventName, "CHECKOUT_OPENED"),
    )).orderBy(desc(applicationTimelineEvents.createdAt)).limit(1);
  const readiness = await getApplicationReadiness(application.id);
  const stage = abandonedReminderStage({
    paymentStatus: application.paymentStatus,
    emailKnown: application.contactEmail.trim().length > 0,
    checkoutReached: Boolean(checkout),
    readiness,
  });
  if (!stage) return { status: "INELIGIBLE" as const, reason: "CURRENT_STATE" as const };

  const eventName = eventNames[stage];
  const [alreadySent] = await db.select({ id: applicationTimelineEvents.id }).from(applicationTimelineEvents)
    .where(and(
      eq(applicationTimelineEvents.applicationId, application.id),
      eq(applicationTimelineEvents.eventName, eventName),
      eq(applicationTimelineEvents.resultingState, "SENT"),
    )).limit(1);
  if (alreadySent) return { status: "ALREADY_SENT" as const, stage };

  const [latestState] = await db.select({ paymentStatus: applications.paymentStatus }).from(applications)
    .where(eq(applications.id, application.id)).limit(1);
  if (latestState?.paymentStatus === "paid") return { status: "INELIGIBLE" as const, reason: "PAID" as const };

  const challenge = createRecoveryChallenge("MAGIC_LINK", application.contactEmail);
  await db.insert(customerRecoveryChallenges).values({
    id: challenge.id,
    applicationId: application.id,
    channel: "MAGIC_LINK",
    tokenHash: challenge.tokenHash,
    destinationHash: challenge.destinationHash,
    expiresAt: recoveryExpiry("MAGIC_LINK"),
  });

  let providerName = "unavailable";
  try {
    const provider = transactionalEmailProvider();
    providerName = provider.name;
    const sent = await provider.send({
      recipient: application.contactEmail,
      template: "RESUME_LINK",
      variables: {
        referenceNumber: application.referenceNumber,
        resumeUrl: `https://staging.tashiraev.com/recover?token=${encodeURIComponent(challenge.secret)}`,
        reminderStage: stage,
      },
      idempotencyKey: `abandoned-reminder/${application.id}/${stage}`,
    });
    await db.insert(outboundEmailEvents).values({
      id: randomUUID(), applicationId: application.id, template: "RESUME_LINK",
      recipientHash: recipientHash(application.contactEmail), provider: provider.name,
      status: "SENT", providerReference: sent.reference,
    });
    await recordTimelineEvent({
      applicationId: application.id,
      eventName,
      eventSource: "ABANDONED_RECOVERY",
      actorType: "SYSTEM",
      actorReference: challenge.id,
      resultingState: "SENT",
      summary: `${stage} recovery reminder sent`,
    });
    return { status: "SENT" as const, stage };
  } catch {
    await db.insert(outboundEmailEvents).values({
      id: randomUUID(), applicationId: application.id, template: "RESUME_LINK",
      recipientHash: recipientHash(application.contactEmail), provider: providerName,
      status: "FAILED", failureCategory: "delivery_failed",
    });
    await recordTimelineEvent({
      applicationId: application.id,
      eventName,
      eventSource: "ABANDONED_RECOVERY",
      actorType: "SYSTEM",
      actorReference: challenge.id,
      resultingState: "FAILED",
      summary: `${stage} recovery reminder failed`,
    });
    return { status: "FAILED" as const, stage };
  }
}
