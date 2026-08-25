import { describe, expect, it } from "vitest";
import { projectCanonicalStatus } from "./status-projection";

describe("canonical status projections", () => {
  it("drives portal, email and assistant from one immutable event", () => {
    const result = projectCanonicalStatus({ eventId: "event-1", applicationId: 1, status: "DOCUMENTS_UNDER_REVIEW", occurredAt: "2026-08-25T09:00:00Z", actorType: "STAFF", reasonCode: "REVIEW_STARTED" });
    expect(new Set([result.portal.status, result.email.templateContext, result.assistant.status])).toEqual(new Set(["DOCUMENTS_UNDER_REVIEW"]));
    expect(result.internalTimeline).toMatchObject({ reasonCode: "REVIEW_STARTED", actorType: "STAFF" });
  });

  it("does not leak internal reason codes into customer messages", () => {
    const result = projectCanonicalStatus({ eventId: "event-2", applicationId: 1, status: "REJECTED", occurredAt: "2026-08-25T09:00:00Z", actorType: "ADMIN", reasonCode: "INTERNAL_POLICY_CODE" });
    expect(JSON.stringify([result.portal, result.email, result.assistant])).not.toContain("INTERNAL_POLICY_CODE");
  });
});
