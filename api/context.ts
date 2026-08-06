import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { users } from "@db/schema";
import { authenticateRequest } from "./kimi/auth";
import { verifyAdminSession } from "./lib/admin-session";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: typeof users.$inferSelect;
  isAdmin: boolean;
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
  return ctx;
}
