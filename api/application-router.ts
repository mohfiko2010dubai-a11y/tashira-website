import { z } from "zod";
import { adminQuery, applicationAccessQuery, applicationSubmissionQuery, createRouter, staffOrAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, applicants, suppliers } from "@db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";
import { getErrorMessage } from "./lib/errors";
import { auditLog } from "./lib/audit-log";
import { assertApplicationReferenceAccess } from "./lib/application-access";
import { createCustomerApplicationCookie } from "./lib/customer-session";
import { recordTimelineEvent, type TimelineEventName } from "./lib/application-timeline";
import { TERMS_POLICY_VERSION } from "@contracts/constants";

const STATUS_ENUM = ["submitted","payment_received","documents_pending","documents_received","under_review","visa_processing","visa_received","completed","rejected","cancelled"] as const;
const VAT_STATUS_ENUM = ["standard", "zero_rated", "exempt", "out_of_scope"] as const;
const PLACE_OF_SUPPLY_ENUM = ["within_uae", "outside_uae"] as const;

export const applicationRouter = createRouter({
  create: applicationSubmissionQuery
    .input(z.object({
      referenceNumber: z.string().min(1),
      baseType: z.enum(["single", "family"]),
      residenceType: z.enum(["non-gcc", "gcc-resident", "non-gcc-accompany", "gcc-accompany"]),
      visaType: z.string(),
      processingType: z.enum(["regular", "express"]),
      contactEmail: z.string().email(),
      contactPhone: z.string(),
      arrivalDate: z.string().optional(),
      exchangeRate: z.number().default(3.6725),
      totalAmountUsd: z.number(),
      totalAmountAed: z.number().optional(),
      policyVersion: z.literal(TERMS_POLICY_VERSION),
      applicants: z.array(z.object({
        fullName: z.string(),
        nationality: z.string().optional(),
        passportNumber: z.string().optional(),
        passportType: z.string().optional(),
        travelingFrom: z.string().optional(),
        passportExpiry: z.string().optional(),
        profession: z.string().optional(),
        gccResidenceNumber: z.string().optional(),
        gccResidenceCountry: z.string().optional(),
        sponsorName: z.string().optional(),
        sponsorRelation: z.string().optional(),
      })),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = getDb();
        const values: typeof applications.$inferInsert = {
          referenceNumber: input.referenceNumber,
          baseType: input.baseType,
          residenceType: input.residenceType,
          visaType: input.visaType,
          processingType: input.processingType,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          arrivalDate: input.arrivalDate,
          exchangeRate: String(input.exchangeRate),
          totalAmountUsd: String(input.totalAmountUsd),
          totalAmountAed: String(input.totalAmountAed || (input.totalAmountUsd * input.exchangeRate)),
        };

        const [app] = await db.insert(applications).values(values).$returningId();

        const appId = app.id;
        await recordTimelineEvent({
          applicationId: appId,
          eventName: "APPLICATION_CREATED",
          eventSource: "APPLICATION_API",
          actorType: "CUSTOMER",
          summary: "Application created",
        });
        await recordTimelineEvent({
          applicationId: appId,
          eventName: "POLICY_ACCEPTED",
          eventSource: "APPLICATION_API",
          actorType: "CUSTOMER",
          policyVersion: input.policyVersion,
          summary: "Terms policy accepted",
        });
        for (let i = 0; i < input.applicants.length; i++) {
          const a = input.applicants[i];
          await db.insert(applicants).values({
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
          });
          await recordTimelineEvent({
            applicationId: appId,
            eventName: "APPLICANT_ADDED",
            eventSource: "APPLICATION_API",
            actorType: "CUSTOMER",
            actorReference: `applicant:${i}`,
            summary: `Applicant ${i + 1} added`,
          });
        }
        await recordTimelineEvent({
          applicationId: appId,
          eventName: "APPLICATION_SUBMITTED",
          eventSource: "APPLICATION_API",
          actorType: "CUSTOMER",
          resultingState: "submitted",
          summary: "Application submitted",
        });
        ctx.resHeaders.append("set-cookie", createCustomerApplicationCookie(ctx.req.headers, input.referenceNumber));
        return { id: appId, referenceNumber: input.referenceNumber };
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        console.error('[API ERROR]', message);
        throw new Error(`Database error: ${message}`);
      }
    }),

  getByReference: applicationAccessQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input, ctx }) => {
      assertApplicationReferenceAccess(ctx, input.referenceNumber);
      const db = getDb();
      const [app] = await db.select().from(applications)
        .where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      if (!app) return null;
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
      return { ...app, applicants: applicantList, supplier };
    }),

  list: staffOrAdminQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(STATUS_ENUM).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;

      const conditions = [];

      if (input?.status) conditions.push(eq(applications.status, input.status));
      if (input?.dateFrom) conditions.push(gte(applications.createdAt, new Date(input.dateFrom)));
      if (input?.dateTo) conditions.push(lte(applications.createdAt, new Date(input.dateTo + 'T23:59:59')));

      const query = db.select().from(applications);
      const allApps = conditions.length > 0
        ? await query.where(and(...conditions)).orderBy(desc(applications.createdAt)).limit(limit).offset(offset)
        : await query.orderBy(desc(applications.createdAt)).limit(limit).offset(offset);

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
        return { ...app, applicants: applicantList, supplier };
      }));

      return result;
    }),

  updateStatus: adminQuery
    .input(z.object({ id: z.number(), status: z.enum(STATUS_ENUM) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(applications).set({ status: input.status }).where(eq(applications.id, input.id));
      const eventByStatus: Partial<Record<typeof input.status, TimelineEventName>> = {
        visa_processing: "GOVERNMENT_PROCESSING",
        visa_received: "VISA_ISSUED",
        completed: "APPLICATION_COMPLETED",
        cancelled: "APPLICATION_CANCELLED",
        rejected: "APPLICATION_REJECTED",
      };
      const eventName = eventByStatus[input.status];
      if (eventName) {
        await recordTimelineEvent({
          applicationId: input.id,
          eventName,
          eventSource: "ADMIN_STATUS",
          actorType: "ADMIN",
          actorReference: "admin",
          resultingState: input.status,
          summary: `Application status changed to ${input.status}`,
        });
      }
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
        return { success: false, error: message };
      }
    }),

  analytics: adminQuery.query(async () => {
    const db = getDb();
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(applications);
    const [paid] = await db.select({ count: sql<number>`count(*)` }).from(applications).where(eq(applications.paymentStatus, "paid"));

    // Revenue in AED
    let revenueAed;
    try {
      [revenueAed] = await db.select({ total: sql<number>`coalesce(sum(total_amount_aed),0)` }).from(applications).where(eq(applications.paymentStatus, "paid"));
    } catch {
      [revenueAed] = await db.select({ total: sql<number>`coalesce(sum(total_amount),0)` }).from(applications).where(eq(applications.paymentStatus, "paid"));
    }

    // Costs in AED
    let costsAed;
    try {
      [costsAed] = await db.select({ total: sql<number>`coalesce(sum(supplier_cost_aed),0)` }).from(applications).where(eq(applications.paymentStatus, "paid"));
    } catch {
      costsAed = { total: 0 };
    }

    const [familyCount] = await db.select({ count: sql<number>`count(*)` }).from(applications).where(eq(applications.baseType, "family"));

    const revAed = Number(revenueAed?.total || 0);
    const costAed = Number(costsAed?.total || 0);
    const profitAed = revAed - costAed;

    return {
      totalApplications: total?.count || 0,
      paidApplications: paid?.count || 0,
      totalRevenueAed: revAed,
      totalRevenueUsd: revAed / 3.6725,
      totalCostsAed: costAed,
      totalCostsUsd: costAed / 3.6725,
      profitAed: profitAed,
      profitUsd: profitAed / 3.6725,
      profitMargin: revAed > 0 ? ((profitAed / revAed) * 100).toFixed(1) : '0',
      familyCount: familyCount?.count || 0,
    };
  }),
});
