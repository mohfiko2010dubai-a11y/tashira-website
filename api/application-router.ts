import { customerServiceClock } from "./lib/customer-wait-log";
import { selectCaseSupplier } from './lib/supplier-selection';
import { syncCaseWorkStatus } from './lib/operations/case-work-status';
import { enqueueApplicationStatusEmail } from './lib/application-status-outbox';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { refuseVisaChange, requestManualChange, decideManualChange, manualChangeQueue, refusalOutcomes, recordDifferenceLink } from "./lib/manual-visa-change";
import { verifyNamedStaffPassword } from "./lib/named-staff-password";
import { MysqlCustomerInterviewWriteRepository } from "./lib/customer/mysql-customer-interview-write-repository";
import { applicantName } from "../contracts/applicant-name";
import { assessDocumentValidity } from "../contracts/document-validity";
import { acknowledgeSubmittedProduct, proposeSubmittedProduct } from "./lib/product-substitution";
import { currentVisaChangeQuote } from "./lib/visa-change-quotes";
import { evaluateDocumentRequirements, tripPurposeSchema } from "../contracts/document-requirement-engine";
import { loadTripPurposes } from "./lib/customer/trip-purpose";
import { defaultOperationsSqlClient, defaultOperationsPool } from "./lib/operations/mysql-query-client";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import { prepareApplicationCreation, withApplicationCreation } from "./lib/application-creation";
import { newApplicationQuery, adminQuery, applicationAccessQuery, applicationSubmissionQuery, createRouter, staffOrAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, applicants, suppliers } from "@db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { getErrorMessage } from "./lib/errors";
import { internalFailure } from "./lib/public-error";
import { auditLog } from "./lib/audit-log";
import { assertApplicationReferenceAccess } from "./lib/application-access";
import { getCanonicalApplicationByReference } from "./lib/application-projection";
import { createCustomerApplicationCookie } from "./lib/customer-session";
import { recordTimelineEvent } from "./lib/application-timeline";
import { TERMS_POLICY_VERSION } from "@contracts/constants";
import { quoteApplicationPrice, saveApplicationPriceSnapshot } from "./lib/pricing-engine";
import { activeBusinessSettings } from "./lib/pricing-engine";
import { canEnterApplicationState } from "./lib/processing-gate";
import { TRPCError } from "@trpc/server";
import { assertStaffSupplierAccess, needsStaffScope, staffApplicationListCondition } from "./lib/staff-application-scope";
import { financialApplicationScope } from "./lib/financial-application-scope";
import { withCheckoutLock } from "./lib/checkout-quote";
import { recordAuthoritySubmission } from "./lib/processing-guarantee";

