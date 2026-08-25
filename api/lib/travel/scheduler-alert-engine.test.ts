import { describe, expect, it } from "vitest";
import type { SubmissionQueueItem } from "../operations/submission-queue";
import { schedulerAlertCondition } from "./scheduler-alert-engine";

const item = (category: SubmissionQueueItem["category"]): SubmissionQueueItem => ({ applicationId: 1, applicationReference: "TSH-SYN",
  travelGroupId: "group-1", travelGroupReference: "Family trip", scheduleEvaluationId: "schedule-1", applicantNames: ["Applicant"],
  routeCode: "VISA", plannedArrivalDate: "2026-09-20", targetSubmissionDate: "2026-09-01", latestSafeSubmissionDate: "2026-09-03",
  schedulerState: "SCHEDULED_FOR_SUBMISSION", readinessState: "READY_FOR_SUBMISSION", blockingReasons: category === "BLOCKED" ? ["DOCUMENT_MISSING"] : [],
  manualReviewRequired: false, teamId: 3, category, countdownDays: category === "OVERDUE" ? -1 : 1 });

describe("scheduler alert creation policy", () => {
  it("does not create alerts for future work", () => expect(schedulerAlertCondition(item("FUTURE"))).toBeNull());
  it.each([
    ["DUE_SOON", "DUE_SOON", "WARNING"], ["URGENT", "URGENT", "HIGH"], ["DUE_TODAY", "WINDOW_OPEN", "HIGH"],
    ["OVERDUE", "OVERDUE", "CRITICAL"], ["BLOCKED", "BLOCKED", "WARNING"],
  ] as const)("maps %s deterministically", (category, type, severity) => {
    expect(schedulerAlertCondition(item(category))).toMatchObject({ type, severity, category, scheduleEvaluationId: "schedule-1" });
  });
});
