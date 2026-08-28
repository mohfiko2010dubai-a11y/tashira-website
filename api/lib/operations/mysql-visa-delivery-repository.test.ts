import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("MySQL visa delivery final-state guard", () => {
  const source = readFileSync("api/lib/operations/mysql-visa-delivery-repository.ts", "utf8");

  it("rechecks paid and visa-issued state inside the locked preparation transaction", () => {
    expect(source).toContain("a.status applicationStatus,a.payment_status paymentStatus");
    expect(source).toContain("FOR UPDATE");
    expect(source).toContain('text(latest,"applicationStatus")!=="visa_received"');
    expect(source).toContain('text(latest,"paymentStatus")!=="paid"');
    expect(source).toContain("VISA_DELIVERY_APPLICATION_STATE_REQUIRED");
  });

  it("checks idempotent replay before enforcing current state", () => {
    expect(source.indexOf("idempotency_key=? FOR UPDATE")).toBeLessThan(source.indexOf("VISA_DELIVERY_APPLICATION_STATE_REQUIRED"));
  });
});
