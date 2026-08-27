import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import OperationalPolicyWorkspace from "./OperationalPolicyWorkspace";
import { OWNER_POLICY_V1_THRESHOLDS } from "./operational-policy-defaults";

const policy = { policyId: "00000000-0000-4000-8000-000000000001", policyCode: "SUBMISSION_SCHEDULER" as const, version: 1,
  state: "ACTIVE" as const, recordVersion: 4, thresholds: OWNER_POLICY_V1_THRESHOLDS, sourceReference: "OWNER_APPROVED_V1",
  effectiveFrom: new Date("2026-08-27T00:00:00Z"), effectiveTo: null, createdBy: "owner", approvedBy: "manager",
  approvedAt: new Date(), activatedBy: "admin", activatedAt: new Date(), evidenceSha256: "a".repeat(64) };
const render = (capabilities = { read: true, propose: false, review: false, activate: false }) => renderToStaticMarkup(<OperationalPolicyWorkspace
  policies={[policy]} selectedPolicyId={policy.policyId} history={[{ eventId: "e1", fromState: "APPROVED", toState: "ACTIVE", versionBefore: 3,
    versionAfter: 4, actorReference: "admin", reason: "Owner-approved activation", payloadSha256: "b".repeat(64), occurredAt: new Date() }]}
  capabilities={capabilities} reason="Governed change" busy={false} onSelect={vi.fn()} onReason={vi.fn()} onTransition={vi.fn()} onShowProposal={vi.fn()} />);

describe("OperationalPolicyWorkspace", () => {
  it("shows active operational classification, thresholds and immutable history", () => {
    const html = render(); expect(html).toContain("Submission Scheduler V1"); expect(html).toContain("OPERATIONAL");
    expect(html).toContain("45 days"); expect(html).toContain("APPROVED → ACTIVE"); expect(html).toContain("not an official UAE");
  });
  it("does not expose mutation controls without server capabilities", () => {
    const html = render(); expect(html).not.toContain("Propose new version"); expect(html).not.toContain(">SUPERSEDED<");
  });
  it("shows only authorized lifecycle controls", () => {
    const html = render({ read: true, propose: true, review: true, activate: true }); expect(html).toContain("Propose new version"); expect(html).toContain(">SUPERSEDED<");
  });
});
