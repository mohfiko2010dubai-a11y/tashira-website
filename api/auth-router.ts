import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { loginQuery, publicQuery } from "./middleware";
import { z } from "zod";
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  getAdminSessionEpoch,
  hashAdminPassword,
  validateNewAdminPassword,
  verifyAdminPasswordAsync,
} from "./lib/admin-session";
import { TRPCError } from "@trpc/server";
import { auditLog } from "./lib/audit-log";
import { adminQuery } from "./middleware";
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { adminSecuritySettings } from "@db/schema";

export const authRouter = createRouter({
  adminLogin: loginQuery
    .input(z.object({ password: z.string().min(1).max(500) }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (!(await verifyAdminPasswordAsync(input.password))) {
          auditLog("admin.login", "failure", "anonymous");
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        const epoch = await getAdminSessionEpoch();
        ctx.resHeaders.append("set-cookie", createAdminSessionCookie(ctx.req.headers, epoch));
        auditLog("admin.login", "success", "admin");
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        auditLog("admin.login", "failure", "anonymous");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Admin authentication is not configured" });
      }
    }),
  adminChangePassword: adminQuery
    .input(z.object({
      currentPassword: z.string().min(1).max(500),
      newPassword: z.string().min(1).max(500),
      confirmPassword: z.string().min(1).max(500),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      if (!(await verifyAdminPasswordAsync(input.currentPassword))) {
        auditLog("admin.password_change", "failure", "admin");
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }
      if (input.newPassword !== input.confirmPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "New password and confirmation do not match" });
      }
      const policyError = validateNewAdminPassword(input.newPassword);
      if (policyError) throw new TRPCError({ code: "BAD_REQUEST", message: policyError });
      if (input.newPassword === input.currentPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "New password must differ from the current password" });
      }

      const newHash = hashAdminPassword(input.newPassword);
      const newEpoch = await getDb().transaction(async (tx) => {
        const rows = await tx.select({ id: adminSecuritySettings.id, sessionEpoch: adminSecuritySettings.sessionEpoch })
          .from(adminSecuritySettings).limit(1);
        const epoch = (rows[0]?.sessionEpoch ?? 1) + 1;
        if (rows[0]) {
          await tx.update(adminSecuritySettings)
            .set({ passwordHash: newHash, sessionEpoch: epoch, updatedBy: "admin-ui" })
            .where(eq(adminSecuritySettings.id, rows[0].id));
        } else {
          await tx.insert(adminSecuritySettings).values({ passwordHash: newHash, sessionEpoch: epoch, updatedBy: "admin-ui" });
        }
        return epoch;
      });
      // Keep the current session signed in under the new epoch; every other
      // admin session (older epoch) is now invalid.
      ctx.resHeaders.append("set-cookie", createAdminSessionCookie(ctx.req.headers, newEpoch));
      auditLog("admin.password_change", "success", "admin");
      return { success: true as const };
    }),
  adminMe: publicQuery.query(({ ctx }) => ({ authenticated: ctx.isAdmin || ctx.user?.role === "admin" })),
  adminLogout: publicQuery.mutation(({ ctx }) => {
    ctx.resHeaders.append("set-cookie", clearAdminSessionCookie(ctx.req.headers));
    auditLog("admin.logout", "success", ctx.isAdmin ? "admin" : "anonymous");
    return { success: true };
  }),
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
