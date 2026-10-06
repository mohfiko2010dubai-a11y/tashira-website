import { describe, expect, it } from "vitest";
import { customerWaitMilliseconds, submissionBreached, submissionDeadline } from "../../contracts/processing-guarantee";
const start = new Date("2026-10-01T00:00:00Z");
const hour = (n: number) => new Date(+start + n * 3_600_000);
describe("customer-held time in submission guarantee", () => {
  it("excludes eleven hours for acknowledgement and two for payment", () => {
    const waits = [{ startedAt: hour(5), resumedAt: hour(16) }, { startedAt: hour(16), resumedAt: hour(18) }];
    expect(submissionDeadline(start, true, waits, hour(37))).toEqual(hour(37));
    expect(submissionBreached(start, null, true, hour(37), waits)).toBe(false);
    expect(submissionBreached(start, null, true, new Date(+hour(37) + 1), waits)).toBe(true);
  });
  it("does not double-count overlapping document and amendment waits", () => {
    const waits = [{ startedAt: hour(2), resumedAt: hour(10) }, { startedAt: hour(5), resumedAt: hour(12) }, { startedAt: hour(6), resumedAt: hour(8) }];
    expect(customerWaitMilliseconds(start, hour(30), waits)).toBe(10 * 3_600_000);
  });
  it("freezes elapsed handling time for an open pause", () => {
    const waits = [{ startedAt: hour(20), resumedAt: null }];
    expect(submissionBreached(start, null, true, hour(200), waits)).toBe(false);
    expect(submissionDeadline(start, true, waits, hour(200))).toEqual(hour(204));
  });
  it("does not erase a breach that happened before a late pause", () => {
    expect(submissionBreached(start, null, true, hour(200), [{ startedAt: hour(25), resumedAt: null }])).toBe(true);
  });
  it("clips waits to completion and actual submission, ignoring later events", () => {
    const waits = [{ startedAt: hour(-4), resumedAt: hour(2) }, { startedAt: hour(40), resumedAt: null }];
    expect(customerWaitMilliseconds(start, hour(25), waits)).toBe(2 * 3_600_000);
    expect(submissionBreached(start, hour(25), true, hour(200), waits)).toBe(false);
  });
  it("uses the same clock for regular processing", () => {
    expect(submissionDeadline(start, false, [{ startedAt: hour(10), resumedAt: hour(20) }], hour(58))).toEqual(hour(58));
  });
  it("refuses malformed pause evidence rather than inventing an extension", () => {
    expect(() => customerWaitMilliseconds(start, hour(30), [{ startedAt: hour(20), resumedAt: hour(10) }])).toThrow();
    expect(() => customerWaitMilliseconds(start, hour(30), [{ startedAt: new Date("invalid"), resumedAt: null }])).toThrow();
  });
});
