import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { staffUsers, type users } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { getStaffSession, staffTokenFromHeaders } from "./lib/staff-session";
import { getDb } from "./queries/connection";
import { eq } from "drizzle-orm";
import { verifyAdminSessionAsync } from './lib/admin-session';
import { legacyAdminLoginEnabled } from './lib/staff-auth-transition';
import { getCustomerApplicationReferences } from "./lib/customer-session";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: typeof users.$inferSelect;
  isAdmin: boolean;
  staffId?: number;
  customerApplicationReferences: ReadonlySet<string>;
};

export async function createContext(
  opts: Pick<FetchCreateContextFnOptions, 'req' | 'resHeaders'>,
): Promise<TrpcContext> {
  opts.resHeaders.set('cache-control', 'private, no-store');
  const ctx: TrpcContext = {
    req: opts.req,
    resHeaders: opts.resHeaders,
    isAdmin: false,
    customerApplicationReferences: getCustomerApplicationReferences(opts.req.headers),
  };
  try {
    const user = await authenticateRequest(opts.req.headers);
    // Back-office privileges require a named account and completed MFA.
    ctx.user = user ? { ...user, role: 'user' } : undefined;
  } catch {
    // Authentication is optional here
  }
  const staffToken = staffTokenFromHeaders(opts.req.headers);
  const staffSession = staffToken ? getStaffSession(staffToken, opts.req.headers.get('x-staff-active') === '1') : null;
  if (staffSession) {
    const [staff] = await getDb().select({ id: staffUsers.id, isActive: staffUsers.isActive, role: staffUsers.role })
      .from(staffUsers)
      .where(eq(staffUsers.id, staffSession.staffId))
      .limit(1);
    if (staff?.isActive === "active") { ctx.staffId = staff.id; ctx.isAdmin = staff.role === 'admin'; }
  }
  if (!ctx.staffId && opts.req.headers.get('cookie')?.includes('tashira_admin_session=') && await legacyAdminLoginEnabled()) {
    ctx.isAdmin = await verifyAdminSessionAsync(opts.req.headers);
  }
  return ctx;
}
