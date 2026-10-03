import { describe, expect, it, vi } from "vitest";
import { TERMS_POLICY_VERSION } from "../../contracts/constants";

vi.mock("../queries/connection", () => ({ getDb: vi.fn() }));

import { evaluateApplicationReadiness, evaluateInterviewReadiness } from "./application-readiness";

const application = {
  id: 1, baseType: "single" as const, residenceType: "non-gcc" as const,
  visaType: "14days-single", processingType: "regular" as const,
  contactEmail: "synthetic@example.test", contactPhone: "+971500000000", arrivalDate: "2026-09-01",
};
const completeApplicant = (id: number, applicantIndex: number, applicationId = 1) => ({
  id, applicationId, applicantIndex, fullName: "Synthetic Traveller", nationality: "Testland",
  passportNumber: `TEST${id}`, passportType: "ordinary", travelingFrom: "Testland", passportExpiry: "2030-01-01",
  profession: "Tester", gccResidenceNumber: null, gccResidenceCountry: null, sponsorName: null, sponsorRelation: null,
});

describe("owner wizard checkout uses applicant-scoped persisted requirements", () => {
  const applicant = { ...completeApplicant(10, 0), nationality: "EG", gccResidenceCountry: "EG", passportType: null, travelingFrom: null };
  const evidence = { applicantId: 10, route: application.visaType, eligibility: "ELIGIBLE", expected: ["PASSPORT", "PERSONAL_PHOTO"],
    documents: [{ code: "PASSPORT", state: "UPLOADED" }, { code: "PERSONAL_PHOTO", state: "UPLOADED" }] };
  const run = (overrides: Partial<Parameters<typeof evaluateInterviewReadiness>[0]> = {}) => evaluateInterviewReadiness({
    legacy: evaluate({ applicants: [applicant], documents: [], application: { ...application, arrivalDate: "" } }),
    application: { ...application, arrivalDate: "" }, applicants: [applicant], evidence: [evidence], relationshipsComplete: true, ...overrides });
  it("accepts one passport page for Egypt without fields removed from the owner form", () => expect(run().status).toBe("READY"));
  it("rejects a generated placeholder even when all documents are uploaded", () => {
    const result = run({ applicants: [{ ...applicant, fullName: "Applicant 2" }] });
    expect(result.status).toBe("INCOMPLETE");
    expect(result.applicants[0].missing).toContainEqual({ code: "applicant.fullName", label: "Full name" });
    expect(result.applicants[0].label).toBe("Traveller 1");
  });
  it("optional files and notes do not enter the required evidence set", () => {
    for (const count of [0, 1, 6]) {
      const optional = Array.from({ length: count }, (_, index) => ({ code: `OPTIONAL_${index}`, state: "MISSING" }));
      expect(run({ evidence: [{ ...evidence, documents: [...evidence.documents, ...optional] }] }).status).toBe("READY");
    }
  });
  it("requires companion identity details, independently of uploaded sponsor evidence", () => {
    const app = { ...application, residenceType: "gcc-accompany" as const };
    const docs = { ...evidence, expected: [...evidence.expected, "SPONSOR_ID"], documents: [...evidence.documents, { code: "SPONSOR_ID", state: "UPLOADED" }] };
    expect(run({ application: app, evidence: [docs] }).applicants[0].missing.map(item => item.code)).toEqual(["applicant.sponsorName", "applicant.sponsorRelation"]);
    expect(run({ application: app, evidence: [docs], applicants: [{ ...applicant, sponsorName: "Synthetic Sponsor", sponsorRelation: "Parent" }] }).status).toBe("READY");
  });
  it("requires every nationality-specific document independently", () => {
    const result = run({ evidence: [{ ...evidence, expected: [...evidence.expected, "PASSPORT_SECOND_PAGE"] }] });
    expect(result.applicants[0].missing).toContainEqual(expect.objectContaining({ code: "document.PASSPORT_SECOND_PAGE" }));
  });
  it("never treats another traveller's files as this traveller's evidence", () => {
    expect(run({ evidence: [{ ...evidence, applicantId: 11 }] }).status).toBe("INCOMPLETE");
  });
  it("does not add historical catalog uploads to the current owner's checklist", () => {
    expect(run({ evidence: [{ ...evidence, documents: [...evidence.documents, { code: "OLD_CATALOG_DOCUMENT", state: "MISSING" }] }] }).status).toBe("READY");
  });
  it("allows complete uploads before staff review under the owner payment policy", () => {
    expect(run({ evidence: [{ ...evidence, eligibility: "HUMAN_REVIEW_REQUIRED" }] }).status).toBe("READY");
    expect(run({ evidence: [{ ...evidence, eligibility: "RULE_CONFLICT" }] }).status).toBe("READY");
    expect(run({ evidence: [{ ...evidence, eligibility: "HUMAN_REVIEW_REQUIRED", documents: [] }] }).status).toBe("INCOMPLETE");
  });
  it("ignores old eligibility, evaluation, route and family barriers but retains passport and consent", () => {
    expect(run({ evidence: [{ ...evidence, eligibility: "INELIGIBLE" }] }).status).toBe("READY");
    expect(run({ evidence: [{ ...evidence, eligibility: undefined }] }).status).toBe("READY");
    expect(run({ evidence: [{ ...evidence, route: "different-route" }] }).status).toBe("READY");
    expect(run({ applicants: [{ ...applicant, passportExpiry: "2020-01-01" }] }).status).toBe("READY");
    expect(run({ relationshipsComplete: false }).status).toBe("READY");
    expect(run({ legacy: evaluate({ acceptedPolicyVersion: undefined }) }).applicationMissing).toContainEqual(expect.objectContaining({ code: "application.policy" }));
  });
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
