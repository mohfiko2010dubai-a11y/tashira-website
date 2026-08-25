import { describe, expect, it } from "vitest";
import type { AuthorizationActor } from "../authorization/policy";
import { buildUpcomingSubmissionsQueue, type SubmissionQueueCandidate } from "./submission-queue";

const actor: AuthorizationActor = { id: "staff:7", permissions: new Set(["case.read"]), scopes: ["TEAM"], teamIds: new Set([3]), departmentIds: new Set() };
const flags = ["OPERATIONS_CASE_READ_MODEL", "SUBMISSION_SCHEDULER"].map((flagKey) => ({ flagKey: flagKey as "OPERATIONS_CASE_READ_MODEL" | "SUBMISSION_SCHEDULER", environment: "TEST" as const, enabled: true, scopeType: "GLOBAL" as const, scopeReference: "" }));
const candidate = (overrides: Partial<SubmissionQueueCandidate> = {}): SubmissionQueueCandidate => ({
  applicationId: 1, applicationReference: "TSH-SYN", travelGroupId: "trip-a", travelGroupReference: "Trip A",
  applicantNames: ["Synthetic Applicant"], routeCode: "SYN", plannedArrivalDate: "2026-12-20",
  targetSubmissionDate: "2026-08-30", latestSafeSubmissionDate: "2026-09-02", schedulerState: "SCHEDULED_FOR_SUBMISSION",
  readinessState: "READY", blockingReasons: [], manualReviewRequired: false, teamId: 3, ...overrides,
});
const build = (candidates: SubmissionQueueCandidate[]) => buildUpcomingSubmissionsQueue({ actor, flags, context: { environment: "TEST", staffId: 7, teamIds: new Set([3]) }, candidates, policy: { dueSoonDays: 7, urgentDays: 2 }, now: new Date("2026-08-25T12:00:00Z") });

describe("Upcoming Submissions queue", () => {
  it("categorizes operational timing deterministically", () => {
    expect(build([candidate()])[0]).toMatchObject({ category: "DUE_SOON", countdownDays: 5 });
    expect(build([candidate({ targetSubmissionDate: "2026-08-25" })])[0].category).toBe("DUE_TODAY");
    expect(build([candidate({ targetSubmissionDate: "2026-08-24" })])[0].category).toBe("OVERDUE");
  });
  it("puts requirements/manual review in BLOCKED without leaking finance", () => {
    const result = build([candidate({ blockingReasons: ["MISSING_PASSPORT"] })])[0];
    expect(result.category).toBe("BLOCKED"); expect(result).not.toHaveProperty("supplierCost"); expect(result).not.toHaveProperty("margin");
  });
  it("filters wrong-team rows and fails closed while either flag is off", () => {
    expect(build([candidate({ teamId: 99 })])).toEqual([]);
    expect(() => buildUpcomingSubmissionsQueue({ actor, flags: flags.slice(0, 1), context: { environment: "TEST" }, candidates: [candidate()], policy: { dueSoonDays: 7, urgentDays: 2 }, now: new Date() })).toThrow("SUBMISSION_QUEUE_DISABLED");
  });
});
