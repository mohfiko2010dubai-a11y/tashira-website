export type OperationsAnalyticsCase = {
  applicationId: number; applicantCount: number; family: boolean; travelGroupCount: number; status: string;
  waitingForCustomer: boolean; scheduledSubmission: boolean; dueAt: string | null; readyForTyping: boolean; readyForSubmission: boolean;
  authorityQueryOpen: boolean; reworkCount: number; assignedStaffId: number | null; reviewMinutes: number | null; typingMinutes: number | null;
  supplierId: number | null; documentIntelligenceEscalated: boolean; manualReviewApplicantCount: number;
};
export type OperationsManagerDashboard = {
  openCases: number; waitingForCustomer: number; scheduledSubmissions: number; dueSoon: number; urgent: number; dueToday: number; overdue: number;
  readyForTyping: number; readyForSubmission: number; submitted: number; authorityQueries: number; slaRisk: number; rework: number; issued: number; rejected: number;
  applications: number; applicants: number; families: number; travelGroups: number; averageReviewMinutes: number | null; averageTypingMinutes: number | null;
  documentIntelligenceEscalations: number; manualReviewApplicants: number; manualReviewRatePercent: number;
  employeeWorkload: readonly { staffId: number; openCases: number }[]; supplierOperationalPerformance: readonly { supplierId: number; caseCount: number; issued: number; rejected: number }[];
  financeFieldsIncluded: false;
};
const terminal = new Set(["COMPLETED", "CANCELLED", "REJECTED", "VISA_ISSUED"]);
const average = (values: readonly (number | null)[]) => { const numbers = values.filter((value): value is number => value !== null); return numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : null; };
export function buildOperationsManagerDashboard(input: { cases: readonly OperationsAnalyticsCase[]; now: Date; dueSoonDays: number; urgentDays: number }): OperationsManagerDashboard {
  if (input.dueSoonDays < input.urgentDays || input.urgentDays < 0) throw new Error("OPERATIONS_ANALYTICS_POLICY_INVALID");
  const today = input.now.toISOString().slice(0, 10); const day = 86_400_000;
  const daysUntil = (date: string | null) => date ? Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / day) : null;
  const open = input.cases.filter((item) => !terminal.has(item.status));
  const applicantCount = input.cases.reduce((sum, item) => sum + item.applicantCount, 0);
  const manualReviewApplicants = input.cases.reduce((sum, item) => sum + item.manualReviewApplicantCount, 0);
  const workloads = new Map<number, number>(); const suppliers = new Map<number, { caseCount: number; issued: number; rejected: number }>();
  for (const item of open) if (item.assignedStaffId !== null) workloads.set(item.assignedStaffId, (workloads.get(item.assignedStaffId) ?? 0) + 1);
  for (const item of input.cases) if (item.supplierId !== null) { const value = suppliers.get(item.supplierId) ?? { caseCount: 0, issued: 0, rejected: 0 }; value.caseCount++; if (item.status === "VISA_ISSUED") value.issued++; if (item.status === "REJECTED") value.rejected++; suppliers.set(item.supplierId, value); }
  return {
    openCases: open.length, waitingForCustomer: open.filter((item) => item.waitingForCustomer).length, scheduledSubmissions: open.filter((item) => item.scheduledSubmission).length,
    dueSoon: open.filter((item) => { const days = daysUntil(item.dueAt); return days !== null && days >= 0 && days <= input.dueSoonDays; }).length,
    urgent: open.filter((item) => { const days = daysUntil(item.dueAt); return days !== null && days >= 0 && days <= input.urgentDays; }).length,
    dueToday: open.filter((item) => daysUntil(item.dueAt) === 0).length, overdue: open.filter((item) => { const days = daysUntil(item.dueAt); return days !== null && days < 0; }).length,
    readyForTyping: open.filter((item) => item.readyForTyping).length, readyForSubmission: open.filter((item) => item.readyForSubmission).length,
    submitted: input.cases.filter((item) => item.status === "SUBMITTED_TO_AUTHORITY").length, authorityQueries: open.filter((item) => item.authorityQueryOpen).length,
    slaRisk: open.filter((item) => { const days = daysUntil(item.dueAt); return days !== null && days <= input.urgentDays; }).length, rework: input.cases.reduce((sum, item) => sum + item.reworkCount, 0),
    issued: input.cases.filter((item) => item.status === "VISA_ISSUED").length, rejected: input.cases.filter((item) => item.status === "REJECTED").length,
    applications: input.cases.length, applicants: applicantCount, families: input.cases.filter((item) => item.family).length,
    travelGroups: input.cases.reduce((sum, item) => sum + item.travelGroupCount, 0), averageReviewMinutes: average(input.cases.map((item) => item.reviewMinutes)), averageTypingMinutes: average(input.cases.map((item) => item.typingMinutes)),
    documentIntelligenceEscalations: input.cases.filter((item) => item.documentIntelligenceEscalated).length,
    manualReviewApplicants, manualReviewRatePercent: applicantCount === 0 ? 0 : Number(((manualReviewApplicants / applicantCount) * 100).toFixed(2)),
    employeeWorkload: [...workloads].map(([staffId, openCases]) => ({ staffId, openCases })).sort((a, b) => a.staffId - b.staffId),
    supplierOperationalPerformance: [...suppliers].map(([supplierId, value]) => ({ supplierId, ...value })).sort((a, b) => a.supplierId - b.supplierId), financeFieldsIncluded: false,
  };
}
