import { z } from "zod";
import { adminQuery, createRouter, loginQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { staffUsers } from "@db/schema";
import { eq, desc } from "drizzle-orm";
import { createStaffSession, deleteStaffSession, getStaffSession } from "./lib/staff-session";
import { auditLog } from "./lib/audit-log";
import { hashPassword, verifyPassword } from "./lib/password";

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
      if (passwordResult.needsUpgrade) {
        await db.update(staffUsers)
          .set({ passwordHash: await hashPassword(input.password) })
          .where(eq(staffUsers.id, staff.id));
      }

      // Create session
      const token = createStaffSession(staff.id);
      auditLog("staff.login", "success", "staff");

      return {
        token,
        staff: {
          id: staff.id,
          username: staff.username,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
        },
      };
    }),

  // Verify token - returns staff info
  verify: publicQuery
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const session = getStaffSession(input.token);
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
        deleteStaffSession(input.token);
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
    .input(z.object({ token: z.string() }))
    .mutation(({ input }) => {
      const hadSession = getStaffSession(input.token) !== null;
      deleteStaffSession(input.token);
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
        password: z.string().min(4),
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
        password: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
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

      await db.update(staffUsers).set(update).where(eq(staffUsers.id, input.id));
      return { success: true };
    }),

  // Admin-only: delete staff user
  delete: adminQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(staffUsers).where(eq(staffUsers.id, input.id));
      return { success: true };
    }),
});
