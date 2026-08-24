import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROLE_TEMPLATES } from "../../../api/lib/authorization/permissions";
import { authorize, projectSupplierForActor, type AuthorizationActor } from "../../../api/lib/authorization/policy";
import { assignCase, recordHumanReview, reviewDocument, transitionCaseStatus } from "../../../api/lib/operations/controlled-actions";
import { InMemoryControlledWriteRepository } from "../../../api/lib/operations/controlled-write-repository";
import type { FeatureFlagRecord } from "../../../api/lib/feature-flags/feature-flags";
import { buildLocalAcceptanceModel, LOCAL_ACCEPTANCE_APPLICATION_ID } from "../../../scripts/fixtures/operations-local-acceptance";
import OperationsCaseWorkspace from "./OperationsCaseWorkspace";
import { OperationsControlledWritePanel } from "./OperationsControlledWritePanel";
import { controlledWriteErrorMessage } from "./controlled-write-ui";

const enabled: FeatureFlagRecord = { flagKey: "OPERATIONS_CONTROLLED_WRITES", environment: "TEST", enabled: true, scopeType: "GLOBAL", scopeReference: "" };
const actor = (permissions: AuthorizationActor["permissions"], teamIds = new Set([77])): AuthorizationActor => ({ id: "staff:7001", permissions, scopes: ["TEAM"], teamIds, departmentIds: new Set([7]) });
const dependencies = () => { let id = 0; return { now: () => new Date("2026-08-24T10:00:00.000Z"), newId: () => `acceptance-event-${++id}` }; };
const capabilities = { applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID, version: 0, status: "documents_received" as const, currentActorId: "staff:7001", assignedActorId: "staff:7001", teamId: 77, humanReview: true, documentReview: true, assignmentModes: ["REASSIGN" as const], validStatusTransitions: ["under_review" as const, "documents_pending" as const], reevaluationApplicantIds: [91011, 91012, 91013, 91014], documents: [91011, 91012, 91013, 91014].map((id) => ({ documentId: id + 1000, applicantId: id, version: 0 })), permittedAssignees: [{ actorId: "staff:7002", displayName: "Synthetic Operations Manager" }] };

function repository() {
  const value = new InMemoryControlledWriteRepository();
  value.seed({ applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID, version: 0, status: "documents_received", assignedActorId: "staff:7001", teamId: 77, departmentId: 7, applicantIds: [91011, 91012, 91013, 91014], documents: capabilities.documents, finance: { supplierCost: "2500.00", margin: "900.00", profit: "900.00" } });
  return value;
}

