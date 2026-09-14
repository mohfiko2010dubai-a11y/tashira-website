import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { policyConsentValidity } from "./policy-consent";

describe("explicit policy consent", () => {
  it.each(["APPLICATION_API", "CHATBOT_WIZARD", "STAGING_UAT"])("never accepts a %s record as consent", eventSource => {
    expect(policyConsentValidity({ eventName: "POLICY_ACCEPTED", eventSource, actorType: "CUSTOMER" }, false)).toBe("INVALID");
  });
  it("requires customer attribution and rejects a flagged record even on the modern source", () => {
    const event = { eventName: "POLICY_ACCEPTED", eventSource: "PAYMENT_API", actorType: "CUSTOMER" };
    expect(policyConsentValidity(event, false)).toBe("VALID");
    expect(policyConsentValidity(event, true)).toBe("INVALID");
    expect(policyConsentValidity({ ...event, actorType: "SYSTEM" }, false)).toBe("INVALID");
  });
  it("has no acceptance writer in either legacy creation/submission path", async () => {
    for (const file of ["../application-router.ts", "../wizard-router.ts"]) {
      expect(await readFile(new URL(file, import.meta.url), "utf8")).not.toContain('eventName: "POLICY_ACCEPTED"');
    }
    const modern = await readFile(new URL("../payment-router.ts", import.meta.url), "utf8");
    expect(modern).toContain("accepted: z.literal(true)");
    expect(modern).toContain("policyVersion: z.literal(TERMS_POLICY_VERSION)");
  });
});
