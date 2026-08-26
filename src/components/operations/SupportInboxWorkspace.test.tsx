import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import SupportInboxWorkspace from "./SupportInboxWorkspace";
import type { SupportThreadDetail } from "../../../api/lib/operations/mysql-support-inbox-repository";

const thread: SupportThreadDetail = { threadId: "thread-1", applicationId: 1, customerReference: "TSH-1", state: "IN_PROGRESS", priority: "HIGH", assignedStaffId: 4,
  unreadCount: 1, slaDueAt: "2026-08-27T00:00:00.000Z", version: 2, updatedAt: "2026-08-26T00:00:00.000Z", internalNotes: [{ noteId: "note-1", staffId: 4, body: "Internal context", occurredAt: "2026-08-26T00:00:00.000Z" }],
  teamId: 7, assignedActorId: "staff:4", messages: [{ messageId: "message-1", providerMessageId: "provider-1", threadId: "thread-1", channel: "EMAIL", direction: "INBOUND",
    applicationId: 1, customerReference: "TSH-1", sanitizedBody: "Please confirm the status.", occurredAt: "2026-08-26T00:00:00.000Z", actorReference: "customer", auditReference: "audit-1" }] };

describe("Support Inbox workspace", () => {
  it("renders persisted safe messages, notes and controlled actions without an outbound sender", () => { const html = renderToStaticMarkup(<SupportInboxWorkspace threads={[thread]} selected={thread} busy={false} noteBody="" targetStaffId="" onNoteBody={vi.fn()} onTargetStaffId={vi.fn()} onSelect={vi.fn()} onCommand={vi.fn()} />);
    expect(html).toContain("Please confirm the status."); expect(html).toContain("Internal context"); expect(html).toContain("Wait for customer"); expect(html).toContain("Reassign"); expect(html).toContain("Outbound email delivery is not enabled");
    expect(html).not.toMatch(/passport|stripe|payment|cost|margin|profit/i);
  });
});
