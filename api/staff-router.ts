import { z } from "zod";
import { adminQuery, createRouter, loginQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { staffUsers } from "@db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { createStaffSession, deleteStaffSession, getStaffSession, revokeStaffSessions, staffSessionCookie, staffTokenFromHeaders } from "./lib/staff-session";
import { createMfaChallenge, consumeMfaAttempt, deleteMfaChallenge, revokeMfaChallenges, newTotpSecret, verifyTotp } from "./lib/staff-mfa";
import { encryptStaffMfaSecret, decryptStaffMfaSecret } from "./lib/admin-session";
import { TRPCError } from '@trpc/server';
import { auditLog } from "./lib/audit-log";
import { hashPassword, verifyPassword } from "./lib/password";

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
  // Staff login - returns token
  login: loginQuery
    .input(
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [staff] = await db
        .select()
        .from(staffUsers)
        .where(eq(staffUsers.username, input.username))
        .limit(1);

      if (!staff || staff.isActive !== "active") {
        auditLog("staff.login", "failure", "anonymous");
        throw new Error("Invalid username or password");
      }

      const passwordResult = await verifyPassword(input.password, staff.passwordHash);
      if (!passwordResult.valid) {
        auditLog("staff.login", "failure", "anonymous");
        throw new Error("Invalid username or password");
      }
      let currentHash = staff.passwordHash;
      if (passwordResult.needsUpgrade) {
        currentHash = await hashPassword(input.password);
        await db.update(staffUsers)
          .set({ passwordHash: currentHash })
          .where(eq(staffUsers.id, staff.id));
      }

      const enrolling = !staff.mfaSecret;
      const secret = staff.mfaSecret ? decryptStaffMfaSecret(staff.mfaSecret) : newTotpSecret();
      return {
        challenge: createMfaChallenge({ staffId: staff.id, secret, enrolling, passwordHash: currentHash }),
        setupSecret: enrolling ? secret : null,
      };
    }),

  completeLogin: loginQuery.input(z.object({ challenge: z.string().length(64), code: z.string().regex(/^\d{6}$/) }).strict())
    .mutation(async ({ input, ctx }) => {
      const challenge = consumeMfaAttempt(input.challenge);
      const reject = () => new TRPCError({ code: 'UNAUTHORIZED', message: 'The authenticator code or sign-in session is invalid. Check the current code, or sign in again.' });
      if (!challenge) throw reject();
      const db = getDb();
      const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, challenge.staffId)).limit(1);
      if (!staff || staff.isActive !== 'active' || staff.passwordHash !== challenge.passwordHash || Boolean(staff.mfaSecret) === challenge.enrolling) throw reject();
      const secret = staff.mfaSecret ? decryptStaffMfaSecret(staff.mfaSecret) : challenge.secret;
      const counter = verifyTotp(secret, input.code, staff.mfaLastCounter);
      if (counter === null) throw reject();
      const [result] = await db.update(staffUsers).set({ mfaSecret: encryptStaffMfaSecret(secret), mfaLastCounter: counter })
        .where(and(eq(staffUsers.id, staff.id), eq(staffUsers.isActive, 'active'), eq(staffUsers.passwordHash, challenge.passwordHash),
          sql`${staffUsers.mfaLastCounter} <=> ${staff.mfaLastCounter}`));
      if (result.affectedRows !== 1) throw reject();
      deleteMfaChallenge(input.challenge);
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
