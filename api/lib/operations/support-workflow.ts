export type SupportThreadState = "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED";
export type SupportPriority = "NORMAL" | "HIGH" | "URGENT";
export type SupportThread = {
  threadId: string; applicationId: number | null; customerReference: string; state: SupportThreadState; priority: SupportPriority;
  assignedStaffId: number | null; unreadCount: number; slaDueAt: string; version: number; updatedAt: string;
  internalNotes: readonly { noteId: string; staffId: number; body: string; occurredAt: string }[];
};
export type SupportCommand = {
  commandId: string; expectedVersion: number; actorStaffId: number; occurredAt: string;
  action: "CLAIM" | "ASSIGN" | "REASSIGN" | "START" | "WAIT_FOR_CUSTOMER" | "RESOLVE" | "ADD_INTERNAL_NOTE";
  targetStaffId?: number; noteId?: string; noteBody?: string;
};

export class SupportThreadWorkflow {
  readonly #commandIds = new Set<string>();
  #thread: SupportThread;
  constructor(thread: SupportThread) { this.#thread = { ...thread, internalNotes: [...thread.internalNotes] }; }
  current(): SupportThread { return { ...this.#thread, internalNotes: this.#thread.internalNotes.map((note) => ({ ...note })) }; }
  apply(command: SupportCommand): SupportThread {
    if (this.#commandIds.has(command.commandId)) return this.current();
    if (command.expectedVersion !== this.#thread.version) throw new Error("SUPPORT_THREAD_VERSION_CONFLICT");
    if (!command.commandId.trim() || Number.isNaN(Date.parse(command.occurredAt))) throw new Error("SUPPORT_COMMAND_EVIDENCE_REQUIRED");
    let next = { ...this.#thread, internalNotes: [...this.#thread.internalNotes] };
    switch (command.action) {
      case "CLAIM":
        if (next.assignedStaffId !== null || next.state !== "UNASSIGNED") throw new Error("SUPPORT_THREAD_ALREADY_ASSIGNED");
        next = { ...next, assignedStaffId: command.actorStaffId, state: "ASSIGNED" };
        break;
      case "ASSIGN": case "REASSIGN":
        if (!command.targetStaffId) throw new Error("SUPPORT_TARGET_STAFF_REQUIRED");
        if (command.action === "ASSIGN" && next.assignedStaffId !== null) throw new Error("SUPPORT_THREAD_ALREADY_ASSIGNED");
        next = { ...next, assignedStaffId: command.targetStaffId, state: "ASSIGNED" };
        break;
      case "START": if (next.assignedStaffId !== command.actorStaffId) throw new Error("SUPPORT_THREAD_ASSIGNMENT_REQUIRED"); next = { ...next, state: "IN_PROGRESS" }; break;
      case "WAIT_FOR_CUSTOMER": if (next.state !== "IN_PROGRESS") throw new Error("SUPPORT_THREAD_STATE_INVALID"); next = { ...next, state: "WAITING_FOR_CUSTOMER" }; break;
      case "RESOLVE": if (!["IN_PROGRESS", "WAITING_FOR_CUSTOMER"].includes(next.state)) throw new Error("SUPPORT_THREAD_STATE_INVALID"); next = { ...next, state: "RESOLVED" }; break;
      case "ADD_INTERNAL_NOTE":
        if (!command.noteId?.trim() || !command.noteBody?.trim()) throw new Error("SUPPORT_INTERNAL_NOTE_REQUIRED");
        if (next.internalNotes.some(({ noteId }) => noteId === command.noteId)) throw new Error("SUPPORT_INTERNAL_NOTE_DUPLICATE");
        next = { ...next, internalNotes: [...next.internalNotes, { noteId: command.noteId, staffId: command.actorStaffId, body: command.noteBody, occurredAt: command.occurredAt }] };
        break;
    }
    this.#commandIds.add(command.commandId);
    this.#thread = { ...next, version: next.version + 1, updatedAt: command.occurredAt };
    return this.current();
  }
}
