import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { applicationAccessQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { applicants, applications, applicationSupplements, applicationSupportingDocuments, documents } from "@db/schema";
import { MAX_ADDITIONAL_NOTES_LENGTH, mayAddSupportingDocument } from "../contracts/application-supplements";
import { assertApplicationIdAccess } from "./lib/application-access";
import { recordTimelineEvent } from "./lib/application-timeline";

const owned = z.object({ applicationId: z.number().int().positive() });
export const applicationSupplementsRouter = createRouter({
  get: applicationAccessQuery.input(owned).query(async ({ input, ctx }) => {
    await assertApplicationIdAccess(ctx, input.applicationId);
    const db = getDb();
    const [notes] = await db.select().from(applicationSupplements).where(eq(applicationSupplements.applicationId, input.applicationId));
    const files = await db.select({ id: documents.id, name: documents.originalFileName }).from(applicationSupportingDocuments)
      .innerJoin(documents, eq(documents.id, applicationSupportingDocuments.documentId))
      .where(eq(applicationSupportingDocuments.applicationId, input.applicationId));
    const sponsors = await db.select({ applicantId: applicants.id, name: applicants.sponsorName, relation: applicants.sponsorRelation }).from(applicants)
      .where(eq(applicants.applicationId, input.applicationId));
    return { notes: notes?.additionalNotes ?? "", files, sponsors };
  }),
  saveNotes: applicationAccessQuery.input(owned.extend({ notes: z.string().max(MAX_ADDITIONAL_NOTES_LENGTH) })).mutation(async ({ input, ctx }) => {
    await assertApplicationIdAccess(ctx, input.applicationId);
    await getDb().insert(applicationSupplements).values({ applicationId: input.applicationId, additionalNotes: input.notes })
      .onDuplicateKeyUpdate({ set: { additionalNotes: input.notes, updatedAt: new Date() } });
    return { saved: true };
  }),
  saveSponsor: applicationAccessQuery.input(owned.extend({ name: z.string().trim().min(1).max(255), relation: z.string().trim().min(1).max(50) })).mutation(async ({ input, ctx }) => {
    await assertApplicationIdAccess(ctx, input.applicationId);
    await getDb().transaction(async tx => {
      const [app] = await tx.select().from(applications).where(eq(applications.id, input.applicationId)).for("update");
      if (app?.residenceType !== "gcc-accompany") throw new TRPCError({ code: "BAD_REQUEST", message: "Sponsor details apply only to GCC accompanying applications." });
      await tx.update(applicants).set({ sponsorName: input.name, sponsorRelation: input.relation }).where(eq(applicants.applicationId, input.applicationId));
    });
    await recordTimelineEvent({ applicationId: input.applicationId, eventName: "APPLICANT_UPDATED", eventSource: "APPLICATION_SUPPLEMENTS", actorType: ctx.isAdmin ? "ADMIN" : ctx.staffId ? "STAFF" : "CUSTOMER", summary: "Sponsor details updated" });
    return { saved: true };
  }),
  linkDocument: applicationAccessQuery.input(owned.extend({ documentId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    await assertApplicationIdAccess(ctx, input.applicationId);
    await getDb().transaction(async tx => {
      await tx.select({ id: applications.id }).from(applications).where(eq(applications.id, input.applicationId)).for("update");
      const [file] = await tx.select().from(documents).where(and(eq(documents.id, input.documentId), eq(documents.applicationId, input.applicationId), eq(documents.documentType, "supporting"), eq(documents.uploadStatus, "uploaded")));
      if (!file) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a supporting file uploaded to this application." });
      const existing = await tx.select().from(applicationSupportingDocuments).where(eq(applicationSupportingDocuments.applicationId, input.applicationId));
      const linked = existing.some(item => item.documentId === input.documentId);
      if (!mayAddSupportingDocument(existing.length, linked)) throw new TRPCError({ code: "BAD_REQUEST", message: "Six optional supporting files are already saved. Continue with your application." });
      if (!linked) await tx.insert(applicationSupportingDocuments).values(input);
    });
    return { saved: true };
  }),
});
