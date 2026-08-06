import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery } from "./middleware";
import { publicQuery } from "./middleware";
import { z } from "zod";
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  verifyAdminPassword,
} from "./lib/admin-session";
import { TRPCError } from "@trpc/server";

export const authRouter = createRouter({
  adminLogin: publicQuery
    .input(z.object({ password: z.string().min(1).max(500) }))
    .mutation(({ input, ctx }) => {
      try {
        if (!verifyAdminPassword(input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        }
        ctx.resHeaders.append("set-cookie", createAdminSessionCookie(ctx.req.headers));
        return { success: true };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Admin authentication is not configured" });
      }
    }),
  adminMe: publicQuery.query(({ ctx }) => ({ authenticated: ctx.isAdmin || ctx.user?.role === "admin" })),
  adminLogout: publicQuery.mutation(({ ctx }) => {
    ctx.resHeaders.append("set-cookie", clearAdminSessionCookie(ctx.req.headers));
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
