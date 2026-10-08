import { z } from "zod";
import { adminQuery, createRouter, loginQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { staffUsers } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";
import { createStaffSession, deleteStaffSession, getStaffSession, revokeStaffSessions, staffSessionCookie, staffTokenFromHeaders } from "./lib/staff-session";
import { revokeMfaChallenges } from "./lib/staff-mfa";
import { TRPCError } from '@trpc/server';
import { auditLog } from "./lib/audit-log";
import { hashPassword, verifyPassword } from "./lib/password";
import { completeStaffSetup } from './lib/staff-setup';
import { recordNamedAdminVerification } from './lib/staff-auth-transition';

async function saveStaffChanges(id: number, update: Partial<typeof staffUsers.$inferInsert>) {
  await getDb().transaction(async tx => {
    const admins = await tx.select({ id: staffUsers.id, active: staffUsers.isActive }).from(staffUsers).where(eq(staffUsers.role, 'admin')).for('update');
    if (update.isActive === 'inactive' && admins.some(account => account.id === id && account.active === 'active') && admins.filter(account => account.active === 'active').length <= 1) {
      throw new TRPCError({ code: 'CONFLICT', message: 'This is the last active administrator. Create and verify another named administrator before deactivating this account.' });
    }
    await tx.update(staffUsers).set(update).where(eq(staffUsers.id, id));
  });
  revokeStaffSessions(id); revokeMfaChallenges(id);
}

export const staffRouter = createRouter({
  completeSetup: loginQuery.input(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(500) }).strict())
    .mutation(({ input }) => completeStaffSetup(input.token, input.password)),
  // Named staff login - issues an HttpOnly session cookie.
  login: loginQuery
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const [staff] = await db
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.username, input.username))
        .limit(1);

      if (!staff || staff.isActive !== "active") {
        auditLog("staff.login", "failure", "anonymous");
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'The username or password is incorrect. Check your details and try again.' });
      }

      const passwordResult = await verifyPassword(input.password, staff.passwordHash);
      if (!passwordResult.valid) {
        auditLog("staff.login", "failure", "anonymous");
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'The username or password is incorrect. Check your details and try again.' });
      }
      let currentHash = staff.passwordHash;
      if (passwordResult.needsUpgrade) {
        currentHash = await hashPassword(input.password);
        await db.update(staffUsers)
          .set({ passwordHash: currentHash })
          .where(eq(staffUsers.id, staff.id));
      }

      // Owner-approved password-only named-account sign-in (8 October 2026).
      const [active] = await db.select({ id: staffUsers.id }).from(staffUsers)
        .where(and(eq(staffUsers.id, staff.id), eq(staffUsers.isActive, 'active'), eq(staffUsers.passwordHash, currentHash))).limit(1);
      if (!active) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Your account changed during sign-in. Sign in again with your current details.' });
      await recordNamedAdminVerification(staff.id, staff.role);
      const token = createStaffSession(staff.id);
      ctx.resHeaders.append('set-cookie', staffSessionCookie(ctx.req.headers, token));
      auditLog('staff.login', 'success', `staff:${staff.id}`);
      return { staff: { id: staff.id, username: staff.username, name: staff.name, email: staff.email, phone: staff.phone, role: staff.role } };
    }),

  // Verify token - returns staff info
  verify: publicQuery
    .query(async ({ ctx }) => {
      const token = staffTokenFromHeaders(ctx.req.headers);
      const session = getStaffSession(token);
      if (!session) {
        return null;
      }

      const db = getDb();
      const [staff] = await db
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.id, session.staffId))
        .limit(1);

      if (!staff || staff.isActive !== "active") {
        deleteStaffSession(token);
        return null;
      }

      return {
        id: staff.id,
        username: staff.username,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
      };
    }),

  // Logout
  logout: publicQuery
    .mutation(({ ctx }) => {
      const hadSession = getStaffSession(staffTokenFromHeaders(ctx.req.headers)) !== null;
      deleteStaffSession(staffTokenFromHeaders(ctx.req.headers));
      ctx.resHeaders.append('set-cookie', staffSessionCookie(ctx.req.headers, ''));
      auditLog("staff.logout", "success", hadSession ? "staff" : "anonymous");
      return { success: true };
    }),

  // Admin-only: list all staff
  list: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: staffUsers.id,
        username: staffUsers.username,
        name: staffUsers.name,
        email: staffUsers.email,
        phone: staffUsers.phone,
        isActive: staffUsers.isActive,
        role: staffUsers.role,
        createdAt: staffUsers.createdAt,
        updatedAt: staffUsers.updatedAt,
      })
      .from(staffUsers)
      .orderBy(desc(staffUsers.createdAt));
  }),

  // Admin-only: create staff user
  create: adminQuery
    .input(
      z.object({
        username: z.string().min(3).max(100),
        password: z.string().min(12).max(500),
        role: z.enum(['staff', 'admin']).default('staff'),
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const passwordHash = await hashPassword(input.password);

      const [result] = await db.insert(staffUsers).values({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        role: input.role,
      });

      return { id: Number(result.insertId), success: true };
    }),

  // Admin-only: update staff user
  update: adminQuery
    .input(
      z.object({
        id: z.number(),
        username: z.string().min(3).max(100),
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        isActive: z.enum(["active", "inactive"]).optional(),
        password: z.union([z.literal(''), z.string().min(12).max(500)]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const update: Partial<typeof staffUsers.$inferInsert> = {
        username: input.username,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
      };
      if (input.isActive) update.isActive = input.isActive;
      if (input.password) {
        update.passwordHash = await hashPassword(input.password);
      }

      await saveStaffChanges(input.id, update);
      return { success: true };
    }),

  // Retain identities referenced by audit records. This legacy API now deactivates.
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await saveStaffChanges(input.id, { isActive: 'inactive' });
      return { success: true };
    }),
});
