import { describe, expect, it } from "vitest";
import { buildOperationsManagerDashboard, type OperationsAnalyticsCase } from "./manager-analytics";
const cases: OperationsAnalyticsCase[] = [
  { applicationId: 1, applicantCount: 3, family: true, travelGroupCount: 2, status: "READY_FOR_SUBMISSION", waitingForCustomer: false, scheduledSubmission: true, dueAt: "2026-08-25", readyForTyping: false, readyForSubmission: true, authorityQueryOpen: false, reworkCount: 1, assignedStaffId: 7, reviewMinutes: 30, typingMinutes: 10, supplierId: 2, documentIntelligenceEscalated: true, manualReviewApplicantCount: 1 },
  { applicationId: 2, applicantCount: 1, family: false, travelGroupCount: 1, status: "VISA_ISSUED", waitingForCustomer: false, scheduledSubmission: false, dueAt: null, readyForTyping: false, readyForSubmission: false, authorityQueryOpen: false, reworkCount: 0, assignedStaffId: 8, reviewMinutes: 10, typingMinutes: 20, supplierId: 2, documentIntelligenceEscalated: false, manualReviewApplicantCount: 0 },
];
describe("operations manager analytics", () => {
  it("builds operational and review metrics without finance data", () => { const dashboard = buildOperationsManagerDashboard({ cases, now: new Date("2026-08-25T12:00:00Z"), dueSoonDays: 7, urgentDays: 2 }); expect(dashboard).toMatchObject({ applications: 2, applicants: 4, families: 1, travelGroups: 3, dueToday: 1, issued: 1, averageReviewMinutes: 20, documentIntelligenceEscalations: 1, manualReviewApplicants: 1, manualReviewRatePercent: 25, financeFieldsIncluded: false }); expect(JSON.stringify(dashboard)).not.toMatch(/cost|margin|profit/i); });
});
