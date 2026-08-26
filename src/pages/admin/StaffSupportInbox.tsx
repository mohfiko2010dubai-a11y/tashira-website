import { useRef, useState } from "react";
import SupportInboxWorkspace from "@/components/operations/SupportInboxWorkspace";
import { trpc } from "@/providers/trpc-client";

export default function StaffSupportInbox() {
  const [threadId, setThreadId] = useState<string | null>(null); const [noteBody, setNoteBody] = useState(""); const [targetStaffId, setTargetStaffId] = useState("");
  const keys = useRef(new Map<string, { commandId: string; noteId?: string }>()); const utils = trpc.useUtils();
  const list = trpc.operationsSupport.list.useQuery({}, { retry: false });
  const detail = trpc.operationsSupport.detail.useQuery({ threadId: threadId ?? "00000000-0000-4000-8000-000000000000" }, { enabled: threadId !== null, retry: false });
  const mutation = trpc.operationsSupport.command.useMutation({ onSuccess: async () => { keys.current.clear(); setNoteBody(""); await Promise.all([utils.operationsSupport.list.invalidate(), utils.operationsSupport.detail.invalidate()]); } });
  if (list.isLoading) return <main className="min-h-screen bg-slate-50 p-8 text-center">Loading Support Inbox…</main>;
  if (list.isError || !list.data) return <main className="min-h-screen bg-slate-50 p-8 text-center">Support Inbox is unavailable for this scope.</main>;
  const execute = (command: { action: "CLAIM" | "ASSIGN" | "REASSIGN" | "START" | "WAIT_FOR_CUSTOMER" | "RESOLVE" | "ADD_INTERNAL_NOTE"; targetStaffId?: number; noteBody?: string }) => {
    if (!detail.data || !threadId) return;
    const signature = JSON.stringify({ threadId, version: detail.data.version, ...command });
    const evidence = keys.current.get(signature) ?? { commandId: crypto.randomUUID(), noteId: command.action === "ADD_INTERNAL_NOTE" ? crypto.randomUUID() : undefined };
    keys.current.set(signature, evidence); mutation.mutate({ threadId, command: { ...command, ...evidence, expectedVersion: detail.data.version } });
  };
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900"><div className="mx-auto max-w-7xl">
    <header className="mb-6 rounded-2xl bg-slate-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">Operations</p><h1 className="mt-2 text-2xl font-bold">Support Inbox</h1>
      <p className="mt-1 text-sm text-slate-300">Internal, scoped and audit-safe support workflow.</p></header>
    <SupportInboxWorkspace threads={list.data} selected={detail.data ?? null} busy={mutation.isPending} noteBody={noteBody} targetStaffId={targetStaffId}
      onNoteBody={setNoteBody} onTargetStaffId={setTargetStaffId} onSelect={setThreadId} onCommand={execute} />
  </div></main>;
}
