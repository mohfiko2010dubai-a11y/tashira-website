import { describe, expect, it } from "vitest";
import { overdueCustomerWaits, projectCustomerWaits, type CustomerWaitEvent } from "../../contracts/customer-wait-events";
import { customerWaitMilliseconds } from "../../contracts/processing-guarantee";
const hour = (n: number) => new Date(Date.UTC(2026, 9, 7) + n * 3_600_000);
const event = (id: string, waitKey: string, kind: CustomerWaitEvent["kind"], at: number): CustomerWaitEvent =>
  ({ id, waitKey, kind, occurredAt: hour(at), reason: "DOCUMENTS_REQUESTED" });
describe("event-derived customer waits", () => {
  it("reconstructs the same elapsed time after replay and out-of-order delivery", () => {
    const pause = event("sent-1", "document-1", "PAUSE", 2), resume = event("upload-1", "document-1", "RESUME", 8);
    const result = projectCustomerWaits([resume, pause, resume, pause, event("staff-resolved", "document-1", "RESUME", 9)], hour(0), hour(20));
    expect(result.open).toEqual([]);
    expect(customerWaitMilliseconds(hour(0), hour(20), result.intervals)).toBe(6 * 3_600_000);
    expect(projectCustomerWaits([pause, resume], hour(0), hour(20))).toEqual(result);
  });
  it("never reopens a wait already answered before the delayed sent event", () => {
    expect(projectCustomerWaits([event("reply", "quote-1", "RESUME", 4), event("sent", "quote-1", "PAUSE", 5)], hour(0), hour(20))).toEqual({ intervals: [], open: [] });
  });
  it("does not invent pauses for an existing order or from pre-deployment events", () => {
    expect(projectCustomerWaits([], hour(10), hour(20)).intervals).toEqual([]);
    expect(projectCustomerWaits([event("old", "doc-old", "PAUSE", 2)], hour(10), hour(20)).open).toEqual([]);
    expect(projectCustomerWaits([event("new", "doc-new", "PAUSE", 10)], hour(10), hour(20)).open).toHaveLength(1);
  });
  it("keeps separate waits open and sorts overdue items oldest first", () => {
    const events = [event("a", "newer", "PAUSE", 8), event("b", "older", "PAUSE", 2), event("c", "recent", "PAUSE", 19)];
    expect(overdueCustomerWaits(events, hour(0), hour(20), 5).map(item => item.waitKey)).toEqual(["older", "newer"]);
    expect(() => overdueCustomerWaits(events, hour(0), hour(20), 0)).toThrow("threshold");
  });
  it("does not use future responses to shorten an open wait", () => {
    const result = projectCustomerWaits([event("p", "one", "PAUSE", 1), event("r", "one", "RESUME", 30)], hour(0), hour(20));
    expect(result.open).toHaveLength(1);
    expect(result.intervals[0].resumedAt).toBeNull();
  });
  it("rejects conflicting immutable event identities", () => {
    expect(() => projectCustomerWaits([event("same", "one", "PAUSE", 1), event("same", "one", "PAUSE", 2)], hour(0), hour(20))).toThrow("Conflicting");
  });
});
