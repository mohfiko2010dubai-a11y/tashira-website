import { describe, expect, it } from "vitest";

import type { TrpcContext } from "./context";
import { adminQuery, createRouter, staffOrAdminQuery } from "./middleware";

const securityRouter = createRouter({
  adminOnly: adminQuery.query(() => true),
  staffOrAdmin: staffOrAdminQuery.query(() => true),
});

function context(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    req: new Request("https://example.test/api/trpc"),
    resHeaders: new Headers(),
    isAdmin: false,
    ...overrides,
  };
}

describe("authorization middleware", () => {
  it("rejects anonymous callers from protected procedures", async () => {
    const caller = securityRouter.createCaller(context());
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.staffOrAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows a verified server-side admin session", async () => {
    const caller = securityRouter.createCaller(context({ isAdmin: true }));
    await expect(caller.adminOnly()).resolves.toBe(true);
    await expect(caller.staffOrAdmin()).resolves.toBe(true);
  });

  it("allows verified active staff only on shared staff/admin procedures", async () => {
    const caller = securityRouter.createCaller(context({ staffId: 7 }));
    await expect(caller.staffOrAdmin()).resolves.toBe(true);
    await expect(caller.adminOnly()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
