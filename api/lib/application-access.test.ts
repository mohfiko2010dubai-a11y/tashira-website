import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../context";
import { assertApplicationReferenceAccess, hasPrivilegedApplicationAccess } from "./application-authorization";

function context(references: string[] = [], overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    req: new Request("https://example.test/api/trpc"),
    resHeaders: new Headers(),
    isAdmin: false,
    customerApplicationReferences: new Set(references),
    ...overrides,
  };
}

describe("application ownership", () => {
  it("allows only the exact owned reference", () => {
    const customer = context(["TSH-OWNED"]);
    expect(() => assertApplicationReferenceAccess(customer, "TSH-OWNED")).not.toThrow();
    expect(() => assertApplicationReferenceAccess(customer, "TSH-OTHER")).toThrow("access denied");
  });

  it("recognizes staff and administrator access", () => {
    expect(hasPrivilegedApplicationAccess(context([], { staffId: 12 }))).toBe(true);
    expect(hasPrivilegedApplicationAccess(context([], { isAdmin: true }))).toBe(true);
    expect(hasPrivilegedApplicationAccess(context())).toBe(false);
  });
});
