import { describe, expect, it } from "vitest";
import { canEnterApplicationState } from "./processing-gate";

describe("verified-payment processing gate", () => {
  it.each(["payment_received", "documents_received", "under_review", "visa_processing", "visa_received", "completed"])(
    "blocks unpaid applications from %s",
    (status) => expect(canEnterApplicationState("pending", status)).toBe(false),
  );

  it("allows pre-payment document correction and terminal cancellation", () => {
    expect(canEnterApplicationState("pending", "documents_pending")).toBe(true);
    expect(canEnterApplicationState("pending", "cancelled")).toBe(true);
    expect(canEnterApplicationState("pending", "rejected")).toBe(true);
  });

  it("allows paid applications to enter operational states", () => {
    expect(canEnterApplicationState("paid", "under_review")).toBe(true);
    expect(canEnterApplicationState("paid", "visa_processing")).toBe(true);
  });
});
