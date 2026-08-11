import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../context";
import { assertApplicantSelection } from "./applicant-selection";
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

  it("binds an applicant id to both its application and index", () => {
    const applicant = { id: 42, applicationId: 7, applicantIndex: 1 };
    expect(assertApplicantSelection(applicant, {
      applicationId: 7,
      applicantId: 42,
      applicantIndex: 1,
    })).toEqual(applicant);
    expect(() => assertApplicantSelection(applicant, {
      applicationId: 8,
      applicantId: 42,
      applicantIndex: 1,
    })).toThrow("selected application slot");
    expect(() => assertApplicantSelection(applicant, {
      applicationId: 7,
      applicantId: 42,
      applicantIndex: 0,
    })).toThrow("selected application slot");
  });
});
