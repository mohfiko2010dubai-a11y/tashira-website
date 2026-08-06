import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { staffUsers, type users } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { verifyAdminSession } from "./lib/admin-session";
import { getStaffSession } from "./lib/staff-session";
import { getDb } from "./queries/connection";
import { eq } from "drizzle-orm";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: typeof users.$inferSelect;
  isAdmin: boolean;
  staffId?: number;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = {
    req: opts.req,
    resHeaders: opts.resHeaders,
    isAdmin: verifyAdminSession(opts.req.headers),
  };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // Authentication is optional here
  }
  const staffToken = opts.req.headers.get("x-staff-token") || "";
  const staffSession = staffToken ? getStaffSession(staffToken) : null;
  if (staffSession) {
    const [staff] = await getDb().select({ id: staffUsers.id, isActive: staffUsers.isActive })
      .from(staffUsers)
      .where(eq(staffUsers.id, staffSession.staffId))
      .limit(1);
    if (staff?.isActive === "active") ctx.staffId = staff.id;
  }
  return ctx;
}
