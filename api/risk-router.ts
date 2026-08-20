import { randomUUID } from "crypto";
import { z } from "zod";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { applicants, applicationRiskAssessments, applications, applicationTimelineEvents } from "@db/schema";
import { adminQuery, createRouter, staffOrAdminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { assessRisk } from "./lib/risk-engine";

async function applicationId(referenceNumber: string) {
  const [application] = await getDb().select({ id: applications.id }).from(applications)
    .where(eq(applications.referenceNumber, referenceNumber)).limit(1);
  if (!application) throw new Error("Application not found");
  return application.id;
}

async function eventCount(id: number, eventName: string, since?: Date) {
  const conditions = [eq(applicationTimelineEvents.applicationId, id), eq(applicationTimelineEvents.eventName, eventName)];
  if (since) conditions.push(gte(applicationTimelineEvents.createdAt, since));
  const [result] = await getDb().select({ value: count() }).from(applicationTimelineEvents).where(and(...conditions));
  return Number(result?.value ?? 0);
}

export const riskRouter = createRouter({
  latest: staffOrAdminQuery.input(z.object({ referenceNumber: z.string().min(1) })).query(async ({ input }) => {
    const id = await applicationId(input.referenceNumber);
    const [assessment] = await getDb().select().from(applicationRiskAssessments)
      .where(eq(applicationRiskAssessments.applicationId, id)).orderBy(desc(applicationRiskAssessments.createdAt)).limit(1);
    return assessment ? { ...assessment, factors: JSON.parse(assessment.factorsJson) as unknown[] } : null;
  }),

  assess: adminQuery.input(z.object({ referenceNumber: z.string().min(1) })).mutation(async ({ input }) => {
    const id = await applicationId(input.referenceNumber);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000);
    const [retries, failures, velocityEvents, applicantRows] = await Promise.all([
      eventCount(id, "PAYMENT_RETRIED"),
      eventCount(id, "PAYMENT_FAILED"),
      eventCount(id, "PAYMENT_STARTED", tenMinutesAgo),
      getDb().select({ value: count() }).from(applicants).where(eq(applicants.applicationId, id)),
    ]);
    // Device/IP changes remain zero until a reviewed, privacy-safe trusted-device signal exists.
    const result = assessRisk({
      retries,
      failures,
      velocityEvents: Math.max(0, velocityEvents - 1),
      applicantCount: Number(applicantRows[0]?.value ?? 0),
      deviceChanges: 0,
      ipChanges: 0,
    });
    const assessmentId = randomUUID();
    await getDb().insert(applicationRiskAssessments).values({
      id: assessmentId,
      applicationId: id,
      level: result.level,
      score: result.score,
      factorsJson: JSON.stringify(result.factors),
      modelVersion: result.modelVersion,
    });
    return { id: assessmentId, ...result, automatedDecision: false as const };
  }),
});
