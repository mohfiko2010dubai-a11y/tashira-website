import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { loginQuery, publicQuery } from "./middleware";
import { z } from "zod";
import {
  clearAdminSessionCookie,
  validateNewAdminPassword,
} from "./lib/admin-session";
import { TRPCError } from "@trpc/server";
import { auditLog } from "./lib/audit-log";
import { adminQuery } from "./middleware";
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { staffUsers } from "@db/schema";
import { hashPassword, verifyPassword } from "./lib/password";
import { deleteStaffSession, staffTokenFromHeaders, staffSessionCookie, revokeStaffSessions, createStaffSession } from './lib/staff-session';

export const authRouter = createRouter({
  adminLogin: loginQuery
    .input(z.object({ password: z.string().min(1).max(500) }))
    .mutation(() => {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Shared administrator sign-in is disabled. Use your named account and authenticator code.' });
    }),
  adminChangePassword: adminQuery
    .input(z.object({
      currentPassword: z.string().min(1).max(500),
      newPassword: z.string().min(1).max(500),
      confirmPassword: z.string().min(1).max(500),
    }).strict())
    .mutation(async ({ input, ctx }) => {
      if (!ctx.staffId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in with your named administrator account." });
      const [account] = await getDb().select().from(staffUsers).where(eq(staffUsers.id, ctx.staffId)).limit(1);
      if (!account || !(await verifyPassword(input.currentPassword, account.passwordHash)).valid) {
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

      await getDb().update(staffUsers).set({ passwordHash: await hashPassword(input.newPassword) }).where(eq(staffUsers.id, ctx.staffId));
      revokeStaffSessions(ctx.staffId);
      ctx.resHeaders.append("set-cookie", staffSessionCookie(ctx.req.headers, createStaffSession(ctx.staffId)));
      auditLog("admin.password_change", "success", "admin");
      return { success: true as const };
    }),
  adminMe: publicQuery.query(({ ctx }) => ({ authenticated: ctx.isAdmin || ctx.user?.role === "admin" })),
  adminLogout: publicQuery.mutation(({ ctx }) => {
    ctx.resHeaders.append("set-cookie", clearAdminSessionCookie(ctx.req.headers));
    deleteStaffSession(staffTokenFromHeaders(ctx.req.headers));
    ctx.resHeaders.append('set-cookie', staffSessionCookie(ctx.req.headers, ''));
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
