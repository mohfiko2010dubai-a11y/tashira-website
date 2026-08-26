import type { SupportThreadDetail, SupportThreadResource } from "../../../api/lib/operations/mysql-support-inbox-repository";
import type { SupportCommand } from "../../../api/lib/operations/support-workflow";

type Command = Omit<SupportCommand, "actorStaffId" | "occurredAt" | "commandId" | "expectedVersion"> & { targetStaffId?: number; noteBody?: string };
export default function SupportInboxWorkspace({ threads, selected, busy, noteBody, targetStaffId, onNoteBody, onTargetStaffId, onSelect, onCommand }: {
  threads: readonly SupportThreadResource[]; selected: SupportThreadDetail | null; busy: boolean; noteBody: string; targetStaffId: string;
  onNoteBody(value: string): void; onTargetStaffId(value: string): void; onSelect(threadId: string): void; onCommand(command: Command): void;
}) {
  const actions: readonly { action: Command["action"]; label: string }[] = selected?.state === "UNASSIGNED" ? [{ action: "CLAIM", label: "Claim thread" }]
    : selected?.state === "ASSIGNED" ? [{ action: "START", label: "Start work" }]
      : selected?.state === "IN_PROGRESS" ? [{ action: "WAIT_FOR_CUSTOMER", label: "Wait for customer" }, { action: "RESOLVE", label: "Resolve" }]
        : selected?.state === "WAITING_FOR_CUSTOMER" ? [{ action: "RESOLVE", label: "Resolve" }] : [];
  return <section aria-label="Support Inbox" className="grid gap-6 lg:grid-cols-[22rem_1fr]">
    <aside className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="font-semibold">Support queue</h2>
      <div className="mt-4 space-y-2">{threads.length === 0 ? <p className="text-sm text-slate-500">No permitted support threads.</p> : threads.map((thread) =>
        <button type="button" key={thread.threadId} onClick={() => onSelect(thread.threadId)} className="w-full rounded-xl border p-3 text-left hover:border-amber-500">
          <span className="flex justify-between gap-3"><strong>{thread.customerReference}</strong><span className="text-xs">{thread.priority}</span></span>
          <span className="mt-1 block text-xs text-slate-500">{thread.state} · {thread.unreadCount} unread</span>
        </button>)}</div></aside>
    <article className="rounded-2xl border bg-white p-5 shadow-sm">{!selected ? <p className="text-slate-500">Select a permitted thread.</p> : <>
      <header className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-amber-700">{selected.priority}</p><h2 className="text-xl font-bold">{selected.customerReference}</h2></div>
        <div className="text-right text-sm"><p>{selected.state}</p><p className="text-slate-500">Version {selected.version}</p></div></header>
      <section className="mt-6 space-y-3" aria-label="Messages">{selected.messages.length === 0 ? <p className="text-sm text-slate-500">No persisted messages.</p> : selected.messages.map((message) =>
        <div key={message.messageId} className={`rounded-xl p-4 ${message.direction === "INBOUND" ? "bg-slate-100" : "bg-amber-50"}`}><p className="text-xs font-semibold">{message.channel} · {message.direction}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{message.sanitizedBody}</p><time className="mt-2 block text-xs text-slate-500">{message.occurredAt}</time></div>)}</section>
      <section className="mt-6 border-t pt-4" aria-label="Internal notes"><h3 className="font-semibold">Internal notes</h3>
        <ul className="mt-2 space-y-2">{selected.internalNotes.map((note) => <li key={note.noteId} className="rounded-lg bg-slate-50 p-3 text-sm">{note.body}</li>)}</ul>
        <textarea aria-label="Internal note" value={noteBody} onChange={(event) => onNoteBody(event.target.value)} maxLength={4000} className="mt-3 min-h-24 w-full rounded-lg border p-3" />
        <button type="button" disabled={busy || !noteBody.trim()} onClick={() => onCommand({ action: "ADD_INTERNAL_NOTE", noteBody })} className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Add internal note</button>
      </section>
      <section className="mt-5 border-t pt-4" aria-label="Assignment"><h3 className="font-semibold">Assignment</h3>
        <div className="mt-2 flex flex-wrap gap-2"><input aria-label="Target staff ID" inputMode="numeric" value={targetStaffId} onChange={(event) => onTargetStaffId(event.target.value)} className="w-40 rounded-lg border px-3 py-2 text-sm" placeholder="Staff ID" />
          <button type="button" disabled={busy || !/^[1-9]\d*$/.test(targetStaffId)} onClick={() => onCommand({ action: selected.assignedStaffId === null ? "ASSIGN" : "REASSIGN", targetStaffId: Number(targetStaffId) })}
            className="rounded-lg border border-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-50">{selected.assignedStaffId === null ? "Assign" : "Reassign"}</button></div></section>
      <div className="mt-5 flex flex-wrap gap-2">{actions.map(({ action, label }) => <button type="button" key={action} disabled={busy} onClick={() => onCommand({ action })}
        className="rounded-lg border border-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-50">{label}</button>)}</div>
      <p className="mt-5 text-xs text-slate-500">Outbound email delivery is not enabled from this workspace.</p>
    </>}</article>
  </section>;
}
