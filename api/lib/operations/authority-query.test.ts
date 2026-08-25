import { describe, expect, it } from "vitest";
import { AuthorityQueryTimeline, type AuthorityQueryEvent } from "./authority-query";
const event = (state: AuthorityQueryEvent["state"], id: string): AuthorityQueryEvent => ({ eventId: id, queryId: "query-1", applicationId: 1, applicantId: 2, state, occurredAt: `2026-08-25T12:0${id.slice(-1)}:00Z`, actorType: "STAFF", actorId: 9, reason: "Synthetic procedure test", externalReference: state === "RESPONSE_RECEIVED" ? "authority-safe-ref" : null });
describe("authority query timeline", () => {
  it("preserves the controlled append-only lifecycle", () => { const timeline = new AuthorityQueryTimeline(); timeline.append(event("DRAFT", "e1")); timeline.append(event("SUBMITTED", "e2")); timeline.append(event("RESPONSE_RECEIVED", "e3")); timeline.append(event("CLOSED", "e4")); expect(timeline.history("query-1").map(({ state }) => state)).toEqual(["DRAFT", "SUBMITTED", "RESPONSE_RECEIVED", "CLOSED"]); });
  it("fails closed on invalid transitions", () => { const timeline = new AuthorityQueryTimeline(); timeline.append(event("DRAFT", "e1")); expect(() => timeline.append(event("CLOSED", "e2"))).toThrow("AUTHORITY_QUERY_TRANSITION_INVALID"); });
});
