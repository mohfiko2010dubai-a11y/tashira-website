import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCustomerApplicationCookie, getCustomerApplicationReferences, hasCustomerApplicationAccess } from "./customer-session";

describe("customer application capability session", () => {
  beforeEach(() => {
    process.env.CUSTOMER_SESSION_SECRET = "a-review-only-customer-session-secret";
  });

  afterEach(() => {
    delete process.env.CUSTOMER_SESSION_SECRET;
  });

  it("grants only the application references created in the session", () => {
    const initialHeaders = new Headers({ host: "localhost:3000" });
    const firstCookie = createCustomerApplicationCookie(initialHeaders, "TSH-FIRST");
    const secondHeaders = new Headers({ host: "localhost:3000", cookie: firstCookie });
    const secondCookie = createCustomerApplicationCookie(secondHeaders, "TSH-SECOND");
    const requestHeaders = new Headers({ cookie: secondCookie });

    expect([...getCustomerApplicationReferences(requestHeaders)]).toEqual(["TSH-FIRST", "TSH-SECOND"]);
    expect(hasCustomerApplicationAccess(requestHeaders, "TSH-FIRST")).toBe(true);
    expect(hasCustomerApplicationAccess(requestHeaders, "TSH-OTHER")).toBe(false);
  });

  it("rejects tampered capability cookies", () => {
    const headers = new Headers({ host: "localhost:3000" });
    const sessionCookie = createCustomerApplicationCookie(headers, "TSH-OWNED");
    const cookiePair = sessionCookie.split(";", 1)[0];
    const requestHeaders = new Headers({ cookie: `${cookiePair}tampered` });

    expect(getCustomerApplicationReferences(requestHeaders).size).toBe(0);
  });

  it("rejects expired capability cookies", () => {
    const encodedPayload = Buffer.from(JSON.stringify({
      references: ["TSH-OWNED"],
      expiresAt: Math.floor(Date.now() / 1000) - 1,
    }), "utf8").toString("base64url");
    const signature = crypto.createHmac("sha256", process.env.CUSTOMER_SESSION_SECRET!)
      .update(encodedPayload).digest("base64url");
    const requestHeaders = new Headers({
      cookie: `tashira_customer_session=${encodedPayload}.${signature}`,
    });

    expect(hasCustomerApplicationAccess(requestHeaders, "TSH-OWNED")).toBe(false);
  });

  it("uses secure, HttpOnly, Lax cookies outside localhost", () => {
    const cookie = createCustomerApplicationCookie(new Headers({ host: "staging.tashiraev.com" }), "TSH-OWNED");

    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});
