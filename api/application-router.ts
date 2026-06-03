import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, applicants, suppliers } from "@db/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

const STATUS_ENUM = ["submitted", "payment_received", "documents_pending", "documents_received", "under_review", "visa_processing", "visa_received", "completed", "rejected", "cancelled"] as const;

export const applicationRouter = createRouter({
  // Create new application
  create: publicQuery
    .input(z.object({
      referenceNumber: z.string().min(1),
      baseType: z.enum(["single", "family"]),
      residenceType: z.enum(["non-gcc", "gcc-resident", "non-gcc-accompany", "gcc-accompany"]),
      visaType: z.string(),
      processingType: z.enum(["regular", "express"]),
      contactEmail: z.string().email(),
      contactPhone: z.string(),
      arrivalDate: z.string().optional(),
      totalAmount: z.number(),
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
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const [app] = await db.insert(applications).values({
          referenceNumber: input.referenceNumber,
          baseType: input.baseType,
          residenceType: input.residenceType,
          visaType: input.visaType,
          processingType: input.processingType,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          arrivalDate: input.arrivalDate,
          totalAmount: String(input.totalAmount),
        }).$returningId();

        const appId = app.id;
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
        }
        return { id: appId, referenceNumber: input.referenceNumber };
      } catch (err: any) {
        console.error('[API ERROR] Application create failed:', err.message, err.stack);
        throw new Error(`Database error: ${err.message}`);
      }
    }),

  // Get application by reference number
  getByReference: publicQuery
    .input(z.object({ referenceNumber: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [app] = await db.select().from(applications)
        .where(eq(applications.referenceNumber, input.referenceNumber))
        .limit(1);
      if (!app) return null;
      const applicantList = await db.select().from(applicants)
        .where(eq(applicants.applicationId, app.id));
      // Get supplier info if exists
      let supplier = null;
      if (app.supplierId) {
        const [s] = await db.select().from(suppliers)
          .where(eq(suppliers.id, app.supplierId))
          .limit(1);
        supplier = s || null;
      }
      return { ...app, applicants: applicantList, supplier };
    }),

  // List all applications with date filter + supplier info
  list: publicQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;

      let query = db.select().from(applications);

      // Apply filters
      const conditions = [];
      if (input?.status) {
        conditions.push(eq(applications.status, input.status as any));
      }
      if (input?.dateFrom) {
        conditions.push(gte(applications.createdAt, new Date(input.dateFrom)));
      }
      if (input?.dateTo) {
        conditions.push(lte(applications.createdAt, new Date(input.dateTo)));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const allApps = await query.orderBy(desc(applications.createdAt)).limit(limit).offset(offset);

      // Get applicants + supplier for each
      const appsWithData = await Promise.all(
        allApps.map(async (app) => {
          const applicantList = await db.select().from(applicants)
            .where(eq(applicants.applicationId, app.id));
          let supplier = null;
          if (app.supplierId) {
            const [s] = await db.select().from(suppliers)
              .where(eq(suppliers.id, app.supplierId))
              .limit(1);
            supplier = s || null;
          }
          return { ...app, applicants: applicantList, supplier };
        })
      );

      return appsWithData;
    }),

  // Update application status
  updateStatus: publicQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(STATUS_ENUM),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(applications).set({ status: input.status })
        .where(eq(applications.id, input.id));
      return { success: true };
    }),

  // Assign supplier to application
  assignSupplier: publicQuery
    .input(z.object({
      id: z.number(),
      supplierId: z.number(),
      supplierCost: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const updateData: any = { supplierId: input.supplierId };
      if (input.supplierCost !== undefined) {
        updateData.supplierCost = String(input.supplierCost);
      }
      await db.update(applications).set(updateData)
        .where(eq(applications.id, input.id));
      return { success: true };
    }),

  // Analytics
  analytics: publicQuery.query(async () => {
    const db = getDb();
    const total = await db.select({ count: sql<number>`count(*)` }).from(applications);
    const paid = await db.select({ count: sql<number>`count(*)` }).from(applications).where(eq(applications.paymentStatus, "paid"));
    const revenue = await db.select({ total: sql<number>`coalesce(sum(total_amount), 0)` }).from(applications).where(eq(applications.paymentStatus, "paid"));
    const costs = await db.select({ total: sql<number>`coalesce(sum(supplier_cost), 0)` }).from(applications).where(eq(applications.paymentStatus, "paid"));

    return {
      totalApplications: total[0]?.count || 0,
      paidApplications: paid[0]?.count || 0,
      totalRevenue: revenue[0]?.total || 0,
      totalCosts: costs[0]?.total || 0,
      profit: (revenue[0]?.total || 0) - (costs[0]?.total || 0),
    };
  }),
});