const STATUS_ENUM = ["submitted","payment_received","documents_pending","documents_received","under_review","visa_processing","visa_received","completed","rejected","cancelled"] as const;
const VAT_STATUS_ENUM = ["standard", "zero_rated", "exempt", "out_of_scope"] as const;
const PLACE_OF_SUPPLY_ENUM = ["within_uae", "outside_uae"] as const;
export const applicationRouter = createRouter({
  supplierOptions: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().min(3) }).strict()).query(async ({ input, ctx }) => {
    await assertStaffSupplierAccess(ctx);
    const db = getDb();
    const [application] = await db.select({ supplierId: applications.supplierId }).from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
    if (!application) throw new TRPCError({ code: 'NOT_FOUND', message: 'الطلب غير موجود. ارجع إلى قائمة الطلبات.' });
    const [pricing] = await defaultOperationsPool().execute<RowDataPacket[]>(`SELECT CASE
      WHEN a.supplier_id IS NULL THEN 'NOT_SELECTED'
      WHEN a.supplier_cost_aed IS NULL OR a.supplier_total_aed IS NULL THEN 'MISSING_RATE'
      WHEN a.supplier_rate_id IS NULL THEN 'MANUAL'
      WHEN r.supplier_id<>a.supplier_id OR r.service_code<>COALESCE(a.submitted_product,a.visa_type)
        OR r.processing_type<>a.processing_type OR a.supplier_rate_quantity<>(SELECT COUNT(*) FROM applicants p WHERE p.application_id=a.id) THEN 'NEEDS_REFRESH'
      ELSE 'READY' END readiness FROM applications a LEFT JOIN supplier_product_rates r ON r.id=a.supplier_rate_id WHERE a.reference_number=?`, [input.referenceNumber]);
    const options = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).where(eq(suppliers.isActive, 'active')).orderBy(suppliers.name);
    return { currentSupplierId: application.supplierId, options, pricingReadiness: String(pricing[0]?.readiness ?? 'NOT_SELECTED') };
  }),
  selectSupplier: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().min(3), supplierId: z.number().int().positive(), expectedSupplierId: z.number().int().positive().nullable() }).strict()).mutation(async ({ input, ctx }) => {
    await assertStaffSupplierAccess(ctx);
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: 'NOT_FOUND', message: 'الطلب غير موجود. ارجع إلى قائمة الطلبات.' });
    return selectCaseSupplier(application.id, input.supplierId, input.expectedSupplierId, ctx.staffId ? `staff:${ctx.staffId}` : ctx.user?.id ? `user:${ctx.user.id}` : 'admin-session', needsStaffScope(ctx) ? ctx.staffId : undefined);
  }),
  proposeSubmittedProduct: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().min(3), product: z.string().min(1).max(80), reason: z.string().trim().min(1).max(500) }).strict()).mutation(async ({ input, ctx }) => {
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return proposeSubmittedProduct(application.id, input.product, ctx.staffId ? `staff:${ctx.staffId}` : ctx.user?.id ? `user:${ctx.user.id}` : 'admin-session', input.reason, needsStaffScope(ctx) ? ctx.staffId : undefined);
  }),
  serviceClock: applicationAccessQuery.input(z.object({ referenceNumber: z.string().min(3) })).query(async ({ input, ctx }) => {
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return customerServiceClock(application.id);
  }),
  visaChangeQuote: applicationAccessQuery.input(z.object({ referenceNumber: z.string().min(3) })).query(async ({ input, ctx }) => {
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return currentVisaChangeQuote(application.id);
  }),
  acknowledgeSubmittedProduct: applicationAccessQuery.input(z.object({ referenceNumber: z.string().min(3), version: z.number().int().positive(), quoteId: z.string().uuid() })).mutation(async ({ input, ctx }) => {
    // Staff privilege is deliberately insufficient to provide customer consent.
    if (!ctx.customerApplicationReferences.has(input.referenceNumber)) throw new TRPCError({ code: "FORBIDDEN", message: "Open your secure application link to acknowledge this change." });
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return acknowledgeSubmittedProduct(application.id, input.version, input.quoteId);
  }),
  refuseVisaChange: applicationAccessQuery.input(z.object({ referenceNumber: z.string().min(3), quoteId: z.string().uuid(), version: z.number().int().positive(), reason: z.string().trim().min(5).max(500) })).mutation(async ({ input, ctx }) => {
    if (!ctx.customerApplicationReferences.has(input.referenceNumber)) throw new TRPCError({ code: "FORBIDDEN", message: "Open your secure application link to refuse this proposal." });
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return refuseVisaChange(application.id, input.quoteId, input.version, input.reason);
  }),
  manualChangeQueue: adminQuery.query(() => manualChangeQueue()),
  requestManualChange: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().min(3), quoteId: z.string().uuid(), version: z.number().int().positive(),
    kind: z.enum(["SETTLEMENT", "REFUSAL_OUTCOME"]), outcome: z.enum(refusalOutcomes).optional(), direction: z.enum(["TOP_UP", "REFUND"]).optional(),
    amountMinor: z.number().int().positive().optional(), currency: z.literal("USD").optional(), stripeReference: z.string().max(150).optional(),
    reason: z.string().trim().min(5).max(500), writtenInsistence: z.string().trim().max(1000).optional(), riskRecord: z.string().trim().max(1000).optional(),
  }).strict()).mutation(async ({ input, ctx }) => {
    if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Use your named staff account." });
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return requestManualChange(application.id, ctx.staffId, input);
  }),
  decideManualChange: adminQuery.input(z.object({ id: z.string().uuid(), approve: z.boolean(), reason: z.string().trim().min(5).max(500), password: z.string().min(1) }).strict()).mutation(async ({ input, ctx }) => {
    if (!ctx.staffId || !await verifyNamedStaffPassword(ctx.staffId, input.password)) throw new TRPCError({ code: "FORBIDDEN", message: "Verify your named administrator password before deciding." });
    return decideManualChange(input.id, ctx.staffId, input.approve, input.reason);
  }),
  recordDifferenceLink: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().min(3), quoteId: z.string().uuid(), version: z.number().int().positive(), url: z.string().url().max(450) }).strict()).mutation(async ({ input, ctx }) => {
    if (!ctx.staffId) throw new TRPCError({ code: "FORBIDDEN", message: "Use your named staff account." });
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return recordDifferenceLink(application.id, input.quoteId, input.version, ctx.staffId, input.url);
  }),
  documentReviewFacts: applicationAccessQuery.input(z.object({ referenceNumber: z.string().min(3) })).query(async ({ input, ctx }) => {
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const [application, settings] = await Promise.all([getCanonicalApplicationByReference(input.referenceNumber), activeBusinessSettings()]);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    return { settingsVersion: settings.version, applicants: application.applicants.map(applicant => ({ applicantId: applicant.id,
      ...assessDocumentValidity({ passportExpiry: applicant.passportExpiry, residenceExpiry: applicant.residenceExpiry,
        dateOfBirth: applicant.dateOfBirth, entryDate: application.arrivalDate, today: new Date().toISOString().slice(0, 10) }, settings) })) };
  }),
  recordDocumentReview: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().min(3), applicantId: z.number().int().positive(),
    decision: z.enum(["PROCEED", "CONTACT", "SUBSTITUTE", "REFUND"]), reason: z.string().trim().min(1).max(180) })).mutation(async ({ input, ctx }) => {
    assertApplicationReferenceAccess(ctx, input.referenceNumber);
    const application = await getCanonicalApplicationByReference(input.referenceNumber);
    if (!application?.applicants.some(applicant => applicant.id === input.applicantId)) throw new TRPCError({ code: "NOT_FOUND", message: "Applicant not found" });
    await recordTimelineEvent({ applicationId: application.id, eventName: "DOCUMENT_REVIEW_DECISION", eventSource: "DOCUMENT_REVIEW", actorType: ctx.staffId ? "STAFF" : "ADMIN",
      actorReference: ctx.staffId ? String(ctx.staffId) : String(ctx.user?.id ?? "admin-session"), resultingState: input.decision,
      summary: `Applicant ${input.applicantId}: ${input.reason}` });
    return { recorded: true };
  }),
  prepareCreation: applicationSubmissionQuery.input(z.object({ flow: z.enum(["FORM", "CHAT", "LEGACY"]), startNew: z.boolean().default(false) }).strict())
    .mutation(({ input, ctx }) => prepareApplicationCreation(ctx, input.flow, input.startNew)),
  create: newApplicationQuery
    .input(z.object({
      requestKey: z.string().uuid(),
      baseType: z.enum(["single", "family"]),
      residenceType: z.enum(["non-gcc", "gcc-resident", "non-gcc-accompany", "gcc-accompany"]),
      visaType: z.string(),
      processingType: z.enum(["regular", "express"]),
      contactEmail: z.string().email(),
      language: z.enum(['en', 'ar']).default('en'),
      contactPhone: z.string(),
      arrivalDate: z.string().optional(),
      journeyMode: z.enum(["LEGACY", "DYNAMIC"]).default("LEGACY"),
      policyVersion: z.literal(TERMS_POLICY_VERSION),
      applicants: z.array(z.object({
        fullName: z.string().transform(applicantName),
        nationality: z.string().optional(),
        tripPurpose: tripPurposeSchema.optional(),
        passportNumber: z.string().optional(),
        passportType: z.string().optional(),
        travelingFrom: z.string().optional(),
        passportExpiry: z.string().optional(),
        profession: z.string().optional(),
        gccResidenceNumber: z.string().optional(),
        gccResidenceCountry: z.string().optional(),
        sponsorName: z.string().trim().max(255).optional(),
        sponsorRelation: z.string().trim().max(50).optional(),
      })),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      try {
        if (input.residenceType === "gcc-accompany" && input.applicants.some(applicant => !applicant.sponsorName || !applicant.sponsorRelation)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the sponsor's full name and relationship for each accompanying applicant." });
        }
        const created = await withApplicationCreation(ctx, input.requestKey, ["FORM", "LEGACY"], input, async (connection, referenceNumber) => {
        const db = drizzle(connection);
        const quote = await quoteApplicationPrice({
          serviceCode: input.visaType,
          processingType: input.processingType,
          applicantCount: input.applicants.length,
        });
        if (quote.currency !== "USD") throw new Error("Stripe checkout currently requires a USD pricing rule");
        const values: typeof applications.$inferInsert = {
          referenceNumber,
          baseType: input.baseType,
          residenceType: input.residenceType,
          visaType: input.visaType,
          processingType: input.processingType,
          contactEmail: input.contactEmail,
          preferredLanguage: input.language,
          contactPhone: input.contactPhone,
          arrivalDate: input.arrivalDate,
          exchangeRate: quote.exchangeRateToBase.toFixed(4),
          totalAmountUsd: quote.totalPrice.toFixed(2),
          totalAmountAed: quote.totalInBaseCurrency.toFixed(2),
        };

        const [app] = await db.insert(applications).values(values).$returningId();

        const appId = app.id;
        await saveApplicationPriceSnapshot(appId, quote, db);
        await recordTimelineEvent({
          applicationId: appId,
          eventName: "APPLICATION_CREATED",
          eventSource: "APPLICATION_API",
          actorType: "CUSTOMER",
          summary: "Application created",
        }, db);
        const applicantIds: number[] = [];
        for (let i = 0; i < input.applicants.length; i++) {
          const a = input.applicants[i];
          const [createdApplicant] = await db.insert(applicants).values({
            applicationId: appId,
            applicantIndex: i,
            fullName: a.fullName,
            nationality: a.nationality || null,
            passportNumber: a.passportNumber || null,
            passportType: a.passportType || null,
            travelingFrom: a.travelingFrom || null,
            passportExpiry: a.passportExpiry || null,
            profession: a.profession || null,
            gccResidenceNumber: a.gccResidenceNumber || null,
            gccResidenceCountry: a.gccResidenceCountry || null,
            sponsorName: a.sponsorName || null,
            sponsorRelation: a.sponsorRelation || null,
          }).$returningId();
          applicantIds.push(createdApplicant.id);
          await recordTimelineEvent({
            applicationId: appId,
            eventName: "APPLICANT_ADDED",
            eventSource: "APPLICATION_API",
            actorType: "CUSTOMER",
            actorReference: `applicant:${i}`,
            summary: `Applicant ${i + 1} added`,
          }, db);
        }
        if (input.journeyMode === "LEGACY") {
          await recordTimelineEvent({
            applicationId: appId,
            eventName: "APPLICATION_SUBMITTED",
            eventSource: "APPLICATION_API",
            actorType: "CUSTOMER",
            resultingState: "submitted",
            summary: "Application submitted",
          }, db);
        }
        return { applicationId: appId, applicantIds };
        });
        for (const [index, a] of input.applicants.entries()) {
          if (a.tripPurpose && input.journeyMode === "DYNAMIC") {
            const applicantId = created.applicantIds[index];
            await new MysqlCustomerInterviewWriteRepository(defaultOperationsPool()).editApplicant({ applicationId: created.applicationId,
              applicantId, expectedVersion: 1, profile: { fullName: a.fullName, nationality: a.nationality || null,
                residenceCountry: a.gccResidenceCountry || null, tripPurpose: a.tripPurpose }, reason: "Initial document selections",
              actorReference: `customer:${created.referenceNumber}`, idempotencyKey: `initial-purpose:${applicantId}`, occurredAt: new Date() });
          }
        }
        const dynamicJourneyEnabled = input.journeyMode === "DYNAMIC";
        ctx.resHeaders.append("set-cookie", createCustomerApplicationCookie(ctx.req.headers, created.referenceNumber));
        return { id: created.applicationId, referenceNumber: created.referenceNumber, applicantIds: created.applicantIds, dynamicJourneyEnabled };
      } catch (err: unknown) {
        if (err instanceof TRPCError) throw err;
        const message = getErrorMessage(err);
        console.error('[API ERROR]', message);
        throw new Error(`Database error: ${message}`);
      }
    }),

  getByReference: applicationAccessQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const application = await getCanonicalApplicationByReference(input.referenceNumber);
      if (!application) return application;
      const purposes = await loadTripPurposes(defaultOperationsSqlClient(), application.id);
      return { ...application, documentRuleDiagnostics: application.applicants.map(applicant => {
        const result = evaluateDocumentRequirements({ nationality: applicant.nationality, country_of_residence: applicant.gccResidenceCountry,
          visa_type: application.visaType, residence_type: application.residenceType, trip_purpose: purposes.get(applicant.id) });
        return { applicantId: applicant.id, label: applicant.fullName, suppressed: result.suppressed, unmatched: result.unmatched };
      }) };

    }),

  list: staffOrAdminQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(STATUS_ENUM).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
      includeTest: z.boolean().default(false),
    }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;

      const conditions = input?.includeTest ? [] : [financialApplicationScope()];
      const staffScope = await staffApplicationListCondition(ctx);
      if (staffScope) conditions.push(staffScope);
      if (input?.search?.trim()) {
        const search = `%${input.search.trim()}%`;
        conditions.push(sql`(${applications.referenceNumber} LIKE ${search} OR ${applications.contactEmail} LIKE ${search} OR EXISTS (SELECT 1 FROM applicants p WHERE p.application_id=${applications.id} AND p.full_name LIKE ${search}))`);
      }

      if (input?.status) conditions.push(eq(applications.status, input.status));
      if (input?.dateFrom) conditions.push(gte(applications.createdAt, new Date(input.dateFrom)));
      if (input?.dateTo) conditions.push(lte(applications.createdAt, new Date(input.dateTo + 'T23:59:59')));

      const query = db.select().from(applications);
      const allApps = await query.where(and(...conditions))
        .orderBy(desc(applications.createdAt)).limit(limit).offset(offset);

      const result = await Promise.all(allApps.map(async (app) => {
        const applicantList = await db.select().from(applicants)
          .where(eq(applicants.applicationId, app.id));
        let supplier = null;
        try {
          if (app.supplierId) {
            const [s] = await db.select().from(suppliers)
              .where(eq(suppliers.id, app.supplierId)).limit(1);
            supplier = s || null;
          }
        } catch {
          // supplierId column may not exist yet
        }
        return { ...app, applicants: applicantList.map(item => ({ ...item, fullName: applicantName(item.fullName) })), supplier };
      }));

      return result;
    }),

  updateStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(STATUS_ENUM) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [application] = await db.select({
        paymentStatus: applications.paymentStatus,
      }).from(applications)
        .where(eq(applications.id, input.id)).limit(1);
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
      if (!canEnterApplicationState(application.paymentStatus, input.status)) {
        auditLog("application.status_change", "failure", "admin");
        throw new TRPCError({ code: "CONFLICT", message: "Verified payment is required before operational processing" });
      }
      await withCheckoutLock(input.id, async connection => {
        const [current] = await connection.execute<RowDataPacket[]>('SELECT status,payment_status FROM applications WHERE id=?', [input.id]);
        if (!current[0] || !canEnterApplicationState(current[0].payment_status, input.status)) throw new TRPCError({ code: 'CONFLICT', message: 'Verified payment is required before operational processing' });
        await connection.execute("UPDATE applications SET status=? WHERE id=?", [input.status, input.id]);
        if (input.status === "visa_processing") await recordAuthoritySubmission(connection, input.id, "admin-session");
        const eventId = randomUUID();
        await syncCaseWorkStatus(connection, input.id, String(current[0].status), input.status, eventId);
        await enqueueApplicationStatusEmail(connection, { applicationId: input.id, from: String(current[0].status), to: input.status,
          eventId, actor: ctx.staffId ? `staff:${ctx.staffId}` : 'admin-session', actorType: 'ADMIN' });
      });
      auditLog("application.status_change", "success", "admin");
      return { success: true };
    }),

  // Full supplier assignment with VAT details
  assignSupplier: adminQuery
    .input(z.object({
      id: z.number(),
      supplierId: z.number(),
      supplierCostAed: z.number().optional(),
      supplierVatStatus: z.enum(VAT_STATUS_ENUM).optional(),
      supplierPlaceOfSupply: z.enum(PLACE_OF_SUPPLY_ENUM).optional(),
      supplierVatAmount: z.number().optional(),
      supplierTotalAed: z.number().optional(),
      supplierInvoiceNumber: z.string().optional(),
      supplierNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      try {
        const update: Partial<typeof applications.$inferInsert> = { supplierId: input.supplierId };
        // Manual accounting edits must never masquerade as an untouched automatic estimate.
        if ([input.supplierCostAed, input.supplierVatAmount, input.supplierTotalAed, input.supplierVatStatus, input.supplierPlaceOfSupply].some(value => value !== undefined)) {
          update.supplierRateId = null;
          update.supplierRateQuantity = null;
        }
        if (input.supplierCostAed !== undefined) update.supplierCostAed = String(input.supplierCostAed);
        if (input.supplierVatStatus) update.supplierVatStatus = input.supplierVatStatus;
        if (input.supplierPlaceOfSupply) update.supplierPlaceOfSupply = input.supplierPlaceOfSupply;
        if (input.supplierVatAmount !== undefined) update.supplierVatAmount = String(input.supplierVatAmount);
        if (input.supplierTotalAed !== undefined) update.supplierTotalAed = String(input.supplierTotalAed);
        if (input.supplierInvoiceNumber) update.supplierInvoiceNumber = input.supplierInvoiceNumber;
        if (input.supplierNotes) update.supplierNotes = input.supplierNotes;
        await db.update(applications).set(update).where(eq(applications.id, input.id));
        return { success: true };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error('[API] assignSupplier failed:', message);
        return internalFailure(err);
      }
    }),

  analytics: adminQuery.query(async () => {
    const db = getDb();
    const settings = await activeBusinessSettings();
    const usdToBaseRate = Number(settings.usdToBaseRate);
    const liveOnly = financialApplicationScope();
    const livePaid = and(liveOnly, eq(applications.paymentStatus, "paid"));
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(applications).where(liveOnly);
    const [paid] = await db.select({ count: sql<number>`count(*)` }).from(applications).where(livePaid);

    // Revenue in AED
    let revenueAed;
    try {
      [revenueAed] = await db.select({ total: sql<number>`coalesce(sum(total_amount_aed),0)` }).from(applications).where(livePaid);
    } catch {
      [revenueAed] = await db.select({ total: sql<number>`coalesce(sum(total_amount),0)` }).from(applications).where(livePaid);
    }

    // Costs in AED
    let costsAed;
    try {
      [costsAed] = await db.select({ total: sql<number>`coalesce(sum(supplier_cost_aed),0)` }).from(applications).where(livePaid);
    } catch {
      costsAed = { total: 0 };
    }

    const [familyCount] = await db.select({ count: sql<number>`count(*)` }).from(applications)
      .where(and(liveOnly, eq(applications.baseType, "family")));

    const revAed = Number(revenueAed?.total || 0);
    const costAed = Number(costsAed?.total || 0);
    const profitAed = revAed - costAed;

    return {
      totalApplications: total?.count || 0,
      paidApplications: paid?.count || 0,
      totalRevenueAed: revAed,
      totalRevenueUsd: settings.baseCurrency === "USD" ? revAed : revAed / usdToBaseRate,
      totalCostsAed: costAed,
      totalCostsUsd: settings.baseCurrency === "USD" ? costAed : costAed / usdToBaseRate,
      profitAed: profitAed,
      profitUsd: settings.baseCurrency === "USD" ? profitAed : profitAed / usdToBaseRate,
      profitMargin: revAed > 0 ? ((profitAed / revAed) * 100).toFixed(1) : '0',
      familyCount: familyCount?.count || 0,
    };
  }),
});
