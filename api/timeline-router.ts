import { z } from "zod";
import { applications, applicants, documents, invoices, payments } from "@db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { adminQuery, applicationAccessQuery, createRouter, staffOrAdminQuery } from "./middleware";
import { assertApplicationReferenceAccess } from "./lib/application-access";
import { hasPrivilegedApplicationAccess } from "./lib/application-authorization";
import { getDb } from "./queries/connection";
import {
  listTimelineEvents,
  nextPaymentAttempt,
  recordTimelineEvent,
} from "./lib/application-timeline";
import { sanitizePaymentFailureCategory } from "./lib/timeline-safety";
import { hashEvidenceManifest } from "./lib/evidence-integrity";

const CLIENT_PAYMENT_EVENTS = [
  "CHECKOUT_OPENED", "PAYMENT_ELEMENT_LOADED", "PAYMENT_STARTED", "PAYMENT_FAILED",
  "PAYMENT_RETRIED", "CHECKOUT_ABANDONED", "PAYMENT_PAGE_CLOSED",
] as const;

const CLIENT_RESULTING_STATES: Record<(typeof CLIENT_PAYMENT_EVENTS)[number], string> = {
  CHECKOUT_OPENED: "opened",
  PAYMENT_ELEMENT_LOADED: "ready",
  PAYMENT_STARTED: "processing",
  PAYMENT_FAILED: "failed",
  PAYMENT_RETRIED: "retrying",
  CHECKOUT_ABANDONED: "abandoned",
  PAYMENT_PAGE_CLOSED: "closed",
};

const OPERATIONAL_EVENTS = [
  "DOCUMENTS_VALIDATED", "ADDITIONAL_DOCUMENTS_REQUESTED", "GOVERNMENT_PROCESSING",
  "VISA_APPROVED", "VISA_ISSUED", "APPLICATION_COMPLETED", "APPLICATION_CANCELLED", "APPLICATION_REJECTED",
  "DISPUTE_NOTE_ADDED", "MANUAL_REVIEW_REQUESTED",
] as const;

async function applicationByReference(referenceNumber: string) {
  const [application] = await getDb().select().from(applications)
    .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
  if (!application) throw new Error("Application not found");
  return application;
}

