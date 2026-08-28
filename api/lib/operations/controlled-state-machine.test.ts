import { describe, expect, it } from "vitest";
import { controlledTransitionsForPaymentState } from "./controlled-state-machine";

describe("payment-authoritative controlled status transitions", () => {
  it("does not let an Operations actor assert payment receipt for an unpaid case", () => {
    expect(controlledTransitionsForPaymentState("submitted", "pending")).toEqual(["cancelled", "rejected"]);
    expect(controlledTransitionsForPaymentState("submitted", "failed")).toEqual(["cancelled", "rejected"]);
  });

  it("retains the normal controlled state machine after authoritative payment confirmation", () => {
    expect(controlledTransitionsForPaymentState("submitted", "paid")).toEqual(["payment_received", "cancelled", "rejected"]);
    expect(controlledTransitionsForPaymentState("documents_received", "paid")).toEqual(["under_review", "documents_pending", "cancelled", "rejected"]);
  });
});
