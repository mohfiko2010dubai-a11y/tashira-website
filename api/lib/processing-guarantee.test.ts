import { describe, expect, it } from "vitest";
import { refundableExpressFee, submissionBreached, submissionDeadline } from "../../contracts/processing-guarantee";
describe("submission guarantee", () => {
  const complete = new Date("2026-10-02T23:30:00Z");
  it("counts continuous hours over a weekend", () => {
    expect(submissionDeadline(complete, true).toISOString()).toBe("2026-10-03T23:30:00.000Z");
    expect(submissionDeadline(complete, false).toISOString()).toBe("2026-10-04T23:30:00.000Z");
  });
  it("keeps the exact deadline eligible and flags the first overdue millisecond", () => {
    const deadline = submissionDeadline(complete, true);
    expect(submissionBreached(complete, null, true, deadline)).toBe(false);
    expect(submissionBreached(complete, null, true, new Date(+deadline + 1))).toBe(true);
  });
  it("uses actual submission, and never erases a late submission breach", () => {
    expect(submissionBreached(complete, new Date(+complete + 1), true, new Date("2030-01-01"))).toBe(false);
    expect(submissionBreached(complete, new Date(+complete + 86_400_001), true)).toBe(true);
    expect(submissionBreached(null, null, true)).toBe(false);
  });
  it("refunds the paid Express difference for every traveller, not a fixed fee or base amount", () => {
    expect(refundableExpressFee(170, 200, 1)).toBe(30);
    expect(refundableExpressFee(185, 222.5, 3)).toBe(112.5);
    expect(() => refundableExpressFee(200, 170, 1)).toThrow();
  });
});
