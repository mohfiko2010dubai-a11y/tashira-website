import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { applications } from "@db/schema";

export const wizardRouter = createRouter({
  submitApplication: publicQuery
    .input(z.object({
      referenceNumber: z.string(),
      fullName: z.string().min(1),
      nationality: z.string().min(1),
      passportNumber: z.string().min(1),
      passportExpiry: z.string(),
      profession: z.string().min(1),
      countryFrom: z.string().min(1),
      arrivalDate: z.string(),
      email: z.string().email(),
      phone: z.string().min(1),
      visaType: z.string().min(1),
      processingType: z.string().min(1),
      residenceStatus: z.string().min(1),
      whoTraveling: z.string().min(1),
      applicantCount: z.number().min(1),
      totalAmount: z.number().min(0),
    }))
    .mutation(async ({ input }) => {
      try {
        const db = getDb();
        const exchangeRate = 3.6725;
        const totalAed = input.totalAmount * exchangeRate;

        await db.insert(applications).values({
        referenceNumber: input.referenceNumber,
        baseType: input.applicantCount > 1 ? "multiple" : "single",
        residenceType: input.residenceStatus.toLowerCase().includes("gcc citizen with") ? "gcc-accompany" :
          input.residenceStatus.toLowerCase().includes("accompanying gcc") ? "non-gcc-accompany" :
          input.residenceStatus.toLowerCase().includes("gcc") ? "gcc-resident" : "non-gcc",
        visaType: input.visaType,
        processingType: input.processingType.toLowerCase(),
        totalApplicants: input.applicantCount,
        contactEmail: input.email,
        contactPhone: input.phone,
        totalAmountAed: String(totalAed),
        totalAmountUsd: String(input.totalAmount),
        exchangeRate: String(exchangeRate),
        status: "documents_pending",
        paymentStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

        return { success: true, referenceNumber: input.referenceNumber };
      } catch (error: any) {
        console.error("[Wizard] Failed to save application:", error.message);
        throw new Error(`Failed to save application: ${error.message}`);
      }
    }),
});
