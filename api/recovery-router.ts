import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { applications, customerRecoveryChallenges, outboundEmailEvents } from "@db/schema";
import { createRouter, recoveryRequestQuery, recoveryVerifyQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { createCustomerApplicationCookie } from "./lib/customer-session";
import { auditLog } from "./lib/audit-log";
import { createRecoveryChallenge, hashRecoveryValue, recoveryExpiry, recoveryVerificationDecision, verifyRecoverySecret } from "./lib/customer-recovery";
import { transactionalEmailProvider } from "./lib/email-provider";
import { recipientHash } from "./lib/resend-email";
import { publicAppOrigin } from "./lib/public-app-url";

const genericResponse = { accepted: true, message: "If a matching application exists, recovery instructions will be sent." };

export const recoveryRouter = createRouter({
  request: recoveryRequestQuery
    .input(z.object({ email: z.string().email(), channel: z.enum(["MAGIC_LINK", "EMAIL_OTP"]) }))
    .mutation(async ({ input }) => {
      const email = input.email.trim().toLowerCase();
      const db = getDb();
      const [application] = await db.select({ id: applications.id, referenceNumber: applications.referenceNumber })
        .from(applications).where(eq(applications.contactEmail, email)).orderBy(desc(applications.updatedAt)).limit(1);
      if (!application) {
        auditLog("customer.recovery_requested", "success", "anonymous");
        return genericResponse;
      }

      const challenge = createRecoveryChallenge(input.channel, email);
      const expiresAt = recoveryExpiry(input.channel);
      await db.insert(customerRecoveryChallenges).values({
        id: challenge.id,
        applicationId: application.id,
        channel: input.channel,
        tokenHash: challenge.tokenHash,
        destinationHash: challenge.destinationHash,
        expiresAt,
      });

      const provider = transactionalEmailProvider();
      const template = input.channel === "MAGIC_LINK" ? "RESUME_LINK" : "RECOVERY_OTP";
      const variables: Record<string, string> = input.channel === "MAGIC_LINK"
        ? { referenceNumber: application.referenceNumber, resumeUrl: `${publicAppOrigin()}/recover?token=${encodeURIComponent(challenge.secret)}` }
        : { referenceNumber: application.referenceNumber, otp: challenge.secret, expiresMinutes: "10" };
      try {
        const sent = await provider.send({ recipient: email, template, variables, idempotencyKey: `recovery/${challenge.id}` });
        await db.insert(outboundEmailEvents).values({
          id: randomUUID(), applicationId: application.id, template, recipientHash: recipientHash(email),
          provider: provider.name, status: "SENT", providerReference: sent.reference,
        });
      } catch {
        await db.insert(outboundEmailEvents).values({
          id: randomUUID(), applicationId: application.id, template, recipientHash: recipientHash(email),
          provider: provider.name, status: "FAILED", failureCategory: "delivery_failed",
        });
      }
      auditLog("customer.recovery_requested", "success", "anonymous");
      return genericResponse;
    }),

  verify: recoveryVerifyQuery
    .input(z.object({ secret: z.string().min(6).max(200), email: z.string().email().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const tokenHash = hashRecoveryValue(input.secret);
      const [challenge] = await db.select().from(customerRecoveryChallenges)
        .where(eq(customerRecoveryChallenges.tokenHash, tokenHash)).limit(1);
      if (!challenge) {
        auditLog("customer.recovery_verified", "failure", "anonymous");
        return { authenticated: false as const, reason: "INVALID" as const };
      }
      const destinationMatches = input.email
        ? challenge.destinationHash === hashRecoveryValue(input.email.trim().toLowerCase())
        : challenge.channel === "MAGIC_LINK";
      const decision = recoveryVerificationDecision(challenge, destinationMatches && verifyRecoverySecret(input.secret, challenge.tokenHash));
      if (decision !== "ACCEPT") {
        if (decision === "INVALID") {
          await db.update(customerRecoveryChallenges).set({ attemptCount: challenge.attemptCount + 1 })
            .where(eq(customerRecoveryChallenges.id, challenge.id));
        }
        auditLog("customer.recovery_verified", "failure", "anonymous");
        return { authenticated: false as const, reason: decision };
      }
      const [application] = await db.select({ referenceNumber: applications.referenceNumber }).from(applications)
        .where(and(eq(applications.id, challenge.applicationId))).limit(1);
      if (!application) return { authenticated: false as const, reason: "INVALID" as const };
      await db.update(customerRecoveryChallenges).set({ consumedAt: new Date() })
        .where(eq(customerRecoveryChallenges.id, challenge.id));
      ctx.resHeaders.append("set-cookie", createCustomerApplicationCookie(ctx.req.headers, application.referenceNumber));
      auditLog("customer.recovery_verified", "success", "customer");
      return { authenticated: true as const, referenceNumber: application.referenceNumber };
    }),
});
