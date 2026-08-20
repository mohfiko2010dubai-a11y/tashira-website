import { describe, expect, it, vi } from "vitest";
import { TERMS_POLICY_VERSION } from "../../contracts/constants";

vi.mock("../queries/connection", () => ({ getDb: vi.fn() }));

import { evaluateApplicationReadiness } from "./application-readiness";

const application = {
  id: 1, baseType: "single" as const, residenceType: "non-gcc" as const,
  visaType: "14days-single", processingType: "regular" as const,
  contactEmail: "synthetic@example.test", contactPhone: "+971500000000", arrivalDate: "2026-09-01",
};
const completeApplicant = (id: number, applicantIndex: number, applicationId = 1) => ({
  id, applicationId, applicantIndex, fullName: `Applicant ${applicantIndex + 1}`, nationality: "Testland",
  passportNumber: `TEST${id}`, passportType: "ordinary", travelingFrom: "Testland", passportExpiry: "2030-01-01",
  profession: "Tester", gccResidenceNumber: null, gccResidenceCountry: null, sponsorName: null, sponsorRelation: null,
});
const completeDocuments = (applicantId: number, applicationId = 1) => [
  { applicationId, applicantId, documentType: "passport" as const, uploadStatus: "uploaded" as const },
  { applicationId, applicantId, documentType: "passport" as const, uploadStatus: "uploaded" as const },
  { applicationId, applicantId, documentType: "photo" as const, uploadStatus: "uploaded" as const },
];
const evaluate = (overrides: Partial<Parameters<typeof evaluateApplicationReadiness>[0]> = {}) => evaluateApplicationReadiness({
  application, applicants: [completeApplicant(10, 0)], documents: completeDocuments(10),
  hasPriceSnapshot: true, acceptedPolicyVersion: TERMS_POLICY_VERSION, ...overrides,
});

describe("server-authoritative application readiness", () => {
  it("allows a complete single applicant", () => expect(evaluate().status).toBe("READY"));
  it("rejects a missing passport and identifies the applicant", () => {
    const result = evaluate({ documents: completeDocuments(10).filter((item) => item.documentType !== "passport") });
    expect(result.status).toBe("INCOMPLETE");
    expect(result.applicants[0].missing).toContainEqual(expect.objectContaining({ code: "document.passport" }));
  });
  it("rejects a missing photo", () => {
    const result = evaluate({ documents: completeDocuments(10).filter((item) => item.documentType !== "photo") });
    expect(result.applicants[0].missing).toContainEqual(expect.objectContaining({ code: "document.photo" }));
  });
  it("rejects missing application fields and policy acceptance", () => {
    const result = evaluate({ application: { ...application, contactPhone: "" }, acceptedPolicyVersion: undefined });
    expect(result.applicationMissing.map((item) => item.code)).toEqual(expect.arrayContaining(["application.contactPhone", "application.policy"]));
  });
  it("validates every family applicant independently without cross-application leakage", () => {
    const family = { ...application, baseType: "family" as const };
    const result = evaluate({
      application: family,
      applicants: [completeApplicant(10, 0), completeApplicant(11, 1)],
      documents: [...completeDocuments(10), ...completeDocuments(11, 999)],
    });
    expect(result.status).toBe("INCOMPLETE");
    expect(result.applicants[0].missing).toHaveLength(0);
    expect(result.applicants[1].missing.map((item) => item.code)).toEqual(expect.arrayContaining(["document.passport", "document.photo"]));
  });
  it("uses conditional GCC and sponsor requirements", () => {
    const gccApplicant = { ...completeApplicant(10, 0), gccResidenceNumber: "GCC1", gccResidenceCountry: "Oman", sponsorName: "Sponsor", sponsorRelation: "Parent" };
    const result = evaluate({ application: { ...application, residenceType: "gcc-accompany" }, applicants: [gccApplicant] });
    expect(result.applicants[0].missing.map((item) => item.code)).toEqual(expect.arrayContaining(["document.gcc_residence", "document.sponsor_id"]));
  });
});
