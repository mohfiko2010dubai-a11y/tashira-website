import { describe, expect, it } from "vitest";
import { deriveFamilyReadiness, type ApplicantReadinessInput } from "./family-readiness";

function member(id: number, overrides: Partial<ApplicantReadinessInput> = {}): ApplicantReadinessInput {
  return { applicantId: id, evaluationId: `eval-${id}`, eligibilityState: "ELIGIBLE", routeCompatible: true, requirements: [], ...overrides };
}

describe("deterministic family readiness", () => {
  it("blocks a critical missing document without leaking actions", () => {
    const result = deriveFamilyReadiness([member(1), member(2, { requirements: [
      { applicantId: 2, code: "PASSPORT", critical: true, state: "MISSING" },
    ] })]);
    expect(result.family_readiness_state).toBe("NOT_READY");
    expect(result.blocking_applicant_ids).toEqual([2]);
    expect(result.blocking_reasons).toEqual([{ applicant_id: 2, code: "CRITICAL_DOCUMENT_MISSING", reason: "PASSPORT is not complete" }]);
    expect(result.required_customer_actions).toEqual([{ applicant_id: 2, action: "Complete PASSPORT" }]);
  });

  it("blocks manual review and preserves a rule-conflict reason", () => {
    const result = deriveFamilyReadiness([member(1), member(2, { eligibilityState: "RULE_CONFLICT", manualReviewReason: "Conflicting official sources" })]);
    expect(result.manual_review_required).toBe(true);
    expect(result.blocking_reasons[0]).toMatchObject({ applicant_id: 2, code: "RULE_CONFLICT" });
  });

  it("keeps visa-on-arrival visible without blocking visa applicants", () => {
    const result = deriveFamilyReadiness([member(1, { travelOutcome: "VISA_ON_ARRIVAL" }), member(2)]);
    expect(result.family_readiness_state).toBe("READY_FOR_SUBMISSION");
    expect(result.member_states.map((item) => item.readiness_state)).toEqual(["VISA_ON_ARRIVAL", "READY"]);
  });

  it("blocks one ineligible family member", () => {
    const result = deriveFamilyReadiness([member(1), member(2, { eligibilityState: "INELIGIBLE" })]);
    expect(result.family_readiness_state).toBe("NOT_READY");
    expect(result.blocking_reasons[0].code).toBe("NOT_ELIGIBLE");
  });

  it("is ready when all visa-requiring applicants are ready", () => {
    expect(deriveFamilyReadiness([member(1), member(2)]).family_readiness_state).toBe("READY_FOR_SUBMISSION");
  });

  it("becomes ready after the missing document is validated", () => {
    const waiting = member(2, { requirements: [{ applicantId: 2, code: "PHOTO", critical: true, state: "MISSING" }] });
    const ready = member(2, { evaluationId: "eval-2-new", requirements: [{ applicantId: 2, code: "PHOTO", critical: true, state: "VALIDATED" }] });
    expect(deriveFamilyReadiness([member(1), waiting]).family_readiness_state).toBe("NOT_READY");
    expect(deriveFamilyReadiness([member(1), ready]).family_readiness_state).toBe("READY_FOR_SUBMISSION");
  });

  it("preserves mixed nationality, residence, outcome, and evaluation versions", () => {
    const result = deriveFamilyReadiness([
      member(20, { evaluationId: "egypt-resident-v2", travelOutcome: "VISA_NOT_REQUIRED" }),
      member(21, { evaluationId: "india-nonresident-v7" }),
      member(22, { evaluationId: "pakistan-resident-v4", requirements: [{ applicantId: 22, code: "RESIDENCE", critical: true, state: "MISSING" }] }),
    ]);
    expect(result.member_states).toEqual([
      { applicant_id: 20, evaluation_id: "egypt-resident-v2", readiness_state: "VISA_NOT_REQUIRED" },
      { applicant_id: 21, evaluation_id: "india-nonresident-v7", readiness_state: "READY" },
      { applicant_id: 22, evaluation_id: "pakistan-resident-v4", readiness_state: "WAITING_FOR_DOCUMENTS" },
    ]);
    expect(result.blocking_applicant_ids).toEqual([22]);
  });

  it("rejects duplicate applicant identities", () => {
    expect(() => deriveFamilyReadiness([member(1), member(1)])).toThrow(/unique/i);
  });

  it("rejects a requirement owned by a different applicant", () => {
    expect(() => deriveFamilyReadiness([member(1, { requirements: [
      { applicantId: 2, code: "PASSPORT", critical: true, state: "MISSING" },
    ] })])).toThrow(/ownership/i);
  });
});
