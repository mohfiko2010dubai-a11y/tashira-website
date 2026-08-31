import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { outboundEmailEvents } from "../../db/schema";
import { getDb } from "../queries/connection";
import { auditLog } from "./audit-log";
import { transactionalEmailProvider } from "./email-provider";
import { recipientHash } from "./resend-email";
import type { EmailTemplate } from "./transactional-email";

type NotificationResult = { status: "SENT" | "FAILED" | "ALREADY_SENT" };

async function findSentNotification(applicationId: number, template: EmailTemplate, sourceReference: string) {
  const [row] = await getDb().select({ id: outboundEmailEvents.id }).from(outboundEmailEvents).where(and(
    eq(outboundEmailEvents.applicationId, applicationId),
    eq(outboundEmailEvents.template, template),
    eq(outboundEmailEvents.sourceReference, sourceReference),
    eq(outboundEmailEvents.status, "SENT"),
  )).limit(1);
  return row;
}

async function sendCustomerNotification(input: {
  applicationId: number;
  recipient: string;
  template: EmailTemplate;
  variables: Record<string, string>;
  sourceReference: string;
  failureCategory: string;
}): Promise<NotificationResult> {
  const db = getDb();
  let providerName = "unavailable";
  try {
    if (await findSentNotification(input.applicationId, input.template, input.sourceReference)) {
      return { status: "ALREADY_SENT" };
    }
    const provider = transactionalEmailProvider();
    providerName = provider.name;
    const sent = await provider.send({
      recipient: input.recipient,
      template: input.template,
      variables: input.variables,
      idempotencyKey: `${input.template.toLowerCase()}:${input.applicationId}:${input.sourceReference}`,
    });
    await db.insert(outboundEmailEvents).values({
      id: randomUUID(),
      applicationId: input.applicationId,
      template: input.template,
      sourceReference: input.sourceReference,
      recipientHash: recipientHash(input.recipient),
      provider: provider.name,
      status: "SENT",
      providerReference: sent.reference,
    });
    auditLog("email.notification", "success", "system");
    return { status: "SENT" };
  } catch {
    try {
      await db.insert(outboundEmailEvents).values({
        id: randomUUID(),
        applicationId: input.applicationId,
        template: input.template,
        sourceReference: input.sourceReference,
        recipientHash: recipientHash(input.recipient),
        provider: providerName,
        status: "FAILED",
        failureCategory: input.failureCategory,
      });
    } catch {
      // Notification evidence is best-effort here: the underlying operational
      // mutation has already committed and must never be reported as failed.
    }
    auditLog("email.notification", "failure", "system");
    return { status: "FAILED" };
  }
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Application submitted",
  payment_received: "Payment received",
  documents_pending: "Documents pending",
  documents_received: "Documents received",
  under_review: "Under review by TASHIRA",
  visa_processing: "Visa processing with the authority",
  visa_received: "Visa issued",
  completed: "Application completed",
  cancelled: "Application cancelled",
  rejected: "Application rejected",
};

export function sendStatusChangeNotification(input: {
  applicationId: number;
  recipient: string;
  referenceNumber: string;
  newStatus: string;
}) {
  const template: EmailTemplate = input.newStatus === "visa_received" ? "VISA_ISSUED" : "STATUS_CHANGED";
  return sendCustomerNotification({
    applicationId: input.applicationId,
    recipient: input.recipient,
    template,
    variables: {
      referenceNumber: input.referenceNumber,
      statusLabel: STATUS_LABELS[input.newStatus] ?? input.newStatus.replaceAll("_", " "),
    },
    sourceReference: `status:${input.newStatus}`,
    failureCategory: "status_notification_failed",
  });
}

export function sendDocumentsRequiredNotification(input: {
  applicationId: number;
  recipient: string;
  referenceNumber: string;
  documentLabel: string;
  reason?: string;
  dedupReference: string;
}) {
  const details = `Required document: ${input.documentLabel}.${input.reason ? ` Reason: ${input.reason}.` : ""}`;
  return sendCustomerNotification({
    applicationId: input.applicationId,
    recipient: input.recipient,
    template: "DOCUMENTS_REQUIRED",
    variables: { referenceNumber: input.referenceNumber, documentList: details },
    sourceReference: input.dedupReference,
    failureCategory: "documents_notification_failed",
  });
}