describe("Visa Operations OS final local acceptance", () => {
  it("renders a realistic mixed-nationality family with strict applicant isolation", () => {
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={buildLocalAcceptanceModel("BLOCKED")} />);
    for (const evidence of ["Omar Hassan (Father)", "Egypt", "Aisha Khan (Mother)", "Pakistan", "Arjun Hassan (Child 1)", "India", "Maya Hassan (Child 2)", "Philippines"]) expect(html).toContain(evidence);
    expect(html).toContain("MINOR_BIRTH_CERTIFICATE");
    expect(html).toContain("Minor residence evidence requires authorized human review");
    expect(html).toContain("XYZ Visa Services");
    expect(html).not.toMatch(/2500\.00|supplierCost|internalCost|margin|profit|Stripe|payout/i);
  });

  it("derives blocking applicants, customer action, replacement, and final recovery deterministically", () => {
    const blocked = buildLocalAcceptanceModel("BLOCKED");
    expect(blocked.familyReadiness.family_readiness_state).toBe("NOT_READY");
    expect(blocked.familyReadiness.blocking_applicant_ids).toEqual([91013, 91014]);
    expect(blocked.familyReadiness.required_customer_actions[0]).toMatchObject({ applicant_id: 91013 });
    expect(blocked.applicants.find((item) => item.applicantId === 91011)?.documents[0].readiness).toBe("VALIDATED");
    const replacement = buildLocalAcceptanceModel("REPLACEMENT_REQUIRED");
    expect(replacement.applicants.find((item) => item.applicantId === 91012)?.documents[0].readiness).toBe("REJECTED");
    expect(replacement.familyReadiness.blocking_applicant_ids).toContain(91012);
    const recovered = buildLocalAcceptanceModel("RECOVERED");
    expect(recovered.familyReadiness.family_readiness_state).toBe("READY_FOR_SUBMISSION");
    expect(recovered.familyReadiness.blocking_applicant_ids).toEqual([]);
  });

  it("shows immutable previous/current re-evaluation evidence and changed rule requirements", () => {
    const model = buildLocalAcceptanceModel("REEVALUATED");
    const father = model.applicants[0];
    expect(father.previousEvaluations).toHaveLength(1);
    expect(father.currentEvaluation?.supersedesEvaluationId).toBe(father.previousEvaluations[0].evaluationId);
    expect(father.currentEvaluation?.matchedRuleVersions).toContainEqual({ ruleId: "EG-GCC-FAMILY", version: 2 });
    expect(father.previousEvaluations[0].matchedRuleVersions).toContainEqual({ ruleId: "EG-GCC-FAMILY", version: 1 });
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={model} />);
    expect(html).toContain("Previous:");
    expect(html).toContain("Approved local Rule Version B");
    expect(html).toContain("PASSPORT_AND_UPDATED_GCC_RESIDENCE");
  });

  it("exposes controlled actions visually only while locally enabled", () => {
    const model = buildLocalAcceptanceModel("BLOCKED");
    expect(renderToStaticMarkup(<OperationsControlledWritePanel enabled={false} model={model} capabilities={capabilities} execute={async () => undefined} />)).toBe("");
    const html = renderToStaticMarkup(<OperationsControlledWritePanel enabled model={model} capabilities={capabilities} execute={async () => undefined} />);
    expect(html).toContain("Human Review"); expect(html).toContain("Document Review · Arjun Hassan (Child 1)"); expect(html).toContain("Re-evaluation · Omar Hassan (Father)");
    expect(html).toContain("under review"); expect(html).not.toContain("visa processing");
  });

  it("proves applicant-scoped rejection, audit, assignment, transition, idempotency, and finance immutability", () => {
    const repo = repository();
    const ops = actor(new Set(ROLE_TEMPLATES.OPERATIONS_MANAGER));
    const common = { actor: ops, context: { environment: "TEST" as const }, flags: [enabled], repository: repo, applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID };
    const server = dependencies();
    const beforeFinance = repo.get(LOCAL_ACCEPTANCE_APPLICATION_ID)?.finance;
    const reviewInput = { ...common, expectedVersion: 0, idempotencyKey: "acceptance-document-review", applicantId: 91012, documentId: 92012, expectedDocumentVersion: 0, outcome: "NEEDS_REPLACEMENT" as const, reason: "Synthetic passport image is unreadable" };
    expect(reviewDocument(reviewInput, server).status).toBe("APPLIED");
    expect(reviewDocument(reviewInput, server).status).toBe("IDEMPOTENT_REPLAY");
    expect(() => reviewDocument({ ...reviewInput, expectedVersion: 1, idempotencyKey: "cross-applicant", applicantId: 91013 }, server)).toThrow("DOCUMENT_OWNERSHIP_MISMATCH");
    expect(recordHumanReview({ ...common, expectedVersion: 1, idempotencyKey: "acceptance-human", outcome: "APPROVED_FOR_NEXT_STEP", reason: "Synthetic evidence reviewed" }, server).status).toBe("APPLIED");
    expect(assignCase({ ...common, expectedVersion: 2, idempotencyKey: "acceptance-reassign", mode: "REASSIGN", assignee: { id: "staff:7002", active: true, teamIds: new Set([77]), workloadLimit: 5 }, reason: "Synthetic balanced assignment" }, server).status).toBe("APPLIED");
    expect(transitionCaseStatus({ ...common, expectedVersion: 3, idempotencyKey: "acceptance-transition", to: "under_review", reason: "All synthetic requirements reviewed" }, server).status).toBe("APPLIED");
    expect(repo.audit(LOCAL_ACCEPTANCE_APPLICATION_ID)).toHaveLength(4);
    expect(repo.get(LOCAL_ACCEPTANCE_APPLICATION_ID)?.finance).toEqual(beforeFinance);
  });

  it("rejects stale writes and wrong-team access with safe UX", () => {
    const repo = repository();
    const ops = actor(new Set(ROLE_TEMPLATES.OPERATIONS_MANAGER));
    expect(() => recordHumanReview({ actor: ops, context: { environment: "TEST" }, flags: [enabled], repository: repo, applicationId: LOCAL_ACCEPTANCE_APPLICATION_ID, expectedVersion: 9, idempotencyKey: "stale", outcome: "NEEDS_CORRECTION", reason: "Synthetic stale view" }, dependencies())).toThrow("STALE_ENTITY_VERSION");
    expect(controlledWriteErrorMessage(new Error("CONCURRENCY_CONFLICT"))).toContain("updated by another user");
    expect(authorize(actor(new Set(ROLE_TEMPLATES.OPERATIONS_MANAGER), new Set([88])), "case.read", { teamId: 77 }).allowed).toBe(false);
  });

  it("keeps finance permission separate from Operations and supplier payload minimized", () => {
    const supplier = { id: 701, name: "XYZ Visa Services", slaHours: 24, reliabilityScore: 96, effectiveCost: "2500.00", internalCost: "2100.00" };
    const operations = actor(new Set(ROLE_TEMPLATES.OPERATIONS_MANAGER));
    const finance = actor(new Set(ROLE_TEMPLATES.FINANCE_MANAGER));
    expect(projectSupplierForActor(operations, supplier)).toEqual({ id: 701, name: "XYZ Visa Services", slaHours: 24, reliabilityScore: 96 });
    expect(authorize(finance, "case.transition", { teamId: 77 }).allowed).toBe(false);
    expect(projectSupplierForActor(finance, supplier)).toEqual(supplier);
  });

  it("renders legacy evidence honestly without fabricating rules or requirements", () => {
    const html = renderToStaticMarkup(<OperationsCaseWorkspace enabled model={buildLocalAcceptanceModel("LEGACY")} />);
    expect(html).toContain("LEGACY_NOT_EVALUATED");
    expect(html).toContain("No historical eligibility evaluation has been invented");
    expect(html).not.toContain("EG-GCC-FAMILY v1");
    expect(html).toContain("No evaluated requirements available");
  });
});