export const timelineRouter = createRouter({
  list: applicationAccessQuery
    .input(z.object({ referenceNumber: z.string().min(1) }))
    .query(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const application = await applicationByReference(input.referenceNumber);
      const events = await listTimelineEvents(application.id);
      const privileged = hasPrivilegedApplicationAccess(ctx);
      return events.map((event) => ({
        ...event,
        paymentId: privileged ? event.paymentId : null,
        sessionReference: privileged ? event.sessionReference : null,
        actorReference: privileged ? event.actorReference : null,
        sanitizedCategory: privileged ? event.sanitizedCategory : null,
        evidenceHash: privileged ? event.evidenceHash : null,
      }));
    }),

  recordPaymentEvent: applicationAccessQuery
    .input(z.object({
      referenceNumber: z.string().min(1),
      eventName: z.enum(CLIENT_PAYMENT_EVENTS),
      sessionReference: z.string().max(100).optional(),
      failureCategory: z.string().max(80).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const application = await applicationByReference(input.referenceNumber);
      const attemptNumber = ["PAYMENT_STARTED", "PAYMENT_RETRIED"].includes(input.eventName)
        ? await nextPaymentAttempt(application.id)
        : undefined;
      const id = await recordTimelineEvent({
        applicationId: application.id,
        eventName: input.eventName,
        eventSource: "CUSTOMER_CHECKOUT",
        actorType: "CUSTOMER",
        sessionReference: input.sessionReference,
        sanitizedCategory: input.eventName === "PAYMENT_FAILED" ? sanitizePaymentFailureCategory(input.failureCategory) : undefined,
        attemptNumber,
        resultingState: CLIENT_RESULTING_STATES[input.eventName],
      });
      return { id };
    }),

  recordOperationalEvent: staffOrAdminQuery
    .input(z.object({
      referenceNumber: z.string().min(1),
      eventName: z.enum(OPERATIONAL_EVENTS),
      summary: z.string().max(255).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const application = await applicationByReference(input.referenceNumber);
      const actorType = ctx.isAdmin || ctx.user?.role === "admin" ? "ADMIN" : "STAFF";
      const id = await recordTimelineEvent({
        applicationId: application.id,
        eventName: input.eventName,
        eventSource: "OPERATIONS",
        actorType,
        actorReference: ctx.staffId ? `staff:${ctx.staffId}` : actorType.toLowerCase(),
        resultingState: application.status,
        summary: input.summary,
      });
      return { id };
    }),

  generateEvidenceManifest: adminQuery
    .input(z.object({ referenceNumber: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const application = await applicationByReference(input.referenceNumber);
      const db = getDb();
      const [eventRows, paymentRows, invoiceRows, documentRows, leadApplicantRows] = await Promise.all([
        listTimelineEvents(application.id),
        db.select().from(payments).where(eq(payments.applicationId, application.id)).orderBy(desc(payments.createdAt)),
        db.select().from(invoices).where(eq(invoices.applicationId, application.id)).orderBy(desc(invoices.createdAt)),
        db.select({
          id: documents.id,
          documentType: documents.documentType,
          fileSize: documents.fileSize,
          uploadStatus: documents.uploadStatus,
          createdAt: documents.createdAt,
        }).from(documents).where(eq(documents.applicationId, application.id)).orderBy(desc(documents.createdAt)),
        db.select({
          applicantIndex: applicants.applicantIndex,
          fullName: applicants.fullName,
        }).from(applicants).where(eq(applicants.applicationId, application.id)).orderBy(asc(applicants.applicantIndex)).limit(1),
      ]);
      const payerAuthorization = eventRows.filter((event) => event.eventName === "PAYER_AUTHORIZATION_ACCEPTED").at(-1);
      const linkedPayment = payerAuthorization?.paymentId
        ? paymentRows.find((payment) => payment.id === payerAuthorization.paymentId)
        : undefined;
      const generatedAt = new Date().toISOString();
      const manifest = {
        version: "1",
        generatedAt,
        application: {
          id: application.id,
          referenceNumber: application.referenceNumber,
          status: application.status,
          paymentStatus: application.paymentStatus,
          createdAt: application.createdAt,
          updatedAt: application.updatedAt,
        },
        leadApplicant: leadApplicantRows[0] || null,
        payerAuthorization: payerAuthorization ? {
          payerName: payerAuthorization.actorReference,
          relationship: payerAuthorization.sanitizedCategory,
          accepted: payerAuthorization.resultingState === "self" || payerAuthorization.resultingState === "third_party",
          thirdParty: payerAuthorization.resultingState === "third_party",
          acceptedAt: payerAuthorization.createdAt,
          evidenceVersion: payerAuthorization.policyVersion,
          paymentIntentId: linkedPayment?.stripePaymentIntentId || null,
          amount: linkedPayment?.amount || null,
          currency: linkedPayment?.currency || null,
          cardBrand: null,
          cardLast4: null,
          threeDsResult: eventRows.some((event) => event.eventName === "THREE_DS_COMPLETED") ? "completed" : null,
        } : null,
        payments: paymentRows.map((payment) => ({
          id: payment.id,
          stripePaymentIntentId: payment.stripePaymentIntentId,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          createdAt: payment.createdAt,
        })),
        invoices: invoiceRows.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentId: invoice.paymentId,
          amount: invoice.amount,
          createdAt: invoice.createdAt,
        })),
        documents: documentRows,
        timeline: eventRows,
      };
      const sha256 = hashEvidenceManifest(manifest);
      await recordTimelineEvent({
        applicationId: application.id,
        eventName: "EVIDENCE_PACKAGE_GENERATED",
        eventSource: "ADMIN_EVIDENCE",
        actorType: "ADMIN",
        actorReference: ctx.user?.id ? `user:${ctx.user.id}` : ctx.staffId ? `staff:${ctx.staffId}` : "admin-session",
        evidenceHash: sha256,
        summary: "Chargeback evidence manifest generated",
      });
      return { manifest, sha256 };
    }),

  recordEvidenceDownload: adminQuery
    .input(z.object({ referenceNumber: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }))
    .mutation(async ({ input, ctx }) => {
      const application = await applicationByReference(input.referenceNumber);
      await recordTimelineEvent({
        applicationId: application.id,
        eventName: "EVIDENCE_PACKAGE_DOWNLOADED",
        eventSource: "ADMIN_EVIDENCE",
        actorType: "ADMIN",
        actorReference: ctx.user?.id ? `user:${ctx.user.id}` : ctx.staffId ? `staff:${ctx.staffId}` : "admin-session",
        evidenceHash: input.sha256,
        summary: "Chargeback evidence manifest downloaded",
      });
      return { success: true };
    }),
});
