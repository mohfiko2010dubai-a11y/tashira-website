import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications, applicants } from "@db/schema";
import { eq, desc, sql } from "drizzle-orm";

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
        
        // Insert application
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

      // Insert applicants
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
      const [app] = await db.select().from(applications).where(eq(applications.referenceNumber, input.referenceNumber)).limit(1);
      
      if (!app) return null;

      const applicantList = await db.select().from(applicants).where(eq(applicants.applicationId, app.id));

      return { ...app, applicants: applicantList };
    }),

  // List all applications (for admin dashboard)
  list: publicQuery
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["submitted", "under_review", "approved", "issued", "rejected"]).optional(),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const status = input?.status;
      const limit = input?.limit || 50;
      const offset = input?.offset || 0;

      let query = db.select().from(applications);

      if (status) {
        query = query.where(eq(applications.status, status)) as any;
      }

      const allApps = await query.orderBy(desc(applications.createdAt)).limit(limit).offset(offset);

      // Get applicants for each
      const appsWithApplicants = await Promise.all(
        allApps.map(async (app) => {
          const applicantList = await db.select().from(applicants).where(eq(applicants.applicationId, app.id));
          return { ...app, applicants: applicantList };
        })
      );

      return appsWithApplicants;
    }),

  // Update application status
  updateStatus: publicQuery
    .input(z.object({
      id: z.number(),
      status: z.enum(["submitted", "under_review", "approved", "issued", "rejected"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(applications).set({ status: input.status }).where(eq(applications.id, input.id));
      return { success: true };
    }),

  // Analytics
  analytics: publicQuery.query(async () => {
    const db = getDb();
    
    const total = await db.select({ count: sql<number>`count(*)` }).from(applications);
    const pending = await db.select({ count: sql<number>`count(*)` }).from(applications).where(eq(applications.status, "submitted"));
    const approved = await db.select({ count: sql<number>`count(*)` }).from(applications).where(eq(applications.status, "approved"));
    const revenue = await db.select({ total: sql<number>`coalesce(sum(total_amount), 0)` }).from(applications).where(eq(applications.paymentStatus, "paid"));

    return {
      totalApplications: total[0]?.count || 0,
      pendingApplications: pending[0]?.count || 0,
      approvedApplications: approved[0]?.count || 0,
      totalRevenue: revenue[0]?.total || 0,
    };
  }),
});
