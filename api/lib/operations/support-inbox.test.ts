import { describe, expect, it } from "vitest";
import { createSuggestedReply, InMemorySupportInbox } from "./support-inbox";

describe("provider-independent Support Inbox", () => {
  it("combines linked email and chat in one audited thread", () => {
    const inbox = new InMemorySupportInbox();
    expect(inbox.append({ messageId: "1", providerMessageId: "email-1", threadId: "thread-1", channel: "EMAIL", direction: "INBOUND", applicationId: 5, customerReference: "TSH-5", sanitizedBody: "Please update me", occurredAt: "2026-08-25T09:00:00Z", actorReference: "customer:TSH-5", auditReference: "audit-1" })).toBe("APPENDED");
    expect(inbox.append({ messageId: "2", providerMessageId: "chat-1", threadId: "thread-1", channel: "CHAT", direction: "OUTBOUND", applicationId: 5, customerReference: "TSH-5", sanitizedBody: "We are reviewing it", occurredAt: "2026-08-25T09:01:00Z", actorReference: "staff:7", auditReference: "audit-2" })).toBe("APPENDED");
    expect(inbox.thread("thread-1").map((item) => item.channel)).toEqual(["EMAIL", "CHAT"]);
  });

  it("deduplicates provider retries", () => {
    const inbox = new InMemorySupportInbox();
    const message = { messageId: "1", providerMessageId: "provider-1", threadId: "thread-1", channel: "EMAIL" as const, direction: "INBOUND" as const, applicationId: 5, customerReference: null, sanitizedBody: "Hello", occurredAt: "2026-08-25T09:00:00Z", actorReference: "customer", auditReference: "audit-1" };
    expect(inbox.append(message)).toBe("APPENDED");
    expect(inbox.append(message)).toBe("DUPLICATE");
    expect(inbox.thread("thread-1")).toHaveLength(1);
  });

  it("keeps AI replies as human-approved drafts", () => {
    expect(createSuggestedReply({ threadId: "thread-1", text: "Suggested reply", evidenceReferences: ["case:5"] })).toMatchObject({ state: "DRAFT_REQUIRES_HUMAN_APPROVAL", autoSendAllowed: false });
  });
});
