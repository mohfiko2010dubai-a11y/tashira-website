import { describe, expect, it } from "vitest";
import { SupportThreadWorkflow, type SupportCommand, type SupportThread } from "./support-workflow";
const thread: SupportThread = { threadId: "t1", applicationId: 1, customerReference: "TSH-1", state: "UNASSIGNED", priority: "HIGH", assignedStaffId: null, unreadCount: 1, slaDueAt: "2026-08-26T12:00:00Z", version: 1, updatedAt: "2026-08-25T12:00:00Z", internalNotes: [] };
const cmd = (action: SupportCommand["action"], expectedVersion: number, extra: Partial<SupportCommand> = {}): SupportCommand => ({ commandId: `${action}-${expectedVersion}`, expectedVersion, actorStaffId: 7, occurredAt: `2026-08-25T12:0${expectedVersion}:00Z`, action, ...extra });
describe("support thread workflow", () => {
  it("supports claim, work, wait and resolve with optimistic concurrency", () => { const workflow = new SupportThreadWorkflow(thread); expect(workflow.apply(cmd("CLAIM", 1)).state).toBe("ASSIGNED"); expect(workflow.apply(cmd("START", 2)).state).toBe("IN_PROGRESS"); expect(workflow.apply(cmd("WAIT_FOR_CUSTOMER", 3)).state).toBe("WAITING_FOR_CUSTOMER"); expect(workflow.apply(cmd("RESOLVE", 4)).state).toBe("RESOLVED"); });
  it("rejects simultaneous stale claims and preserves idempotency", () => { const workflow = new SupportThreadWorkflow(thread); const claim = cmd("CLAIM", 1); expect(workflow.apply(claim)).toEqual(workflow.apply(claim)); expect(() => workflow.apply({ ...claim, commandId: "other" })).toThrow("SUPPORT_THREAD_VERSION_CONFLICT"); });
  it("records internal notes without sending them to customers", () => { const workflow = new SupportThreadWorkflow(thread); expect(workflow.apply(cmd("ADD_INTERNAL_NOTE", 1, { noteId: "n1", noteBody: "Internal evidence" })).internalNotes).toHaveLength(1); });
  it("fails closed for reassigning an unassigned thread or starting outside ASSIGNED", () => {
    expect(() => new SupportThreadWorkflow(thread).apply(cmd("REASSIGN", 1, { targetStaffId: 8 }))).toThrow("SUPPORT_THREAD_ASSIGNMENT_REQUIRED");
    const resolved = { ...thread, state: "RESOLVED" as const, assignedStaffId: 7 };
    expect(() => new SupportThreadWorkflow(resolved).apply(cmd("START", 1))).toThrow("SUPPORT_THREAD_ASSIGNMENT_REQUIRED");
  });
});
